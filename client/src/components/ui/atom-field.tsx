import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared label + helper-text pair used by every ATOM module form.
 * Renders the AntimatterAI uppercase eyebrow label, optional "(optional)"
 * suffix, plus children control. Keeps every screen visually identical.
 *
 * @example
 * <AtomField label="Company Name" optional>
 *   <Input value={...} onChange={...} />
 * </AtomField>
 */
export interface AtomFieldProps {
  label: string;
  optional?: boolean;
  helper?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function AtomField({
  label,
  optional,
  helper,
  htmlFor,
  className,
  children,
}: AtomFieldProps) {
  return (
    <div className={cn("atom-field-group", className)}>
      <label className="atom-field-label" htmlFor={htmlFor}>
        {label}
        {optional ? <span className="atom-optional">(optional)</span> : null}
      </label>
      {children}
      {helper ? <span className="atom-helper-text">{helper}</span> : null}
    </div>
  );
}

/**
 * Configuration card wrapper — pure CSS shell with an optional eyebrow header.
 *
 * @example
 * <AtomConfigCard eyebrow="Configuration">…</AtomConfigCard>
 */
export interface AtomConfigCardProps {
  eyebrow?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function AtomConfigCard({
  eyebrow,
  right,
  className,
  children,
}: AtomConfigCardProps) {
  return (
    <div className={cn("atom-config-card", className)}>
      {(eyebrow || right) && (
        <div className="flex items-center justify-between">
          {eyebrow ? <h2 className="atom-section-eyebrow">{eyebrow}</h2> : <span />}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Tone / persona / generic single-select pill chip.
 * Caller is responsible for state — this is a presentational button.
 *
 * @example
 * <AtomChip active={tone === "Casual"} onClick={() => setTone("Casual")}>
 *   Casual
 * </AtomChip>
 */
export interface AtomChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const AtomChip = React.forwardRef<HTMLButtonElement, AtomChipProps>(
  ({ active, className, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      data-active={active ? "true" : "false"}
      className={cn("atom-tone-chip", className)}
      {...props}
    >
      {children}
    </button>
  )
);
AtomChip.displayName = "AtomChip";

/**
 * Group wrapper for AtomChip rows.
 */
export function AtomChipGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("atom-chip-group", className)}>{children}</div>;
}

/**
 * Choice row — icon + title + description (used by Pitch Type, etc.).
 * Caller wraps in a list/div with vertical spacing.
 *
 * @example
 * <AtomChoiceRow
 *   active={pitchType === "Email"}
 *   icon={<Mail className="w-4 h-4" />}
 *   title="Email Intro"
 *   description="Cold outreach that gets replies"
 *   onClick={() => setPitchType("Email")}
 * />
 */
export interface AtomChoiceRowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon: React.ReactNode;
  title: string;
  description?: string;
}

export const AtomChoiceRow = React.forwardRef<HTMLButtonElement, AtomChoiceRowProps>(
  ({ active, icon, title, description, className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      data-active={active ? "true" : "false"}
      className={cn("atom-choice-row", className)}
      {...props}
    >
      <span className="atom-choice-row__icon">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="atom-choice-row__title block">{title}</span>
        {description ? (
          <span className="atom-choice-row__desc block">{description}</span>
        ) : null}
      </span>
    </button>
  )
);
AtomChoiceRow.displayName = "AtomChoiceRow";

/**
 * Primary CTA button.
 * Spread any <button> props; use `loading` to show a spinner state.
 *
 * @example
 * <AtomCta onClick={…} disabled={!canGenerate}>
 *   <Sparkles className="w-4 h-4" /> Generate Pitch
 * </AtomCta>
 */
export interface AtomCtaProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const AtomCta = React.forwardRef<HTMLButtonElement, AtomCtaProps>(
  ({ className, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn("atom-cta", className)}
      {...props}
    >
      {children}
    </button>
  )
);
AtomCta.displayName = "AtomCta";
