import type { ReactNode } from 'react';
import React, { useState, useCallback } from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = 'idle' | 'sending' | 'success' | 'error';

interface FieldErrors {
  name?: string;
  email?: string;
  message?: string;
}

interface ContactFormProps {
  /** Google Apps Script web app URL — paste the deployment URL here. */
  scriptUrl: string;
  /** Optional heading shown above the form. */
  heading?: string;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(name: string, email: string, message: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim())                    errors.name    = 'Please enter your name.';
  if (!email.trim())                   errors.email   = 'Please enter your email address.';
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'Please enter a valid email address.';
  if (!message.trim())                 errors.message = 'Please enter a message.';
  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContactForm({
  scriptUrl,
  heading = 'Get In Touch',
}: ContactFormProps): ReactNode {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [message, setMessage] = useState('');
  const [status,  setStatus]  = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  // fieldErrors only shown after the first submit attempt
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Re-validate on every keystroke once the user has tried to submit once.
  const revalidate = (n = name, em = email, msg = message) => {
    if (submitted) setFieldErrors(validate(n, em, msg));
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitted(true);

      const errors = validate(name, email, message);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return; // stop — show inline errors

      setStatus('sending');
      setErrorMsg('');

      try {
        // Google Apps Script requires form-encoded data.
        const body = new URLSearchParams({ name, email, message });
        const res = await fetch(scriptUrl, {
          method: 'POST',
          // 'no-cors' is required — Apps Script deployments don't return
          // CORS headers on the OPTIONS pre-flight, so we skip it entirely.
          // The trade-off: we can't inspect the response body, but a network-
          // level failure will still throw and land in the catch block.
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });

        // With mode:'no-cors' the response type is 'opaque' and .ok is always
        // false.  We treat any non-thrown fetch as a success.
        void res; // suppress "unused variable" lint
        setStatus('success');
        setName('');
        setEmail('');
        setMessage('');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
        setStatus('error');
      }
    },
    [scriptUrl, name, email, message],
  );

  const reset = () => {
    setStatus('idle');
    setErrorMsg('');
    setFieldErrors({});
    setSubmitted(false);
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className={clsx(styles.wrapper, styles.successWrapper)}>
        <span className={styles.icon} aria-hidden="true">📨</span>
        <Heading as="h3" className={styles.successTitle}>
          Message received!
        </Heading>
        <p className={styles.successText}>
          Thanks for reaching out — we'll get back to you soon.
        </p>
        <button className={styles.btn} onClick={reset}>
          Send another
        </button>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className={clsx(styles.wrapper, styles.errorWrapper)}>
        <span className={styles.icon} aria-hidden="true">⚠️</span>
        <Heading as="h3" className={styles.errorTitle}>
          Something went wrong
        </Heading>
        {errorMsg && (
          <p className={styles.errorDetail}>{errorMsg}</p>
        )}
        <p className={styles.errorHint}>
          Please try again, or reach us directly on social media.
        </p>
        <button className={styles.btn} onClick={reset}>
          Try again
        </button>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className={styles.wrapper}>
      {heading && (
        <Heading as="h2" className={clsx(styles.heading, 'hf-neon-title')}>
          {heading}
        </Heading>
      )}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>

        {/* Name */}
        <div className={styles.fieldGroup}>
          <label htmlFor="cf-name" className={styles.label}>
            Name
          </label>
          <input
            id="cf-name"
            type="text"
            name="name"
            autoComplete="name"
            placeholder="Your name"
            className={clsx(styles.input, { [styles.inputInvalid]: !!fieldErrors.name })}
            value={name}
            onChange={e => { setName(e.target.value); revalidate(e.target.value, email, message); }}
            disabled={status === 'sending'}
          />
          {fieldErrors.name && (
            <p className={styles.fieldError} role="alert">{fieldErrors.name}</p>
          )}
        </div>

        {/* Email */}
        <div className={styles.fieldGroup}>
          <label htmlFor="cf-email" className={styles.label}>
            Email
          </label>
          <input
            id="cf-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="your@email.com"
            className={clsx(styles.input, { [styles.inputInvalid]: !!fieldErrors.email })}
            value={email}
            onChange={e => { setEmail(e.target.value); revalidate(name, e.target.value, message); }}
            disabled={status === 'sending'}
          />
          {fieldErrors.email && (
            <p className={styles.fieldError} role="alert">{fieldErrors.email}</p>
          )}
        </div>

        {/* Message */}
        <div className={styles.fieldGroup}>
          <label htmlFor="cf-message" className={styles.label}>
            Message
          </label>
          <textarea
            id="cf-message"
            name="message"
            rows={5}
            placeholder="What's on your mind?"
            className={clsx(styles.input, styles.textarea, { [styles.inputInvalid]: !!fieldErrors.message })}
            value={message}
            onChange={e => { setMessage(e.target.value); revalidate(name, email, e.target.value); }}
            disabled={status === 'sending'}
          />
          {fieldErrors.message && (
            <p className={styles.fieldError} role="alert">{fieldErrors.message}</p>
          )}
        </div>

        <button
          type="submit"
          className={clsx(styles.btn, styles.submitBtn, {
            [styles.sending]: status === 'sending',
          })}
          disabled={status === 'sending'}
        >
          {status === 'sending' ? 'Sending…' : 'Send Message'}
        </button>
      </form>
    </div>
  );
}