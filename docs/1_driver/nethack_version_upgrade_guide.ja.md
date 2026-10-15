---
title: nethack_version_upgrade_guide
status: active
last_updated: 2026-10-15
related_code:
  - scripts/build_wasm_50_wsl.ps1
  - scripts/build_wasm_50_wsl.sh
  - scripts/build_wasm_50.ps1
  - src/driver/shim/shim_bridge.c
---

# NetHack バージョン更新・WASM 再ビルド引継ぎガイド

本ドキュメントは、NetHack のマイナー／パッチバージョン更新（例: 5.0.0 → 5.0.1、今後の 5.0.2 や 5.1.x など）に伴い、WebAssembly（WASM）の再ビルドおよび WebUI 側の関連データ／ナレッジを更新する際の手順、調査項目、および注意事項をまとめた引継ぎ資料です。

---

## 1. 事前調査・影響評価のポイント (Checklist)

新しいバージョンがリリースされた場合、ビルドに着手する前に以下のファイルを調査し、WebUI やゲームプレイへの波及度を評価します。

### 1-1. 更新差分の概要把握 (`doc/fixes*.txt`)
- 原本ソース内の `doc/fixes<version>.txt`（例: `fixes5-0-1.txt`）を確認。
- 主な修正分類（バグ修正、新機能、タイル変更、メッセージ変更、内部仕様変更）を洗い出します。

### 1-2. タイルマップおよびグラフィックスの変更確認
- **調査対象**: `win/share/tilemap.c`, `win/share/decals.txt`, `win/share/monsters.txt` など
- **確認事項**:
  - `total_tiles_used` の数値が変わるか（5.0.0 では 2304、5.0.1 では decals 追加により 2307 に増加）。
  - タイルマッピングの追加／順序変更があるか。
  - **影響範囲**:
    - `tilemap.exe` が再生成する `tile.c` および `tilemappings.lst`
    - `docs/5_gamedata/tilemappings.lst` への反映
    - タイル画像（スプライトシート）自体の更新要否（新規タイルを表示する場合のみ）

### 1-3. アイテムおよびエイリアス（別名）の追加確認
- **調査対象**: `src/objnam.c`, `include/objects.h`, `src/objects.c`
- **確認事項**:
  - `objnam.c` にウィッシュ（wish）用の別名エイリアスが追加されたか。
  - 新規アイテムが追加されたか（onum の増減）。
  - **対応方針**:
    - エイリアスが追加された場合は、`src/core/knowledge/data/OBJECT_JP_MAP.js` の `aliases` セクションに英語名および対応する日本語名を追加する。
    - 新規アイテムが追加された場合は、`src/core/knowledge/data/OBJECT_KNOWLEDGE_MAP.js` および辞書（`dictionary.csv`）への定義追加を検討。

### 1-4. ブリッジ（`shim_bridge.c`）機能・エクスポートシンボルの事前棚卸し（手戻りゼロ運用）
- **方針**: バージョン更新に伴う Wasm 再ビルドは、**WebUI / GKL 側で今後必要となる C 側ブリッジ機能（`src/driver/shim/shim_bridge.c`）を事前に棚卸し・拡充する絶好の機会**です。
- **事前チェック事項**:
  - WebUI / GKL のロードマップや新機能構想で、現在テキストパースや裏マクロ（または推測）に依存している要素がないか確認。
  - 新たに必要な問い合わせ（地形・罠・部屋・モンスター状態・装備・プレイヤー能力等）があれば、ビルドスクリプト実行前に WebUI リポジトリ管理下の `src/driver/shim/shim_bridge.c` のコマンド定義（`ShimBridgeCmd`）に追加しておく（ビルド時に自動で `win/shim/shim_bridge.c` へ同期コピーされます）。
  - **効果**: 平常時の WebUI / GKL 開発フェーズにおいて「C側の再ビルド待ち」による手戻りや作業中断が一切発生しない開発サイクルを確立できます。

### 1-5. バージョン番号の定義確認 (`include/patchlevel.h`)
- **調査対象**: `include/patchlevel.h`
- **確認事項**:
  - `PATCHLEVEL`（パッチ番号）や `NH_DEVEL_STATUS` の定義値。
  - **注意点**: 公式 DevTeam の Git ブランチ運用や配布タイミングによっては、ソース自体が `PATCHLEVEL 0` かつ `NH_STATUS_POSTRELEASE`（post-release）のまま配布されている場合があります。
  - ゲーム内 V コマンドの表示文字列（`src/mdlib.c` 経由）にそのまま反映されるため、`5.0.1` などの正式表記にしたい場合は手動で `#define PATCHLEVEL 1` や `#define NH_DEVEL_STATUS NH_STATUS_RELEASED` への変更が必要か判断します。

