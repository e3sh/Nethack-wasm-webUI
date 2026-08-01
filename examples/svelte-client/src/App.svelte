<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { engineStateStore } from './stores/gameStore';
  import { driverController } from './services/useNetHackDriver';
  import MessageLog from './components/MessageLog.svelte';
  import MapCanvas from './components/MapCanvas.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import InputPrompt from './components/InputPrompt.svelte';
  import MenuModal from './components/MenuModal.svelte';
  import TextWindowModal from './components/TextWindowModal.svelte';
  import './App.css';

  onMount(() => {
    driverController.init();
  });

  onDestroy(() => {
    driverController.destroy();
  });
</script>

<div class="app-container">
  <!-- ヘッダーエリア -->
  <header class="app-header">
    <div class="header-title">
      <h1>NetHack Wasm Driver</h1>
      <span class="subtitle">Svelte Sample Client</span>
    </div>

    <div class="header-controls">
      <span class="engine-badge {$engineStateStore.toLowerCase()}">
        State: {$engineStateStore}
      </span>
      <button
        on:click={() => driverController.deleteSaveFile()}
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
