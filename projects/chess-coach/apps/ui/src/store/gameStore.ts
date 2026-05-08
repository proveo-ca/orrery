// SPEC: _spec/chess-coach/ui/components.puml
import { Chess, type Move } from "chess.js";
import { createSignal } from "solid-js";

import { capabilities } from "~/store/capabilitiesStore";
import { clearAdvice, dispatchCoachEvent, setAdvice } from "~/store/coachStore";
import { colorPref, setActivePlayerColor } from "~/store/settingsStore";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const STORAGE_KEY = "chess_coach_game_state";

export type MoveSquares = { from: string; to: string };

// ── Internal state ──────────────────────────────────────────────────────
let _game = new Chess();
let _startingFen = STARTING_FEN;

const [_isResigned, _setIsResigned] = createSignal(false);

// Version signal — bumped after every mutation to trigger SolidJS reactivity.
const [_version, _setVersion] = createSignal(0);

// Viewing cursor: 0 = starting position, N = after Nth half-move.
const [_currentIndex, _setCurrentIndex] = createSignal(0);

// Cached verbose history — rebuilt on every bump to avoid repeated walks.
const [_cachedHistory, _setCachedHistory] = createSignal<Move[]>([]);

function _bump() {
  _setCachedHistory(_game.history({ verbose: true }));
  _setVersion((v) => v + 1);
  _persist();
}

/** Trigger reactivity without writing to localStorage. Used by loadFen /
 *  loadGame so ephemeral screen loads don't overwrite the coach's saved game. */
function _notify() {
  _setCachedHistory(_game.history({ verbose: true }));
  _setVersion((v) => v + 1);
}

// ── Persistence ─────────────────────────────────────────────────────────
function _persist() {
  // Screens that flip `persistGame: false` (Analysis scratch-pad, Review)
  // share the same gameStore for reactivity but must not overwrite the
  // Coach's saved game in localStorage. Capability is initialised to the
  // Coach default at module load, so app startup writes still go through.
  if (!capabilities().persistGame) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        pgn: _game.pgn(),
        currentIndex: _currentIndex(),
        startingFen: _startingFen,
        isResigned: _isResigned(),
      }),
    );
  } catch (e) {
    console.error("Failed to persist game state", e);
  }
}

function _restore() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored);

    if (parsed.pgn !== undefined) {
      // New PGN format
      if (parsed.startingFen && parsed.startingFen !== STARTING_FEN) {
        _game = new Chess(parsed.startingFen);
        _startingFen = parsed.startingFen;
      }
      if (parsed.pgn) _game.loadPgn(parsed.pgn);
      _setCachedHistory(_game.history({ verbose: true }));
      if (typeof parsed.currentIndex === "number") {
        _setCurrentIndex(Math.min(parsed.currentIndex, _game.history().length));
      }
      if (parsed.isResigned) _setIsResigned(true);
    } else if (parsed.fenHistory) {
      // Legacy format — replay FEN transitions to rebuild history
      _migrateFromLegacy(parsed.fenHistory, parsed.currentIndex ?? 0);
    }
  } catch (e) {
    console.error("Failed to restore game state", e);
  }
}

function _migrateFromLegacy(fens: string[], index: number) {
  if (fens.length <= 1) {
    if (fens[0] && fens[0] !== STARTING_FEN) {
      _game = new Chess(fens[0]);
      _startingFen = fens[0];
    }
    return;
  }

  _game = new Chess(fens[0]);
  _startingFen = fens[0];

  for (let i = 1; i < fens.length; i++) {
    const targetFen = fens[i];
    const legalMoves = _game.moves({ verbose: true });
    const move = legalMoves.find((m) => m.after === targetFen);
    if (move) {
      _game.move({ from: move.from, to: move.to, promotion: move.promotion });
    } else {
      console.warn(`Legacy migration: could not find move for FEN at index ${i}`);
      break;
    }
  }

  _setCachedHistory(_game.history({ verbose: true }));
  _setCurrentIndex(Math.min(index, _game.history().length));
}

// Hydrate on module load
_restore();

/**
 * Re-read the coach's game from localStorage. Call on CoachScreen mount so
 * navigating back from Review / Analysis restores the live game instead of
 * whatever those screens loaded into gameStore.
 */
export const restoreGame = () => {
  _game = new Chess();
  _startingFen = STARTING_FEN;
  _setCurrentIndex(0);
  _setIsResigned(false);
  _restore();
  _setVersion((v) => v + 1);
};

