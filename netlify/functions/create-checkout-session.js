// Creates a Stripe Checkout Session for a Lumi Dessert order.
// Prices are looked up server-side from FLAVORS below — the client can never
// set its own price, only pick a flavor name and quantity.

const Stripe = require('stripe');

const FLAT_PRICE_CENTS = 1100; // $11.00 per 8–9oz serving, every flavor

// Stripe Tax product tax codes (from Stripe's canonical Tax Codes API —
// see https://docs.stripe.com/tax/tax-codes). Tax is only actually
// collected once an active CA registration is recorded in the Stripe
// Dashboard (Tax → Registrations); until then these codes are inert.
const TAX_CODE_FOOD = 'txcd_40040000'; // Food for Non-Immediate Consumption (no utensils provided)
const TAX_CODE_SHIPPING = 'txcd_92010001'; // Shipping (optional — pickup is also offered)

const FLAVORS = [
  'Classic Tiramisu',
  'Blueberry Yogurt Tiramisu',
  'Mango Tiramisu',
  'Dream Choco Tiramisu',
  'Strawberry Tiramisu',
  'Coconut Latte Tiramisu',
];

const DELIVERY_FEE_CENTS = 800; // $8 flat
const FREE_DELIVERY_THRESHOLD_CENTS = 5000; // free delivery at $50+ subtotal

const MAX_QTY_PER_ITEM = 20;

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

  if (!process.env.STRIPE_SECRET_KEY) {
    return jsonResponse(500, {
      error: 'Payments are not configured yet. Please contact Lumi Dessert directly to order.',
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return jsonResponse(400, { error: 'Invalid request body' });
  }

  const { items, fulfillment, pickupDate, delivery, customer, notes } = payload;

  if (!Array.isArray(items) || items.length === 0) {
    return jsonResponse(400, { error: 'Your cart is empty' });
  }
  if (!customer || !customer.name || !customer.email) {
    return jsonResponse(400, { error: 'Name and email are required' });
  }
  if (fulfillment !== 'pickup' && fulfillment !== 'delivery') {
    return jsonResponse(400, { error: 'Choose pickup or delivery' });
  }
  if (fulfillment === 'pickup' && !pickupDate) {
    return jsonResponse(400, { error: 'Pickup date is required' });
  }
  if (fulfillment === 'delivery') {
    if (!delivery || !delivery.address1 || !delivery.city || !delivery.zip || !delivery.date) {
      return jsonResponse(400, { error: 'Full delivery address and date are required' });
    }
  }

  const line_items = [];
  let subtotalCents = 0;

  for (const raw of items) {
    const flavor = typeof raw.flavor === 'string' ? raw.flavor.trim() : '';
    const qty = Number(raw.qty);

    if (!FLAVORS.includes(flavor)) {
      return jsonResponse(400, { error: `Unknown flavor: ${flavor}` });
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      return jsonResponse(400, { error: `Invalid quantity for ${flavor}` });
    }

    subtotalCents += FLAT_PRICE_CENTS * qty;
    line_items.push({
      price_data: {
        currency: 'usd',
        product_data: { name: `${flavor} (8–9oz)`, tax_code: TAX_CODE_FOOD },
        unit_amount: FLAT_PRICE_CENTS,
        tax_behavior: 'exclusive',
      },
      quantity: qty,
    });
  }

  let deliveryFeeCents = 0;
  if (fulfillment === 'delivery') {
    deliveryFeeCents = subtotalCents >= FREE_DELIVERY_THRESHOLD_CENTS ? 0 : DELIVERY_FEE_CENTS;
    if (deliveryFeeCents > 0) {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Local delivery', tax_code: TAX_CODE_SHIPPING },
          unit_amount: deliveryFeeCents,
          tax_behavior: 'exclusive',
        },
        quantity: 1,
      });
    }
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.URL || `https://${event.headers.host}`;

  const metadata = {
    fulfillment,
    fulfilled: 'no',
    customer_name: customer.name,
    customer_phone: customer.phone || '',
    notes: (notes || '').slice(0, 400),
  };

  if (fulfillment === 'pickup') {
    metadata.pickup_date = pickupDate;
  } else {
    metadata.delivery_address = [delivery.address1, delivery.address2, delivery.city, delivery.state, delivery.zip]
      .filter(Boolean)
      .join(', ');
    metadata.delivery_date = delivery.date;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: customer.email,
      success_url: `${siteUrl}/order-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/order.html?cancelled=1`,
      metadata,
      // Metadata on the Session alone doesn't copy to the PaymentIntent/Charge,
      // so it never shows on the Dashboard's main Payments page — set it here
      // too so it's visible (and editable) on the actual payment record.
      payment_intent_data: { metadata },
      automatic_tax: { enabled: true },
    });

    return jsonResponse(200, { url: session.url });
  } catch (err) {
    console.error('Stripe error:', err && err.message);
    return jsonResponse(500, { error: 'Could not start checkout. Please try again.' });
  }
};
