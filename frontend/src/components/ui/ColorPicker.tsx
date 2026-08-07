import { useRef } from "react";

/**
 * Category colour picker: preset swatches plus a native colour input for a
 * custom value.
 *
 * The selected swatch's halo used to be `box-shadow: 0 0 0 2px #080c14` — the
 * dark page background baked into the component, which drew a dark ring on the
 * light canvas. It is `ring-surface` now, so the gap between swatch and halo
 * always matches the page it sits on.
 */
interface ColorPickerProps {
    options: readonly string[];
    value: string;
    onChange: (color: string) => void;
    customLabel: string;
    /** Rendered at the end of the row — the live name/colour preview. */
    trailing?: React.ReactNode;
}

function Swatch({
    color,
    selected,
    onClick,
    title,
}: {
    color: string;
    selected: boolean;
    onClick: () => void;
    title?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            aria-pressed={selected}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150
                ring-offset-2 ring-offset-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40
                ${selected ? "ring-[1.5px] scale-[1.15]" : "scale-100"}`}
            style={{ background: color, ...(selected ? { ["--tw-ring-color" as string]: color } : {}) }}
        >
            {selected && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    {/* Fixed white: it sits on the swatch's own colour, not on a themed surface. */}
                    <path d="M2 5l2.5 2.5 3.5-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            )}
        </button>
    );
}

export default function ColorPicker({ options, value, onChange, customLabel, trailing }: ColorPickerProps) {
    const customRef = useRef<HTMLInputElement>(null);
    const isCustom = !options.includes(value);

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {options.map((c) => (
                <Swatch key={c} color={c} selected={value === c} onClick={() => onChange(c)} />
            ))}

            {isCustom && (
                <Swatch
                    color={value}
                    selected
                    onClick={() => customRef.current?.click()}
                    title={customLabel}
                />
            )}

            <button
                type="button"
                onClick={() => customRef.current?.click()}
                title={customLabel}
                className="w-7 h-7 rounded-full border border-dashed border-line-strong text-fg-muted
                    hover:text-fg hover:border-fg-muted active:text-fg flex items-center justify-center transition-colors
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M5 1.5v7M1.5 5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
            </button>
            <input
                ref={customRef}
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="sr-only"
                aria-label={customLabel}
            />

            {trailing}
        </div>
    );
}
