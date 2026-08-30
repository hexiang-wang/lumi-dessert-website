// Lumi internal invoicing tool — passphrase gate + custom line items -> Stripe Invoice.

const STORAGE_KEY = 'lumi_admin_secret';

const lockScreen = document.getElementById('lock-screen');
const invoiceTool = document.getElementById('invoice-tool');
const passphraseInput = document.getElementById('passphrase-input');
const unlockBtn = document.getElementById('unlock-btn');
const lockError = document.getElementById('lock-error');

function showTool() {
  lockScreen.hidden = true;
  invoiceTool.hidden = false;
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

// If we already have a passphrase from earlier this session, skip the lock screen.
// (The server still validates it on every request — this only saves re-typing.)
if (sessionStorage.getItem(STORAGE_KEY)) {
  showTool();
}

// ---------- Line items ----------

const lineItemsEl = document.getElementById('line-items');
const addRowBtn = document.getElementById('add-row-btn');

function addRow(description = '', quantity = 1, unitAmount = '') {
  const row = document.createElement('div');
  row.className = 'line-item-row';
  row.innerHTML = `
    <label class="field"><span>Description</span><input type="text" class="li-desc" value="${description}" placeholder="e.g. Classic Tiramisu, 8oz"></label>
    <label class="field"><span>Qty</span><input type="number" class="li-qty" value="${quantity}" min="1"></label>
    <label class="field"><span>Unit price ($)</span><input type="number" class="li-price" value="${unitAmount}" min="0" step="0.01"></label>
    <button type="button" class="remove-row" aria-label="Remove line item">&times;</button>
  `;
  row.querySelector('.remove-row').addEventListener('click', () => {
    if (lineItemsEl.children.length > 1) row.remove();
  });
  lineItemsEl.appendChild(row);
}

addRowBtn.addEventListener('click', () => addRow());
addRow('Classic Tiramisu, 8–9oz', 1, 11);

// ---------- Submit ----------

const form = document.getElementById('invoice-form');
const formError = document.getElementById('form-error');
const resultBox = document.getElementById('result-box');
const submitBtn = document.getElementById('submit-btn');

function showError(msg) {
  formError.textContent = msg;
  formError.hidden = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.hidden = true;
  resultBox.hidden = true;

  const items = Array.from(lineItemsEl.querySelectorAll('.line-item-row')).map((row) => ({
    description: row.querySelector('.li-desc').value.trim(),
    quantity: Number(row.querySelector('.li-qty').value),
    unitAmount: Number(row.querySelector('.li-price').value),
  }));

  if (items.some((i) => !i.description || !i.quantity || !i.unitAmount)) {
    showError('Every line item needs a description, quantity, and price.');
    return;
  }

  const payload = {
    secret: sessionStorage.getItem(STORAGE_KEY) || '',
    customer: {
      name: document.getElementById('cust-name').value.trim(),
      email: document.getElementById('cust-email').value.trim(),
      phone: document.getElementById('cust-phone').value.trim(),
    },
    items,
    daysUntilDue: Number(document.getElementById('days-until-due').value) || 7,
    memo: document.getElementById('memo').value.trim(),
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating invoice…';

  try {
    const res = await fetch('/.netlify/functions/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.status === 401) {
      sessionStorage.removeItem(STORAGE_KEY);
      lockScreen.hidden = false;
      invoiceTool.hidden = true;
      lockError.textContent = 'Incorrect passphrase — try again.';
      lockError.hidden = false;
      return;
    }

    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong.');
    }

    resultBox.hidden = false;
    resultBox.innerHTML = `
      <p><strong>Invoice #${data.invoiceNumber || '(pending)'}</strong> created and sent — total $${(data.total / 100).toFixed(2)}.</p>
      <p><a href="${data.hostedInvoiceUrl}" target="_blank" rel="noopener">${data.hostedInvoiceUrl}</a></p>
    `;
    form.reset();
    lineItemsEl.innerHTML = '';
    addRow('Classic Tiramisu, 8–9oz', 1, 11);
  } catch (err) {
    showError(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create & Send Invoice';
  }
});
