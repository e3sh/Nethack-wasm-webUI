# 📋 WebUICore 次回作業引継ぎ資料 ＆ 残課題 TODO

本ドキュメントは、これまでの開発成果を踏まえ、次回以降の作業をスムーズに開始・展開するための **引継ぎ資料および TODO リスト** です。

---

## 1. 現状のステータス概要

- **WebUICore 基盤**: **FIX / 実証完了**
  - 8段階 Lifecycle Management, リロードなし Restart, 上下キーメニュー選択, ターゲットカーソル追従, 解像度・マップクリア・ステータス型安全パースは `WebUICore.js`, `NetHackMemory.js`, `NetHackFSManager.js`, `webuicore_poc.html` で動作確認・検証済み。
- **残課題の扱い**:
  - ゲーム終了時の死因・詳細要因判定および `/save/record` 連携のさらなる完全パースについては、今回のコア開発の範囲を超え、Cコア側の出力タイミングや特定終了シーケンスの探査が必要となるため **TODO（継続改善タスク）** として定義。

---

## 2. 次回以降の残課題・TODO リスト

### 📌 [TODO 1] ゲームオーバー時・終了時詳細要因の完全パース機能の追加調整
- **内容**:
  - `GameOverResolver.js` および `NetHackFSManager.js` において、特定終了パターン（`quit`, `escaped`, `panic` 等）や死亡理由テキストの Cコア出力タイミング（`/save/record` や `/save/logfile` の即時書き込み同期タイミング）の解析を深め、リザルトダイアログの死因表示の整合性をさらに高める。

### 📌 [TODO 2] サンプルクライアント群 (`examples/`) の WebUICore 移行
- **対象**:
  - `examples/vue3-app`
  - `examples/react18-app`
  - `examples/svelte-app`
  - `examples/solidjs-app`
  - `examples/mobile-app`
  - `examples/vanilla-app`
- **標準UI仕様の適用項目**:
  1. 旧 `NetHackWasmDriver` 直接参照から `WebUICore` 参照への置き換え。
  2. メニューダイアログへの **「上下カーソルキー (`↑`/`↓`) 選択 ＋ `Enter` 決定」** インターフェースの標準搭載。
  3. `stateChange` によるローディングガード画面の組み込み。
  4. ターゲットカーソル追従フォーカス枠の追加。

### 📌 [TODO 3] 他機能との接続・連携機能の全体調整（SoundAgent, Gamepad, TranslationEngine, AutoSave等）
- **内容**:
  - `WebUICore` 内に組み込まれている各種サブコンポーネント（サウンド音效 `SoundAgent`、ゲームパッド操作 `GamepadController`、自動翻訳 `TranslationEngine`、IndexedDBセーブ・復元 `NetHackFSManager`）は現在部分的に動作・接続されております。
  - 各種イベント（`inputRequired`, `statusUpdate`, `message`, `exited` 等）発生時におけるこれらの他機能コンポーネントとの連携・発火タイミング・データ引渡しの整合性をさらに高め、スムーズな統合動作を実現する。

### 📌 [TODO 4] WebUICore パッケージのモジュール公開準備
- **内容**:
  - npm パッケージ化またはライブラリ単体配布に向けた `package.json` のエクスポート構成整頓と TypeScript 型定義ファイル (`index.d.ts`) の作成検討。

---

## 3. 次回の作業開始時のおすすめファーストステップ

1. `webuicore_poc.html` をブラウザで起動し、WebUICore の現行動作を確認する。
2. `examples/` 内の最初のサンプル（例: `examples/vue3-app` または `vanilla-app`）を選択し、`WebUICore` のインポートと「上下キー選択 UI」の組み込み作業に着手する。
