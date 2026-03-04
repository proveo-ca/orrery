import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { setCoachEmotion } from '../store/gameStore';

const isDebug = import.meta.env.VITE_DEBUG === 'true' || import.meta.env.MODE === 'debug';

export const DebugControls: Component = () => {
  return (
    <Show when={isDebug}>
      <div class="debug-panel" style={{ 
        "margin-top": "2rem", 
        "padding": "1rem", 
        "border": "1px dashed #ff6b6b", 
        "border-radius": "8px",
        "width": "100%",
        "box-sizing": "border-box"
      }}>
        <h4 style={{ "margin-top": "0", "margin-bottom": "1rem", "color": "#ff6b6b" }}>🛠 Debug: Trigger Emotions</h4>
        <div style={{ "display": "flex", "gap": "10px", "justify-content": "center", "flex-wrap": "wrap" }}>
          <button onClick={() => setCoachEmotion('idle')}>Idle</button>
          <button onClick={() => setCoachEmotion('watching')}>Watching</button>
          <button onClick={() => setCoachEmotion('thinking')}>Thinking</button>
          <button onClick={() => setCoachEmotion('happy')}>Happy</button>
          <button onClick={() => setCoachEmotion('shocked')}>Shocked</button>
          <button onClick={() => setCoachEmotion('sleepy')}>Sleepy</button>
          <button onClick={() => setCoachEmotion('sleeping')}>Sleeping</button>
        </div>
      </div>
    </Show>
  );
};
