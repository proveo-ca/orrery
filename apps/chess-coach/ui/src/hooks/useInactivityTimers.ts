import { createEffect, onCleanup, onMount } from 'solid-js';
import { coachEmotion, dispatchCoachEvent } from '../store';

export function useInactivityTimers() {
  let sleepyTimer: number | undefined;
  let sleepingTimer: number | undefined;

  const resetInactivityTimers = () => {
    if (sleepyTimer) clearTimeout(sleepyTimer);
    if (sleepingTimer) clearTimeout(sleepingTimer);

    // Only wake up if currently sleepy or sleeping
    if (coachEmotion() === 'sleepy' || coachEmotion() === 'sleeping') {
      dispatchCoachEvent({ type: 'WAKE_UP' });
    }

    // Don't start sleep timers if she is actively thinking, happy, or shocked
    if (coachEmotion() !== 'thinking' && coachEmotion() !== 'shocked' && coachEmotion() !== 'happy') {
      sleepyTimer = window.setTimeout(() => {
        dispatchCoachEvent({ type: 'SLEEPY' });
      }, 20000);

      sleepingTimer = window.setTimeout(() => {
        dispatchCoachEvent({ type: 'SLEEPING' });
      }, 30000);
    }
  };

  createEffect(() => {
    const emotion = coachEmotion();

    // Any change in emotion (including idle <-> watching) re-runs this effect.
    // Calling resetInactivityTimers() here resets the 20s/30s countdown.
    if (emotion === 'idle' || emotion === 'watching') {
      resetInactivityTimers();
    } else {
      // If thinking, happy, shocked, sleepy, sleeping, stop the timers completely
      if (sleepyTimer) clearTimeout(sleepyTimer);
      if (sleepingTimer) clearTimeout(sleepingTimer);
    }
  });

  onMount(() => {
    window.addEventListener('mousemove', resetInactivityTimers);
    window.addEventListener('keydown', resetInactivityTimers);
    window.addEventListener('click', resetInactivityTimers);
  });

  onCleanup(() => {
    window.removeEventListener('mousemove', resetInactivityTimers);
    window.removeEventListener('keydown', resetInactivityTimers);
    window.removeEventListener('click', resetInactivityTimers);
    if (sleepyTimer) clearTimeout(sleepyTimer);
    if (sleepingTimer) clearTimeout(sleepingTimer);
  });

  return { resetInactivityTimers };
}
