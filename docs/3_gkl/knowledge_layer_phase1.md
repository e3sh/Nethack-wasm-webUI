# Game Knowledge Layer Phase 1 実績・仕様 ＆ 辞書構築方針ドキュメント

本ドキュメントは、`docs/7_futures/knowledge_layer_concept.md` の構想に基づき、`WebUIcore` に実装された **ゲーム知識層 Phase 1（周辺認知・重ね合わせ復元・推奨アクション生成）** の実績、設計仕様、および今後の **「インタラクト辞書構築方針」** を記録・共有するための資料です。

---

## 1. Phase 1 実績サマリー

Phase 1 では、これまで C言語 (WASM) から単層の描画グリフ (`print_glyph`) としてしか渡されなかったゲーム画面に対し、**`WebUIcore` 側で 3 階層構造 (Bottom: 地形 / Middle: アイテム / Top: モンスター) の周辺状態キャッシュを自走維持する基盤**を構築しました。

これにより、モンスターがアイテムや地形の上に重なった場合でも隠れた情報を失わず、自キャラの足元・周辺 3x3 のセマンティックな状態を高精度に取得・判定可能となりました。

```
┌─────────────────────────────────────────────────────────┐
│ Presenter / UI Layer (Vue / React / DOM コンポーネント)  │
└───────────────────────────▲─────────────────────────────┘
                            │ (3. Recommended Actions / AreaState)
┌───────────────────────────┴─────────────────────────────┐
│ 🧠 Game Knowledge Layer (Phase 1)                       │
│  - ContextActionEngine (推奨アクション生成)              │
│  - glyphClassifier (Glyph ID ➔ セマンティック型判定)     │
└───────────────────────────▲─────────────────────────────┘
                            │ (2. 3階層 LIFO キャッシュ同期)
┌───────────────────────────┴─────────────────────────────┐
│ ⚙️ WebUI Core (データ基盤)                                │
│  - AreaStateManager (80x21セル状態キャッシュ / getAreaState)│
└───────────────────────────▲─────────────────────────────┘
                            │ (1. print_glyph, curs, status)
┌───────────────────────────┴─────────────────────────────┐
│ 🐉 NetHack Core (WASM Engine)                            │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 実装されたモジュールと API 仕様

### ① `glyphClassifier.js` (セマンティック分類)
NetHack 5.0 (3.7) の Glyph オフセットテーブル (`GLYPH_MON_OFF`, `GLYPH_OBJ_OFF`, `GLYPH_CMAP_OFF` 等) を基に、生 Glyph ID を属性フラグ (`isClosedDoor`, `isOpenDoor`, `isStairDown`, `isAltar`, `isFountain` 等) を含む型へと分類。

### ② `AreaStateManager.js` (3階層 LIFO キャッシュ)
80x21 マップの各セルについて、`print_glyph` イベントのみを監視し、`Bottom` (地形), `Middle` (アイテム/設置物), `Top` (モンスター/プレイヤー) を管理。
- **更新ルール**:
  - `TERRAIN` 描画 ➔ `Bottom` に設定 (無ければ `Middle/Top` クリア)
  - `ITEM` 描画 ➔ `Middle` に設定 (`Bottom` 保持)
  - `MONSTER` 描画 ➔ `Top` に設定 (`Middle/Bottom` 保持)
  - アイテムを拾った際 (Cコアから `Floor` 描画受領) ➔ `Middle` がクリアされ、`Bottom` 地形が露出復元。

### ③ `ContextActionEngine.js` (推奨アクション生成)
`AreaState` を受領し、文脈に応じた推奨可能アクション (`RecommendedActions`) を動的生成。
- **足元アイテム**: `[ , ] 足元のアイテムを拾う` (`ACTION_PICKUP`)
- **隣接モンスター**: `[ k ] 北の敵を攻撃` (`ACTION_ATTACK_N`)
- **隣接閉じたドア**: `[ol] 東の扉を開ける` (`ACTION_OPEN_DOOR_E`)
- **足元階段**: `[ > ] 階段を降りる` (`ACTION_STAIR_DOWN`)

### ④ `WebUICore` 公開ファサード API
- `core.getAreaState(radius = 1)` : 自キャラ周辺の構造化領域データ取得
- `core.getRecommendedActions(radius = 1)` : 推奨可能アクション一覧取得
- `core.on('area_updated', (areaState) => ...)` : 状態更新イベント

---

## 3. 今後の「インタラクト辞書 (Interact Dictionary)」構築方針

Phase 1 の基盤完成により、次はより高度な相手・設置物に応じた操作案内を行う **「インタラクト辞書」** の拡充へと進むことができます。

辞書を構築する際、およびアクションを自動生成する際は、以下の重要なルールとガイドラインを適用します。

### ⚠️ 【最重要ルール】`number_pad` モードと抽象方向キーの分離

NetHack には `number_pad: 0` (viキーモード: `h/j/k/l`) と `number_pad: 1` (テンキーモード: `4/2/8/6`) の 2 大キー入力体系が存在します。

もし辞書に生の方向キー文字 `'l'` (East) を書くと、`number_pad: 1` 環境では **`l` が `loot` (宝箱を漁る) コマンドとして誤発動する事故** が発生します。

#### 対策: 抽象方向コード (`DIR_*`) の採用
辞書およびアクション定義には生のキー文字を書かず、**`DIR_E` (東), `DIR_N` (北), `DIR_S` (南), `DIR_W` (西)** という抽象コードで定義します。
`WebUICore` (または `KeyMapper`) が、プレイヤーの `number_pad` 設定に応じて以下のように自動変換して送信します：

- `number_pad: 1` ➔ `DIR_E` は `'6'` として送信
- `number_pad: 0` ➔ `DIR_E` は `'l'` として送信

### 複合操作のワンタップ化 (`keySequence`)
「東の扉を開ける」などのボタンを押した際、`o` 送信後に `In what direction?` というプロンプトを挟まずに直ちに方向キーを送る **`keySequence`** 機能を持たせます。
```javascript
{
    id: 'ACTION_OPEN_DOOR_E',
    label: '東の扉を開ける',
    keySequence: ['o', 'DIR_E'] // 'o' (Open) ➔ 'DIR_E' (東) を自動連続送信
}
```

### ⚠️ 多段階プロンプト遷移とインベントリ知識連携の課題 (Multi-stage Prompt Traversal)

単一キーやシンプルな 1 段階方向選択（例: `o` ➔ `In what direction?`）とは異なり、`a` (Apply / 掘削・解錠・道具使用) や `t` (Throw / 投げる)、`f` (Fire / 射撃) などのコマンドは、NetHack の仕様上 **2 段階以上のプロンプト状態遷移** を伴います。これがゲーム知識層（Game Knowledge Layer）の自動解決における本質的な難しさの要因です。

#### 多段階遷移のフロー例 (`Apply` で壁を掘削・扉を解錠する場合):
1. **コマンド送信**: `'a'` (Apply) 送信 ➔ NetHack Core: `What do you want to apply?` (道具選択プロンプト)
2. **道具選択**: 道具記号 `'f'` (ツルハシ pick-axe や 鍵 lock pick 等) 送信 ➔ NetHack Core: `In what direction?` (方向選択プロンプト)
3. **方向選択**: 抽象方向 `'DIR_E'` (東) 送信 ➔ 掘削・解錠アクション実行！

#### 知識層レイヤーにおける難しさと今後の解決アプローチ:
1. **固定文字列の一括送信では解決不可**: プレイヤーのインベントリ内で、ツルハシや鍵などの道具がどのアルファベット記号（`a`〜`z`）に割り当てられているかは動的に変化するため、固定の `keySequence` では処理できません。
2. **インベントリ知識層 (`InventoryManager`) との統合連携**:
   - `ContextActionEngine` がアクションを生成する際、対象アイテムカテゴリ（`ITEM_PICKAXE` や `ITEM_KEY` 等）を識別メタデータとして保持。
   - インベントリ知識層から現在の手持ち割り当て記号を動的に検索・取得し、`keySequence: ['a', dynamicItemChar, 'DIR_E']` のように道具記号を自動埋め込みして一括解決する高度なモジュール間連携を構築します。
3. **プロンプト状態マシンのフックによるガイド表示**:
   - 完全自動化を行わない場合でも、NetHack から `What do you want to apply?` プロンプトが届いた瞬間（`inputRequired` / `prompt` イベント）を知識層が検知し、該当する手持ち道具（ツルハシや鍵）をUI上でハイライト表示・ワンタップ選択可能にするガイド支援を実装します。

### 最新の実装構造とインタラクト辞書スキーマ (Current Action Schema)

`ContextActionEngine.js` にて実装された最新のアクションスキーマは、英語名 (`label`) と日本語名 (`labelJa`) のハイブリッド構造、誤操作ガード (`risk: 'danger' | 'warning'`)、および優先度スコア (`priority`) を含む以下の形式に統合・定義されています。

また、水を飲むコマンドは `'q'` (旧 `quaff`)、蹴るコマンドは `'C-d'` (旧 `k`)、コンテナは `isContainer: true` 判定時のみ適用するなど、NetHack の正確なキーバインドおよび最新判定仕様に完全準拠しています。

```javascript
const ENTITY_INTERACT_DICTIONARY = {
    // 祭壇 (Altar)
    'ALTAR': [
        { id: 'ACTION_OFFER',    label: 'Offer corpse on altar', labelJa: '死体を捧げる (Offer)', key: '#offer', priority: 85, risk: null },
        { id: 'ACTION_BUC_DROP', label: 'Drop item to test BUC', labelJa: 'BUC判別・落とす (Drop)', key: 'd', priority: 70, risk: null },
        { id: 'ACTION_PRAY',     label: 'Pray to god', labelJa: '神に祈る (Pray)', key: '#pray', priority: 60, risk: 'danger' }
    ],
    // 泉 (Fountain)
    'FOUNTAIN': [
        { id: 'ACTION_QUAFF_FOUNTAIN', label: 'Quaff from fountain', labelJa: '泉の水を飲む (Quaff)', key: 'q', priority: 75, risk: 'warning' },
        { id: 'ACTION_DIP_FOUNTAIN',   label: 'Dip item in fountain', labelJa: '泉に浸す (Dip)', key: '#dip', priority: 70, risk: null },
        { id: 'ACTION_KICK_FOUNTAIN',  label: 'Kick fountain', labelJa: '泉を蹴る (Kick)', key: 'C-d', priority: 20, risk: 'danger' }
    ],
    // シンク (Sink)
    'SINK': [
        { id: 'ACTION_SIT_SINK',   label: 'Sit on sink (Identify ring)', labelJa: '座る・指輪識別 (Sit)', key: '#sit', priority: 75, risk: null },
        { id: 'ACTION_QUAFF_SINK', label: 'Drink from sink', labelJa: 'シンクから飲む (Quaff)', key: 'q', priority: 70, risk: 'warning' },
        { id: 'ACTION_KICK_SINK',  label: 'Kick sink', labelJa: 'シンクを蹴る (Kick)', key: 'C-d', priority: 30, risk: 'warning' }
    ],
    // コンテナ・宝箱・袋 (isContainer: true 時のみ動的適用)
    'CONTAINER': [
        { id: 'ACTION_LOOT',        label: 'Loot container / bag', labelJa: '漁る/開ける (Loot)', key: '#loot', priority: 90, risk: null },
        { id: 'ACTION_UNTRAP_FEET', label: 'Untrap feet / container', labelJa: '箱の罠解除 (Untrap)', key: '#untrap', priority: 80, risk: null }
    ],
    // 樹木 (Tree - 隣接時)
    'TREE': [
        { id: 'ACTION_KICK_TREE', label: 'Kick tree', labelJa: '木を蹴る (Kick)', key: 'C-d', target: 'adjacent', priority: 65, risk: null },
        { id: 'ACTION_CHOP_TREE', label: 'Chop tree', labelJa: '木を伐採 (Apply axe)', key: 'a', target: 'adjacent', priority: 55, risk: null }
    ]
};
```

---

## 4. UI クライアント（Vue / React / DOM）での活用展望

PoC クライアント (`webuicore_poc.html`) での視覚的実証を経て、本機能はサンプルクライアント群 (Vue 3, React 18, Svelte, SolidJS) のコンポーネントとして移植・活用する準備が整いました。

### 推奨される UI コンポーネント構成
1. **`<SurroundingsMinimap />`**:
   - プレイヤー中心 3x3 のタッチ対応ミニコンテキストマップ。
2. **`<ContextActionToolbar />`**:
   - `core.on('area_updated')` を購読し、現在実行可能なアクション（拾う、攻撃、ドア開閉、会話、階段移動）をスタイリッシュなボタン列として画面下部やサイドバーにリアルタイム表示するコンポーネント。

---

*作成日: 2026-08-09*  
*関連ドキュメント: `docs/7_futures/knowledge_layer_concept.md`, `WebUICore_Handoff_and_TODO.md`*
