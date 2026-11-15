import { config as gameConfig } from './config.js';
import { LoadingScreenManager } from './LoadingScreenManager.js';
import { GameState } from './GameState.js';
import { Game } from './Game.js';

document.addEventListener('DOMContentLoaded', () => {
  const loadingScreen = new LoadingScreenManager(gameConfig.display.minLoadingTime);
  const game = new Game(loadingScreen);
  window.game = game; // Expose to global scope for HTML onclick handlers
  game.init().catch((err) => {
    console.error('Mana failed to start:', err);
    const loading = document.getElementById('loadingScreen');
    if (loading) {
      const sub = loading.querySelector('.loading-subtitle');
      if (sub) sub.textContent = 'The wilderness could not be loaded. Check the browser console.';
    }
  });
});