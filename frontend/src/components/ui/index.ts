/* ── Design system (UI_PROMPT) — prefer these in new and migrated code ──────
   Token-driven, light + dark. See CLAUDE.md "UI restructure plan". */
export { default as Button } from "./Button";
export type { ButtonVariant, ButtonSize } from "./Button";
export { default as Card } from "./Card";
export { default as Label } from "./Label";
export { default as Input } from "./Input";
export { default as FormField } from "./FormField";
export { default as Badge } from "./Badge";
export type { BadgeTone } from "./Badge";
export { default as ThemeToggle } from "./ThemeToggle";
export { default as Select } from "./Select";
export type { SelectOption } from "./Select";
export { default as DatePicker } from "./DatePicker";
export { default as DataList } from "./DataList";
export type { DataListPagination } from "./DataList";
export { useFormField } from "./formFieldContext";
export type { FormFieldA11y } from "./formFieldContext";

/* ── Legacy — dark-only, hardcoded colours. Being replaced screen by screen in
   phase 5; do not build anything new on these. ───────────────────────────── */
export { default as PageBackground } from "./PageBackground";
export { default as BackButton }     from "./BackButton";
export { default as PageHeader }     from "./PageHeader";
export { default as FormSection }    from "./FormSection";
export { default as StatCard }       from "./StatCard";
export { default as SearchInput }    from "./SearchInput";
export { default as ErrorMessage }   from "./ErrorMessage";
export { default as FormActions }    from "./FormActions";
export { default as MemberAvatar }   from "./MemberAvatar";
export { default as Spinner }        from "./Spinner";
export { default as FieldInput }     from "./FieldInput";
export { default as AmountInput }    from "./AmountInput";
export { default as ActionButton }   from "./ActionButton";
export { default as MemberSelect }   from "./MemberSelect";
export { default as StatusBanner }   from "./StatusBanner";
export { default as SegmentedToggle } from "./SegmentedToggle";
export { default as Logo }            from "./Logo";
export { default as BottomSheet }     from "./BottomSheet";
export { INPUT_CLASS, DATE_INPUT_EXTRA } from "./classes";
