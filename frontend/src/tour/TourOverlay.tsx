import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTour } from "./useTour";
import { TOUR_STEPS } from "./tourSteps";

/** Padding (px) around the target's bounding rect for the cutout. */
const SPOTLIGHT_PADDING = 8;
/** Corner radius for the cutout — matches the app's xl/2xl button radii. */
const SPOTLIGHT_RADIUS = 14;
/** z-index for the dim layer. Target is lifted to TARGET_Z to remain clickable. */
const OVERLAY_Z = 9998;
const TARGET_Z = 10000;
/** Tooltip card geometry. */
const TOOLTIP_WIDTH = 288;
const TOOLTIP_MARGIN = 14;
const TOOLTIP_VIEWPORT_PAD = 12;
const ARROW_SIZE = 10;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

type Placement = "below" | "above";

/**
 * Render the dim overlay with a soft cutout around the current tour target
 * and a tooltip card that explains the step. The OS cursor handles its own
 * affordance (pointer on buttons, text caret in inputs) — we no longer paint
 * a custom hand.
 *
 * Click handling:
 *   The dim layer is `pointer-events: auto` so stray clicks elsewhere are
 *   swallowed (the tour only advances when the user clicks the highlighted
 *   element). The target itself is lifted via z-index so it sits above the
 *   dim layer and receives its own click events normally. The tooltip card
 *   is also pointer-events: auto so users can hit its "Skip tour" button.
 */
