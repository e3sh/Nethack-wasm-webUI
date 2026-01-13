# NetHack 3.7 shim イベント & ウィンドウインターフェース リファレンス

このドキュメントは、NetHack Wasm ポートで使用されている `shim` 系イベントと、それに対応する NetHack 本体の `window_procs` 関数の役割をまとめたものです。

## 概要

NetHack の本体（C言語側）は、グラフィック処理や入力を直接行わず、`window_procs` 構造体を介してウィンドウシステム（ウィンドウポート）に処理を委ねます。
Wasm ポートでは、`win/shim/winshim.c` がこのインターフェースを実装しており、各関数呼び出しを JavaScript 側の `eventHook` (または `fook`) 関数へイベントとして転送しています。

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

### 基本システム

| イベント名 | フォーマット | 引数 (`args`) | 戻り値 |
| :--- | :--- | :--- | :--- |
| `shim_init_nhwindows` | `vpp` | `[int *argcp, char **argv]` | なし |
| `shim_player_selection_or_tty` | `b` | `[]` | `boolean` |
| `shim_askname` | `v` | `[]` | なし |
| `shim_get_nh_event` | `v` | `[]` | なし |
| `shim_exit_nhwindows` | `vs` | `[char *str]` | なし |
| `shim_player_selection` | `v` | `[]` | なし |

### ウィンドウ操作

| イベント名 | フォーマット | 引数 (`args`) | 戻り値 |
| :--- | :--- | :--- | :--- |
| `shim_create_nhwindow` | `ii` | `[int type]` | `int` (winid) |
| `shim_clear_nhwindow` | `vi` | `[winid window]` | なし |
| `shim_display_nhwindow` | `vib` | `[winid window, boolean blocking]` | なし |
| `shim_destroy_nhwindow` | `vi` | `[winid window]` | なし |

### 出力・描画

| イベント名 | フォーマット | 引数 (`args`) | 戻り値 |
| :--- | :--- | :--- | :--- |
| `shim_curs` | `viii` | `[winid window, int x, int y]` | なし |
| `shim_putstr` | `viis` | `[winid window, int attr, char *str]` | なし |
| `shim_print_glyph` | `vi11pp` | `[winid window, x, y, glyph_info*, bk_glyph_info*]` | なし |
| `shim_raw_print` | `vs` | `[char *str]` | なし |
| `shim_raw_print_bold` | `vs` | `[char *str]` | なし |
| `shim_putmsghistory` | `vsb` | `[char *msg, bool restoring]` | なし |
| `shim_getmsghistory` | `sb` | `[bool init]` | `string` or `null` |

### 入力・ダイアログ

| イベント名 | フォーマット | 引数 (`args`) | 戻り値 |
| :--- | :--- | :--- | :--- |
| `shim_nhgetch` | `i` | `[]` | `int` (char code) |
| `shim_nh_poskey` | `ippp` | `[int *x, int *y, int *mod]` | `int` (char code or 0) |
| `shim_yn_function` | `css0` | `[char *query, char *choices, char def]` | `char` |
| `shim_getlin` | `vsp` | `[char *query, char *buf]` | なし |
| `shim_get_ext_cmd` | `iv` | `[]` | `int` (cmd index) |

### メニュー

| イベント名 | フォーマット | 引数 (`args`) | 戻り値 |
| :--- | :--- | :--- | :--- |
| `shim_start_menu` | `vii` | `[winid window, unsigned long behavior]` | なし |
| `shim_add_menu` | `vipi00iisi`| `[window, glyph_info*, id*, ch, gch, attr, clr, str, flags]` | なし |
| `shim_end_menu` | `vis` | `[winid window, char *prompt]` | なし |
| `shim_select_menu` | `iiip` | `[winid window, int how, menu_item** list]` | `int` (count) |

### ステータス (3.7+)

| イベント名 | フォーマット | 引数 (`args`) | 戻り値 |
| :--- | :--- | :--- | :--- |
| `shim_status_init` | `v` | `[]` | なし |
| `shim_status_enablefield`| `vippb` | `[int fld, char* name, char* fmt, bool enable]` | なし |
| `shim_status_update` | `vipiiip` | `[fld, void* ptr, int chg, int pct, int clr, long* mask]` | なし |

---

## 特記事項

### 1. Sticky Patching (ヘルパーの固定化)
Wasm 内部の `js_helpers_init` が実行されると、`window.nethackGlobal.helpers` 内の関数が strict な（初期状態の）実装で上書きされてしまいます。これを防ぐため、`GameManager.js` では `Object.defineProperty` を使用して、一度定義したヘルパー（特に `setPointerValue`）を上書き不能にする **Sticky Patch** を適用しています。

### 2. Asyncify
JavaScript 側のイベント処理で `Promise` を返すもの（`shim_nhgetch`, `shim_yn_function` 等）は、Emscripten の Asyncify 機能を介して C 側の実行を一時停止し、入力完了後に再開します。

### 3. Glyph Info
`shim_print_glyph` 等で渡される `glyph_info` 構造体は、Wasm メモリ内のポインタとして渡されます。JS 側ではこれをパースして、文字・色・フラグ等を抽出します。

### 4. plname
`shim_askname` で直接 `svp.plname` を書き換える手法は、Wasm ポート特有の最適化です。

## Wasmポートでの現在の実装状況 (GameManager.js)

