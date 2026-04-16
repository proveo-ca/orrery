import clsx from "clsx";
import { type JSX, splitProps } from "solid-js";

import { Button } from "~/components/common/Button";
import styles from "~/components/common/MenuButton.module.css";

export interface MenuButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean;
  href?: string;
}

export function MenuButton(props: MenuButtonProps) {
  const [local, others] = splitProps(props, ["class", "children", "primary", "href"]);
  return (
    <Button
      primary={local.primary}
      href={local.href}
      class={clsx(styles["menu-btn"], local.class)}
      {...others}
    >
      {local.children}
    </Button>
  );
}
