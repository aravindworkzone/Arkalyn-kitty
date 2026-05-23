import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../redux/store";
import {
  startTour,
  nextStep,
  goToStep,
  finishTour,
  dismissTour,
  resetTour,
} from "../store/tourStore";
import { TOUR_STEPS, TOUR_STEP_COUNT, type TourStep } from "./tourSteps";

export interface UseTourResult {
  active: boolean;
  completed: boolean;
  showCompletionModal: boolean;
  currentStepIndex: number;
  currentStep: TourStep | null;
  totalSteps: number;
  /** Begin the tour from step 0. Clears the persisted completion flag. */
  start: () => void;
  /** Advance to the next step, or finish if at the end. */
  advance: () => void;
  /** Jump to a specific step index. */
  jumpTo: (index: number) => void;
  /** Finish the tour and show the completion modal. */
  finish: () => void;
  /** Close the completion modal and mark the tour done. */
  dismiss: () => void;
  /** Reset to "never seen" (used by "Take a Tour" trigger). */
  reset: () => void;
}

export const useTour = (): UseTourResult => {
  const dispatch = useDispatch();
  const tour = useSelector((state: RootState) => state.tour);

  const currentStep = useMemo<TourStep | null>(() => {
    if (!tour.active) return null;
    if (tour.currentStep < 0 || tour.currentStep >= TOUR_STEPS.length) return null;
    return TOUR_STEPS[tour.currentStep];
  }, [tour.active, tour.currentStep]);

  const advance = useCallback(() => {
    if (!tour.active) return;
    if (tour.currentStep + 1 >= TOUR_STEP_COUNT) {
      dispatch(finishTour());
    } else {
      dispatch(nextStep());
    }
  }, [dispatch, tour.active, tour.currentStep]);

  const start = useCallback(() => {
    dispatch(startTour());
  }, [dispatch]);

  const jumpTo = useCallback((index: number) => {
    dispatch(goToStep(index));
  }, [dispatch]);

  const finish = useCallback(() => {
    dispatch(finishTour());
  }, [dispatch]);

  const dismiss = useCallback(() => {
    dispatch(dismissTour());
  }, [dispatch]);

  const reset = useCallback(() => {
    dispatch(resetTour());
  }, [dispatch]);

  return {
    active: tour.active,
    completed: tour.completed,
    showCompletionModal: tour.showCompletionModal,
    currentStepIndex: tour.currentStep,
    currentStep,
    totalSteps: TOUR_STEP_COUNT,
    start,
    advance,
    jumpTo,
    finish,
    dismiss,
    reset,
  };
};
