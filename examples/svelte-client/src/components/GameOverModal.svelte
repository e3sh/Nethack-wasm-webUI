<script lang="ts">
  import { engineStateStore, gameOverResultStore } from '../stores/gameStore';
  import { driverController } from '../services/useNetHackDriver';
  import { trapFocus } from '@core/input/focusTrap.js';

  let modalCardRef: HTMLDivElement | null = null;
  let restartBtnRef: HTMLButtonElement | null = null;

  $: engineState = $engineStateStore;
  $: gameOverResult = $gameOverResultStore;

  $: isGameOverOpen = engineState === 'GAMEOVER' || !!gameOverResult;

  $: if (isGameOverOpen) {
    setTimeout(() => restartBtnRef?.focus(), 50);
  }

  $: topScores =
    gameOverResult?.scoreboard ||
    gameOverResult?.records ||
    gameOverResult?.topScores ||
    [];

  $: deathMessage =
    gameOverResult?.deathMessage ||
    gameOverResult?.translatedDeathMessage ||
    'You have perished in the Dungeons of Doom...';

  function handleRestart() {
    driverController.restartGame({ clearStorage: true });
  }

  function handleGlobalKeyDown(e: KeyboardEvent) {
    if (!isGameOverOpen) return;
    if (modalCardRef && trapFocus(modalCardRef, e)) {
      return;
    }
  }
</script>

<svelte:window on:keydown={handleGlobalKeyDown} />

{#if isGameOverOpen}
  <div class="modal-backdrop">
    <div class="modal-content" bind:this={modalCardRef}>
      <div class="gameover-header">
        <h2>☠️ GAME OVER ☠️</h2>
      </div>

      <div class="death-message">
        <p>{deathMessage}</p>
      </div>

      {#if topScores.length > 0}
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
              {#each topScores as entry, idx (idx)}
                <tr>
                  <td>#{entry.rank || idx + 1}</td>
                  <td class="score">{entry.score || entry.points || 0}</td>
                  <td class="name">{entry.name || entry.playerName || 'Hero'}</td>
                  <td class="death">{entry.death || entry.reason || entry.title || ''}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <div class="modal-footer">
        <button bind:this={restartBtnRef} on:click={handleRestart} class="btn btn-restart">
          🔄 Restart Game
        </button>
      </div>
    </div>
  </div>
{/if}

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
}

.modal-content {
  background: #1b1b2f;
  border: 2px solid #e74c3c;
  border-radius: 8px;
  width: 600px;
  max-width: 94vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(231, 76, 60, 0.4);
  color: #e0e0e0;
}

.gameover-header h2 {
  margin: 0;
  color: #e74c3c;
  text-align: center;
  font-size: 24px;
  letter-spacing: 2px;
}

.death-message {
  background: #162447;
  border-left: 4px solid #e74c3c;
  padding: 10px 14px;
  margin: 16px 0;
  font-size: 15px;
  font-weight: bold;
  color: #f9d5bb;
}

.scoreboard {
  margin-top: 10px;
  overflow-y: auto;
}

.scoreboard h3 {
  margin: 0 0 8px 0;
  color: #f39c12;
  font-size: 16px;
}

.score-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-family: monospace;
}

.score-table th, .score-table td {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid #1f4068;
}

.score-table th {
  background: #1f4068;
  color: #4ecca3;
}

.score-table td.score {
  color: #f1c40f;
  font-weight: bold;
}

.score-table td.name {
  color: #ffffff;
}

.score-table td.death {
  color: #bdc3c7;
}

.modal-footer {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.btn-restart {
  background: #27ae60;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 10px 24px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-restart:hover {
  background: #2ecc71;
}
</style>
