const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_DIGIT_PATTERN = /\d/g;
const ALLOWED_AI_STATUSES = new Set(["pending", "processing", "complete", "failed", "not_requested"]);

const readJsonBody = (req) => {
  if (!req || req.body == null) {
    return {};
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch (_) {
      return null;
    }
  }

  if (typeof req.body === "object") {
    return req.body;
  }

  return null;
};

const sanitizeText = (value, maxLength = 2000) => {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
};

const sanitizeOptionalObject = (value) => {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
};

const normalizeInsuranceLine = (value) => {
  const normalized = sanitizeText(value, 120).toLowerCase();

  if (!normalized) {
    return "general";
  }

  if (normalized.includes("business") || normalized.includes("commercial")) {
    return "commercial";
  }

  if (normalized.includes("home") || normalized.includes("property") || normalized === "personal") {
    return "property";
  }

  if (normalized.includes("auto") || normalized.includes("fleet") || normalized.includes("vehicle")) {
    return "auto-fleet";
  }

  if (normalized.includes("bundle")) {
    return "bundle";
  }

  return normalized;
};

const normalizeStatus = (value, needsEnrichment) => {
  const normalized = sanitizeText(value, 60).toLowerCase();

  if (normalized === "in progress" || normalized === "in_progress" || normalized === "inprogress") {
    return "In Progress";
  }

  if (normalized === "quoted") {
    return "Quoted";
  }

  if (normalized === "enriched") {
    return "Enriched";
  }

  return needsEnrichment ? "New" : "New";
};

const normalizeAiStatus = (value, needsEnrichment) => {
  const normalized = sanitizeText(value, 40).toLowerCase();
  if (ALLOWED_AI_STATUSES.has(normalized)) {
    return normalized;
  }
  return needsEnrichment ? "pending" : "not_requested";
};

const normalizePhone = (value) => {
  const digits = String(value || "").match(PHONE_DIGIT_PATTERN) || [];
  const normalized = digits.join("").slice(0, 15);
  return normalized;
};

const buildCrmPayload = (lead) => ({
  id: lead.id,
  full_name: lead.client_name,
  fullName: lead.client_name,
  name: lead.client_name,
  email: lead.email,
  phone: lead.phone,
  line: lead.insurance_line,
  line_of_business: lead.insurance_line,
  requirements: lead.risk_details,
  message: lead.risk_details,
  source: lead.source,
  from: lead.source_page,
  needs_enrichment: lead.needs_enrichment,
  ai_status: lead.ai_status,
  metadata: lead.metadata,
  lead_context: lead.lead_context,
  submitted_at: lead.submission_date
});

const insertRow = async (supabaseUrl, serviceKey, tableName, payload) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${tableName} insert failed (${response.status}): ${body}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : rows;
};

const postToCrm = async (lead) => {
  const endpoint = sanitizeText(process.env.CRM_LEAD_WEBHOOK_URL || process.env.CRM_ENDPOINT || "", 500);
  if (!endpoint) {
    return { forwarded: false, reason: "crm_webhook_not_configured" };
  }

  const headers = { "Content-Type": "application/json" };
  const apiKey = sanitizeText(process.env.CRM_LEAD_API_KEY || "", 500);
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(buildCrmPayload(lead))
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`CRM forward failed (${response.status}): ${body}`);
  }

  return { forwarded: true };
};

