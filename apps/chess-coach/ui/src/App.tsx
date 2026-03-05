import { onMount, onCleanup } from 'solid-js';
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
import { hoverBlunder, hoverBlunderFen, setAdvice, setBestMovePhrases, setCoachEmotion, setThinkingPhrases } from './store';
import { currentIndex, fenHistory, goForward, clearHoverOverride } from './store';
import { isTravelling } from './store/travelState';
import { useInactivityTimers } from './hooks/useInactivityTimers';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import './theme.css';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const App: Component = () => {
  const { resetInactivityTimers } = useInactivityTimers();
  useGlobalShortcuts(resetInactivityTimers);

  const isReplaying = () => currentIndex() < fenHistory().length - 1;

  onMount(async () => {
    initGlobalLogging();
    logger.action('App Mounted');
    
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
