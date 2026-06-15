// Vercel serverless function
// POST { email } -> adds the contact to a Resend Audience.
// No domain verification required — Audiences API stores contacts only.
//
// Required env vars (set in Vercel project settings):
//   RESEND_API_KEY       — Resend secret API key (re_...)
//   RESEND_AUDIENCE_ID   — UUID of the Resend audience to add contacts to

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const audienceId = process.env.RESEND_AUDIENCE_ID;

    if (!apiKey || !audienceId) {
      return res.status(500).json({ error: 'Server misconfigured (missing Resend env vars).' });
    }

    const resp = await fetch(
      'https://api.resend.com/audiences/' + audienceId + '/contacts',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          unsubscribed: false,
        }),
      }
    );

    if (resp.ok) {
      return res.status(200).json({ ok: true });
    }

    // Treat "already exists" as success so users always get the PDF.
    const err = await resp.json().catch(() => ({}));
    const msg = (err && err.message ? String(err.message) : '').toLowerCase();
    if (resp.status === 409 || msg.includes('already') || msg.includes('exists')) {
      return res.status(200).json({ ok: true, already: true });
    }

    return res.status(resp.status).json({ error: err.message || 'Could not subscribe.' });
  } catch (e) {
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
}
