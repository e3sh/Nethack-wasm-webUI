---
title: gkl_variant_adaptation_architecture
status: reference
last_updated: 2026-09-12
related_code:
  - src/core/knowledge/
  - src/core/WebUICore.js
  - src/core/request/SignalDetector.js
---

# GKL バリアント適応拡張・互換性アーキテクチャ構想 (GKL Variant Adaptation & Compatibility Architecture)

## 1. はじめに・背景 (Background & Context)

NetHack WASM WebUI プロジェクトにおいて、基盤層である **`WebUICore` は Wasm バリアントフリー**（入出力・抽象プロトコル・テキストウィンドウ・描画を統一し、`win/shim` を備えた任意のバリアントを同列に接続可能な純粋インフラ基盤）として成立・進化してきました。

一方、ゲーム知識層である **Game Knowledge Layer (GKL)** は、モンスター図鑑、アイテム特性・耐性、戦術指南、願い (Wish) や虐殺 (Genocide) などの「ゲームのルール・仕様そのもの（ドメイン知識）」を担うため、**事実上特定バリアント（現在は NetHack 5.0 / 3.7+ 系統）に強く紐付く** という本質的な二面性を持っています。

本文書は、「将来的に Vanilla だけで満足して複数バリアント化を行わない可能性」も十分に考慮した上で、**GKL をプラグインする際のバリアント互換性の考え方、リジェクトすべきか否かの設計判断、および複数バリアントを扱う段になった際の拡張アイディア** を将来いつでも再開・参照できるよう書き残した構想録（Future Note）です。

> [!IMPORTANT]
> **【技術的前提】WASM Cコア側の動作要件（`win/shim` の必須性と 3.6 系以前の実態）**  
> 本システムの `NetHackWasmDriver` は、C コア側のウィンドウポート **`win/shim` (`winshim.c`)** が Emscripten 経由で直接 JavaScript へ発行する構造化イベント（`shim_print_glyph`, `shim_status_update`, `shim_select_menu` 等）と Asyncify 制御を前提としています。  
> 
> * **従来の Web 版 3.6 系との決定的な違い**:  
>   Web 上で動く従来の NetHack 3.6 系（alt.org や hardfought、BrowserNetHack 等）は、`win/tty`（VT100/ANSI 端末出力）を Emscripten でコンパイルし、ブラウザ側で xterm.js 等の「仮想コンソール端末」に文字を描画する**ターミナルエミュレーション方式**です。  
>   そのため、**無改造の素の 3.6 系 WASM バイナリは本システム（WebUICore）では直接動作しません**。  
> * **3.6 系や派生バリアント（JNetHack 等）を動作させる唯一の方法**:  
>   `winshim.c`（約340行の軽量な `struct window_procs` ラッパー）を 3.6 系の C ソースツリーに**バックポート（逆移植）**し、`SHIM_GRAPHICS` を有効化して Wasm ビルドを行う必要があります。NetHack の `window_procs` インターフェースは歴史的に高い上位互換性を持つため、このバックポート移植を行えば 3.6 系ベースのバリアントも本システム上で完全に動作させることが可能です。

---

## 2. 核心の論点：バリアント不一致の GKL はリジェクトすべきか？

WebUICore または Driver が想定するバリアントと、ロードされた GKLPlugin が対象とするバリアントが一致しない場合、システムはどう振る舞うべきか？

```text
[ Wasm Core (Variant: 'slashem') ]
              │
      [ WebUICore ]
              │  use(plugin)
   [ GKLPlugin (Target: 'vanilla-5.0') ] ───▶ リジェクトすべき？ 放置でよい？
```

### 比較評価テーブル

| アプローチ | メリット | デメリット | 採用判断 |
| :--- | :--- | :--- | :---: |
| **A. 完全リジェクト<br>(Hard Error)** | • 誤った知識による事故を100%防止<br>• 不整合が即座に顕在化する | • **マップ追跡や自動移動など共通便利機能まで全滅**<br>• 非同期ロード時の初期化レースに脆弱<br>• ハックやプロトタイピングを著しく阻害 | ❌ **不採用** |
| **B. 完全放置<br>(No-op / Silent)** | • 実装が最もシンプル<br>• UIの裁量にすべて委ねられる | • **サイレントな嘘情報による理不尽な死 (YASD)**<br>• UIが不整合を知る術がなく、警告表示もできない<br>• 開発者・プレイヤーのサポートコスト増大 | ❌ **不採用** |
| **C. メタデータ契約 ＆<br>ソフトチェック (推奨)** | • **共通機能を生かしつつ、危険な誤情報を予防**<br>• UI がバッジ表示や入力フォールバックを判断可能<br>• オプションで厳格モード (`strict`) にも切替可能 | • メタデータ定義と照合ロジックの追加が必要 | 🟢 **推奨 (Adopted)** |

