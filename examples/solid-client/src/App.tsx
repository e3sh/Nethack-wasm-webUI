import { Component, onMount } from 'solid-js';
import { HeaderPanel } from './components/HeaderPanel';
import { MessageLog } from './components/MessageLog';
import { GameCanvas } from './components/GameCanvas';
import { StatusBar } from './components/StatusBar';
import { PromptModal } from './components/PromptModal';
import { GklKnowledgePanel } from './components/GklKnowledgePanel';
import { MenuModal } from './components/MenuModal';
import { TextWindowModal } from './components/TextWindowModal';
import { GameOverModal } from './components/GameOverModal';
import { SaveSelectorModal } from './components/SaveSelectorModal';
import { driverController } from './services/useNetHackDriver';
import './App.css';

export const App: Component = () => {
  onMount(() => {
    driverController.init();
  });

  return (
    <div class="app-container">
      {/* 1. ヘッダーエリア (HeaderPanel) */}
      <HeaderPanel />

      {/* メインゲームビュー (2カラム ワークスペース) */}
      <main class="game-workspace">
        {/* 左エリア: ゲーム画面・ログ・ステータス */}
        <section class="game-main-area">
          {/* 2. メッセージログ (MessageLog) */}
          <MessageLog />

          {/* 3. ダンジョンマップ (GameCanvas) */}
          <GameCanvas />

          {/* 4. ステータスバー (StatusBar) */}
          <StatusBar />

          {/* 5. 入力プロンプト (PromptModal) */}
          <PromptModal />
        </section>

        {/* 右エリア: GKL ナレッジ ＆ 推奨アクション */}
        <aside class="game-side-area">
          {/* 6. GKL 状況推論 ＆ ナレッジアシストパネル (GklKnowledgePanel) */}
          <GklKnowledgePanel />
        </aside>
      </main>

      {/* 7. インベントリ / メニューモーダル (MenuModal) */}
      <MenuModal />

      {/* 8. テキスト・ヘルプ閲覧モーダル (TextWindowModal) */}
      <TextWindowModal />

      {/* 9. ゲームオーバー & スコアボード (GameOverModal) */}
      <GameOverModal />

      {/* 10. セーブデータ検出・選択ダイアログ (SaveSelectorModal) */}
      <SaveSelectorModal />
    </div>
  );
};

export default App;
