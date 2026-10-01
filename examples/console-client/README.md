# NetHack Gamepad Input Experimental Client (PoC)

このディレクトリは、**NetHack WASM におけるゲームパッド操作・ラジアルメニュー（右ホイール）・コンテキストアクション動的連動の検証用プロトタイプ（PoC / 実験クライアント）** です。

実用クライアントとしての運用ではなく、ゲームパッドによる NetHack の操作体系（シレン風の直感的操作）を検証するための実験環境として整備されています。

---

## 🔬 本クライアントで検証された主要な技術・UX

1. **動的 ContextAction セレクター（右ホイール）**:
   - 固定の汎用コマンド（飲む・食べる・読む等）を廃止。
   - 周囲・足元に扉や階段などのインタラクション対象がある時のみ、`ContextActionEngine` が生成した候補（「扉を開ける」「鍵で解錠」「扉を蹴破る」等）を8方向に展開。
   - 右スティックを傾けてアクションを選ぶと、画面中央下の `<nh-context-pill>` および Aボタンに割り当てられる Primary アクションが即座に切り替わり、決定（Aボタン）で実行可能。
   - 移動キー入力で標準アクションへ自動リセット。

2. **正規コアモジュールとの結合**:
   - `core.getSituation()` / `ContextActionEngine` への正規接続。
   - `core.executeAction(action)` によるアクション実行。
   - `ModalManager` / `CharacterIntroModal` / `CharacterCreationModal` との連動およびゲームパッドナビゲーション。

3. **入力調停と Fail-Safe**:
   - `GamepadManager` によるコンテキスト（通常・モーダル・メニュー・ダイアログ・方向指定等）の動的判定と誤爆防止。
   - ダッシュ（RB + 十字キー）のセマンティックアクション化。

---

## 📂 構成ファイル

- `index.html`: 実験用UI画面
- `main.js`: 実験用クライアントコントローラー (`ConsoleClient`)
- `style.css`: ミニマルレイアウトおよびゲームパッド用フォーカススタイル

※ルートの `index.html` にはリンクされていません。ローカル検証時は `tools/cltest.html` または直接 `examples/console-client/index.html` を開いて実行します。

---

## 🔮 将来の実証実験アイデア (PoC Ideas)

- **右ホイールによる「ボタンセット（スタンス）」切替構想**:
  右スティックの4方向（上下左右）で「探索 / 射撃 / 魔法 / 防御」のボタンセットを瞬時に切り替え、手元の A/X ボタンで即座に実行する操作モデル。
  詳細仕様: [`docs/7_futures/gamepad_radial_button_set_switching_concept.ja.md`](../../docs/7_futures/gamepad_radial_button_set_switching_concept.ja.md)

