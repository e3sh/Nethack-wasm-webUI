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

### 辞書のカテゴリ分類設計案
```javascript
const ENTITY_INTERACT_DICTIONARY = {
    // 設置物 (Fixtures)
    'ALTAR':    [{ label: '祭壇に捧げる', keySequence: ['#offer'] }, { label: '神に祈る', keySequence: ['#pray'] }],
    'FOUNTAIN': [{ label: '噴水の水を飲む', keySequence: ['quaff'] }, { label: '手を洗う/浸す', keySequence: ['#dip'] }, { label: '噴水を蹴る', keySequence: ['k'] }],
    'SINK':     [{ label: 'シンクの水を飲む', keySequence: ['quaff'] }, { label: 'シンクを蹴る', keySequence: ['k'] }],
    'CHEST':    [{ label: '宝箱を漁る', keySequence: ['#loot'] }, { label: '鍵を開ける', keySequence: ['#apply'] }],

    // NPC / ペット
    'PET':      [{ label: 'ペットになでる/指示', keySequence: ['m'] }],
    'NPC_SHOPKEEPER': [{ label: '店主と話す', keySequence: ['#chat'] }, { label: '代金を支払う', keySequence: ['p'] }],
    'NPC_ORACLE':     [{ label: '神託を聞く', keySequence: ['#chat'] }],

    // ドロップアイテム / 死体
    'CORPSE':   [{ label: '死体を食べる', keySequence: ['e'] }, { label: '祭壇に捧げる', keySequence: ['#offer'] }]
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
