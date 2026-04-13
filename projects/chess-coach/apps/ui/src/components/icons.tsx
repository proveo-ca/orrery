import type { Component } from "solid-js";

interface IconProps {
  size?: number;
}

export const ChevronLeftIcon: Component<IconProps> = (props) => {
  const s = () => props.size ?? 20;
  return (
    <svg width={s()} height={s()} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="13,4 7,10 13,16" />
    </svg>
  );
};

export const ChevronRightIcon: Component<IconProps> = (props) => {
  const s = () => props.size ?? 20;
  return (
    <svg width={s()} height={s()} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="7,4 13,10 7,16" />
    </svg>
  );
};

export const HintIcon: Component<IconProps> = (props) => {
  const s = () => props.size ?? 20;
  return (
    <svg width={s()} height={s()} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="10" r="8" />
      <path d="M7.5 7.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3.5" />
      <circle cx="10" cy="14.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
};

export const PlusCircleIcon: Component<IconProps> = (props) => {
  const s = () => props.size ?? 20;
  return (
    <svg width={s()} height={s()} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="10" r="8" />
      <line x1="10" y1="6" x2="10" y2="14" />
      <line x1="6" y1="10" x2="14" y2="10" />
    </svg>
  );
};

export const StarIcon: Component<IconProps> = (props) => {
  const s = () => props.size ?? 20;
  return (
    <svg width={s()} height={s()} viewBox="0 0 20 20" fill="currentColor" stroke="none">
      <polygon points="10,2 12.4,7.2 18,7.8 13.8,11.6 15,17.2 10,14.4 5,17.2 6.2,11.6 2,7.8 7.6,7.2" />
    </svg>
  );
};

export const CheckIcon: Component<IconProps> = (props) => {
  const s = () => props.size ?? 20;
  return (
    <svg width={s()} height={s()} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4,10 8.5,14.5 16,5.5" />
    </svg>
  );
};

export const DiceIcon: Component<IconProps> = (props) => {
  const s = () => props.size ?? 20;
  return (
    <svg width={s()} height={s()} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="13" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
};

export const HamburgerIcon: Component<IconProps> = (props) => {
  const s = () => props.size ?? 20;
  return (
    <svg width={s()} height={s()} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
    </svg>
  );
};

export const ArrowRightIcon: Component<IconProps> = (props) => {
  const s = () => props.size ?? 20;
  return (
    <svg width={s()} height={s()} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="4" y1="10" x2="16" y2="10" />
      <polyline points="11,5 16,10 11,15" />
    </svg>
  );
};
