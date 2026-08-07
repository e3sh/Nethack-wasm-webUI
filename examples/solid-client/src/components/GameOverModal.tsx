import { Component, Show, For } from 'solid-js';
import { engineState, gameOverResult } from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';

export const GameOverModal: Component = () => {
  const handleRestart = () => {
    driverController.restartGame();
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
    <Show when={engineState() === 'GAMEOVER' || gameOverResult()}>
      <div class="modal-backdrop">
        <div class="modal-content">
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
            <button onClick={handleRestart} class="btn btn-restart">
              🔄 Restart Game
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
