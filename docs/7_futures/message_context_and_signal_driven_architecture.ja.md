---
title: メッセージコンテキスト辞書とシグナル駆動型次世代WebUICoreアーキテクチャ将来構想
status: proposal / future vision
created_at: 2026-09-16
last_updated: 2026-09-22
related_code:
  - src/core/WebUICore.js
  - src/core/prompt/SignalDetector.js
  - src/core/prompt/ControlSignalCatalog.js
  - src/driver/NetHackWasmDriver.js
  - dictionary.csv
  - tools/extract_source_messages.py
  - tools/map_source_to_dictionary.py
  - tools/data/source_messages_mapped.json
  - tools/data/mapping_report.txt
  - tools/data/control_signals_master.json
  - tools/build_lore_database.py
  - src/core/lore/data/LoreMasterData.js
  - src/core/lore/ElberethAnalyzer.js
  - src/core/lore/EngravingArchaeologist.js
  - src/core/lore/LoreDetector.js
  - src/core/lore/LoreCodexStorage.js
  - src/core/lore/LoreCodex.js
  - tools/lore_codex.html
  - tools/save_manager.html
  - docs/7_futures/source_message_extraction_methodology_guide.ja.md
  - docs/7_futures/phase5_detailed_migration_plan.ja.md
---

# メッセージコンテキスト辞書とシグナル駆動型次世代WebUICoreアーキテクチャ将来構想

**〜「後追い文字列解析」から「オリジナルソース起点の一元化シグナル駆動」へのパラダイムシフト〜**

---

## 1. 背景と課題意識 (Background & Motivation)

### 1.1 現行アーキテクチャにおける課題（後追い文字列解析の限界）
NetHack の生インターフェース（C コア）は、あらゆる事象（行動結果、体内感覚、プロンプト入力待ち、メニュー、ヘルプ）を端末用のテキストストリームとして出力します。

現在の WebUI では、画面に出てきた文字列（`rawText`）に対してフロントエンド層や個別モジュールで以下のような後追い判定を行っています：
- `if (rawText.includes("Who are you") || rawText.includes("your name"))`
- `if (lastText.includes('プレフィックス') || lastText.includes('prefix'))`
- `SignalDetector` における正規表現パターンマッチング
- SE 再生判定での翻訳後テキストの部分一致

この対症療法的なアプローチには、以下の本質的な問題が潜んでいます：
1. **誤爆（False Positive）と取りこぼし（False Negative）のリスク**:
   - 例: キャラクタ作成や特定プロンプトの検出正規表現が、インベントリ内の道具名やダンジョン内の落書きに過剰反応する。
2. **多言語・バリアント対応の二重三重メンテナンス**:
   - Vanilla NetHack（英語）と JNetHack（日本語）で別々に正規表現やキーワードを用意する必要があり、コードが肥大化・複雑化する。
3. **セマンティクス（意味・意図）と翻訳の癒着**:
   - 翻訳処理（`TranslationEngine`）、音響効果（`SoundManager`）、制御検出（`SignalDetector`）、戦術助言（`GKL`）がそれぞれ独自にメッセージ文字列を解釈しており、監視が一元化されていない。

### 1.2 逆転の発想：オリジナルソース起点のコンテキスト／シグナル辞書
「場当たり的に翻訳やシグナルを後追い解析するのではなく、**NetHack オリジナルソースから出力されるメッセージを網羅的に収集してコンテキスト付き辞書（SSOT: Single Source of Truth）を作成し、そこからセマンティックシグナルと翻訳辞書を導出・一元化する**」というアプローチをとることで、根本的な解決を図ります。

---

## 2. オリジナルソース（C コア＆データ）の実態調査データ

NetHack 5.0 / 3.7+ の C ソースコード（`src/*.c`）およびデータファイル（`dat/`）を静的解析・集計した結果、以下の客観的事実が判明しました。

