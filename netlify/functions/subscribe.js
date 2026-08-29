// Adds an email to the Lumi Dessert Mailchimp audience (single opt-in).
// Uses PUT with an MD5-hashed email as the member id, which makes this an
// upsert — resubmitting the same email is safe and just confirms them again.

const crypto = require('crypto');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const { MAILCHIMP_API_KEY, MAILCHIMP_AUDIENCE_ID } = process.env;
  if (!MAILCHIMP_API_KEY || !MAILCHIMP_AUDIENCE_ID) {
    return jsonResponse(500, {
      error: 'Sign-up isn’t connected yet. Please check back soon!',
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return jsonResponse(400, { error: 'Invalid request' });
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 100) : '';

  // Honeypot: real users never fill this hidden field, bots often do.
  if (payload.company) {
    return jsonResponse(200, { ok: true });
  }

  if (!EMAIL_RE.test(email)) {
    return jsonResponse(400, { error: 'Please enter a valid email address' });
  }

  const dc = MAILCHIMP_API_KEY.split('-')[1];
  if (!dc) {
    return jsonResponse(500, { error: 'Sign-up is misconfigured. Please try again later.' });
  }

  const subscriberHash = crypto.createHash('md5').update(email).digest('hex');
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members/${subscriberHash}`;

  const body = {
    email_address: email,
    status_if_new: 'subscribed',
    status: 'subscribed',
  };
  if (name) {
    body.merge_fields = { FNAME: name };
  }

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Mailchimp error:', err);
      return jsonResponse(502, { error: 'Could not join the list right now. Please try again.' });
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    return jsonResponse(500, { error: 'Could not join the list right now. Please try again.' });
  }
};
