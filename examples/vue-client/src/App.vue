<template>
  <div class="app-container">
    <!-- 1. ヘッダーエリア (HeaderPanel) -->
    <HeaderPanel />

    <!-- メインゲームビュー (2カラム ワークスペース) -->
    <main class="game-workspace">
      <!-- 左エリア: ゲーム画面・ログ・ステータス -->
      <section class="game-main-area">
        <!-- 2. メッセージログ (MessageLog) -->
        <MessageLog />

        <!-- 3. ダンジョンマップ (GameCanvas) -->
        <GameCanvas />

        <!-- 4. ステータスバー (StatusBar) -->
        <StatusBar />

        <!-- 5. 入力プロンプト (PromptModal) -->
        <PromptModal />
      </section>

      <!-- 右エリア: GKL ナレッジ ＆ 推奨アクション -->
      <aside class="game-side-area">
        <!-- 6. GKL 状況推論 ＆ ナレッジアシストパネル (GklKnowledgePanel) -->
        <GklKnowledgePanel />
      </aside>
    </main>

    <!-- 7. インベントリ / メニューモーダル (MenuModal) -->
    <MenuModal />

    <!-- 8. テキスト・ヘルプ閲覧モーダル (TextWindowModal) -->
    <TextWindowModal />

    <!-- 9. ゲームオーバー & スコアボード (GameOverModal) -->
    <GameOverModal />

    <!-- 10. セーブデータ検出・選択ダイアログ (SaveSelectorModal) -->
    <SaveSelectorModal />
  </div>
</template>

<script setup lang="ts">
import HeaderPanel from './components/HeaderPanel.vue';
import MessageLog from './components/MessageLog.vue';
import GameCanvas from './components/GameCanvas.vue';
import StatusBar from './components/StatusBar.vue';
import PromptModal from './components/PromptModal.vue';
import GklKnowledgePanel from './components/GklKnowledgePanel.vue';
import MenuModal from './components/MenuModal.vue';
import TextWindowModal from './components/TextWindowModal.vue';
import GameOverModal from './components/GameOverModal.vue';
import SaveSelectorModal from './components/SaveSelectorModal.vue';
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
  max-width: 1600px;
  margin: 0 auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
}

.game-workspace {
  display: grid;
  grid-template-columns: minmax(640px, 1fr) minmax(400px, 560px);
  gap: 14px;
  align-items: start;
}

.game-main-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.game-side-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

@media (max-width: 1140px) {
  .game-workspace {
    grid-template-columns: 1fr;
  }
}
</style>
