// apps/chess-coach/ui/src/components/CapturedPieces.tsx
import { type Component, createMemo } from 'solid-js';
import { currentFen, activePlayerColor } from '../store';
import { isTravelling, travelFen } from '../store/travelState';

const START_COUNTS: Record<string, number> = {
  P: 8, N: 2, B: 2, R: 2, Q: 1,
  p: 8, n: 2, b: 2, r: 2, q: 1,
};

const VALUES: Record<string, number> = {
  P: 1, N: 3, B: 3, R: 5, Q: 9,
  p: 1, n: 3, b: 3, r: 5, q: 9,
};

// Use filled shapes for all pieces so we can color them via CSS
const UNICODE_PIECES: Record<string, string> = {
  P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛',
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛',
};

// Sort order: Queens first, then Rooks, Bishops, Knights, Pawns
const SORT_ORDER = ['Q', 'R', 'B', 'N', 'P', 'q', 'r', 'b', 'n', 'p'];

export const CapturedPieces: Component = () => {
  const activeFen = createMemo(() => isTravelling() ? travelFen() : currentFen());

  const stats = createMemo(() => {
    const fen = activeFen().split(' ')[0];
    const counts: Record<string, number> = {
      P: 0, N: 0, B: 0, R: 0, Q: 0,
      p: 0, n: 0, b: 0, r: 0, q: 0,
    };

    for (const char of fen) {
      if (counts[char] !== undefined) counts[char]++;
    }

    const capturedWhite: string[] = [];
    const capturedBlack: string[] = [];
    let whiteMat = 0;
    let blackMat = 0;

    for (const p of Object.keys(START_COUNTS)) {
      const isWhite = p === p.toUpperCase();
      const countOnBoard = counts[p];
      const capturedCount = START_COUNTS[p] - countOnBoard;
      
      if (isWhite) {
        whiteMat += countOnBoard * VALUES[p];
        for (let i = 0; i < capturedCount; i++) capturedWhite.push(p);
      } else {
        blackMat += countOnBoard * VALUES[p];
        for (let i = 0; i < capturedCount; i++) capturedBlack.push(p);
      }
    }

    capturedWhite.sort((a, b) => SORT_ORDER.indexOf(a) - SORT_ORDER.indexOf(b));
    capturedBlack.sort((a, b) => SORT_ORDER.indexOf(a) - SORT_ORDER.indexOf(b));

    const humanColor = activePlayerColor();
    const aiColor = humanColor === 'w' ? 'b' : 'w';

    const aiCaptured = aiColor === 'b' ? capturedWhite : capturedBlack;
    const humanCaptured = humanColor === 'b' ? capturedWhite : capturedBlack;

    const aiMat = aiColor === 'b' ? blackMat : whiteMat;
    const humanMat = humanColor === 'b' ? blackMat : whiteMat;

    const aiAdvantage = aiMat - humanMat;
    const humanAdvantage = humanMat - aiMat;

    return { aiCaptured, humanCaptured, aiAdvantage, humanAdvantage };
  });

  const renderPieces = (pieces: string[]) => {
    return pieces.map(p => {
      const isWhite = p === p.toUpperCase();
      return (
        <span style={isWhite 
          ? { color: '#fff' } 
          : { color: '#000', "text-shadow": "-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff" }
        }>
          {UNICODE_PIECES[p]}
        </span>
      );
    });
  };

  return (
    <div style={{ 
      display: 'flex', 
      "justify-content": 'space-between', 
      width: '100%', 
      "margin-bottom": '8px', 
      "font-size": '1.5rem',
      "line-height": '1'
    }}>
      {/* Left: AI's captures */}
      <div style={{ display: 'flex', gap: '4px', "align-items": 'center' }}>
        <span>{renderPieces(stats().aiCaptured)}</span>
        {stats().aiAdvantage > 0 && (
          <span style={{ "font-size": '1rem', "margin-left": '8px', color: '#888' }}>
            +{stats().aiAdvantage}
          </span>
        )}
      </div>

      {/* Right: Human's captures */}
      <div style={{ display: 'flex', gap: '4px', "align-items": 'center' }}>
        {stats().humanAdvantage > 0 && (
          <span style={{ "font-size": '1rem', "margin-right": '8px', color: '#888' }}>
            +{stats().humanAdvantage}
          </span>
        )}
        <span>{renderPieces(stats().humanCaptured)}</span>
      </div>
    </div>
  );
};
