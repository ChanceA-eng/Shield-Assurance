export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server misconfiguration: missing SENDGRID_API_KEY" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const fullName = String(body.fullName || "Unknown").trim();
  const primaryLabel = String(body.primaryLabel || body.insuranceLine || "General Inquiry").trim();
  const azZip = String(body.azZip || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();
  const summary = String(body.summary || body.riskDetails || "No additional details provided.").trim();

  const msg = {
    personalizations: [
      {
        to: [{ email: "camani@shield-assurance.com" }],
        subject: `New Lead Captured: ${fullName} (${primaryLabel})`
      }
    ],
    from: { email: "alerts@shield-assurance.com" },
    content: [
      {
        type: "text/plain",
        value:
`You have received a new consultation submission from your website.

Client Name: ${fullName}
Line of Insurance: ${primaryLabel}
ZIP Code: ${azZip || "Not provided"}
Phone: ${phone || "Not provided"}
Email: ${email || "Not provided"}

Coverage Selections:
${summary}`
      }
    ]
  };

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(msg)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(500).json({ error: `SendGrid error ${response.status}: ${errorBody}` });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to send lead notification" });
  }
}
