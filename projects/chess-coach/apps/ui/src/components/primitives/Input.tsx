import clsx from "clsx";
import { type JSX, splitProps } from "solid-js";

import styles from "~/components/primitives/Input.module.css";

export interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {}

export function Input(props: InputProps) {
  const [local, others] = splitProps(props, ["class"]);
  return <input class={clsx(styles["common-input"], local.class)} {...others} />;
}
