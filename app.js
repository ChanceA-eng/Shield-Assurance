const SHIELD_STORAGE_KEYS = {
    siteContent: "shield-site-content",
    analytics: "shield-site-analytics",
    visitorDate: "shield-last-visitor-date",
    visitorGeo: "shield-visitor-geo"
};

const SHIELD_DEFAULT_CONTENT = {
    company: {
        officePhone: "(800) 555-0199",
        officePhoneLink: "+18005550199",
        supportEmail: "hello@shieldassurancellc.com",
        azLicense: "Add in Admin",
        mailingAddress: "Add in Admin",
        linkedinUrl: "#",
        facebookUrl: "#",
        instagramUrl: "#",
        googleBusinessUrl: "#",
        twitterUrl: "#"
    },
    agents: [
        {
            id: "leadership",
            name: "Agency Leadership",
            roleLabel: "Team Member",
            title: "Shield Assurance LLC",
            bio: "Shield Assurance LLC was founded with a straightforward mission: eliminate corporate red tape and provide Arizona families and business owners with transparent, responsive risk guidance.",
            image: ""
        }
    ]
};

const SHIELD_DEFAULT_ANALYTICS = {
    pageViewsByDay: {},
    uniqueVisitorsByDay: {},
    pageViewsByPath: {},
    quoteClicksByLabel: {},
    insuranceLineClicks: {},
    formStartsById: {},
    formSubmissionsById: {},
    pageTimeSecondsByPath: {},
    geographyByRegion: {},
    incompleteForms: [],
    geoIpLookupsByDay: {},
    lastUpdated: ""
};

const SHIELD_DEFAULT_ANALYTICS_CONFIG = {
    posthogApiKey: "",
    posthogApiHost: "https://us.i.posthog.com",
    clarityProjectId: "x2wyyrdpna"
};

const getAnalyticsConfig = () => {
    const raw = window.SHIELD_ANALYTICS_CONFIG;
    if (!raw || typeof raw !== "object") {
        return { ...SHIELD_DEFAULT_ANALYTICS_CONFIG };
    }

    return {
        ...SHIELD_DEFAULT_ANALYTICS_CONFIG,
        ...raw
    };
};

const createInitials = (name) => {
    const parts = String(name || "Shield Assurance")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);

    return (parts[0]?.[0] || "S") + (parts[1]?.[0] || "A");
};