### 2.1 メッセージ・対話関数の呼び出し分布
C ソース内の全メッセージ・プロンプト呼び出し箇所（計 5,721 箇所）の内訳：

| 呼び出し関数 | 呼び出し総数 | 文字列直書き (Literal) | 変数渡し (Variable) | 静的リテラル率 | 役割・セマンティクス |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `pline` | 2,012 | 1,912 | 100 | **95.0%** | 一般メッセージ・客観ナレーション |
| `You` | 1,225 | 1,198 | 27 | **97.8%** | プレイヤー自身の能動的行動 ("You eat ...") |
| `impossible` | 611 | 436 | 175 | 71.4% | システム警告・パニック前段階 |
| `pline_The` | 326 | 323 | 3 | **99.1%** | 特定物体の動作 ("The door opens") |
| `pline_mon` | 276 | 272 | 4 | **98.6%** | モンスター主体の事象（座標メタデータ付き） |
| `You_feel` | 231 | 228 | 3 | **98.7%** | 内的感覚・身体変化 ("You feel better") |
| `Your` | 230 | 229 | 1 | **99.6%** | プレイヤーの所有物・部位の変容 |
| `verbalize` | 147 | 140 | 7 | **95.2%** | 発言・台詞（神の声、NPC、店主） |
| `You_hear` | 142 | 138 | 4 | **97.2%** | 聴覚刺激・効果音（SE）トリガー |
| `You_cant` | 98 | 93 | 5 | **94.9%** | 行動制約・失敗 ("You can't move!") |
| `raw_printf` | 87 | 72 | 15 | 82.8% | 生テキスト出力（起動・設定・システム） |
| `Norep` | 59 | 52 | 7 | 88.1% | 連続重複防止メッセージ |
| `There` | 56 | 55 | 1 | **98.2%** | 存在・環境の提示 ("There is a ...") |
| `urgent_pline` | 49 | 43 | 6 | 87.8% | --More-- 抑制を貫通する緊急メッセージ |
| `You_see` | 43 | 42 | 1 | **97.7%** | 視覚刺激・目撃イベント |
| **`getlin`** | **42** | 11 | 31 | 26.2% | **1行テキスト入力プロンプト (Wish/Name等)** |
| **`yn_function`**| **39** | 14 | 25 | 35.9% | **Yes/No/多肢選択プロンプト** |
| **`getdir`** | **31** | 2 | 29 | 6.5% | **方向指定プロンプト** |
| その他 | 17 | 9 | 8 | 52.9% | 座標指定・特殊プレフィックス |
| **合計** | **5,721** | **5,269** | **452** | **92.1%** | — |

> [!NOTE]
> **重要な示唆**:
> 1. 全呼び出しの **92.1%（5,269件）が C ソース内に直接文字列リテラルとして存在** するため、静的解析ツールによって英文フォーマットのほぼ完全な網羅抽出が可能です。
> 2. 専用モーダル化の対象となる入力プロンプト（`getlin`, `yn_function`, `getdir`）は、**ゲーム全体でもそれぞれ 30〜40 箇所程度と非常に限定的** であり、完全カタログ化が十分に現実的です。

---

## 3. メッセージコンテキストの 5大レイヤー構造

オリジナルソースから抽出可能なコンテキストは、以下の 5 つのレイヤーに分類・構造化されます。

```
┌────────────────────────────────────────────────────────────────────────┐
│               NetHack メッセージ・コンテキストの 5大レイヤー           │
└────────────────────────────────────────────────────────────────────────┘
  [Layer 1] 視点・知覚レイヤー (関数セマンティクス)
            You (行動) / You_feel (感覚) / You_hear (聴覚) / verbalize (発話)
  [Layer 2] ドメイン・サブシステムレイヤー (Cソースファイル)
            eat.c (飲食) / pray.c (祈り) / potion.c (薬品) / zap.c (魔法) / shk.c (取引)
  [Layer 3] 制御・対話シグナルレイヤー (プロンプト・メニュー)
            yn_function (確認/選択) / getlin (文字列入力) / getdir (方向) / add_menu
  [Layer 4] 環境・伝承・蓄積レイヤー (LORE / Archive) ★拡張構想
            Engravings (床の刻み文字・文字消え) / Rumors (噂話) / Oracles (神託)
  [Layer 5] エンティティ・変数レイヤー (動的パーツ)
            objects.c (道具名・外見) / monst.c (モンスター名) / artifact.c (名剣等)
```

