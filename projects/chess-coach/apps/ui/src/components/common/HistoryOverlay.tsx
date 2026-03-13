import type { Component } from "solid-js";

import "~/components/common/HistoryOverlay.css";

interface HistoryOverlayProps {
  active: boolean;
}

export const HistoryOverlay: Component<HistoryOverlayProps> = (props) => {
  return <div class="history-overlay" classList={{ active: props.active }} />;
};