const createPlaceholderImage = (name) => {
    const initials = createInitials(name);
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="${initials}">
            <defs>
                <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stop-color="#0b1323" />
                    <stop offset="100%" stop-color="#0ea5e9" />
                </linearGradient>
            </defs>
            <rect width="320" height="320" rx="32" fill="url(#g)" />
            <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Sora, Arial, sans-serif" font-size="112" font-weight="700" fill="#ffffff">${initials}</text>
        </svg>`;

    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
};

const safeParse = (value, fallback) => {
    if (!value) {
        return fallback;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const escapeHtml = (value) => {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
};

const normalizeContent = (value) => {
    const merged = deepClone(SHIELD_DEFAULT_CONTENT);
    const company = value && typeof value === "object" ? value.company : null;
    const agents = value && typeof value === "object" ? value.agents : null;

    if (company && typeof company === "object") {
        merged.company = {
            ...merged.company,
            ...company
        };
    }

    if (Array.isArray(agents) && agents.length > 0) {
        merged.agents = agents
            .map((agent, index) => ({
                id: String(agent.id || `agent-${index + 1}`),
                name: String(agent.name || "New Agent").trim(),
                roleLabel: String(agent.roleLabel || "Team Member").trim(),
                title: String(agent.title || "Insurance Advisor").trim(),
                bio: String(agent.bio || "").trim(),
                image: String(agent.image || "").trim()
            }))
            .filter((agent) => agent.name);
    }

    if (!Array.isArray(merged.agents) || merged.agents.length === 0) {
        merged.agents = deepClone(SHIELD_DEFAULT_CONTENT.agents);
    }

    return merged;
};

const loadSiteContent = () => {
    const stored = safeParse(localStorage.getItem(SHIELD_STORAGE_KEYS.siteContent), null);
    return normalizeContent(stored);
};

const saveSiteContent = (content) => {
    const normalized = normalizeContent(content);
    localStorage.setItem(SHIELD_STORAGE_KEYS.siteContent, JSON.stringify(normalized));
    document.dispatchEvent(new CustomEvent("shield:content-updated", { detail: normalized }));
    return normalized;
};

const loadAnalytics = () => {
    const stored = safeParse(localStorage.getItem(SHIELD_STORAGE_KEYS.analytics), null);
    if (!stored || typeof stored !== "object") {
        return deepClone(SHIELD_DEFAULT_ANALYTICS);
    }

    return {
        ...deepClone(SHIELD_DEFAULT_ANALYTICS),
        ...stored,
        pageViewsByDay: { ...SHIELD_DEFAULT_ANALYTICS.pageViewsByDay, ...stored.pageViewsByDay },
        uniqueVisitorsByDay: { ...SHIELD_DEFAULT_ANALYTICS.uniqueVisitorsByDay, ...stored.uniqueVisitorsByDay },
        pageViewsByPath: { ...SHIELD_DEFAULT_ANALYTICS.pageViewsByPath, ...stored.pageViewsByPath },
        quoteClicksByLabel: { ...SHIELD_DEFAULT_ANALYTICS.quoteClicksByLabel, ...stored.quoteClicksByLabel },
        insuranceLineClicks: { ...SHIELD_DEFAULT_ANALYTICS.insuranceLineClicks, ...stored.insuranceLineClicks },
        formStartsById: { ...SHIELD_DEFAULT_ANALYTICS.formStartsById, ...stored.formStartsById },
        formSubmissionsById: { ...SHIELD_DEFAULT_ANALYTICS.formSubmissionsById, ...stored.formSubmissionsById },
        pageTimeSecondsByPath: { ...SHIELD_DEFAULT_ANALYTICS.pageTimeSecondsByPath, ...stored.pageTimeSecondsByPath },
        geographyByRegion: { ...SHIELD_DEFAULT_ANALYTICS.geographyByRegion, ...stored.geographyByRegion },
        incompleteForms: Array.isArray(stored.incompleteForms) ? stored.incompleteForms.slice(0, 50) : []
    };
};

const saveAnalytics = (analytics) => {
    const nextAnalytics = {
        ...deepClone(SHIELD_DEFAULT_ANALYTICS),
        ...analytics,
        lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(SHIELD_STORAGE_KEYS.analytics, JSON.stringify(nextAnalytics));
    document.dispatchEvent(new CustomEvent("shield:analytics-updated", { detail: nextAnalytics }));
    return nextAnalytics;
};

const resetAnalytics = () => {
    localStorage.removeItem(SHIELD_STORAGE_KEYS.analytics);
    document.dispatchEvent(new CustomEvent("shield:analytics-updated", { detail: deepClone(SHIELD_DEFAULT_ANALYTICS) }));
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const incrementBucket = (bucket, key) => {
    bucket[key] = (Number(bucket[key]) || 0) + 1;
};

const addBucketValue = (bucket, key, value) => {
    bucket[key] = (Number(bucket[key]) || 0) + Number(value || 0);
};

const normalizeInsuranceLine = (value) => {
    const normalized = String(value || "general").trim().toLowerCase();
    if (["auto", "fleet", "auto-fleet", "auto_fleet"].includes(normalized)) {
        return "auto-fleet";
    }
    if (["home", "property", "home-property", "homeowners", "personal"].includes(normalized)) {
        return "property";
    }
    if (["commercial", "business", "commercial-property"].includes(normalized)) {
        return "commercial";
    }
    return normalized || "general";
};

const normalizeArizonaZip = (value) => {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 5);
    return digits;
};

const deriveArizonaRegion = (zip) => {
    const numeric = Number.parseInt(normalizeArizonaZip(zip), 10);
    if (!numeric) {
        return "Unknown";
    }
    if (numeric >= 85600 && numeric <= 85799) {
        return "Tucson Metro";
    }
    if (numeric >= 85000 && numeric <= 85399) {
        return "Phoenix Metro";
    }
    if ((numeric >= 85000 && numeric <= 86599) || (numeric >= 88900 && numeric <= 88999)) {
        return "Arizona Statewide";
    }
    return "Outside Arizona";
};

const normalizeUsStateCode = (value) => String(value || "").trim().toUpperCase();

const normalizeGeoLabel = (payload) => {
    const city = String(payload.city || payload.city_name || "").trim();
    const state = normalizeUsStateCode(payload.region_code || payload.region || payload.state || payload.regionCode || "");
    const country = String(payload.country_code || payload.country || "").trim().toUpperCase();
    const zip = normalizeArizonaZip(payload.postal || payload.zip || payload.postal_code || "");

    if (state === "AZ" && zip) {
        return deriveArizonaRegion(zip);
    }

    if (state === "AZ" && city) {
        const normalizedCity = city.toLowerCase();
        if (normalizedCity.includes("tucson")) {
            return "Tucson Metro";
        }
        if (normalizedCity.includes("phoenix") || normalizedCity.includes("mesa") || normalizedCity.includes("scottsdale")) {
            return "Phoenix Metro";
        }
        return "Arizona Statewide";
    }

    if (city && state) {
        return `${city}, ${state}`;
    }

    if (state && country === "US") {
        return state;
    }

    if (country) {
        return country;
    }

    return "Unknown";
};

const createGeoCachePayload = (label, source) => ({
    label,
    source,
    date: todayKey()
});

const loadCachedGeo = () => {
    const cached = safeParse(localStorage.getItem(SHIELD_STORAGE_KEYS.visitorGeo), null);
    if (!cached || typeof cached !== "object") {
        return null;
    }

    if (cached.date !== todayKey()) {
        return null;
    }

    if (!cached.label) {
        return null;
    }

    return cached;
};

const saveCachedGeo = (payload) => {
    localStorage.setItem(SHIELD_STORAGE_KEYS.visitorGeo, JSON.stringify(payload));
};

const fetchGeoPayload = async (url, transform) => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
        throw new Error("Geo service request failed.");
    }
    const data = await response.json();
    return transform(data);
};

const resolveVisitorRegionByIp = async () => {
    const firstProvider = async () => {
        return fetchGeoPayload("https://ipapi.co/json/", (data) => ({
            city: data.city,
            region_code: data.region_code,
            country_code: data.country_code,
            postal: data.postal
        }));
    };

    const secondProvider = async () => {
        return fetchGeoPayload("https://ipwho.is/", (data) => {
            if (data && data.success === false) {
                throw new Error("IP fallback provider failed.");
            }
            return {
                city: data.city,
                region_code: data.region_code,
                country_code: data.country_code,
                postal: data.postal
            };
        });
    };

    try {
        const payload = await firstProvider();
        return {
            label: normalizeGeoLabel(payload),
            source: "ipapi"
        };
    } catch (firstError) {
        const payload = await secondProvider();
        return {
            label: normalizeGeoLabel(payload),
            source: "ipwhois"
        };
    }
};

const upsertIncompleteForm = (entry) => {
    const analytics = loadAnalytics();
    const record = {
        id: String(entry.id || `partial-${Date.now()}`),
        createdAt: entry.createdAt || new Date().toISOString(),
        path: String(entry.path || window.location.pathname || "/"),
        formId: String(entry.formId || "consultation-form"),
        zipCode: normalizeArizonaZip(entry.zipCode),
        region: entry.region || deriveArizonaRegion(entry.zipCode),
        coverageType: normalizeInsuranceLine(entry.coverageType),
        fullName: String(entry.fullName || "").trim(),
        email: String(entry.email || "").trim(),
        phone: String(entry.phone || "").trim(),
        lastField: String(entry.lastField || "").trim(),
        completionPercent: Number(entry.completionPercent || 0),
        intakeRoute: normalizeInsuranceLine(entry.intakeRoute),
        status: "abandoned"
    };

    analytics.incompleteForms = [record, ...analytics.incompleteForms.filter((row) => row.id !== record.id)].slice(0, 50);
    if (record.region && record.region !== "Unknown") {
        incrementBucket(analytics.geographyByRegion, record.region);
    }
    saveAnalytics(analytics);
};

const markFormCompleted = (formId) => {
    const analytics = loadAnalytics();
    analytics.incompleteForms = analytics.incompleteForms.filter((row) => row.formId !== formId && row.id !== formId);
    incrementBucket(analytics.formSubmissionsById, formId || "consultation-form");
    saveAnalytics(analytics);
};

const trackAnalyticsEvent = (type, detail) => {
    const analytics = loadAnalytics();
    const dateKey = todayKey();

    if (type === "page_view") {
        incrementBucket(analytics.pageViewsByDay, dateKey);
        incrementBucket(analytics.pageViewsByPath, detail || window.location.pathname || "unknown");
    }

    if (type === "unique_visit") {
        incrementBucket(analytics.uniqueVisitorsByDay, dateKey);
    }

    if (type === "quote_click") {
        incrementBucket(analytics.quoteClicksByLabel, detail || "General Quote CTA");
    }

    if (type === "line_click") {
        incrementBucket(analytics.insuranceLineClicks, normalizeInsuranceLine(detail || "general"));
    }

    if (type === "form_start") {
        incrementBucket(analytics.formStartsById, detail || "consultation-form");
    }

    if (type === "form_submit") {
        incrementBucket(analytics.formSubmissionsById, detail || "consultation-form");
    }

    if (type === "time_on_page") {
        const payload = detail && typeof detail === "object" ? detail : {};
        addBucketValue(analytics.pageTimeSecondsByPath, payload.path || window.location.pathname || "/", payload.seconds || 0);
    }

    if (type === "geo_region") {
        incrementBucket(analytics.geographyByRegion, detail || "Unknown");
    }

    if (type === "geo_ip_lookup") {
        incrementBucket(analytics.geoIpLookupsByDay, dateKey);
    }

    saveAnalytics(analytics);
    captureExternalAnalyticsEvent(type, detail);
};

const initializeThirdPartyAnalytics = async () => {
    if (document.body.getAttribute("data-skip-analytics") === "true") {
        return;
    }

    if (window.__shieldThirdPartyInitialized) {
        return;
    }

    window.__shieldThirdPartyInitialized = true;
    const config = getAnalyticsConfig();
    const posthogApiKey = String(config.posthogApiKey || "").trim();
    if (!posthogApiKey) {
        return;
    }

    const loadPosthog = () => {
        return new Promise((resolve, reject) => {
            if (window.posthog && typeof window.posthog.init === "function") {
                resolve(window.posthog);
                return;
            }

            if (!window.posthog || !Array.isArray(window.posthog)) {
                const posthogQueue = [];
                window.posthog = posthogQueue;
                posthogQueue._i = [];
                posthogQueue.__SV = 1;
                posthogQueue.init = function (token, options, name) {
                    const target = name ? (window.posthog[name] = []) : posthogQueue;
                    target.people = target.people || [];

                    const methods = [
                        "capture",
                        "identify",
                        "alias",
                        "register",
                        "unregister",
                        "set_config",
                        "reset",
                        "group",
                        "setPersonProperties"
                    ];

                    const createMethod = (collection, methodName) => {
                        collection[methodName] = function () {
                            collection.push([methodName].concat(Array.prototype.slice.call(arguments, 0)));
                        };
                    };

                    methods.forEach((methodName) => createMethod(target, methodName));
                    posthogQueue._i.push([token, options, name]);
                };
            }

            const existing = document.getElementById("shield-posthog-array-script");
            if (existing) {
                existing.addEventListener("load", () => resolve(window.posthog));
                existing.addEventListener("error", () => reject(new Error("PostHog script failed to load.")));
                return;
            }

            const script = document.createElement("script");
            script.id = "shield-posthog-array-script";
            script.async = true;
            script.src = "https://us.i.posthog.com/static/array.js";
            script.onload = () => resolve(window.posthog);
            script.onerror = () => reject(new Error("PostHog script failed to load."));
            document.head.appendChild(script);
        });
    };

    try {
        const posthog = await loadPosthog();
        if (!posthog || typeof posthog.init !== "function") {
            return;
        }

        if (!window.__shieldPosthogInitialized) {
            posthog.init(posthogApiKey, {
                api_host: String(config.posthogApiHost || SHIELD_DEFAULT_ANALYTICS_CONFIG.posthogApiHost),
                capture_pageview: false,
                autocapture: true,
                persistence: "localStorage+cookie",
                loaded: (instance) => {
                    instance.register({
                        app: "shieldassurance-site"
                    });
                }
            });
            window.__shieldPosthogInitialized = true;
        }
    } catch (error) {
        console.warn("PostHog initialization skipped.", error);
    }
};

const captureExternalAnalyticsEvent = (type, detail) => {
    if (document.body.getAttribute("data-skip-analytics") === "true") {
        return;
    }

    if (!window.posthog || typeof window.posthog.capture !== "function") {
        return;
    }

    const eventNameMap = {
        page_view: "shield_page_view",
        unique_visit: "shield_unique_visit",
        quote_click: "shield_quote_click",
        line_click: "shield_line_click",
        form_start: "shield_form_start",
        form_submit: "shield_form_submit",
        time_on_page: "shield_time_on_page",
        geo_region: "shield_geo_region",
        geo_ip_lookup: "shield_geo_ip_lookup"
    };

    const eventName = eventNameMap[type] || `shield_${String(type || "event")}`;
    try {
        window.posthog.capture(eventName, {
            path: window.location.pathname || "/",
            detail: detail || ""
        });
    } catch (error) {
        console.warn("PostHog capture failed.", error);
    }
};

const initializeIpGeoAnalytics = async () => {
    if (document.body.getAttribute("data-skip-analytics") === "true") {
        return;
    }

    const cached = loadCachedGeo();
    if (cached) {
        trackAnalyticsEvent("geo_region", cached.label);
        return;
    }

    try {
        const resolved = await resolveVisitorRegionByIp();
        if (!resolved || !resolved.label || resolved.label === "Unknown") {
            return;
        }

        saveCachedGeo(createGeoCachePayload(resolved.label, resolved.source));
        trackAnalyticsEvent("geo_region", resolved.label);
        trackAnalyticsEvent("geo_ip_lookup");
    } catch (error) {
        console.warn("IP geo lookup failed.", error);
    }
};

const initializeAdminAccess = () => {
    const isHome = window.location.pathname === "/" || /\/index\.html$/i.test(window.location.pathname);
    if (!isHome || document.body.getAttribute("data-skip-analytics") === "true") {
        return;
    }

    const adminChip = document.createElement("a");
    adminChip.href = "/admin/";
    adminChip.rel = "nofollow";
    adminChip.setAttribute("aria-label", "Admin access");
    adminChip.textContent = "Open admin";
    adminChip.className = "fixed bottom-6 right-6 z-[80] hidden rounded-full border border-slate-700 bg-slate-950/95 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-2xl backdrop-blur";
    document.body.appendChild(adminChip);

    let revealTimer = null;
    document.addEventListener("keydown", (event) => {
        if (!(event.ctrlKey && event.shiftKey && String(event.key).toLowerCase() === "a")) {
            return;
        }

        event.preventDefault();
        adminChip.classList.remove("hidden");
        window.clearTimeout(revealTimer);
        revealTimer = window.setTimeout(() => {
            adminChip.classList.add("hidden");
        }, 8000);
    });
};

const initializeFormAnalytics = () => {
    if (document.body.getAttribute("data-skip-analytics") === "true") {
        return;
    }

    document.querySelectorAll("form").forEach((form, formIndex) => {
        const fields = Array.from(form.querySelectorAll("input, select, textarea")).filter((field) => {
            if (!(field instanceof HTMLElement)) {
                return false;
            }
            return field.getAttribute("type") !== "hidden" && field.getAttribute("name") !== "bot-field";
        });

        if (fields.length === 0) {
            return;
        }

        const formId = form.id || form.getAttribute("name") || `form-${formIndex + 1}`;
        let started = false;
        let submitted = false;
        let lastField = "";

        const snapshot = () => {
            const byName = (selector) => form.querySelector(selector);
            const getValue = (selector) => {
                const field = byName(selector);
                return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement
                    ? String(field.value || "").trim()
                    : "";
            };
            const completed = fields.filter((field) => {
                const value = "value" in field ? String(field.value || "").trim() : "";
                return Boolean(value);
            }).length;
            const percent = fields.length > 0 ? Math.round((completed / fields.length) * 100) : 0;
            const coverageValue = getValue("#coverage-type") || getValue("[name='coverage_type']") || getValue("#intake-route") || "general";
            const zipValue = getValue("#zip-code") || getValue("[name='zip_code']") || getValue("#zip-input") || "";

            return {
                id: formId,
                formId,
                path: window.location.pathname || "/",
                createdAt: new Date().toISOString(),
                fullName: getValue("#full-name") || getValue("[name='full_name']"),
                email: getValue("#email") || getValue("[name='email']"),
                phone: getValue("#phone") || getValue("[name='phone']"),
                zipCode: zipValue,
                region: deriveArizonaRegion(zipValue),
                coverageType: coverageValue,
                intakeRoute: getValue("#intake-route") || coverageValue,
                lastField,
                completionPercent: percent
            };
        };

        fields.forEach((field) => {
            field.addEventListener("focus", () => {
                if (!started) {
                    started = true;
                    trackAnalyticsEvent("form_start", formId);
                }
                lastField = field.getAttribute("name") || field.id || "field";
            });

            field.addEventListener("input", () => {
                if (!started) {
                    started = true;
                    trackAnalyticsEvent("form_start", formId);
                }
                lastField = field.getAttribute("name") || field.id || "field";
            });

        });

        form.addEventListener("submit", () => {
            const data = snapshot();
            submitted = true;
            if (data.zipCode) {
                trackAnalyticsEvent("geo_region", data.region);
            }
            trackAnalyticsEvent("form_submit", formId);
            markFormCompleted(formId);
        });

        window.addEventListener("beforeunload", () => {
            if (!started || submitted) {
                return;
            }
            const data = snapshot();
            if (!data.zipCode && !data.email && !data.phone && !data.fullName) {
                return;
            }
            upsertIncompleteForm(data);
        });
    });
};

const applyText = (selector, value) => {
    document.querySelectorAll(selector).forEach((node) => {
        node.textContent = value;
    });
};

const applyLink = (selector, href, textValue) => {
    document.querySelectorAll(selector).forEach((node) => {
        if (!(node instanceof HTMLAnchorElement)) {
            return;
        }

        node.href = href;
        if (textValue) {
            node.textContent = textValue;
        }
    });
};

const toggleLinkVisibility = (selector, href) => {
    document.querySelectorAll(selector).forEach((node) => {
        if (!(node instanceof HTMLAnchorElement)) {
            return;
        }

        const shouldHide = !href || href === "#";
        node.href = href || "#";
        node.classList.toggle("hidden", shouldHide);
    });
};

const renderAgentProfiles = (agents) => {
    const container = document.querySelector("[data-agent-grid]");
    if (!container) {
        return;
    }

    const list = Array.isArray(agents) && agents.length > 0 ? agents : SHIELD_DEFAULT_CONTENT.agents;

    container.innerHTML = list
        .map((agent) => {
            const name = String(agent.name || "Insurance Advisor").trim();
            const roleLabel = String(agent.roleLabel || "Team Member").trim();
            const title = String(agent.title || agent.agentTitle || "Shield Assurance LLC").trim();
            const bio = String(agent.bio || "Trusted guidance rooted in accountability and responsive service.").trim();
            const image = /^data:image\//.test(agent.image) || /^https?:\/\//.test(agent.image)
                ? agent.image
                : createPlaceholderImage(name);
            const safeName = escapeHtml(name);
            const safeRoleLabel = escapeHtml(roleLabel);
            const safeTitle = escapeHtml(title);
            const safeBio = escapeHtml(bio);

            return `
                <article class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div class="flex flex-col gap-5 md:flex-row md:items-start">
                        <img src="${image}" alt="${safeName}" class="h-40 w-40 rounded-2xl object-cover border border-slate-200 bg-slate-100" loading="lazy">
                        <div class="space-y-3">
                            <div>
                                <p class="text-xs font-bold uppercase tracking-[0.25em] text-sky-600">${safeRoleLabel}</p>
                                <h3 class="display-font mt-2 text-2xl font-bold text-slate-900">${safeName}</h3>
                                <p class="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">${safeTitle}</p>
                            </div>
                            <p class="text-sm leading-relaxed text-slate-600">${safeBio}</p>
                        </div>
                    </div>
                </article>`;
        })
        .join("");
};

const applySiteContent = () => {
    const content = loadSiteContent();
    const { company, agents } = content;
    const phoneLink = `tel:${company.officePhoneLink}`;
    const emailLink = `mailto:${company.supportEmail}`;

    applyText("[data-site-phone-text]", company.officePhone);
    applyText("[data-site-email-text]", company.supportEmail);
    applyText("[data-site-az-license]", company.azLicense);
    applyText("[data-site-mailing-address]", company.mailingAddress);
    applyLink("[data-site-phone-link]", phoneLink);
    applyLink("[data-site-email-link]", emailLink);
    toggleLinkVisibility("[data-site-linkedin-url]", company.linkedinUrl);
    toggleLinkVisibility("[data-site-facebook-url]", company.facebookUrl);
    toggleLinkVisibility("[data-site-twitter-url]", company.twitterUrl);

    document.querySelectorAll("footer p").forEach((paragraph) => {
        const text = String(paragraph.textContent || "").trim();
        if (/^Arizona Property and Casualty License:/i.test(text) && !paragraph.querySelector("[data-site-az-license]")) {
            paragraph.innerHTML = `Arizona Property and Casualty License: <span class="text-slate-400" data-site-az-license>${escapeHtml(company.azLicense)}</span>`;
        }

        if (text.includes("(mailing only)") && !paragraph.querySelector("[data-site-mailing-address]")) {
            paragraph.textContent = `${company.mailingAddress} (mailing only)`;
        }
    });

    document.querySelectorAll("[data-site-phone-link]").forEach((node) => {
        if (!(node instanceof HTMLAnchorElement)) {
            return;
        }

        if (node.querySelector("[data-site-phone-text]")) {
            return;
        }

        const plainText = String(node.textContent || "").trim();
        if (!plainText || /^call\s+/i.test(plainText)) {
            return;
        }

        node.textContent = company.officePhone;
    });

    document.querySelectorAll("[data-site-email-link]").forEach((node) => {
        if (!(node instanceof HTMLAnchorElement)) {
            return;
        }

        if (node.querySelector("[data-site-email-text]")) {
            return;
        }

        node.textContent = company.supportEmail;
    });

    renderAgentProfiles(agents);
};

const syncSiteContentFromBackend = async () => {
    const backend = window.ShieldBackend;
    if (!backend || !backend.isConfigured || typeof backend.getSiteContent !== "function") {
        return;
    }

    try {
        const payload = await backend.getSiteContent();
        if (!payload) {
            return;
        }

        saveSiteContent(payload);
        applySiteContent();
    } catch (error) {
        console.warn("Could not sync site content from backend.", error);
    }
};

const initializeAnalytics = () => {
    if (document.body.getAttribute("data-skip-analytics") === "true") {
        return;
    }

    trackAnalyticsEvent("page_view", window.location.pathname || "index.html");

    if (localStorage.getItem(SHIELD_STORAGE_KEYS.visitorDate) !== todayKey()) {
        localStorage.setItem(SHIELD_STORAGE_KEYS.visitorDate, todayKey());
        trackAnalyticsEvent("unique_visit");
    }

    document.querySelectorAll("[data-analytics-quote]").forEach((node) => {
        node.addEventListener("click", () => {
            trackAnalyticsEvent("quote_click", node.getAttribute("data-analytics-quote") || node.textContent.trim());
        });
    });

    document.querySelectorAll("[data-intake-route]").forEach((node) => {
        node.addEventListener("click", () => {
            trackAnalyticsEvent("line_click", node.getAttribute("data-intake-route") || "general");
        });
    });
};

window.ShieldSite = {
    loadSiteContent,
    saveSiteContent,
    loadAnalytics,
    saveAnalytics,
    resetAnalytics,
    createPlaceholderImage,
    trackAnalyticsEvent
};

document.addEventListener("DOMContentLoaded", () => {
    void initializeThirdPartyAnalytics();
    applySiteContent();
    void syncSiteContentFromBackend();
    initializeAnalytics();
    initializeFormAnalytics();
    initializeAdminAccess();
    void initializeIpGeoAnalytics();

    const pageStartedAt = Date.now();
    let pageTimeRecorded = false;
    const persistPageTime = () => {
        if (pageTimeRecorded || document.body.getAttribute("data-skip-analytics") === "true") {
            return;
        }
        pageTimeRecorded = true;
        const seconds = Math.max(1, Math.round((Date.now() - pageStartedAt) / 1000));
        trackAnalyticsEvent("time_on_page", {
            path: window.location.pathname || "/",
            seconds
        });
    };

    window.addEventListener("pagehide", persistPageTime, { once: true });

    if (window.lucide) {
        window.lucide.createIcons();
    }

    const yearTargets = document.querySelectorAll("[data-current-year]");
    yearTargets.forEach((node) => {
        node.textContent = String(new Date().getFullYear());
    });

    const header = document.getElementById("site-header");
    const menuToggle = document.getElementById("mobile-menu-toggle");
    const mobileMenu = document.getElementById("mobile-menu");

    const closeMenu = () => {
        if (!mobileMenu || !menuToggle) {
            return;
        }

        mobileMenu.classList.add("hidden");
        menuToggle.setAttribute("aria-expanded", "false");
    };

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener("click", () => {
            const opening = mobileMenu.classList.contains("hidden");
            mobileMenu.classList.toggle("hidden", !opening);
            menuToggle.setAttribute("aria-expanded", String(opening));
        });

        mobileMenu.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeMenu);
        });

        document.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }

            if (!mobileMenu.contains(target) && !menuToggle.contains(target)) {
                closeMenu();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeMenu();
            }
        });
    }

    const onScroll = () => {
        if (!header) {
            return;
        }

        if (window.scrollY > 12) {
            header.classList.add("shadow-sm");
        } else {
            header.classList.remove("shadow-sm");
        }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const revealItems = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && revealItems.length > 0) {
        const observer = new IntersectionObserver(
            (entries, obs) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }

                    entry.target.classList.add("visible");
                    obs.unobserve(entry.target);
                });
            },
            { threshold: 0.12 }
        );

        revealItems.forEach((item) => observer.observe(item));
    } else {
        revealItems.forEach((item) => item.classList.add("visible"));
    }
});
