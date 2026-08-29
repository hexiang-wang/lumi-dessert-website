// Lumi Dessert — order page cart, fulfillment toggle, and checkout submit.
// Prices shown here are for display only; the server recomputes everything
// from a trusted price list before creating the Stripe Checkout Session.

const FLAVORS = [
  'Classic Tiramisu',
  'Matcha',
  'Sea Salt Caramel',
  'Blueberry',
  'Strawberry',
  'Mango',
  'Coconut Latte',
  'Chocolate Hazelnut',
];

const PRICE = 11; // dollars, flat per flavor
const DELIVERY_FEE = 8;
const FREE_DELIVERY_THRESHOLD = 50;

const cart = {}; // flavor -> qty
let fulfillment = 'pickup';

const money = (n) => `$${n.toFixed(2)}`;

function renderMenu() {
  const list = document.getElementById('menu-list');
  list.innerHTML = FLAVORS.map((flavor) => `
    <div class="menu-item" data-flavor="${flavor}">
      <div class="menu-item-info">
        <h3>${flavor}</h3>
        <p>${money(PRICE)} · 8–9oz</p>
      </div>
      <div class="qty-stepper">
        <button type="button" class="qty-btn" data-action="dec" aria-label="Decrease ${flavor} quantity">−</button>
        <span class="qty-value" data-qty-for="${flavor}">0</span>
        <button type="button" class="qty-btn" data-action="inc" aria-label="Increase ${flavor} quantity">+</button>
      </div>
    </div>
  `).join('');

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.qty-btn');
    if (!btn) return;
    const flavor = btn.closest('.menu-item').dataset.flavor;
    const current = cart[flavor] || 0;
    const next = btn.dataset.action === 'inc' ? Math.min(current + 1, 20) : Math.max(current - 1, 0);
    if (next === 0) delete cart[flavor]; else cart[flavor] = next;
    list.querySelector(`[data-qty-for="${flavor}"]`).textContent = next;
    renderSummary();
  });
}

function cartSubtotal() {
  return Object.values(cart).reduce((sum, qty) => sum + qty * PRICE, 0);
}

function renderSummary() {
  const linesEl = document.getElementById('summary-lines');
  const totalsEl = document.getElementById('summary-totals');
  const entries = Object.entries(cart);

  if (entries.length === 0) {
    linesEl.innerHTML = '<p class="empty-cart">Your box is empty — add a flavor to get started.</p>';
    totalsEl.hidden = true;
    updateCheckoutState();
    return;
  }

  linesEl.innerHTML = entries.map(([flavor, qty]) => `
    <div class="summary-line"><span>${qty} × ${flavor}</span><span>${money(qty * PRICE)}</span></div>
  `).join('');

  const subtotal = cartSubtotal();
  const deliveryFee = fulfillment === 'delivery' && subtotal < FREE_DELIVERY_THRESHOLD ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;

  document.getElementById('sum-subtotal').textContent = money(subtotal);
  const deliveryRow = document.getElementById('sum-delivery-row');
  if (fulfillment === 'delivery') {
    deliveryRow.hidden = false;
    document.getElementById('sum-delivery').textContent = deliveryFee === 0 ? 'Free' : money(deliveryFee);
  } else {
    deliveryRow.hidden = true;
  }
  document.getElementById('sum-total').textContent = money(total);
  totalsEl.hidden = false;

  updateCheckoutState();
}

function setupFulfillmentToggle() {
  const buttons = document.querySelectorAll('.fulfillment-btn');
  const panels = { pickup: document.getElementById('panel-pickup'), delivery: document.getElementById('panel-delivery') };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      fulfillment = btn.dataset.fulfillment;
      buttons.forEach((b) => b.classList.toggle('is-active', b === btn));
      panels.pickup.hidden = fulfillment !== 'pickup';
      panels.delivery.hidden = fulfillment !== 'delivery';
      renderSummary();
    });
  });

  const today = new Date();
  const minDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  document.getElementById('pickup-date').min = minDate;
  document.getElementById('delivery-date').min = minDate;
}

function updateCheckoutState() {
  const btn = document.getElementById('checkout-btn');
  const hasItems = Object.keys(cart).length > 0;
  btn.disabled = !hasItems;
}

function showError(message) {
  const el = document.getElementById('form-error');
  el.textContent = message;
  el.hidden = false;
}

function clearError() {
  const el = document.getElementById('form-error');
  el.hidden = true;
  el.textContent = '';
}

function setupForm() {
  const form = document.getElementById('order-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const items = Object.entries(cart).map(([flavor, qty]) => ({ flavor, qty }));
    if (items.length === 0) {
      showError('Please add at least one item to your box.');
      return;
    }

    const name = document.getElementById('cust-name').value.trim();
    const email = document.getElementById('cust-email').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const notes = document.getElementById('cust-notes').value.trim();

    if (!name || !email) {
      showError('Please fill in your name and email.');
      return;
    }

    const payload = {
      items,
      fulfillment,
      customer: { name, email, phone },
      notes,
    };

    if (fulfillment === 'pickup') {
      const pickupDate = document.getElementById('pickup-date').value;
      if (!pickupDate) {
        showError('Please choose a pickup date.');
        return;
      }
      payload.pickupDate = pickupDate;
    } else {
      const address1 = document.getElementById('address1').value.trim();
      const address2 = document.getElementById('address2').value.trim();
      const city = document.getElementById('city').value.trim();
      const state = document.getElementById('state').value.trim();
      const zip = document.getElementById('zip').value.trim();
      const date = document.getElementById('delivery-date').value;
      if (!address1 || !city || !zip || !date) {
        showError('Please fill in your full delivery address and date.');
        return;
      }
      payload.delivery = { address1, address2, city, state, zip, date };
    }

    const btn = document.getElementById('checkout-btn');
    btn.disabled = true;
    btn.textContent = 'Redirecting to payment…';

    try {
      const res = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      window.location.href = data.url;
    } catch (err) {
      showError(err.message);
      btn.disabled = false;
      btn.textContent = 'Proceed to Payment';
    }
  });
}

function checkCancelledFlag() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('cancelled') === '1') {
    showError('Checkout was cancelled — your box is still here whenever you’re ready.');
  }
}

renderMenu();
renderSummary();
setupFulfillmentToggle();
setupForm();
checkCancelledFlag();
