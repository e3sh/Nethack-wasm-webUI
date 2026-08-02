# WebUI クライアント実装ガイド ＆ 注意事項 (Client Integration Guide)

> 💡 **v2.0 新版ガイドのご案内**: Vue 3, React 18, Svelte, SolidJS などのモダン Web フロントエンドフレームワークを用いた Web Worker 分離非同期型のクライアント構築ノウハウについては、最新の **[モダンクライアント構築・実装ガイド v2.0 (modern_client_development_guide.md)](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/2_client_ui/modern_client_development_guide.md)** も合わせてご参照ください。

本書は `NetHackWasmDriver` を利用して WebUI クライアント（`UIManager.js`, `GameManager.js`, `DriverDomTestClient.js` 等）を実装・接続する際に、クライアント側で配慮・実装すべき注意点とノウハウをまとめた統合ガイドです。

---

## 1. セーブ＆ロード・自動復元 ＆ データ消去連携

### 1.1 セーブデータの自動復元 (Auto Resume)
- **仕様**: C コア初期化時、`shim_askname` ("Who are you?") からの問い合わせで `inputRequired (context === 'askname')` イベントが届きます。
- **実装対策**: 仮想 FS / IndexedDB 上に過去のセーブデータが検出されている場合、ペイロード内に **`detectedName`** （セーブプレイヤー名）が自動付与されます。
- **推奨処理**: クライアント UI 側はダイアログを出さず、即座に `data.resolver.respond(data.detectedName)` を返却します。これにより、ユーザーはリロード後も即座に前回のプレイからシームレスに再開されます。

### 1.2 セーブデータの物理完全消去 (`deleteSaveFile`)
- **仕様**: 「デリートボタン」や「新規ゲーム開始（やり直し）」時、壊れたセーブデータや古いセーブデータが残留していると、復元エラーやキャラクター強制開始の原因となります。
- **推奨処理**: `driver.deleteSaveFile()`（または `driver.fsManager.deleteSaveFile()`）を呼び出します。これにより、Emscripten VFS (`/save`) 内のファイルおよび IndexedDB (`/indexedDB` の `FILE_DATA` ストア) 内のすべての全セーブキーが無条件で完全物理抹消されます。

### 1.3 ゲームオーバー（死亡・クリア）状態の検出 (Game Over Detection)
- **仕様**: プレイヤーが死亡、昇天、または脱出してゲームが完全に終了した場合、Wasmエンジンは終了し（`main` が終了コードを返して終わる）、ドライバから `exited` イベントが発火します。しかし、これは「正常にセーブして中断終了した」場合も同様です。
- **実装対策**: NetHackは、ゲームオーバー時にはファイルシステム上のセーブファイルを**自動的に物理削除**し、正常セーブ時にはセーブファイルを残すという仕様を持っています。
- **推奨処理**: `driver.start()` の Promise 解決後、または `exited` イベント受信時に、非同期でセーブデータの自動検出メソッドを呼び出します：
  ```javascript
  const exitCode = await driver.start();
  
  // セーブファイルが存在するか非同期でチェック
  const saveName = await driver.autoDetectSavePlayerName();
  if (saveName) {
      console.log("ゲームは正常にセーブ中断されました（次回再開可能）");
  } else {
      console.log("セーブデータがありません。ゲームオーバー（死亡、昇天、またはクリア）です。");
      // UI側のゲームオーバー処理（タイトル画面に戻す、スコアボードの表示など）へ遷移
  }
  ```

---

## 2. スコアボード・ランキング画面の表示 (`getScoreboard`)

