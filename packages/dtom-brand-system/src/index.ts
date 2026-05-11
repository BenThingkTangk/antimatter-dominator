/**
 * @nirmata/dtom-brand-system
 * ΔTOM Brand System — React/Next.js package
 *
 * Canonical standard for all ATOM apps:
 *   Strategic standard:     ATOM_Brand_Design_System_v2.md
 *   Implementation source:  @nirmata/dtom-brand-system (this package)
 *
 * Usage:
 *   import '@nirmata/dtom-brand-system/styles'; // import CSS once at root layout
 *   import { DtomBrandShell, DtomLogo, DtomBootLoader, DtomHero, DtomPinnedKeynote, MissionDossier } from '@nirmata/dtom-brand-system';
 *
 * Domain rule: Domain literal AtomDominator.com / ATOMDOMINATOR.COM must remain as-is.
 * All visible brand text uses ΔTOM (never plain ATOM in product UI).
 */

// ─── Shell / Provider ───────────────────────────────────────────────────────
export {
  DtomBrandShell,
  DtomBrandProvider,    // deprecated alias — use DtomBrandShell
  useDtomBrand,
  type DtomBrandContextValue,
  type DtomBrandShellProps,
} from './components/DtomBrandShell';

// ─── Logo ───────────────────────────────────────────────────────────────────
export {
  DtomLogo,
  type DtomLogoProps,
  type DtomLogoSize,
} from './components/DtomLogo';

// ─── Boot Loader ────────────────────────────────────────────────────────────
export {
  DtomBootLoader,
  type DtomBootLoaderProps,
} from './components/DtomBootLoader';

// ─── Hero ────────────────────────────────────────────────────────────────────
export {
  DtomHero,
  type DtomHeroProps,
  type DtomHeroCta,
} from './components/DtomHero';

// ─── Pinned Keynote ──────────────────────────────────────────────────────────
export {
  DtomPinnedKeynote,
  type DtomPinnedKeynoteProps,
} from './components/DtomPinnedKeynote';

// ─── Mission Dossier ─────────────────────────────────────────────────────────
export {
  MissionDossier,
  type MissionDossierProps,
} from './components/MissionDossier';

// ─── Data ────────────────────────────────────────────────────────────────────
export {
  salesDominatorChapters,
  type SalesDominatorChapter,
} from './data/salesDominatorChapters';