### Layer 1: 視点・知覚コンテキスト
NetHack のメッセージ関数名そのものが、プレイヤーの主観・客観・知覚モードを表現しています。
- **`You_feel`**: 体内感覚、バフ/デバフ状態変化（HUD アイコン更新シグナルに直結）
- **`You_hear`**: 音響イベント（サウンドマネージャの SE トリガーシグナルに直結）
- **`You_cant`**: 行動不可・失敗制約（エラー音や UI のシェイク演出に直結）
- **`verbalize`**: 神・NPC・店主の直接発言（会話ダイアログ UI への切り替えシグナルに直結）
- **`pline_mon`**: モンスターの絶対座標 `(mx, my)` を伴う事象（マップ上フキダシや FX に直結）

### Layer 2: ドメインコンテキスト
メッセージが定義されている C ファイルが、ゲーム内の機能ドメインを明確に示します。
- `eat.c`: 満腹度、死体摂取、耐性獲得、窒息
- `pray.c`: 祈り、神罰、トロフィー授与、完全回復
- `potion.c` / `read.c` / `zap.c`: アイテム効果、魔法発動、自己対象効果
- `uhitm.c` / `mhitu.c`: 近接戦闘、命中、回避、被ダメージ、クリティカル
- `trap.c`: 罠の発見、作動、回避、解除
- `shk.c`: 店舗売買、借金、泥棒警報
- `end.c`: ゲームオーバー、死因、昇天（クリア）、スコア集計

### Layer 3: 制御・対話シグナルコンテキスト
WASM C コアがプレイヤーに入力を求めて処理を一時停止するポイントです。
- **`yn_function` (39件)**: 二者択一・多肢選択プロンプト（`[yn]`, `[ynaq]`）
- **`getlin` (42件)**: 1行自由入力（願望 `#wish`、虐殺 `#genocide`、命名 `#name`、呪文詠唱等）
- **`getdir` (31件)**: 方向入力（移動・投擲・開閉の対象方向）

### Layer 4: 環境・伝承・蓄積コンテキスト (LORE & Collection) ★拡張構想
ゲーム内世界に持続的に存在し、プレイヤーが発見・収集・解読するメッセージ群です。
1. **Engrave（床の刻み文字・落書き・墓碑銘）**:
   - `src/engrave.c` 内の `struct engr` では、以下の 3 重文字列が管理されている：
     - `ep->engr_txt[actual_text]`: 風化・擦れ・文字消え後の現在の文字列
     - `ep->engr_txt[remembered_text]`: プレイヤーが記憶している文字列
     - `ep->engr_txt[pristine_text]`: **刻まれた当初の完全な原型文字列**
   - 埃（`DUST`）、彫刻（`ENGRAVE`）、焼け跡（`BURN`）、血文字（`ENGR_BLOOD`）の媒体情報。
2. **フォーチュンクッキー・噂話（Rumors）**:
   - `dat/rumors.tru`（真実の噂: 約400行の深遠な攻略ヒント）
   - `dat/rumors.fal`（偽りの噂: 約400行のデマ・ジョーク）
   - クッキーの祝福・呪い状態による出現分岐。
3. **神託（Oracles）＆ 墓碑銘（Epitaphs）**:
   - `dat/oracles.txt`（大預言・小預言）
   - `dat/epitaph.txt`（墓石のジョーク・死因）

