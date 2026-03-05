import {type JSX, splitProps } from 'solid-js';
import './Button.css';

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {}

export function Button(props: ButtonProps) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <button class={`common-btn ${local.class || ''}`} {...others} />
  );
}
