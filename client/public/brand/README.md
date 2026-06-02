# ATOM Brand Kit — `/brand`

The reusable, static-safe brand package for every ATOM Vercel app. Drop this `brand/` directory into any ATOM project and import the two stylesheets to convert that app to the ATOM Brand Standard.

**ATOM is dark-only by design. Do not add a light theme or theme toggle.**

## Contents

| File | Purpose |
| --- | --- |
| `atom-tokens.css` | Single source of truth. All design tokens as CSS custom properties (`--atom-*`). Import first. |
| `atom-components.css` | Drop-in component primitives (`.atom-btn`, `.atom-panel`, `.atom-badge`, `.atom-table`, `.atom-toast`, `.atom-skeleton`, `.atom-loader`, SalesOS-safe rows, agent shell, voice meter, intent bars, …). Import second. |
| `atom-loader.svg` | The canonical ATOM loading mark — refined spinning orbital cage + breathing nucleus. |
| `atom-brand.json` | Machine-readable brand manifest (colors, type, motion, voice, governance). Consume in build tools, Figma sync, or design-token pipelines. |
| `README.md` | This file. |

## Quick start (any static or Vercel app)

1. Copy the `brand/` directory into your app's public/static root (e.g. `public/brand/` for Next.js, project root for a plain static app).
2. Add to your `<head>`, in this order:

```html
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&f[]=cabinet-grotesk@400,500,700,800&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap" rel="stylesheet">

<link rel="stylesheet" href="/brand/atom-tokens.css">
<link rel="stylesheet" href="/brand/atom-components.css">
```

3. Mark your app root so component styles + focus/selection apply:

```html
<body data-atom-brand>
```

4. (Optional) Use the loader during boot:

```html
<img src="/brand/atom-loader.svg" width="120" height="120" alt="ATOM loading" />
```

## Using tokens directly

Reference tokens anywhere in your own CSS — they cascade from `:root`:

```css
.my-card {
  background: var(--atom-surface-2);
  border: 1px solid var(--atom-border);
  border-radius: var(--atom-radius-lg);
  color: var(--atom-text);
  box-shadow: var(--atom-shadow-md);
}
.my-cta { color: var(--atom-text-inverse); background: var(--atom-primary); }
```

## React / Next.js

```jsx
// app/layout.tsx
import "/public/brand/atom-tokens.css";
import "/public/brand/atom-components.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body data-atom-brand>{children}</body>
    </html>
  );
}
```

You can also import `atom-brand.json` for programmatic access to the palette and motion tokens.

## Rules

- **Cyan is the only signal color.** Coral, gold, and iris are state/data accents only — never decoration or gradients-for-vibes.
- **No light mode.** `color-scheme: dark` is set in the tokens.
- **Honor `prefers-reduced-motion`** — the tokens collapse motion durations automatically.
- **Namespacing:** every class is `atom-` prefixed and every token is `--atom-` prefixed, so the kit will not collide with existing app styles.
- **SalesOS safety:** import tokens first and apply `.atom-*` components selectively. Do not globally override existing sidebars, row heights, dense tables, form controls, campaign lists, or bottom-right nucleus controls.
- **Agent GenUI:** embedded ATOM agents should expose conversation, tool telemetry, evidence, buyer intent, sentiment, confidence, and next-best-action in one compact shell.

## Versioning

Semantic versioning, tracked in `atom-brand.json` (`version`). Current: **2.1.0**.
- **MAJOR** — token renames/removals or breaking component API changes.
- **MINOR** — additive tokens/components.
- **PATCH** — fixes that don't change the public token surface.
