---
title: shim_reference.ja
status: active
last_updated: 2026-08-15
related_code:
  - sys/share/
---

# NetHack 5.0 shim イベント & ウィンドウインターフェース リファレンス

> [!IMPORTANT]
> このドキュメントは **NetHack 5.0.0 正式版** に準拠して更新されています。
> 3.7に存在した一部のWasmエクスポート関数（オフセット取得系）は5.0で廃止されました。また、不足していたすべての shim イベントを追加し、完全なリファレンスとしています。

このドキュメントは、NetHack Wasm ポートで使用されている `shim` 系イベントと、それに対応する NetHack 本体の `window_procs` 関数の役割をまとめたものです。

---

## 概要

NetHack の本体（C言語側）は、グラフィック処理や入力を直接行わず、`window_procs` 構造体を介してウィンドウシステム（ウィンドウポート）に処理を委ねます。
Wasm ポートでは、`win/shim/winshim.c` がこのインターフェースを実装しており、各関数呼び出しを JavaScript 側の `eventHook` 関数へイベントとして転送しています。

---

## ブリッジの型定義 (Format String)

`winshim.c` から JS へイベントを飛ばす際、引数と戻り値の型を指定する「フォーマット文字列」が使用されます。

| 文字 | C側の型例 | 説明 | JS側での扱い |
| :--- | :--- | :--- | :--- |
| `v` | `void` | 戻り値がない、または引数がない。 | `null` / 無視 |
| `i` | `int`, `winid` | 32bit整数。 | `number` |
| `s` | `char *` | 文字列ポインタ。 | `string` (UTF-8) または `null` |
| `b` | `boolean` | 真偽値。 | `boolean` |
| `p` | `void *` | 生のポインタ。 | `number` (メモリアドレス) |
| `c` | `char` | 1文字キャラクタ。 | `string` (1文字) |
| `0` | `char` | 1文字キャラクタ（`c`と同じ）。 | `string` (1文字) |
| `1` | `coordxy` | 座標値 (short)。 | `number` |
| `2` | `short` | 短精度整数。 | `number` |

### 文字列型 ('s') の特殊な扱い
戻り値の型が `'s'` の場合、JS 側から `null` を返すと Wasm メモリ上のポインタには `0` (NULL) が書き込まれます。これはメッセージ履歴の終端判定などで重要です。

---

## イベント詳細（引数と戻り値）

各イベントの具体的なパラメータ構成です。（最初の文字が戻り値、以降が引数）

### 1. 基本システム

| イベント名 | フォーマット | 引数 (`args`) | 戻り値 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| `shim_init_nhwindows` | `vpp` | `[int *argcp, char **argv]` | なし | ウィンドウシステムの初期化 |
| `shim_player_selection_or_tty` | `b` | `[]` | `boolean` | プレイヤー選択ダイアログが必要か判定 |
| `shim_askname` | `v` | `[]` | なし | プレイヤー名の入力を促す |
| `shim_get_nh_event` | `v` | `[]` | なし | ウィンドウイベント（キー入力等）のポーリング |
| `shim_exit_nhwindows` | `vs` | `[char *str]` | なし | ウィンドウシステムの終了 |
| `shim_suspend_nhwindows`| `vs` | `[char *str]` | なし | ウィンドウシステムの一時停止 |
| `shim_resume_nhwindows` | `v` | `[]` | なし | 一時停止からの復帰 |
| `shim_player_selection` | `v` | `[]` | なし | 役割/種族/性別/属性の選択処理 |

### 2. ウィンドウ操作・制御

| イベント名 | フォーマット | 引数 (`args`) | 戻り値 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| `shim_create_nhwindow` | `ii` | `[int type]` | `int` (winid) | ウィンドウを作成 |
| `shim_clear_nhwindow` | `vi` | `[winid window]` | なし | ウィンドウの内容を消去 |
| `shim_display_nhwindow` | `vib` | `[winid window, boolean blocking]` | なし | ウィンドウを画面に描画して表示 |
| `shim_destroy_nhwindow` | `vi` | `[winid window]` | なし | ウィンドウを破棄 |
| `shim_ctrl_nhwindow` | `viip` | `[winid window, int request, win_request_info *wri]` | `win_request_info *` | ウィンドウの詳細パラメータ制御 |

### 3. 出力・描画・ファイル表示