### なぜ「ハードリジェクト」は避けるべきか？
GKL の責務は「モンスター図鑑」のような純粋知識だけではありません。
- **`AreaStateManager`**: 80×24 のマップ記憶、壁・部屋・通路の追跡、ダイクストラ最短経路探索、オートトラベル。
- **`InventoryStateManager`**: 所持品スロット（`a-zA-Z`）とアイテム一覧の同期管理。
- **`RequestController`**: 汎用サイレントシーケンス問い合わせ。

これらは **ほとんどの NetHack バリアントにおいて共通で機能する強力なインフラ・ナビゲーション機能** です。バリアントが完全一致しないからといってプラグインごとリジェクトしてしまうと、これら共通機能の恩恵まで一律に破棄されることになります。

---

## 3. GKL 内部モジュールのバリアント依存度マトリクス

将来バリアント拡張を行う際、GKL 全体をゼロから作り直す必要はありません。内部モジュールごとにバリアント依存度は大きく異なります。

```text
┌─────────────────────────────────────────────────────────────────┐
│ Level 1: バリアント非依存 (どのバリアントでもそのまま動作)       │
│  • AreaStateManager (マップバッファ, ダイクストラ探索, 移動算出)   │
│  • RequestController / InteractiveRequestController (対話制御) │
│  • StatusAccessor (BL_値の汎用パース)                           │
├─────────────────────────────────────────────────────────────────┤
│ Level 2: バリアント弱依存 (一部メッセージやキーの調整で動作)     │
│  • InventoryStateManager (スロット追跡, 装備フラグ)             │
│  • SpellStateManager / SkillStateManager (一覧パース・キー)     │
│  • AttributeStateManager (^X 耐性・属性パース)                  │
├─────────────────────────────────────────────────────────────────┤
│ Level 3: バリアント強依存 (バリアントごとの個別辞書・ルールが必要) │
│  • StructuredKnowledgeEngine (モンスター図鑑, アイテム図鑑, 耐性) │
│  • TacticalAdvisor (戦術危険度判定, 即死回避ロジック)           │
│  • ChemistryKnowledge / PolymorphService (変身・調合ルール)      │
│  • WishService / GenocideService (願い・虐殺の正当性・候補辞書)  │
│  • ContextActionEngine (バリアント固有コマンド: #technique等)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 推奨アーキテクチャ設計 (Recommended Architecture)

### 4.1 プラグイン側のメタデータ宣言 (`targetVariants`)

各プラグインは、自分がターゲットとするバリアント（および互換性のあるバリアント群）を静的メタデータとして自己申告します。

```javascript
export class GKLPlugin {
    static metadata = {
        name: 'GKLPlugin',
        type: 'knowledge',
        version: '1.0.0',
        targetVariant: 'vanilla-5.0',
        supportedVariants: ['vanilla-5.0.*', 'vanilla-3.7.*', 'winshim-3.6.*'],
    };

