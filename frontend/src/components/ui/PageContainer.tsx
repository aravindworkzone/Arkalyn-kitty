import type { ElementType, HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../helpers/cn";

/**
 * The one page-level content column.
 *
 * Every screen used to open with its own hand-written variant of
 * `max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-3` — five different max-widths,
 * four different stack gaps, and a flat `px-4` that never grew on desktop. That
 * left a 672px ribbon stranded in the middle of a 1440px display.
 *
 * Width is chosen by what the page CONTAINS, not by how much room is going
 * spare:
 *
 *   form    — inputs and prose. Deliberately narrow. A text field stretched to
 *             1300px, with its label a screen away from its value, is harder to
 *             use however much space is available.
 *   content — lists, feeds, detail screens. Wide enough to let rows breathe and
 *             to run two columns at lg+.
 *   wide    — dashboards and pricing tables, where the whole point is comparing
 *             things side by side.
 *
 * Horizontal padding steps up with the viewport so the gutter stays in
 * proportion to the column instead of pinning at 16px forever.
 */

export type PageWidth = "form" | "content" | "wide";

const WIDTH: Record<PageWidth, string> = {
    form: "max-w-2xl",
    content: "max-w-6xl",
    wide: "max-w-[1440px]",
};

/** Vertical rhythm between top-level blocks. `none` for pages that own theirs. */
export type PageGap = "none" | "sm" | "md" | "lg";

const GAP: Record<PageGap, string> = {
    none: "",
    sm: "space-y-4 lg:space-y-5",
    md: "space-y-6 lg:space-y-7",
    lg: "space-y-8 lg:space-y-10",
};

interface PageContainerProps<E extends HTMLElement> extends HTMLAttributes<HTMLElement> {
    width?: PageWidth;
    gap?: PageGap;
    /** Defaults to <main>. Forms and nested sections override it. */
    as?: ElementType;
    /**
     * Forwarded to the rendered element. Declared explicitly because `as` makes
     * the element type dynamic, so the ref cannot be inferred from it — the
     * generic takes it from the ref that is actually passed instead. page/
     * CreateExpense.tsx renders this as its <form> and holds a ref to it.
     */
    ref?: Ref<E>;
    children: ReactNode;
}

export default function PageContainer<E extends HTMLElement = HTMLElement>({
    width = "content",
    gap = "md",
    as: Tag = "main",
    className,
    children,
    ref,
    ...rest
}: PageContainerProps<E>) {
    return (
        <Tag
            {...rest}
            ref={ref}
            className={cn(
                "relative mx-auto w-full",
                WIDTH[width],
                // Gutters grow with the viewport; the safe-area insets keep the
                // column clear of a notch in landscape.
                "px-4 py-8",
                GAP[gap],
                className
            )}
        >
            {children}
        </Tag>
    );
}
