// Lumi internal Orders tool — passphrase gate + list orders + toggle fulfilled.

const STORAGE_KEY = 'lumi_admin_secret';

const lockScreen = document.getElementById('lock-screen');
const ordersTool = document.getElementById('orders-tool');
const passphraseInput = document.getElementById('passphrase-input');
const unlockBtn = document.getElementById('unlock-btn');
const lockError = document.getElementById('lock-error');
const ordersList = document.getElementById('orders-list');
const hideFulfilled = document.getElementById('hide-fulfilled');
const refreshBtn = document.getElementById('refresh-btn');

let orders = [];

function showTool() {
  lockScreen.hidden = true;
  ordersTool.hidden = false;
  loadOrders();
}

function unlock() {
  const value = passphraseInput.value.trim();
  if (!value) return;
  sessionStorage.setItem(STORAGE_KEY, value);
  lockError.hidden = true;
  showTool();
}

unlockBtn.addEventListener('click', unlock);
passphraseInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') unlock();
});

if (sessionStorage.getItem(STORAGE_KEY)) {
  showTool();
}

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function describeFulfillment(meta) {
  if (meta.fulfillment === 'pickup') {
    return `Pickup ${meta.pickup_date || '—'}`;
  }
  if (meta.fulfillment === 'delivery') {
    return `Delivery ${meta.delivery_date || '—'} — ${meta.delivery_address || ''}`;
  }
  return 'Custom / invoiced order';
}

function render() {
  const filtered = hideFulfilled.checked ? orders.filter((o) => o.metadata.fulfilled !== 'yes') : orders;

  if (filtered.length === 0) {
    ordersList.innerHTML = '<p class="empty-state">No orders to show.</p>';
    return;
  }

  ordersList.innerHTML = filtered.map((o) => {
    const meta = o.metadata;
    const isFulfilled = meta.fulfilled === 'yes';
    return `
      <div class="order-card ${isFulfilled ? 'is-fulfilled' : ''}" data-id="${o.id}">
        <div class="order-main">
          <h3>${meta.customer_name || 'Unknown customer'} <span class="amount">${money(o.amount)}</span></h3>
          <p>${formatDate(o.created)}</p>
          <p>${describeFulfillment(meta)}</p>
          ${meta.customer_phone ? `<p>📞 ${meta.customer_phone}</p>` : ''}
          ${meta.notes ? `<p class="order-note">"${meta.notes}"</p>` : ''}
        </div>
        <button class="fulfill-btn ${isFulfilled ? 'mark-undo' : 'mark-done'}" data-id="${o.id}" data-next="${!isFulfilled}">
          ${isFulfilled ? 'Mark Unfulfilled' : 'Mark Fulfilled'}
        </button>
      </div>
    `;
  }).join('');
}

async function loadOrders() {
  ordersList.innerHTML = '<p class="empty-state">Loading…</p>';
  try {
    const res = await fetch('/.netlify/functions/list-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: sessionStorage.getItem(STORAGE_KEY) || '' }),
    });
    const data = await res.json();

    if (res.status === 401) {
      sessionStorage.removeItem(STORAGE_KEY);
      lockScreen.hidden = false;
      ordersTool.hidden = true;
      lockError.textContent = 'Incorrect passphrase — try again.';
      lockError.hidden = false;
      return;
    }
    if (!res.ok) throw new Error(data.error || 'Could not load orders.');

    orders = data.orders.sort((a, b) => b.created - a.created);
    render();
  } catch (err) {
    ordersList.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}

hideFulfilled.addEventListener('change', render);
refreshBtn.addEventListener('click', loadOrders);

ordersList.addEventListener('click', async (e) => {
  const btn = e.target.closest('.fulfill-btn');
  if (!btn) return;

  const id = btn.dataset.id;
  const next = btn.dataset.next === 'true';
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const res = await fetch('/.netlify/functions/mark-fulfilled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: sessionStorage.getItem(STORAGE_KEY) || '', paymentIntentId: id, fulfilled: next }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not update this order.');

    const order = orders.find((o) => o.id === id);
    if (order) order.metadata.fulfilled = data.fulfilled;
    render();
  } catch (err) {
    btn.disabled = false;
    alert(err.message);
  }
});
