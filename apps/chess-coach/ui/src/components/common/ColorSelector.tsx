import type { Component } from 'solid-js';
import type { PlayerColorPref } from '../../store/settingsState';
import { Button } from './Button';
import './ColorSelector.css';

interface Props {
  value: PlayerColorPref;
  onChange: (val: PlayerColorPref) => void;
}

export const ColorSelector: Component<Props> = (props) => {
  return (
    <div class="color-selector">
      <Button 
        class={props.value === 'w' ? 'active' : ''} 
        onClick={() => props.onChange('w')}
      >White</Button>
      <Button 
        class={props.value === 'random' ? 'active' : ''} 
        onClick={() => props.onChange('random')}
      >Random</Button>
      <Button 
        class={props.value === 'b' ? 'active' : ''} 
        onClick={() => props.onChange('b')}
      >Black</Button>
    </div>
  );
};
