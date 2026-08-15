interface Props {
  onReset?: () => void;
}

// Rendered by ErrorBoundary as the crash fallback — intentionally free of
// hooks, i18n, and Redux so it still works when those are what failed.
export default function ServerErrorPage({ onReset }: Props) {
  return (
    <div className="min-h-screen bg-surface text-fg flex items-center justify-center px-5 sm:px-6 py-16">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-error-500/5 blur-[120px]" />
        <div className="absolute bottom-0 -right-60 w-[600px] h-[600px] rounded-full bg-brand-600/4 blur-[120px]" />
      </div>

      <div className="relative max-w-lg w-full text-center">
        <p className="text-title-md leading-none font-bold tracking-tight bg-gradient-to-br from-error-400/80 to-warning-400/60 bg-clip-text text-transparent select-none">
          500
        </p>

        <h1 className="text-xl font-semibold tracking-tight text-[#f0eeff] mt-2">
          Something went wrong
        </h1>
        <p className="text-fg-muted text-sm mt-2">
          An unexpected error broke this page. Try reloading — if it keeps
          happening, head back home.
        </p>

        <div className="flex items-center justify-center gap-2.5 mt-7">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border
              bg-surface-hover border-line text-fg
              hover:bg-surface-hover hover:text-fg active:bg-surface-hover active:text-fg transition-all duration-150"
          >
            Reload page
          </button>
          <button
            type="button"
            onClick={() => {
              onReset?.();
              window.location.assign("/groups");
            }}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border
              bg-error-500/10 border-error-500/25 text-error-300
              hover:bg-error-500/20 hover:border-error-400/40 active:bg-error-500/20 active:border-error-400/40 transition-all duration-150"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
