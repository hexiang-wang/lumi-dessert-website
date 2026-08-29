// Adds an email to the Lumi Dessert Brevo list (single opt-in).
// updateEnabled:true makes this an upsert — resubmitting the same email is
// safe and just re-confirms them instead of erroring as a duplicate.

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

  const { BREVO_API_KEY, BREVO_LIST_ID } = process.env;
  if (!BREVO_API_KEY || !BREVO_LIST_ID) {
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

  const body = {
    email,
    listIds: [Number(BREVO_LIST_ID)],
    updateEnabled: true,
  };
  if (name) {
    body.attributes = { FIRSTNAME: name };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Brevo returns 201 for a new contact, 204 for an existing one that was updated.
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      console.error('Brevo error:', err);
      return jsonResponse(502, { error: 'Could not join the list right now. Please try again.' });
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    return jsonResponse(500, { error: 'Could not join the list right now. Please try again.' });
  }
};
