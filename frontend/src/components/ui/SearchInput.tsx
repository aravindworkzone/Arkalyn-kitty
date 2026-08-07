interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export default function SearchInput({ value, onChange, placeholder = "Search…" }: Props) {
  return (
    <div className="relative">
      <svg
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {/* type="text" (not "search") — a search input renders a native clear
          button that would double up with the custom X below. */}
      <input
        type="text"
        inputMode="search"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-shortcut="search"
        aria-label={placeholder}
        className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700
          bg-white dark:bg-gray-900 shadow-theme-xs
          text-base sm:text-theme-sm text-gray-800 dark:text-white/90
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 transition-all duration-200"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg active:text-fg transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
