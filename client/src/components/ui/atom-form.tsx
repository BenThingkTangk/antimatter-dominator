/**
 * Shared ATOM form-system primitives.
 *
 * Single source of truth for every ATOM module (Pitch, Objection Handler,
 * Market Intent, Prospect, Dial, Campaign, WarBook, War Room). Every
 * module passes its own `accent` (the module's native Tailwind color
 * family — violet / amber / emerald / cyan / rose / indigo) and inherits
 * identical structure, height, padding, typography, hover, and disabled
 * states.
 *
 * Baseline reference: commit e2d740c (Apr 15 2026 5:20 PM EST).
 *  - Flat solid CTA fill, no glow shadow, no thick border
 *  - bg-white/[0.03] form fields with border-white/10
 *  - Uppercase tracking-wider muted labels
 *  - Rounded-full hairline pill chips
 *  - Selected chip = solid accent fill
 */
import * as React from "react";

import { cn } from "@/lib/utils";

// ─── Module accent palette ────────────────────────────────────────────────
// Each module owns one of these. NEVER mix more than one per module.
export type AtomAccent =
  | "violet"   // Pitch
  | "amber"    // Objection Handler
  | "emerald"  // Market Intent
  | "cyan"     // Prospect
  | "rose"     // Campaign
  | "indigo"   // WarBook
  | "teal";    // Aletheia / fallback

// ─── Config card ──────────────────────────────────────────────────────────
export interface AtomConfigCardProps {
  eyebrow?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Configuration card — the dark surface that wraps a form column.
 *
 * @example
 * <AtomConfigCard eyebrow="Configuration">…</AtomConfigCard>
 */
export function AtomConfigCard({
  eyebrow,
  right,
  className,
  children,
}: AtomConfigCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.07] bg-[#111113] p-5 space-y-4",
        className
      )}
    >
      {(eyebrow || right) && (
        <div className="flex items-center justify-between">
          {eyebrow ? (
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider">
              {eyebrow}
            </h2>
          ) : (
            <span />
          )}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Field label ──────────────────────────────────────────────────────────
export interface AtomLabelProps {
  optional?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Standard form label — uppercase, tracking-wider, muted gray.
 *
 * @example
 * <AtomLabel>Company Name<span> (optional)</span></AtomLabel>
 */
export function AtomLabel({
  optional,
  htmlFor,
  className,
  children,
}: AtomLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider",
        className
      )}
    >
      {children}
      {optional ? (
        <span className="text-white/20 normal-case ml-1">(optional)</span>
      ) : null}
    </label>
  );
}

// ─── Field wrapper (label + control + helper) ─────────────────────────────
export interface AtomFieldProps {
  label?: string;
  optional?: boolean;
  helper?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps a label + control. Use for every field on every module.
 *
 * @example
 * <AtomField label="Company Name" optional>
 *   <Input className="atom-input" value={…} onChange={…} />
 * </AtomField>
 */
export function AtomField({
  label,
  optional,
  helper,
  htmlFor,
  className,
  children,
}: AtomFieldProps) {
  return (
    <div className={cn("", className)}>
      {label ? (
        <AtomLabel htmlFor={htmlFor} optional={optional}>
          {label}
        </AtomLabel>
      ) : null}
      {children}
      {helper ? (
        <p className="mt-1.5 text-[11px] text-white/30">{helper}</p>
      ) : null}
    </div>
  );
}

// ─── Field classNames (Tailwind strings the caller adds to native shadcn) ──
/** Class string for Input / Select trigger / Textarea — identical on every page. */
export const ATOM_FIELD_CLASS =
  "bg-white/[0.03] border-white/10 hover:border-white/20 focus-visible:border-white/30 text-sm";

// ─── Tone chip / pill ─────────────────────────────────────────────────────
const ACTIVE_CHIP: Record<AtomAccent, string> = {
  violet:
    "bg-violet-600 border-violet-500 text-white",
  amber:
    "bg-amber-500 border-amber-400 text-black",
  emerald:
    "bg-emerald-500 border-emerald-400 text-black",
  cyan:
    "bg-cyan-500 border-cyan-400 text-black",
  rose:
    "bg-rose-500 border-rose-400 text-white",
  indigo:
    "bg-indigo-600 border-indigo-500 text-white",
  teal:
    "bg-teal-500 border-teal-400 text-black",
};

export interface AtomChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  accent?: AtomAccent;
}

/**
 * Tone / quick-select / pill chip. Single source of truth — every module
 * passes only `active` + `accent` and inherits identical hairline pill
 * styling, identical height, identical typography, identical hover.
 *
 * @example
 * <AtomChip active={tone === "Casual"} accent="violet" onClick={…}>
 *   Casual
 * </AtomChip>
 */
