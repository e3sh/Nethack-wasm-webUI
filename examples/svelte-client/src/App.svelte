<script lang="ts">
  import { onMount } from 'svelte';
  import HeaderPanel from './components/HeaderPanel.svelte';
  import AssistSignalBar from './components/AssistSignalBar.svelte';
  import MessageLog from './components/MessageLog.svelte';
  import GameViewport from './components/GameViewport.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import PromptModal from './components/PromptModal.svelte';
  import InventoryGrid from './components/InventoryGrid.svelte';
  import ContextActions from './components/ContextActions.svelte';
  import GklKnowledgeTabs from './components/GklKnowledgeTabs.svelte';
  import WishModal from './components/WishModal.svelte';
  import MenuModal from './components/MenuModal.svelte';
  import TextWindowModal from './components/TextWindowModal.svelte';
  import GameOverModal from './components/GameOverModal.svelte';
  import SaveSelectorModal from './components/SaveSelectorModal.svelte';
  import { driverController } from './services/useNetHackDriver';

  onMount(() => {
    driverController.init();
  });
</script>

<div class="app-container">
  <!-- 1. ヘッダーエリア (HeaderPanel) -->
  <HeaderPanel />

  <!-- 2. メインゲームビュー (GKL 2カラム ワークスペース) -->
  <main class="game-view gkl-workspace">
    <!-- 左エリア: アシストシグナルバー、ログ、ダンジョンマップ親コンテナ、ステータス、プロンプト -->
    <section class="left-workspace">
      <!-- 🚨 HUD 最優先アシストシグナルバー -->
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
