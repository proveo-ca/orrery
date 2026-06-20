// SPEC: _spec/chess-coach/ui/components.puml
import type { MoveSquares } from "~/types/game";
import { createStore } from "solid-js/store";

type TravelState = {
  active: boolean;
  fenHistory: string[];
  moveHistory: (MoveSquares | null)[];
  currentIndex: number;
};

const [travelState, setTravelState] = createStore<TravelState>({
  active: false,
  fenHistory: [],
  moveHistory: [],
  currentIndex: 0,
});

export const isTravelling = () => travelState.active;
export const travelFenHistory = () => travelState.fenHistory;
export const travelMoveHistory = () => travelState.moveHistory;
export const travelIndex = () => travelState.currentIndex;
export const travelFen = () => travelState.fenHistory[travelState.currentIndex] ?? "";

export const startTravel = (fens: string[], moves: (MoveSquares | null)[]) => {
  setTravelState({
    active: true,
    fenHistory: fens,
    moveHistory: moves,
    currentIndex: 0,
  });
};

export const travelForward = () => {
  if (travelState.currentIndex < travelState.fenHistory.length - 1) {
    setTravelState("currentIndex", travelState.currentIndex + 1);
  }
};

export const travelBack = () => {
  if (travelState.currentIndex > 0) {
    setTravelState("currentIndex", travelState.currentIndex - 1);
  }
};

export const exitTravel = () => {
  setTravelState({
    active: false,
    fenHistory: [],
    moveHistory: [],
    currentIndex: 0,
  });
};
