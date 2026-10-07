# Third Party Notices / 第三者ソフトウェア・データの表示

本プロジェクト(Nethack-wasm-webUI)の独自実装は [MIT License](LICENSE) です。
このファイルは、MIT の対象外となる第三者由来の成果物と、その帰属を示します。

## 1. NetHack

- 対象: `nethack.wasm`、`nethack.js`(NetHack 本体を WebAssembly にビルドしたもの)、`dat/` 配下の NetHack 由来データ
- ライセンス: NetHack General Public License (NGPL)
- 全文: [`dat/license`](dat/license)
- 本家: https://www.nethack.org/

## 2. Lua

- 対象: NetHack コアに組み込まれている Lua 5.4.8(WASM ビルド時に `emcc` でコンパイルして `nethack.wasm` に静的リンク)
- ライセンス: MIT License
- URL: https://www.lua.org/

```
Copyright (C) 1994-2025 Lua.org, PUC-Rio.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## 3. Guidebook 日本語版

- 対象: [`docs/5_gamedata/Guidebook.ja.html`](docs/5_gamedata/Guidebook.ja.html)
- 内容: NetHack 3.7 時点の Guidebook を、本プロジェクトで機械翻訳して作成した派生物
- 元の Guidebook のライセンス: NGPL([`dat/license`](dat/license))。派生物も NGPL に従います。

## 4. Web フォント(同梱なし)

HTML ページから Google Fonts を CDN 経由で読み込みます。フォントファイルはリポジトリに同梱していません。
いずれも SIL Open Font License 1.1 です。

- Inter
- Outfit
- Cinzel
- JetBrains Mono
- Fira Code

## 補足

- 辞書(`dictionary.csv`)、`param/`、GKL の対訳データなど、本プロジェクトで作成した翻訳・設定データは MIT の対象です。
- 旧クライアントなど削除済みのコードは、ローカルタグ `archive/legacy-client` の履歴にのみ残っています。
