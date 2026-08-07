type AvatarTone = "brand" | "success" | "neutral";
type AvatarSize = "sm" | "md";

interface Props {
  name: string;
  tone?: AvatarTone;
  size?: AvatarSize;
}

const toneMap: Record<AvatarTone, string> = {
  brand:
    "bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-500/15 dark:border-brand-500/20 dark:text-brand-400",
  success:
    "bg-success-50 border-success-200 text-success-700 dark:bg-success-500/15 dark:border-success-500/20 dark:text-success-400",
  neutral: "bg-surface-hover border-line text-fg-muted",
};

const sizeMap: Record<AvatarSize, string> = {
  sm: "w-6 h-6 text-theme-2xs",
  md: "w-8 h-8 text-theme-xs",
};

export default function MemberAvatar({ name, tone = "brand", size = "md" }: Props) {
  return (
    <div
      className={`${sizeMap[size]} ${toneMap[tone]} rounded-full border flex items-center justify-center shrink-0 font-bold`}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
