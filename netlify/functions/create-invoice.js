// Creates and sends a one-off Stripe Invoice for a custom/catering order.
// Internal tool only — gated by ADMIN_SECRET, not linked from the
// public site. All line items are treated as food (same product tax code
// used on the online checkout) since this is scoped to tiramisu orders.

const Stripe = require('stripe');

const TAX_CODE_FOOD = 'txcd_40040000'; // Food for Non-Immediate Consumption — see create-checkout-session.js

const MAX_ITEMS = 20;
const MAX_QTY = 500;
const MAX_UNIT_AMOUNT_CENTS = 500000; // $5,000 sanity ceiling per line item

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
  if (!STRIPE_SECRET_KEY) {
    return jsonResponse(500, { error: 'Payments are not configured yet.' });
  }
  if (!ADMIN_SECRET) {
    return jsonResponse(500, { error: 'Invoicing tool is not configured yet.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return jsonResponse(400, { error: 'Invalid request body' });
  }

  if (payload.secret !== ADMIN_SECRET) {
    return jsonResponse(401, { error: 'Incorrect passphrase' });
  }

  const { customer, items, daysUntilDue, memo } = payload;

  if (!customer || !customer.name || !customer.email) {
    return jsonResponse(400, { error: 'Customer name and email are required' });
  }
  if (!customer.address1 || !customer.city || !customer.state || !customer.zip) {
    return jsonResponse(400, { error: 'Full customer address is required for tax calculation' });
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    return jsonResponse(400, { error: `Add between 1 and ${MAX_ITEMS} line items` });
  }

  const due = Number.isInteger(daysUntilDue) && daysUntilDue > 0 && daysUntilDue <= 90 ? daysUntilDue : 7;

  for (const raw of items) {
    const description = typeof raw.description === 'string' ? raw.description.trim() : '';
    const qty = Number(raw.quantity);
    const unitAmountCents = Math.round(Number(raw.unitAmount) * 100);

    if (!description) {
      return jsonResponse(400, { error: 'Every line item needs a description' });
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return jsonResponse(400, { error: `Invalid quantity for "${description}"` });
    }
    if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0 || unitAmountCents > MAX_UNIT_AMOUNT_CENTS) {
      return jsonResponse(400, { error: `Invalid price for "${description}"` });
    }
  }

  const stripe = Stripe(STRIPE_SECRET_KEY);
  const address = {
    line1: customer.address1,
    city: customer.city,
    state: customer.state,
    postal_code: customer.zip,
    country: 'US',
  };

  try {
    let stripeCustomer;
    const existing = await stripe.customers.list({ email: customer.email, limit: 1 });
    if (existing.data.length > 0) {
      stripeCustomer = await stripe.customers.update(existing.data[0].id, {
        name: customer.name,
        phone: customer.phone || undefined,
        address,
      });
    } else {
      stripeCustomer = await stripe.customers.create({
        name: customer.name,
        email: customer.email,
        phone: customer.phone || undefined,
        address,
      });
    }

    for (const raw of items) {
      await stripe.invoiceItems.create({
        customer: stripeCustomer.id,
        currency: 'usd',
        description: raw.description.trim(),
        quantity: Math.round(Number(raw.quantity)),
        unit_amount: Math.round(Number(raw.unitAmount) * 100),
        tax_behavior: 'exclusive',
        tax_code: TAX_CODE_FOOD,
      });
    }

    let invoice = await stripe.invoices.create({
      customer: stripeCustomer.id,
      collection_method: 'send_invoice',
      days_until_due: due,
      automatic_tax: { enabled: true },
      pending_invoice_items_behavior: 'include',
      auto_advance: true,
      description: (memo || '').slice(0, 500) || undefined,
    });

    invoice = await stripe.invoices.finalizeInvoice(invoice.id);

    return jsonResponse(200, {
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoiceNumber: invoice.number,
      total: invoice.total,
      status: invoice.status,
    });
  } catch (err) {
    console.error('Invoice error:', err && err.message);
    return jsonResponse(500, { error: 'Could not create the invoice. Please try again.' });
  }
};
