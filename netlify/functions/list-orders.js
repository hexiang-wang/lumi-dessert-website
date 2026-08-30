// Lists recent successful orders (PaymentIntents) for the internal Orders
// tool. Gated by ADMIN_SECRET. Read-only.

const Stripe = require('stripe');

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

  const { STRIPE_SECRET_KEY, ADMIN_SECRET } = process.env;
  if (!STRIPE_SECRET_KEY || !ADMIN_SECRET) {
    return jsonResponse(500, { error: 'Not configured yet.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return jsonResponse(400, { error: 'Invalid request' });
  }

  if (payload.secret !== ADMIN_SECRET) {
    return jsonResponse(401, { error: 'Incorrect passphrase' });
  }

  const stripe = Stripe(STRIPE_SECRET_KEY);

  try {
    const intents = await stripe.paymentIntents.list({ limit: 50 });

    const orders = intents.data
      .filter((pi) => pi.status === 'succeeded')
      .map((pi) => ({
        id: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        created: pi.created,
        metadata: pi.metadata || {},
      }));

    return jsonResponse(200, { orders });
  } catch (err) {
    console.error('List orders error:', err && err.message);
    return jsonResponse(500, { error: 'Could not load orders.' });
  }
};
