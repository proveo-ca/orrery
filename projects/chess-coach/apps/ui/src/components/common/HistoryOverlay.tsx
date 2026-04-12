import type { Component } from "solid-js";

import styles from "~/components/common/HistoryOverlay.module.css";

interface HistoryOverlayProps {
  active: boolean;
}

export const HistoryOverlay: Component<HistoryOverlayProps> = (props) => {
  return <div class={styles["history-overlay"]} classList={{ [styles.active]: props.active }} />;
};
