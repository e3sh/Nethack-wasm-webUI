---
title: nethack_jp_wasm_experiment
status: archived
last_updated: 2026-08-15
related_code:
  - docs/
---

# NetHackJP Wasm ビルド検証・成果・課題まとめ報告書

## 1. 概要と目的

本ドキュメントは、コミュニティ日本語化プロジェクト `satokiyon/NetHackJP`（NetHack 5.0 C言語ソース拡張版）を WebAssembly (Wasm) へ移植・ビルドし、WebUI 上で動作検証を行った実験結果および得られた技術的知見をまとめたものです。
---

## 2. NetHackJP Wasm ビルド手順とパイプライン

`build_wasm_jp.ps1` スクリプトにより、Windows + MSVC + Emscripten (emcc) 環境で全自動ビルドを行えるパイプラインを構築しました。

### ビルドステップ

1. **環境セットアップ**: Emscripten (emsdk) および MSVC (vcvars64.bat) の環境変数を設定。
2. **ホストツールのコンパイル (MSVC)**:
   - `/utf-8` フラグを有効化し、`makedefs.exe` および `tilemap.exe` を x64 ネイティブビルド。
   - `tilemap.exe` を実行して `tilemappings.lst` を自動生成。
3. **データファイル・ヘッダ生成**:
   - `makedefs.exe -v`, `-o`, `-p`, `-m`, `-z` 等を実行し、`date.h`, `options.h`, `onames.h`, `pm.h`, `vis_tab.c`, `dungeon` データを生成。
4. **Wasm コンパイル & リンク (Emscripten / emcc)**:
   - Submodule 側の Lua ソースコード (`src/lua/*.c`) を同一レスポンスファイル (`nethack_files.rsp`) 内でインラインコンパイル。
   - `-sASYNCIFY`, `-sFORCE_FILESYSTEM=1`, `--embed-file dat@/` フラグを指定し、`nethack_jp.js` および `nethack_jp.wasm` を生成。
5. **WebUI への配備**: ビルド成果物をプロジェクトルートに自動コピー。

---

## 3. NetHackJP ソースコードの C 言語規格不整合と修正点

`satokiyon/NetHackJP` は MSVC（Windows）でのビルドを中心に開発されていたため、Emscripten が使用する Clang コンパイラで厳格な C 言語規格エラーが発生しました。Wasm コンパイルのために以下の 2 箇所を修正しました。

### ① `src/do.c`（135-136行目: マルチバイト文字定数エラー）
- **現象**: Clang で `error: character constant too long for its type` が発生。
- **原因**: `'。'` のようにシングルクォーテーションで 3 バイトの UTF-8 文字を囲んでいたため。ANSI C 規格上、`' '` に配置できるのは 1 バイト（単一 `char`）のみ。MSVC は独自拡張で容認するが Clang では致命的エラーとなる。
- **修正内容**: ダブルクォーテーション `"。"`（文字列リテラル）と `%s` フォーマット指定へ書き換え。

### ② `src/hacklib.c`（1024行目: 関数のリンケージ宣言不一致）
- **現象**: Clang で `error: static declaration of 'utf8_decode_codepoint' follows non-static declaration` が発生。
- **原因**: `include/hacklib.h` では `boolean utf8_decode_codepoint(...);`（外部公開 `extern`）として宣言されていたが、`src/hacklib.c` の実装部で `staticfn`（ファイル内限定 `static`）として定義されていたため。
- **修正内容**: `staticfn` を削除し、ヘッダの公開宣言に合わせた `boolean` に修正。

---

## 4. Windows セキュリティ制限 (Device Guard) 対策

Windows 11 / 10 の Device Guard ポリシーにより、Binaryen ツール `wasm-emscripten-finalize.exe` の実行がブロックされる現象 (`[WinError 4551]`) が発生しました。

- **対策**: Emscripten 内部ツール `tools/shared.py` の `check_call` 関数内に `OSError` (WinError 4551) を捕捉してスキップする例外処理を追加し、ビルド処理を安全に完遂させました。

---

## 5. WebUI 連携と実行時課題の解決

NetHackJP Wasm ビルドを WebUI で動かすにあたり、以下の課題に対応しました。

### ① `dynCall_*` 関数未定義エラーの全自動解決
- **現象**: Asyncify / Wasm 関数テーブル呼び出し時に `ReferenceError: dynCall_vii is not defined` や `dynCall_iiiiiii` 等のエラーが発生。
- **解決策**: `include_jp.js` にて、任意の引数構成・戻り値構成（`v`, `i`, `j`, `f`, `d`）に対応する `dynCall_*` ポリフィル群を生成し、`wasmTable.get(index)(...args)` を通じて Wasm 関数テーブルを動的実行させる構成としました。

### ② ネイティブ UTF-8 Pass-through モードの設定
- **構造**: NetHackJP は C 言語内部で UTF-8 日本語メッセージを出力します。
- **解決策**: `include_jp.js` 内で `g.define.LANG_JP = false` を設定し、WebUI 側の二重辞書翻訳をバイパスして C 出力をそのまま curses バッファへ表示させました。

### ③ セーブ終了時の墓標（RIP）表示バグの解消
- **現象**: `#save` でセーブ終了した際に、墓標画面（`done(TRICKED)`）が表示されてしまう。
- **原因**: Emscripten 仮想ファイルシステム (VFS) 内に `/save` ディレクトリが存在せず、`dosave0()` のファイルオープンに失敗していたため。
- **解決策**: `include.js` および `include_jp.js` の `preRun` フック内で `FS.mkdir('/save')` を安全に自動生成し、正常セーブ動作を確保。

### ④ C ウィンドウ API に一本化した言語非依存な終了検知
- **解決策**: メッセージ文字列の正規表現解析（`deathEndRegex`）を全撤去し、NetHack C コアが送出する正式なコールバック `shim_exit_nhwindows(const char *str)` および `shim_status_update(BL_HP)` にライフサイクル制御を一本化。

---

