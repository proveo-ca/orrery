import type { Component } from 'solid-js';
import type { PlayerColorPref } from '../../store/gameStore';
import './ColorSelector.css';

interface Props {
  value: PlayerColorPref;
  onChange: (val: PlayerColorPref) => void;
}

export const ColorSelector: Component<Props> = (props) => {
  return (
    <div class="color-selector">
      <button 
        class={props.value === 'w' ? 'active' : ''} 
        onClick={() => props.onChange('w')}
      >White</button>
      <button 
        class={props.value === 'random' ? 'active' : ''} 
        onClick={() => props.onChange('random')}
      >Random</button>
      <button 
        class={props.value === 'b' ? 'active' : ''} 
        onClick={() => props.onChange('b')}
      >Black</button>
    </div>
  );
};
