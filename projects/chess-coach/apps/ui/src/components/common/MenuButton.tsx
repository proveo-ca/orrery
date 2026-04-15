import clsx from "clsx";
import { type JSX, splitProps } from "solid-js";

import { Button } from "~/components/common/Button";
import styles from "~/components/common/MenuButton.module.css";

export interface MenuButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean;
}

export function MenuButton(props: MenuButtonProps) {
  const [local, others] = splitProps(props, ["class", "children", "primary"]);
  return (
    <Button
      class={clsx(styles["menu-btn"], local.primary && styles["menu-btn--primary"], local.class)}
      {...others}
    >
      {local.children}
    </Button>
  );
}
