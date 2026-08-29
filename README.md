# Lumi Dessert — Website

Static marketing site + online ordering for **Lumi Dessert**, a San Ramon, CA
dessert shop crafting handcrafted, family-friendly tiramisu.

- **Live site:** https://lumi-dessert.netlify.app
- **Order online:** https://lumi-dessert.netlify.app/order.html
- **Source repo:** https://github.com/hexiang-wang/lumi-dessert-website

## Structure

```
index.html                 Marketing single-page site
order.html                  Online ordering / cart page
order-success.html          Post-payment confirmation page
css/style.css                Marketing site styling
css/order.css                Order page styling
js/script.js                 Mobile nav toggle + scroll-reveal animation
js/order.js                  Cart state, fulfillment toggle, checkout submit
netlify/functions/create-checkout-session.js   Server-side Stripe Checkout Session creation
netlify.toml                  Netlify build/functions config
package.json                  Node deps for the serverless function (stripe)
images/                       Logo, hero photo, original source images
.claude/launch.json           Local dev server configs
```

No frontend build step — plain HTML/CSS/JS. The one Node dependency
(`stripe`) is only used by the serverless function.

## Local preview

Static pages only (no ordering/checkout):
```bash
python3 -m http.server 4173
```

Full site including the order flow and serverless function:
```bash
npm install        # first time only
npx netlify-cli dev --port 8888
```
Then open http://localhost:8888

## To edit content

Marketing copy lives in `index.html`. Order page copy/menu lives in
`order.html` and `js/order.js` (flavor list + price). Colors and fonts are
CSS variables at the top of `css/style.css` (`:root`).

## Online ordering & payments

Checkout uses **Stripe Checkout** (Stripe's hosted payment page) — card
numbers are entered on Stripe's page, never on this site, and the site never
stores payment details.

**One-time setup, done by the shop owner (not by Claude — API keys must
never be pasted into chat):**

1. Create a free Stripe account at https://dashboard.stripe.com/register
2. In the Stripe Dashboard, copy your **Secret key** (Developers → API keys).
   Start with the **test mode** key (`sk_test_...`) to try orders without
   real charges.
3. In the Netlify dashboard for this site — https://app.netlify.com/projects/lumi-dessert/settings/env —
   add an environment variable:
   - Key: `STRIPE_SECRET_KEY`
   - Value: your `sk_test_...` (or later `sk_live_...`) key
4. Trigger a new deploy (`npx netlify-cli deploy --prod --dir=.`) so the
   function picks up the new environment variable.
5. Test a full order on `/order.html` using a Stripe test card
   (`4242 4242 4242 4242`, any future expiry/CVC).
6. When ready to accept real payments, switch Stripe to **live mode**, copy
   the live secret key (`sk_live_...`), and replace the Netlify env var value.

**Pricing/menu logic lives server-side** in
`netlify/functions/create-checkout-session.js` — the flavor list and $11
flat price are defined there and re-validated on every order, so the
browser can never submit a tampered price.

**Order details** (fulfillment type, pickup/delivery date, address, notes)
are attached to each Stripe Checkout Session as metadata, visible in the
Stripe Dashboard under each payment. To get notified automatically when an
order comes in, turn on Stripe's built-in **email notifications for
successful payments** (Dashboard → Settings → Notifications) — no extra
code needed for that.

## Deploying changes

1. Edit files, preview locally (see above).
2. Commit and push to GitHub:
   ```bash
   git add -A
   git commit -m "describe the change"
   git push
   ```
3. Publish to the live site:
   ```bash
   npx netlify-cli deploy --prod --dir=.
   ```

To make step 3 automatic on every push, link the GitHub repo in the Netlify
dashboard: Site settings → Build & deploy → Continuous deployment → Link
repository (one-time, requires authorizing the Netlify GitHub App).

## Still needed

- Farmers market name, location & schedule (see "Visit Us" section and the
  pickup note on the order page)
- Phone number for the footer
- Confirm social handles: Instagram/Facebook `@lumidessert0728`, Rednote `3412329923`
- **`STRIPE_SECRET_KEY` environment variable in Netlify** — checkout returns
  a friendly "payments not configured" message until this is set (see above)
- Delivery fee ($8 flat, free over $50) and service area are placeholders —
  adjust `DELIVERY_FEE_CENTS` / `FREE_DELIVERY_THRESHOLD_CENTS` in
  `netlify/functions/create-checkout-session.js` (and the matching constants
  in `js/order.js`) as needed
