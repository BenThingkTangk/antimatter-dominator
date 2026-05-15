# ΔTOM · Brand & Design System

Production design system for **ΔTOM** by Nirmata Holdings — the enterprise voice AI suite. Dark-first, cinematic, precise.

> **Wordmark:** The brand always reads `ΔTOM` — Greek capital Delta (U+0394) + T + teal O ring + M. **Never** substitute Latin "A".

## What's inside

```
atom-design-system/
├── index.html                     ← one-page usage guide (dark/light, all components, code snippets)
├── README.md
├── package.json                   ← npm-style exports for app imports + preview scripts
├── atom.css                       ← aggregate CSS entrypoint for bundlers
│
├── css/
│   ├── atom-tokens.css            ← all design tokens (dark + light overrides)
│   ├── atom-components.css        ← buttons, tags, cards, badges, forms, header, tabs…
│   └── atom-animations.css        ← keyframes, motion utilities, prefers-reduced-motion
│
├── components/
│   └── atom-loader.html           ← drop-in cinematic boot overlay (markup + style + script)
│
├── js/
│   ├── atom-loader.js             ← standalone browser script (window.ATOMLoader)
│   └── atom-loader.module.js      ← ESM loader entrypoint for app imports
│
├── types/
│   └── index.d.ts                 ← TypeScript declarations for ATOMLoader
│
├── assets/
│   ├── atom-icon.svg              ← orbital mark (favicon-friendly)
│   ├── atom-wordmark.svg          ← ΔTOM wordmark, no icon
│   ├── atom-lockup.svg            ← icon + ΔTOM wordmark
│   └── atom-lettermark.svg        ← Δ alone (avatar / app tile)
│
└── tokens/
    └── atom.tokens.json           ← W3C-style design tokens for Figma Variables
```

## Install

### Package import

Use this folder as a private package in any ATOM app via workspace, Git dependency, private registry, or local file dependency:

```bash
npm install @nirmata/atom-design-system
# or during local integration
npm install ../atom-design-system
```

Import the full CSS system once in your app shell:

```js
import "@nirmata/atom-design-system/css";
```

Or import only the layers you need:

```js
import "@nirmata/atom-design-system/tokens.css";
import "@nirmata/atom-design-system/animations.css";
import "@nirmata/atom-design-system/components.css";
```

Use the ESM loader API in React, Next, Vite, or any modern app:

```js
import { ATOMLoader } from "@nirmata/atom-design-system/loader";

ATOMLoader.init({ duration: 2500, autoStart: true });
```

Import assets and design-token JSON directly:

```js
import atomIconUrl from "@nirmata/atom-design-system/assets/atom-icon.svg";
import tokens from "@nirmata/atom-design-system/tokens.json";
```

### Plain HTML

Drop the three stylesheets into your `<head>`, then load fonts:

```html
<link href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,700,800&f[]=satoshi@300,400,500,700&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet" />

<link rel="stylesheet" href="css/atom-tokens.css" />
<link rel="stylesheet" href="css/atom-animations.css" />
<link rel="stylesheet" href="css/atom-components.css" />
```

Or use the aggregate stylesheet:

```html
<link rel="stylesheet" href="atom.css" />
```

## Theme

```html
<html data-theme="dark">  <!-- canonical -->
<html data-theme="light"> <!-- cream surface -->
```

Toggle at runtime:

```js
document.documentElement.setAttribute('data-theme', 'light');
```

## Loader

Cinematic boot overlay with the ΔTOM reveal and orbital rings. Default duration 2500ms.

```html
<!-- 1. Paste the markup + <style> block from components/atom-loader.html into <body> -->
<!-- 2. Include the script -->
<script src="js/atom-loader.js"></script>
<script>
  ATOMLoader.init({ duration: 2500, autoStart: true });

  // Manually:
  ATOMLoader.show();
  ATOMLoader.hide();
  ATOMLoader.play({ duration: 1200 });
</script>
```

Package import version:

```js
import { ATOMLoader } from "@nirmata/atom-design-system/loader";

ATOMLoader.play({ duration: 2500 });
```

The classic browser script remains available for no-build apps:

```html
<script src="js/atom-loader.js"></script>
```

The module entrypoint is available at `@nirmata/atom-design-system/loader`; the browser IIFE is available at `@nirmata/atom-design-system/loader.browser` for bundlers that need the original global script.

## Tokens (excerpt)