`GameManager.js` 内の `eventHook` では、いくつかのイベントがバッファリングや UI 連携のためにカスタマイズされています。

- **バッファリング (`nhPutbuf`)**: `shim_putstr` で直接描画せず、`nhPutbufAdd` で一旦溜め、`shim_display_nhwindow` のタイミングで `nhPutbufDraw` を呼び出して一気に描画する仕組みになっています。
- **ウィンドウ消去**: `shim_create_nhwindow` や `shim_destroy_nhwindow` でも、UI 側の状態をリセットするための処理（`nhClear`, `nhPutbufClear`）が組み込まれています。
- **Promise による待機**: `shim_nhgetch` や `shim_yn_function` などの入力待ち、および `shim_exit_nhwindows` のセーブ処理などは、`Promise` を返すことで Wasm 側の実行を一時停止（Asyncify）させています。

---

## ステータスフィールド (fld) の定義

`shim_status_update` や `shim_status_enablefield` で渡される `fld` 番号の対応表です。

| 番号 | 定数名 | 内容 |
| :--- | :--- | :--- |
| -2 | `BL_RESET` | すべてのステータスを再表示する |
| -1 | `BL_FLUSH` | ステータス更新サイクルの終了（一括描画のトリガー） |
| 0 | `BL_TITLE` | キャラクター名と肩書き |
| 1 | `BL_STR` | 強さ (Strength) |
| 2 | `BL_DX` | 器用さ (Dexterity) |
| 3 | `BL_CO` | 耐久力 (Constitution) |
| 4 | `BL_IN` | 知能 (Intelligence) |
| 5 | `BL_WI` | 智慧 (Wisdom) |
| 6 | `BL_CH` | 魅力 (Charisma) |
| 7 | `BL_ALIGN` | 属性 (Alignment) |
| 8 | `BL_SCORE` | スコア |
| 9 | `BL_CAP` | 重量負担重量 (Capacity) |
| 10 | `BL_GOLD` | 所持金 |
| 11 | `BL_ENE` | エネルギー (電力/魔力) 現在値 |
| 12 | `BL_ENEMAX` | エネルギー 最大値 |
| 13 | `BL_XP` | レベル (Experience Level) |
| 14 | `BL_AC` | AC (Armor Class) |
| 15 | `BL_HD` | モンスター時などのヒットダイス |
| 16 | `BL_TIME` | 経過ターン (Time) |
| 17 | `BL_HUNGER` | 空腹状態 |
| 18 | `BL_HP` | HP 現在値 |
| 19 | `BL_HPMAX` | HP 最大値 |
| 20 | `BL_LEVELDESC` | 現在の階層 (Dlevel) / 階層の説明 |
| 21 | `BL_EXP` | 経験値 (Experience Points) |
| 22 | `BL_CONDITION` | コンディション（盲目、混乱、毒、空飛ぶ等） |
| 23 | `BL_VERS` | バージョン情報 |

**※ `BL_CONDITION` (22) の場合のみ、`ptr` には文字列ではなくビットマスク値（後述）が直接渡されます。**

## コンディション (BL_CONDITION) の定義

`fld` が `BL_CONDITION` (22) の場合、`ptr` には以下のビットマスク（`long`型）が渡されます。

| ビットマスク | 内容 |
| :--- | :--- |
| `0x00000001L` | 素手 (`BAREH`) |
| `0x00000002L` | 盲目 (`BLIND`) |
| `0x00000004L` | 忙しい (`BUSY`) |
| `0x00000008L` | 混乱 (`CONF`) |
| `0x00000010L` | 難聴 (`DEAF`) |
| `0x00000020L` | 鉄アレルギー (?) (`ELF_IRON`) |
| `0x00000040L` | 飛行 (`FLY`) |
| `0x00000080L` | 食中毒 (`FOODPOIS`) |
| `0x00000100L` | 光る手 (`GLOWHANDS`) |
| `0x00000200L` | 掴まれた (`GRAB`) |
| `0x00000400L` | 幻覚 (`HALLU`) |
| `0x00000800L` | 鈍足 (`HELD`) / 拘束 |
| `0x00001000L` | 氷上 (`ICY`) |
| `0x00002000L` | 溶岩内 (`INLAVA`) |
| `0x00004000L` | 浮遊 (`LEV`) |
| `0x00008000L` | 麻痺 (`PARLYZ`) |
| `0x00010000L` | 乗馬 (`RIDE`) |
| `0x00020000L` | 睡眠 (`SLEEPING`) |
| `0x00040000L` | 粘液 (`SLIME`) |
| `0x00080000L` | 滑りやすい (`SLIPPERY`) |
| `0x00100000L` | 石化 (`STONE`) |
| `0x00200000L` | 絞殺 (`STRNGL`) |
| `0x00400000L` | 朦朧 (`STUN`) |
| `0x00800000L` | 水没 (`SUBMERGED`) |
| `0x01000000L` | 致死性の病 (`TERMILL`) |
| `0x02000000L` | 繋がれた (`TETHERED`) |
| `0x04000000L` | 罠にかかった (`TRAPPED`) |
| `0x08000000L` | 気絶 (`UNCONSC`) |
| `0x10000000L` | 脚の怪ま (`WOUNDEDL`) |
| `0x20000000L` | (掴んでいる?) (`HOLDING`) |
