# UI層のゲーム内知識排除・アーキテクチャ境界改善計画書
(UI Domain Knowledge Decoupling & Architecture Boundary Refactoring Plan)

## 1. 背景と目的

Vue 3 版（`examples/vue-client/`）および React 18 版（`examples/react-client/`）への水平展開・最新GKLフル機能実装が完了したことにより、両クライアントのUI表現および操作体験は高い完成度に達しました。

一方で、両クライアントの実装を通じて**「本来コア層（`src/core/` / GKL）が持つべきゲーム内知識（NetHack固有の辞書・定数・判定ロジック）がUIコンポーネントやクライアント側コントローラー（`useNetHackDriver.ts`）に漏れ出している」** というレイヤー境界上の課題が浮き彫りになりました。

本資料は、これらの課題を体系的に整理し、**UIコンポーネントを純粋なプレゼンター（薄い描画層）に保ち、全ドメインロジック・知識解決をコア層（GKL/WebUICore）へ集約・昇格させるための次回実装向けリファクタリング計画書**です。

---

## 2. 洗い出された課題と詳細分析

### 課題①：属性耐性の定義テーブルがUI側にハードコードされている
- **該当箇所**: `StatusBar.tsx` (L67-L110) / `StatusBar.vue`
- **問題点**:
  UI層で `FIRE_RES: { label: '耐火', en: 'Fire Res' }` や `DISINT_RES`, `TELEPORT_CONTROL` 等の全17種類の属性定義テーブルを直接定義し、`attrState.effectiveResistances` と `activeKeys` を自前でループ・マージしている。
  コア層（`AttributeStateManager.js`）には既に `ATTRIBUTE_DEFINITIONS` が存在するにもかかわらず、UI層でキー名変換や表示名を二重管理している。
- **改善方針**:
  `AttributeStateManager` または `SituationCache` が、現在有効な耐性をローカライズ済みの構造化配列として整形して提供する。

---

### 課題②：種族・職業の性別・多言語判定がUIコンポーネント内で行われている
- **該当箇所**: `StatusBar.tsx` (L45-L59) / `StatusBar.vue`
- **問題点**:
  UI層で `RACE_KNOWLEDGE_MAP` および `ROLE_KNOWLEDGE_MAP` を直接 import し、`gender === 'female' ? nameFemale : name` などの性別別名解決や多言語フォールバック判定を行っている。
- **改善方針**:
  `StatusAccessor` または `AttributeStateManager` が、言語・性別解決済みの `characterInfo: { raceName: '人間', roleName: '観光客', level: 1, tag: '👤 人間 / 観光客 Lv.1' }` を直接提供する。

---

### 課題③：アクション方向コード解決 (`extractDirectionCode`) のUI側重複実装
- **該当箇所**: `examples/react-client/src/hooks/useNetHackDriver.ts` (L518-L568) / `examples/vue-client/src/composables/useNetHackDriver.ts`
- **問題点**:
  `action.dirCode`, `action.directionKey`, `viKeyMap` (`'K': 'N'`, `'8': 'N'`), 正規表現マッチ（`/_([NESW]|SELF)$/`）等の泥臭い方向解決ロジックが、Vue版とReact版の `useNetHackDriver.ts` にそっくりそのまま重複して記述されている。
  推奨アクションの方向属性は純粋なドメインモデル（`ContextActionEngine`）の責務である。
- **改善方針**:
  `ContextActionEngine` がアクションを生成する時点で、正規化された `action.directionCode = 'N' | 'NE' | ... | 'SELF'` を付与して出力する。

---

### 課題④：周辺マップ・フォーカスカメラタイルの抽出ループと未探索判定
- **該当箇所**: `useNetHackDriver.ts` の `getZoomAreaTiles` (L570-L645) / `FocusCamera.tsx` / `FocusCamera.vue`
- **問題点**:
  NetHack の Glyph ID 0（`giant ant`）の誤検知を防ぐための `glyphId === 0 && symbol === ' '` 判定や、`AreaStateManager` と `StructuredKnowledgeEngine` の多重フォールバック呼び出しを UI 側で 2 重ループ（21x9 や 7x7）を回して構築している。
- **改善方針**:
  `AreaStateManager`（または `GKLPlugin`）に `getFocusCameraGrid(radiusX, radiusY)` または `getFocusAreaTiles()` を新設し、未探索判定・Glyph解決・ナレッジ付与が完了した 2D 配列を 1 発で返却できるようにする。

---

### 課題⑤：自動移動（Auto-Travel）シーケンス構築の二重化
- **該当箇所**: `useNetHackDriver.ts` の `travelTo` (L749-L763)
- **問題点**:
  UIコントローラー側で `['_', `${x},${y}`, 'Enter']` を発行する処理と、GKL内部の `gkl.travelTo({ x, y })`（`['_', '@', 'DIR_...']`）が二重に存在している。
- **改善方針**:
  `gkl.travelTo()` のみを単一の移動APIとして統一し、UIコントローラー側は単純にそれを呼び出すだけにする。

