---
title: コンテキスト連動型・岩盤（STONE）可視化 ＆ 掘削アシストレンダリング構想
status: proposed
created: 2026-10-11
last_updated: 2026-10-12
related_docs:
  - ../2_client_ui/shim_driven_rendering_pipeline_architecture.ja.md
  - ../3_gkl/AreaStateManager_Architecture_and_Specification.ja.md
  - ../SYSTEM_CAPABILITIES.md
---

# ⛏️ コンテキスト連動型・岩盤（STONE）可視化 ＆ 掘削アシストレンダリング構想

## 1. 背景と課題（トレードオフの整理）

NetHack のダンジョン構造において、部屋（Room）の周囲には明示的な壁地形（`VWALL`, `HWALL` 等）が存在する一方、通路（`CORR`: `#`）の周囲には専用の壁データが存在せず、マップ外周の余白と同じ **無地の岩盤（`STONE`: `typ === 0`, `glyph === 3917`, `ch === ' '`）** で埋め尽くされている。

Stage 8.3-B において、`print_glyph` の可視性主権を徹底し `ch === ' '` を `UNEXPLORED`（黒抜き・非表示）として統一した結果、以下のトレードオフが明確になった：

| 描画方式 | メリット | デメリット |
| :--- | :--- | :--- |
| **A. 黒抜き方式（現行 Stage 8.3-B）**<br>（`STONE` を描画せず背景黒にする） | ・部屋と通路のネットワーク構造が黒背景にくっきり浮かび上がる<br>・ミニマップや WebGPU HD-2D ジオラマでの全体視認性が非常に高い | ・通路脇の「観測済みの岩盤（掘れる壁）」と「未踏の暗闇（`9622`）」が同じ黒になり、**つるはし等で壁を掘った際のくぼみや掘削可能範囲が直感的に分かりにくい** |
| **B. 常時タイル描画方式（旧挙動）**<br>（観測済み `3917` に岩盤タイルを描画） | ・通路脇のどこまでが観測済みの岩盤か、どこを1マス掘ったかが視覚的に分かる | ・通路や部屋の周囲が分厚い岩盤テクスチャで埋め尽くされ、ダンジョン全体の形状（通路と部屋の境界）が把握しづらくなる |

---

## 2. コンセプト：状況（コンテキスト）に応じたスマート岩盤可視化

Stage 8.3-B の基盤整備により、GKL は現在 **① `print_glyph` で一度でも観測された岩盤（`glyph === 3917`）か未踏領域（`glyph === 9622`）かの区別**、**② Shim Direct Binding による真の地形（`levl[x][y].typ === 0` および `flags`）**、**③ インベントリ内の掘削ツール所持状態** をすべて $O(1)$ で正確に把握できている。

この強みを活かし、「常時すべて描く／すべて消す」の二択ではなく、**プレイヤーの周辺視野や行動コンテキスト（掘削アクション）に連動して必要なときだけ岩盤（`STONE`）を浮かび上がらせる** ハイブリッド・レンダリングを導入する。

---

## 3. 3つのアプローチ案（組み合わせ可能）

### アプローチ 1: ContextActions（掘削モード・方向指示）連動ハイライト【本命・最スマート】
普段の探索・移動時は現行の「黒抜き」で通路・部屋の視認性を最大化し、**「壁・岩盤を掘るコンテキスト」が発生したときだけ周囲の掘削可能な岩盤（`STONE` / 壁）を可視化・強調描画する**。

- **発動トリガー**:
  1. `DirectionPad` で方向を選択した際、その方向の隣接マス（`STONE` または掘削可能壁）に対して `ContextActionGenerator` / `ActionSignalResolver` が **「⛏️ 掘る (`ACTION_APPLY_DIG` / `ACTION_ZAP_DIG`)」** を候補として導出しているとき。
  2. または、プレイヤーが「つるはし (`pick-axe`)」「ドワーフのつるはし (`dwarvish mattock`)」を装備中、あるいは `a` (apply) で掘削ツールを選択した状態。
- **視覚表現**:
  - プレイヤー周囲（隣接 8 マス、または掘削射線方向）の `typ === 0` (`STONE`) マスにのみ、岩盤タイル（`3917`）＋掘削ターゲット枠（半透明アンバー／ガイド枠）を描画する。
  - これにより、「なぜここに『掘る』ボタンが出ているのか（＝そこに掘れる岩盤が存在するから）」が UI と盤面ビジュアルで完全に一致する。