---

## 2. ディレクトリ構成と保護対象ファイル

### 2-1. リポジトリを汚さない運用方針
- **重要**: WebUI リポジトリ（`Nethack-wasm-webUI`）内に NetHack の全ソースツリーを常時展開・コミットしないこと。
- ビルド作業は原本ディレクトリ（外部作業フォルダ）または一時作業フォルダで行い、リポジトリ内には成果物（`nethack.js`, `nethack.wasm`, `docs/5_gamedata/tilemappings.lst`）と単一ブリッジ拡張ファイル（`src/driver/shim/shim_bridge.c`）のみを保持します。

### 2-2. 保護対象ファイルおよび独自実装の状況（公式ソース 100% 無改変 + 外付け `shim_bridge.c`）
NetHack 5.0 WASM では、**公式原本ファイルの独自 C 差分が完全にゼロ（100% 無改変）** であり、Phase 8 メモリ直結用の拡張は独立した 1 ファイル（`shim_bridge.c`）として外付けリンクされます。

| ファイルパス | 現状と運用方針 |
|---|---|
| `win/shim/winshim.c` | **公式原本と完全一致（SHA256ハッシュ完全一致・差分ゼロ）**。<br>以前存在した `get_plname()` 等の独自 C コードは全廃され、原本をそのまま直接コンパイルします（リポジトリ側の差分ファイル保持も不要）。Driver 側は公式標準の `globalThis.nethackGlobal.globals.svp.plname`（`sys/libnh/libnhmain.c` 既設の getter/setter バインディング）を利用しています。 |
| `sys/libnh/libnhmain.c` | **公式原本のまま無改変**。NetHack 5.0 公式原本で既に Emscripten / WebAssembly サポート（`__EMSCRIPTEN__` 用の JS コールバック初期化や定数・グローバル変数バインディング公開）が組み込まれています。 |
| `src/driver/shim/shim_bridge.c` | **WebUI リポジトリ内で Git 管理されている正本ファイル**。<br>`scripts/build_wasm_50.ps1` の Step 3 でビルドツリー側の `win/shim/shim_bridge.c` へ自動同期コピーされ、単一エントリポイント `_shim_bridge_call` のみをエクスポートして一緒にコンパイル・リンクされます。 |

### 2-3. 外部依存（Lua 5.4.8）
NetHack 5.0 のビルドには Lua 5.4.8 のソースコードが必要です。原本ソースツリーに `lib/lua-5.4.8/src` が存在しない場合は、ビルドスクリプトが既存環境（例: `Documents/Antigravity/NetHack/lib/lua-5.4.8` 等）から自動配置します。

---

## 3. ビルド手順とスクリプトの注意点

### ⚠️ 最重要：Windows スマート アプリ コントロール（Smart App Control）と推奨環境
Windows 11 の「スマート アプリ コントロール (Smart App Control)」やアプリケーション制御ポリシーが有効な環境では、Emscripten のリンク後処理ツール **`wasm-emscripten-finalize.exe`（Binaryen）がブロック (`[WinError 4551]`)** され、Emscripten が関数テーブル（`dynCall_vii` 等）の出力をスキップして不完全な JS/WASM を出力してしまう問題が発生します。  
その結果、ブラウザ実行時に **`ReferenceError: dynCall_vii is not defined`** が発生してエンジンが起動不能になります。

そのため、現在の標準・最推奨ビルド方式は **【方式 A: WSL2 (Ubuntu) Linux ネイティブビルド】** です。

---

### 3-1. 方式 A: WSL2 (Ubuntu) Linux ネイティブビルド（最推奨・標準）
Linux ELF バイナリとして動作するため、Windows の Smart App Control の干渉を 100% 回避し、Binaryen の finalize を含めて完全にクリーンな WASM / JS を生成します。

#### 事前準備 (初回のみ)
WSL2 の Ubuntu ターミナルで Emscripten SDK をセットアップします：
```bash
if [ ! -d ~/emsdk ]; then
    git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
fi
cd ~/emsdk
./emsdk install 4.0.22
./emsdk activate 4.0.22
```

