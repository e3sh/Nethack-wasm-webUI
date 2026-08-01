import { Component, onMount, onCleanup } from 'solid-js';
import { engineState } from './stores/gameStore';
import { driverController } from './services/useNetHackDriver';
import { MessageLog } from './components/MessageLog';
import { MapCanvas } from './components/MapCanvas';
import { StatusBar } from './components/StatusBar';
import { InputPrompt } from './components/InputPrompt';
import { MenuModal } from './components/MenuModal';
import { TextWindowModal } from './components/TextWindowModal';
import './App.css';

export const App: Component = () => {
  onMount(() => {
    driverController.init();
  });

  onCleanup(() => {
    driverController.destroy();
  });

  return (
    <div class="app-container">
      {/* ヘッダーエリア */}
      <header class="app-header">
        <div class="header-title">
          <h1>NetHack Wasm Driver</h1>
          <span class="subtitle">SolidJS Sample Client</span>
        </div>

        <div class="header-controls">
          <span class={`engine-badge ${engineState().toLowerCase()}`}>
            State: {engineState()}
          </span>
          <button
            onClick={() => driverController.deleteSaveFile()}
            class="btn-delete-save"
            title="セーブデータを完全削除"
          >
            🗑️ Del Save
          </button>
        </div>
      </header>

      {/* メインゲームビュー */}
      <main class="game-view">
        {/* 1. メッセージログ */}
        <MessageLog />

        {/* 2. ダンジョンマップ */}
        <MapCanvas />

        {/* 3. ステータスバー */}
        <StatusBar />

        {/* 4. 入力プロンプト */}
        <InputPrompt />
      </main>

      {/* インベントリ / メニューモーダル */}
      <MenuModal />

      {/* テキスト・ヘルプ閲覧モーダル */}
      <TextWindowModal />
    </div>
  );
};

export default App;
