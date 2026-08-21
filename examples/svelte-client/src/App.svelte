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
