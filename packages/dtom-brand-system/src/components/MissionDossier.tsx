'use client';

import React, {
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';

/**
 * MissionDossier
 *
 * Accessible classified-intel dialog overlay for ΔTOM Sales Dominator module
 * screenshots. Displays the full product screenshot, module title, mission
 * code, score, capability list, and a caption.
 *
 * Accessibility:
 * - role="dialog" + aria-modal="true"
 * - Focus is trapped inside the dialog while open
 * - Escape key closes the dialog
 * - Trigger element ref is accepted for focus return on close
 * - aria-labelledby pointing to the dialog title
 * - Background scroll is locked while open
 *
 * @example
 * <MissionDossier
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   title="ΔTOM War Room"
 *   missionCode="WAR-03-COMMAND"
 *   score={97}
 *   imageSrc="/dtom-assets/sales-dominator/war-room.jpg"
 *   capabilities={['Command Center', 'Intel Analyzer', '...']}
 *   triggerRef={buttonRef}
 * />
 */

export interface MissionDossierProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Module title, e.g. "ΔTOM War Room" */
  title: string;
  /** Mission code label */
  missionCode: string;
  /** Module score 0-100 */
  score?: number;
  /** Chapter number */
  chapterNum?: string;
  /** Full path to the product screenshot */
  imageSrc: string;
  /** Alt text for the screenshot */
  imageAlt?: string;
  /** List of capability strings */
  capabilities?: string[];
  /** Optional caption line */
  caption?: string;
  /** Ref to the trigger button — receives focus when dialog closes */
  triggerRef?: React.RefObject<HTMLElement>;
  /** Additional CSS class on the backdrop */
  className?: string;
  /** Custom footer content */
  footer?: ReactNode;
}

export function MissionDossier({
  open,
  onClose,
  title,
  missionCode,
  score,
  chapterNum,
  imageSrc,
  imageAlt,
  capabilities = [],
  caption,
  triggerRef,
  className = '',
  footer,
}: MissionDossierProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogId = `dtom-dossier-${missionCode.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
  const titleId = `${dialogId}-title`;

  // Focus the close button when opened
  useEffect(() => {
    if (open) {
      // Lock body scroll
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Delay so the dialog is mounted before focusing
      const t = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);

      return () => {
        clearTimeout(t);
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [open]);

  // Return focus on close
  const handleClose = useCallback(() => {
    onClose();
    // Defer so the dialog has time to unmount
    setTimeout(() => {
      triggerRef?.current?.focus();
    }, 50);
  }, [onClose, triggerRef]);

  // Escape key closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, handleClose]);

  // Focus trap
  useEffect(() => {
    if (!open || !dialogRef.current) return;

    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener('keydown', trap);
    return () => window.removeEventListener('keydown', trap);
  }, [open]);

  if (!open) return null;

  const effectiveAlt =
    imageAlt ?? `${title} — ΔTOM Sales Dominator product screenshot`;

  return (
    /* Backdrop */
    <div
      className={`dtom-dossier-backdrop ${className}`.trim()}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      aria-hidden="false"
    >
      {/* Dialog */}
      <div
        ref={dialogRef}
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="dtom-dossier"
      >
        {/* Header */}
        <header className="dtom-dossier__header">
          <div>
            <h2 id={titleId} className="dtom-dossier__title">
              {chapterNum ? `${chapterNum} — ` : ''}{title}
            </h2>
            <p className="dtom-dossier__mission-code">{missionCode}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {score !== undefined && (
              <div className="dtom-keynote__score" aria-label={`Mission score: ${score}`}>
                <span className="dtom-keynote__score-value">{score}</span>
                <span className="dtom-keynote__score-label">Score</span>
              </div>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              className="dtom-dossier__close"
              onClick={handleClose}
              aria-label="Close mission dossier"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="dtom-dossier__body">
          {/* Screenshot */}
          <div className="dtom-dossier__screenshot-wrap">
            <img
              className="dtom-dossier__screenshot"
              src={imageSrc}
              alt={effectiveAlt}
              loading="lazy"
            />
          </div>

          {/* Intel panel */}
          <div className="dtom-dossier__intel">
            {chapterNum && (
              <div className="dtom-dossier__intel-row">
                <span className="dtom-dossier__intel-label">Chapter</span>
                <span className="dtom-dossier__intel-value">{chapterNum}</span>
              </div>
            )}
            <div className="dtom-dossier__intel-row">
              <span className="dtom-dossier__intel-label">Mission Code</span>
              <span className="dtom-dossier__intel-value">{missionCode}</span>
            </div>
            {score !== undefined && (
              <div className="dtom-dossier__intel-row">
                <span className="dtom-dossier__intel-label">Score</span>
                <span
                  className="dtom-dossier__intel-value"
                  style={{ color: 'var(--dtom-color-primary)' }}
                >
                  {score}/100
                </span>
              </div>
            )}
            {capabilities.length > 0 && (
              <div className="dtom-dossier__intel-row">
                <span className="dtom-dossier__intel-label">Capabilities</span>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  {capabilities.map((cap) => (
                    <li
                      key={cap}
                      className="dtom-dossier__intel-value"
                      style={{ fontSize: 'var(--dtom-text-xs)' }}
                    >
                      — {cap}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="dtom-dossier__footer">
          {footer ?? (
            caption
              ? caption
              : `Classified display — actual ΔTOM Sales Dominator product capture · AtomDominator.com`
          )}
        </footer>
      </div>
    </div>
  );
}

export default MissionDossier;