### アプローチ 2: トーチライト（周辺狭域視野）岩肌フェード表現
ダンジョン探索の臨場感（HD-2D らしさ）と構造視認性を両立するため、**自キャラの周囲 1〜2 マス（ランタン・松明の明かりが強く届く範囲）に限り、観測済みの岩盤（`glyph === 3917`）を減光（不透明度 `0.3`〜`0.45`）してうっすら描画する**。

- **メリット**:
  - 自キャラのすぐ隣にある通路の壁や、つるはしで斜めに1マス掘った際の「くぼみ周辺の岩肌」が常に自然に見える。
  - 自キャラから離れた場所やミニマップ（`MinimapHudRenderer`）は完全に黒抜きのまま維持されるため、マップ全体の見やすさが一切損なわれない。

### アプローチ 3: レンダリング設定（UIConfig）による表示モード選択
ユーザーの好みやプレイスタイルに応じ、`UIConfigStore`（表示設定）で通路周囲の岩盤表現を切り替え可能にする。

- **`smart`（デフォルト推奨）**: 通常は黒抜き ＋ 掘削コンテキスト／周辺視野でのみ岩盤を表示（アプローチ 1 + 2）
- **`minimal`（構造優先・ASCII準拠）**: `STONE` を常に非表示（現行 Stage 8.3-B 挙動）
- **`classic_tile`（タイル完全表示）**: 観測済みの `glyph === 3917` を常時タイル描画（ミニマップのみ黒抜き維持）

---

## 4. 実装に向けたアーキテクチャ設計メモ

### 4.1 `AreaStateManager` における「観測済み `STONE`」と「完全未踏 `UNEXPLORED`」の区別保持
現在 `AreaStateManager.updateGlyph()` では `glyphInfo.ch === ' '` を一律で `ENTITY_TYPES.UNEXPLORED` に分類している。これを以下のように細分化するだけで、レンダラー側で自在に制御可能となる：

- `glyphId >= 9622` (`GLYPH_UNEXPLORED_OFF`):
  - `type: ENTITY_TYPES.UNEXPLORED`, `isObservedStone: false`（完全未踏）
- `glyphId === 3917` (`GLYPH_CMAP_OFF + S_stone`):
  - `type: ENTITY_TYPES.UNEXPLORED`（または `TERRAIN`）, `isObservedStone: true`, `rawGlyph: 3917`（観測済みの無地岩盤）

### 4.2 各レンダラーでの扱い
- **`MinimapHudRenderer`**:
  - 常に `isObservedStone` を描画しない（通路・部屋の構造視認性を最優先）。
- **`VirtualDungeonScreen` / `MainViewportRenderer` / `WebGPUHD2DRenderer`**:
  - 通常セルは `isObservedStone` をスキップ（黒抜き）。
  - プレイヤー周辺（チェビシェフ距離 $\le 1$〜$2$）または「掘削アクション候補あり」の隣接セルのみ、`rawGlyph: 3917` の岩盤タイル（および掘削ガイド）を描画。

---

## 5. 発展構想：マップ上への ContextActions コマンド数オーバーラップ表示と UI 省スペース化

### 5.1 背景と狙い（UI 面積の削減と直感性の向上）
現在、右サイドパネルの中段（`#card-actions` 内の `#gkl-direction-pad`）には「囲」型の 3×3 方向フィルターインジケーター（`DirectionPad`）が配置され、周囲8方向＋足元の推奨アクション数（`.gkl-dir-badge`）を表示しているが、サイドパネルの縦幅を大きく占有している。

一方で、盤面クリック時にはすでに `CanvasInteractionController` と `FloatingContextActions` により、**隣接マスや足元を直接クリックして吹き出し型の ContextActions メニューを展開する仕組み**が稼働している。

そこで、マップ画面と ContextActions を連動させる発展形として、**設定に応じて自キャラ周囲（隣接8マス＋足元）のマップ上に直接コマンド数バッジをオーバーラップ表示し、サイドパネルの 3×3 インジケータを省略・シンプル化できる仕組み**を導入する。

- **UX 上のメリット**:
  1. **視線移動のゼロ化**: 「マップ上の自キャラ周囲」と「右サイドパネルの 3×3 パッド」の間で視線を往復させる必要がなくなり、「隣のマスにバッジが出ている ➔ そのままそのマスをクリックしてアクション実行」という直感的な操作が盤面内で完結する。
  2. **掘削アシストとの完全な親和性**: コンテキスト連動で浮かび上がった掘削可能岩盤（`STONE`）の上にコマンド数インジケータが表示されることで、「ここが掘れる（クリックで掘削コマンドが出る）」ことが視覚的に一目瞭然となる。
  3. **サイドパネルの省スペース化**: マップ上のオーバーラップ表示を有効にした際、サイドパネルの 3×3 キーパッド（または推奨アクション枠全体）を非表示・折りたたみ可能にすることで、インベントリや戦術アドバイスの表示領域を大幅に拡大できる。

