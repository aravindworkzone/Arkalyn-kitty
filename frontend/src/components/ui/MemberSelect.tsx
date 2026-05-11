import type { SelectHTMLAttributes } from "react";
import type { GroupMember } from "../../interface/member";

interface MemberSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children" | "onChange" | "value"> {
  members: GroupMember[] | undefined;
  value: string;
  onChange: (userId: string) => void;
  placeholder: string;
  filter?: (m: GroupMember) => boolean;
  renderLabel?: (m: GroupMember) => string;
  className?: string;
  placeholderDisabled?: boolean;
}

const baseClass =
  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-500/50 transition-all appearance-none";

export default function MemberSelect({
  members,
  value,
  onChange,
  placeholder,
  filter,
  renderLabel,
  className = "",
  placeholderDisabled = true,
  ...rest
}: MemberSelectProps) {
  const list = filter ? (members ?? []).filter(filter) : (members ?? []);
  const label = renderLabel ?? ((m: GroupMember) => m.userId.name);

  return (
    <select
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${baseClass} ${className}`}
      style={{ background: "#0d1220", ...(rest.style ?? {}) }}
    >
      <option value="" disabled={placeholderDisabled} style={{ background: "#0d1220" }}>
        {placeholder}
      </option>
      {list.map((m) => (
        <option key={m._id} value={m.userId._id} style={{ background: "#0d1220" }}>
          {label(m)}
        </option>
      ))}
    </select>
  );
}
