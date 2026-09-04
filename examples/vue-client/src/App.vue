<template>
  <div class="app-container">
    <!-- 1. ヘッダーエリア (HeaderPanel) -->
    <HeaderPanel />

    <!-- 2. メインゲームビュー (GKL 2カラム ワークスペース) -->
    <main class="game-view gkl-workspace">
      <!-- 左エリア: アシストシグナルバー、ログ、ダンジョンマップ親コンテナ、ステータス、プロンプト -->
      <section class="left-workspace">
        <!-- 🚨 HUD 最優先アシストシグナルバー (Level 2 & Level 3) -->
        <AssistSignalBar />

        <!-- メッセージログエリア (MessageLog) -->
        <MessageLog />

        <!-- ダンジョンマップエリア (GameViewport: メインCanvas + FocusCamera + FloorLandmarksHud) -->
        <GameViewport />

        <!-- 横型ステータスバー (StatusBar + HP/MP ゲージバー + 詳細展開) -->
        <StatusBar />

        <!-- プロンプト入力バー (PromptModal) -->
        <PromptModal />
      </section>

      <!-- 右エリア: GKL 所持品 ＆ 推奨アクション ＆ 構造化ナレッジ (3段カード構造) -->
      <aside class="gkl-side-panel">
        <!-- 🎒 上段: アイコン型常時表示インベントリ -->
        <InventoryGrid />

        <!-- 🧠 中段: 推奨アクションパネル ＋ 「囲」型 3x3 方向パッドフィルター -->
        <ContextActions />

        <!-- 💡 下段: 構造化ナレッジ ＆ 戦術アドバイス (タブ切替カード) -->
        <GklKnowledgeTabs />
      </aside>
    </main>

    <!-- ✨ 願い（#wish）ビルダーモーダル (WishModal) -->
    <WishModal />

    <!-- メニュー / アイテム選択モーダル (MenuModal) -->
    <MenuModal />

    <!-- テキスト・ヘルプ閲覧モーダル (TextWindowModal) -->
    <TextWindowModal />

    <!-- ゲームオーバー & スコアボード (GameOverModal) -->
    <GameOverModal />

    <!-- セーブデータ検出・選択ダイアログ (SaveSelectorModal) -->
    <SaveSelectorModal />
  </div>
</template>

<script setup lang="ts">
import HeaderPanel from './components/HeaderPanel.vue';
import AssistSignalBar from './components/AssistSignalBar.vue';
import MessageLog from './components/MessageLog.vue';
import GameViewport from './components/GameViewport.vue';
import StatusBar from './components/StatusBar.vue';
import PromptModal from './components/PromptModal.vue';
import InventoryGrid from './components/InventoryGrid.vue';
import ContextActions from './components/ContextActions.vue';
import GklKnowledgeTabs from './components/GklKnowledgeTabs.vue';
import WishModal from './components/WishModal.vue';
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
  background-color: #0b0f19;
  color: #e2e8f0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app-container {
  max-width: 1720px;
  margin: 0 auto;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
}

/* 2カラムレイアウト (Pure JS Client準拠) */
.gkl-workspace {
  display: grid;
  grid-template-columns: minmax(640px, 1fr) minmax(380px, 460px);
  gap: 12px;
  align-items: start;
}

.left-workspace {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.gkl-side-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

@media (max-width: 1180px) {
  .gkl-workspace {
    grid-template-columns: 1fr;
  }
}
</style>
