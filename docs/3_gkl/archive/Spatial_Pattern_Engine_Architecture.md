---
title: SpatialPatternEngine (空間幾何学認識エンジン) 仕様・アーキテクチャ設計書
status: deprecated_for_tracking
last_updated: 2026-10-20
related_docs:
  - docs/3_gkl/Dungeon_Tracker_and_Checkpoint_Architecture.md
  - docs/3_gkl/TacticalAdvisor_Specification_and_Architecture.md
  - docs/1_driver/official_shim_direct_binding_implementation_plan.md
---

# SpatialPatternEngine (空間幾何学認識エンジン) 仕様・アーキテクチャ設計書

> [!CAUTION]
> **【設計方針の変更・責務退役のお知らせ (2026-10-20)】**
> 本ドキュメントで構想されていた「2マス隣接Engravingによる幾何学的旗立て（🚩）」および「幾何パターン認識による全階層の位置支援・トラッカー構築」は、**NetHack C コア標準の `mapseen`（`#overview`）および `#annotate` を Direct Binding 直結する新アーキテクチャへ全面移行したため、正式に退役（廃止）となりました**。
> 
> - **移行理由**:
>   1. **公式機能の活用**: NetHack には全階層の施設・踏破状況をセーブデータ内部で自動追跡する `mapseen` 構造体と、フロアにメモを残す `#annotate` コマンドがすでに標準装備されている。
>   2. **操作性と風化の解決**: プレイヤーがゲーム内でターンを消費して床に文字を刻む必要がなくなり、歩行や水による埃の風化リスクもゼロになる。
>   3. **コード純化**: 幾何認識エンジンや独自キャッシュを自前実装する必要がなくなり、JS 側のコード量を大幅に削減できる。
> 
> ※詳細な新アーキテクチャ仕様は [`Dungeon_Tracker_and_Checkpoint_Architecture.md`](./Dungeon_Tracker_and_Checkpoint_Architecture.md) を参照してください。
> 
> **現在の本エンジンの位置づけ**:
> 全階層のトラッキングや旗立ての責務からは完全に外れ、もし将来的に利用する場合でも「現在画面に映っている同一マス内の複数箱の重なり判定」や「局所的なビジュアル演出（パーティクル発生位置の重心計算など）」の補助ツールとしてのみ限定的に扱います。

---

## 1. 背景と過去の経緯 (Historical Context)

### 1.1 過去の動機
NetHack の C コア内部構造にアクセスできなかった時代、画面上の生グリフ（Glyph ID）のみからプレイヤーの拠点や重要な場所を外部 UI で認識させる手段として、「床の刻み文字（Engraving）を2マス並べる幾何学プロトコル」が考案されました。

### 1.2 なぜ移行したのか（アーキテクチャ決定の経緯）
Phase 8 において公式 C ソース非侵襲の `shim_bridge.c`（Direct Binding）が確立されたことで、C コア内部の真値（`svm.mapseenchn`、`rooms[]`、`u.uz` 等）に 0 ウェイトで安全にアクセスできるようになりました。
これにより、外側からグリフの並びを幾何推論する必要性が完全に消滅し、C コアの絶対真値（SSOT）をそのまま利用する最短・最善の設計へと統合されました。

---

## 2. アーカイブ：幾何学シグナルプロトコルの記録

以下は、過去に検討された幾何プロトコルの設計記録（アーカイブ）です。

### 2.1 チェックポイント旗立てプロトコル (🚩 Dual-Engraving) [廃止]
- **ルール**: `GLYPH_ENGRAVING` が8近傍に2マス連続して並んでいることを検出。
- **廃止理由**: 公式の `#annotate` コマンドにより、ゲーム内ターンを消費せず UI から直接セーブデータにメモを保存可能になったため不要化。

### 2.2 コンテナ・クラスタリングプロトコル (Container Clustering) [限定適用]
ダンジョン内に存在する箱・袋（`LARGE_BOX`, `CHEST` 等）の密集度を解析する手法。
- **現在画面（リアルタイム）への限定適用**:
  - `SHIM_CMD_GET_OBJECT_AT` 経由で、同一マスに複数のコンテナが重なっている場合（`nexthere` チェーン）の「重なり箱」バッジ表示などに限り、有用な知見として活用されます。

---

## 3. まとめと後続設計への参照

本仕様書が目指していた「安全でゴミの残らない探索トラッカー」「拠点やメモの直感的な記録」は、NetHack 本体の設計と融合することで、よりシンプルで強固な形（`mapseen` + `#annotate`）で実現されました。

実装の詳細は最新の [`Dungeon_Tracker_and_Checkpoint_Architecture.md`](./Dungeon_Tracker_and_Checkpoint_Architecture.md) を確認してください。
