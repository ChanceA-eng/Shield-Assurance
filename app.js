const SHIELD_STORAGE_KEYS = {
    siteContent: "shield-site-content",
    analytics: "shield-site-analytics",
    visitorDate: "shield-last-visitor-date"
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
    lastUpdated: ""
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
        insuranceLineClicks: { ...SHIELD_DEFAULT_ANALYTICS.insuranceLineClicks, ...stored.insuranceLineClicks }
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
        incrementBucket(analytics.insuranceLineClicks, detail || "general");
    }

    saveAnalytics(analytics);
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
            const title = String(agent.title || agent.agentTitle || "Shield Assurance LLC").trim();
            const bio = String(agent.bio || "Trusted guidance rooted in accountability and responsive service.").trim();
            const image = /^data:image\//.test(agent.image) || /^https?:\/\//.test(agent.image)
                ? agent.image
                : createPlaceholderImage(name);
            const safeName = escapeHtml(name);
            const safeTitle = escapeHtml(title);
            const safeBio = escapeHtml(bio);

            return `
                <article class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div class="flex flex-col gap-5 md:flex-row md:items-start">
                        <img src="${image}" alt="${safeName}" class="h-40 w-40 rounded-2xl object-cover border border-slate-200 bg-slate-100" loading="lazy">
                        <div class="space-y-3">
                            <div>
                                <p class="text-xs font-bold uppercase tracking-[0.25em] text-sky-600">Team Members</p>
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
    applyLink("[data-site-phone-link]", phoneLink);
    applyLink("[data-site-email-link]", emailLink);
    toggleLinkVisibility("[data-site-linkedin-url]", company.linkedinUrl);
    toggleLinkVisibility("[data-site-facebook-url]", company.facebookUrl);
    toggleLinkVisibility("[data-site-twitter-url]", company.twitterUrl);
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
    applySiteContent();
    void syncSiteContentFromBackend();
    initializeAnalytics();

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