### 5.2 レンダリングと UI 制御を複雑化させないためのアーキテクチャ方針
「マップのレンダリングに UI インジケータを含めると処理や制御が複雑化するのではないか」という懸念に対しては、**地形キャッシュや 3D パイプラインと UI オーバーレイ層を厳密に分離する**ことでシンプルに実装できる。

1. **オフスクリーン背景や WebGPU 3D インスタンスバッファには含めない（分離の原則）**
   - `VirtualDungeonScreen`（背景キャッシュ）や `WebGPUHD2DRenderer` の 3D インスタンスバッファにバッジを組み込むと、アクション数が変化するたびに Dirty フラッシュや GPU バッファ再構築が必要になり制御が複雑化する。
   - 代わりに、現在すでに **アイテム山積み `[+]`・ペット `[♥]`・騎乗 `[R]` のミニバッジを描画している「最前面 2D オーバーレイパス」** に相乗りする。
     - **2D グラフィックモード (`MainViewportRenderer`)**: 背景転送後の動的ループ内で Canvas 2D API によりバッジを描画。
     - **WebGPU HD-2D モード (`WebGPUHD2DRenderer`)**: 3D キャンバスの上に重なる透明 2D キャンバス（`fxCanvas`）上で、`worldToScreen(x, y, z)` を用いて 3D 座標からスクリーン座標へ投影しバッジを描画。
   - 走査対象はフロア全体（80×24）ではなく **自キャラ周囲の最大 9 マス（`dx: -1..1, dy: -1..1`）のみ** であるため、描画負荷は実質ゼロに近い。

2. **入力制御（クリック当たり判定）は既存の `CanvasInteractionController` をそのまま利用**
   - レンダラー側にボタンのクリック判定やイベントリスナーを新規実装する必要はない。
   - 既存の `CanvasInteractionController.handleCanvasInspect()` が 2D / 3D レイキャスト / ASCII のすべてにおいてクリック位置をグリッド座標 `(gx, gy)` に変換し、`FloatingContextActions`（吹き出しメニュー）を自動展開するため、**レンダラーは純粋に「バッジの見た目を描画するだけ」の片方向データフロー**に保たれる。

### 5.3 表示ルールと既存バッジとの棲み分け
1. **視覚ノイズの防止（固有アクションのみカウント）**
   - 通常の「移動（1歩歩く）」や「待機」などのデフォルトアクションはカウントに含めず、現在の `DirectionPad` と同様に **GKL が導出した固有の ContextActions（扉の開閉、掘削、罠解除、拾う、階段移動、会話など）が 1 件以上あるマスにのみ** インジケータ（数字バッジ＋控えめなガイド枠）を表示する。これにより、通常の移動中は視界がクリアに保たれる。
2. **既存ミニバッジとの配置分離**
   - アイテム山積み `[+]` は**タイル右下**、ペット `[♥]` / 騎乗 `[R]` は**キャラ頭上右上**に配置されているため、ContextActions のコマンド数バッジは **タイル左上（または上辺コーナー）** にシアン／アンバー系のピル型ミニバッジとして配置し、重なりを防止する。
3. **`UIConfigStore` による表示設定の切り替え**
   - `mapActionIndicator`（マップ上のアクション数オーバーレイ表示: ON/OFF）およびサイドパネル側の 3×3 パッド表示設定を追加し、盤面直感操作スタイルと従来のサイドパネル操作スタイルをユーザーが自由に選択・併用できるようにする。

---

## 6. 関連モジュール
- `src/core/knowledge/state/AreaStateManager.js`
- `src/core/knowledge/ActionSignalResolver.js` / `ContextActionEngine.js`
- `src/ui-controller/UIConfigStore.js`
- `examples/gkl-pure-js-client/modules/renderers/VirtualDungeonScreen.js`
- `examples/gkl-pure-js-client/modules/renderers/MainViewportRenderer.js`
- `examples/gkl-pure-js-client/modules/renderers/WebGPUHD2DRenderer.js`
- `examples/gkl-pure-js-client/modules/renderers/MinimapHudRenderer.js`
- `examples/gkl-pure-js-client/modules/components/DirectionPad.js`
- `examples/gkl-pure-js-client/modules/components/FloatingContextActions.js`
- `examples/gkl-pure-js-client/modules/interaction/CanvasInteractionController.js`
