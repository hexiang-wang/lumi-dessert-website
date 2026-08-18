# Lumi Dessert — Website

Static marketing site for **Lumi Dessert**, a San Ramon, CA dessert shop
crafting handcrafted, family-friendly tiramisu.

- **Live site:** https://lumi-dessert.netlify.app
- **Source repo:** https://github.com/hexiang-wang/lumi-dessert-website

## Structure

```
index.html          Single-page site (hero, story, flavors, craft, visit, footer)
css/style.css        All styling
js/script.js         Mobile nav toggle + scroll-reveal animation
images/logo.jpg       Lumi logo
images/hero-tiramisu.jpg   Classic tiramisu hero/feature photo
images/source/         Original uploaded brand images
.claude/launch.json   Local dev server config (python http.server on :4173)
```

No build step or dependencies — plain HTML/CSS/JS.

## Local preview

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173

## To edit content

All copy lives directly in `index.html`. Colors and fonts are defined as
CSS variables at the top of `css/style.css` (`:root`).

## Deploying changes

1. Edit files, preview locally (`python3 -m http.server 4173`).
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

- Farmers market name, location & schedule (see "Visit Us" section)
- Phone number for the footer
- Confirm social handles: Instagram/Facebook `@lumidessert0728`, Rednote `3412329923`