const triggerEnrichment = async (supabaseUrl, serviceKey, lead) => {
  const endpoint = sanitizeText(process.env.LEAD_ENRICHMENT_WEBHOOK_URL || "", 500);
  if (!endpoint || !lead.needs_enrichment) {
    return { triggered: false };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": sanitizeText(process.env.LEAD_ENRICHMENT_WEBHOOK_TOKEN || "", 500)
    },
    body: JSON.stringify({
      leadId: lead.id,
      source: lead.source,
      ai_status: lead.ai_status,
      supabaseUrl,
      hasServiceRole: Boolean(serviceKey)
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Lead enrichment trigger failed (${response.status}): ${body}`);
  }

  return { triggered: true };
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Server misconfiguration: missing Supabase env vars" });
  }

  const body = readJsonBody(req);
  if (!body) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const metadata = sanitizeOptionalObject(body.metadata);
  const leadContext = sanitizeOptionalObject(body.lead_context);
  const clientName = sanitizeText(body.client_name || body.clientName || body.fullName || body.name, 160);
  const email = sanitizeText(body.email, 160).toLowerCase();
  const phone = normalizePhone(body.phone);
  const insuranceLine = normalizeInsuranceLine(body.insurance_line || body.insuranceLine || body.coverage_type || body.coverageType);
  const riskDetails = sanitizeText(body.risk_details || body.riskDetails || body.requirements || body.message, 8000);
  const intakeRoute = sanitizeText(body.intake_route || body.intakeRoute || "general", 160);
  const sourcePage = sanitizeText(body.source_page || body.sourcePage || req.headers.referer || "website", 500);
  const source = sanitizeText(body.source || metadata.crmSource || "website", 120) || "website";
  const producerId = sanitizeText(body.producer_id || body.producerId, 120) || null;
  const needsEnrichment = body.needs_enrichment === false || body.needsEnrichment === false ? false : true;
  const aiStatus = normalizeAiStatus(body.ai_status || body.aiStatus, needsEnrichment);
  const status = normalizeStatus(body.status, needsEnrichment);

  if (!clientName) {
    return res.status(400).json({ error: "Client name is required" });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: "A valid email address is required" });
  }

  if (phone.length < 10) {
    return res.status(400).json({ error: "A valid phone number is required" });
  }

  if (!riskDetails) {
    return res.status(400).json({ error: "Risk details are required" });
  }

  const submittedAt = new Date().toISOString();
  const leadPayload = {
    submission_date: submittedAt,
    client_name: clientName,
    email,
    phone,
    insurance_line: insuranceLine,
    risk_details: riskDetails,
    status,
    intake_route: intakeRoute,
    source_page: sourcePage,
    source,
    needs_enrichment: needsEnrichment,
    ai_status: aiStatus,
    lead_context: leadContext,
    producer_id: producerId,
    metadata
  };

  try {
    const insertedLead = await insertRow(supabaseUrl, serviceKey, "leads", leadPayload);

    let crmForward = { forwarded: false };
    try {
      crmForward = await postToCrm(insertedLead);
    } catch (crmError) {
      await insertRow(supabaseUrl, serviceKey, "operations_log", {
        lead_id: insertedLead.id,
        event_type: "crm_forward_failed",
        status: "error",
        source,
        details: crmError.message || "Unknown CRM forwarding error",
        payload: { sourcePage, intakeRoute }
      });
    }

    let enrichment = { triggered: false };
    try {
      enrichment = await triggerEnrichment(supabaseUrl, serviceKey, insertedLead);
    } catch (enrichmentError) {
      await insertRow(supabaseUrl, serviceKey, "operations_log", {
        lead_id: insertedLead.id,
        event_type: "lead_enrichment_trigger_failed",
        status: "error",
        source,
        details: enrichmentError.message || "Unknown enrichment trigger error",
        payload: { needsEnrichment }
      });
    }

    await insertRow(supabaseUrl, serviceKey, "operations_log", {
      lead_id: insertedLead.id,
      event_type: "lead_created",
      status: "success",
      source,
      details: `Lead created from ${sourcePage}`,
      payload: {
        insurance_line: insertedLead.insurance_line,
        intake_route: insertedLead.intake_route,
        crmForwarded: crmForward.forwarded,
        enrichmentTriggered: enrichment.triggered,
        needs_enrichment: insertedLead.needs_enrichment,
        ai_status: insertedLead.ai_status
      }
    });

    return res.status(200).json({
      ok: true,
      lead: insertedLead,
      crmForwarded: Boolean(crmForward.forwarded),
      enrichmentTriggered: Boolean(enrichment.triggered)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to create lead" });
  }
}