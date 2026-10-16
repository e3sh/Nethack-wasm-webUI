# Nethack-wasm-webUI Agent Guidelines

## 開発・設計の基本方針
- **C コア絶対真値（SSOT）**:
  - NetHack C コア（Wasm）が画面描画・グリフ・ダンジョン構造の唯一の絶対真値（Single Source of Truth）です。
  - JS 側（WebUICore / GKL）は土管（パイプライン）および状態反映層であり、JS 側で勝手に地形 typ やパラメータからグリフ番号を推測・捏造・逆算してはなりません。
- **推論コードの排除**:
  - `getGlyphForTerrainType` のような過去の推論ロジックは呼び出さず、C コアの直接グリフ（`print_glyph` 受信値、または `_cachedLevelGlyphs`）のみを採用してください。
- **受信イベント（print_glyph）の保護**:
  - `print_glyph` で受信した地形（角壁・ドア・通路等）は、掘削やドア破壊などの物理変化がない限り、定期同期処理で上書き（Re-clobber / 地形化け）してはなりません。

詳細なルールは [.agents/rules/direct_binding_ssot_rules.md](./.agents/rules/direct_binding_ssot_rules.md) を参照してください。
