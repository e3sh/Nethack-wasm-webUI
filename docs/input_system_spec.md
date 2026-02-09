# 入力システム技術仕様書 (Input System Specification)

NetHack-wasm-webUI におけるタッチパネルおよびゲームパッドの入力制御に関する仕様をまとめます。

---

## 1. タッチパネル（Grid Pad）

タッチ操作を仮想的なボタン入力に変換するシステムです。

### 1.1 グリッド構成
- **解像度**: 内部的に 12（横）x 9（縦）のグリッドで構成。
- **配置レイアウト**:
  - **左 3 列 (L1-LC)**: 主に移動や頻繁に使用するアクション。
  - **右 3 列 (R1-RL)**: 補助アクション、コンテキスト切り替え。
  - **中央 6 列 (C1-C42)**: NetHack のゲーム画面と重なるため、通常はデッドエリア（透明）。
  - **下部 2 行**: 同様にゲーム画面と重なるため、基本的にはデッドエリア。
- **システムボタン**: 左下隅（0, 8）に「FULL」ボタン（フルスクリーン切り替え）が配置されています。

### 1.2 ページ切り替えとコンテキスト
状況（コンテキスト）に応じて、表示されるボタンのセットが自動的または手動で切り替わります。

| ページ名 | 解説 | 切り替え条件 |
| :--- | :--- | :--- |
| **Center** | 標準ページ。移動と基本操作。 | 通常時（NORMAL） |
| **Left / Right** | 拡張ページ。 | 手動切り替え（Center から [ -L- ] 等） |
| **YN** | Yes/No 選択用。 | ゲーム側が YN 選択を要求した時 |
| **MENU** | メニュー操作用。 | ゲーム側がメニュー表示中の時 |
| **LIN** | 行入力（Line Input）用。 | ゲーム側が文字列入力を要求した時 |

- **Center 復帰機能**: `YN` や `MENU` 中に `Center` ページを表示している場合、右側に `[CONTEXT]` ボタンが表示され、現在のコンテキストページにワンタップで戻れます。

### 1.3 設定と保存
- **保存先**: `localStorage.getItem("nh.tpadAssign")`
- **保存形式**: JSON。`ver: "12x9"` キーでバージョン管理。
- **デフォルト値**: 
  1. `localStorage` の値
  2. `param/touch_mapping_default.json`
  3. `param/rogueDefines.js` 内の `TOUCH_DEFAULT`（フォールバック）

---

## 2. ゲームパッド（GpadToKey）

物理ゲームパッドの入力をキーボード入力にマッピングします。

### 2.1 モード切り替え
ショルダーボタン（LB/RB）やトリガー（LT/RT）の組み合わせにより、ボタンマッピングを動的に切り替えます。

- **NORMAL**: 何も押していない時
- **単体モード**: `LB`, `LT`, `RB`, `RT`
- **複合モード**: `LB+LT`, `RB+RT`, `LB+RB`, `LT+RT`, `LB+RT`, `LT+RB`

これにより、限られたボタン数で NetHack の膨大なコマンドを網羅しています。

### 2.2 設定と保存
- **保存先**: `localStorage.getItem("nh.gpadAssign")`
- **デフォルト値**:
  1. `localStorage` の値
  2. `param/gpad_config_default.json`
  3. `param/rogueDefines.js` 内 landmark `GPAD_DEFAULT`

---

## 3. カスタマイズツール

ユーザーがブラウザ上で設定を変更するための HTML ファイルです。

### 3.1 TouchPad Mapping Utility (`rogue/touch_mapping_tool.html`)
- 12x9 グリッドの各セルに対して、ラベルとアクション（キーコードまたはページ遷移）を設定可能。
- `Key Capture` 機能により、実際のキーボード入力を検知してコードを入力できます。
- 設定のエクスポート/インポート（JSON）に対応。

### 3.2 GpadToKey Mapping Utility (`rogue/mapping_tool.html`)
- 各ボタン（P1-P9, A/B/X/Y 等）に対して、モードごとのマッピングを設定可能。
- `Key Capture` 機能、エクスポート/インポートに対応。

---

## 4. 開発者向け情報

### 4.1 コンテキストの更新
`ioControl.js` が毎フレーム `g.rogue.inputContext` を監視し、`GridPad.updateContext()` を呼び出すことで、画面の状態に合わせたページ自動切り替えを実現しています。

### 4.2 キーコードの指定
アクションには `KeyboardEvent.code` 文字列（例: `KeyW`, `Numpad8`, `ShiftLeft`）を指定します。複数のキーをカンマ区切りで指定すると、それらが同時に「同時押し」として処理されます。
