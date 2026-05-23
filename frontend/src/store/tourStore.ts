import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export const TOUR_STORAGE_KEY = "arkalyn_tour_completed";

export interface TourState {
  /** Tour is mounted and a spotlight is being driven. */
  active: boolean;
  /** Index into TOUR_STEPS. */
  currentStep: number;
  /** Persisted: user has finished or dismissed the tour at least once. */
  completed: boolean;
  /** Final modal is visible. */
  showCompletionModal: boolean;
}

const readCompletedFlag = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const writeCompletedFlag = (value: boolean): void => {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(TOUR_STORAGE_KEY, "true");
    else window.localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    /* ignore — storage may be unavailable */
  }
};

const initialState: TourState = {
  active: false,
  currentStep: 0,
  completed: readCompletedFlag(),
  showCompletionModal: false,
};

const tourSlice = createSlice({
  name: "tour",
  initialState,
  reducers: {
    startTour(state) {
      state.active = true;
      state.currentStep = 0;
      state.showCompletionModal = false;
      state.completed = false;
      writeCompletedFlag(false);
    },
    nextStep(state) {
      state.currentStep += 1;
    },
    goToStep(state, action: PayloadAction<number>) {
      state.currentStep = action.payload;
    },
    finishTour(state) {
      state.active = false;
      state.showCompletionModal = true;
    },
    dismissTour(state) {
      state.active = false;
      state.completed = true;
      state.showCompletionModal = false;
      writeCompletedFlag(true);
    },
    resetTour(state) {
      state.active = false;
      state.completed = false;
      state.currentStep = 0;
      state.showCompletionModal = false;
      writeCompletedFlag(false);
    },
  },
});

export const {
  startTour,
  nextStep,
  goToStep,
  finishTour,
  dismissTour,
  resetTour,
} = tourSlice.actions;

export default tourSlice.reducer;
