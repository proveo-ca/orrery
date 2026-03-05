import type { Component } from 'solid-js';
import { Modal } from './common/Modal';
import './Credits.css';

type Props = {
  open: boolean;
  onClose: () => void;
};

export const Credits: Component<Props> = (props) => {
  return (
    <Modal open={props.open} onClose={props.onClose} title="Credits" position="fixed">
      <div class="credits">
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
            <strong>The Eval Engine:</strong> by Stockfish <br />
            <a href="https://stockfishchess.org/" target="_blank" rel="noopener noreferrer">
              stockfishchess.org
            </a>
          </li>
          <li>
            <strong>The Brain:</strong> by Maia <br />
            <a href="https://maiachess.com/" target="_blank" rel="noopener noreferrer">
              maiachess.com
            </a>
          </li>
        </ul>
      </div>
    </Modal>
  );
};
