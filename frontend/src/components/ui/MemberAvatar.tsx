type AvatarColor = "cyan" | "violet" | "white";
type AvatarSize  = "sm" | "md";

interface Props {
  name: string;
  color?: AvatarColor;
  size?: AvatarSize;
}

const colorMap: Record<AvatarColor, string> = {
  cyan:   "bg-cyan-500/15 border-cyan-500/20 text-cyan-400",
  violet: "bg-violet-500/15 border-violet-500/20 text-violet-400",
  white:  "bg-white/10 border-white/10 text-white/40",
};

const sizeMap: Record<AvatarSize, string> = {
  sm: "w-6 h-6 text-[9px]",
  md: "w-8 h-8 text-[11px]",
};

export default function MemberAvatar({ name, color = "cyan", size = "md" }: Props) {
  return (
    <div
      className={`${sizeMap[size]} ${colorMap[color]} rounded-full border flex items-center justify-center shrink-0 font-bold`}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
