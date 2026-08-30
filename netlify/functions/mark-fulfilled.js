// Flips the `fulfilled` metadata flag on an order. Updates BOTH the
// PaymentIntent and its Charge in one call so they never drift out of sync
// (Stripe copies PI metadata to the Charge only once, at charge creation
// time — see create-checkout-session.js for the full explanation).

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

  const { paymentIntentId, fulfilled } = payload;
  if (typeof paymentIntentId !== 'string' || !paymentIntentId.startsWith('pi_')) {
    return jsonResponse(400, { error: 'Invalid payment intent id' });
  }
  const value = fulfilled ? 'yes' : 'no';

  const stripe = Stripe(STRIPE_SECRET_KEY);

  try {
    const intent = await stripe.paymentIntents.update(paymentIntentId, {
      metadata: { fulfilled: value },
    });

    if (intent.latest_charge) {
      const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge.id;
      await stripe.charges.update(chargeId, { metadata: { fulfilled: value } });
    }

    return jsonResponse(200, { ok: true, fulfilled: value });
  } catch (err) {
    console.error('Mark fulfilled error:', err && err.message);
    return jsonResponse(500, { error: 'Could not update this order.' });
  }
};
