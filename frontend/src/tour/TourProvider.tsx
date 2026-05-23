import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import TourOverlay from "./TourOverlay";
import TourCompletionModal from "./TourCompletionModal";
import { useTour, type UseTourResult } from "./useTour";

const TourContext = createContext<UseTourResult | null>(null);

/** Public hook so consumers don't have to know the context lives here. */
export const useTourContext = (): UseTourResult => {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTourContext must be used inside <TourProvider>.");
  }
  return ctx;
};

interface Props {
  children: ReactNode;
  /**
   * When `true`, the tour will auto-start on first visit (no
   * `arkalyn_tour_completed` flag in localStorage). Defaults to true; pass
   * `false` if the host route is the public landing / login flow.
   */
  autoStartForNewUsers?: boolean;
}

/**
 * Mounts the tour overlay + completion modal globally and exposes the tour
 * API via context. Wraps the app inside the Redux Provider (it relies on the
 * tour slice for state).
 */
export default function TourProvider({ children, autoStartForNewUsers = true }: Props) {
  const tour = useTour();
  const location = useLocation();

  // First-login auto-trigger: only on routes that have at least one tour
  // target (i.e. inside the authenticated app, not on /login or /landing).
  useEffect(() => {
    if (!autoStartForNewUsers) return;
    if (tour.active || tour.completed || tour.showCompletionModal) return;

    // Restrict auto-start to the authenticated app shell. We don't want the
    // tour overlaying the login or marketing pages.
    const path = location.pathname;
    const isAppShell = path.startsWith("/groups");
    if (!isAppShell) return;

    // Small delay so the destination page has time to mount its targets.
    const id = window.setTimeout(() => {
      tour.start();
    }, 600);
    return () => window.clearTimeout(id);
  }, [
    autoStartForNewUsers,
    location.pathname,
    tour.active,
    tour.completed,
    tour.showCompletionModal,
    tour.start,
    tour,
  ]);

  const value = useMemo(() => tour, [tour]);

  return (
    <TourContext.Provider value={value}>
      {children}
      <TourOverlay />
      <TourCompletionModal />
    </TourContext.Provider>
  );
}
