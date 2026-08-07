/**
 * Ambient page wash sitting behind the app shell.
 *
 * The grid uses `currentColor` rather than a hardcoded rgba so it inherits
 * `text-line` and flips with the theme — a white grid is invisible on the light
 * canvas, and a gray one is invisible on the dark one.
 */
export default function PageBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-brand-400/8 dark:bg-brand-500/5 blur-[120px]" />
      <div className="absolute bottom-0 -right-60 w-[600px] h-[600px] rounded-full bg-brand-600/6 dark:bg-brand-600/5 blur-[120px]" />
      <div
        className="absolute inset-0 text-line opacity-40 dark:opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px,transparent 1px),linear-gradient(90deg,currentColor 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}
