# React 18 Client - WebUIcore / Driver パッチ＆調整記録 (PATCH_LOG.md)

本ドキュメントは、`Modern_Web_Components_Update_Rules.md` および `WebUICore_Handoff_and_TODO.md` に基づき、React 18 サンプルクライアントの開発・更新作業において発生した WebUIcore / Driver との適合問題および Web コンポーネント側で実施した調整・パッチを記録するログファイルです。

※本実装が完了し解消された過去のパッチログ項目はクリーンアップ（整理・削除）済みです。

---

## 現状のパッチ・調整対応一覧

| ID | 対象機能 | 発生した問題・現象 | Webコンポーネント側での調整対応（パッチ内容） | 本来 WebUIcore / Driver に求められる改善案 | 状態 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **#009** | リスタート時マップ暗転停滞 | `core.restart()` 実行後にキャンバス描画イベントが届かず画面が暗転したまま停滞 | `useNetHackDriver.ts` の `restartGame()` にてセーブ削除およびストレージ全クリアの上 `location.reload()` で確実なクリーン復帰を暫定適用 | `WebUICore.prototype.restart({ clearStorage: true })` 内で Worker / WASM メモリ再構築と全マップ描画リセット (`map_cleared`) を自動発行 | **コア改修完了 (完全吸収・解決済)** |

---

## 💡 今後の更新アイデア / 次期改善提案 (Update Ideas)

- **[更新アイデア #001] タッチ / スマホ用 D-Pad 仮想コントローラーのコンポーネント化**:
  - `WebUICore.sendAction('MOVE_UP')` などのアクション送信機能が備わったため、各サンプルにスマホ操作用のオプショナルな画面上 D-Pad 仮想ボタンコンポーネントを追加すると、モバイル環境でのプレイ感が大きく向上する。
- **[更新アイデア #002] サウンド / SE 音効用イベントフック機能**:
  - `SoundEngine` のSE再生タイミング（攻撃hit、階段移動など）と連動し、Webコンポーネント側でアニメーションエフェクト（画面シェイクや画面フラッシュ）を発火させる簡易イベントリスナーを追加提案。
