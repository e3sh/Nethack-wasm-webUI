# レイヤー設計 ＆ 修正方針の厳守原則 (Layer Architecture & Refactoring Rules)

## 1. 呼び出し側ミスの根本修正原則 (Fix the Caller, Not the Core)
- UIクライアントや上位呼び出し側のミス（関数の呼び出し先間違い、引数間違い等）を発見した場合、安易に WebUICore や Driver などの下層・コアライブラリ側に補正用ラッパー、プロキシ関数、または互換用分岐を追加してはならない。
- 修正は必ず**「間違っている呼び出し側・上位レイヤー」**でのみ行うこと。

## 2. 各レイヤーの単一責務と境界の厳守 (Layer Responsibility Boundaries)
- **Driver (NetHackWasmDriver / WorkerBridge / FSManager / Memory)**:
  - WASM/Worker との純粋な低レベル I/O 通信、トークン自動消費、メモリバッファ収集、VFS管理に専念する。
  - 画面表示ロジックやドメイン知識を直接抱え込まない。
- **WebUICore**:
  - ゲームエンジン（Driver）と UI / GKL / レンダラー等を中継・統括する単一の真実源泉 (SSOT) 兼コントローラー。
  - 状態管理、イベントディスパッチ、入力の抽象化を担当する。
  - プラグイン内部のパラメータ（GKL の StateManager や TranslationEngine の内部変数等）をシステム設定の正として参照してはならない。
- **GKL (Game Knowledge Layer)**:
  - ドメイン知識のパース・保持、状況推論（Situation）、および参謀（TacticalAdvisor / ETA）機能に専念する。
  - WebUICore の公開イベントを自律的に購読して状態を更新する。UI や Core から内部マネージャーを直接叩かせない。
- **UI / Client (Vue, React, Svelte, Solid, DOM, Mobile)**:
  - ユーザーインターフェースの描画とユーザー入力の WebUICore への伝達に専念する。
  - **禁止事項**:
    1. ❌ UI側から GKL 内部の個別マネージャー（`core.gkl.areaStateManager`, `inventoryStateManager` 等）を直接呼び出して状態を更新する行為（GKLPlugin 自律更新に任せる）。
    2. ❌ `WebUICore` をバイパスして `core.driver` や `window.Module` を直接操作する行為。

## 3. 描画・更新ループの原則 (On-Demand / Reactive Rendering)
- ゲーム画面の描画は、ステート変化（`mapGrid` や `cursorPos` の更新イベント）時にのみ 1 回実行する**「オンデマンド・リアクティブ描画」**を原則とする。
- **禁止事項**:
  - ❌ `requestAnimationFrame` や `setInterval` で毎フレーム（60〜144fps）Canvas 全消去や全セル走査を無条件に回し続ける行為（GPU/CPUリソースの浪費）。
  - ❌ 状態変化がない待機フレームでの無駄な DOM / Canvas 再描画。

## 4. 対症療法的なパッチワークの禁止 (No Superficial Symptom Patches)
- 不具合の表面上の症状（画面が出る・エラーになる等）を消すためだけに、低レイヤーの既存関数に安易なガード条件やフラグチェックを追加してはならない。必ず原因の所在（どのレイヤーの契約違反か）を特定してから修正すること。
- TypeScript の型定義（`src/core/index.d.ts`）に準拠し、`(core as any)` のような不透明なキャストによるレイヤー侵犯を避けること。
