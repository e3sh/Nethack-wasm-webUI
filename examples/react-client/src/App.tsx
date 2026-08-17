import React from 'react';
import { HeaderPanel } from './components/HeaderPanel';
import { MessageLog } from './components/MessageLog';
import { GameCanvas } from './components/GameCanvas';
import { StatusBar } from './components/StatusBar';
import { PromptModal } from './components/PromptModal';
import { GklKnowledgePanel } from './components/GklKnowledgePanel';
import { MenuModal } from './components/MenuModal';
import { TextWindowModal } from './components/TextWindowModal';
import { GameOverModal } from './components/GameOverModal';
import './App.css';

export const App: React.FC = () => {
  return (
    <div className="app-container">
      {/* 1. ヘッダーエリア (HeaderPanel) */}
      <HeaderPanel />

      {/* メインゲームビュー */}
      <main className="game-view">
        {/* 2. メッセージログ (MessageLog) */}
        <MessageLog />

        {/* 3. ダンジョンマップ (GameCanvas) */}
        <GameCanvas />

        {/* 4. ステータスバー (StatusBar) */}
        <StatusBar />

        {/* 5. 入力プロンプト (PromptModal) */}
        <PromptModal />

        {/* 6. GKL 状況推論 ＆ ナレッジアシストパネル (GklKnowledgePanel) */}
        <GklKnowledgePanel />
      </main>

      {/* 6. インベントリ / メニューモーダル (MenuModal) */}
      <MenuModal />

      {/* 7. テキスト・ヘルプ閲覧モーダル (TextWindowModal) */}
      <TextWindowModal />

      {/* 8. ゲームオーバー & スコアボード (GameOverModal) */}
      <GameOverModal />
    </div>
  );
};

export default App;
