import {type Component} from 'solid-js';
import './EvalBar.css';

interface EvalBarProps {
  value?: number;
  maxPawns?: number;
}

export const EvalBar: Component = (props: EvalBarProps) => {
  const maxPawns = () => props.maxPawns ?? 10;

  // Normalize input: -maxPawns → +maxPawns becomes -1 → +1
  const normalized = () => {
    const v = props.value ?? 0;
    return Math.max(-1, Math.min(1, v / maxPawns()));
  };

  const whiteHeight = () => 50 + normalized() * 50; // % from top
  const blackHeight = () => 100 - whiteHeight();
  const dividerTop = () => (100 - whiteHeight()) + '%';

  const displayValue = () => {
    const v = props.value ?? 0;
    if (Math.abs(v) > 50) return v > 0 ? 'M1' : '-M1'; // fake mate example
    return v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1);
  };

  const valueColor = () => {
    const v = props.value ?? 0;
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