| イベント名 | フォーマット | 引数 (`args`) | 戻り値 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| `shim_curs` | `viii` | `[winid window, int x, int y]` | なし | カーソル移動 |
| `shim_putstr` | `viis` | `[winid window, int attr, char *str]` | なし | 文字列をウィンドウに出力 |
| `shim_display_file` | `vsb` | `[char *name, boolean complain]` | なし | テキストファイル（ヘルプ等）を表示 |
| `shim_print_glyph` | `vi11pp` | `[winid window, x, y, glyphinfo*, bkglyphinfo*]` | なし | 指定座標にグリフ（タイル）を描画 |
| `shim_raw_print` | `vs` | `[char *str]` | なし | 生のテキストを出力（コンソール用） |
| `shim_raw_print_bold` | `vs` | `[char *str]` | なし | 生のテキストを太字で出力 |
| `shim_putmsghistory` | `vsb` | `[char *msg, bool restoring]` | なし | メッセージ履歴への保存 |
| `shim_getmsghistory` | `sb` | `[bool init]` | `string` or `null` | メッセージ履歴からの取得 |

### 4. 入力・ダイアログ・設定

| イベント名 | フォーマット | 引数 (`args`) | 戻り値 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| `shim_nhgetch` | `i` | `[]` | `int` (char) | キー入力を1文字待機取得（同期/Asyncify） |
| `shim_nh_poskey` | `ippp` | `[int *x, int *y, int *mod]` | `int` (char) | キー入力またはクリック位置を取得 |
| `shim_yn_function` | `css0` | `[char *query, char *choices, char def]` | `char` | [y/n] などの二者択一入力待機 |
| `shim_getlin` | `vsp` | `[char *query, char *buf]` | なし | 任意の1行テキスト入力 |
| `shim_get_ext_cmd` | `iv` | `[]` | `int` (cmd) | 拡張コマンド (`#`) の入力取得 |
| `shim_nhbell` | `v` | `[]` | なし | ビープ音を鳴らす |
| `shim_doprev_message` | `iv` | `[]` | `int` | 過去ログの遡り表示 |
| `shim_number_pad` | `vi` | `[int state]` | なし | テンキー移動設定の切り替え |
| `shim_delay_output` | `v` | `[]` | なし | 描画の短いディレイ（アニメーション用） |

### 5. メニュー

| イベント名 | フォーマット | 引数 (`args`) | 戻り値 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| `shim_start_menu` | `vii` | `[winid window, unsigned long behavior]` | なし | メニュー構築の開始 |
| `shim_add_menu` | `vipi00iisi`| `[window, glyphinfo*, id*, ch, gch, attr, clr, str, flags]` | なし | メニュー項目を追加 |
| `shim_end_menu` | `vis` | `[winid window, char *prompt]` | なし | メニュー構築の終了 |
| `shim_select_menu` | `iiip` | `[winid window, int how, menu_item** list]` | `int` (count) | メニューを表示し項目を選択（同期） |
| `shim_message_menu` | `ciis` | `[char let, int how, char *mesg]` | `char` | メッセージ選択ダイアログ |

### 6. ステータス・インベントリ

| イベント名 | フォーマット | 引数 (`args`) | 戻り値 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| `shim_status_init` | `v` | `[]` | なし | ステータス描画の初期化 |
| `shim_status_enablefield`| `vippb` | `[int fld, char* nm, char* fmt, bool enable]` | なし | ステータス欄の項目有効化/フォーマット設定 |
| `shim_status_update` | `vipiiip` | `[fld, void* ptr, int chg, int pct, int clr, long* mask]` | なし | ステータス情報の更新 |
| `shim_update_inventory` | `vi` | `[int a1]` | なし | インベントリ（所持品）状態の更新 |

### 7. 同期・カラー・その他

| イベント名 | フォーマット | 引数 (`args`) | 戻り値 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| `shim_mark_synch` | `v` | `[]` | なし | 画面同期マークの設定 |
| `shim_wait_synch` | `v` | `[]` | なし | 画面同期を待機 |
| `shim_cliparound` | `vii` | `[int x, int y]` | なし | キャラクター中心の表示追従（クリッピング） |
| `shim_update_positionbar`| `vs` | `[char *posbar]` | なし | ポジションバー（マップ相対位置バー）の更新 |
| `shim_change_color` | `viii` | `[int color, long rgb, int reverse]` | なし | パレットカラーの変更 |
| `shim_change_background`| `vi` | `[int white_or_black]` | なし | 背景色の白黒変更 |
| `set_shim_font_name` | `2is` | `[winid window_type, char *font_name]` | `short` | フォントの設定 |
| `shim_get_color_string` | `sv` | `[]` | `char *` | カラーパレット情報の取得 |
| `shim_preference_update` | `vp` | `[char *pref]` | なし | ゲーム内設定・好みの更新 |

---

## WASMポート特有のエクスポート関数 (EMSCRIPTEN_KEEPALIVE)

NetHack 5.0 の Wasm ビルド環境では、3.7までに存在したオフセット取得系関数（`get_glyph_mon_off()` 等）は C 側から**完全に削減されました**。現在 JS 側から直接呼び出し可能なエクスポート関数は以下の3つのみです。

