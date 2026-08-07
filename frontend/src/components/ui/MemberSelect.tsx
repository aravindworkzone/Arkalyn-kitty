import { useMemo } from "react";
import Select from "./Select";
import type { SelectOption } from "./Select";
import type { GroupMember } from "../../interface/member";

/**
 * Member picker. Now a thin wrapper over the design-system <Select> rather than
 * a styled native <select> — that removes the last hardcoded `#0d1220` option
 * background (unthemeable, and wrong in light mode) and brings keyboard/ARIA
 * support along for free.
 */
interface MemberSelectProps {
  members: GroupMember[] | undefined;
  value: string;
  onChange: (userId: string) => void;
  placeholder: string;
  filter?: (m: GroupMember) => boolean;
  renderLabel?: (m: GroupMember) => string;
  className?: string;
  disabled?: boolean;
  /** When false the placeholder is itself a selectable row — the caller treats
   *  an empty value as a real choice (e.g. "me"), not as "nothing picked". */
  placeholderDisabled?: boolean;
}

export default function MemberSelect({
  members,
  value,
  onChange,
  placeholder,
  filter,
  renderLabel,
  className,
  disabled,
  placeholderDisabled = true,
}: MemberSelectProps) {
  const options = useMemo<SelectOption[]>(() => {
    const list = filter ? (members ?? []).filter(filter) : (members ?? []);
    const label = renderLabel ?? ((m: GroupMember) => m.userId.name);
    const rows = list.map((m) => ({ value: m.userId._id, label: label(m) }));
    // A selectable placeholder has to exist as a real row, otherwise there is
    // no way back to the empty value once something else is chosen.
    return placeholderDisabled ? rows : [{ value: "", label: placeholder }, ...rows];
  }, [members, filter, renderLabel, placeholderDisabled, placeholder]);

  return (
    <Select
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}
