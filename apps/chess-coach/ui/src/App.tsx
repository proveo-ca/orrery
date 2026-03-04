import { createEffect, onMount, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import { BoardWrapper } from './components/ChessBoard';
import { Avatar } from './components/Avatar';
import { CoachAdvice } from './components/CoachAdvice';
import { BoardActions } from './components/Controls';
import { NewGamePanel } from './components/NewGamePanel';
import { DebugControls, debugHistoryOverlay, debugLightSpeedOverlay } from './components/DebugControls';
import { HistoryOverlay } from './components/common/HistoryOverlay';
import { LightSpeedOverlay } from './components/common/LightSpeedOverlay';
import { initGlobalLogging, logger } from './utils/logger';
import { fetchHello } from './services/api';
import { coachEmotion, hoverBlunder, hoverBlunderFen, setAdvice, setBestMovePhrases, setCoachEmotion, setThinkingPhrases } from './store';
import { currentIndex, fenHistory, goForward, clearHoverOverride } from './store';
import { isTravelling, exitTravel } from './store/travelState';
import { useTravelMode } from './hooks/useTravelMode';
import './theme.css';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const App: Component = () => {
  const { activateTravel } = useTravelMode();
  let sleepyTimer: number | undefined;
  let sleepingTimer: number | undefined;

  const isReplaying = () => currentIndex() < fenHistory().length - 1;

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

  const handleKeyDown = (e: KeyboardEvent) => {
    resetInactivityTimers();
    if (e.code === 'Space' && hoverBlunder() && !isTravelling()) {
      e.preventDefault();
      const fen = hoverBlunderFen();
      if (fen) activateTravel(fen);
    } else if (e.code === 'Escape') {
      if (isTravelling() || isReplaying()) {
        e.preventDefault();
        if (isTravelling()) exitTravel();
        while (currentIndex() < fenHistory().length - 1) {
          goForward();
        }
        clearHoverOverride();
      }
    }
  };

  onMount(async () => {
    initGlobalLogging();
    logger.action('App Mounted');
    
    // Set up global activity listeners
    window.addEventListener('mousemove', resetInactivityTimers);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', resetInactivityTimers);
    
    try {
      const helloData = await fetchHello(API_URL);
      setAdvice(helloData.greeting);
      setThinkingPhrases(helloData.thinking);
      setBestMovePhrases(helloData.bestMove);
      setCoachEmotion('idle');
      resetInactivityTimers();
    } catch (err) {
      logger.error('Failed to fetch /hello', err);
      setAdvice("Hey! I couldn't connect to the server. Is it running?");
      setCoachEmotion('shocked');
    }
  });

  onCleanup(() => {
    window.removeEventListener('mousemove', resetInactivityTimers);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('click', resetInactivityTimers);
    if (sleepyTimer) clearTimeout(sleepyTimer);
    if (sleepingTimer) clearTimeout(sleepingTimer);
  });

  return (
    <div class="app-container">
      <HistoryOverlay active={debugHistoryOverlay() || (isReplaying() && !isTravelling())} />
      <LightSpeedOverlay active={debugLightSpeedOverlay() || isTravelling()} />

      <div class="coach-header">
        <Avatar />
        <CoachAdvice />
      </div>

      <div class="board-area">
        <BoardActions />
        <BoardWrapper />
      </div>

      <div class="footer">
        <NewGamePanel />
      </div>

      <DebugControls />
    </div>
  );
};

export default App;
