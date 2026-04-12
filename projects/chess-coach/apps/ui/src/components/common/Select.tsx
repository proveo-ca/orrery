import clsx from "clsx";
import { type JSX, splitProps } from "solid-js";

import styles from "~/components/common/Select.module.css";

export interface SelectProps extends JSX.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select(props: SelectProps) {
  const [local, others] = splitProps(props, ["class"]);
  return <select class={clsx(styles["common-select"], local.class)} {...others} />;
}
