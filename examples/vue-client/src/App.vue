<template>
  <div class="app-container">
    <!-- 1. ヘッダーエリア (HeaderPanel) -->
    <HeaderPanel />

    <!-- メインゲームビュー -->
    <main class="game-view">
      <!-- 2. メッセージログ (MessageLog) -->
      <MessageLog />

      <!-- 3. ダンジョンマップ (GameCanvas) -->
      <GameCanvas />

      <!-- 4. ステータスバー (StatusBar) -->
      <StatusBar />

      <!-- 5. 入力プロンプト (PromptModal) -->
      <PromptModal />
    </main>

    <!-- 6. インベントリ / メニューモーダル (MenuModal) -->
    <MenuModal />

    <!-- 7. テキスト・ヘルプ閲覧モーダル (TextWindowModal) -->
    <TextWindowModal />

    <!-- 8. ゲームオーバー & スコアボード (GameOverModal) -->
    <GameOverModal />
  </div>
</template>

<script setup lang="ts">
import HeaderPanel from './components/HeaderPanel.vue';
import MessageLog from './components/MessageLog.vue';
import GameCanvas from './components/GameCanvas.vue';
import StatusBar from './components/StatusBar.vue';
import PromptModal from './components/PromptModal.vue';
import MenuModal from './components/MenuModal.vue';
import TextWindowModal from './components/TextWindowModal.vue';
import GameOverModal from './components/GameOverModal.vue';
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

.game-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