    constructor(options = {}) {
        this.targetVariants = options.targetVariants || GKLPlugin.metadata.supportedVariants;
        this.isCompatible = true; // コア照合結果
        // ...
    }
}
```

### 4.2 `WebUICore.use()` でのソフト照合とイベント通知

コアへアタッチする際、コアの `variant` とプラグインの `targetVariants` を照合します。
- 不一致であっても **登録自体は拒否せず受け入れます**。
- 代わりに `console.warn` による開発者警告、および UI へのイベント通知を発行します。

```javascript
// WebUICore.js 内での拡張イメージ
use(plugin) {
    if (!plugin) return this;
    this.plugins.push(plugin);

    // バリアント互換性の照合
    const coreVariant = this.variant || (this.driver && this.driver.variant) || 'vanilla';
    if (plugin.targetVariants) {
        const isMatched = this._checkVariantMatch(coreVariant, plugin.targetVariants);
        plugin.isCompatible = isMatched;

        if (!isMatched) {
            console.warn(
                `[WebUICore] ⚠️ Plugin variant mismatch: Core is '${coreVariant}', ` +
                `but ${plugin.constructor.name} targets '${JSON.stringify(plugin.targetVariants)}'. ` +
                `Spoilers and tactical hints may be inaccurate.`
            );

            // UI や外部リスナーへ不整合イベントを発行
            this.emit('pluginCompatibilityChecked', {
                pluginName: plugin.constructor.name,
                coreVariant,
                targetVariants: plugin.targetVariants,
                isCompatible: false
            });

            // 厳格モード（テスト・CI等）が明示指定されている場合のみリジェクト
            if (this.options.strictVariantCheck) {
                throw new Error(`[WebUICore] Incompatible plugin rejected under strictVariantCheck.`);
            }
        }
    }

    if (typeof plugin.attach === 'function') {
        plugin.attach(this);
    }
    // ...
    return this;
}
```

---

## 5. UI / クライアント層での安全なフォールバック表現

UI クライアントは、`gkl.isCompatible === false` または `pluginCompatibilityChecked` イベントを受け取った際、以下のように段階的なフォールバック（Graceful Degradation）を適用できます。

1. **ヘッダー・ステータスバーでの情報提示**:
   - 画面の邪魔にならない位置に「⚠️ 知識ベース互換性注意（Core: Slash'EM / GKL: Vanilla 5.0）」といった小型バッジを表示する。
2. **ハイリスク機能の安全側フェイルセーフ**:
   - **Genocide / Wish ビルダー**: 
     - バリアント不一致時は「確定候補一覧（ドロップダウン）」を抑制し、「自由文字入力フォーム」に倒す（存在しないモンスターやアイテムの選択による暴発を防ぐ）。
   - **TacticalAdvisor (戦術警告)**:
     - 信頼度表示を「推定 (Estimated)」に下げる、または危険度スコア判定を緩和する。
3. **低リスク・インフラ機能の継続利用**:
   - マップ描画、FocusCamera、オートトラベル、インベントリ一覧、テキストウィンドウ管理はそのまま 100% 快適に利用可能。

---

## 6. 将来の複数バリアント展開への布石 (Future Expansion)

もし本格的に複数バリアント（Slash'EM, dNetHack, JNetHack 等）を並行サポートする段階になった場合、以下の 2 つの発展パターンが考えられます。

### パターン 1: ファクトリパターンによる動的プロバイダ選択
コアがバリアントを判別し、最適な GKL インスタンスを自動生成・アタッチする。

```javascript
// GKLFactory による動的生成イメージ
const gkl = GKLFactory.createForVariant(core.variant, {
    language: core.language,
    translator: core.translator
});
core.use(gkl);
```

### パターン 2: 差分知識オーバーレイモデル (Delta Knowledge Overlay)
すべてのバリアントごとに巨大な図鑑（全384モンスター・全481アイテム）をフルセットで定義するのではなく、Vanilla を基底（Base GKL）とし、バリアント差分のみをオーバーレイするモデル。

```javascript
// Slash'EM の差分だけを上書きアタッチするイメージ
const baseGkl = new GKLPlugin();
baseGkl.extendKnowledge({
    variant: 'slashem',
    monsters: SLASHEM_MONSTER_DIFF, // Slash'EM 追加モンスター
    items: SLASHEM_ITEM_DIFF,       // 独自武器・アイテム
    techniques: SLASHEM_TECHNIQUES  // 独自特殊技コマンド
});
core.use(baseGkl);
```

---

## 7. 発展構想：便利機能層 (GSL) と純粋ナレッジ層 (GKL) の分離・別名化

「バリアントに依存する知識」と「バリアントに依存しない便利機能」の混在を抜本的に解決するアプローチとして、**両者を別レイヤー・別プラグインとして分離し、異なる名称を与えて管理を独立させる構想** があります。

### 7.1 レイヤー分離とモジュール再編

| レイヤー | 名称候補案 | 役割・責務 | 内包モジュール | バリアント依存度 |
| :--- | :--- | :--- | :--- | :---: |
| **便利機能・状態層** | **GSL** (Game State Layer)<br>または **ANL** (Assist & Navigation Layer)<br>または **CUL** (Client Utility Layer) | **「現在の客観的事実」の追跡と基本操作支援**<br>• マップ追跡、ダイクストラ探索、オートトラベル<br>• 所持品スロット管理、装備スロット追跡<br>• 基本ステータス抽出、対話シーケンス制御 | • `AreaStateManager`<br>• `InventoryStateManager`<br>• `StatusAccessor`<br>• `InteractiveRequestController` | **ほぼゼロ**<br>(NetHack系Wasm全般で100%共通動作) |
| **純粋ナレッジ層** | **GKL** (Game Knowledge Layer)<br>*(※本来の意味に純化)* | **「ゲームの主観的知識・スポイラー・戦術」**<br>• モンスター・アイテム図鑑・属性・耐性<br>• ケミストリー（調合）、変身制御<br>• 戦術指南、即死回避アドバイス<br>• 願い (Wish) / 虐殺 (Genocide) 候補辞書 | • `StructuredKnowledgeEngine`<br>• `TacticalAdvisor`<br>• `WishService` / `GenocideService`<br>• `PolymorphService`<br>• `ChemistryKnowledge` | **極めて高い**<br>(バリアントごとにルール・辞書が異なる) |

### 7.2 分離によって得られる決定的なメリット

1. **単一責任の原則 (SRP) と名称の整合性**:
   - 「Knowledge（知識）」という名称でありながら、内部でマップの最短経路探索やキー連打制御を行っているという概念のねじれが解消され、責務が美しく整頓されます。
2. **バリアント互換性の問題が根本から単純化**:
   - 便利機能層（GSL / ANL）は**「どのバリアントでも無条件で動く常設プラグイン」**となり、不整合の心配がゼロになります。
   - ナレッジ層（GKL）のみを**「バリアント依存のオプショナル・プラグイン」**として扱うため、「不一致なら GKL だけ外す（または専用 GKL に差し替える）」という判断が極めて自然に行えます。
3. **「GKL を使わない軽量クライアント」への配慮**:
   - 「スポイラーやアシスト機能はゲーム性を損なうので一切不要だが、オートトラベルやインベントリ同期の便利機能だけは使いたい」という硬派なプレイヤー／軽量クライアントの要望に、GSL 単体利用（GKL なし構成）で完璧に応えられます。

### 7.3 クライアントでの組み立てイメージ

```javascript
// 1. 基幹便利機能 (どのバリアントでも共通してアタッチ可能)
const stateLayer = new GameStatePlugin(); // マップ追跡、オートトラベル、インベントリ
core.use(stateLayer);

