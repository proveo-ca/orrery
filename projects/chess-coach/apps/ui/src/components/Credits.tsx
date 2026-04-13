import type { Component } from "solid-js";

import { Modal } from "~/components/common/Modal";
import styles from "~/components/Credits.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export const Credits: Component<Props> = (props) => {
  const isWebMode = import.meta.env.VITE_TARGET === "web";

  return (
    <Modal open={props.open} onClose={props.onClose} title="Credits" position="fixed">
      <div class={styles.credits}>
        <ul>
          <li>
            <strong>The Cat:</strong> by Johan Mouchet <br />
            <a href="https://codepen.io/johanmouchet" target="_blank" rel="noopener noreferrer">
              codepen.io/johanmouchet
            </a>
          </li>
          <li>
            <strong>The Board:</strong> by Jeff Hlywa <br />
            <a href="https://github.com/jhlywa/chess.js" target="_blank" rel="noopener noreferrer">
              github.com/jhlywa/chess.js
            </a>
          </li>
          <li>
            <strong>The Pieces:</strong> by Colin M.L. Burnett (via Lichess) <br />
            <a
              href="https://github.com/lichess-org/lila/tree/master/public/piece/cburnett"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/lichess-org/lila
            </a>
          </li>
          <li>
            <strong>The Eval Engine:</strong> by Stockfish <br />
            <a href="https://stockfishchess.org/" target="_blank" rel="noopener noreferrer">
              stockfishchess.org
            </a>
          </li>
          <li>
            <strong>The Brain (Chess Moves):</strong> by Maia <br />
            <a href="https://maiachess.com/" target="_blank" rel="noopener noreferrer">
              maiachess.com
            </a>
          </li>
          <li>
            <strong>The Brain (Chess Commentary):</strong> by NAKST Studio <br />
            <a href="https://nakststudio.com/" target="_blank" rel="noopener noreferrer">
              nakststudio.com
            </a>
          </li>
          <li>
            <strong>
              {isWebMode ? "All running in your browser:" : "All running in your PC:"}
            </strong>{" "}
            by Roberto von Schoettler <br />
            <a href="https://github.com/proveo-ca" target="_blank" rel="noopener noreferrer">
              github.com/proveo-ca
            </a>
          </li>
        </ul>
      </div>
    </Modal>
  );
};
