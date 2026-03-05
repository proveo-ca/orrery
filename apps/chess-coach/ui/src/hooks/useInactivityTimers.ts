import { createEffect, onCleanup, onMount } from 'solid-js';
import { coachEmotion, setCoachEmotion } from '../store/coachState';

export function useInactivityTimers() {
  let sleepyTimer: number | undefined;
  let sleepingTimer: number | undefined;

  const resetInactivityTimers = () => {
    if (sleepyTimer) clearTimeout(sleepyTimer);
    if (sleepingTimer) clearTimeout(sleepingTimer);

    // Only wake up if currently sleepy or sleeping
    if (coachEmotion() === 'sleepy' || coachEmotion() === 'sleeping') {
      setCoachEmotion('idle');
    }

    // Don't start sleep timers if she is actively thinking, happy, or shocked
    if (coachEmotion() !== 'thinking' && coachEmotion() !== 'shocked' && coachEmotion() !== 'happy') {
      sleepyTimer = window.setTimeout(() => {
        setCoachEmotion('sleepy');
      }, 20000);

      sleepingTimer = window.setTimeout(() => {
        setCoachEmotion('sleeping');
      }, 30000);
    }
  };

  createEffect(() => {
    const emotion = coachEmotion();

    // When internal state changes back to "idle" (or "watching") without user activity,
    // restart the inactivity timers so "sleepy/sleeping" can still happen later.
    if (emotion === 'idle' || emotion === 'watching') {
      resetInactivityTimers();
      return;
    }

    // While actively thinking/happy/shocked, ensure we don't drift into sleepy/sleeping.
    if (emotion === 'thinking' || emotion === 'shocked' || emotion === 'happy') {
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
