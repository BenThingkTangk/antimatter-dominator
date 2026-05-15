# ΔTOM Brand & Design System — Integration Guide

The canonical ΔTOM brand assets, tokens, CSS components, motion primitives, and
loader live in this repo at `packages/atom-design-system`. The package is
published locally as `@nirmata/atom-design-system` and is consumed by ΔTOM apps
via a `file:` dependency (same pattern as the existing
`@nirmata/dtom-brand-system` package).

> **Brand rule:** the wordmark is always **ΔTOM** — Greek capital Delta
> (U+0394) + `TOM`. Never substitute the Latin letter `A`. Use the SVG assets
> in `packages/atom-design-system/assets/` (`atom-wordmark.svg`,
> `atom-lockup.svg`, `atom-lettermark.svg`, `atom-icon.svg`) wherever the mark
> appears in product surfaces.

## Add to a workspace app

Add the package to the consuming app's `package.json`:

```json
{
  "dependencies": {
    "@nirmata/atom-design-system": "file:./packages/atom-design-system"
  }
}
```

Then `npm install`.

## Importing styles (Vite / bundler)

The aggregate stylesheet pulls tokens, animations, and components in one line.
Import it once near the application root (alongside the existing
`@nirmata/dtom-brand-system/styles` import in `client/src/main.tsx`):

```ts
import "@nirmata/atom-design-system/css";
```

Or pull individual layers:

```ts
import "@nirmata/atom-design-system/tokens.css";
import "@nirmata/atom-design-system/animations.css";
import "@nirmata/atom-design-system/components.css";
```

## Loader (cinematic boot overlay)

ESM (recommended in a Vite app):

```ts
import { ATOMLoader } from "@nirmata/atom-design-system";

ATOMLoader.show({ minMs: 1200 });
// …after first paint / data ready
ATOMLoader.hide();
```

Standalone browser script (no bundler):

```html
<script src="/node_modules/@nirmata/atom-design-system/js/atom-loader.js"></script>
<script>window.ATOMLoader.show();</script>
```

The drop-in HTML overlay lives at
`@nirmata/atom-design-system/loader.html` — copy its markup into the document
shell if you want server-rendered boot art.

## Design tokens

- Runtime CSS variables — `css/atom-tokens.css` (`:root` + `[data-theme="light"]`).
- Figma / tooling source of truth — `tokens/atom.tokens.json` (W3C-style).

Reference tokens directly in component CSS:

```css
.button-primary {
  background: var(--atom-accent-teal);
  color: var(--atom-bg-0);
  border-radius: var(--atom-radius-md);
  transition: var(--atom-motion-fast);
}
```

## ΔTOM rules at a glance

1. **Wordmark.** Always `ΔTOM` with U+0394 Delta. Never `ATOM` with Latin A.
2. **Color.** Dark-first; light is an override theme. Accent teal is reserved
   for the brand `O` ring and primary actions — do not flood backgrounds with
   it.
3. **Motion.** Honour `prefers-reduced-motion`. The animations layer ships the
   media-query guards; do not override them with always-on motion.
4. **Loader.** Use `ATOMLoader` for first-paint transitions over 400ms; keep
   `minMs` ≤ 1500 to avoid feeling artificial.
5. **Assets.** Prefer the SVG marks from `assets/` over rasterised
   reproductions; never recolour the teal `O` ring.

## Local preview

```bash
cd packages/atom-design-system
npm run preview   # serves the package index.html on :4173
```

`index.html` documents every component, dark + light themes, and the loader in
one page — useful as a visual regression reference.

## Relationship to `@nirmata/dtom-brand-system`

The repo already vendors `@nirmata/dtom-brand-system` (React shell, hero,
logo). `@nirmata/atom-design-system` is the lower-level, framework-agnostic
brand kit: tokens, CSS, SVG marks, and the loader. Both can coexist — the
React package depends on the same tokens conceptually and the two are
deliberately consistent.

## Deployment

The package ships as static files (CSS, JS, SVG, JSON, HTML) plus a
`package.json` with `exports`. No build step is required. Vercel deploys the
consuming app as today; the package is resolved at install time via the
`file:` dependency and bundled by Vite, so nothing in `vercel.json` needs to
change.
