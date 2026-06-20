import type { CoachEmotion } from "~/types/coach";
import type { Component } from "solid-js";

interface IconProps {
  emotion: CoachEmotion;
  size?: number;
  title?: string;
}

/** Accessible description per emotion — used as the alt/aria fallback. */
const EMOTION_LABELS: Record<CoachEmotion, string> = {
  idle: "idle",
  watching: "watching the board",
  "watching--left": "watching the board",
  "watching--right": "watching the board",
  thinking: "thinking",
  happy: "happy",
  shocked: "shocked",
  shrug: "no better option",
  sleepy: "sleepy",
  sleeping: "sleeping",
};

/**
 * Compact inline icon for a coach emotion — used in the move list on the
 * ReviewScreen. Separate from `CoachAvatar`, which is a full animated SVG
 * cat and far too heavy to render once per half-move. Maps the subset of
 * emotions we actually need for move annotations; others fall through to
 * a neutral circle.
 */
export const CoachEmotionIcon: Component<IconProps> = (props) => {
  const s = () => props.size ?? 16;

  const aria = () => props.title ?? EMOTION_LABELS[props.emotion];

  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 20 20"
      role="img"
      aria-label={aria()}
      fill="none"
      stroke="currentColor"
      style={props.emotion === "shrug" ? { color: "var(--text-muted)" } : undefined}
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="10" cy="10" r="8" />
      {props.emotion === "happy" && (
        <>
          {/* eyes */}
          <circle cx="7.5" cy="8.5" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="12.5" cy="8.5" r="0.8" fill="currentColor" stroke="none" />
          {/* smile */}
          <path d="M6.5 12 Q10 15 13.5 12" fill="none" />
        </>
      )}
      {props.emotion === "shocked" && (
        <>
          {/* wide eyes */}
          <circle cx="7.5" cy="9" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="12.5" cy="9" r="1.2" fill="currentColor" stroke="none" />
          {/* o mouth */}
          <circle cx="10" cy="13.5" r="1.4" fill="none" />
        </>
      )}
      {props.emotion === "thinking" && (
        <>
          <path d="M7.5 8a2.5 2.5 0 0 1 4.5 1.5c0 1.2-1.8 1.8-1.8 3" fill="none" />
          <circle cx="10" cy="14.5" r="0.6" fill="currentColor" stroke="none" />
        </>
      )}
      {props.emotion === "shrug" && (
        <>
          {/* raised brows — the ¯\_(ツ)_/¯ "no choice / whatever" look */}
          <path d="M6 7 L8.6 6.4" fill="none" />
          <path d="M14 7 L11.4 6.4" fill="none" />
          {/* eyes */}
          <circle cx="7.5" cy="9.2" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="12.5" cy="9.2" r="0.8" fill="currentColor" stroke="none" />
          {/* flat, indifferent mouth */}
          <path d="M7 13.2 L13 13.2" fill="none" />
        </>
      )}
    </svg>
  );
};
