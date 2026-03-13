import {type Component} from 'solid-js';
import './EvalBar.css';

interface EvalBarProps {
  score?: { kind: 'cp' | 'mate'; value: number } | null;
  isFlipped?: boolean;
  maxPawns?: number;
}

export const EvalBar: Component<EvalBarProps> = (props) => {
  const maxPawns = () => props.maxPawns ?? 10;

  const numericValue = () => {
    if (!props.score) return 0;
    if (props.score.kind === 'mate') return props.score.value > 0 ? 100 : -100;
    return props.score.value / 100; // cp to pawns
  };

  // Normalize input: -maxPawns → +maxPawns becomes -1 → +1
  const normalized = () => {
    let norm = Math.max(-1, Math.min(1, numericValue() / maxPawns()));
    if (props.isFlipped) norm = -norm;
    return norm;
  };

  const whiteHeight = () => 50 + normalized() * 50; // % from top
  const blackHeight = () => 100 - whiteHeight();
  const dividerTop = () => (100 - whiteHeight()) + '%';

  const displayValue = () => {
    if (!props.score) return '0.0';
    if (props.score.kind === 'mate') return `M${Math.abs(props.score.value)}`;
    const v = props.score.value / 100;
    return v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1);
  };

  const valueColor = () => {
    const v = numericValue();
    if (Math.abs(v) >= 9) return v > 0 ? '#ffeb3b' : '#64b5f6';
    return '#ffffff';
  };

  return (
    <div class="eval-container">
      <div class="eval-bar">
        <div
          class="eval-white"
          style={{ height: `${whiteHeight()}%` }}
        />
        <div
          class="eval-black"
          style={{ height: `${blackHeight()}%` }}
        />
        <div class="eval-divider" style={{ top: dividerTop() }} />
        <div class="eval-value" style={{ color: valueColor() }}>
          {displayValue()}
        </div>
      </div>
    </div>
  );
}
