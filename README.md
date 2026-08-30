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
js/subscribe.js               "Join Our List" signup form submit handler
admin/invoice.html             Internal tool: create & send a custom Stripe Invoice
admin/orders.html               Internal tool: view orders, toggle fulfilled status
js/admin-invoice.js            Passphrase gate + line-item form logic for admin/invoice.html
js/admin-orders.js              Passphrase gate + order list/fulfillment logic for admin/orders.html
netlify/functions/create-checkout-session.js   Server-side Stripe Checkout Session creation
netlify/functions/subscribe.js                 Server-side Brevo signup
netlify/functions/create-invoice.js            Server-side custom Stripe Invoice creation
netlify/functions/list-orders.js               Server-side: list recent orders for admin/orders.html
netlify/functions/mark-fulfilled.js            Server-side: update fulfilled status on PI + Charge
robots.txt                     Blocks /admin/ from search engine indexing
netlify.toml                  Netlify build/functions config
package.json                  Node deps for the serverless functions (stripe)
images/                       Logo, hero photo, original source images
.claude/launch.json           Local dev server configs
```

No frontend build step — plain HTML/CSS/JS. The one Node dependency
(`stripe`) is only used by the checkout function; the subscribe function
calls Brevo's API directly with no extra dependency.

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

## Sales tax (Stripe Tax)

Checkout Sessions and custom invoices both have `automatic_tax: { enabled: true }`
set, with product tax code `txcd_40040000` ("Food for Non-Immediate
Consumption") on tiramisu line items and `txcd_92010001` ("Shipping") on the
delivery fee — both confirmed against Stripe's canonical Tax Codes API. This
code is for cold, take-away food with no utensils provided; California
generally exempts that as grocery-type food, so $0 tax is the expected,
correct result for most orders — not a bug.

**One-time setup, done by the shop owner (in Stripe's Dashboard, not by
Claude):**

1. **Sandbox/test mode and live mode have separate settings** — repeat this
   for both once you're ready to go live.
2. Set your business's **head office address**: https://dashboard.stripe.com/test/settings/tax
   (Stripe Tax refuses to calculate anything without this.)
3. Record your **California Seller's Permit** as a registration: same Tax
   settings page → Registrations → Add registration → California. This is
   just telling *Stripe* about a permit you already got from CDTFA — Stripe
   doesn't calculate or collect tax anywhere you haven't added a
   registration for, even if `automatic_tax` is on.
4. If you ever sell something that genuinely is taxable (hot drinks, merch,
   etc.), give it a different product tax code — see
   `netlify/functions/create-checkout-session.js` and
   `netlify/functions/create-invoice.js`.

## Internal admin tools

Two passphrase-gated pages, not linked from the public site and blocked
from search indexing via `robots.txt`:

- **`/admin/invoice.html`** — for orders that don't fit the fixed
  $11-per-flavor online cart (catering, bulk, custom pricing). Enter a
  customer, address, and free-form line items; it creates a Stripe
  Customer + Invoice and finalizes it, which sends the customer a payable
  hosted invoice link by email.
- **`/admin/orders.html`** — lists the last 50 successful orders with their
  fulfillment metadata, and a one-click **Mark Fulfilled** button per order.

Both are gated by the same passphrase (`ADMIN_SECRET` env var) — Claude
generated and set this one directly since it's an internal access key for
tools on your own site, not a third-party account credential. The
passphrase itself is deliberately **not** written here (this file is in a
public repo) — it was given to the shop owner directly in chat. Rotate it
any time with `npx netlify-cli env:set ADMIN_SECRET <new-value>` and
redeploy; the old passphrase stops working immediately.

**Why "Mark Fulfilled" updates two things per order:** every successful
payment produces both a PaymentIntent *and* a Charge object — Stripe copies
metadata from one to the other only once, at charge creation, with no
ongoing sync. Editing metadata by hand in the Dashboard only touches
whichever tab ("Payment intent" or "Latest charge") you happen to be on,
which silently desyncs the two and made Dashboard metadata search behave
inconsistently. `netlify/functions/mark-fulfilled.js` updates both objects
together so this can't happen — use the Orders tool for this instead of
editing metadata by hand in the Dashboard.

**Invoicing notes:**
- **Verify this Dashboard setting is on**, or invoices are created but never
  emailed: Settings → Billing → *Subscriptions and emails* →
  "Email finalized invoices to customers." This wasn't tested end-to-end
  (the test order used a fake email address) — only that the invoice itself
  is created correctly and the hosted payment page works.
- Requires the customer's full address (state + ZIP) up front, since unlike
  Checkout, invoices don't collect an address interactively before tax
  calculates.
- All line items use the same food tax code as the online cart — for a
  non-food invoice item, use the Stripe Dashboard's own invoice creator
  instead, which supports per-line tax codes.

## Email list & marketing emails

The "Get Sweet Updates" form (homepage + order confirmation page) adds
subscribers straight into a **Brevo** list via
`netlify/functions/subscribe.js`. This is single opt-in — submitting the
form subscribes someone immediately, no confirmation email required.

Brevo was chosen over Mailchimp because its free plan is genuinely
free forever (unlimited contacts, 300 emails/day), where Mailchimp's free
tier is now capped at 250 contacts / 500 emails per month and new signups
are often funneled into a 14-day paid trial first.

**Actually composing and sending marketing emails ("newsletters") is done
in the Brevo dashboard, not on this site** — Brevo handles scheduling,
unsubscribe links, and legal compliance (CAN-SPAM) for you. This site's
only job is feeding new signups into your list.

**One-time setup, done by the shop owner (not by Claude — API keys must
never be pasted into chat):**

1. Create a free Brevo account at https://onboarding.brevo.com/account/register
   (skip/decline any prompt to start a paid trial — the free plan needs no
   trial or credit card).
2. Create a **List** under Contacts → Lists — e.g. "Lumi Dessert Subscribers."
   Note its numeric **List ID** (shown next to the list name).
3. Get your **API key**: click your account name (top right) → SMTP & API →
   API Keys → Generate a new API key.
4. In the Netlify dashboard — https://app.netlify.com/projects/lumi-dessert/settings/env —
   add two environment variables:
   - `BREVO_API_KEY` = the key from step 3
   - `BREVO_LIST_ID` = the numeric ID from step 2
5. Redeploy (`npx netlify-cli deploy --prod --dir=.`) and submit a test
   email on the site — it should appear in your Brevo list within a few
   seconds.
6. To send a newsletter: in Brevo, go to Campaigns → Create a campaign,
   write it, and hit Send (or Schedule). That part is entirely inside
   Brevo's UI.

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
- Confirm social handles: Instagram/Facebook `@lumidessert0728`, Rednote `3412329923`
- **`STRIPE_SECRET_KEY` environment variable in Netlify** — checkout returns
  a friendly "payments not configured" message until this is set (see above)
- **Verify "Email finalized invoices to customers" is on** in Stripe
  Settings → Billing, or the `/admin/invoice.html` tool creates invoices
  that never actually reach the customer's inbox (see Invoicing section)
- **`BREVO_API_KEY` and `BREVO_LIST_ID` environment variables in Netlify** —
  the signup form returns a friendly "not connected yet" message until
  these are set (see above)
- Delivery fee ($8 flat, free over $50) and service area are placeholders —
  adjust `DELIVERY_FEE_CENTS` / `FREE_DELIVERY_THRESHOLD_CENTS` in
  `netlify/functions/create-checkout-session.js` (and the matching constants
  in `js/order.js`) as needed