| Token                   | Dark                      | Light       |
|-------------------------|---------------------------|-------------|
| `--atom-bg`             | `#0b0b0c`                 | `#f4f3ef`   |
| `--atom-surface-1..4`   | `#111113` → `#222226`     | cream tiers |
| `--atom-primary`        | `#00c8c8`                 | `#007b7b`   |
| `--atom-text`           | `#e8e8ea`                 | `#14181a`   |
| `--atom-border`         | `rgba(255,255,255,0.08)`  | dark        |
| `--transition-base`     | `180ms cubic-bezier(0.16, 1, 0.3, 1)` |

All tokens documented inline in `css/atom-tokens.css` and machine-readable in `tokens/atom.tokens.json`.

## Components included

Buttons (`.btn`, `.btn--primary`, `.btn--ghost`, `.btn--quiet`), tags (`.tag` + provider variants), status badge with pulse dot, `.arch-node` cards with corner glow, callouts, flow steps, metric displays, animated progress, waveform, signal scan, sticky header with blur/saturate, nav tabs, inputs, textarea, select, checkbox/radio, tabs control, scrollbars, focus-visible ring, skip link.

## Motion catalogue

`atom-pulse-dot`, `atom-reveal-fade`, `atom-reveal-clip`, `atom-orbit-spin`, `atom-orbit-counter`, `atom-glow-bloom`, `atom-particle-orbit`, `atom-loader-sweep`, `atom-ripple`, `atom-counter-tick`, `atom-progress-fill`, `atom-waveform`, `atom-signal-scan`, `atom-hover-glow`, `atom-marquee`. All disabled under `prefers-reduced-motion: reduce`.

## Asset usage

The SVG files in `assets/` ship in their **canonical dark-on-dark** colors (cream text, teal ring). For light/cream surfaces, inline the SVG and override `fill` / `stroke` to the light-mode values, or refer to the dark-vs-light specimens in `index.html`. Inline SVG is also the recommended approach when you need `currentColor` inheritance.

## Brand rules (canonical)

1. Wordmark is **always** `ΔTOM` — Δ is Unicode `U+0394`, never Latin `A`.
2. Δ, T, and M are light cream on dark, near-black on light. The **O** is the teal ring/accent — never Δ.
3. Display family: Cabinet Grotesk 800 (fallback Satoshi, then Inter). Body: Satoshi (fallback Inter).
4. Logo glow only — never drop shadows. Maintain Δ-height clear space on all sides.
5. Dark canonical `#0b0b0c`. Light cream `#f4f3ef`. Adjusted teal `#007b7b` in light mode.
6. Teal is the singular primary accent. Secondary accents (Claude / Hume / Samba / GPT) only on tags, charts, or provider chips.

## Local preview

Any static server works. With Node installed:

```bash
npx serve atom-design-system
# or
python3 -m http.server --directory atom-design-system 8080
```

Or, via the bundled package:

```bash
cd atom-design-system && npm run start
```

## Package validation

Before publishing or linking into an ATOM app, verify the package contents:

```bash
npm run check:package
```

The package exposes these public entrypoints:

| Entrypoint | Purpose |
|------------|---------|
| `@nirmata/atom-design-system/css` | Aggregate CSS: tokens, animations, components |
| `@nirmata/atom-design-system/tokens.css` | CSS custom properties only |
| `@nirmata/atom-design-system/animations.css` | Keyframes and motion utilities |
| `@nirmata/atom-design-system/components.css` | Component classes |
| `@nirmata/atom-design-system/loader` | ESM `ATOMLoader` API |
| `@nirmata/atom-design-system/loader.browser` | Classic browser script for `window.ATOMLoader` |
| `@nirmata/atom-design-system/loader.html` | Drop-in loader markup |
| `@nirmata/atom-design-system/tokens.json` | W3C-style token JSON |
| `@nirmata/atom-design-system/assets/*` | SVG logo assets |

## Conventions for follow-up edits

- **Add tokens** in `css/atom-tokens.css` under the appropriate group block; mirror in `tokens/atom.tokens.json`. Always define a light value when surfaces/colors are involved.
- **Add components** in `css/atom-components.css`. Reference tokens only — no raw hex/rgb in component CSS.
- **Add motion** in `css/atom-animations.css`. Every new keyframe must be a no-op under `prefers-reduced-motion: reduce`.
- **Update the wordmark** — render Δ as Unicode (`U+0394`) in any SVG `<text>`, HTML, or constant. Never `A`.
- **Keep teal singular** — when in doubt, use neutrals + teal. Provider accents are not UI states.
- **Document new components** by appending a specimen to `index.html` with a code snippet.

## License

Internal · Nirmata Holdings.
