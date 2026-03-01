import { createSignal, createEffect, For } from 'solid-js';
import type { Component } from 'solid-js';
import { Chess } from 'chess.js';
import type { Square, PieceSymbol, Color } from 'chess.js';
import { currentFen, addMoveToHistory, setAdvice, isCoachMode, coachEmotion, setCoachEmotion, adviceHoveredSquares } from '../store/gameStore';
import { logger } from '../utils/logger';
import './ChessBoard.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const getPieceImg = (type: PieceSymbol, color: Color) => {
  const piece = type.toUpperCase();
  return `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/${color}${piece}.svg`;
};

export const BoardWrapper: Component = () => {
  const [game, setGame] = createSignal(new Chess(currentFen()));
  const [selectedSquare, setSelectedSquare] = createSignal<Square | null>(null);
  const [hoveredSquare, setHoveredSquare] = createSignal<Square | null>(null);
  const [validMoves, setValidMoves] = createSignal<string[]>([]);

  createEffect(() => {
    setGame(new Chess(currentFen()));
    setSelectedSquare(null);
    setValidMoves([]);
  });

  const handleBoardMouseEnter = () => {
    if (coachEmotion() === 'idle') setCoachEmotion('watching');
  };

  const handleBoardMouseLeave = () => {
    setHoveredSquare(null);
    if (coachEmotion() === 'watching') setCoachEmotion('idle');
  };

  const handleSquareClick = async (square: Square) => {
    const g = game();
    const selected = selectedSquare();
    const pieceOnSquare = g.get(square);

    logger.action('Square Clicked', { square, piece: pieceOnSquare, currentlySelected: selected });

    if (selected === square) {
      setSelectedSquare(null);
      setValidMoves([]);
      return;
    }

    if (selected) {
      const moves = g.moves({ square: selected, verbose: true });
      const move = moves.find(m => m.to === square);

      if (move) {
        try {
          const gameCopy = new Chess(g.fen());
          const result = gameCopy.move({ from: selected, to: square, promotion: 'q' });

          if (result) {
            addMoveToHistory(gameCopy.fen());
            setSelectedSquare(null);
            setValidMoves([]);
            setHoveredSquare(null);

            if (isCoachMode()) {
              setAdvice("Thinking...");
              setCoachEmotion('thinking'); // Trigger thinking animation
              
              const response = await fetch(`${API_URL}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ move: result.san, fen: gameCopy.fen() })
              });

              if (response.ok) {
                const data = await response.json();
                addMoveToHistory(data.fen);
                setAdvice(data.advice);
                
                // Simple heuristic: if advice contains "blunder" or "mistake", look shocked
                const adviceLower = data.advice.toLowerCase();
                if (adviceLower.includes('blunder') || adviceLower.includes('mistake') || adviceLower.includes('inaccuracy')) {
                  setCoachEmotion('shocked');
                } else {
                  setCoachEmotion('happy');
                }
                
                setTimeout(() => {
                  if (coachEmotion() === 'happy' || coachEmotion() === 'shocked') setCoachEmotion('idle');
                }, 3000);
                
              } else {
                setAdvice("Error communicating with the coach.");
                setCoachEmotion('shocked');
                setTimeout(() => {
                  if (coachEmotion() === 'shocked') setCoachEmotion('idle');
                }, 2000);
              }
            } else {
              setAdvice(gameCopy.turn() === 'w' ? "White to move." : "Black to move.");
            }
          }
        } catch (e) {
          logger.error("Move execution error", e);
        }
        return;
      } else {
        // Clicked an invalid destination square while a piece was selected
        if (isCoachMode()) {
          setCoachEmotion('shocked');
          setTimeout(() => { if (coachEmotion() === 'shocked') setCoachEmotion('idle'); }, 1000);
        }
      }
    }

    // Determine if the user is allowed to touch this piece
    const isPlayerTurn = pieceOnSquare && pieceOnSquare.color === g.turn();
    const canTouch = isCoachMode() ? (g.turn() === 'w' && pieceOnSquare?.color === 'w') : isPlayerTurn;

    if (canTouch) {
      setSelectedSquare(square);
      const moves = g.moves({ square, verbose: true });
      setValidMoves(moves.map(m => m.to));
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
      if (pieceOnSquare && isCoachMode()) {
        // Tried to touch an enemy piece
        setCoachEmotion('shocked');
        setTimeout(() => { if (coachEmotion() === 'shocked') setCoachEmotion('idle'); }, 1000);
      }
    }
  };

  return (
    <div 
      class="chessboard-container" 
      onMouseEnter={handleBoardMouseEnter}
      onMouseLeave={handleBoardMouseLeave}
    >
      <div class="chessboard">
        <For each={RANKS}>
          {(rank, rIndex) => (
            <For each={FILES}>
              {(file, fIndex) => {
                const square = `${file}${rank}` as Square;
                
                const piece = () => game().get(square);
                const isSelected = () => selectedSquare() === square;
                const isHovered = () => hoveredSquare() === square;
                const isValidMove = () => validMoves().includes(square);
                const isCapture = () => isValidMove() && !!piece();
                const isAdviceHovered = () => adviceHoveredSquares().includes(square);

                const isInvalid = () => {
                  if (!isHovered()) return false;
                  const selected = selectedSquare();
                  if (selected) {
                    return !isValidMove() && square !== selected;
                  } else {
                    const p = piece();
                    if (!p) return false;
                    // In coach mode, hovering over black pieces or hovering when it's black's turn is invalid
                    if (isCoachMode()) {
                      return p.color !== 'w' || game().turn() !== 'w';
                    }
                    return p.color !== game().turn();
                  }
                };

                return (
                  <div
                    classList={{
                      square: true,
                      light: (rIndex() + fIndex()) % 2 === 0,
                      dark: (rIndex() + fIndex()) % 2 !== 0,
                      selected: isSelected(),
                      'valid-move': isValidMove() && !isCapture(),
                      capture: isCapture(),
                      hovered: isHovered() && !isInvalid(),
                      invalid: isInvalid(),
                      'advice-highlight': isAdviceHovered(),
                      'has-piece': !!piece()
                    }}
                    onClick={() => handleSquareClick(square)}
                    onMouseEnter={() => setHoveredSquare(square)}
                  >
                    {/* Render Rank (Numbers) on the first column */}
                    {fIndex() === 0 && <span class="coordinate rank-label">{rank}</span>}
                    
                    {/* Render File (Letters) on the last row */}
                    {rIndex() === 7 && <span class="coordinate file-label">{file}</span>}

                    {piece() && (
                      <img
                        src={getPieceImg(piece()!.type, piece()!.color)}
                        alt={`${piece()!.color} ${piece()!.type}`}
                        class="piece"
                        draggable="false"
                      />
                    )}
                  </div>
                );
              }}
            </For>
          )}
        </For>
      </div>
    </div>
  );
};
