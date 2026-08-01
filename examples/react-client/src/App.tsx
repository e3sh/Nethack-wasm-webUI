import React from 'react';
import { useNetHackDriver } from './hooks/useNetHackDriver';
import { useGameStore } from './stores/gameStore';
import { MessageLog } from './components/MessageLog';
import { MapCanvas } from './components/MapCanvas';
import { StatusBar } from './components/StatusBar';
import { InputPrompt } from './components/InputPrompt';
import { MenuModal } from './components/MenuModal';
import { TextWindowModal } from './components/TextWindowModal';
import './App.css';

export const App: React.FC = () => {
  const { deleteSaveFile } = useNetHackDriver();
  const engineState = useGameStore((state) => state.engineState);

  return (
    <div className="app-container">
      {/* ヘッダーエリア */}
      <header className="app-header">
        <div className="header-title">
          <h1>NetHack Wasm Driver</h1>
          <span className="subtitle">React 18 Sample Client</span>
        </div>

        <div className="header-controls">
          <span className={`engine-badge ${engineState.toLowerCase()}`}>
            State: {engineState}
          </span>
          <button
            onClick={deleteSaveFile}
            className="btn-delete-save"
            title="セーブデータを完全削除"
          >
            🗑️ Del Save
          </button>
        </div>
      </header>

      {/* メインゲームビュー */}
      <main className="game-view">
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
