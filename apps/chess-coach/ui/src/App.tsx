import { onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { BoardWrapper } from './components/ChessBoard';
import { CoachAvatar } from './components/CoachAvatar.tsx';
import { CoachAdvice } from './components/CoachAdvice';
import { BoardActions } from './components/Controls';
import { NewGamePanel } from './components/NewGamePanel';
import { DebugControls, debugHistoryOverlay, debugLightSpeedOverlay } from './components/DebugControls';
import { HistoryOverlay } from './components/common/HistoryOverlay';
import { LightSpeedOverlay } from './components/common/LightSpeedOverlay';
import { initGlobalLogging, logger } from './utils/logger';
import { Chess } from 'chess.js';
import { fetchHello, postMove, postAdviceStream } from './services/api';
import { setAdvice, setBestMovePhrases, dispatchCoachEvent, setThinkingPhrases, currentIndex, fenHistory, currentFen, activePlayerColor, difficulty, addMoveToHistory } from './store';
import { isTravelling } from './store/travelState';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import './theme.css';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const App: Component = () => {
  useGlobalShortcuts();

  const isReplaying = () => currentIndex() < fenHistory().length - 1;

  onMount(async () => {
    initGlobalLogging();
    logger.action('App Mounted');
    
    try {
      const helloData = await fetchHello(API_URL);
      
      if (fenHistory().length > 1) {
        setAdvice("Welcome back! Let's continue our game.");
      } else {
        setAdvice(helloData.greeting);
      }
      
      setThinkingPhrases(helloData.thinking);
      setBestMovePhrases(helloData.bestMove);
      dispatchCoachEvent({ type: 'APP_READY' });

      // Check if it's the AI's turn to move
      const current = currentFen();
      const game = new Chess(current);
      const turn = current.split(' ')[1];
      
      if (!game.isGameOver() && turn !== activePlayerColor()) {
        dispatchCoachEvent({ type: 'AI_THINKING' });
        setAdvice("Let me think about my next move...");
        
        postMove(API_URL, {
          humanMoveSan: "",
          fenAfterHuman: current,
          difficulty: difficulty()
        }).then(async (moveData) => {
          const aiMove = game.move(moveData.move);
          addMoveToHistory(moveData.fen, { from: aiMove.from, to: aiMove.to });
          dispatchCoachEvent({ type: 'AI_MOVED' });

          let fullAdvice = '';
          let receivedFirstChunk = false;
          await postAdviceStream(
            API_URL,
            { humanMove: "", aiMove: moveData.move, fen: moveData.fen },
            (chunk) => {
              if (!receivedFirstChunk) {
                fullAdvice = '';
                receivedFirstChunk = true;
              }
              fullAdvice += chunk;
              setAdvice(fullAdvice);
            }
          );
        }).catch(err => {
          logger.error('Failed to execute AI continuation move', err);
          setAdvice('Error getting my move.');
          dispatchCoachEvent({ type: 'AI_ERROR' });
        });
      }
    } catch (err) {
      logger.error('Failed to fetch /hello', err);
      setAdvice("Hey! I couldn't connect to the server. Is it running?");
      dispatchCoachEvent({ type: 'APP_ERROR' });
    }
  });

  return (
    <div class="app-container">
      <HistoryOverlay active={debugHistoryOverlay() || (isReplaying() && !isTravelling())} />
      <LightSpeedOverlay active={debugLightSpeedOverlay() || isTravelling()} />

      <div class="coach-header">
        <CoachAvatar />
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
