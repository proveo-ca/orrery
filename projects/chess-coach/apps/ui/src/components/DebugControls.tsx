import { Show, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { Button } from "~/components/common/Button";
import { setCoachEmotion } from "~/store/coachStore";

const isDebug = import.meta.env.VITE_DEBUG === "true" || import.meta.env.MODE === "debug";

const [debugHistoryOverlay, setDebugHistoryOverlay] = createSignal(false);
const [debugLightSpeedOverlay, setDebugLightSpeedOverlay] = createSignal(false);

export { debugHistoryOverlay, debugLightSpeedOverlay };

export const DebugControls: Component = () => {
  return (
    <Show when={isDebug}>
      <div
        class="debug-panel"
        style={{
          "margin-top": "2rem",
          padding: "1rem",
          border: "1px dashed #ff6b6b",
          "border-radius": "8px",
          width: "100%",
          "box-sizing": "border-box",
        }}
      >
        <h4 style={{ "margin-top": "0", "margin-bottom": "1rem", color: "#ff6b6b" }}>
          🛠 Debug: Trigger Emotions
        </h4>
        <div
          style={{ display: "flex", gap: "10px", "justify-content": "center", "flex-wrap": "wrap" }}
        >
          <Button onClick={() => setCoachEmotion("idle")}>Idle</Button>
          <Button onClick={() => setCoachEmotion("watching")}>Watching</Button>
          <Button onClick={() => setCoachEmotion("thinking")}>Thinking</Button>
          <Button onClick={() => setCoachEmotion("happy")}>Happy</Button>
          <Button onClick={() => setCoachEmotion("shocked")}>Shocked</Button>
        </div>

        <h4 style={{ "margin-top": "1rem", "margin-bottom": "0.5rem", color: "#ff6b6b" }}>
          🛠 Debug: Overlays
        </h4>
        <div
          style={{ display: "flex", gap: "10px", "justify-content": "center", "flex-wrap": "wrap" }}
        >
          <Button onClick={() => setDebugHistoryOverlay(!debugHistoryOverlay())}>
            History Overlay: {debugHistoryOverlay() ? "ON" : "OFF"}
          </Button>
          <Button onClick={() => setDebugLightSpeedOverlay(!debugLightSpeedOverlay())}>
            LightSpeed Overlay: {debugLightSpeedOverlay() ? "ON" : "OFF"}
          </Button>
        </div>
      </div>
    </Show>
  );
};
