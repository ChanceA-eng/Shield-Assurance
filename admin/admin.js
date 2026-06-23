document.addEventListener("DOMContentLoaded", () => {
    const backend = window.ShieldBackend;
    const siteApi = window.ShieldSite;

    const view = {
        backendMissing: document.getElementById("backend-missing"),
        loginPanel: document.getElementById("admin-login-panel"),
        shell: document.getElementById("admin-shell")
    };

    const loginForm = document.getElementById("admin-login-form");
    const loginStatus = document.getElementById("admin-login-status");
    const logoutButton = document.getElementById("admin-logout");
    const analyticsResetButton = document.getElementById("analytics-reset");

    const companyForm = document.getElementById("company-settings-form");
    const companyStatus = document.getElementById("company-settings-status");

    const agentForm = document.getElementById("agent-form");
    const agentStatus = document.getElementById("agent-form-status");
    const agentList = document.getElementById("agent-list");
    const agentResetButton = document.getElementById("agent-form-reset");
    const headshotDropzone = document.getElementById("headshot-dropzone");
    const headshotInput = document.getElementById("agent-image");
    const headshotPreview = document.getElementById("agent-image-preview");
    const headshotLabel = document.getElementById("agent-image-label");
    const headshotPreviewWrap = document.getElementById("headshot-preview-wrap");
    const removeHeadshotButton = document.getElementById("agent-remove-image");
    const cropImageButton = document.getElementById("agent-crop-image");
    const cropModal = document.getElementById("crop-modal");
    const cropCanvas = document.getElementById("crop-canvas");
    const cropStyleFit = document.getElementById("crop-style-fit");
    const cropStyleBorder = document.getElementById("crop-style-border");
    const cropZoom = document.getElementById("crop-zoom");
    const cropPanX = document.getElementById("crop-pan-x");
    const cropPanY = document.getElementById("crop-pan-y");
    const cropApply = document.getElementById("crop-apply");
    const cropCancel = document.getElementById("crop-cancel");
    const cropClose = document.getElementById("crop-close");

    const leadSearch = document.getElementById("lead-search");
    const leadStatusFilter = document.getElementById("lead-status-filter");
    const leadExportButton = document.getElementById("export-leads");
    const leadsBody = document.getElementById("leads-table-body");
    const leadsStatus = document.getElementById("leads-status");

    const integrationForm = document.getElementById("integration-form");
    const carrierForm = document.getElementById("carrier-form");
    const integrationStatus = document.getElementById("integration-status");

    const adminPanelButtons = Array.from(document.querySelectorAll("[data-admin-panel-target]"));
    const adminPanels = Array.from(document.querySelectorAll("[data-admin-panel]"));

    const analyticsTargets = {
        unique: document.getElementById("analytics-unique-visitors"),
        views: document.getElementById("analytics-page-views"),
        conversion: document.getElementById("analytics-conversion-rate"),
        avgTime: document.getElementById("analytics-average-time"),
        formStarts: document.getElementById("analytics-form-starts"),
        formSubmissions: document.getElementById("analytics-form-submissions"),
        formAbandons: document.getElementById("analytics-form-abandons"),
        formAbandonments: document.getElementById("analytics-form-abandonments"),
        autoPrimary: document.getElementById("analytics-auto-fleet-clicks"),
        propertyPrimary: document.getElementById("analytics-property-clicks"),
        commercialPrimary: document.getElementById("analytics-commercial-clicks"),
        autoSecondary: document.getElementById("analytics-auto-fleet-clicks-secondary"),
        propertySecondary: document.getElementById("analytics-property-clicks-secondary"),
        commercialSecondary: document.getElementById("analytics-commercial-clicks-secondary"),
        incompleteBody: document.getElementById("analytics-incomplete-body"),
        geoPrimary: document.getElementById("analytics-geo-breakdown"),
        geoSecondary: document.getElementById("analytics-geo-breakdown-secondary"),
        pathBody: document.getElementById("analytics-path-body")
    };

    const state = {
        content: siteApi ? siteApi.loadSiteContent() : null,
        leads: [],
        imageDataUrl: ""
    };

    const cropState = {
        sourceDataUrl: "",
        image: null,
        fileLabel: "",
        mode: "fit",
        zoom: 1,
        panX: 50,
        panY: 50,
        renderFrame: null,
        cropBox: null,
        drag: null
    };

    const escapeHtml = (value) => {
        return String(value || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    };

    const setStatus = (node, message, tone) => {
        if (!node) {
            return;
        }

        node.className = "rounded-2xl px-4 py-3 text-sm";
        node.classList.remove("hidden");
        if (tone === "ok") {
            node.classList.add("bg-emerald-50", "text-emerald-700");
        } else {
            node.classList.add("bg-rose-50", "text-rose-700");
        }
        node.textContent = message;
    };

    const setView = (mode) => {
        if (!view.backendMissing || !view.loginPanel || !view.shell) {
            return;
        }

        view.backendMissing.classList.toggle("hidden", mode !== "missing");
        view.loginPanel.classList.toggle("hidden", mode !== "login");
        view.shell.classList.toggle("hidden", mode !== "shell");
    };

    const setActiveAdminPanel = (panelName) => {
        if (adminPanels.length === 0 || adminPanelButtons.length === 0) {
            return;
        }

        adminPanels.forEach((panel) => {
            const next = panel.getAttribute("data-admin-panel") === panelName;
            panel.classList.toggle("hidden", !next);
        });

        adminPanelButtons.forEach((button) => {
            const next = button.getAttribute("data-admin-panel-target") === panelName;
            button.classList.toggle("bg-shieldNavy", next);
            button.classList.toggle("text-white", next);
            button.classList.toggle("border", !next);
            button.classList.toggle("border-slate-300", !next);
            button.classList.toggle("text-slate-700", !next);
            button.classList.toggle("hover:bg-slate-50", !next);
        });
    };

    const readAsDataUrl = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("Image could not be processed."));
            reader.readAsDataURL(file);
        });
    };

    const updateHeadshotPreview = (image, label) => {
        if (!headshotPreview || !headshotLabel) {
            return;
        }

        if (image) {
            headshotPreview.src = image;
            headshotPreview.classList.remove("hidden");
            headshotLabel.textContent = label || "Custom headshot ready.";
        } else {
            headshotPreview.src = "";
            headshotPreview.classList.add("hidden");
            headshotLabel.textContent = "No custom headshot selected.";
        }
    };

    const normalizePhoneLink = (phone) => {
        const digits = String(phone || "").replace(/[^\d+]/g, "");
        if (!digits) {
            return "+18005550199";
        }

        if (digits.startsWith("+")) {
            return digits;
        }

        if (digits.length === 10) {
            return `+1${digits}`;
        }

        return `+${digits}`;
    };

    const hydrateCompanyForm = () => {
        if (!state.content || !companyForm) {
            return;
        }

        companyForm.officePhone.value = state.content.company.officePhone || "";
        companyForm.supportEmail.value = state.content.company.supportEmail || "";
        companyForm.azLicense.value = state.content.company.azLicense || "";
        companyForm.mailingAddress.value = state.content.company.mailingAddress || "";
        companyForm.linkedinUrl.value = state.content.company.linkedinUrl === "#" ? "" : state.content.company.linkedinUrl || "";
        companyForm.facebookUrl.value = state.content.company.facebookUrl === "#" ? "" : state.content.company.facebookUrl || "";
        companyForm.instagramUrl.value = state.content.company.instagramUrl === "#" ? "" : state.content.company.instagramUrl || "";
        companyForm.googleBusinessUrl.value = state.content.company.googleBusinessUrl === "#" ? "" : state.content.company.googleBusinessUrl || "";
        companyForm.twitterUrl.value = state.content.company.twitterUrl === "#" ? "" : state.content.company.twitterUrl || "";
    };

    const hideCropModal = () => {
        if (!cropModal) {
            return;
        }

        cropModal.classList.add("hidden");
        cropModal.classList.remove("flex");
    };

    const showCropModal = () => {
        if (!cropModal) {
            return;
        }

        cropModal.classList.remove("hidden");
        cropModal.classList.add("flex");
    };

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const getCropHandles = (box) => {
        return {
            nw: { x: box.x, y: box.y },
            ne: { x: box.x + box.w, y: box.y },
            se: { x: box.x + box.w, y: box.y + box.h },
            sw: { x: box.x, y: box.y + box.h }
        };
    };

    const ensureCropBox = () => {
        if (!(cropCanvas instanceof HTMLCanvasElement)) {
            return;
        }

        if (!cropState.cropBox) {
            const margin = Math.round(cropCanvas.width * 0.15);
            const size = cropCanvas.width - margin * 2;
            cropState.cropBox = {
                x: margin,
                y: margin,
                w: size,
                h: size
            };
        }
    };

    const drawCropPreview = () => {
        if (!(cropCanvas instanceof HTMLCanvasElement) || !cropState.image) {
            return;
        }

        const ctx = cropCanvas.getContext("2d");
        if (!ctx) {
            return;
        }

        const targetW = cropCanvas.width;
        const targetH = cropCanvas.height;
        const imgW = cropState.image.naturalWidth;
        const imgH = cropState.image.naturalHeight;

        ctx.clearRect(0, 0, targetW, targetH);
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, targetW, targetH);

        if (!imgW || !imgH) {
            return;
        }

        const baseScale = Math.max(targetW / imgW, targetH / imgH);
        const scale = baseScale * cropState.zoom;
        const drawW = imgW * scale;
        const drawH = imgH * scale;

        const maxX = Math.max(0, (drawW - targetW) / 2);
        const maxY = Math.max(0, (drawH - targetH) / 2);
        const shiftX = ((cropState.panX - 50) / 50) * maxX;
        const shiftY = ((cropState.panY - 50) / 50) * maxY;

        const x = (targetW - drawW) / 2 - shiftX;
        const y = (targetH - drawH) / 2 - shiftY;
        ctx.drawImage(cropState.image, x, y, drawW, drawH);

        cropState.renderFrame = {
            x,
            y,
            w: drawW,
            h: drawH,
            scale
        };

        if (cropState.mode === "border") {
            ensureCropBox();
            if (!cropState.cropBox) {
                return;
            }

            const box = cropState.cropBox;
            ctx.save();
            ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.clearRect(box.x, box.y, box.w, box.h);

            ctx.strokeStyle = "#0ea5e9";
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.w, box.h);

            const handles = Object.values(getCropHandles(box));
            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = "#0ea5e9";
            ctx.lineWidth = 2;
            handles.forEach((handle) => {
                const size = 10;
                ctx.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
                ctx.strokeRect(handle.x - size / 2, handle.y - size / 2, size, size);
            });

            ctx.restore();
        }
    };

    const getCanvasPoint = (event) => {
        if (!(cropCanvas instanceof HTMLCanvasElement)) {
            return null;
        }

        const rect = cropCanvas.getBoundingClientRect();
        if (!rect.width || !rect.height) {
            return null;
        }

        const scaleX = cropCanvas.width / rect.width;
        const scaleY = cropCanvas.height / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
    };

    const getHitRegion = (point) => {
        if (!cropState.cropBox) {
            return null;
        }

        const box = cropState.cropBox;
        const handles = getCropHandles(box);
        const radius = 14;

        const handleMatch = Object.entries(handles).find(([, h]) => {
            const dx = point.x - h.x;
            const dy = point.y - h.y;
            return Math.hypot(dx, dy) <= radius;
        });
        if (handleMatch) {
            return { type: "handle", handle: handleMatch[0] };
        }

        if (point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h) {
            return { type: "move" };
        }

        return null;
    };

    const loadCropImage = (dataUrl, label) => {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                cropState.image = image;
                cropState.sourceDataUrl = dataUrl;
                cropState.fileLabel = label || "Headshot";
                cropState.mode = "fit";
                cropState.zoom = 1;
                cropState.panX = 50;
                cropState.panY = 50;
                cropState.cropBox = null;
                cropState.drag = null;

                if (cropZoom) {
                    cropZoom.value = "1";
                }
                if (cropPanX) {
                    cropPanX.value = "50";
                }
                if (cropPanY) {
                    cropPanY.value = "50";
                }
                if (cropStyleFit instanceof HTMLInputElement) {
                    cropStyleFit.checked = true;
                }
                if (cropStyleBorder instanceof HTMLInputElement) {
                    cropStyleBorder.checked = false;
                }

                drawCropPreview();
                showCropModal();
                resolve();
            };
            image.onerror = () => reject(new Error("Image could not be loaded for cropping."));
            image.src = dataUrl;
        });
    };

    const processHeadshotFile = async (file) => {
        if (!file) {
            return;
        }

        const dataUrl = await readAsDataUrl(file);
        await loadCropImage(dataUrl, file.name);
    };

    const clearAgentForm = () => {
        if (!agentForm) {
            return;
        }

        agentForm.reset();
        const idInput = agentForm.querySelector("#agent-id");
        if (idInput) {
            idInput.value = "";
        }
        state.imageDataUrl = "";
        updateHeadshotPreview("", "");
    };

    const renderAgents = () => {
        const agents = state.content && Array.isArray(state.content.agents) ? state.content.agents : [];
        if (!agentList) {
            return;
        }

        if (agents.length === 0) {
            agentList.innerHTML = "<p class=\"rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500\">No published agents yet.</p>";
            return;
        }

        agentList.innerHTML = agents
            .map((agent) => {
                const image = agent.image || siteApi.createPlaceholderImage(agent.name);
                const roleLabel = agent.roleLabel || "Team Member";
                const isLeadership = String(agent.id || "") === "leadership";
                return `
                    <article class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
                        <div class="flex gap-3">
                            <img src="${image}" alt="${escapeHtml(agent.name)}" class="h-16 w-16 rounded-xl border border-slate-200 object-cover">
                            <div>
                                <p class="font-bold text-slate-900">${escapeHtml(agent.name)}</p>
                                <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-600">${escapeHtml(roleLabel)}</p>
                                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">${escapeHtml(agent.title)}</p>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button type="button" data-agent-edit="${escapeHtml(agent.id)}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                            ${isLeadership ? "" : `<button type=\"button\" data-agent-remove=\"${escapeHtml(agent.id)}\" class=\"rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50\">Remove</button>`}
                        </div>
                    </article>`;
            })
            .join("");
    };

    const sumBucket = (bucket) => Object.values(bucket || {}).reduce((total, count) => total + Number(count || 0), 0);

    const aggregateBucket = (bucket, keys) => keys.reduce((total, key) => total + Number((bucket && bucket[key]) || 0), 0);

    const formatDuration = (seconds) => {
        const total = Number(seconds || 0);
        if (total < 60) {
            return `${total}s`;
        }

        const minutes = Math.floor(total / 60);
        const remainder = total % 60;
        if (remainder === 0) {
            return `${minutes}m`;
        }
        return `${minutes}m ${remainder}s`;
    };

    const formatLineLabel = (line) => {
        const normalized = String(line || "").trim().toLowerCase();
        if (normalized === "auto-fleet") return "Auto / Fleet";
        if (normalized === "property") return "Property";
        if (normalized === "commercial") return "Commercial";
        if (normalized === "personal") return "Personal";
        if (!normalized) return "General";
        return normalized.replace(/[-_]/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
    };

    const getLeadRoutingContext = (lead) => {
        const metadata = lead && typeof lead.metadata === "object" ? lead.metadata : {};
        const routing = metadata.routingContext && typeof metadata.routingContext === "object" ? metadata.routingContext : {};
        return {
            sourceChannel: String(routing.sourceChannel || "").trim(),
            bundleRequested: Boolean(routing.bundleRequested),
            bundleLines: Array.isArray(routing.bundleLines) ? routing.bundleLines : []
        };
    };

    const countLeadLines = (leads) => {
        const counts = { auto: 0, property: 0, commercial: 0 };
        (Array.isArray(leads) ? leads : []).forEach((lead) => {
            const line = String((lead && lead.insurance_line) || "").trim().toLowerCase();
            if (line === "auto-fleet" || line.includes("auto") || line.includes("fleet")) {
                counts.auto += 1;
                return;
            }
            if (line === "property" || line.includes("property") || line.includes("home")) {
                counts.property += 1;
                return;
            }
            if (line === "commercial" || line.includes("commercial") || line.includes("business")) {
                counts.commercial += 1;
            }
        });
        return counts;
    };

    const applyLeadFlowCounters = (autoCount, propertyCount, commercialCount) => {
        if (analyticsTargets.autoPrimary) analyticsTargets.autoPrimary.textContent = String(autoCount);
        if (analyticsTargets.propertyPrimary) analyticsTargets.propertyPrimary.textContent = String(propertyCount);
        if (analyticsTargets.commercialPrimary) analyticsTargets.commercialPrimary.textContent = String(commercialCount);
        if (analyticsTargets.autoSecondary) analyticsTargets.autoSecondary.textContent = String(autoCount);
        if (analyticsTargets.propertySecondary) analyticsTargets.propertySecondary.textContent = String(propertyCount);
        if (analyticsTargets.commercialSecondary) analyticsTargets.commercialSecondary.textContent = String(commercialCount);
    };

    const renderGeoBreakdown = (node, bucket) => {
        if (!node) {
            return;
        }

        const entries = Object.entries(bucket || {}).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));
        if (entries.length === 0) {
            node.innerHTML = "<p class=\"text-sm text-slate-500\">No geographic data captured yet.</p>";
            return;
        }

        const max = Math.max(...entries.map(([, value]) => Number(value || 0)), 1);
        node.innerHTML = entries
            .map(([label, value]) => {
                const width = Math.max(12, Math.round((Number(value || 0) / max) * 100));
                return `
                    <div class="space-y-2">
                        <div class="flex items-center justify-between text-sm font-semibold text-slate-700">
                            <span>${escapeHtml(label)}</span>
                            <span>${Number(value || 0)}</span>
                        </div>
                        <div class="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div class="h-full rounded-full bg-shieldBlue" style="width:${width}%"></div>
                        </div>
                    </div>`;
            })
            .join("");
    };

    const renderIncompleteForms = (rows) => {
        if (!analyticsTargets.incompleteBody) {
            return;
        }

        if (!Array.isArray(rows) || rows.length === 0) {
            analyticsTargets.incompleteBody.innerHTML = "<tr><td colspan=\"6\" class=\"px-4 py-5 text-sm text-slate-500\">No incomplete forms captured yet.</td></tr>";
            return;
        }

        analyticsTargets.incompleteBody.innerHTML = rows
            .slice(0, 25)
            .map((row) => {
                const prospect = [row.fullName, row.email, row.phone].filter(Boolean).join(" / ") || "Anonymous visitor";
                const lineLabel = formatLineLabel(row.coverageType || row.intakeRoute || "general");
                const bundleFlag = row.bundleRequested ? "<span class=\"mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800\">Bundle Lead</span>" : "";
                const source = row.sourceChannel ? `<span class=\"mt-1 block text-xs text-slate-500\">Source: ${escapeHtml(row.sourceChannel)}</span>` : "";
                return `
                    <tr>
                        <td class="px-4 py-3 align-top text-slate-700">${escapeHtml(formatDate(row.createdAt))}</td>
                        <td class="px-4 py-3 align-top text-slate-700">${escapeHtml(row.region || "Unknown")} ${row.zipCode ? `<span class="block text-xs text-slate-500">${escapeHtml(row.zipCode)}</span>` : ""}</td>
                        <td class="px-4 py-3 align-top text-slate-700">${escapeHtml(prospect)}</td>
                        <td class="px-4 py-3 align-top text-slate-700">${escapeHtml(lineLabel)}${bundleFlag}${source}</td>
                        <td class="px-4 py-3 align-top text-slate-700">${Number(row.completionPercent || 0)}%</td>
                        <td class="px-4 py-3 align-top text-slate-700">${escapeHtml(row.lastField || "-")}</td>
                    </tr>`;
            })
            .join("");
    };

    const renderPathPerformance = (viewsBucket, durationBucket) => {
        if (!analyticsTargets.pathBody) {
            return;
        }

        const entries = Object.entries(viewsBucket || {})
            .map(([path, count]) => ({
                path,
                views: Number(count || 0),
                seconds: Number((durationBucket && durationBucket[path]) || 0)
            }))
            .sort((a, b) => b.views - a.views);

        if (entries.length === 0) {
            analyticsTargets.pathBody.innerHTML = "<tr><td colspan=\"3\" class=\"px-4 py-5 text-sm text-slate-500\">No path performance data captured yet.</td></tr>";
            return;
        }

        analyticsTargets.pathBody.innerHTML = entries
            .slice(0, 10)
            .map((entry) => `
                <tr>
                    <td class="px-4 py-3 align-top font-semibold text-slate-900">${escapeHtml(entry.path)}</td>
                    <td class="px-4 py-3 align-top text-slate-700">${entry.views}</td>
                    <td class="px-4 py-3 align-top text-slate-700">${escapeHtml(formatDuration(entry.seconds))}</td>
                </tr>`)
            .join("");
    };

    const renderAnalytics = () => {
        if (!siteApi) {
            return;
        }

        const analytics = siteApi.loadAnalytics();
        const unique = sumBucket(analytics.uniqueVisitorsByDay);
        const views = sumBucket(analytics.pageViewsByDay);
        const quoteClicks = sumBucket(analytics.quoteClicksByLabel);
        const totalTime = sumBucket(analytics.pageTimeSecondsByPath);
        const avgTime = views > 0 ? Math.round(totalTime / views) : 0;
        const formStarts = sumBucket(analytics.formStartsById);
        const formSubmissions = sumBucket(analytics.formSubmissionsById);
        const activeAbandons = Array.isArray(analytics.incompleteForms) ? analytics.incompleteForms.length : 0;
        const autoClicks = aggregateBucket(analytics.insuranceLineClicks, ["auto", "fleet", "auto-fleet", "auto_fleet"]);
        const propertyClicks = aggregateBucket(analytics.insuranceLineClicks, ["property", "home", "home-property", "homeowners", "personal"]);
        const commercialClicks = aggregateBucket(analytics.insuranceLineClicks, ["commercial", "business", "commercial-property"]);
        const conversion = unique > 0 ? ((quoteClicks / unique) * 100).toFixed(1) : "0.0";

        if (analyticsTargets.unique) analyticsTargets.unique.textContent = String(unique);
        if (analyticsTargets.views) analyticsTargets.views.textContent = String(views);
        if (analyticsTargets.conversion) analyticsTargets.conversion.textContent = `${conversion}%`;
        if (analyticsTargets.avgTime) analyticsTargets.avgTime.textContent = formatDuration(avgTime);
        if (analyticsTargets.formStarts) analyticsTargets.formStarts.textContent = String(formStarts);
        if (analyticsTargets.formSubmissions) analyticsTargets.formSubmissions.textContent = String(formSubmissions);
        if (analyticsTargets.formAbandons) analyticsTargets.formAbandons.textContent = String(activeAbandons);
        if (analyticsTargets.formAbandonments) analyticsTargets.formAbandonments.textContent = String(activeAbandons);
        // Lead-flow cards should reflect submitted leads first; fallback to click analytics when empty.
        const leadCounts = countLeadLines(state.leads);
        const hasLeadCounts = (leadCounts.auto + leadCounts.property + leadCounts.commercial) > 0;
        applyLeadFlowCounters(
            hasLeadCounts ? leadCounts.auto : autoClicks,
            hasLeadCounts ? leadCounts.property : propertyClicks,
            hasLeadCounts ? leadCounts.commercial : commercialClicks
        );

        renderIncompleteForms(Array.isArray(analytics.incompleteForms) ? analytics.incompleteForms : []);
        renderGeoBreakdown(analyticsTargets.geoPrimary, analytics.geographyByRegion);
        renderGeoBreakdown(analyticsTargets.geoSecondary, analytics.geographyByRegion);
        renderPathPerformance(analytics.pageViewsByPath, analytics.pageTimeSecondsByPath);
    };

    const hydrateIntegrationForm = async () => {
        if (!backend || !integrationForm) {
            return;
        }

        const settings = await backend.getIntegrationSettings();
        const byId = (id) => document.getElementById(id);

        byId("crm-webhook-url").value = settings.crmWebhookUrl || "";
        byId("crm-api-key").value = settings.crmApiKey || "";
        byId("notification-webhook-url").value = settings.notificationWebhookUrl || "";
        byId("pipeline-webhook-url").value = settings.pipelineWebhookUrl || "";
        byId("carrier-business").value = settings.carrierUrlBusiness || "";
        byId("carrier-home").value = settings.carrierUrlHome || "";
        byId("carrier-auto").value = settings.carrierUrlAuto || "";
    };

    const formatDate = (iso) => {
        const value = new Date(iso);
        if (Number.isNaN(value.getTime())) {
            return "-";
        }

        return value.toLocaleString();
    };

    const normalizeStatusFilterValue = (value) => {
        const raw = String(value || "").trim();
        const lowered = raw.toLowerCase();
        if (!raw || lowered === "all" || lowered.includes("all")) {
            return "All";
        }
        if (lowered === "new") return "New";
        if (lowered === "in progress" || lowered === "in_progress" || lowered === "inprogress") return "In Progress";
        if (lowered === "quoted") return "Quoted";
        return raw;
    };

    const cleanRiskText = (value) => {
        const raw = String(value || "").trim();
        if (!raw) {
            return "-";
        }

        const compact = raw.replace(/\s+/g, " ").trim();
        if (compact.length <= 220) {
            return compact;
        }

        return `${compact.slice(0, 217)}...`;
    };

    const normalizeBundleLabel = (value) => {
        const raw = String(value || "").trim().toLowerCase();
        if (!raw) {
            return "";
        }
        if (raw.includes("auto") || raw.includes("fleet") || raw.includes("vehicle")) return "Auto";
        if (raw.includes("home") || raw.includes("property")) return "Property";
        if (raw.includes("business") || raw.includes("commercial")) return "Business";
        return raw.replace(/[-_]/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
    };

    const extractLeadMetadata = (lead) => {
        const metadata = lead && typeof lead.metadata === "object" ? lead.metadata : {};
        return {
            guide: metadata.guide && typeof metadata.guide === "object" ? metadata.guide : {},
            assets: metadata.assets && typeof metadata.assets === "object" ? metadata.assets : {},
            routing: metadata.routing && typeof metadata.routing === "object" ? metadata.routing : {},
            routingContext: metadata.routingContext && typeof metadata.routingContext === "object" ? metadata.routingContext : {}
        };
    };

    const extractRiskSegment = (source, label) => {
        const pattern = new RegExp(`${label}:\\s*(.+?)(?=\\s+(?:Auto|Home|Business|Bundle|Full Name|AZ ZIP|Phone|Email|Primary Category|Primary Label|Tier|Summary):|$)`, "is");
        const match = String(source || "").match(pattern);
        return match ? String(match[1] || "").trim() : "";
    };

    const parseJsonSegment = (value) => {
        const raw = String(value || "").trim();
        if (!raw || !raw.startsWith("{")) {
            return null;
        }

        try {
            return JSON.parse(raw);
        } catch (_) {
            return null;
        }
    };

    const formatAutoRiskLine = (autoData) => {
        if (!autoData || typeof autoData !== "object") {
            return "";
        }

        const year = String(autoData.year || "").trim();
        const make = String(autoData.make || "").trim();
        const model = String(autoData.model || "").trim();
        const vin = String(autoData.vin || "").trim();
        const descriptor = [year, make, model].filter(Boolean).join(" ");
        const mode = String(autoData.mode || "").trim().toLowerCase();

        if (descriptor) {
            if (mode === "manual") {
                return `Auto: ${descriptor} (Manual Entry)`;
            }
            return `Auto: ${descriptor}`;
        }

        if (vin) {
            return `Auto: VIN ${vin}`;
        }

        return "";
    };

    const formatHomeRiskLine = (homeData) => {
        if (!homeData || typeof homeData !== "object") {
            return "";
        }

        const address = String(homeData.address || "").trim();
        return address ? `Home: ${address}` : "";
    };

    const formatBusinessRiskLine = (businessData) => {
        if (!businessData || typeof businessData !== "object") {
            return "";
        }

        const industry = String(businessData.industry || "").trim();
        return industry ? `Business: ${industry}` : "";
    };

    const extractZipCode = (lead) => {
        const { routing } = extractLeadMetadata(lead);
        const fromMetadata = String(routing.zipCode || routing.zip || "").trim();
        if (fromMetadata) {
            return fromMetadata;
        }

        const raw = String(lead && lead.risk_details || "");
        const match = raw.match(/AZ ZIP:\s*([^\n]+)/i);
        return match ? String(match[1] || "").trim() : "";
    };

    const extractTierLabel = (lead) => {
        const { guide } = extractLeadMetadata(lead);
        const fromMetadata = String(guide.tier || "").trim();
        if (fromMetadata) {
            return fromMetadata;
        }

        const raw = String(lead && lead.risk_details || "");
        const match = raw.match(/Tier:\s*([^\n]+)/i);
        return match ? String(match[1] || "").trim() : "Standard";
    };

    const extractBundleLabels = (lead) => {
        const { assets, routingContext } = extractLeadMetadata(lead);
        const fromMetadata = [];
        if (Array.isArray(routingContext.bundleLines)) {
            fromMetadata.push(...routingContext.bundleLines);
        }
        if (Array.isArray(assets.bundleSelections)) {
            fromMetadata.push(...assets.bundleSelections);
        }

        let rawValues = fromMetadata;
        if (rawValues.length === 0) {
            const raw = String(lead && lead.risk_details || "");
            const bundleValue = extractRiskSegment(raw, "Bundle");
            rawValues = bundleValue ? bundleValue.split(",") : [];
        }

        const deduped = Array.from(new Set(rawValues.map((value) => normalizeBundleLabel(value)).filter(Boolean)));
        return deduped;
    };

    const extractAssetData = (lead) => {
        const { assets } = extractLeadMetadata(lead);
        const raw = String(lead && lead.risk_details || "").trim();

        return {
            auto: (assets.auto && typeof assets.auto === "object") ? assets.auto : parseJsonSegment(extractRiskSegment(raw, "Auto")),
            home: (assets.home && typeof assets.home === "object") ? assets.home : parseJsonSegment(extractRiskSegment(raw, "Home")),
            business: (assets.business && typeof assets.business === "object") ? assets.business : parseJsonSegment(extractRiskSegment(raw, "Business"))
        };
    };

    const formatBundleRequestLine = (lead) => {
        const labels = extractBundleLabels(lead);
        if (labels.length < 2) {
            return "";
        }
        return `Bundle Request: ${labels.join(" + ")}`;
    };

    const renderCellLines = (lines, emptyLabel = "-") => {
        const filtered = (Array.isArray(lines) ? lines : []).filter((line) => String(line || "").trim());
        if (filtered.length === 0) {
            return `<div class="text-slate-400">${escapeHtml(emptyLabel)}</div>`;
        }

        return filtered.map((line, index) => {
            const className = index === 0 ? "" : "mt-1";
            return className
                ? `<div class="${className}">${escapeHtml(line)}</div>`
                : `<div>${escapeHtml(line)}</div>`;
        }).join("");
    };

    const formatAssetColumnHtml = (lead, type) => {
        const assetData = extractAssetData(lead);
        const bundleLine = formatBundleRequestLine(lead);
        let assetLine = "";

        if (type === "auto") {
            assetLine = formatAutoRiskLine(assetData.auto);
        } else if (type === "home") {
            assetLine = formatHomeRiskLine(assetData.home);
        } else if (type === "business") {
            assetLine = formatBusinessRiskLine(assetData.business);
        }

        return renderCellLines([assetLine, assetLine && bundleLine ? bundleLine : ""]);
    };

    const formatRiskDetailsHtml = (lead) => {
        const tierLine = `Tier: ${extractTierLabel(lead) || "Standard"}`;
        const bundleLine = formatBundleRequestLine(lead);
        return renderCellLines([tierLine, bundleLine]);
    };

    const normalizeLeadForDisplay = (lead) => {
        if (!lead || typeof lead !== "object") {
            return null;
        }

        return {
            ...lead,
            client_name: String(lead.client_name || "").trim(),
            email: String(lead.email || "").trim().toLowerCase(),
            phone: String(lead.phone || "").trim(),
            insurance_line: String(lead.insurance_line || "general").trim().toLowerCase(),
            risk_details: String(lead.risk_details || "").trim(),
            status: normalizeStatusFilterValue(lead.status || "New")
        };
    };

    const isLikelySameLead = (a, b) => {
        if (!a || !b) {
            return false;
        }

        if (String(a.id || "") && String(a.id || "") === String(b.id || "")) {
            return true;
        }

        const identityA = `${String(a.email || "").toLowerCase()}|${String(a.phone || "").replace(/\D/g, "")}|${String(a.insurance_line || "").toLowerCase()}`;
        const identityB = `${String(b.email || "").toLowerCase()}|${String(b.phone || "").replace(/\D/g, "")}|${String(b.insurance_line || "").toLowerCase()}`;
        if (!identityA || identityA === "||") {
            return false;
        }
        if (identityA !== identityB) {
            return false;
        }

        const timeA = new Date(a.submission_date || a.created_at || 0).getTime();
        const timeB = new Date(b.submission_date || b.created_at || 0).getTime();
        if (!Number.isFinite(timeA) || !Number.isFinite(timeB)) {
            return false;
        }

        return Math.abs(timeA - timeB) <= (1000 * 60 * 10);
    };

    const dedupeLeadsForDisplay = (rows) => {
        const normalized = (Array.isArray(rows) ? rows : [])
            .map((lead) => normalizeLeadForDisplay(lead))
            .filter(Boolean)
            .sort((a, b) => {
                const aDate = new Date(a.submission_date || a.created_at || 0).getTime();
                const bDate = new Date(b.submission_date || b.created_at || 0).getTime();
                return bDate - aDate;
            });

        const result = [];
        normalized.forEach((lead) => {
            const existingIndex = result.findIndex((candidate) => isLikelySameLead(candidate, lead));
            if (existingIndex < 0) {
                result.push(lead);
                return;
            }

            const existing = result[existingIndex];
            const existingScore = [existing.client_name, existing.email, existing.phone, existing.risk_details].filter(Boolean).length;
            const incomingScore = [lead.client_name, lead.email, lead.phone, lead.risk_details].filter(Boolean).length;
            if (incomingScore >= existingScore) {
                result[existingIndex] = lead;
            }
        });

        return result;
    };

    const renderLeads = () => {
        if (!leadsBody) {
            return;
        }

        if (state.leads.length === 0) {
            leadsBody.innerHTML = "<tr><td class=\"px-4 py-5 text-sm text-slate-500\" colspan=\"10\">No leads found for the selected filters.</td></tr>";
            return;
        }

        leadsBody.innerHTML = state.leads
            .map((lead) => {
                const routing = getLeadRoutingContext(lead);
                const lineLabel = formatLineLabel(lead.insurance_line);
                const source = routing.sourceChannel
                    ? `<span class="mt-1 block text-xs text-slate-500">Source: ${escapeHtml(routing.sourceChannel)}</span>`
                    : "";
                const zipCode = extractZipCode(lead);
                return `
                    <tr>
                        <td class="px-4 py-3 align-top text-slate-700">${escapeHtml(formatDate(lead.submission_date || lead.created_at))}</td>
                        <td class="px-4 py-3 align-top font-semibold text-slate-900">${escapeHtml(lead.client_name)}</td>
                        <td class="px-4 py-3 align-top">
                            <div class="text-slate-700">${escapeHtml(lead.phone)}</div>
                            <div class="text-slate-500">${escapeHtml(lead.email)}</div>
                            ${zipCode ? `<div class="text-slate-500">${escapeHtml(`AZ ZIP: ${zipCode}`)}</div>` : ""}
                        </td>
                        <td class="px-4 py-3 align-top text-slate-700">${escapeHtml(lineLabel)}${source}</td>
                        <td class="px-4 py-3 align-top text-sm leading-6 text-slate-700 max-w-xs">${formatAssetColumnHtml(lead, "auto")}</td>
                        <td class="px-4 py-3 align-top text-sm leading-6 text-slate-700 max-w-xs">${formatAssetColumnHtml(lead, "home")}</td>
                        <td class="px-4 py-3 align-top text-sm leading-6 text-slate-700 max-w-xs">${formatAssetColumnHtml(lead, "business")}</td>
                        <td class="px-4 py-3 align-top text-sm leading-6 text-slate-700 max-w-xs">${formatRiskDetailsHtml(lead)}</td>
                        <td class="px-4 py-3 align-top">
                            <select data-lead-status="${lead.id}" class="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold">
                                <option value="New" ${lead.status === "New" ? "selected" : ""}>New</option>
                                <option value="In Progress" ${lead.status === "In Progress" ? "selected" : ""}>In Progress</option>
                                <option value="Quoted" ${lead.status === "Quoted" ? "selected" : ""}>Quoted</option>
                            </select>
                        </td>
                        <td class="px-4 py-3 align-top">
                            <div class="flex flex-wrap gap-2">
                                <button type="button" data-lead-export="${lead.id}" class="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Export</button>
                                <button type="button" data-lead-pipeline="${lead.id}" class="rounded-lg border border-sky-300 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50">Push to Pipeline</button>
                                <button type="button" data-lead-route="${lead.id}" class="rounded-lg border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50">Carrier Routing</button>
                            </div>
                        </td>
                    </tr>`;
            })
            .join("");
    };

    const loadLeads = async () => {
        if (!backend || !leadSearch || !leadStatusFilter) {
            return;
        }

        try {
            const query = leadSearch.value;
            const status = normalizeStatusFilterValue(leadStatusFilter.value);
            const rows = await backend.listLeads(query, status);
            state.leads = dedupeLeadsForDisplay(rows);
            renderLeads();
            const leadCounts = countLeadLines(state.leads);
            applyLeadFlowCounters(leadCounts.auto, leadCounts.property, leadCounts.commercial);
            if (leadsStatus) {
                leadsStatus.classList.add("hidden");
            }
        } catch (error) {
            state.leads = [];
            renderLeads();
            if (leadsStatus) {
                setStatus(leadsStatus, error.message || "Lead loading failed. Check backend connection and lead table schema.", "error");
            }
        }
    };

    const exportRows = (rows, fileName) => {
        const header = ["Submission Date", "Client Name", "Email", "Phone", "Line", "Risk Details", "Status"];
        const body = rows.map((lead) => [
            formatDate(lead.submission_date || lead.created_at),
            lead.client_name,
            lead.email,
            lead.phone,
            formatLineLabel(lead.insurance_line),
            lead.risk_details,
            lead.status
        ]);

        const csv = [header, ...body]
            .map((row) => row.map((cell) => `"${String(cell || "").replaceAll("\"", "\"\"")}"`).join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    };

    const hydrateFromBackend = async () => {
        if (!backend || !siteApi) {
            return;
        }

        const content = await backend.getSiteContent();
        if (content) {
            state.content = siteApi.saveSiteContent(content);
        }

        hydrateCompanyForm();
        renderAgents();
        renderAnalytics();
        await hydrateIntegrationForm();
        await loadLeads();
    };

    const ensureAuthState = async () => {
        if (!backend || !backend.isConfigured) {
            setView("missing");
            return;
        }

        const user = await backend.getSessionUser();
        if (!user) {
            setView("login");
            return;
        }

        setView("shell");
        setActiveAdminPanel("overview");
        await hydrateFromBackend();
    };

    if (adminPanelButtons.length > 0) {
        adminPanelButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const next = button.getAttribute("data-admin-panel-target") || "overview";
                setActiveAdminPanel(next);
            });
        });
        setActiveAdminPanel("overview");
    }

    document.addEventListener("shield:analytics-updated", () => {
        renderAnalytics();
    });

    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            try {
                await backend.signIn(loginForm.email.value.trim(), loginForm.password.value);
                loginForm.reset();
                setView("shell");
                await hydrateFromBackend();
            } catch (error) {
                setStatus(loginStatus, error.message || "Login failed.", "error");
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", async (event) => {
            if (event) {
                event.preventDefault();
            }
            try {
                await backend.signOut();
            } finally {
                window.location.assign("/");
            }
        });
    }

    if (analyticsResetButton) {
        analyticsResetButton.addEventListener("click", () => {
            if (!window.confirm("Reset local analytics for this browser?")) {
                return;
            }

            siteApi.resetAnalytics();
            renderAnalytics();
        });
    }

    if (companyForm) {
        companyForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            try {
                state.content.company.officePhone = companyForm.officePhone.value.trim();
                state.content.company.officePhoneLink = normalizePhoneLink(companyForm.officePhone.value);
                state.content.company.supportEmail = companyForm.supportEmail.value.trim();
                state.content.company.azLicense = companyForm.azLicense.value.trim() || "Add in Admin";
                state.content.company.mailingAddress = companyForm.mailingAddress.value.trim() || "Add in Admin";
                state.content.company.linkedinUrl = companyForm.linkedinUrl.value.trim() || "#";
                state.content.company.facebookUrl = companyForm.facebookUrl.value.trim() || "#";
                state.content.company.instagramUrl = companyForm.instagramUrl.value.trim() || "#";
                state.content.company.googleBusinessUrl = companyForm.googleBusinessUrl.value.trim() || "#";
                state.content.company.twitterUrl = companyForm.twitterUrl.value.trim() || "#";

                state.content = siteApi.saveSiteContent(state.content);
                await backend.saveSiteContent(state.content);
                setStatus(companyStatus, "Global company settings saved.", "ok");
            } catch (error) {
                setStatus(companyStatus, error.message || "Unable to save company settings.", "error");
            }
        });
    }

    if (headshotDropzone && headshotInput) {
        headshotDropzone.addEventListener("click", () => {
            headshotInput.click();
        });

        headshotDropzone.addEventListener("dragover", (event) => {
            event.preventDefault();
            headshotDropzone.classList.add("border-shieldBlue", "bg-sky-50");
        });

        headshotDropzone.addEventListener("dragleave", () => {
            headshotDropzone.classList.remove("border-shieldBlue", "bg-sky-50");
        });

        headshotDropzone.addEventListener("drop", async (event) => {
            event.preventDefault();
            headshotDropzone.classList.remove("border-shieldBlue", "bg-sky-50");
            const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
            await processHeadshotFile(file);
        });

        headshotInput.addEventListener("change", async () => {
            const file = headshotInput.files && headshotInput.files[0];
            await processHeadshotFile(file);
        });
    }

    if (removeHeadshotButton && headshotInput) {
        removeHeadshotButton.addEventListener("click", () => {
            state.imageDataUrl = "";
            headshotInput.value = "";
            updateHeadshotPreview("", "");
        });
    }

    if (cropZoom) {
        cropZoom.addEventListener("input", () => {
            cropState.zoom = Number(cropZoom.value) || 1;
            drawCropPreview();
        });
    }

    if (cropPanX) {
        cropPanX.addEventListener("input", () => {
            cropState.panX = Number(cropPanX.value) || 50;
            drawCropPreview();
        });
    }

    if (cropPanY) {
        cropPanY.addEventListener("input", () => {
            cropState.panY = Number(cropPanY.value) || 50;
            drawCropPreview();
        });
    }

    if (cropStyleFit) {
        cropStyleFit.addEventListener("change", () => {
            if (!(cropStyleFit instanceof HTMLInputElement) || !cropStyleFit.checked) {
                return;
            }

            cropState.mode = "fit";
            drawCropPreview();
        });
    }

    if (cropStyleBorder) {
        cropStyleBorder.addEventListener("change", () => {
            if (!(cropStyleBorder instanceof HTMLInputElement) || !cropStyleBorder.checked) {
                return;
            }

            cropState.mode = "border";
            ensureCropBox();
            drawCropPreview();
        });
    }

    if (cropCanvas) {
        cropCanvas.addEventListener("mousedown", (event) => {
            if (cropState.mode !== "border") {
                return;
            }

            const point = getCanvasPoint(event);
            if (!point) {
                return;
            }

            const hit = getHitRegion(point);
            if (!hit) {
                return;
            }

            cropState.drag = {
                type: hit.type,
                handle: hit.handle || "",
                startX: point.x,
                startY: point.y,
                box: cropState.cropBox ? { ...cropState.cropBox } : null
            };
            event.preventDefault();
        });

        cropCanvas.addEventListener("mousemove", (event) => {
            if (cropState.mode !== "border" || !cropState.drag || !cropState.cropBox || !cropState.drag.box) {
                return;
            }

            const point = getCanvasPoint(event);
            if (!point) {
                return;
            }

            const dx = point.x - cropState.drag.startX;
            const dy = point.y - cropState.drag.startY;
            const minSize = 60;
            const bounds = {
                w: cropCanvas.width,
                h: cropCanvas.height
            };

            const start = cropState.drag.box;
            let next = { ...cropState.cropBox };

            if (cropState.drag.type === "move") {
                next.x = clamp(start.x + dx, 0, bounds.w - start.w);
                next.y = clamp(start.y + dy, 0, bounds.h - start.h);
                next.w = start.w;
                next.h = start.h;
            } else {
                let left = start.x;
                let top = start.y;
                let right = start.x + start.w;
                let bottom = start.y + start.h;

                if (cropState.drag.handle.includes("n")) {
                    top = clamp(start.y + dy, 0, bottom - minSize);
                }
                if (cropState.drag.handle.includes("s")) {
                    bottom = clamp(start.y + start.h + dy, top + minSize, bounds.h);
                }
                if (cropState.drag.handle.includes("w")) {
                    left = clamp(start.x + dx, 0, right - minSize);
                }
                if (cropState.drag.handle.includes("e")) {
                    right = clamp(start.x + start.w + dx, left + minSize, bounds.w);
                }

                next = {
                    x: left,
                    y: top,
                    w: right - left,
                    h: bottom - top
                };
            }

            cropState.cropBox = next;
            drawCropPreview();
        });

        const clearDrag = () => {
            cropState.drag = null;
        };
        cropCanvas.addEventListener("mouseup", clearDrag);
        cropCanvas.addEventListener("mouseleave", clearDrag);
    }

    if (cropApply && cropCanvas) {
        cropApply.addEventListener("click", () => {
            if (!cropState.image || !cropState.renderFrame) {
                setStatus(agentStatus, "No image is loaded for crop export.", "error");
                return;
            }

            const frame = cropState.renderFrame;
            const target = cropState.mode === "border" && cropState.cropBox
                ? cropState.cropBox
                : { x: 0, y: 0, w: cropCanvas.width, h: cropCanvas.height };

            const srcX = clamp((target.x - frame.x) / frame.scale, 0, cropState.image.naturalWidth);
            const srcY = clamp((target.y - frame.y) / frame.scale, 0, cropState.image.naturalHeight);
            const srcW = clamp(target.w / frame.scale, 1, cropState.image.naturalWidth - srcX);
            const srcH = clamp(target.h / frame.scale, 1, cropState.image.naturalHeight - srcY);

            // Keep native crop resolution to preserve zoom detail; only downscale oversized exports.
            let outW = Math.max(1, Math.round(srcW));
            let outH = Math.max(1, Math.round(srcH));
            const maxOutput = 4096;
            if (outW > maxOutput || outH > maxOutput) {
                const ratio = Math.min(maxOutput / outW, maxOutput / outH);
                outW = Math.max(1, Math.round(outW * ratio));
                outH = Math.max(1, Math.round(outH * ratio));
            }

            const outputCanvas = document.createElement("canvas");
            outputCanvas.width = outW;
            outputCanvas.height = outH;
            const outputCtx = outputCanvas.getContext("2d");
            if (!outputCtx) {
                setStatus(agentStatus, "Could not process cropped image.", "error");
                return;
            }

            outputCtx.imageSmoothingEnabled = true;
            outputCtx.imageSmoothingQuality = "high";
            outputCtx.drawImage(cropState.image, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

            state.imageDataUrl = outputCanvas.toDataURL("image/png");
            updateHeadshotPreview(state.imageDataUrl, `${cropState.fileLabel || "Headshot"} cropped and ready to publish.`);
            hideCropModal();
        });
    }

    if (cropCancel) {
        cropCancel.addEventListener("click", () => {
            hideCropModal();
        });
    }

    if (cropClose) {
        cropClose.addEventListener("click", () => {
            hideCropModal();
        });
    }

    if (cropModal) {
        cropModal.addEventListener("click", (event) => {
            if (event.target === cropModal) {
                hideCropModal();
            }
        });
    }

    if (cropImageButton) {
        cropImageButton.addEventListener("click", async () => {
            if (!state.imageDataUrl) {
                setStatus(agentStatus, "Upload a headshot first, then crop and zoom.", "error");
                return;
            }

            try {
                await loadCropImage(state.imageDataUrl, "Current headshot");
            } catch (error) {
                setStatus(agentStatus, error.message || "Could not open crop editor.", "error");
            }
        });
    }

    if (headshotPreviewWrap) {
        headshotPreviewWrap.addEventListener("click", async () => {
            if (!state.imageDataUrl) {
                return;
            }

            try {
                await loadCropImage(state.imageDataUrl, "Current headshot");
            } catch (error) {
                setStatus(agentStatus, error.message || "Could not open crop editor.", "error");
            }
        });
    }

    const upsertAgent = async () => {
        const idField = agentForm.querySelector("#agent-id");
        const agentId = (idField && idField.value) || `agent-${Date.now()}`;
        const existing = state.content.agents.find((agent) => agent.id === agentId);
        const agent = {
            id: agentId,
            name: agentForm.name.value.trim(),
            title: agentForm.title.value.trim(),
            roleLabel: agentForm.roleLabel.value.trim() || "Team Member",
            bio: agentForm.bio.value.trim(),
            image: state.imageDataUrl || (existing ? existing.image : "") || ""
        };

        const index = state.content.agents.findIndex((row) => row.id === agentId);
        if (index >= 0) {
            state.content.agents.splice(index, 1, agent);
        } else {
            state.content.agents.push(agent);
        }

        state.content = siteApi.saveSiteContent(state.content);
        await backend.saveSiteContent(state.content);
    };

    if (agentForm) {
        agentForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            try {
                await upsertAgent();
                clearAgentForm();
                renderAgents();
                setStatus(agentStatus, "Agent profile published.", "ok");
            } catch (error) {
                setStatus(agentStatus, error.message || "Unable to publish agent.", "error");
            }
        });
    }

    if (agentResetButton) {
        agentResetButton.addEventListener("click", () => {
            clearAgentForm();
        });
    }

    if (agentList && agentForm) {
        agentList.addEventListener("click", async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }

            const editId = target.getAttribute("data-agent-edit");
            if (editId) {
                const agent = state.content.agents.find((entry) => entry.id === editId);
                if (!agent) {
                    return;
                }

                const idField = agentForm.querySelector("#agent-id");
                if (idField) {
                    idField.value = agent.id;
                }
                agentForm.name.value = agent.name;
                agentForm.title.value = agent.title;
                agentForm.roleLabel.value = agent.roleLabel || "Team Member";
                agentForm.bio.value = agent.bio;
                state.imageDataUrl = agent.image || "";
                updateHeadshotPreview(agent.image || siteApi.createPlaceholderImage(agent.name), agent.image ? "Current headshot loaded." : "Using placeholder image.");
                return;
            }

            const removeId = target.getAttribute("data-agent-remove");
            if (!removeId) {
                return;
            }

            if (removeId === "leadership") {
                return;
            }

            state.content.agents = state.content.agents.filter((entry) => entry.id !== removeId);
            state.content = siteApi.saveSiteContent(state.content);
            await backend.saveSiteContent(state.content);
            renderAgents();
        });
    }

    const saveIntegrations = async () => {
        const payload = {
            crmWebhookUrl: document.getElementById("crm-webhook-url").value.trim(),
            crmApiKey: document.getElementById("crm-api-key").value.trim(),
            notificationWebhookUrl: document.getElementById("notification-webhook-url").value.trim(),
            pipelineWebhookUrl: document.getElementById("pipeline-webhook-url").value.trim(),
            carrierUrlBusiness: document.getElementById("carrier-business").value.trim(),
            carrierUrlHome: document.getElementById("carrier-home").value.trim(),
            carrierUrlAuto: document.getElementById("carrier-auto").value.trim()
        };

        await backend.saveIntegrationSettings(payload);
    };

    if (integrationForm) {
        integrationForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            try {
                await saveIntegrations();
                setStatus(integrationStatus, "Integration settings saved.", "ok");
            } catch (error) {
                setStatus(integrationStatus, error.message || "Unable to save integrations.", "error");
            }
        });
    }

    if (carrierForm) {
        carrierForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            try {
                await saveIntegrations();
                setStatus(integrationStatus, "Routing URLs saved.", "ok");
            } catch (error) {
                setStatus(integrationStatus, error.message || "Unable to save routing URLs.", "error");
            }
        });
    }

    if (leadSearch) {
        leadSearch.addEventListener("input", async () => {
            await loadLeads();
        });
    }

    if (leadStatusFilter) {
        leadStatusFilter.addEventListener("change", async () => {
            await loadLeads();
        });
    }

    if (leadExportButton) {
        leadExportButton.addEventListener("click", () => {
            const stamp = new Date().toISOString().slice(0, 10);
            exportRows(state.leads, `shield-leads-${stamp}.csv`);
        });
    }

    if (leadsBody) {
        leadsBody.addEventListener("change", async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLSelectElement)) {
                return;
            }

            const leadId = target.getAttribute("data-lead-status");
            if (!leadId) {
                return;
            }

            await backend.updateLeadStatus(leadId, target.value);
            await loadLeads();
        });

        leadsBody.addEventListener("click", async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }

            const exportId = target.getAttribute("data-lead-export");
            if (exportId) {
                const row = state.leads.find((lead) => String(lead.id) === exportId);
                if (row) {
                    exportRows([row], `lead-${row.id}.csv`);
                }
                return;
            }

            const pipelineId = target.getAttribute("data-lead-pipeline");
            if (pipelineId) {
                const row = state.leads.find((lead) => String(lead.id) === pipelineId);
                if (!row) {
                    return;
                }

                await backend.pushLeadToPipeline(row);
                setStatus(leadsStatus, "Lead pushed to pipeline webhook.", "ok");
                return;
            }

            const routeId = target.getAttribute("data-lead-route");
            if (!routeId) {
                return;
            }

            const row = state.leads.find((lead) => String(lead.id) === routeId);
            if (!row) {
                return;
            }

            const base = await backend.getCarrierRoute(row.insurance_line);
            if (!base) {
                setStatus(leadsStatus, "Carrier route URL is not configured yet.", "error");
                return;
            }

            const url = new URL(base);
            url.searchParams.set("name", row.client_name || "");
            url.searchParams.set("email", row.email || "");
            url.searchParams.set("phone", row.phone || "");
            url.searchParams.set("line", row.insurance_line || "");
            url.searchParams.set("risk", row.risk_details || "");
            window.open(url.toString(), "_blank", "noopener,noreferrer");
        });
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }

    ensureAuthState();
});