export default function TourOverlay() {
  const { active, currentStep, currentStepIndex, advance, dismiss } = useTour();
  const totalSteps = TOUR_STEPS.length;

  const [rect, setRect] = useState<Rect | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const savedTargetStyleRef = useRef<{ position: string; zIndex: string; boxShadow: string } | null>(null);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  const manualAdvance = currentStep?.manualAdvance === true;
  const manualAdvanceRef = useRef(manualAdvance);
  manualAdvanceRef.current = manualAdvance;

  const noSpotlight = currentStep?.noSpotlight === true;

  const handleTargetClick = useCallback(() => {
    // Input-field steps require the user to click "Next" — clicking the input
    // just focuses it. Button-style steps advance on click (which also lets
    // the original handler run, e.g. navigation).
    if (manualAdvanceRef.current) return;
    queueMicrotask(() => advanceRef.current());
  }, []);

  const detachTarget = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    el.removeEventListener("click", handleTargetClick);
    const saved = savedTargetStyleRef.current;
    if (saved) {
      el.style.position = saved.position;
      el.style.zIndex = saved.zIndex;
      el.style.boxShadow = saved.boxShadow;
    }
    savedTargetStyleRef.current = null;
    targetRef.current = null;
  }, [handleTargetClick]);

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el || !document.body.contains(el)) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setRect(null);
      return;
    }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, []);

  const noSpotlightRef = useRef(noSpotlight);
  noSpotlightRef.current = noSpotlight;

  const attachToTarget = useCallback(
    (el: HTMLElement | null) => {
      if (targetRef.current === el) return;
      detachTarget();
      if (!el) {
        setRect(null);
        return;
      }

      savedTargetStyleRef.current = {
        position: el.style.position,
        zIndex: el.style.zIndex,
        boxShadow: el.style.boxShadow,
      };

      if (noSpotlightRef.current) {
        // No dim/cutout: highlight the target with a glow box-shadow applied
        // directly to the element, so it remains visible inside whatever
        // stacking context it lives in (e.g. a modal). Don't lift via z-index
        // — that would be clamped by the parent stacking context anyway, and
        // we need surrounding chrome (modal Close, etc.) to stay clickable.
        el.style.boxShadow =
          "0 0 0 2px rgba(125, 211, 252, 0.85), 0 0 18px 4px rgba(34, 211, 238, 0.4)";
      } else {
        const computed = window.getComputedStyle(el);
        if (computed.position === "static") {
          el.style.position = "relative";
        }
        el.style.zIndex = String(TARGET_Z);
      }

      el.addEventListener("click", handleTargetClick);
      targetRef.current = el;
      requestAnimationFrame(measure);
    },
    [detachTarget, handleTargetClick, measure]
  );

  useEffect(() => {
    if (!active || !currentStep) {
      detachTarget();
      setRect(null);
      return;
    }

    const selector = `[data-tour="${currentStep.target}"]`;

    const tryFind = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && el !== targetRef.current) {
        attachToTarget(el);
      } else if (!el && targetRef.current) {
        attachToTarget(null);
      } else if (el && el === targetRef.current) {
        measure();
      }
    };

    tryFind();

    const observer = new MutationObserver(() => tryFind());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-tour", "hidden", "style", "class", "disabled"],
    });

    return () => {
      observer.disconnect();
      detachTarget();
    };
  }, [active, currentStep, attachToTarget, detachTarget, measure]);

  useLayoutEffect(() => {
    if (!active) return;
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("orientationchange", onChange);

    let ro: ResizeObserver | null = null;
    if (targetRef.current && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(targetRef.current);
    }

    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("orientationchange", onChange);
      ro?.disconnect();
    };
  }, [active, currentStep, measure]);

  // Tooltip position — below the spotlight by default, flipped above when
  // there isn't enough room. Clamped to the viewport horizontally.
  const tooltip = useMemo(() => {
    if (!rect) return null;
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const placement: Placement = spaceBelow >= 180 || spaceBelow >= spaceAbove ? "below" : "above";

    let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    left = Math.max(
      TOOLTIP_VIEWPORT_PAD,
      Math.min(window.innerWidth - TOOLTIP_WIDTH - TOOLTIP_VIEWPORT_PAD, left)
    );

    const top =
      placement === "below"
        ? rect.top + rect.height + TOOLTIP_MARGIN
        : rect.top - TOOLTIP_MARGIN; // tooltip will translate(-100%) up via CSS

    // Arrow x offset relative to the tooltip's left edge — points at the
    // target's horizontal centre.
    const targetCenterX = rect.left + rect.width / 2;
    const arrowLeft = Math.max(
      ARROW_SIZE + 6,
      Math.min(TOOLTIP_WIDTH - ARROW_SIZE - 6, targetCenterX - left)
    );

    return { top, left, placement, arrowLeft };
  }, [rect]);

  if (!active || !currentStep) return null;
  if (!rect || !tooltip) return null;

  return (
    <div
      aria-hidden="false"
      role="presentation"
      className="fixed inset-0"
      style={{
        // In noSpotlight mode the outer container must let clicks pass through
        // — the target lives inside another stacking context (e.g. a modal)
        // and we don't want to swallow clicks on surrounding chrome.
        zIndex: noSpotlight ? TARGET_Z + 1 : OVERLAY_Z,
        pointerEvents: noSpotlight ? "none" : "auto",
      }}
    >
      {/* Dim layer with an SVG cutout — only when spotlighting. */}
      {!noSpotlight && (
        <svg
          className="absolute inset-0 w-full h-full"
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          style={{ pointerEvents: "none" }}
        >
          <defs>
            <mask id="tour-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={rect.left - SPOTLIGHT_PADDING}
                y={rect.top - SPOTLIGHT_PADDING}
                width={rect.width + SPOTLIGHT_PADDING * 2}
                height={rect.height + SPOTLIGHT_PADDING * 2}
                rx={SPOTLIGHT_RADIUS}
                ry={SPOTLIGHT_RADIUS}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(5, 7, 14, 0.72)"
            mask="url(#tour-spotlight-mask)"
          />
        </svg>
      )}

      {/* Glow ring around the cutout — only when spotlighting. */}
      {!noSpotlight && (
        <div
          className="absolute rounded-[14px]"
          style={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
            pointerEvents: "none",
            boxShadow:
              "0 0 0 1px rgba(125, 211, 252, 0.55), 0 0 24px 6px rgba(34, 211, 238, 0.32), 0 0 60px 18px rgba(124, 58, 237, 0.25)",
            animation: "tour-pulse 1.8s ease-in-out infinite",
            transition: "top 220ms ease-out, left 220ms ease-out, width 220ms ease-out, height 220ms ease-out",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        role="dialog"
        aria-live="polite"
        aria-labelledby="tour-tooltip-title"
        className="absolute"
        style={{
          top: tooltip.top,
          left: tooltip.left,
          width: TOOLTIP_WIDTH,
          transform: tooltip.placement === "above" ? "translateY(-100%)" : undefined,
          pointerEvents: "auto",
          transition: "top 220ms ease-out, left 220ms ease-out",
          animation: "tour-tooltip-in 220ms ease-out",
        }}
      >
        <div
          className="relative rounded-xl bg-[#0d1220] border border-white/[0.1]
            shadow-[0_18px_50px_rgba(0,0,0,0.55)] p-4"
        >
          {/* Arrow */}
          <span
            className="absolute block w-[14px] h-[14px] bg-[#0d1220] border-white/[0.1]"
            style={{
              left: tooltip.arrowLeft - 7,
              ...(tooltip.placement === "below"
                ? {
                    top: -7,
                    borderTop: "1px solid",
                    borderLeft: "1px solid",
                    borderColor: "rgba(255,255,255,0.1)",
                    transform: "rotate(45deg)",
                  }
                : {
                    bottom: -7,
                    borderBottom: "1px solid",
                    borderRight: "1px solid",
                    borderColor: "rgba(255,255,255,0.1)",
                    transform: "rotate(45deg)",
                  }),
            }}
          />

          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/80">
              Step {currentStepIndex + 1} of {totalSteps}
            </p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Skip tour"
              className="text-[10px] font-medium text-white/30 hover:text-white/60 active:text-white/60 transition-colors"
            >
              Skip
            </button>
          </div>

          <h3
            id="tour-tooltip-title"
            className="text-[14px] font-semibold text-[#f0eeff] leading-tight mb-1"
          >
            {currentStep.title}
          </h3>
          <p className="text-[12px] text-white/55 leading-relaxed">
            {currentStep.tip}
          </p>

          <div className="flex flex-col gap-2.5 mt-3">
            {/* Progress bar — replaces per-step dots so the tooltip stays
                within its 288px card regardless of total step count. */}
            <div className="h-1 w-full rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-400 transition-[width] duration-200"
                style={{
                  width: `${((currentStepIndex + 1) / totalSteps) * 100}%`,
                }}
              />
            </div>

            {/* Manual-advance Next button sits below the progress bar so it
                reads as the next action after the indicator. Button-style
                steps advance on target click and intentionally omit Next. */}
            {manualAdvance && (
              <button
                type="button"
                onClick={() => advance()}
                className="self-stretch px-3 py-1.5 rounded-lg text-[11px] font-semibold
                  text-black bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-300
                  shadow-md shadow-cyan-500/20 transition-colors active:scale-[0.97]"
              >
                Next
                <span className="ml-1.5 text-black/70">→</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tour-pulse {
          0%, 100% {
            box-shadow:
              0 0 0 1px rgba(125, 211, 252, 0.55),
              0 0 24px 6px rgba(34, 211, 238, 0.32),
              0 0 60px 18px rgba(124, 58, 237, 0.25);
          }
          50% {
            box-shadow:
              0 0 0 1px rgba(165, 243, 252, 0.7),
              0 0 36px 10px rgba(34, 211, 238, 0.5),
              0 0 80px 24px rgba(124, 58, 237, 0.4);
          }
        }
        @keyframes tour-tooltip-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
