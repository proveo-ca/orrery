import {type JSX, splitProps } from 'solid-js';
import './Select.css';

export interface SelectProps extends JSX.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select(props: SelectProps) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <select class={`common-select ${local.class || ''}`} {...others} />
  );
}
