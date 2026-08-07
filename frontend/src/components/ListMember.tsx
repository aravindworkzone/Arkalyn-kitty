/**
 * Overlapping member avatar stack.
 *
 * Colours come from a fixed 4-step categorical sequence off the palette rather
 * than the old inline hex objects — those also hardcoded the dark page colour
 * into each avatar's `box-shadow` separating ring, which showed as a dark halo
 * on the light canvas. The ring is now `ring-surface`, so it tracks the page.
 */
const TONES = [
  "bg-brand-100 text-brand-700 border-brand-400 dark:bg-brand-500/25 dark:text-brand-300 dark:border-brand-400",
  "bg-blue-light-500/15 text-blue-light-600 border-blue-light-500 dark:bg-blue-light-500/25 dark:text-blue-light-500 dark:border-blue-light-500",
  "bg-success-100 text-success-700 border-success-500 dark:bg-success-500/25 dark:text-success-300 dark:border-success-500",
  "bg-error-100 text-error-700 border-error-500 dark:bg-error-500/25 dark:text-error-300 dark:border-error-500",
];

const MemberAvatars = ({ members }: { members: string[] }) => {
  const visible = members?.slice(0, 4);
  const overflow = members?.length - 4;

  return (
    <div className="flex items-center">
      {visible && visible.map((m, i) => (
        <div
          key={m}
          className={`w-6 h-6 rounded-full flex items-center justify-center border-[1.5px]
            ring-[1.5px] ring-surface text-theme-2xs font-bold -mr-2
            transition-transform hover:scale-110 hover:z-10 ${TONES[i]}`}
          style={{ zIndex: 4 - i }}
        >
          {m?.slice(0, 2).toUpperCase()}
        </div>
      ))}

      {overflow > 0 && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center border-[1.5px]
            ring-[1.5px] ring-surface text-theme-2xs font-bold -mr-2 z-0
            bg-surface-hover text-fg-muted border-line-strong"
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

export default MemberAvatars;
