<script lang="ts">
  import { onMount } from 'svelte';
  import HeaderPanel from './components/HeaderPanel.svelte';
  import MessageLog from './components/MessageLog.svelte';
  import GameCanvas from './components/GameCanvas.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import PromptModal from './components/PromptModal.svelte';
  import GklKnowledgePanel from './components/GklKnowledgePanel.svelte';
  import MenuModal from './components/MenuModal.svelte';
  import TextWindowModal from './components/TextWindowModal.svelte';
  import GameOverModal from './components/GameOverModal.svelte';
  import { driverController } from './services/useNetHackDriver';

  onMount(() => {
    driverController.init();
  });
</script>

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

    <!-- 6. GKL 状況推論 ＆ ナレッジアシストパネル (GklKnowledgePanel) -->
    <GklKnowledgePanel />
  </main>

  <!-- 6. インベントリ / メニューモーダル (MenuModal) -->
  <MenuModal />

  <!-- 7. テキスト・ヘルプ閲覧モーダル (TextWindowModal) -->
  <TextWindowModal />

  <!-- 8. ゲームオーバー & スコアボード (GameOverModal) -->
  <GameOverModal />
</div>

<style>
:global(body) {
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
