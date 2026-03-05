import { createPersistedStore } from './createPersistedStore';

export type PlayerColorPref = 'w' | 'b' | 'random';
export type Difficulty = 'intermediate' | 'advanced' | 'expert';

const [settingsState, setSettingsState] = createPersistedStore('chess_coach_settings_state', {
  colorPref: 'w' as PlayerColorPref,
  activePlayerColor: 'w' as 'w' | 'b',
  difficulty: 'intermediate' as Difficulty
});

export const colorPref = () => settingsState.colorPref;
export const activePlayerColor = () => settingsState.activePlayerColor;
export const difficulty = () => settingsState.difficulty;

export const setColorPref = (val: PlayerColorPref) => setSettingsState('colorPref', val);
export const setActivePlayerColor = (val: 'w' | 'b') => setSettingsState('activePlayerColor', val);
export const setDifficulty = (val: Difficulty) => setSettingsState('difficulty', val);
