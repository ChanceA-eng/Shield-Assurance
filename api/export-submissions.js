// Vercel Serverless Function — called by the CRM every 5 minutes to pull new leads.
// Requires: WEBSITE_SYNC_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env vars.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== `Bearer ${process.env.WEBSITE_SYNC_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: missing Supabase env vars' });
  }

  try {
    // Fetch leads with status 'New' (not yet picked up by CRM).
    // CRM should PATCH status to 'In Progress' after successful import.
    const response = await fetch(
      `${supabaseUrl}/rest/v1/leads?select=*&status=eq.New&order=created_at.asc&limit=50`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase error ${response.status}: ${body}`);
    }

    const leads = await response.json();
    return res.status(200).json(leads);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
