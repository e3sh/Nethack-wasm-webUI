<template>
  <div class="app-container">
    <!-- ヘッダーエリア -->
    <header class="app-header">
      <div class="header-title">
        <h1>NetHack Wasm Driver</h1>
        <span class="subtitle">Vue 3 Sample Client</span>
      </div>

      <div class="header-controls">
        <span class="engine-badge" :class="engineState.toLowerCase()">
          State: {{ engineState }}
        </span>
        <button
          @click="deleteSaveFile"
          class="btn-delete-save"
          title="セーブデータを完全削除"
        >
          🗑️ Del Save
        </button>
      </div>
    </header>

    <!-- メインゲームビュー -->
    <main class="game-view">
      <!-- 1. メッセージログ -->
      <MessageLog />

      <!-- 2. ダンジョンマップ -->
      <MapCanvas />

      <!-- 3. ステータスバー -->
      <StatusBar />

      <!-- 4. 入力プロンプト -->
      <InputPrompt />
    </main>

    <!-- インベントリ / メニューモーダル -->
    <MenuModal />

    <!-- テキスト・ヘルプ閲覧モーダル -->
    <TextWindowModal />
  </div>
</template>

<script setup lang="ts">
import { useNetHackDriver } from './composables/useNetHackDriver';
import { useGameStore } from './stores/gameStore';
import { storeToRefs } from 'pinia';
import MessageLog from './components/MessageLog.vue';
import MapCanvas from './components/MapCanvas.vue';
import StatusBar from './components/StatusBar.vue';
import InputPrompt from './components/InputPrompt.vue';
import MenuModal from './components/MenuModal.vue';
import TextWindowModal from './components/TextWindowModal.vue';

// NetHack Wasm Driver の接続フック呼び出し
const { deleteSaveFile } = useNetHackDriver();
const gameStore = useGameStore();
const { engineState } = storeToRefs(gameStore);
</script>

<style>
/* グローバルダークテーマ */
body {
  margin: 0;
  padding: 0;
  background-color: #0f0f1a;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #16213e;
  padding-bottom: 12px;
}

.header-title h1 {
  margin: 0;
  font-size: 22px;
  color: #4ecca3;
  display: inline-block;
}

.subtitle {
  margin-left: 10px;
  font-size: 13px;
  color: #7f8c8d;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.engine-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  font-family: monospace;
}

.engine-badge.running { background: #2ecc71; color: #111; }
.engine-badge.idle { background: #7f8c8d; color: #fff; }
.engine-badge.saved { background: #f39c12; color: #111; }
.engine-badge.gameover { background: #e74c3c; color: #fff; }

.btn-delete-save {
  background: #c0392b;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-weight: bold;
  cursor: pointer;
}

.game-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
