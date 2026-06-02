import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../redux/store";

// True whenever any RTK Query request (query or mutation) is in flight, so the
// bar reflects all network activity app-wide without per-page wiring.
const selectAnyRequestPending = (state: RootState): boolean => {
    const { queries, mutations } = state.api;
    for (const key in queries) if (queries[key]?.status === "pending") return true;
    for (const key in mutations) if (mutations[key]?.status === "pending") return true;
    return false;
};

/**
 * Slim top-of-viewport progress bar (NProgress-style): trickles toward 90% while
 * requests are in flight, snaps to 100% and fades out when they settle. Purely
 * presentational — gives every navigation and action an immediate sense of
 * responsiveness.
 */
export default function TopProgressBar() {
    const loading = useSelector(selectAnyRequestPending);
    const [width, setWidth] = useState(0);
    const [visible, setVisible] = useState(false);
    const trickle = useRef<number | null>(null);
    const wasLoading = useRef(false);

    useEffect(() => {
        let finishTimer: number | undefined;

        if (loading) {
            wasLoading.current = true;
            setVisible(true);
            setWidth((w) => (w < 8 ? 8 : w));
            // Ease toward 90% but never reach it — completion only happens on settle.
            trickle.current = window.setInterval(() => {
                setWidth((w) => (w < 90 ? w + (90 - w) * 0.15 : w));
            }, 200);
        } else if (wasLoading.current) {
            wasLoading.current = false;
            setWidth(100);
            finishTimer = window.setTimeout(() => {
                setVisible(false);
                setWidth(0);
            }, 280);
        }

        return () => {
            if (trickle.current) {
                clearInterval(trickle.current);
                trickle.current = null;
            }
            if (finishTimer) clearTimeout(finishTimer);
        };
    }, [loading]);

    return (
        <div
            aria-hidden
            className="fixed top-0 left-0 right-0 z-[100] h-0.5 pointer-events-none"
            style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms ease" }}
        >
            <div
                className="h-full bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400 shadow-[0_0_8px_rgba(139,92,246,0.7)]"
                style={{ width: `${width}%`, transition: "width 200ms ease" }}
            />
        </div>
    );
}
