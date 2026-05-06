interface Props {
  error?: string;
}

export default function ErrorMessage({ error }: Props) {
  if (!error) return null;
  return (
    <p className="text-red-400/90 text-xs flex items-center gap-1.5">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="5" r="4" stroke="#f87171" strokeWidth="1.2" />
        <path d="M5 3v2.5M5 7h.01" stroke="#f87171" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      {error}
    </p>
  );
}
