import { onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { BoardWrapper } from './components/ChessBoard';
import { Avatar } from './components/Avatar';
import { CoachAdvice } from './components/CoachAdvice';
import { Controls } from './components/Controls';
import { DebugControls } from './components/DebugControls';
import { initGlobalLogging, logger } from './utils/logger';
import './App.css';

const App: Component = () => {
  onMount(() => {
    initGlobalLogging();
    logger.action('App Mounted');
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

      <BoardWrapper />

      <div class="footer">
        <h1>Selena Chess</h1>
        <Controls />
      </div>

      <DebugControls />
    </div>
  );
};

export default App;
