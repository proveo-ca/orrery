import { toDataURL } from "qrcode";
import { Show, createResource } from "solid-js";

import styles from "~/components/primitives/QrCode.module.css";

interface QrCodeProps {
  /** Text to encode (e.g. an invite link). */
  value: string;
  /** Pixel size of the rendered code. Defaults to 200. */
  size?: number;
  /** Accessible label / alt text. */
  alt?: string;
}

/**
 * Renders `value` as a scannable QR code (dark-on-white, so it scans under any
 * theme). Generation is async via the `qrcode` lib; we show a small placeholder
 * until the data URL resolves.
 */
export function QrCode(props: QrCodeProps) {
  const [dataUrl] = createResource(
    () => ({ value: props.value, size: props.size ?? 200 }),
    ({ value, size }) =>
      toDataURL(value, {
        width: size,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#1a1a1aff", light: "#ffffffff" },
      }).catch(() => ""),
  );

  return (
    <Show when={dataUrl()} fallback={<div class={styles.placeholder} aria-hidden="true" />}>
      <img
        class={styles.qr}
        src={dataUrl()}
        width={props.size ?? 200}
        height={props.size ?? 200}
        alt={props.alt ?? "QR code"}
      />
    </Show>
  );
}
