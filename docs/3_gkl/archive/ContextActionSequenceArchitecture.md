---
title: ContextActionSequenceArchitecture
status: active
last_updated: 2026-08-15
related_code:
  - src/gkl/ContextActionSequenceExecutor.js
---

# ContextAction シーケンス処理と割り込み制御アーキテクチャ構想資料

## 1. 本 Conversation での達成事項・実装概要

### 1.1 アイテム・地形・コンテキスト解析の精度向上
- **ツルハシ (`pick-axe`) と 斧 (`axe`) の厳密分離**:
  - `pick-axe` は掘削専用（木を切り倒すことは不可）、`axe` は伐採専用とする NetHack の原作仕様に厳密準拠。
  - 正規表現単語境界の修復により誤識別を解消。
- **インベントリ動的追跡**:
  - `"You drop ..."` メッセージのパースを追加し、ドロップしたアイテムをリアルタイム減算・削除。
- **店主限定アクション制御**:
  - 隣接モンスターが店主 (Shopkeeper) の場合のみ `#pay`（代金を払う）アクションを生成。

### 1.2 コア知識層における `setKeyMode` (Vi-keys vs NumPad モード) の一元吸収
- **一元化設計**:
  - クライアント UI 側でキーマッピングを書く必要を無くすため、`AreaStateManager` および `WebUICore` 内に `setKeyMode('vi' | 'numpad')` を実装。
  - `WebUICore` の起動オプション (`options.numpad` / `options.number_pad`) から自動的に追従・連動。
  - コア知識層が自発的にテンキー (`8/2/4/6/7/9/1/3`) と Viキー (`k/j/h/l/y/u/b/n`) を動的に生成・送出。

### 1.3 `number_pad` 干渉回避のための EXTCMD 優先適用
- NetHack C コアにおいて `number_pad:1` モードが有効な場合、`k` (Lock), `j` (Jump), `h` (Help), `l` (Look) などの1文字キーコマンドが全く別のゲームコマンドに変化するリスクを回避するため、`ContextActionEngine` の各種アクションに `extCmd` (`#open`, `#close`, `#kick`, `#untrap`, `#chat`, `#loot`, `#sit`, `#pay` 等) を優先適用。
- 仕様書 [`docs/ContextActionSpec.md`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/ContextActionSpec.md) を配備。

---

## 2. シーケンス実行と割り込み制御に向けた技術的課題と知見

### 2.1 WASM Cコアと JS イベントループの非同期遅延問題
- JavaScript 側 (`WebUICore`) で Cコアの `inputRequired` イベントを受信して非同期タイマー経由で返送しようとすると、プロミス・タイマーの非同期隙間に `activeResolver` の参照が外れて脱落し、2文字目（方向など）が通常の無効なキー送信に化けて手動方向入力待ちに陥る課題が明確化。
- 無防備にキーを連打・非同期送出すると、Cコアのプロンプト状態とバッティングしてゲーム動作が破綻するリスクがある。

### 2.2 割り込みプロンプト（YN問診 / Menu）の発生
- シーケンス（例: 扉を開ける、扉を蹴破る、鍵で解錠する）の途中で、Cコアから想定外の Y/N 問診（例: *"扉に鍵がかかっています。壊しますか？[y/n]"* や *"荷物がいっぱいです"* など）や Menu プロンプトが挿入される場合がある。
- このような割り込みが発生した際、シーケンスを安全にスタック保持・一時停止・または破棄して UI モーダル画面へ復元制御する必要がある。

---

## 3. 次の Conversation での協議・再定義アジェンダ

### 3.1 シーケンスのスタック保持 (Stack/Queue) と所有権 (Ownership)
- **基本方針**:
  - ボタン操作やコンテキストアクション要求があった時点では即座に連打送信せず、まず「予定シーケンス」をスタック（保持）しておく。
  - Cコアから `inputRequired` が発行されたタイミングを起点として評価・実行する。
- **検討事項**:
  - シーケンススタックの保持・管理を、**知識層・司令塔 (`WebUICore`)** で行うか、**ドライバ層 (`NetHackWasmDriver`)** に持たせるか。

### 3.2 `inputRequired` 起点の文脈評価型実行エンジン設計
- `inputRequired` が届いた際、その時のプロンプトカテゴリ（`DIRECTION`, `POSKEY`, `YN`, `MENU`, `EXTCMD` 等）や文脈（choices や prompt）を評価する。
- 期待している文脈と一致する場合のみ、1ステップずつ安全に自動応答・消費する。

### 3.3 安全な割り込み制御 (Interrupt Control) 仕様
- 想定外の `YN` / `MENU` プロンプトが挿入された場合の挙動制御：
  - **パターンA (安全破棄)**: シーケンスを破棄し、通常の UI モーダル画面を露出してプレイヤーに判断を委ねる。
  - **パターンB (一時停止・復元)**: シーケンスを Pause し、プレイヤーの YN 応答後に残りのシーケンスを再開する。
- 知識層全体構想（WASM Cコア、ドライバ、知識解析層、フロントUI）との整合性を相談・再定義する。

---

## 4. GKL Phase 2 実装完了実績

### 4.1 低レイヤー自走消化エンジン (`NetHackWasmDriver.js`)
- `queueSequence(tokens, options)` および `cancelSequence()` を低レイヤー・ドライバー内に実装。
- Cコアの `inputRequired` イベント（`getch`, `poskey`, `getlin`, `get_ext_cmd`, `yn_function`）と直接同期し、1トークンずつ自動注入・即時応答する自走消化ロジックを確立。
- 進行中のプロンプト文言を `putmsg`（投げっぱなしログイベント, `fromSequence: true`）としてログ送出し、UIのモーダル画面を非表示化。
- `yn_function` 経由で発生する方向指定要求（`In what direction?`）の自動解決、および `DIR_*` 抽象方向キーのキーモード別動的変換を完備。

### 4.2 コア状態マシンコントローラー (`RequestController.js`)
- GKLの制御コアとして 4つの状態 (`IDLE`, `EXECUTING`, `ABORTING_ESC`, `SUSPENDED`) を持つ `RequestController` クラスを `src/core/knowledge/RequestController.js` に新設。
- ユーザーの物理キーボード入力検出時にキューを安全クリアし、物理入力を最優先する割り込みサスペンド機能を実装。

### 4.3 Web Worker 透過プロキシ (`NetHackWasmWorkerBridge.js`)
- Web Worker スレッド (`nethack.worker.js`) 経由で動作する WASM 環境に対応。
- postMessage (`QUEUE_SEQUENCE` / `CANCEL_SEQUENCE`) 経由で Worker 内の `NetHackWasmDriver` へシーケンスを透過リレーするプロキシを実装。

### 4.4 `driver_test.html` での動作テスト標準UI
- `tests/driver_test.html` にシーケンステスト入力欄 (`#seq-field`) と「Send Sequence」ボタン、および主要な日本語操作プリセットボタン群を配備。

---

## 5. 今後の課題 (Phase 3 検討アジェンダ)

1. **[TODO] インベントリ参照・自動同期・所持品連動の再設計**:
   - 現段階ではインベントリ参照・パース・所持品連動（ツルハシ・鍵・ロックピック等の認識およびランプ点灯機能）は未解決の技術課題として保留。
   - UI クライアントにおける `apply` (`a`) ボタンの常設による手動道具使用を維持し、将来的に WASM メモリ直接パース等による完全一元化を再設計する。
2. **多言語アクション名・メッセージの統一管理 (i18n)**:
   - 日本語/英語のアクション名・説明の体系的国際化管理。

