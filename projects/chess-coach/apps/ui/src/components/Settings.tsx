import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";

import { Button } from "~/components/common/Button";
import { Modal } from "~/components/common/Modal";
import { Select } from "~/components/common/Select";
import { Toggle } from "~/components/common/Toggle";
import styles from "~/components/Settings.module.css";
import {
  imLost,
  playerIdentity,
  setImLost,
  setPlayerIdentity,
  type PlayerIdentity,
} from "~/store/settingsStore";

type Props = {
  open: boolean;
  onClose: () => void;
};

const IDENTITY_OPTIONS: PlayerIdentity[] = ["Human", "Cat", "Dog", "Rat"];

export const Settings: Component<Props> = (props) => {
  const navigate = useNavigate();

  const handleBackToMenu = () => {
    props.onClose();
    navigate("/");
  };

  return (
    <Modal open={props.open} onClose={props.onClose} title="Settings" position="fixed">
      <div class={styles.settings}>
        <div class={styles.row}>
          <label class={styles.label} for="settings-player-identity">
            I am:
          </label>
          <Select
            id="settings-player-identity"
            value={playerIdentity()}
            onChange={(e) => setPlayerIdentity(e.currentTarget.value as PlayerIdentity)}
            disabled={imLost()}
          >
            {IDENTITY_OPTIONS.map((id) => (
              <option value={id}>{id}</option>
            ))}
          </Select>
        </div>
        <div class={styles.row}>
          <Toggle label="i'm lost" checked={imLost()} onChange={(v) => setImLost(v)} />
        </div>
        <div class={styles.row}>
          <Button class={styles["menu-btn"]} onClick={handleBackToMenu}>
            Back to main menu
          </Button>
        </div>
      </div>
    </Modal>
  );
};