export const AtomChip = React.forwardRef<HTMLButtonElement, AtomChipProps>(
  (
    { active, accent = "violet", className, children, type = "button", ...props },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      data-active={active ? "true" : "false"}
      className={cn(
        "text-[11px] px-3 py-1 rounded-full border font-medium transition-all",
        active
          ? ACTIVE_CHIP[accent]
          : "bg-transparent border-white/10 text-white/60 hover:border-white/20 hover:text-white/80",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
AtomChip.displayName = "AtomChip";

/** Chip group wrapper — wraps a row of <AtomChip>. */
export function AtomChipGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>{children}</div>
  );
}

// ─── Choice row (icon + title + description) ──────────────────────────────
const ACTIVE_ROW: Record<AtomAccent, string> = {
  violet:
    "bg-violet-500/10 border-violet-500/30 text-white",
  amber:
    "bg-amber-500/10 border-amber-500/30 text-white",
  emerald:
    "bg-emerald-500/10 border-emerald-500/30 text-white",
  cyan:
    "bg-cyan-500/10 border-cyan-500/30 text-white",
  rose:
    "bg-rose-500/10 border-rose-500/30 text-white",
  indigo:
    "bg-indigo-500/10 border-indigo-500/30 text-white",
  teal:
    "bg-teal-500/10 border-teal-500/30 text-white",
};

const ICON_ACTIVE: Record<AtomAccent, string> = {
  violet: "text-violet-300",
  amber: "text-amber-300",
  emerald: "text-emerald-300",
  cyan: "text-cyan-300",
  rose: "text-rose-300",
  indigo: "text-indigo-300",
  teal: "text-teal-300",
};

export interface AtomChoiceRowProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  accent?: AtomAccent;
  icon: React.ReactNode;
  title: string;
  description?: string;
}

/**
 * Choice row — icon + title + description (used by Pitch Type, Analysis
 * Type, etc.). Shared structure across modules.
 *
 * @example
 * <AtomChoiceRow
 *   active={pitchType === "Email"}
 *   accent="violet"
 *   icon={<Mail className="w-3.5 h-3.5" />}
 *   title="Email Intro"
 *   description="Cold outreach that gets replies"
 *   onClick={…}
 * />
 */
export const AtomChoiceRow = React.forwardRef<
  HTMLButtonElement,
  AtomChoiceRowProps
>(
  (
    {
      active,
      accent = "violet",
      icon,
      title,
      description,
      className,
      type = "button",
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      data-active={active ? "true" : "false"}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all border",
        active
          ? ACTIVE_ROW[accent]
          : "bg-transparent border-transparent text-white/65 hover:bg-white/[0.03]",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
          active ? ICON_ACTIVE[accent] : "text-white/40"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium">{title}</span>
        {description ? (
          <span className="block text-[10px] text-white/40 mt-0.5">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  )
);
AtomChoiceRow.displayName = "AtomChoiceRow";

// ─── Primary CTA ──────────────────────────────────────────────────────────
const CTA_BG: Record<AtomAccent, string> = {
  violet: "bg-violet-600 hover:bg-violet-500 text-white",
  amber: "bg-amber-500 hover:bg-amber-400 text-black",
  emerald: "bg-emerald-500 hover:bg-emerald-400 text-black",
  cyan: "bg-cyan-500 hover:bg-cyan-400 text-black",
  rose: "bg-rose-500 hover:bg-rose-400 text-white",
  indigo: "bg-indigo-600 hover:bg-indigo-500 text-white",
  teal: "bg-teal-500 hover:bg-teal-400 text-black",
};

export interface AtomCtaProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  accent?: AtomAccent;
}

/**
 * Primary CTA — flat solid accent fill, NO glow, NO thick border. Matches
 * the April 15 6:28 PM EST baseline (commit e2d740c) exactly. Every module's
 * primary action button uses this component with only the `accent` prop
 * differing.
 *
 * @example
 * <AtomCta accent="violet" onClick={…} disabled={…}>
 *   <Sparkles className="w-4 h-4" />Generate Pitch
 * </AtomCta>
 */
export const AtomCta = React.forwardRef<HTMLButtonElement, AtomCtaProps>(
  (
    { accent = "violet", className, children, type = "button", ...props },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "w-full h-10 inline-flex items-center justify-center gap-2 rounded-md",
        "text-sm font-medium transition-all",
        CTA_BG[accent],
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
AtomCta.displayName = "AtomCta";
