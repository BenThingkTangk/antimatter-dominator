# ΔTOM Brand / Experience System — V4

`@nirmata/atom-v4-brand-system` · **v4.0.0**

The canonical **ΔTOM** identity: a **black / dark field**, a **cyan multi-orbit atom** with a **glowing nucleus** on the left, and the **ΔTOM** wordmark on the right — Δ, T, M in **white**, the **O** in brand **cyan `#39BFC0`**. V4 is a clean, self-contained deliverable that shows what the brand looks like *and* applies it across web, mobile, AI agents, and **VR on Meta / Oculus**.

> **Hard rule:** the visual branded wordmark is **ΔTOM** (Greek Delta), never Latin "ATOM". Use "ATOM" only as product-family prose. (Exception: the *ATOM VR* product name — see VR guide.)

---

## What's inside

```
atom-v4-brand-system/
├─ index.html                  # polished showcase webapp (open this first)
├─ css/atom-v4.css             # tokens · components · motion · VR/spatial rules
├─ js/atom-v4.js               # orbit animation, loader demo, theme toggle
├─ react/index.tsx             # ATOMV4Lockup, Loader, Hero, AppShell, MobileSplash, VRPanel, AgentBadge
├─ assets/                     # canonical SVGs + VR-safe SVG/PNG (1024/2048)
└─ docs/                       # V4_BRAND_STANDARD · VR_OCULUS_META_GUIDE · APP_ROLLOUT_CHECKLIST
```

### Preview

```bash
npx serve .          # or: python3 -m http.server 4321
# open http://localhost:4321
```

The showcase walks through: canonical lockup, loaders/splash, web header/dashboard, marketing hero, mobile splash/shell, **VR/Meta/Oculus spatial branding**, and **AI agent chat** branding.

---

## Apply it

### Web apps
1. `import "@nirmata/atom-v4-brand-system/css/atom-v4.css";` (or link `css/atom-v4.css`).
2. Add `class="atom-v4"` to `<body>`.
3. Nav lockup at **28–34px** via `assets/atom-v4-lockup.svg`. Loader **220–320px**, hero **≤420px**.
4. Add `<script src="js/atom-v4.js">` and use `data-atom-orbit="120"` placeholders for live orbits; `ATOMV4.runLoaderDemo({target:'#splash'})` for splash.
5. React:
   ```tsx
   import { ATOMV4Lockup, ATOMV4AppShell, ATOMV4Loader } from "@nirmata/atom-v4-brand-system";
   <ATOMV4Lockup variant="nav" />
   ```

### Mobile apps
- Splash: orbital icon leads, ΔTOM wordmark follows (`ATOMV4MobileSplash`).
- App icon: `assets/atom-v4-icon.svg` on a dark rounded tile.
- Tab bar: cyan only for the active tab.

### AI agent chats
- Branded agent names render the Delta: **ΔTOM** (`ATOMV4AgentBadge label="Assistant"`).
- Orbital icon is the avatar; the breathing nucleus signals "thinking".

### VR apps (Meta / Oculus / WebXR)
- Use the **emissive** mark and **dark-glass world panel** assets; apply as **unlit/emissive** textures.
- Keep the brand in the central foveal cone, ~1.5 m away, wordmark ≥ 1.5° angular height.
- Full guidance (Unity / Unreal / WebXR, materials, contrast, sizing, foveation, comfort, transparent PNG, placement): **`docs/VR_OCULUS_META_GUIDE.md`**.
- *ATOM VR* product title is allowed in store/prose; the on-surface badge still renders **ΔTOM VR**.

---

## Assets

| File | Purpose |
| ---- | ------- |
| `atom-v4-lockup.svg` / `-animated.svg` | Full lockup (static / 28s orbit, 8s breathe) |
| `atom-v4-orbital.svg`, `atom-v4-icon.svg` | Orbital mark / app icon |
| `atom-v4-wordmark.svg`, `atom-v4-lettermark.svg` | ΔTOM wordmark / Δ lettermark |
| `atom-v4-vr-emissive.svg` + `-1024/-2048.png` | Emissive VR mark (transparent) |
| `atom-v4-vr-panel.svg` + `-2048.png` | World-space dark-glass panel |
| `atom-v4-vr-splash.svg` + `-1024/-2048.png` | VR entry / loading splash |

Re-export PNGs: `npm run export:png` (requires `cairosvg`).

---

## Docs

- **`docs/V4_BRAND_STANDARD.md`** — the rules: wordmark, color, type, sizing, motion, don'ts.
- **`docs/VR_OCULUS_META_GUIDE.md`** — spatial application for Meta/Oculus/WebXR/Unity/Unreal.
- **`docs/APP_ROLLOUT_CHECKLIST.md`** — per-surface sign-off checklist.

---

## Brand at a glance

- Cyan `#39BFC0` · White `#FFFFFF` · Black `#050708`
- Motion: orbit 28s linear, nucleus 8s breathe, reduced-motion safe
- Sizing: nav 28–34px · loader 220–320px · hero ≤420px
- Dark-first, command-center, glass, subtle motion

© Nirmata. V4 supersedes all prior ATOM brand packages.