---

### 課題⑥：3x3 方向プロンプトのキートークン定義
- **該当箇所**: `InputPrompt.tsx` / `InputPrompt.vue`
- **問題点**:
  `DIR_NW: '7 / y'`, `DIR_N: '8 / k'` などのキーボード対応案内が UI 側に静的に記述されている。
- **改善方針**:
  `WebUICore` の現在の `keyMode`（`numpad` / `vi`）に応じて、動的に「推奨キーラベル」を構造化プロンプト（`activePrompt.directionOptions`）の一部として渡す。

---

## 3. 具体的なコア層API設計案

### 3.1. `SituationCache` / `AttributeStateManager`
```javascript
// SituationCache.js の getSituation() 出力に追加
{
    attributes: {
        // ...既存プロパティ
        // ✨ 新設: UIがそのままマッピングできる確定耐性リスト
        activeResistances: [
            { id: 'fire', label: '耐火', en: 'Fire Res', isExtrinsic: true, isIntrinsic: false },
            { id: 'poison', label: '耐毒', en: 'Poison Res', isExtrinsic: false, isIntrinsic: true }
        ],
        // ✨ 新設: 解決済みキャラクタータグ
        characterSummary: {
            raceName: '人間',
            roleName: '観光客',
            level: 1,
            displayTag: '👤 人間 / 観光客 Lv.1'
        }
    }
}
```

### 3.2. `ContextActionEngine`
```javascript
// 各アクション生成時に正規化方向コードを標準付与
{
    id: 'ACTION_ATTACK_N',
    label: '攻撃',
    directionCode: 'N', // ✨ 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'SELF'
    keySequence: ['8']
}
```

### 3.3. `AreaStateManager` / `GKLPlugin`
```javascript
/**
 * フォーカスカメラ・ズームビュー用の整形済みタイルグリッドを取得
 * @param {number} radiusX - 横方向半径 (例: 10 => 21マス)
 * @param {number} radiusY - 縦方向半径 (例: 4 => 9マス)
 * @returns {Array<Object>} { x, y, dx, dy, glyphId, symbol, color, name, isPlayer, isUnexplored, knowledge }
 */
getFocusCameraTiles(radiusX = 10, radiusY = 4)
```

---

## 4. UIコンポーネント側のビフォーアフター (改善イメージ)

### `StatusBar.tsx` / `StatusBar.vue` の劇的スリム化
```typescript
// BEFORE: 50行以上の辞書・ループ・外部マップ参照
const activeResistances = useMemo(() => {
  const definitions = { FIRE_RES: { label: '耐火', en: 'Fire Res' }, ... };
  // 50行のパース処理
});

// AFTER: 1行で直感的にバインド！
const activeResistances = gklSituation?.attributes?.activeResistances || [];
const characterTag = gklSituation?.attributes?.characterSummary?.displayTag || '';
```

### `useNetHackDriver.ts` の泥臭いヘルパー全廃
- `extractDirectionCode()` ➔ **完全削除**（`action.directionCode` を直接使用）
- `getZoomAreaTiles()` ➔ **1行の委譲呼び出しに短縮**（`core.gkl.getFocusCameraTiles()`）

---

## 5. 次回実装ロードマップ

1. **ステップ 1 (コア層の拡張 & 単体テスト整備)**:
   - `src/core/knowledge/AttributeStateManager.js` および `SituationCache.js` に `activeResistances` / `characterSummary` 生成ロジックを追加。
   - `src/core/knowledge/ContextActionEngine.js` の全アクション生成に `directionCode` を付与。
   - `src/core/knowledge/AreaStateManager.js` に `getFocusCameraTiles` を実装。
   - コア層の単体テスト（Vitest）を実行し、100% PASS を確認。
2. **ステップ 2 (React / Vue / GKLpureJSClient のリファクタリング & 同期)**:
   - `StatusBar` / `StatusView`: ハードコード辞書および外部マップ参照（`ATTRIBUTE_DEFINITIONS`, `RACE_KNOWLEDGE_MAP`, `ROLE_KNOWLEDGE_MAP`）を削除し、コアの構造化データ（`activeResistances`, `characterSummary`）バインドに差し替え。
   - `useNetHackDriver.ts` / `DirectionPad.js`: 重複・泥臭い方向解決ヘルパー（`extractDirectionCode` 等）を削除し、コアが付与する `action.directionCode` を直接参照。
   - `FocusCamera` / `ZoomRenderer.js`: タイル抽出ループおよび未探索判定をコアの `getFocusCameraTiles()` 連携にスリム化。
   - `travelTo` シーケンスを `core.gkl.travelTo()` へ統一。
3. **ステップ 3 (ビルド ＆ 動作検証)**:
   - `npm test`（ルート: 全単体テスト）を実行。
   - `examples/react-client`, `examples/vue-client`, `examples/gkl-pure-js-client` の整合性と動作を確認。
