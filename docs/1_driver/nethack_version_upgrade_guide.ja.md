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

### 1-4. 内部構造体の変更調査について（原則不要）
- **方針**: 当システムでは安全設計および疎結合を保つため、**WASM 内部の生メモリ直接参照（C構造体パース）を行わないアーキテクチャ**を採用しています。
- **判断**: Shim（`winshim.c`）のイベントコールバックや通信プロトコルに変更が生じない限り、NetHack 内部の構造体（`struct monst`, `struct you` 等）のメンバ変更や型拡張の調査は**原則不要**です。

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
- ビルド作業は原本ディレクトリ（外部作業フォルダ）または一時作業フォルダで行い、リポジトリ内には成果物（`nethack.js`, `nethack.wasm`, `docs/5_gamedata/tilemappings.lst`）と差分ファイルのみを反映します。

### 2-2. 保護対象ファイルおよび独自実装の状況（独自 C コードゼロ化達成）
NetHack 5.0 WASM では、**公式原本からの独自 C 差分が完全にゼロ（100% 無改変）** です。

| ファイルパス | 現状と運用方針 |
|---|---|
| `win/shim/winshim.c` | **公式原本と完全一致（SHA256ハッシュ完全一致・差分ゼロ）**。<br>以前存在した `get_plname()` 等の独自 C コードは全廃され、原本をそのまま直接コンパイルします（リポジトリ側の差分ファイル保持も不要）。Driver 側は公式標準の `globalThis.nethackGlobal.globals.svp.plname`（`sys/libnh/libnhmain.c` 既設の getter/setter バインディング）を利用しています。 |
| `sys/libnh/libnhmain.c` | **公式原本のまま無改変**。NetHack 5.0 公式原本で既に Emscripten / WebAssembly サポート（`__EMSCRIPTEN__` 用の JS コールバック初期化や定数・グローバル変数バインディング公開）が組み込まれています。 |

### 2-3. 外部依存（Lua 5.4.8）
NetHack 5.0 のビルドには Lua 5.4.8 のソースコードが必要です。原本ソースツリーに `lib/lua-5.4.8/src` が存在しない場合は、ビルドスクリプトが既存環境（例: `Documents/Antigravity/NetHack/lib/lua-5.4.8` 等）から自動配置します。

---

## 3. ビルド手順とスクリプトの注意点

ビルドスクリプトは [`scripts/build_wasm_50.ps1`](file:///C:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/scripts/build_wasm_50.ps1) を使用します。環境のフォルダ構成に合わせて都度パス設定を確認してください。

### 3-1. スクリプト内の主要設定項目
```powershell
$BASE_ROOT = $PWD
$NH_ROOT = "<NetHackソースツリーのルートパス>"
$EMSDK_PATH = "C:\Users\e3-sh\Documents\GitHub\emsdk"
$VCVARS_PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat"
```

### 3-2. ビルド各ステップの流れ
1. **環境セットアップ**: Emscripten SDK（`emsdk_env.ps1`）および MSVC（`vcvarsall.bat x64`）をアクティベート。
2. **Step 1: ホスト用 makedefs のビルド**: MSVC で `util/makedefs.exe` をコンパイル。
3. **Step 1-b: ホスト用 tilemap のビルドと実行**:
   - ⚠️ **超重要**: `tilemap.exe` は必ず **`util` ディレクトリ内で実行（`Push-Location util; .\tilemap.exe; Pop-Location`）** すること。
   - `tilemap.c` のソース出力先が相対パス `../src/tile.c` に固定されているため、カレントが `util` でないと `tile.c` の生成に失敗します。
4. **Step 2: ゲームデータ生成**: `makedefs.exe` を使用して `data`, `rumors`, `help` などのデータファイルを生成。
5. **Step 3: winshim.c の確認**: 公式原本（無改変）の `win/shim/winshim.c` をそのまま使用。独自パッチは不要です。
6. **Step 4: Lua (WASM) のビルド**: `emcc` で Lua ソースをコンパイルし、`liblua.a` をアーカイブ。
7. **Step 5: NetHack C ソース (WASM) のビルド**:
   - フラグ: `-sASYNCIFY=1`, `-sEXPORTED_FUNCTIONS`, `-sEXPORTED_RUNTIME_METHODS` など。
8. **Step 6: リンクとファイルパッケージング**:
   - `emcc ... -o nethack.js --embed-file dat@/` で WASM と JS ローダー、仮想ファイルシステムを生成。
9. **Step 7: 成果物のデプロイ**:
   - `nethack.js` および `nethack.wasm` → WebUI ルートへコピー
   - `util/tilemappings.lst` → `docs/5_gamedata/tilemappings.lst` へコピー

---

## 4. ビルド成否の検証ポイント

ビルド完了後、必ず以下の各項目を目視・コマンドで確認します。

| 検証項目 | 確認コマンド／確認場所 | 期待される結果 |
|---|---|---|
| **tilemap.exe の実行結果** | コンソールログ | エラーなく正常終了していること |
| **tile.c の特殊タイル定義** | `src/tile.c` | `TILE_PETMARK`, `TILE_PILEMARK`, `TILE_DELIMITER` 等が定義されていること |
| **total_tiles_used の数値** | `src/tile.c` | 調査で判明した期待値（例: 5.0.1 では `2307`）と一致していること |
| **tilemappings.lst の末尾** | `docs/5_gamedata/tilemappings.lst` | 末尾に新規追加タイル（例: `tile[2304]`〜`tile[2306]`）が追記されていること |
| **成果物の配置・更新** | WebUI ルート（`nethack.js`, `nethack.wasm`） | 更新日時が直前のビルド時刻になり、ファイルサイズが正常であること |

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
- 全テストスイート（106ファイル / 1300件以上）が PASS すること。
- 特に `WishService.test.js`, `AllGlyphsVerification.test.js`, `WebUICore.test.js` などの整合性を確認。

### 5-3. ブラウザ実機確認
- ブラウザで WebUI を起動。
- `v` または `V` コマンドでバージョン表示を確認し、ビルド日時が更新されていることを確認。
- ウィッシュ入力ダイアログで新エイリアスが補完・認識されるか確認。
