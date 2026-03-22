/**
 * AgeVerification
 *
 * Renders a date-of-birth gate and calls onPass/onFail when verified.
 *
 * Two usage modes:
 *
 *   1. Page overlay — wrap the page (or a section) in <AgeVerification minimumAge={18}>
 *      Children are hidden behind a full-viewport frosted overlay until the
 *      visitor passes. Once passed, the result is persisted in sessionStorage
 *      (keyed on `storageKey`) so re-navigation within the session skips the gate.
 *
 *   2. Carousel slot wrapper — pass `variant="inline"` to get a compact
 *      in-place gate sized to its container rather than the full viewport.
 *      IframeCarousel uses this internally per-slide.
 *
 * Props:
 *   minimumAge   Required age in years (e.g. 18).
 *   children     Content to reveal on pass.
 *   variant      "overlay" (default, full-viewport) | "inline" (container-sized).
 *   storageKey   sessionStorage key. Default: "hf-age-verified-<minimumAge>".
 *   onPass       Optional callback fired when verification succeeds.
 *   onFail       Optional callback fired when verification fails.
 */

import type { ReactNode } from 'react';
import React, { useState, useId } from 'react';
import styles from './styles.module.css';

export interface AgeVerificationProps {
  minimumAge:  number;
  children:    ReactNode;
  variant?:    'overlay' | 'inline';
  storageKey?: string;
  onPass?:     () => void;
  onFail?:     () => void;
}

function getStorageKey(minimumAge: number, custom?: string): string {
  return custom ?? `hf-age-verified-${minimumAge}`;
}

function checkSession(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === 'pass';
  } catch {
    return false;
  }
}

function setSession(key: string): void {
  try {
    sessionStorage.setItem(key, 'pass');
  } catch { /* private browsing — silently ignore */ }
}

function meetsAgeRequirement(year: number, month: number, day: number, minimumAge: number): boolean {
  const today = new Date();
  const birth = new Date(year, month - 1, day);
  // Anniversary this calendar year
  const anniversary = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  const age = today.getFullYear() - birth.getFullYear() - (today < anniversary ? 1 : 0);
  return age >= minimumAge;
}

export default function AgeVerification({
  minimumAge,
  children,
  variant    = 'overlay',
  storageKey,
  onPass,
  onFail,
}: AgeVerificationProps): ReactNode {
  const key = getStorageKey(minimumAge, storageKey);

  // Already verified this session — render children immediately
  const [verified, setVerified] = useState<boolean>(() =>
    typeof window !== 'undefined' && checkSession(key)
  );
  const [failed,   setFailed  ] = useState(false);
  const [day,      setDay     ] = useState('');
  const [month,    setMonth   ] = useState('');
  const [year,     setYear    ] = useState('');
  const [error,    setError   ] = useState('');

  const uid = useId();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const d = parseInt(day,   10);
    const m = parseInt(month, 10);
    const y = parseInt(year,  10);

    // Basic validity
    if (!d || !m || !y || y < 1900 || y > new Date().getFullYear()) {
      setError('Please enter a valid date of birth.');
      return;
    }
    const date = new Date(y, m - 1, d);
    if (date.getMonth() !== m - 1 || date.getDate() !== d) {
      setError('That date doesn\'t exist. Please check your entry.');
      return;
    }

    if (meetsAgeRequirement(y, m, d, minimumAge)) {
      setSession(key);
      setVerified(true);
      onPass?.();
    } else {
      setFailed(true);
      onFail?.();
    }
  };

  if (verified) {
    return <>{children}</>;
  }

  const gate = (
    <div
      className={`${styles.gate} ${variant === 'inline' ? styles.gateInline : styles.gateOverlay}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${uid}-title`}
    >
      <div className={styles.panel}>
        {/* Icon */}
        <div className={styles.icon} aria-hidden>🔒</div>

        <h2 id={`${uid}-title`} className={styles.title}>
          Age Verification
        </h2>

        {failed ? (
          /* Soft rejection — no retry */
          <div className={styles.failState}>
            <p className={styles.failMsg}>
              Sorry, you must be at least <strong>{minimumAge}</strong> years old
              to access this content.
            </p>
          </div>
        ) : (
          <>
            <p className={styles.subtitle}>
              You must be at least <strong>{minimumAge}</strong> years old to
              continue. Please enter your date of birth.
            </p>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.fields}>
                <label className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Day</span>
                  <input
                    className={styles.fieldInput}
                    type="number"
                    min={1} max={31}
                    placeholder="DD"
                    value={day}
                    onChange={e => setDay(e.target.value)}
                    required
                  />
                </label>

                <label className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Month</span>
                  <input
                    className={styles.fieldInput}
                    type="number"
                    min={1} max={12}
                    placeholder="MM"
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                    required
                  />
                </label>

                <label className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Year</span>
                  <input
                    className={`${styles.fieldInput} ${styles.fieldInputWide}`}
                    type="number"
                    min={1900} max={new Date().getFullYear()}
                    placeholder="YYYY"
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    required
                  />
                </label>
              </div>

              {error && (
                <p className={styles.errorMsg} role="alert">{error}</p>
              )}

              <button type="submit" className={styles.submitBtn}>
                Verify Age
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.root}>
      {/* Render children behind the overlay so they're in the DOM for SEO,
          but visually hidden and inert until verification passes. */}
      <div className={styles.hiddenContent} aria-hidden inert>
        {children}
      </div>
      {gate}
    </div>
  );
}