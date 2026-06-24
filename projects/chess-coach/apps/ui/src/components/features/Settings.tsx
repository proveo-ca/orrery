import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";

import { Modal } from "~/components/atoms/Modal";
import { PlayerNameField } from "~/components/features/PlayerNameField";
import styles from "~/components/features/Settings.module.css";
import { Button } from "~/components/primitives/Button";
import { Select } from "~/components/primitives/Select";
import { Toggle } from "~/components/primitives/Toggle";
import { imLost, playerIdentity, setImLost, setPlayerIdentity } from "~/store/settingsStore";
import type { PlayerIdentity } from "~/types/settings";

type Props = {
  open: boolean;
  onClose: () => void;
};

const IDENTITY_OPTIONS: PlayerIdentity[] = ["Human", "Cat", "Dog", "Rat"];

/**
 * The raw settings content — identity picker, "i'm lost" toggle, back-to-menu.
 * Rendered inline in the MobileDrawer and wrapped in a Modal by <Settings />.
 * `onDismiss` fires before navigation away so hosts can close their container
 * (drawer / modal).
 */
export const SettingsPanel: Component<{ onDismiss?: () => void }> = (props) => {
  const navigate = useNavigate();

  const handleBackToMenu = () => {
    props.onDismiss?.();
    navigate("/");
  };

  return (
    <div class={styles.settings}>
      <div class={styles.row}>
        <label class={styles.label} for="settings-player-name">
          Name:
        </label>
        <PlayerNameField id="settings-player-name" />
      </div>
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
  );
};

export const Settings: Component<Props> = (props) => {
  return (
    <Modal open={props.open} onClose={props.onClose} title="Settings" position="fixed">
      <SettingsPanel onDismiss={props.onClose} />
    </Modal>
  );
};
