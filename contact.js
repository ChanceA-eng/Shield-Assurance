document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("consultation-form");
    const status = document.getElementById("form-status");
    const siteContent = window.ShieldSite && typeof window.ShieldSite.loadSiteContent === "function"
        ? window.ShieldSite.loadSiteContent()
        : null;
    const fallbackPhone = siteContent && siteContent.company ? siteContent.company.officePhone : "(800) 555-0199";

    if (!form || !status) {
        return;
    }

    const coverageSelect = form.querySelector("#coverage-type");
    const messageField = form.querySelector("#message");
    const routeField = form.querySelector("#intake-route");
    const sourceField = form.querySelector("#crm-source");
    const typeParam = new URLSearchParams(window.location.search).get("type");
    const typeMap = {
        commercial: "business",
        business: "business",
        home: "home",
        property: "home",
        auto: "auto",
        bundle: "bundle"
    };

    // When arriving from the homepage coverage guide, the inline contact page script
    // already pre-filled coverage type, message, and intake-route.  Only run the
    // standard type-param logic if the guide data was NOT already applied.
    const fromGuide = new URLSearchParams(window.location.search).get("from") === "guide";

    if (!fromGuide && typeParam && coverageSelect) {
        const normalized = String(typeParam).toLowerCase();
        const mapped = typeMap[normalized];
        if (mapped) {
            coverageSelect.value = mapped;
        }

        if (messageField && !messageField.value.trim()) {
            const labelMap = {
                business: "Commercial Strategy",
                home: "Home and Property",
                auto: "Auto and Fleet Risk",
                bundle: "Multi-Policy Bundle"
            };
            const selectedLabel = labelMap[mapped] || "General Inquiry";
            messageField.value = "Intake route: " + selectedLabel + "\n";
        }

        if (routeField && mapped) {
            routeField.value = mapped;
        }
    }

    if (sourceField) {
        sourceField.value = fromGuide ? "coverage-guide" : "website-contact";
    }

    if (coverageSelect && routeField) {
        coverageSelect.addEventListener("change", () => {
            routeField.value = coverageSelect.value || "general";
        });
    }

    const setStatus = (message, tone, allowHtml) => {
        status.classList.remove("hidden", "text-emerald-300", "text-amber-300", "text-rose-300");
        status.classList.add(tone);
        if (allowHtml) {
            status.innerHTML = message;
            return;
        }
        status.textContent = message;
    };

    const encodeFormData = (data) => {
        return Object.keys(data)
            .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]))
            .join("&");
    };

    const submitToBackend = async () => {
        if (!window.ShieldBackend || typeof window.ShieldBackend.createLead !== "function") {
            return false;
        }

        const lineText = coverageSelect && coverageSelect.value ? coverageSelect.value : "general";
        await window.ShieldBackend.createLead({
            clientName: form.querySelector("#full-name")?.value || "",
            email: form.querySelector("#email")?.value || "",
            phone: form.querySelector("#phone")?.value || "",
            insuranceLine: lineText,
            riskDetails: messageField?.value || "",
            intakeRoute: routeField?.value || "general",
            sourcePage: "contact.html",
            metadata: {
                crmSource: sourceField?.value || "website-contact",
                networkPartner: form.querySelector("#network-partner")?.value || "smart-choice"
            }
        });

        return true;
    };

    const sendLeadNotification = async () => {
        const summary = (messageField?.value || "").trim() || "No additional details provided.";
        const response = await fetch("/api/send-lead-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName: form.querySelector("#full-name")?.value || "",
                primaryLabel: coverageSelect?.value || "General Inquiry",
                azZip: form.querySelector("#zip-code")?.value || "",
                phone: form.querySelector("#phone")?.value || "",
                email: form.querySelector("#email")?.value || "",
                summary: summary,
                riskDetails: summary,
                insuranceLine: coverageSelect?.value || "general"
            })
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch (_) {
            payload = null;
        }

        if (!response.ok) {
            throw new Error(payload?.error || "Lead notification request failed.");
        }

        return {
            warning: payload?.warning || "",
            confirmationSent: Boolean(payload?.confirmationSent)
        };
    };

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const submitBtn = form.querySelector("button[type='submit']");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting...";
        }

        const formData = new FormData(form);
        const payload = {};
        for (const [key, value] of formData.entries()) {
            payload[key] = value;
        }

        try {
            const backendAccepted = await submitToBackend();
            if (!backendAccepted) {
                // Netlify-compatible fallback for static deployments without Supabase.
                const response = await fetch("/", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: encodeFormData(payload)
                });

                if (!response.ok) {
                    throw new Error("Unexpected response from form endpoint.");
                }
            }

            const notification = await sendLeadNotification();

            form.reset();
            if (notification.warning || !notification.confirmationSent) {
                setStatus(
                    "Request received, but the confirmation email could not be sent. Please call us if you need immediate help.",
                    "text-amber-300"
                );
            } else {
                setStatus(
                    "Request received. To save time, you can <a href=\"/schedule/\" class=\"underline font-semibold text-white\">book an appointment now</a>.",
                    "text-emerald-300",
                    true
                );
            }
        } catch (error) {
            setStatus(`Submission did not complete. Please call ${fallbackPhone} and we will assist immediately.`, "text-rose-300");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Submit Consultation Request";
            }
        }
    });
});
