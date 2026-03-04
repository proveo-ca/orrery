import { onMount, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import { BoardWrapper } from './components/ChessBoard';
import { Avatar } from './components/Avatar';
import { CoachAdvice } from './components/CoachAdvice';
import { NewGamePanel, BoardActions } from './components/Controls';
import { DebugControls } from './components/DebugControls';
import { initGlobalLogging, logger } from './utils/logger';
import { fetchHello } from './services/api';
import { setAdvice, coachEmotion, setCoachEmotion, setThinkingPhrases, setBestMovePhrases } from './store/gameStore';
import './theme.css';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const App: Component = () => {
  let sleepyTimer: number;
  let sleepingTimer: number;

  const resetInactivityTimers = () => {
    clearTimeout(sleepyTimer);
    clearTimeout(sleepingTimer);

    // Only wake up if currently sleepy or sleeping
    if (coachEmotion() === 'sleepy' || coachEmotion() === 'sleeping') {
      setCoachEmotion('idle');
    }

    // Don't start sleep timers if she is actively thinking, happy, or shocked
    if (coachEmotion() !== 'thinking' && coachEmotion() !== 'shocked' && coachEmotion() !== 'happy') {
      sleepyTimer = window.setTimeout(() => {
        setCoachEmotion('sleepy');
      }, 10000);

      sleepingTimer = window.setTimeout(() => {
        setCoachEmotion('sleeping');
      }, 20000);
    }
  };

  onMount(async () => {
    initGlobalLogging();
    logger.action('App Mounted');
    
    // Set up global activity listeners
    window.addEventListener('mousemove', resetInactivityTimers);
    window.addEventListener('keydown', resetInactivityTimers);
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
      setAdvice("I couldn't connect to the server. Is it running?");
      setCoachEmotion('shocked');
    }
  });

  onCleanup(() => {
    window.removeEventListener('mousemove', resetInactivityTimers);
    window.removeEventListener('keydown', resetInactivityTimers);
    window.removeEventListener('click', resetInactivityTimers);
    clearTimeout(sleepyTimer);
    clearTimeout(sleepingTimer);
  });

  return (
    <div class="app-container">
      <div class="coach-header">
        <div class="avatar-container">
          <Avatar />
        </div>
        <div class="advice-container">
          <CoachAdvice />
        </div>
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
