// Lumi Dessert — "Join Our List" signup form.
// Works on any page that includes a form with id="subscribe-form".

function setupSubscribeForm() {
  const form = document.getElementById('subscribe-form');
  if (!form) return;

  const messageEl = document.getElementById('subscribe-message');
  const btn = document.getElementById('subscribe-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailInput = form.querySelector('input[name="email"]');
    const honeypot = form.querySelector('input[name="company"]');
    const email = emailInput.value.trim();

    messageEl.hidden = true;
    messageEl.classList.remove('subscribe-message-error');

    if (!email) return;

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Joining…';

    try {
      const res = await fetch('/.netlify/functions/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company: honeypot ? honeypot.value : '' }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      messageEl.textContent = 'You’re on the list! 🎉 Thanks for joining.';
      messageEl.hidden = false;
      form.reset();
    } catch (err) {
      messageEl.textContent = err.message;
      messageEl.classList.add('subscribe-message-error');
      messageEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

setupSubscribeForm();
