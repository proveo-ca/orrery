import type { PieceSet } from "~/types/settings";
import type { Color } from "chess.js";
import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import { Modal } from "~/components/atoms/Modal";
import styles from "~/components/primitives/PromotionModal.module.css";

import type { PromotionPiece } from "~/types/chess";

export type PendingPromotion = {
  color: Color;
  pieceSet: PieceSet;
};

interface PromotionModalProps {
  pending: PendingPromotion | null;
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

const CHOICES: PromotionPiece[] = ["q", "r", "b", "n"];

const getPieceImg = (piece: PromotionPiece, color: Color, pieceSet: PieceSet) =>
  `/chess/pieces/${pieceSet}/${color}${piece.toUpperCase()}.svg`;

export const PromotionModal: Component<PromotionModalProps> = (props) => {
  return (
    <Modal
      open={!!props.pending}
      title="Promote pawn"
      position="absolute"
      onClose={props.onCancel}
      dismissible={true}
    >
      <Show when={props.pending}>
        {(pending) => (
          <div class={styles.choices}>
            <For each={CHOICES}>
              {(piece) => (
                <button
                  type="button"
                  class={styles.choice}
                  onClick={() => props.onSelect(piece)}
                  aria-label={`Promote to ${piece}`}
                >
                  <img
                    src={getPieceImg(piece, pending().color, pending().pieceSet)}
                    alt=""
                    class={styles.pieceImg}
                  />
                </button>
              )}
            </For>
          </div>
        )}
      </Show>
    </Modal>
  );
};
