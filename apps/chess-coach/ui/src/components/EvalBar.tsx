import {type Component} from 'solid-js';
import './EvalBar.css';

interface EvalBarProps {
  score?: { kind: 'cp' | 'mate'; value: number } | null;
  isFlipped?: boolean;
  maxPawns?: number;
  turn?: 'w' | 'b';
}

export const EvalBar: Component<EvalBarProps> = (props) => {
  const maxPawns = () => props.maxPawns ?? 10;

  // Convert relative score (side to move) to absolute score (White's perspective)
  const absoluteValue = () => {
    if (!props.score) return 0;
    let val = props.score.value;
    if (props.turn === 'b') val = -val;
    return val;
  };

  const numericValue = () => {
    if (!props.score) return 0;
    const val = absoluteValue();
    if (props.score.kind === 'mate') return val > 0 ? 100 : -100;
    return val / 100; // cp to pawns
  };

  // Normalize input: -maxPawns → +maxPawns becomes -1 → +1
  const normalized = () => {
    let norm = Math.max(-1, Math.min(1, numericValue() / maxPawns()));
    if (props.isFlipped) norm = -norm;
    return norm;
  };

  const whiteHeight = () => 50 + normalized() * 50; // % from top
  const blackHeight = () => 100 - whiteHeight();

  const displayValue = () => {
    if (!props.score) return '0.0';
    const val = absoluteValue();
    if (props.score.kind === 'mate') return val > 0 ? `+M${val}` : `-M${Math.abs(val)}`;
    const v = val / 100;
    return v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1);
  };

  const valueColor = () => {
    const v = numericValue();
    if (Math.abs(v) >= 9) return v > 0 ? '#ffeb3b' : '#64b5f6';
    return '#ffffff';
  };

  return (
    <div class="eval-bar">
      <div
        class="eval-white"
        style={{ height: `${whiteHeight()}%` }}
      />
      <div
        class="eval-black"
        style={{ height: `${blackHeight()}%` }}
      />
      <div class="eval-value" style={{ color: valueColor() }}>
        {displayValue()}
      </div>
    </div>
  );
}
