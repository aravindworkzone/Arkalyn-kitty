/**
 * Sidebar glyphs.
 *
 * Inline SVG rather than an icon package — the codebase has no icon dependency
 * and hand-rolls its glyphs everywhere (header.tsx, MobileNav.tsx, the ui
 * primitives), so adding one for a dozen shapes would be the larger cost.
 *
 * All of them: 16px box, 1.4 stroke, `currentColor`, no fill. That keeps them
 * consistent with the existing set and lets the nav row own the colour through
 * its hover and active states.
 */

const S = {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": true,
} as const;

const stroke = {
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round",
    strokeLinejoin: "round",
} as const;

export const Home = () => (
    <svg {...S}>
        <path d="M2.5 6.5L8 2l5.5 4.5V13a.8.8 0 01-.8.8h-3.2V9.8H6.5v4H3.3a.8.8 0 01-.8-.8V6.5z" {...stroke} />
    </svg>
);

export const Plus = () => (
    <svg {...S}>
        <path d="M8 3.2v9.6M3.2 8h9.6" {...stroke} strokeWidth={1.6} />
    </svg>
);

export const Back = () => (
    <svg {...S}>
        <path d="M10 3.5L5.5 8l4.5 4.5" {...stroke} />
    </svg>
);

export const Shield = () => (
    <svg {...S}>
        <path d="M8 2l4.5 1.8v4c0 2.8-1.9 5.2-4.5 6.2-2.6-1-4.5-3.4-4.5-6.2v-4L8 2z" {...stroke} />
    </svg>
);

export const Receipt = () => (
    <svg {...S}>
        <path d="M4 2h8v12l-2-1.2-2 1.2-2-1.2L4 14V2z" {...stroke} />
        <path d="M6.2 5.5h3.6M6.2 8h3.6" {...stroke} />
    </svg>
);

export const Wallet = () => (
    <svg {...S}>
        <path d="M2.5 5.5a1 1 0 011-1h9a1 1 0 011 1v6a1 1 0 01-1 1h-9a1 1 0 01-1-1v-6z" {...stroke} />
        <path d="M2.5 6.5h11M10.5 9h1.5" {...stroke} />
    </svg>
);

export const Link = () => (
    <svg {...S}>
        <path d="M6.4 9.6l3.2-3.2" {...stroke} />
        <path d="M5.6 4l.8-.8a2.83 2.83 0 014 4l-.8.8" {...stroke} />
        <path d="M10.4 12l-.8.8a2.83 2.83 0 01-4-4l.8-.8" {...stroke} />
    </svg>
);

export const Cycle = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M12 7a5 5 0 1 1-1.6-3.7M12 1.6V4.4H9.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const Tag = () => (
    <svg {...S}>
        <path d="M2.8 8.4V3.4a.6.6 0 01.6-.6h5l5.2 5.2a.8.8 0 010 1.2l-4.4 4.4a.8.8 0 01-1.2 0L2.8 8.4z" {...stroke} />
        <circle cx="5.9" cy="5.9" r="0.9" {...stroke} strokeWidth={1.1} />
    </svg>
);

export const Activity = () => (
    <svg {...S}>
        <path d="M2 8h2.6L6.4 4.2l3.2 7.6L11.4 8H14" {...stroke} />
    </svg>
);

export const Chart = () => (
    <svg {...S}>
        <path d="M2.5 13.5h11" {...stroke} />
        <path d="M4.5 13.5V8M8 13.5V3.5M11.5 13.5v-4" {...stroke} />
    </svg>
);

export const Settings = () => (
    <svg {...S}>
        <circle cx="8" cy="8" r="2.2" {...stroke} />
        <path d="M8 1.8v1.4M8 12.8v1.4M14.2 8h-1.4M3.2 8H1.8M12.4 3.6l-1 1M4.6 11.4l-1 1M12.4 12.4l-1-1M4.6 4.6l-1-1" {...stroke} />
    </svg>
);

/**
 * Panel glyph with a chevron showing which way the toggle moves the sidebar:
 * pointing in when expanded (click to collapse), out when collapsed (click to
 * expand). Without the flip the same arrow claimed both directions.
 */
export const Collapse = ({ flipped = false }: { flipped?: boolean }) => (
    <svg {...S} width={15} height={15}>
        <path d="M2.5 3.5h11v9h-11z" {...stroke} />
        <path d="M6.5 3.5v9" {...stroke} />
        <path d={flipped ? "M9 6.5l1.8 1.5L9 9.5" : "M11 6.5L9.2 8 11 9.5"} {...stroke} strokeWidth={1.2} />
    </svg>
);

export const Menu = () => (
    <svg {...S} width={18} height={18}>
        <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" {...stroke} strokeWidth={1.5} />
    </svg>
);
