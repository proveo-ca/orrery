import clsx from "clsx";
import { type JSX, splitProps } from "solid-js";

import styles from "~/components/common/Button.module.css";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {}

export function Button(props: ButtonProps) {
  const [local, others] = splitProps(props, ["class"]);
  return <button class={clsx(styles["common-btn"], local.class)} {...others} />;
}
