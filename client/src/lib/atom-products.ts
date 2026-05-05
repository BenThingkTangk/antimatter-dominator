/**
 * Canonical ATOM product roster — single source of truth for every dropdown.
 *
 * IMPORTANT: We do NOT merge with the API /products list anymore. The API list
 * was producing duplicate options ("ATOM Enterprise AI" twice, etc.) and the
 * roster the user actually wants pitched is fixed:
 *
 *   ATOM Platform, Vidzee, MoleculeAI, ClinixAI, Red Team ATOM, Custom Product
 *
 * "Custom Product" toggles a free-text input where the user types whatever
 * (PhysioPS, Akamai, Five9, Segway, anything). The free-text value is what
 * gets sent to the API as the `product` label.
 */

export interface AtomProductOption {
  value: string;
  label: string;
  /** Used by the API for RAG lookup. For non-custom items, equals the slug. */
  ragSlug?: string;
}

export const ATOM_PRODUCTS: AtomProductOption[] = [
  { value: "atom-platform",   label: "ATOM Platform",   ragSlug: "antimatter-ai" },
  { value: "vidzee",          label: "Vidzee",          ragSlug: "vidzee" },
  { value: "moleculeai",      label: "MoleculeAI",      ragSlug: "moleculeai" },
  { value: "clinix-ai",       label: "ClinixAI",        ragSlug: "clinix-ai" },
  { value: "red-team-atom",   label: "Red Team ATOM",   ragSlug: "red-team-atom" },
  { value: "custom",          label: "Custom Product" },
];

export const ATOM_PRODUCTS_INCL_ALL: AtomProductOption[] = [
  { value: "all", label: "All Products" },
  ...ATOM_PRODUCTS,
];

/** Resolves the label → API product string. For "custom", returns the free-text override. */
export function resolveProductLabel(value: string, customText?: string): string {
  if (value === "custom" && customText && customText.trim()) {
    return customText.trim();
  }
  return ATOM_PRODUCTS.find((p) => p.value === value)?.label || value;
}

/** True when the user picked "Custom Product" so the UI should reveal the text input. */
export function isCustom(value: string | null | undefined): boolean {
  return value === "custom";
}