// ── Derived accessors ───────────────────────────────────────────────────

/** The authoritative Chess instance with full history (reactive via version). */
export const game = (): Chess => {
  _version();
  return _game;
};

export const currentIndex = (): number => _currentIndex();

export const currentFen = (): string => {
  _version();
  const idx = _currentIndex();
  if (idx === 0) return _startingFen;
  const history = _cachedHistory();
  return history[idx - 1]?.after ?? _startingFen;
};

export const fenHistory = (): string[] => {
  _version();
  const history = _cachedHistory();
  const fens = [_startingFen];
  for (const m of history) fens.push(m.after);
  return fens;
};

export const moveHistory = (): (MoveSquares | null)[] => {
  _version();
  return _cachedHistory().map((m) => ({ from: m.from, to: m.to }));
};

export const isThreefoldRepetition = (): boolean => {
  _version();
  return _game.isThreefoldRepetition();
};

export const isResigned = (): boolean => _isResigned();

// ── Mutations ───────────────────────────────────────────────────────────

/** Apply a move by square coordinates. Handles branching when viewing past. */
export const addMove = (move: { from: string; to: string; promotion?: string }): Move => {
  // Branch: undo moves beyond the current view position
  const total = _game.history().length;
  const viewIdx = _currentIndex();
  if (viewIdx < total) {
    for (let i = 0; i < total - viewIdx; i++) _game.undo();
  }

  const result = _game.move(move);
  _setCurrentIndex(_game.history().length);
  _bump();
  return result;
};

/** Apply a move by SAN string (e.g. from AI response). */
export const addMoveSan = (san: string): Move => {
  const total = _game.history().length;
  const viewIdx = _currentIndex();
  if (viewIdx < total) {
    for (let i = 0; i < total - viewIdx; i++) _game.undo();
  }

  const result = _game.move(san);
  _setCurrentIndex(_game.history().length);
  _bump();
  return result;
};

export const goBack = () => {
  if (_currentIndex() > 0) {
    _setCurrentIndex((i) => i - 1);
    _persist();
  }
};

/** Jump the view cursor to an arbitrary ply, clamped to [0, history length]. */
export const setViewIndex = (index: number) => {
  const total = _game.history().length;
  _setCurrentIndex(Math.max(0, Math.min(index, total)));
  _persist();
};

export const goForward = () => {
  _version(); // reactive read
  if (_currentIndex() < _game.history().length) {
    _setCurrentIndex((i) => i + 1);
    _persist();
  }
};

export const resignGame = () => {
  _setIsResigned(true);
  _persist();
  dispatchCoachEvent({ type: "GAME_OVER", result: "loss" });
  setAdvice("You resigned. Another game?");
};

/**
 * Replace the board with a FEN position without firing NEW_GAME / advice
 * side effects. Used by the Analysis screen's "Load from FEN" input.
 * Throws when `fen` is malformed (chess.js validates on construction).
 */
export const loadFen = (fen: string) => {
  const next = new Chess(fen);
  _game = next;
  _startingFen = fen;
  _setCurrentIndex(0);
  _setIsResigned(false);
  _notify(); // ephemeral — don't overwrite the coach's saved game
};

/**
 * Replay a stored game into gameStore (PGN + startingFen), parking the view
 * cursor at the starting position so the user can step forward through the
 * move history. Used by ReviewScreen. Throws if the PGN is malformed.
 */
export const loadGame = (args: { pgn: string; startingFen: string }) => {
  const next = new Chess(args.startingFen);
  next.loadPgn(args.pgn);
  _game = next;
  _startingFen = args.startingFen;
  _setCurrentIndex(0);
  _setIsResigned(false);
  _notify(); // ephemeral — don't overwrite the coach's saved game
};

export const resetGame = (fen: string = STARTING_FEN) => {
  _game = new Chess(fen);
  _startingFen = fen;
  _setCurrentIndex(0);
  _setIsResigned(false);
  _bump();

  clearAdvice();

  // Resolve random color
  let nextColor: "w" | "b" = "w";
  const pref = colorPref();
  if (pref === "random") {
    nextColor = Math.random() > 0.5 ? "w" : "b";
  } else {
    nextColor = pref;
  }
  setActivePlayerColor(nextColor);

  if (nextColor === "w") {
    setAdvice("New game! You play White. Your move!");
  } else {
    setAdvice("New game! You play Black. I'm thinking...");
  }

  dispatchCoachEvent({ type: "NEW_GAME" });
};
