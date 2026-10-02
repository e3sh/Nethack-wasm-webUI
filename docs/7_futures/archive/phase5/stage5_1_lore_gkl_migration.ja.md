---
title: "Phase 5 - Stage 5.1 詳細仕様書: LORE/Codex の GKL 配下への移設と責務純化"
status: implemented
created_at: 2026-09-19
last_updated: 2026-09-25

related_docs:
  - docs/7_futures/phase5_detailed_migration_plan.ja.md
  - docs/7_futures/message_context_and_signal_driven_architecture.ja.md
related_code:
  - src/core/WebUICore.js
  - src/core/knowledge/GKLPlugin.js
  - src/core/knowledge/lore/LoreCodex.js
  - src/core/knowledge/lore/LoreDetector.js
---

# Phase 5 - Stage 5.1 詳細仕様書
## LORE/Codex の GKL 配下への移設と WebUICore の責務純化

---

## 1. 目的とスコープ (Objective & Scope)
- **現状**:
  - `src/core/lore/`（LoreDetector, LoreCodex, LoreCodexStorage, ElberethAnalyzer, EngravingArchaeologist）が独立ディレクトリとして存在。
  - `WebUICore.js` が `this.loreCodex` と `this.loreDetector` を直接インスタンス化し、`putstr` / `pline` 受信部でインラインに `loreCodex.addRumor` や `loreCodex.updateWard` を呼び出している（約 90 行のドメインロジックが WebUICore に直書き）。
  - 一方で、床文字の復元や結界監視には `AreaStateManager`（GKL 配下）のプレイヤー座標が必要なため、WebUICore から `this.gkl?.areaStateManager` を参照するなど、レイヤー間の逆流が発生している。
- **目的**:
  - WebUICore を「I/O とシグナル発行のみを担当する薄いインフラ層」に戻す。
  - ゲーム知識・伝承・コレクション管理を本来の境界である「GKL（Game Knowledge Layer）」へ一本化する。
  - これにより、Stage 5.2 の「状況シグナルディスパッチ基盤」を極めてクリーンに実装できるようにする。

---

## 2. 移設後のアーキテクチャ設計

```
src/core/
├── WebUICore.js              // 低レベル I/O、Wasm 監視、シグナル emit ('situationSignal', 'loreSignal')
└── knowledge/
    ├── GKLPlugin.js          // WebUICore のシグナルを購読し、各マネージャを統括
    ├── state/                // 状態管理 (Area, Attribute, Inventory, Monster, etc.)
    ├── engines/              // 推論・戦術 (TacticalAdvisor, ItemIdentification, etc.)
    └── lore/                 // ★移設: 伝承・コレクション・床文字考古学
        ├── data/
        │   └── LoreMasterData.js
        ├── ElberethAnalyzer.js
        ├── EngravingArchaeologist.js
        ├── LoreCodex.js
        ├── LoreCodexStorage.js
        └── LoreDetector.js
```

---

## 3. 連携仕様（Pub/Sub と API プロキシ）

### 3.1 WebUICore の責務
`putstr` / `pline` 受信時、シグナル検知層が LORE シグナルを検知したら、単にイベントを発行するのみとします（ドメインロジックの直書き全廃）：
```javascript
this.emit('situationSignal', { type: 'LORE', signal: loreSignal });
this.emit('signal', loreSignal);
this.emit(`signal:${loreSignal.signalId}`, loreSignal);
this.emit('loreSignal', loreSignal); // 後方互換維持
```

### 3.2 GKLPlugin の責務
`GKLPlugin.prototype.bindCore(core)` 内で、WebUICore のシグナルを購読し、Codex を更新：
```javascript
core.on('signal:SIGNAL_LORE_RUMOR', (sig) => this.loreCodex.addRumor(sig));
core.on('signal:SIGNAL_LORE_ORACLE', (sig) => this.loreCodex.addOracle(sig));
core.on('signal:SIGNAL_LORE_ENGRAVE', (sig) => this._handleEngraveSignal(sig));
```

### 3.3 後方互換 API の担保（非破壊原則）
既存クライアント（UI、`tools/lore_codex.html`、`tools/save_manager.html`）が `core.getCodex()` や `core.getLoreCodex()` を呼び出しているため、WebUICore 側に委任プロキシを残します：
```javascript
getCodex() {
    return this.gkl?.getCodex() || this._fallbackLoreCodex;
}
getLoreCodex() {
    return this.getCodex();
}
```

### 3.4 TacticalAdvisor との直接連携
`TacticalAdvisor` が `GKLPlugin.loreCodex.getWardState()` を直接参照可能になり、「Elbereth 結界上にいるが残存率が 40% に低下しているため再刻印を推奨」といった高度な戦術助言をゼロコストで生成可能となります。

---

## 4. 作業手順とチェックリスト

- [x] **Step 5.1.1**: ディレクトリ `src/core/knowledge/lore/` を作成し、`src/core/lore/*` の全ファイルおよびテストファイルを配置。
- [x] **Step 5.1.2**: 移設先ファイルの相対パス import（`LoreMasterData.js` やテストのパス）を整合。
- [x] **Step 5.1.3**: `src/core/knowledge/index.js` に `LoreCodex`, `LoreDetector`, `EngravingArchaeologist` 等を export 追加。
- [x] **Step 5.1.4**: `GKLPlugin.js` に `LoreCodex` を統合し、シグナル購読リスナーおよび `getCodex()` API を実装。
- [x] **Step 5.1.5**: `WebUICore.js` からインラインの Codex 更新処理を削除し、純粋な `emit` とプロキシ API にリファクタリング。
- [x] **Step 5.1.6**: 単体テスト（`LoreCodex.test.js`, `LoreDetector.test.js`, `EngravingArchaeologist.test.js`, `GKLPlugin.test.js`, `WebUICore.test.js`）を実行し、全パスを確認。
- [x] **Step 5.1.7**: `npm test`（1111件）および全クライアント（Vue, React, Solid, Svelte）のビルドが 100% 通過することを確認（Zero-Regression Gate 達成）。


---

## 5. 完了判定基準 (DoD)
1. `WebUICore.js` 内に LORE 固有のインラインロジックが 1 行も残っていないこと。
2. 既存 LORE 単体テスト（21件）および全回帰テストが 100% パスすること。
3. `tools/lore_codex.html` および `tools/save_manager.html` が変更なしで完全動作すること。
