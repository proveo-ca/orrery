// SPEC: _spec/chess-coach/ui/components.puml
import { Show } from "solid-js";
import type { Component, JSX } from "solid-js";

import { Modal } from "~/components/atoms/Modal";
import styles from "~/components/features/GameOverBanner.module.css";

interface GameOverBannerProps {
  open: boolean;
  /** Terminal-state headline, e.g. "Checkmate" / "Resignation" / "Draw". */
  heading: string;
  /** Optional sub-line, e.g. "White resigned." (used by LAN). */
  detail?: string;
  /** Action buttons (Another Game / Review / Back to Menu — caller decides). */
  children: JSX.Element;
}

/**
 * The end-of-game banner shown over the board, shared by the Coach board
 * ({@link ChessBoard}) and LAN ({@link LanScreen}). Renders a non-dismissible,
 * board-absolute {@link Modal}; the caller supplies the headline, an optional
 * detail line, and the action buttons. The caller is responsible for the
 * positioned (relative) wrapper the absolute overlay fills.
 */
export const GameOverBanner: Component<GameOverBannerProps> = (props) => (
  <Modal
    open={props.open}
    position="absolute"
    dismissible={false}
    showCloseButton={false}
    overlayClass={styles.overlay}
    contentClass={styles.banner}
  >
    {/* Own flex wrapper — Modal nests children in a plain .modal-body block, so
        a gap on the content element wouldn't reach the title/buttons. */}
    <div class={styles.inner}>
      <h1 class={styles.result}>{props.heading}</h1>
      <Show when={props.detail}>
        <p class={styles.detail}>{props.detail}</p>
      </Show>
      <div class={styles.actions}>{props.children}</div>
    </div>
  </Modal>
);
