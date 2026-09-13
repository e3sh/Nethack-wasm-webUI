# Legacy Container Architecture Archive (第3世代 参照用アーカイブ)

このディレクトリは、第3世代コンテナUI（ContainerTransactionFSM および ContainerPromptDetector）の実装と旧設計仕様書を保存する参照用アーカイブです。

## 隔離の理由と背景
- **ツギハギ修正・多重エイリアスの排除**:
  第3世代のFSM、平文メッセージ検知器、裏マクロ同期（syncContents）は、第4世代のIRC（InteractiveRequestController）およびシグナル駆動基盤との間でインターフェース不整合や予期せぬターン同期ズレを引き起こしていました。
- **真のゼロベース回帰**:
  ソースツリーからこれら旧世代コードを完全隔離し、現在のアクティブなSSOT（Single Source of Truth）仕様書および実装を以下の通り一本化しました。

## 現在のアクティブ仕様書・実装 (SSOT)
- 仕様書: docs/3_gkl/Container_Interaction_Specification_IRC.md
- コントローラ本体: src/core/container/ContainerController.js
- 対話リクエスト制御: src/core/request/InteractiveRequestController.js

## アーカイブされたファイル一覧
- Visual_Container_UI_Architecture_and_Usage_Guide.md: 第3世代FSMベースの旧設計ガイド
- ContainerTransactionFSM.js / ContainerTransactionFSM.test.js: 旧FSM実装およびテスト
- ContainerPromptDetector.js / ContainerPromptDetector.test.js: 旧平文プロンプト検知器およびテスト
