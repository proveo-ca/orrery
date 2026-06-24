import { Show, createEffect, createUniqueId, onCleanup } from "solid-js";
import type { Component, JSX } from "solid-js";

import styles from "~/components/atoms/Modal.module.css";
import { Button } from "~/components/primitives/Button";

export type ModalPosition = "fixed" | "absolute";

type ModalProps = {
  open: boolean;
  title?: string;
  children: JSX.Element;

  onClose?: () => void;
  dismissible?: boolean; // overlay click + Escape
  showCloseButton?: boolean;

  position?: ModalPosition; // fixed (page) or absolute (within parent)
  overlayClass?: string;
  contentClass?: string;
};

export const Modal: Component<ModalProps> = (props) => {
  const dismissible = () => props.dismissible ?? true;
  const position = () => props.position ?? "fixed";
  const canClose = () => !!props.onClose && dismissible();

  const titleId = createUniqueId();

  let closeButtonEl: HTMLButtonElement | undefined;
  let contentEl: HTMLDivElement | undefined;

  let previouslyFocused: HTMLElement | null = null;
  let lastOpen = false;

  const focusModal = () => {
    queueMicrotask(() => {
      if (!props.open) return;
      const target = closeButtonEl ?? contentEl;
      target?.focus?.();
    });
  };

  createEffect(() => {
    const open = props.open;

    if (open && !lastOpen) {
      previouslyFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      focusModal();
    }

    if (!open && lastOpen) {
      previouslyFocused?.focus?.();
      previouslyFocused = null;
    }

    lastOpen = open;
  });

  createEffect(() => {
    if (!props.open || !canClose()) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  return (
    <Show when={props.open}>
      <div
        class={styles["modal-overlay"]}
        classList={{
          [styles["modal-overlay--fixed"]]: position() === "fixed",
          [styles["modal-overlay--absolute"]]: position() === "absolute",
          ...(props.overlayClass ? { [props.overlayClass]: true } : {}),
        }}
        onClick={() => {
          if (canClose()) props.onClose?.();
        }}
      >
        <div
          ref={(el) => {
            contentEl = el;
          }}
          class={styles["modal-content"]}
          classList={props.contentClass ? { [props.contentClass]: true } : {}}
          role="dialog"
          aria-modal="true"
          aria-labelledby={props.title ? titleId : undefined}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          {(props.title || (props.onClose && (props.showCloseButton ?? true))) && (
            <div class={styles["modal-header"]}>
              {props.title ? (
                <h2 id={titleId} class={styles["modal-title"]}>
                  {props.title}
                </h2>
              ) : (
                <div />
              )}

              {props.onClose && (props.showCloseButton ?? true) && (
                <Button
                  ref={(el) => {
                    closeButtonEl = el;
                  }}
                  class={styles["modal-close"]}
                  type="button"
                  onClick={props.onClose}
                  aria-label="Close modal"
                >
                  <span aria-hidden="true">×</span>
                </Button>
              )}
            </div>
          )}

          <div class={styles["modal-body"]}>{props.children}</div>
        </div>
      </div>
    </Show>
  );
};
