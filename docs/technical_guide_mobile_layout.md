# Webゲームにおけるモバイル対応と座標補正の技術解説

本プロジェクトで行った、スマートフォン対応および画面比率（アスペクト比）の差異を克服するための技術的ノウハウをまとめます。

## 1. モバイルの解像度とViewportの考え方

現代のモバイル端末では、画面の「物理解像度」とブラウザ上の「論理解像度（CSSピクセル）」を分けて考える必要があります。

*   **論理ピクセルの主流:** iPhone 14/15/16 等では幅 `390px` 〜 `430px` 程度。
*   **アスペクト比:** 以前は `16:9` が主流でしたが、現在は `19.5:9` など縦長な端末が増えています。
*   **実装ポイント:** 
    *   `<meta name="viewport" content="width=device-width, ...">` を指定し、デバイスの幅に合わせる。
    *   `100vw / 100vh` を使い、画面全体を基準にレイアウトを構成する。

## 2. PWAと全画面表示

ブラウザの枠（アドレスバーや操作バー）は、ゲームの没入感を妨げるだけでなく、実表示領域を狭めてしまいます。

### PWA (Progressive Web App) 化
`manifest.json` を作成し、`display: "fullscreen"` を指定することで、ユーザーが「ホーム画面に追加」した際にネイティブアプリのように枠なしで起動できます。

### iOS固有の対応
iOSのSafariでは、`apple-mobile-web-app-capable` メタタグを指定することで、ホーム画面起動時の全画面表示を有効にします。また、`apple-mobile-web-app-status-bar-style` でステータスバーの色（透明度）を制御できます。

## 3. Safe Area（ノッチ）への対応

iPhone等のノッチ（切り欠き）がある端末では、画面全体を使うとコンテンツがノッチに隠れてしまいます。

*   **CSS `viewport-fit=cover`:** これを指定することで、コンテンツをノッチの背後（画面端）まで広げることができます。
*   **CSS `env(safe-area-inset-*)`:** ブラウザが提供するこの変数を用いることで、ノッチを避けるために必要な余白（パディング）を動的に取得できます。
    ```css
    padding: env(safe-area-inset-top) env(safe-area-inset-right) ...;
    ```

## 4. アスペクト比差異（黒枠）と座標補正の数学

ゲームの内部解像度が固定（例: `960x600`）で、表示する画面の比率（例: `19.5:9`）が異なる場合、`object-fit: contain` によって「黒枠（レターボックス）」が生じます。
このとき、単純なクリック座標の取得では、黒枠の分だけ位置がズレてしまいます。

### 補正の計算アルゴリズム

実際のゲーム描画領域（Actual Area）を、要素全体の領域（Available Area）の中から数学的に特定します。

1.  **利用可能な領域の算出:**
    `rect = element.getBoundingClientRect()` からパディング（Safe Area）を引く。
2.  **アスペクト比の比較:**
    `GameAspect (1.6)` と `ContentAspect (Width / Height)` を比較する。
3.  **描画領域（ActualWidth/Height）とオフセットの特定:**
    *   **コンテンツが横長な場合:** 
        *   高さは一杯に使い、横に黒枠ができる。
        *   `actualH = availableH`, `actualW = availableH * GameAspect`
        *   `offsetX = (availableW - actualW) / 2`
    *   **コンテンツが縦長な場合:** 
        *   幅は一杯に使い、上下に黒枠ができる。
        *   `actualW = availableW`, `actualH = availableW / GameAspect`
        *   `offsetY = (availableH - actualH) / 2`
4.  **座標変換:**
    `scaledX = (relativeX - offsetX) * (GameWidth / actualW)`
    この式により、クリック位置が黒枠の外であっても、ゲーム内の正しい座標へとマッピングされます。

## 5. まとめ

Webゲームのモバイル対応は、**「CSSによる自動レイアウト」**と**「JavaScriptによる動的な数学補正」**を組み合わせることが不可欠です。CSSで見た目を整え、JavaScriptで入力をそれ（見た目の変化）に追従させることで、どのような端末でも一貫した操作感を提供できます。