// 2. ナレッジ層 (バリアントに応じて選択、または省略可能)
// Vanilla 5.0 (または win/shim バックポート版 3.6/JNetHack) の場合:
const knowledgeLayer = new GKLPlugin({ variant: 'vanilla-5.0' });
core.use(knowledgeLayer);

// ※別バリアント（Slash'EM 等）を動かす場合:
// GKL をアタッチしない（または専用 GKL_SlashEM をアタッチする）だけで、
// マップ移動・インベントリ等の便利機能は 100% 安定して動き続ける！
```

---

## 8. まとめ (Summary Note)

- **「リジェクト（弾く）」はしない**:
  - NetHack 系共通のマップ追跡・自動移動・インベントリ同期まで巻き添えで使えなくなるデメリットが大きすぎるため。
- **「完全放置」もしない**:
  - 静的メタデータ（`targetVariants`）による照合を行い、警告ログ出力と UI への不一致フラグ（`isCompatible`）を提供する。
- **UI に裁量を与える**:
  - UI 側で「バッジ表示」や「Wish/Genocide 候補の安全側フォールバック」を行えるようにする。
- **便利機能とナレッジ層の分離という究極解**:
  - 将来複数バリアントを本格展開する際、または軽量クライアントを追求する際は、「便利機能・状態層 (GSL)」と「純粋ナレッジ層 (GKL)」への分離が最も自然で破綻のないアーキテクチャとなる。
- **Vanilla で満足しても損をしない設計**:
  - 本設計は現在の単一バリアント環境でも一切のオーバーヘッドや破綻がなく、将来複数バリアントを触りたくなった際にそのまま美しい契約として機能する。