*   **`char *get_plname(void)`**: 現在のプレイヤーキャラクター名（`svp.plname`）を取得します。
*   **`int get_nummons(void)`**: モンスター種類の総数（`NUMMONS` = 5.0.0 正式版では `383`）を取得します。
*   **`int get_num_objects(void)`**: オブジェクト種類の総数（`NUM_OBJECTS` = 5.0.0 正式版では `481`）を取得します。

> [!NOTE]
> 各種グリフカテゴリのオフセット値は、`get_nummons()` と `get_num_objects()` から得られる定数値を元に JavaScript 側で動的に計算するか、自動生成されたマッピングテーブルで静的に解決されます。

---

## 特記事項

### 1. Sticky Patching (ヘルパーの固定化)
Wasm 内部の `js_helpers_init` が実行されると、`window.nethackGlobal.helpers` 内の関数が strict な（初期状態の）実装で上書きされてしまいます。これを防ぐため、`GameManager.js` では `Object.defineProperty` を使用して、一度定義したヘルパー（特に `setPointerValue`）を上書き不能にする **Sticky Patch** を適用しています。

### 2. Asyncify
JavaScript 側のイベント処理で `Promise` を返すもの（`shim_nhgetch`, `shim_yn_function` 等）は、Emscripten の Asyncify 機能を介して C 側の実行を一時停止し、入力完了後に再開します。

### 3. 音声再生（サウンド機能）について
NetHack WASM WebUI では、本家 NetHack の `usersounds` 仕様に準拠した **クライアント側独立メッセージフック方式の音声再生システム** を導入・実装しています。

NetHack 本体の `sound_procs`（Cコード側のサウンド機構）と `winshim.c` 間に直接の音通知コールバックは存在しませんが、WASM から発行される **`shim_raw_print`**, **`shim_raw_print_bold`**, **`shim_putstr`** のメッセージイベントを JavaScript 側（`GameManager.js`）でフックし、`sound_mapping.json` の定義パターン（英語原文メッセージおよび日本語翻訳メッセージ）に照合して効果音を発声させます。

アセットファイル（WAV/MP3）の再生に加え、Web Audio API と `sys/coremin.js` (`Beepcore`) を利用した 8bit レトロ合成音の生成に対応しています（初回デフォルトは消音/OFF設定）。
詳細な設計アーキテクチャ・設定仕様・実装手順については [sound_system_spec.md](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/sound_system_spec.md) を参照してください。

---

## ビルド手順（WebAssembly）

NetHack を WebAssembly にビルドするための詳細な手順です。

### 共通の準備
1. **[NetHack/NetHack](https://github.com/NetHack/NetHack)** 公式リポジトリのソースコード（`NetHack-5.0` ブランチ準拠）を `NetHack-NetHack-5.0` ディレクトリとして配置してください。
2. **Emscripten SDK (emsdk)** をインストールし、アクティベートしてください。

---

### Windows 環境でのビルド

Windows 環境では、Visual Studio (MSVC) と PowerShell スクリプトを使用します。

#### 1. 準備
*   **Visual Studio (MSVC)** がインストールされていることを確認してください。

#### 2. ビルドの実行
`NetHack-NetHack-5.0` ディレクトリにて PowerShell スクリプトを実行します。
```powershell
cd NetHack-NetHack-5.0
.\build_wasm_50.ps1
```

> [!IMPORTANT]
> スクリプト内の `$EMSDK_PATH` および `$VCVARS_PATH` は、ご自身のインストール環境に合わせて修正してください。

---

### Linux / WSL 環境でのビルド

#### 1. 準備
Emscripten (emsdk) がインストールされ、パスが通っている必要があります。
```bash
source path/to/emsdk/emsdk_env.sh
```

#### 2. Makefile を使用する場合
`NetHack-NetHack-5.0` ディレクトリにて `make` を実行します。
```bash
cd NetHack-NetHack-5.0
make
```
これにより、ホスト用の `makedefs` のビルド、データファイルの生成、Lua のビルド、そして最終的な NetHack Wasm (`nethack.js`, `nethack.wasm`) の生成が順次行われます。

#### 3. シェルスクリプトを使用する場合
一括でビルドを実行するスクリプトも用意されています。
```bash
cd NetHack-NetHack-5.0
chmod +x build_wasm_50.sh
./build_wasm_50.sh
```

### ビルドの成果物
ビルドが成功すると、以下のファイルが `NetHack-NetHack-5.0` 直下に生成されます：
*   `nethack.js`: Wasm をロードするための JavaScript ブリッジ
*   `nethack.wasm`: NetHack 本体
*   `liblua.a`: Wasm 向けにビルドされた Lua ライブラリ