### Layer 5: エンティティ・変数レイヤー
フォーマット文字列内の `%s` や `%d` に埋め込まれる動的パーツです。
- `objects.c`: 道具名（dagger 等）、未識別外見（runed, silver 等）
- `monst.c`: モンスター名（goblin, dragon 等）
- `artifact.c`: アーティファクト固有名称（Excalibur 等）
- `role.c`: 職業、属性、称号、神々の名前

---

## 4. 革新的 WebUI 拡張機能のユースケース (Vision Use Cases)

本アーキテクチャが実現した際、WebUI は以下のような革新的な機能群を極めて疎結合に実装できるようになります。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      次世代シグナル駆動 WebUICore 構想                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
【冒険手帳・噂話図鑑】        【Elbereth結界モニター】      【言語非依存・専用UI】
・クッキーを読むと自動記録    ・文字消え（Elber???）を検知   ・Vanilla/JNetHackを共通化
・真偽（True/False）の判定    ・残存率（65%）と危険度警告    ・UI層はシグナルIDのみを
・攻略Tipsコレクション        ・原型照合による復元表示         購読してリッチにレンダリング
```

### ① 冒険手帳 / 噂話図鑑（Rumor & Lore Codex）
- クッキーを食べたり紙片を読んだ瞬間に `SIGNAL_LORE_COLLECTED { type: 'RUMOR', text: '...', id: ... }` を発行。
- プレイヤーの「冒険手帳（Codex モーダル）」にアンロックされ、既読ヒントを一覧・検索可能に。
- GKL 知識ベースと照合して「検証済み（真実）」「デマ（偽り）」のスタンプを自動付与。

### ② Elbereth 結界モニター ＆ 文字消え復元アシスト
- 床の文字が `Elber???` や `El...eth` に擦れた際、シグナル監視層が `pristine_text`（原型: `Elbereth`）と `actual_text`（現在）を照合。
- 「Elbereth 結界が劣化（残存度 60%）。踏むと消滅するリスクあり」という戦術シグナル（GKL AssistSignal）を HUD に発火。
- チュートリアル（`tut-1.lua`）のかすれた古代文字をツールチップで完全復元表示。

### ③ 言語完全非依存の専用モーダル制御
- プロンプト入力待ちが発生した際、画面上の文字列を一切見ることなく、`SIGNAL_PROMPT_WISH` や `SIGNAL_PROMPT_GENOCIDE` を即座に同定。
- UI クライアント側（Vue, React, モバイル DOM）は、言語が英語か日本語かを意識することなく専用のセレクト UI や入力フォームを立ち上げられる。

---

## 5. 段階的移行ロードマップ (Staged Migration Roadmap)

本構想は非常に強力である一方、一度に全面移行を試みると現行システムの安定性を損なうリスクがあります。そのため、**「現行 WebUICore での実戦経験と知見の深化」を優先しつつ、以下のフェーズで段階的に進化** させます。

```
[現在]
  現行 WebUICore (SignalDetector + dictionary.csv) の運用・改良
  実戦でのプロンプト挙動・メッセージパターンの知見蓄積
    │
    ▼
[Phase 1: 静的抽出基盤の確立] ★完了
  Python スクリプトによる NetHack C ソース＆ dat ファイルの全メッセージ自動抽出
  JSON / CSV 形式の「コンテキスト付きメッセージマスタ (source_messages.json)」生成
  ※設計思想・運用ガイド: `docs/7_futures/source_message_extraction_methodology_guide.ja.md`
    │
    ▼
