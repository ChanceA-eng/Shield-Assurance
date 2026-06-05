(function () {
    const singletonKey = "primary";

    const config = window.SHIELD_SUPABASE_CONFIG || {};
    const hasConfig = Boolean(config.url && config.anonKey);
    const supabaseLib = window.supabase;
    const hasClientLib = Boolean(supabaseLib && typeof supabaseLib.createClient === "function");
    const isReady = hasConfig && hasClientLib;

    const client = isReady
        ? supabaseLib.createClient(config.url, config.anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        })
        : null;

    const safeUrl = (value) => {
        const url = String(value || "").trim();
        if (!url) {
            return "";
        }

        if (!/^https?:\/\//i.test(url)) {
            return "";
        }

        return url;
    };

    const mapTableError = (error, tableName) => {
        const message = String((error && error.message) || "");
        const missingTable = message.includes("Could not find the table") || message.includes("schema cache");
        if (!missingTable) {
            return error;
        }

        return new Error(
            `Supabase table ${tableName} is missing in this project. Open Supabase SQL Editor and run supabase-schema.sql, then refresh the site.`
        );
    };

    const postWebhook = async (url, payload) => {
        const endpoint = safeUrl(url);
        if (!endpoint) {
            return;
        }

        try {
            await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.warn("Webhook dispatch failed.", error);
        }
    };

    const getSessionUser = async () => {
        if (!client) {
            return null;
        }

        const { data } = await client.auth.getUser();
        return data.user || null;
    };

    const signIn = async (email, password) => {
        if (!client) {
            throw new Error("Supabase is not configured.");
        }

        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
            throw error;
        }

        return data.user;
    };

    const signOut = async () => {
        if (!client) {
            return;
        }

        await client.auth.signOut();
    };

    const getSiteContent = async () => {
        if (!client) {
            return null;
        }

        const { data, error } = await client
            .from("site_content")
            .select("payload")
            .eq("singleton_key", singletonKey)
            .single();

        if (error) {
            throw mapTableError(error, "public.site_content");
        }

        return data ? data.payload : null;
    };

    const saveSiteContent = async (payload) => {
        if (!client) {
            throw new Error("Supabase is not configured.");
        }

        const user = await getSessionUser();
        if (!user) {
            throw new Error("You must be signed in.");
        }

        const { error } = await client
            .from("site_content")
            .upsert(
                {
                    singleton_key: singletonKey,
                    payload,
                    updated_at: new Date().toISOString(),
                    updated_by: user.id
                },
                { onConflict: "singleton_key" }
            );

        if (error) {
            throw mapTableError(error, "public.site_content");
        }
    };

    const listLeads = async (query, status) => {
        if (!client) {
            throw new Error("Supabase is not configured.");
        }

        let request = client
            .from("leads")
            .select("id, created_at, submission_date, client_name, email, phone, insurance_line, risk_details, status, intake_route")
            .order("submission_date", { ascending: false })
            .limit(250);

        if (status && status !== "All") {
            request = request.eq("status", status);
        }

        if (query && String(query).trim()) {
            const cleaned = String(query).trim();
            request = request.or(`client_name.ilike.%${cleaned}%,email.ilike.%${cleaned}%,phone.ilike.%${cleaned}%,insurance_line.ilike.%${cleaned}%`);
        }

        const { data, error } = await request;
        if (error) {
            throw mapTableError(error, "public.leads");
        }

        return data || [];
    };

    const updateLeadStatus = async (leadId, status) => {
        if (!client) {
            throw new Error("Supabase is not configured.");
        }

        const { error } = await client
            .from("leads")
            .update({ status })
            .eq("id", leadId);

        if (error) {
            throw mapTableError(error, "public.leads");
        }
    };

    const getIntegrationSettings = async () => {
        if (!client) {
            throw new Error("Supabase is not configured.");
        }

        const [privateResult, runtimeResult] = await Promise.all([
            client
                .from("integration_settings")
                .select("crm_api_key")
                .eq("singleton_key", singletonKey)
                .single(),
            client
                .from("public_runtime_settings")
                .select("crm_webhook_url, notification_webhook_url, pipeline_webhook_url, carrier_url_business, carrier_url_home, carrier_url_auto")
                .eq("singleton_key", singletonKey)
                .single()
        ]);

        if (privateResult.error) {
            throw mapTableError(privateResult.error, "public.integration_settings");
        }
        if (runtimeResult.error) {
            throw mapTableError(runtimeResult.error, "public.public_runtime_settings");
        }

        return {
            crmApiKey: privateResult.data.crm_api_key || "",
            crmWebhookUrl: runtimeResult.data.crm_webhook_url || "",
            notificationWebhookUrl: runtimeResult.data.notification_webhook_url || "",
            pipelineWebhookUrl: runtimeResult.data.pipeline_webhook_url || "",
            carrierUrlBusiness: runtimeResult.data.carrier_url_business || "",
            carrierUrlHome: runtimeResult.data.carrier_url_home || "",
            carrierUrlAuto: runtimeResult.data.carrier_url_auto || ""
        };
    };

    const saveIntegrationSettings = async (settings) => {
        if (!client) {
            throw new Error("Supabase is not configured.");
        }

        const user = await getSessionUser();
        if (!user) {
            throw new Error("You must be signed in.");
        }

        const privatePayload = {
            singleton_key: singletonKey,
            crm_api_key: String(settings.crmApiKey || "").trim(),
            updated_at: new Date().toISOString(),
            updated_by: user.id
        };

        const runtimePayload = {
            singleton_key: singletonKey,
            crm_webhook_url: safeUrl(settings.crmWebhookUrl),
            notification_webhook_url: safeUrl(settings.notificationWebhookUrl),
            pipeline_webhook_url: safeUrl(settings.pipelineWebhookUrl),
            carrier_url_business: safeUrl(settings.carrierUrlBusiness),
            carrier_url_home: safeUrl(settings.carrierUrlHome),
            carrier_url_auto: safeUrl(settings.carrierUrlAuto),
            updated_at: new Date().toISOString(),
            updated_by: user.id
        };

        const [privateResult, runtimeResult] = await Promise.all([
            client
                .from("integration_settings")
                .upsert(privatePayload, { onConflict: "singleton_key" }),
            client
                .from("public_runtime_settings")
                .upsert(runtimePayload, { onConflict: "singleton_key" })
        ]);

        if (privateResult.error) {
            throw mapTableError(privateResult.error, "public.integration_settings");
        }

        if (runtimeResult.error) {
            throw mapTableError(runtimeResult.error, "public.public_runtime_settings");
        }
    };

    const getRuntimeSettings = async () => {
        if (!client) {
            return {};
        }

        const { data, error } = await client
            .from("public_runtime_settings")
            .select("crm_webhook_url, notification_webhook_url, pipeline_webhook_url, carrier_url_business, carrier_url_home, carrier_url_auto")
            .eq("singleton_key", singletonKey)
            .single();

        if (error) {
            return {};
        }

        return {
            crmWebhookUrl: data.crm_webhook_url || "",
            notificationWebhookUrl: data.notification_webhook_url || "",
            pipelineWebhookUrl: data.pipeline_webhook_url || "",
            carrierUrlBusiness: data.carrier_url_business || "",
            carrierUrlHome: data.carrier_url_home || "",
            carrierUrlAuto: data.carrier_url_auto || ""
        };
    };

    const createLead = async (lead) => {
        if (!client) {
            throw new Error("Supabase is not configured.");
        }

        const payload = {
            submission_date: new Date().toISOString(),
            client_name: String(lead.clientName || "").trim(),
            email: String(lead.email || "").trim(),
            phone: String(lead.phone || "").trim(),
            insurance_line: String(lead.insuranceLine || "").trim(),
            risk_details: String(lead.riskDetails || "").trim(),
            status: "New",
            intake_route: String(lead.intakeRoute || "general").trim(),
            source_page: String(lead.sourcePage || window.location.pathname || "contact"),
            metadata: lead.metadata || {}
        };

        const { data, error } = await client
            .from("leads")
            .insert(payload)
            .select("id, submission_date, client_name, email, phone, insurance_line, risk_details, status, intake_route")
            .single();

        if (error) {
            throw error;
        }

        const runtimeSettings = await getRuntimeSettings();
        const webhookPayload = {
            event: "new_lead",
            lead: data
        };

        await Promise.all([
            postWebhook(runtimeSettings.crmWebhookUrl, webhookPayload),
            postWebhook(runtimeSettings.notificationWebhookUrl, webhookPayload)
        ]);

        return data;
    };

    const pushLeadToPipeline = async (lead) => {
        const runtimeSettings = await getRuntimeSettings();
        await postWebhook(runtimeSettings.pipelineWebhookUrl || runtimeSettings.crmWebhookUrl, {
            event: "push_to_pipeline",
            lead
        });
    };

    const getCarrierRoute = async (line) => {
        const runtimeSettings = await getRuntimeSettings();
        const normalized = String(line || "").toLowerCase();
        if (normalized.includes("business") || normalized.includes("commercial")) {
            return runtimeSettings.carrierUrlBusiness || "";
        }

        if (normalized.includes("home") || normalized.includes("property")) {
            return runtimeSettings.carrierUrlHome || "";
        }

        if (normalized.includes("auto") || normalized.includes("fleet")) {
            return runtimeSettings.carrierUrlAuto || "";
        }

        return runtimeSettings.carrierUrlBusiness || runtimeSettings.carrierUrlHome || runtimeSettings.carrierUrlAuto || "";
    };

    window.ShieldBackend = {
        isConfigured: isReady,
        getSessionUser,
        signIn,
        signOut,
        getSiteContent,
        saveSiteContent,
        listLeads,
        updateLeadStatus,
        getIntegrationSettings,
        saveIntegrationSettings,
        createLead,
        pushLeadToPipeline,
        getCarrierRoute
    };
})();
