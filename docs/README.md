# 📚 NetHack WASM WebUI ドキュメントポータル

本ディレクトリには、NetHack WASM WebUI プロジェクトのアーキテクチャ、コア技術仕様、GKL (Game Knowledge Layer)、翻訳、サウンド、ドライバに関する公式ドキュメントが格納されています。

各ディレクトリ直下には**「今確実に参照すべきメイン仕様書（1〜2本）」のみを配置**しており、過去のレポートや詳細な旧設計メモは各フォルダ内の `archive/` へ物理退避されています。

---

## 📊 メイン仕様書ダッシュボード (Core Documents)

### 1. 🧠 GKL (Game Knowledge Layer) 仕様・設計書 (`docs/3_gkl/`)
| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| [gkl_documentation.md](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_gkl/gkl_documentation.md) | `🟢 active` | `src/gkl/` | GKL 3層レイヤーマップ・総合仕様ガイド |
| [ArchitectureDecisionRecord.md](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_gkl/ArchitectureDecisionRecord.md) | `🟢 active` | `src/gkl/` | GKL アーキテクチャ意思決定記録 (ADR) |
| [📦 archive/ サブフォルダ](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_gkl/archive) | `📦 archived` | - | 過去の推論仕様書・シーケンス設計メモ群（6ファイル退避済） |

---

### 2. 📦 Driver & Web Worker 仕様 (`docs/1_driver/`)
| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| [driver_core_spec.md](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/1_driver/driver_core_spec.md) | `🟢 active` | `src/driver/` | NetHack WASM Driver コア仕様書 |
| [driver_api_reference.md](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/1_driver/driver_api_reference.md) | `🟢 active` | `src/driver/` | Web Worker 通信 API リファレンス |
| [📦 archive/ サブフォルダ](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/1_driver/archive) | `📦 archived` | - | 旧ロードマップ・C層Shim調査メモ等（3ファイル退避済） |

---

### 3. 💻 クライアント UI & コアエンジン (`docs/2_client_ui/`)
| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| [WebUICore_Usage_Guide.md](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/2_client_ui/WebUICore_Usage_Guide.md) | `🟢 active` | `src/core/WebUICore.js` | WebUICore 利用ガイド・機能仕様 |
| [Modern_Web_Components_Update_Rules.md](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/2_client_ui/Modern_Web_Components_Update_Rules.md) | `🟢 active` | `src/` | モダン Web コンポーネント実装規約 |
| [📦 archive/ サブフォルダ](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/2_client_ui/archive) | `📦 archived` | - | 各種個別UI・入力仕様・描画パフォーマンス分析（7ファイル退避済） |

---

### 4. 🌐 翻訳エンジン & 辞書 (`docs/3_translation/`)
| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| [README.md](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_translation/README.md) | `🟢 active` | `src/translation/` | 翻訳システム全般の構成と概要 |
| [DICTIONARY_OPERATION.md](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_translation/DICTIONARY_OPERATION.md) | `🟢 active` | `dictionary.csv` | 辞書運用・メンテナンスマニュアル |
| [📦 archive/ サブフォルダ](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_translation/archive) | `📦 archived` | - | プラグイン詳細構成・補助ツールリファレンス等（5ファイル退避済） |

---

### 5. 🔊 音響システム (`docs/4_sound/`)
| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| [sound_system_spec.md](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/4_sound/sound_system_spec.md) | `🟢 active` | `src/sound/` | 音響・Web Audio システム仕様書 |
| [📦 archive/ サブフォルダ](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/4_sound/archive) | `📦 archived` | - | C層 soundprocs Shim 調査メモ退避 |

---

### 6. 📂 ゲームデータ・プロジェクト報告書
| ドキュメント | ステータス | 概要 |
| :--- | :---: | :--- |
| [docs/5_gamedata/](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/5_gamedata/) | `🟢 active` | 地形・アイテム・モンスター等のゲームリファレンスデータ群 |
| [docs/6_project_reports/](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/6_project_reports/) | `📦 archived` | 開発初期の引き継ぎ資料・進捗報告書群（凍結保存） |
| [docs/7_futures/](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/7_futures/) | `🔵 reference` | 将来のWebUICore完全独立構想メモ |

---

## 📁 ディレクトリ構造

```text
docs/
├── 1_driver/             # WASM Driver 仕様書 (直下2本 + archive/)
├── 2_client_ui/          # UI / WebUICore 仕様書 (直下2本 + archive/)
├── 3_gkl/                # GKL 総合仕様書 & ADR (直下2本 + archive/)
├── 3_translation/        # 翻訳概要 & 辞書運用 (直下2本 + archive/)
├── 4_sound/              # 音響システム仕様書 (直下1本 + archive/)
├── 5_gamedata/           # ゲームリファレンスデータ群
├── 6_project_reports/    # プロジェクト引き継ぎ・報告書 (archived)
└── 7_futures/            # 将来アーキテクチャ構想 (reference)
```

