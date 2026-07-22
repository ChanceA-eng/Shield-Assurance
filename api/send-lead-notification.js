export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "camani@shield-assurance.com";
  const fromName = process.env.SENDGRID_FROM_NAME || "Shield Assurance LLC";
  const toEmail = process.env.SENDGRID_TO_EMAIL || "camani@shield-assurance.com";
  const officePhone = process.env.SENDGRID_OFFICE_PHONE || "520.261.1618";
  const mailingAddress = process.env.SENDGRID_MAILING_ADDRESS || "1718 E Speedway Blvd, Tucson, AZ 85719 (mailing only)";
  const websiteUrl = process.env.SENDGRID_WEBSITE_URL || "www.shield-assurance.com";
  const senderCategory = process.env.SENDGRID_SENDER_CATEGORY || "Shield Assurance Team";
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
  const riskDetails = String(body.riskDetails || body.summary || "No additional details provided.").trim();

  const internalMsg = {
    personalizations: [
      {
        to: [{ email: toEmail }],
        subject: `New Lead Captured: ${fullName} (${primaryLabel})`
      }
    ],
    from: { email: fromEmail, name: fromName },
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

Coverage Summary:
${summary}

Full Submission Details:
${riskDetails}`
      }
    ]
  };

  const prospectName = fullName && fullName !== "Unknown" ? fullName : "there";
  const prospectSubject = "We received your quote request - Shield Assurance LLC";
  const prospectMsg = {
    personalizations: [
      {
        to: [{ email }],
        subject: prospectSubject
      }
    ],
    from: { email: fromEmail, name: fromName },
    reply_to: { email: toEmail, name: fromName },
    content: [
      {
        type: "text/plain",
        value:
`Hi ${prospectName},

Thank you for requesting a coverage review with Shield Assurance LLC. We received your information.

What happens next?
Our team is reviewing your details and matching options from our independent carriers. An advisor will reach out shortly.

If you have updates before we call, reply to this email or call ${officePhone}.

Best regards,
${fromName}
${senderCategory}
${mailingAddress}
${websiteUrl}`
      }
    ]
  };

  async function sendMail(payload) {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`SendGrid error ${response.status}: ${errorBody}`);
    }
  }

  try {
    await sendMail(internalMsg);

    if (email) {
      try {
        await sendMail(prospectMsg);
      } catch (prospectError) {
        return res.status(200).json({
          ok: true,
          confirmationSent: false,
          warning: "Lead captured and internal email sent, but confirmation email failed.",
          details: prospectError.message || "Unknown confirmation email error"
        });
      }
    }

    return res.status(200).json({ ok: true, confirmationSent: Boolean(email) });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to send lead notification" });
  }
}
