<script lang="ts">
  import { pendingSaveInfoStore } from '../stores/gameStore';
  import { driverController } from '../services/useNetHackDriver';

  function handleStartNew() {
    if (confirm('保存されているセーブデータを破棄して最初から開始しますか？')) {
      driverController.startNewGame();
    }
  }
</script>

{#if $pendingSaveInfoStore}
  <div class="modal-backdrop">
    <div class="modal-card">
      <div class="modal-header">
        <h2>💾 セーブデータが見つかりました</h2>
      </div>
      <div class="modal-body">
        <p class="save-desc">
          前回の冒険記録が残っています。再開しますか？それとも新規に開始しますか？
        </p>
        <div class="save-info-box">
          <span class="label">冒険者名 (Player):</span>
          <strong class="player-name">
            {$pendingSaveInfoStore.savePlayerName || 'Hero'}
          </strong>
        </div>
      </div>
      <div class="modal-footer">
        <button
          on:click={() => driverController.resumeSavedGame()}
          class="btn btn-primary btn-large"
        >
          ▶️ セーブデータから再開 (Continue Game)
        </button>
        <button on:click={handleStartNew} class="btn btn-danger">
          ⚠️ 新規ゲーム開始 (New Game / セーブ破棄)
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
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
    z-index: 10000;
    backdrop-filter: blur(4px);
  }

  .modal-card {
    background: #1a1a2e;
    border: 2px solid #4ecca3;
    border-radius: 8px;
    width: 90%;
    max-width: 480px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modal-appear 0.2s ease-out;
  }

  @keyframes modal-appear {
    from {
      transform: scale(0.95);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .modal-header {
    background: #16213e;
    padding: 14px 20px;
    border-bottom: 1px solid #0f3460;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    color: #4ecca3;
  }

  .modal-body {
    padding: 20px;
    color: #e0e0e0;
  }

  .save-desc {
    margin: 0 0 16px 0;
    font-size: 14px;
    line-height: 1.5;
    color: #a0a0b0;
  }

  .save-info-box {
    background: #0f1423;
    border: 1px solid #2a2a4a;
    border-radius: 6px;
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .save-info-box .label {
    font-size: 13px;
    color: #8b949e;
  }

  .save-info-box .player-name {
    font-size: 16px;
    color: #58a6ff;
    font-family: monospace;
  }

  .modal-footer {
    padding: 14px 20px;
    background: #16213e;
    border-top: 1px solid #0f3460;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .btn {
    padding: 10px 16px;
    border-radius: 4px;
    border: none;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .btn-primary {
    background: #2ecc71;
    color: #111;
  }

  .btn-primary:hover {
    background: #27ae60;
    transform: translateY(-1px);
  }

  .btn-danger {
    background: #c0392b;
    color: #fff;
    font-size: 13px;
  }

  .btn-danger:hover {
    background: #e74c3c;
  }
</style>
