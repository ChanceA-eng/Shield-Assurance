(function () {
    const singletonKey = "primary";
    const localLeadQueueKey = "shieldLocalLeadsQueue";
    const localSubmittedLeadKey = "shieldSubmittedLeadsCache";

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

    const readLocalLeadQueue = () => {
        try {
            const raw = localStorage.getItem(localLeadQueueKey);
            const parsed = JSON.parse(raw || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    };

    const writeLocalLeadQueue = (rows) => {
        try {
            localStorage.setItem(localLeadQueueKey, JSON.stringify(Array.isArray(rows) ? rows : []));
        } catch (_) {}
    };

    const readLocalSubmittedLeads = () => {
        try {
            const raw = localStorage.getItem(localSubmittedLeadKey);
            const parsed = JSON.parse(raw || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    };

    const writeLocalSubmittedLeads = (rows) => {
        try {
            localStorage.setItem(localSubmittedLeadKey, JSON.stringify(Array.isArray(rows) ? rows : []));
        } catch (_) {}
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

    const CRM_ENDPOINT = "https://shield-assurance-crm-api.vercel.app/api/leads";

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

    const splitName = (fullName) => {
        const clean = String(fullName || "").trim();
        if (!clean) {
            return { firstName: "", lastName: "" };
        }

        const parts = clean.split(/\s+/).filter(Boolean);
        return {
            firstName: parts[0] || "",
            lastName: parts.slice(1).join(" ")
        };
    };

    const postToCrm = async (lead, payload) => {
        const meta = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
        const routing = meta.routingContext && typeof meta.routingContext === "object" ? meta.routingContext : {};
        const assets = meta.assets && typeof meta.assets === "object" ? meta.assets : {};
        const guide = meta.guide && typeof meta.guide === "object" ? meta.guide : {};
        const nameParts = splitName(payload.client_name);
        const selectedLine = String(routing.selectedLine || guide.category || payload.insurance_line || "").trim().toLowerCase();
        const sourceValue = meta.crmSource || routing.sourceChannel || payload.source_page || "website-contact-form";
        const crmPayload = {
            full_name: payload.client_name,
            fullName: payload.client_name,
            name: payload.client_name,
            first_name: nameParts.firstName,
            last_name: nameParts.lastName,
            email: payload.email,
            phone: payload.phone,
            zip: String(meta.zip || routing.zip || assets.zip || "").trim(),
            state: String(meta.state || routing.state || assets.state || "AZ").trim() || "AZ",
            line: payload.insurance_line,
            line_of_business: payload.insurance_line,
            primaryCoverage: selectedLine,
            business: String(meta.business || routing.business || assets.business || "").trim(),
            vin: String(meta.vin || routing.vin || assets.vin || "").trim(),
            year: String(meta.year || routing.year || assets.year || "").trim(),
            make: String(meta.make || routing.make || assets.make || "").trim(),
            model: String(meta.model || routing.model || assets.model || "").trim(),
            requirements: payload.risk_details,
            message: payload.risk_details,
            source: sourceValue,
            src: sourceValue,
            from: payload.source_page,
            utm_source: String(meta.utm_source || routing.utm_source || "").trim(),
            insurance_line: payload.insurance_line,
            details: payload.risk_details
        };

        try {
            await fetch(CRM_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(crmPayload)
            });
        } catch (error) {
            console.warn("CRM direct post failed.", error);
        }
    };

    const normalizeLineBucket = (value) => {
        const raw = String(value || "").trim().toLowerCase();
        if (!raw) {
            return "general";
        }

        if (raw.includes("business") || raw.includes("commercial")) {
            return "commercial";
        }

        if (raw.includes("home") || raw.includes("property")) {
            return "property";
        }

        if (raw.includes("auto") || raw.includes("fleet") || raw.includes("vehicle")) {
            return "auto-fleet";
        }

        if (raw === "personal") {
            return "property";
        }

        return raw;
    };

    const normalizeBundleLines = (list) => {
        if (!Array.isArray(list)) {
            return [];
        }

        const set = new Set();
        list.forEach((line) => {
            const normalized = normalizeLineBucket(line);
            if (normalized && normalized !== "general") {
                set.add(normalized);
            }
        });
        return Array.from(set);
    };

    const normalizeStatusValue = (value) => {
        const raw = String(value || "").trim().toLowerCase();
        if (!raw) {
            return "New";
        }

        if (raw === "new") return "New";
        if (raw === "in progress" || raw === "in_progress" || raw === "inprogress") return "In Progress";
        if (raw === "quoted") return "Quoted";
        return String(value || "").trim() || "New";
    };

    const normalizePhoneValue = (value) => {
        const raw = String(value || "").trim();
        if (!raw) {
            return "";
        }
        const digits = raw.replace(/[^\d]/g, "");
        if (digits.length === 10) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
        return raw;
    };

    const toIsoDateString = (value) => {
        const time = new Date(value || 0).getTime();
        if (!Number.isFinite(time) || time <= 0) {
            return new Date().toISOString();
        }
        return new Date(time).toISOString();
    };

    const leadSourceRank = (row) => {
        const id = String(row && row.id || "");
        if (id.startsWith("local-")) return 1;
        if (id.startsWith("submitted-")) return 2;
        return 3;
    };

    const leadCompletenessScore = (row) => {
        const fields = [row.client_name, row.email, row.phone, row.insurance_line, row.risk_details];
        const nonEmptyCount = fields.reduce((count, value) => count + (String(value || "").trim() ? 1 : 0), 0);
        return (leadSourceRank(row) * 10) + nonEmptyCount;
    };

    const isSameLeadRecord = (a, b) => {
        if (!a || !b) {
            return false;
        }

        if (String(a.id || "") && String(a.id || "") === String(b.id || "")) {
            return true;
        }

        const keyA = {
            email: String(a.email || "").trim().toLowerCase(),
            phone: String(a.phone || "").replace(/\D/g, ""),
            line: normalizeLineBucket(a.insurance_line),
            risk: String(a.risk_details || "").trim().toLowerCase()
        };
        const keyB = {
            email: String(b.email || "").trim().toLowerCase(),
            phone: String(b.phone || "").replace(/\D/g, ""),
            line: normalizeLineBucket(b.insurance_line),
            risk: String(b.risk_details || "").trim().toLowerCase()
        };

        if (!keyA.email && !keyA.phone) {
            return false;
        }

        const sameIdentity = keyA.email === keyB.email && keyA.phone === keyB.phone;
        const sameLine = keyA.line === keyB.line;
        const sameRisk = keyA.risk === keyB.risk;

        if (!(sameIdentity && sameLine && sameRisk)) {
            return false;
        }

        const aTime = new Date(a.submission_date || a.created_at || 0).getTime();
        const bTime = new Date(b.submission_date || b.created_at || 0).getTime();
        if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) {
            return false;
        }

        return Math.abs(aTime - bTime) <= (1000 * 60 * 10);
    };

    const dedupeLeadRows = (rows) => {
        const result = [];
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            const current = toLeadRowShape(row);
            if (!current) {
                return;
            }

            const existingIndex = result.findIndex((candidate) => isSameLeadRecord(candidate, current));
            if (existingIndex < 0) {
                result.push(current);
                return;
            }

            const existing = result[existingIndex];
            const best = leadCompletenessScore(current) >= leadCompletenessScore(existing) ? current : existing;
            result[existingIndex] = best;
        });

        return result;
    };

    const deriveLeadClassification = (lead) => {
        const metadata = lead && typeof lead.metadata === "object" ? lead.metadata : {};
        const routingContext = metadata.routingContext && typeof metadata.routingContext === "object" ? metadata.routingContext : {};
        const guide = metadata.guide && typeof metadata.guide === "object" ? metadata.guide : {};
        const assets = metadata.assets && typeof metadata.assets === "object" ? metadata.assets : {};

        const selectedLine = normalizeLineBucket(routingContext.selectedLine || guide.category || lead.insuranceLine || "");
        const bundleSelections = normalizeBundleLines(routingContext.bundleLines || assets.bundleSelections || []);
        const explicitBundleRequested = Boolean(routingContext.bundleRequested);
        const bundleRequested = explicitBundleRequested || bundleSelections.length > 1;

        const primaryLine = selectedLine === "general" ? normalizeLineBucket(lead.insuranceLine || "") : selectedLine;
        const sourceChannel = String(routingContext.sourceChannel || metadata.sourceChannel || "").trim();

        return {
            primaryLine: primaryLine || "general",
            bundleRequested,
            bundleLines: bundleSelections,
            sourceChannel,
            entryType: String(routingContext.entryType || "").trim().toLowerCase(),
            selectedLine: String(routingContext.selectedLine || guide.category || "").trim().toLowerCase()
        };
    };

    const toLeadRowShape = (row) => {
        if (!row || typeof row !== "object") {
            return null;
        }

        const createdAt = toIsoDateString(row.created_at || row.submission_date);
        const submittedAt = toIsoDateString(row.submission_date || row.created_at);

        return {
            id: row.id,
            created_at: createdAt,
            submission_date: submittedAt,
            client_name: String(row.client_name || row.clientName || "").trim(),
            email: String(row.email || "").trim().toLowerCase(),
            phone: normalizePhoneValue(row.phone || ""),
            insurance_line: row.insurance_line || row.insuranceLine || "general",
            risk_details: String(row.risk_details || row.riskDetails || "").trim(),
            status: normalizeStatusValue(row.status || "New"),
            intake_route: row.intake_route || row.intakeRoute || "general",
            source_page: row.source_page || row.sourcePage || "/quote",
            metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {}
        };
    };

    const normalizeQueueLeadToRow = (queued, index) => {
        const q = queued && typeof queued === "object" ? queued : {};
        const guide = q.guide && typeof q.guide === "object" ? q.guide : {};
        const routing = q.routing && typeof q.routing === "object" ? q.routing : {};
        const assets = q.assets && typeof q.assets === "object" ? q.assets : {};
        const routingContext = q.routingContext && typeof q.routingContext === "object" ? q.routingContext : {};

        const leadCandidate = {
            insuranceLine: guide.category || routingContext.selectedLine || "general",
            metadata: {
                ...q,
                guide,
                assets,
                routing,
                routingContext: {
                    ...routingContext,
                    selectedLine: routingContext.selectedLine || guide.category || "",
                    entryType: routingContext.entryType || "",
                    sourceChannel: routingContext.sourceChannel || q.sourceChannel || "",
                    bundleRequested: Boolean(routingContext.bundleRequested || (Array.isArray(assets.bundleSelections) && assets.bundleSelections.length > 1)),
                    bundleLines: Array.isArray(routingContext.bundleLines)
                        ? routingContext.bundleLines
                        : (Array.isArray(assets.bundleSelections) ? assets.bundleSelections : [])
                }
            }
        };

        const classification = deriveLeadClassification(leadCandidate);
        return toLeadRowShape({
            id: q.id || `local-${index + 1}`,
            created_at: q.submittedAt || q.created_at || new Date().toISOString(),
            submission_date: q.submittedAt || q.submission_date || new Date().toISOString(),
            client_name: routing.fullName || q.client_name || q.clientName || "",
            email: routing.email || q.email || "",
            phone: routing.phone || q.phone || "",
            insurance_line: classification.primaryLine,
            risk_details: q.riskDetails || "Coverage Plan Review Request (Local Queue)",
            status: normalizeStatusValue(q.status || "New"),
            intake_route: q.intakeRoute || "coverage-guide-intake-v3",
            source_page: q.page || q.sourcePage || "/quote",
            metadata: {
                ...leadCandidate.metadata,
                routingContext: {
                    ...leadCandidate.metadata.routingContext,
                    lineBucket: classification.primaryLine,
                    bundleRequested: classification.bundleRequested,
                    bundleLines: classification.bundleLines,
                    priorityTier: classification.bundleRequested ? "high-bundle" : "standard"
                }
            }
        });
    };

    const enqueueLocalLead = (payload, errorMessage) => {
        const queued = readLocalLeadQueue();
        const localId = `local-${queued.length + 1}`;
        queued.unshift({
            id: localId,
            created_at: payload.submission_date,
            submittedAt: payload.submission_date,
            status: payload.status || "New",
            sourcePage: payload.source_page,
            intakeRoute: payload.intake_route,
            clientName: payload.client_name,
            email: payload.email,
            phone: payload.phone,
            riskDetails: payload.risk_details,
            metadata: payload.metadata,
            routingContext: payload.metadata && payload.metadata.routingContext ? payload.metadata.routingContext : {},
            guide: payload.metadata && payload.metadata.guide ? payload.metadata.guide : {},
            assets: payload.metadata && payload.metadata.assets ? payload.metadata.assets : {},
            saveError: String(errorMessage || "")
        });
        writeLocalLeadQueue(queued.slice(0, 500));
        return toLeadRowShape({
            id: localId,
            created_at: payload.submission_date,
            ...payload
        });
    };

    const cacheSubmittedLead = (rowLike) => {
        const row = toLeadRowShape(rowLike);
        if (!row) return;
        const cache = readLocalSubmittedLeads();
        const next = [row, ...cache.filter((existing) => String(existing && existing.id || "") !== String(row.id || ""))]
            .slice(0, 500);
        writeLocalSubmittedLeads(next);
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
        const normalizedStatus = String(status || "").trim().toLowerCase();
        const showAllStatuses = !normalizedStatus || normalizedStatus === "all" || normalizedStatus.includes("all");
        const normalizedQuery = String(query || "").trim().toLowerCase();

        let dbRows = [];
        if (client) {
            const selectMatrix = [
                "id, created_at, submission_date, client_name, email, phone, insurance_line, risk_details, status, intake_route, source_page, metadata",
                "id, created_at, submission_date, client_name, email, phone, insurance_line, risk_details, status, intake_route, metadata",
                "id, created_at, submission_date, client_name, email, phone, insurance_line, risk_details, status, intake_route",
                "id, created_at, submission_date, client_name, email, phone, insurance_line, risk_details, status"
            ];

            let lastError = null;
            for (const selectClause of selectMatrix) {
                let request = client
                    .from("leads")
                    .select(selectClause)
                    .order("submission_date", { ascending: false })
                    .limit(250);

                if (!showAllStatuses) {
                    request = request.eq("status", normalizeStatusValue(status));
                }

                if (normalizedQuery) {
                    request = request.or(`client_name.ilike.%${normalizedQuery}%,email.ilike.%${normalizedQuery}%,phone.ilike.%${normalizedQuery}%,insurance_line.ilike.%${normalizedQuery}%`);
                }

                const { data, error } = await request;
                if (error) {
                    lastError = error;
                    continue;
                }

                dbRows = Array.isArray(data) ? data.map(toLeadRowShape).filter(Boolean) : [];
                lastError = null;
                break;
            }

            if (lastError) {
                throw mapTableError(lastError, "public.leads");
            }
        }

        const queued = readLocalLeadQueue();
        const localRows = queued
            .map((row, index) => normalizeQueueLeadToRow(row, index))
            .filter(Boolean)
            .filter((row) => {
                if (!showAllStatuses) {
                    return String(row.status || "").toLowerCase() === String(normalizeStatusValue(status) || "").toLowerCase();
                }
                return true;
            })
            .filter((row) => {
                if (!normalizedQuery) {
                    return true;
                }
                const haystack = [row.client_name, row.email, row.phone, row.insurance_line].join(" ").toLowerCase();
                return haystack.includes(normalizedQuery);
            });

        const submittedCacheRows = readLocalSubmittedLeads()
            .map((row) => toLeadRowShape(row))
            .filter(Boolean)
            .filter((row) => {
                if (!showAllStatuses) {
                    return String(row.status || "").toLowerCase() === String(normalizeStatusValue(status) || "").toLowerCase();
                }
                return true;
            })
            .filter((row) => {
                if (!normalizedQuery) {
                    return true;
                }
                const haystack = [row.client_name, row.email, row.phone, row.insurance_line].join(" ").toLowerCase();
                return haystack.includes(normalizedQuery);
            });

        const merged = dedupeLeadRows([...localRows, ...submittedCacheRows, ...dbRows])
            .sort((a, b) => {
                const aDate = new Date(a.submission_date || a.created_at || 0).getTime();
                const bDate = new Date(b.submission_date || b.created_at || 0).getTime();
                return bDate - aDate;
            })
            .slice(0, 250);

        return merged;
    };

    const updateLeadStatus = async (leadId, status) => {
        const normalizedStatus = normalizeStatusValue(status);
        const leadIdString = String(leadId || "");
        if (leadIdString.startsWith("local-")) {
            const queue = readLocalLeadQueue();
            const idxById = queue.findIndex((row) => String(row && row.id || "") === leadIdString);
            const index = idxById >= 0 ? idxById : (Number(leadIdString.split("local-")[1]) - 1);
            if (index >= 0 && index < queue.length) {
                queue[index] = { ...(queue[index] || {}), id: leadIdString, status: normalizedStatus };
                writeLocalLeadQueue(queue);
            }
            return;
        }

        if (!client) {
            throw new Error("Supabase is not configured.");
        }

        const { error } = await client
            .from("leads")
            .update({ status: normalizedStatus })
            .eq("id", Number(leadId));

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
        const classification = deriveLeadClassification(lead || {});
        const baseMetadata = lead && typeof lead.metadata === "object" ? lead.metadata : {};
        const existingRoutingContext = baseMetadata.routingContext && typeof baseMetadata.routingContext === "object"
            ? baseMetadata.routingContext
            : {};

        const enrichedMetadata = {
            ...baseMetadata,
            routingContext: {
                ...existingRoutingContext,
                sourceChannel: classification.sourceChannel,
                entryType: classification.entryType,
                selectedLine: classification.selectedLine,
                lineBucket: classification.primaryLine,
                bundleRequested: classification.bundleRequested,
                bundleLines: classification.bundleLines,
                priorityTier: classification.bundleRequested ? "high-bundle" : "standard"
            }
        };

        const payload = {
            submission_date: new Date().toISOString(),
            client_name: String(lead.clientName || "").trim(),
            email: String(lead.email || "").trim(),
            phone: String(lead.phone || "").trim(),
            insurance_line: classification.primaryLine,
            risk_details: String(lead.riskDetails || "").trim(),
            status: "New",
            intake_route: String(lead.intakeRoute || "general").trim(),
            source_page: String(lead.sourcePage || window.location.pathname || "contact"),
            metadata: enrichedMetadata
        };

        // Always attempt direct CRM post — fires regardless of Supabase config.
        await postToCrm(lead, payload);

        if (!client) {
            return enqueueLocalLead(payload, "Supabase is not configured.");
        }

        const { error } = await client
            .from("leads")
            .insert(payload);

        if (error) {
            // Keep lead visibility in admin even when DB policies are misconfigured.
            return enqueueLocalLead(payload, error.message || String(error));
        }

        const runtimeSettings = await getRuntimeSettings();
        const webhookPayload = {
            event: "new_lead",
            lead: {
                submission_date: payload.submission_date,
                client_name: payload.client_name,
                email: payload.email,
                phone: payload.phone,
                insurance_line: payload.insurance_line,
                risk_details: payload.risk_details,
                status: payload.status,
                intake_route: payload.intake_route,
                source_page: payload.source_page,
                metadata: payload.metadata
            }
        };

        await Promise.all([
            postWebhook(runtimeSettings.crmWebhookUrl, webhookPayload),
            postWebhook(runtimeSettings.notificationWebhookUrl, webhookPayload)
        ]);

        const createdRow = toLeadRowShape({
            id: `submitted-${Date.now()}`,
            created_at: payload.submission_date,
            ...payload
        });
        cacheSubmittedLead(createdRow);
        return createdRow;
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