### 2.1 C コア仕様と読み取り方法
- **仕様**: NetHack 5.0 C コアの Shim (`winshim.c`) はスコア記録を自動イベントとしてプッシュ送信しません。代わりに、ゲームオーバー時や脱出時に C コアが自力で `/save/record` ファイルを直接生成・更新します。
- **実装対策**: クライアント（`GameManager` / `UIManager`）側で「ランキング画面」「過去の冒険の記録」を表示する際は、ドライバが提供するハイスコア解析メソッドを呼び出します：
  ```javascript
  // 構造化されたランキングオブジェクト配列を取得
  const scoreboard = driver.fsManager.getScoreboard();
  
  // スコアボード描画処理
  scoreboard.forEach(entry => {
      console.log(`#${entry.rank} ${entry.name} (${entry.role}) - ${entry.score} pts [${entry.death}]`);
  });
  ```

---

## 3. STATUS フィールド全マッピング ＆ バッジ表示

### 3.1 正確な STATUS フィールドインデックス (`status_update`)
C コアから届く `field` 番号は `param/rogueDefines.js` の正統インデックスに従って UI 表示へマッピングする必要があります：

| field 番号 | 項目名 | 内容 / UI マッピング推奨 |
| :--- | :--- | :--- |
| `0` | **TITLE** | ヒーロー名と称号 (`Hero the Novice`) |
| `10` | **GOLD** | 所持金。`goldData.glyphId` (`3886`) および `goldData.amount` で構造化受容。<br>金貨アイコン (`.st-gold-tile`) を横に描画 |
| `11` / `12` | **ENE / ENEMAX** | 現在の Pw と 最大 Pw (`Pw:1(6)`) |
| `13` | **XP** | レベル数値 (`Lvl:1`) |
| `14` | **AC** | アーマークラス (`AC:10`) |
| `17` | **HUNGER** | 空腹・満腹状態。`"Satiated"`, `"Hungry"`, `"Weak"`, `"Fainting"` 等。<br>※平常時 (`Not Hungry`) は非表示、発生時のみ**独立空腹バッジ (`.st-hunger`)** で動的表示 |
| `18` / `19` | **HP / HPMAX** | 現在の HP と 最大 HP (`HP:18(18)`) |
| `20` | **DLEVEL** | 現在の階層 (`Dlvl:1`) |
| `22` | **CONDITION** | 状態異常ビットマスクデコード配列 (`Blind`, `Confused`, `Stunned` 等)。<br>発生時のみ**独立状態異常バッジ (`.st-cond`)** で表示 |

---

## 4. インベントリ・メニューの CSS Sprite タイル描画

### 4.1 タイルグラフィックアイコンの描画ノウハウ
- **Glyph ID 受容**: `add_menu` で送信される `menuItem` には、直接利用可能な **`item.glyph` (数値 Glyph ID)** が含まれています。
- **CSS Sprite スタイル生成**: `tileMapping.js` を参照し、`background-position: -Xpx -Ypx` スタイルを適用した `span` 要素をテキスト横に挿入します。
- **CSS Flexbox 収縮防止**:
  - 親コンテナ（`.menu-item` や `.statusBar`）が `display: flex` の場合、テキストを含まない `span` アイコン枠はデフォルトで `flex-shrink: 1` により幅 0px に押し潰されます。
  - **必須指定**: アイコン用 `span` に `flex-shrink: 0 !important;` を指定してサイズ潰れを完全に防ぎます。
- **HTML `style` 属性のエスケープ事故防止**:
  - インライン `style` 属性へ `background-image: url(...)` を埋め込む際、ダブルクォートの引用符エスケープ (`&quot;`) により CSS パーサーに破棄されないよう、クォート無しの `url(pict/nethack_default_32.png)` 構文を使用します。

---

## 5. マップ描画 ＆ 画面クリア制御の注意点

### 5.1 毎ターン歩行時の `clear_nhwindow(3)` 処理
- **注意点**: プレイヤーが 1 マス移動するたびに C コアから `clear_nhwindow(3)` (マップクリア命令) が届きます。
- **推奨処理**: `clear_nhwindow(3)` では全消去を行わず、`print_glyph` で指定されたセルのみをピンポイント差分更新します。

### 5.2 階層移動 (`DLEVEL`: ステータス field 20) 時の全消去
- **推奨処理**: ステータス更新 `status_update` で `field === 20` (DLEVEL) の値が変更されたことを検知したタイミングで、マップバッファを `clearMapBuffer()` で全消去します。

---

## 6. UI ダイアログ ＆ プロンプト表示の使い分け

### 6.1 `yn_function` (方向指定 ＆ yes/no 質問) ➔ インラインプロンプト表示
- **推奨処理**: モーダルを出さず、メッセージ枠へ質問を表示した上で、画面中段のプロンプト行等で `[INPUT WAITING]` を明示し、そのままダイレクトなキーボード入力（矢印キー、`h`,`j`,`k`,`l`,`y`,`n`,`a`,`q`）を受容します。

### 6.2 `select_menu` (インベントリ ＆ ドロップメニュー) ➔ スクロール可能モーダル
- **推奨処理**: スクロール可能なオーバーラップ DIV モーダルで全アイテムを展開表示します。
- **アクセラレータキーパース**: `item.ch` が数値 (`121`) か文字 (`'y'`) かを判別し、キーボードの `'a'`, `'b'` キーおよび Enter キーで即時決定・遷移するイベントハンドラを組み込みます。

### 6.3 `windowId >= 4` (Lookup Information / HELP) ➔ テキストモーダル
- **推奨処理**: `putstr` (windowId >= 4) のテキストを配列に蓄積バッファリングし、`display_nhwindow(windowId >= 4)` 発火時にテキスト表示用モーダルを起動して全件スクロール表示します。