#### ビルドの実行
Windows の PowerShell から以下のラッパースクリプトをワンコマンドで実行するだけで、WSL2 を介して自動コンパイル・自動デプロイが完了します：
```powershell
powershell -ExecutionPolicy Bypass -File scripts/build_wasm_50_wsl.ps1
```
※ WSL2 内から直接実行する場合は `./scripts/build_wasm_50_wsl.sh` を実行します。

#### スクリプトの動作内容 ([`scripts/build_wasm_50_wsl.sh`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/scripts/build_wasm_50_wsl.sh))
1. `~/emsdk/emsdk_env.sh` をアクティベート。
2. ホストツール（`makedefs`, `tilemap`）を GCC でコンパイルし、`data`, `rumors` 等を生成。
3. `src/driver/shim/shim_bridge.c` を `win/shim/shim_bridge.c` へ自動同期。
4. Lua 5.4.8 を `emcc` でビルドして `liblua.a` を生成。
5. `-sDYNCALLS=1`, `-sASYNCIFY=1` を指定して NetHack 5.0 をリンク。
6. 成果物（`nethack.js`, `nethack.wasm`）を WebUI ルートおよび `examples/svelte-client/dist/` へ自動配置。

---

### 3-2. 方式 B: Windows ネイティブビルド (`scripts/build_wasm_50.ps1`)
スマート アプリ コントロールが無効化されている環境や例外ポリシーが適用されている環境用のレガシービルドです。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build_wasm_50.ps1
```

- **必須コンパイル・リンクフラグ**:
  - `-sDYNCALLS=1`（UI コールバック `local_callback` テーブル用・必須）
  - `-sASYNCIFY=1`
  - `-sASYNCIFY_IMPORTS=['local_callback']`
  - `-sEXPORTED_FUNCTIONS=['_main','_shim_graphics_set_callback','_malloc','_free','_shim_bridge_call']`
  - `-sEXPORTED_RUNTIME_METHODS=['cwrap','ccall','addFunction','UTF8ToString','stringToUTF8','getValue','setValue','FS','IDBFS']`

---

## 4. ビルド成否の検証ポイント

ビルド完了後、必ず以下の各項目を目視・コマンドで確認します。

| 検証項目 | 確認コマンド／確認場所 | 期待される結果 |
|---|---|---|
| **Binaryen ブロックの有無** | ビルドログ | `wasm-emscripten-finalize blocked` 等の警告が一切出ていないこと |
| **dynCall の存在確認** | `node -e "const fs = require('fs'); const code = fs.readFileSync('nethack.js', 'utf8'); console.log(code.includes('dynCall_vii'));"` | `true` が出力されること |
| **tile.c の特殊タイル定義** | `src/tile.c` | `TILE_PETMARK`, `TILE_PILEMARK`, `TILE_DELIMITER` 等が定義されていること |
| **total_tiles_used の数値** | `src/tile.c` | 調査で判明した期待値（例: 5.0.1 では `2307`）と一致していること |
| **成果物の配置・更新** | WebUI ルート（`nethack.js`, `nethack.wasm`）および `examples/svelte-client/dist/` | 更新日時が直前のビルド時刻になり、ファイルサイズが正常であること |

---

## 5. WebUI 側の連動更新とテスト

### 5-1. ナレッジ（OBJECT_JP_MAP.js）のエイリアス追記
`src/core/knowledge/data/OBJECT_JP_MAP.js` の `aliases` に新規エイリアスを追加します。
```javascript
        // 5.0.x 新規エイリアス (src/objnam.c 準拠)
        "identification": "scroll of identify",
        "鑑定の巻物": "scroll of identify",
        ...
```

### 5-2. 回帰テストスイートの実行
WebUI ルートでテストを実行し、全テストスイートがパスすることを確認します。
```powershell
npm test
```
- 全テストスイートが 100% PASS すること（リグレッションゼロ）。

### 5-3. ブラウザ実機確認
- ブラウザで WebUI を起動。
- コンソールエラー（`ReferenceError: dynCall_vii is not defined` 等）が一切発生しないこと。
- `👤 [種族 / 職業 Lv.X]`（`#status-attr-detail`）に C コアの真値プロファイルが表示されること。
- `tools/knowledge-inspector.html` の「種族・職業」タブでレベル別公式称号一覧テーブルが正確に表示されること。
- `v` または `V` コマンドでバージョン表示を確認し、ビルド日時が更新されていることを確認。

