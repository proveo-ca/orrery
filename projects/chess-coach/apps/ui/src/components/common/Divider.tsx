import clsx from "clsx";

import styles from "~/components/common/Divider.module.css";

export function Divider(props: { class?: string }) {
  return <div class={clsx(styles.divider, props.class)} />;
}
