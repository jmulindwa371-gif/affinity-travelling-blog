// Vercel serverless function
// POST { email } -> adds the contact to a Resend Audience.
// Auto-discovers the audience ID (uses the first one in the account), so the
// only required env var is RESEND_API_KEY.
//
// Required env var (set in Vercel project settings):
//   RESEND_API_KEY       — Resend secret API key (re_...). Needs Full access.
// Optional env var:
//   RESEND_AUDIENCE_ID   — Override the auto-discovered audience.

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
    if (!apiKey) {
      return res.status(500).json({ error: 'Server misconfigured (missing RESEND_API_KEY).' });
    }

    let audienceId = process.env.RESEND_AUDIENCE_ID;

    if (!audienceId) {
      const listResp = await fetch('https://api.resend.com/audiences', {
        headers: { Authorization: 'Bearer ' + apiKey },
      });
      if (!listResp.ok) {
        return res.status(500).json({ error: 'Could not list audiences (' + listResp.status + ').' });
      }
      const listJson = await listResp.json().catch(() => ({}));
      const audiences = listJson.data || listJson.audiences || [];
      audienceId = audiences[0] && audiences[0].id;
      if (!audienceId) {
        return res.status(500).json({ error: 'No audience found in Resend account.' });
      }
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