[Phase 2: 既存翻訳資産とのマッピング] ★完了 (2026-09-18)
  抽出された英文フォーマットと、既存 dictionary.csv (17,191件) の多層自動照合 (map_source_to_dictionary.py)
  全 14,849 件のコンテキスト付きマッピングマスタ (source_messages_mapped.json) 生成
  主要ゲームドメイン (Quest 96%, Rumors 96.5%, 飲食・祈り・魔法 85〜94%) の極めて高い翻訳完全性を実証
  未翻訳ギャップリスト (untranslated_source_messages.csv: 8,794件) による課題の可視化
  Phase 3 直結の制御シグナルマスタ (control_signals_master.json: 102件) を完全集約
[Phase 3: 制御シグナルの先行完全網羅] ★完了 (2026-09-18)
  NetHack 5.0 C ソース全102件の制御呼び出し (yn_function 39件, getlin 37件, getdir 26件) を精緻に分類・マッピング
  カタログ自動生成・同期ツール (tools/build_control_signal_catalog.py) を確立
  Vanilla/英語の完全網羅制御シグナルカタログ (src/core/prompt/ControlSignalCatalog.js: 全52シグナル) を生成
  validKeys / defaultKey / inputType / subCategory / params の完全付与と SignalDetector.js への決定論的伝播
  全単体テスト (32件) および全体回帰テスト (65ファイル / 908件) 100% パスによる誤爆ゼロ実証
    │
    ▼
[Phase 4: LORE / コレクション系シグナルと拡張機能の実装] ★完了 (2026-09-18)
  NetHack 5.0 の Rumors (真実 390件 / 偽り 397件) および Oracles (20件) の SSOT マスタデータ化 (tools/build_lore_database.py, LoreMasterData.js)
  3大 LORE シグナル (SIGNAL_LORE_RUMOR, SIGNAL_LORE_ENGRAVE, SIGNAL_LORE_ORACLE) の決定論的検知エンジン (LoreDetector.js)
  src/engrave.c の wipeout_text 仕様に基づく Elbereth 結界解析器 (ElberethAnalyzer.js: 残存率・風化・結界有効性判定)
  Wasm セーブと完全分離されたセッション横断メタ永続化基盤 (LoreCodexStorage.js & LoreCodex.js: IndexedDB/localStorage, JSON export/import)
  WebUICore への Pub/Sub (core.emit('signal', ...)) および冒険手帳 API (core.getCodex()) の完全統合
  クライアント専用コンテンツプロトタイプ画面 (tools/lore_codex.html: 噂話図鑑, 神託アーカイブ, 結界モニター, シミュレータ) の構築
  SaveManager (tools/save_manager.html) への冒険手帳データ管理連携
  新規単体テスト (21件) および全体回帰テスト (68ファイル / 932件) 100% パスによるリグレッションゼロ実証
    │
    ▼
