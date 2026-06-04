import { createEffect, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { Button } from "~/components/common/Button";
import { Modal } from "~/components/common/Modal";
import { baseEvalScore } from "~/store/evalStore";
import { activePlayerColor } from "~/store/settingsStore";

interface ResignConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResignConfirm: Component<ResignConfirmProps> = (props) => {
  const [msg, setMsg] = createSignal("gg wp");

  createEffect(() => {
    if (!props.open) return;
    const s = baseEvalScore();
    if (!s) {
      setMsg("gg wp");
      return;
    }
    let val = s.value;
    if (s.kind === "mate") {
      val = val > 0 ? 10000 : -10000;
    }
    const playerIsBlack = activePlayerColor() === "b";
    const approxPlayerCp = playerIsBlack ? -val : val;
    if (approxPlayerCp > -150) {
      setMsg("don't run away! you have a chance.");
    } else {
      setMsg("gg wp");
    }
  });

  return (
    <Modal open={props.open} onClose={props.onClose} title="Resign?" position="fixed">
      <div style={{ display: "flex", "flex-direction": "column", gap: "1rem", "align-items": "center" }}>
        <p style={{ margin: 0 }}>{msg()}</p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button onClick={props.onConfirm}>Yes, resign</Button>
          <Button onClick={props.onClose}>Keep fighting</Button>
        </div>
      </div>
    </Modal>
  );
};
