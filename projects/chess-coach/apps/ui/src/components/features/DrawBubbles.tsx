// SPEC: _spec/chess-coach/multiplayer.puml
import type { Chess, Color } from "chess.js";
import { Show, type Component } from "solid-js";

import styles from "~/components/features/DrawBubbles.module.css";
import { ChatBubble } from "~/components/primitives/ChatBubble";
import { usePresence } from "~/hooks/usePresence";
import { game } from "~/store/gameStore";
import { draw } from "~/store/roomStore";
import { activePlayerColor } from "~/store/settingsStore";

interface DrawBubblesProps {
  onOfferClick?: () => void;
}

const BUBBLE_PCT = 8.5;

function findKing(g: Chess, color: Color): { file: number; rank: number } | null {
  const board = g.board();
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = board[row][col];
      if (cell && cell.type === "k" && cell.color === color) {
        return { file: col, rank: 8 - row };
      }
    }
  }
  return null;
}

export const DrawBubbles: Component<DrawBubblesProps> = (props) => {
  const offerColor = (): Color | null => draw()?.by ?? null;
  const opponentColor = (): Color | null => {
    const d = draw();
    return d ? (d.by === "w" ? "b" : "w") : null;
  };
  const refuseColor = (): Color | null => (draw()?.status === "declined" ? opponentColor() : null);
  const agreeColor = (): Color | null => (draw()?.status === "agreed" ? opponentColor() : null);

  const kingCellStyle = (color: () => Color | null) => {
    let last = { left: "0%", top: "0%" };
    return () => {
      const c = color();
      if (c) {
        const king = findKing(game(), c);
        if (king) {
          const flipped = activePlayerColor() === "b";
          const col = flipped ? 7 - king.file : king.file;
          const row = flipped ? king.rank - 1 : 8 - king.rank;
          const cornerX = (col + 1) * 12.5;
          const cornerY = row * 12.5;
          const clamp = (v: number) => Math.max(0, Math.min(100 - BUBBLE_PCT, v));
          last = {
            left: `${clamp(cornerX - BUBBLE_PCT * 0.45)}%`,
            top: `${clamp(cornerY - BUBBLE_PCT * 0.55)}%`,
          };
        }
      }
      return last;
    };
  };
  const offerStyle = kingCellStyle(offerColor);
  const refuseStyle = kingCellStyle(refuseColor);
  const agreeStyle = kingCellStyle(agreeColor);

  const offer = usePresence(() => !!draw());
  const refuse = usePresence(() => draw()?.status === "declined");
  const agree = usePresence(() => draw()?.status === "agreed");

  return (
    <div class={styles.overlay}>
      <div class={styles.cell} style={offerStyle()}>
        <Show when={offer.present()}>
          <ChatBubble
            exiting={offer.exiting()}
            onClick={props.onOfferClick}
            class={styles.drawBubble}
            testId="draw-offer-bubble"
            label="Draw offer"
          >
            🤝
          </ChatBubble>
        </Show>
      </div>
      <div class={styles.cell} style={refuseStyle()}>
        <Show when={refuse.present()}>
          <ChatBubble exiting={refuse.exiting()} class={styles.drawBubble} testId="draw-reject-bubble">
            ⚔️
          </ChatBubble>
        </Show>
      </div>
      <div class={styles.cell} style={agreeStyle()}>
        <Show when={agree.present()}>
          <ChatBubble exiting={agree.exiting()} class={styles.drawBubble} testId="draw-agree-bubble">
            🤝
          </ChatBubble>
        </Show>
      </div>
    </div>
  );
};
