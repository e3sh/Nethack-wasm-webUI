import { Component, Show, For, createEffect, onMount, onCleanup } from 'solid-js';
import { engineState, gameOverResult } from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';
import { trapFocus } from '@core/input/focusTrap.js';

export const GameOverModal: Component = () => {
  let modalCardRef: HTMLDivElement | undefined;
  let restartBtnRef: HTMLButtonElement | undefined;

  const isGameOver = () => engineState() === 'GAMEOVER' || !!gameOverResult();

  createEffect(() => {
    if (isGameOver()) {
      setTimeout(() => restartBtnRef?.focus(), 50);
    }
  });

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isGameOver()) return;
      if (modalCardRef && trapFocus(modalCardRef, e)) {
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
    });
  });

  const handleRestart = () => {
    driverController.restartGame({ clearStorage: true });
  };

  const topScores = () =>
    gameOverResult()?.scoreboard ||
    gameOverResult()?.records ||
    gameOverResult()?.topScores ||
    [];

  const deathMessage = () =>
    gameOverResult()?.deathMessage ||
    gameOverResult()?.translatedDeathMessage ||
    'You have perished in the Dungeons of Doom...';

  return (
    <Show when={isGameOver()}>
      <div class="modal-backdrop">
        <div ref={modalCardRef} class="modal-content">
          <div class="gameover-header">
            <h2>☠️ GAME OVER ☠️</h2>
          </div>

          <div class="death-message">
            <p>{deathMessage()}</p>
          </div>

          <Show when={topScores().length > 0}>
            <div class="scoreboard">
              <h3>🏆 Top 10 Hall of Fame</h3>
              <table class="score-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Score</th>
                    <th>Name</th>
                    <th>Death / Title</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={topScores()}>
                    {(entry: any, idx) => (
                      <tr>
                        <td>#{entry.rank || idx() + 1}</td>
                        <td class="score">{entry.score || entry.points || 0}</td>
                        <td class="name">{entry.name || entry.playerName || 'Hero'}</td>
                        <td class="death">{entry.death || entry.reason || entry.title || ''}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>

          <div class="modal-footer">
            <button ref={restartBtnRef} onClick={handleRestart} class="btn btn-restart">
              🔄 Restart Game
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
