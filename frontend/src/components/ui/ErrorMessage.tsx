interface Props {
  error?: string;
}

/**
 * Standalone field error, for call sites that place their own error text rather
 * than wrapping the control in <FormField>.
 *
 * error-600 / error-400 rather than error-500: error-500 as text is 3.76:1 on
 * white, which fails AA. Same pair FormField uses — keep them in step.
 */
export default function ErrorMessage({ error }: Props) {
  if (!error) return null;
  return (
    <p role="alert" className="text-theme-xs text-error-600 dark:text-error-400 flex items-center gap-1.5">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="shrink-0">
        <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 3v2.5M5 7h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      {error}
    </p>
  );
}
