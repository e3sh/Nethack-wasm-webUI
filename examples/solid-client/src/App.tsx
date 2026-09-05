import { Component, onMount } from 'solid-js';
import { HeaderPanel } from './components/HeaderPanel';
import { AssistSignalBar } from './components/AssistSignalBar';
import { MessageLog } from './components/MessageLog';
import { GameViewport } from './components/GameViewport';
import { StatusBar } from './components/StatusBar';
import { PromptModal } from './components/PromptModal';
import { InventoryGrid } from './components/InventoryGrid';
import { ContextActions } from './components/ContextActions';
import { GklKnowledgeTabs } from './components/GklKnowledgeTabs';
import { WishModal } from './components/WishModal';
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

      {/* 2. メインゲームビュー (GKL 2カラム ワークスペース) */}
      <main class="game-view gkl-workspace">
        {/* 左エリア: アシストシグナルバー、ログ、ダンジョンマップ親コンテナ、ステータス、プロンプト */}
        <section class="left-workspace">
          {/* 🚨 HUD 最優先アシストシグナルバー */}
          <AssistSignalBar />

          {/* メッセージログエリア (MessageLog) */}
          <MessageLog />

          {/* ダンジョンマップエリア (GameViewport: メインCanvas + FocusCamera + FloorLandmarksHud) */}
          <GameViewport />

          {/* 横型ステータスバー (StatusBar + HP/MP ゲージバー + 詳細展開) */}
          <StatusBar />

          {/* プロンプト入力バー (PromptModal) */}
          <PromptModal />
        </section>

        {/* 右エリア: GKL 所持品 ＆ 推奨アクション ＆ 構造化ナレッジ (3段カード構造) */}
        <aside class="gkl-side-panel">
          {/* 🎒 上段: アイコン型常時表示インベントリ */}
          <InventoryGrid />

          {/* 🧠 中段: 推奨アクションパネル ＋ 「囲」型 3x3 方向パッドフィルター */}
          <ContextActions />

          {/* 💡 下段: 構造化ナレッジ ＆ 戦術アドバイス (タブ切替カード) */}
          <GklKnowledgeTabs />
        </aside>
      </main>

      {/* ✨ 願い（#wish）ビルダーモーダル (WishModal) */}
      <WishModal />

      {/* メニュー / アイテム選択モーダル (MenuModal) */}
      <MenuModal />

      {/* テキスト・ヘルプ閲覧モーダル (TextWindowModal) */}
      <TextWindowModal />

      {/* ゲームオーバー & スコアボード (GameOverModal) */}
      <GameOverModal />

      {/* セーブデータ検出・選択ダイアログ (SaveSelectorModal) */}
      <SaveSelectorModal />
    </div>
  );
};

export default App;
