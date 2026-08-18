# Lumi Dessert — Website

Static marketing site for **Lumi Dessert**, a San Ramon, CA dessert shop
crafting handcrafted, family-friendly tiramisu.

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

## Still needed

- Farmers market name, location & schedule (see "Visit Us" section)
- Phone number for the footer
- Confirm social handles: Instagram/Facebook `@lumidessert0728`, Rednote `3412329923`