[Phase 5: 既存状態把握機能のメッセージマスタ移行と次世代シグナル駆動 WebUICore の完成]
  【目的: 「後追い文字列推測」から「メッセージマスタ起点の一元確定」への既存モジュールの刷新】
  ※詳細設計・移行手順書: `docs/7_futures/phase5_detailed_migration_plan.ja.md`
  ※「WebUICore（第1層: 状況シグナル）＋ GKL（第2層: 現状把握・実施シグナル）」の2段構えモデルを採用
  ※作業規模と複雑性を踏まえ、以下の5つのサブステージ（Stage 5.1〜5.5）で段階的に移行を推進：
    ・Stage 5.1: 責務純化とアーキテクチャ境界の確立（LORE/Codex の GKL 移設、WebUICore の純化）
    ・Stage 5.2: 状況シグナル基盤の確立（軽量カタログ生成、MessageContextResolver、ContextFrameBuffer）
    ・Stage 5.3: GKL 現状把握と実施シグナルの確立（InteractionContext、ActionSignalResolver、IRC連携）
    ・Stage 5.4: ドメイン別既存モジュールのメッセージマスタ移行
      - 5.4A: 効果音エンジン (SoundEngine) の刷新（Audio Queue、スタガード再生、You_hear 142件）
      - 5.4B: 耐性・状態異常マネージャ (AttributeStateManager) の移行（You_feel 231件 & 飲食/薬品）
      - 5.4C: 道具識別エンジン (DiscoveryStateManager) の確定的判明移行（read.c / zap.c 等）
    ・Stage 5.5: 多言語透過性 (Language-Agnostic) の完全達成と総合回帰検証（全テスト1037+件＆全クライアントビルド）
  ------------------------------------------------------------------------------------------------
  0. 【最優先看板機能】かすれ床文字の考古学的復元アシスト（GKL Engraving Archaeology & Restoration Engine）: ★完了 (2026-09-18)
     - 背景・仕様: `src/engrave.c:random_engraving` では床の落書きの75%が Rumors、25%が `dat/engrave.txt` から選ばれ、`wipeout_text()` により生成時点で25%が削られ・変形（`rubouts[]`）して出現する。
     - 解決手法: `LoreDetector` の `SIGNAL_LORE_ENGRAVE` によるコンテキスト完全同定と、Rumors (787件) + Engrave (48件) の母数約840件へのスコープ完全隔離。
     - 価値: `docs/9_translation/translation_architecture_enhancement_plan.md` の長年の保留課題（全体ファジーマッチの誤爆リスク）をスマートに完全解決。かすれ文字（例: `El?er...` や擦れた格言）から原文を高精度同定し、完全な日本語訳と原型プレビューをプレイヤーに提示する GKL の象徴的アシスト機能。
     - 成果物: `tools/build_lore_database.py` (48件のSSOT化), `src/core/lore/EngravingArchaeologist.js` (rubouts逆引き・類似度復元エンジン), `LoreDetector.js` / `WebUICore.js` 連携, 単体テスト (16件全パス)
  1. 2段構えシグナルアーキテクチャの確立:
     - WebUICore からの客観的事実通知（状況シグナル）と、GKL の現状把握（InteractionContext: 目の前の対象、施錠状態、戦闘フラグ、能力）に基づく推奨行動通知（実施シグナル）への責務分離
  2. 効果音エンジン (SoundEngine) の刷新:
     - 決定論的 SE トリガーへの刷新および、同一ターン内複数 SE の音潰れを防ぐ Audio Queue & スタガード遅延再生（50〜80ms）
  3. 耐性・状態異常マネージャ (AttributeStateManager / StatusAccessor) の移行:
     - `You_feel` (231件) や `eat.c` / `potion.c` のメッセージ ID 照合による誤爆ゼロの耐性獲得・体内変化検知
  4. 道具識別エンジン (ItemIdentificationResolver / DiscoveryStateManager) の移行:
     - `read.c` / `zap.c` 等のメッセージマスタ ID に基づく、未識別アイテム（巻物・杖等）の確定的自動判明
  5. 多言語透過性 (Language-Agnostic) の完全達成:
     - シグナル層は機械メタデータのみに純化し、画面表示テキストは `dictionary.csv`（TranslationEngine）に 100% 委譲する完全直交設計
  6. LORE / Codex 機能の GameKnowledge (GKL) 配下への正式配置転換と責務純化:
     - WebUICore は低レベル I/O と状況シグナル発行に特化し、GKLPlugin がシグナルを購読して Codex を更新・管理する疎結合構成へ純化
  7. メッセージ監視パイプラインの一元化:
     - WebUICore から流れる全メッセージをマスタ照合済みの構造化状況シグナルとして一元ディスパッチする完成形へ
```

---

## 6. 結論 (Conclusion)

「出力された文字列を後から正規表現で推測する」アプローチから、**「オリジナルソースから収集したコンテキスト辞書を起点にシグナルと翻訳を一元化する」** アプローチへの転換は、NetHack WebUI の安定性と拡張性を飛躍的に高める決定打となります。

現在は現行 WebUICore の機能拡充と実戦検証を進めつつ、本ドキュメントを将来のアーキテクチャ刷新における設計羅針盤として位置づけます。
