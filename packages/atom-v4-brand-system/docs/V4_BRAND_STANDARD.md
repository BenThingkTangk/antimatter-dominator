# ΔTOM Brand Standard — V4

**Package:** `@nirmata/atom-v4-brand-system` · **Version:** 4.0.0
**Status:** Canonical. V4 supersedes all prior ATOM brand/experience packages.

---

## 1. The one rule

> **The visual branded wordmark is `ΔTOM`, never Latin `ATOM`.**
> The visible "A" is **always** a Greek capital **Delta (Δ)**.

- Δ, T and M are **white** `#FFFFFF`.
- The **O** is the brand **cyan ring** `#39BFC0`.
- "ATOM" may be used **only as product-family prose** ("the ATOM platform", "ATOM agents"). Wherever the name appears as a logo, badge, avatar, title lockup, splash, or HUD label, render the Delta geometry.

**Product-name exception — ATOM VR.** The Meta/Oculus product may be titled *ATOM VR* in store listings and OS titles. Even there, the **visual lockup keeps Delta geometry** — render the badge as **ΔTOM VR**. See `VR_OCULUS_META_GUIDE.md`.

---

## 2. The canonical lockup

A multi-orbit cyan atom with a glowing nucleus on the **left**, the **ΔTOM** wordmark on the **right**, on a single cap height, against a **black / dark field**.

```
( atom icon )  Δ T O M
   cyan orbits   ^white  ^cyan O  ^white
   white nucleus
```

| Element        | Spec |
| -------------- | ---- |
| Orbits         | 3 ellipses at 0° / 60° / 120°, stroke `#39BFC0` |
| Nucleus        | radial white → `#c8f3f3` → cyan halo; hot white core |
| Δ              | hollow triangle, sharp apex, flat baseline, white |
| T              | geometric block, white |
| O              | cyan ring (matches orbit stroke), `#39BFC0` |
| M              | two verticals + central V, white |

**Assets:** `assets/atom-v4-lockup.svg`, `atom-v4-lockup-animated.svg`, `atom-v4-orbital.svg`, `atom-v4-icon.svg`, `atom-v4-wordmark.svg`, `atom-v4-lettermark.svg`.

---

## 3. Color

| Role        | Token              | Hex       |
| ----------- | ------------------ | --------- |
| Brand cyan  | `--atom-cyan`      | `#39BFC0` |
| Cyan bright | `--atom-cyan-bright` | `#5BD9DA` |
| White       | `--atom-white`     | `#FFFFFF` |
| Black field | `--atom-black`     | `#050708` |
| Surface     | `--atom-surface`   | `#0B0F11` |
| Text        | `--atom-text`      | `#E7EDEE` |

**Discipline:** black + cyan + white only. Cyan is reserved for the O-ring, orbits, live data, focus, and the single primary action per screen. Do not introduce secondary accent hues.

Contrast: white on `#050708` ≈ 19:1; cyan `#39BFC0` on black ≈ 8:1 (passes WCAG AA for text and UI).

---

## 4. Typography

- **UI / body:** Inter (web/PDF) — fallback Satoshi, system-ui.
- **Mono / data:** JetBrains Mono.
- The wordmark is **geometry, not a font** — never re-type ΔTOM in a typeface and call it the logo. Use the SVG.
- Eyebrows / labels: uppercase, `letter-spacing: 0.18em`.

---

## 5. Logo sizing (restrained)

| Context           | Size |
| ----------------- | ---- |
| Nav lockup height | **28–34 px** |
| Loader / splash width | **220–320 px** |
| Hero max width    | **420 px** |

Clear space around the lockup ≥ the height of the orbital icon. Never stretch, recolor letterforms, swap the O fill, or place on busy / light backgrounds without a dark plate.

---

## 6. Motion

- Orbits rotate **slowly: 28 s linear**. The nucleus **breathes: 8 s ease-in-out**.
- This is premium ambient motion — **never a fast spinner**.
- The **wordmark never animates**; only the orbital icon moves.
- Always honor `prefers-reduced-motion: reduce` → animation pauses to the static frame.

---

## 7. Surfaces & components

- **Field:** true black with faint cyan radial glow + optional dim grid overlay (command-center feel).
- **Glass panels:** `--atom-glass` with a 1px cyan-tinted rim and soft shadow.
- **Buttons:** primary = cyan gradient pill on dark text; ghost = hairline border.
- See `css/atom-v4.css` for the full component set and `react/index.tsx` for components.

---

## 8. Don'ts

- ❌ Latin "A" in the wordmark.
- ❌ Filling the O solid, or recoloring Δ/T/M to cyan.
- ❌ Light backgrounds without a dark plate.
- ❌ Rainbow gradients, drop shadows on letterforms, fast spin, skew/stretch.
- ❌ Re-typing the wordmark in any typeface as a substitute for the SVG.

---

## 9. Where V4 applies

Web apps · dashboards · marketing · mobile apps · AI agent chats · **VR/Meta/Oculus/WebXR**. See `README.md` for per-surface application and `VR_OCULUS_META_GUIDE.md` for spatial.
