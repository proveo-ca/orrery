import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSignal } from 'solid-js';
import { Chess, type Square } from 'chess.js';
import { useHoverEvaluator, type HoverEval } from '../../src/hooks/useHoverEvaluator';
import { renderHookTest } from '../utils/test-effect';
import * as coachState from '../../src/store/coachState';

// Mock the store setters so we can spy on them
vi.mock('../../src/store/coachState', () => ({
  setHoverAdvice: vi.fn(),
  setHoverEmotion: vi.fn(),
  setHoverBlunder: vi.fn(),
}));

vi.mock('../../src/store/gameState', () => ({
  currentFen: vi.fn(() => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
}));

describe('useHoverEvaluator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects a blunder when the evaluation drops by more than 200 centipawns', () => {
    const [canApply] = createSignal(true);
    const [hovered] = createSignal<Square>('e4');
    const [selected] = createSignal<Square>('e2');
    
    // FEN after White plays e2-e4
    const [hoverEval] = createSignal<HoverEval>({
      id: 1,
      from: 'e2',
      to: 'e4',
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    });
    
    // Base score: White is slightly better (+50 cp)
    const [baseScore] = createSignal({ kind: 'cp' as const, value: 50 });
    const [game] = createSignal(new Chess());
    const [analysis, setAnalysis] = createSignal<any>({ lastInfo: null });

    renderHookTest({
      hook: useHoverEvaluator,
      props: {
        canApplyHoverOverride: canApply,
        hoveredSquare: hovered,
        selectedSquare: selected,
        currentHoverEval: hoverEval,
        analysis,
        baseEvalScore: baseScore,
        game
      }
    });

    // Trigger the effect: AI (Black) evaluates the position as +250 for itself.
    // This means White's score dropped from +50 to -250 (a delta of -300 cp).
    setAnalysis({
      lastInfo: {
        score: { kind: 'cp', value: 250 },
        pv: ['e7e5'] // Must be a valid move for Black in the eval FEN to pass the race-condition check
      }
    });

    expect(coachState.setHoverBlunder).toHaveBeenCalledWith(true, expect.any(String), 'e4');
    expect(coachState.setHoverEmotion).toHaveBeenCalledWith('shocked');
    expect(coachState.setHoverAdvice).toHaveBeenCalledWith(expect.stringContaining('is a blunder'));
  });

  it('does not detect a blunder for a good move', () => {
    const [canApply] = createSignal(true);
    const [hovered] = createSignal<Square>('e4');
    const [selected] = createSignal<Square>('e2');
    const [hoverEval] = createSignal<HoverEval>({
      id: 1,
      from: 'e2',
      to: 'e4',
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    });
    
    // Base score: White is slightly better (+50 cp)
    const [baseScore] = createSignal({ kind: 'cp' as const, value: 50 });
    const [game] = createSignal(new Chess());
    const [analysis, setAnalysis] = createSignal<any>({ lastInfo: null });

    renderHookTest({
      hook: useHoverEvaluator,
      props: {
        canApplyHoverOverride: canApply,
        hoveredSquare: hovered,
        selectedSquare: selected,
        currentHoverEval: hoverEval,
        analysis,
        baseEvalScore: baseScore,
        game
      }
    });

    // Trigger the effect: AI (Black) evaluates the position as -60 for itself.
    // This means White's score improved from +50 to +60 (a delta of +10 cp).
    setAnalysis({
      lastInfo: {
        score: { kind: 'cp', value: -60 },
        pv: ['e7e5']
      }
    });

    expect(coachState.setHoverBlunder).not.toHaveBeenCalled();
    expect(coachState.setHoverEmotion).not.toHaveBeenCalled();
    expect(coachState.setHoverAdvice).not.toHaveBeenCalled();
  });

  it('detects a blunder when moving into a forced mate', () => {
    const [canApply] = createSignal(true);
    const [hovered] = createSignal<Square>('e4');
    const [selected] = createSignal<Square>('e2');
    const [hoverEval] = createSignal<HoverEval>({
      id: 1, from: 'e2', to: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    });
    
    // Base score: White is slightly better (+50 cp)
    const [baseScore] = createSignal({ kind: 'cp' as const, value: 50 });
    const [game] = createSignal(new Chess());
    const [analysis, setAnalysis] = createSignal<any>({ lastInfo: null });

    renderHookTest({
      hook: useHoverEvaluator,
      props: { canApplyHoverOverride: canApply, hoveredSquare: hovered, selectedSquare: selected, currentHoverEval: hoverEval, analysis, baseEvalScore: baseScore, game }
    });

    // AI (Black) has a forced mate in 2 (positive mate value means AI is winning)
    setAnalysis({
      lastInfo: {
        score: { kind: 'mate', value: 2 },
        pv: ['e7e5']
      }
    });

    // Human went from +50 to -10000 (getting mated). Definitely a blunder!
    expect(coachState.setHoverBlunder).toHaveBeenCalledWith(true, expect.any(String), 'e4');
    expect(coachState.setHoverEmotion).toHaveBeenCalledWith('shocked');
  });

  it('does not detect a blunder when finding a forced mate', () => {
    const [canApply] = createSignal(true);
    const [hovered] = createSignal<Square>('e4');
    const [selected] = createSignal<Square>('e2');
    const [hoverEval] = createSignal<HoverEval>({
      id: 1, from: 'e2', to: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    });
    
    // Base score: White is slightly better (+50 cp)
    const [baseScore] = createSignal({ kind: 'cp' as const, value: 50 });
    const [game] = createSignal(new Chess());
    const [analysis, setAnalysis] = createSignal<any>({ lastInfo: null });

    renderHookTest({
      hook: useHoverEvaluator,
      props: { canApplyHoverOverride: canApply, hoveredSquare: hovered, selectedSquare: selected, currentHoverEval: hoverEval, analysis, baseEvalScore: baseScore, game }
    });

    // AI (Black) is getting mated in 2 (negative mate value means AI is losing)
    setAnalysis({
      lastInfo: {
        score: { kind: 'mate', value: -2 },
        pv: ['e7e5']
      }
    });

    // Human went from +50 to +10000 (delivering mate). Great move, not a blunder.
    expect(coachState.setHoverBlunder).not.toHaveBeenCalled();
  });

  it('does not detect a blunder if already getting mated and still getting mated', () => {
    const [canApply] = createSignal(true);
    const [hovered] = createSignal<Square>('e4');
    const [selected] = createSignal<Square>('e2');
    const [hoverEval] = createSignal<HoverEval>({
      id: 1, from: 'e2', to: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    });
    
    // Base score: White is already getting mated in 3 (negative mate value for White)
    const [baseScore] = createSignal({ kind: 'mate' as const, value: -3 });
    const [game] = createSignal(new Chess());
    const [analysis, setAnalysis] = createSignal<any>({ lastInfo: null });

    renderHookTest({
      hook: useHoverEvaluator,
      props: { canApplyHoverOverride: canApply, hoveredSquare: hovered, selectedSquare: selected, currentHoverEval: hoverEval, analysis, baseEvalScore: baseScore, game }
    });

    // AI (Black) still has a forced mate in 2
    setAnalysis({
      lastInfo: {
        score: { kind: 'mate', value: 2 },
        pv: ['e7e5']
      }
    });

    // Human went from -10000 to -10000. Delta is 0. Not a *new* blunder.
    expect(coachState.setHoverBlunder).not.toHaveBeenCalled();
  });
});
