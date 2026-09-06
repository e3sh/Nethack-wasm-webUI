# WebUICore 汎用連続リクエストコントローラ (Interactive Sequence Controller) 基本設計仕様書

## 1. 背景と課題の所在

### 1.1 現状アーキテクチャの課題
NetHack WASM WebUI では、C コア（NetHack C コード）との非同期通信において「連続したキー送信と画面の取得」を行う場面が多数存在します。
しかし現在、その実装方式はレイヤー間で分断され、以下のような構造的限界に達しています：

1. **第1世代: ドライバ固定配列 (`NetHackWasmDriver.queueSequence`)**:
   - 事前に決めた固定トークン配列（例: `['i', ' ', '\x1b']`）を機械的に C コアへ流し込む。
   - **限界**: 途中に動的なプロンプト（「どの箱か」「カテゴリ選択」「数量入力」）や分岐（空箱、未識別アイテム）が挟まると、キーが 1 つズレて即座にデッドロック（ハング）または意図しない誤爆を起こす。
2. **第2世代: 局所的コントローラ (`GKL.RequestController`)**:
   - GKL（知識レイヤー）専用のサブモジュールとして作られ、エラー時の ESC 復帰などを試みるも、GKL プラグインの内部に閉じ込められており、システム全体の基盤になっていない。
3. **第3世代: 専用個別 FSM の乱立 (`ContainerTransactionFSM` 等)**:
   - 基盤層に動的対話をさばく仕組みがないため、機能（コンテナなど）ごとに 1300 行を超える巨大な専用ステートマシンを新設せざるを得ず、コードの重複・保守性低下を招いていた。

### 1.2 改善の目的
- GKL 内に閉じ込められていたコントローラの概念を **`WebUICore` のコア基盤機能へと昇格** させる。
- **「単純な問い合わせ（固定配列）」** と **「動的分岐・変換を伴う高度な対話リクエスト（スクリプト型）」** を単一のエントリポイントで扱えるようにする。
- 散らばっているシーケンス制御を段階的に統合し、システム全体の堅牢性（デッドロック根絶）と拡張性を確立する。

---

## 2. アーキテクチャ構成とレイヤー設計

```mermaid
flowchart TD
    subgraph Client_Features ["上位クライアント機能"]
        GKL["GKL (インベントリ/呪文/属性/スキル同期)"]
        LOOK["OnDemandLookService (見回し解析)"]
        CONT["Container UI (先読み・出し入れ) ※保留中"]
        FUTURE["将来機能 (名前付け / 調整 / 店舗UI等)"]
    end

    subgraph Core_Layer ["WebUICore 基盤レイヤー (新設/昇格)"]
        ISC["InteractiveRequestController (汎用連続リクエストコントローラ)"]
        QSS["querySequenceSilent / executeSequence (統合ファサード)"]
        SAFE["SafetyGuard (タイムアウト・ESC自動復帰・二重送信防止)"]
    end

    subgraph Driver_Layer ["WASM / ドライバレイヤー"]
        DRIVER["NetHackWasmDriver (生トークン送受信・メモリ操作)"]
        WASM["NetHack WASM C-Core (pickup.c, invent.c, etc.)"]
    end

    GKL -->|単純配列 または レシピ| QSS
    LOOK -->|単純配列 または レシピ| QSS
    CONT -.->|対話レシピ (再開時)| QSS
    FUTURE -->|対話レシピ| QSS

    QSS --> ISC
    ISC --> SAFE
    ISC -->|動的相槌 / トークン送出| DRIVER
    DRIVER <-->|inputRequired / respond| WASM
```

---

## 3. インターフェース設計 (API 仕様)

`WebUICore` のパブリック API として提供され、渡される引数の型（配列 or オブジェクト）によって自動的に動作モードを切り替えます。

### 3.1 モード A: 単純問い合わせモード (従来互換)
引数に**トークン配列**を渡した場合。従来の `querySequenceSilent` と 100% 互換の動作をし、C コアの出力バッファを返します。

```javascript
// 例: インベントリ同期
const buffer = await core.querySequenceSilent(['i', ' ', '\x1b'], {
    syncType: 'inventory'
});
// 戻り値: Array<Object> (Cコアが画面に出力したテキスト/メニュー等のバッファ)
```

### 3.2 モード B: インタラクティブ・スクリプトモード (高度対話)
引数に**レシピオブジェクト**を渡した場合。C コアから届く `inputRequired` を監視し、定義されたハンドラルールに基づいて動的に応答・分岐・データ抽出を行います。

```javascript
const result = await core.querySequenceSilent({
    // 1. 初動キー
    start: ['a', 'e'],

    // 2. プロンプト / メニューに応じた動的ハンドラルール (優先順に評価)
    handlers: [
        {
            // 条件: メニューであり、タイトル/プロンプトに "Do what" を含む
            match: { type: 'menu', prompt: /Do what/i },
            action: (ctx) => {
                // 中身があるか空かで分岐
                if (ctx.hasMenuItem('o')) return 'o'; // 取り出しへ
                return 'q'; // 空箱なら即座に抜ける
            }
        },
        {
            // 条件: カテゴリ選択メニュー（挟まらない場合は自動スキップ）
            match: { type: 'menu', prompt: /what type/i },
            action: [{ identifier: -2, count: -1 }] // All types 選択
        },
        {
            // 条件: アイテム一覧メニュー
            match: { type: 'menu', prompt: /Take out what/i },
            action: (ctx) => {
                // その場で必要なデータを抽出してコンテキストに保持
                ctx.data = ctx.menuItems.map(it => ({
                    id: it.identifier,
                    name: it.str,
                    count: it.count
                }));
                return '\x1b'; // 中身を回収したら ESC で戻る
            }
        },
        {
            // 条件: 完了復帰（元の画面に戻ってきたら終了）
            match: { type: 'menu', prompt: /Do what/i, ifState: 'DATA_COLLECTED' },
            action: 'q'
        }
    ],

    // 3. 終了・完了条件 (通常ターン poskey に復帰したら Promise 解決)
    until: { type: 'turn_ready' },

    // 4. セーフティガード
    timeoutMs: 3000,
    onTimeout: 'abortWithESC' // タイムアウト時は ESC を連打して安全復帰
});

// 戻り値: { success: true, data: [...], buffer: [...] }
```

---

## 4. 既存箇所の棚卸しと段階的移行ロードマップ

本改修はシステムの根幹に関わるため、一括置換ではなく**「小さな安全な箇所から順次置き換える」** 段階的アプローチをとります。

### フェーズ一覧

| フェーズ | 対象・内容 | 影響度 / リスク | 実施時期目安 |
| :--- | :--- | :--- | :--- |
| **フェーズ 1** | **設計資料の確定と既存箇所の詳細棚卸し**<br>・各機能のシーケンス呼び出しパターンを完全整理 | なし (ドキュメント) | 即時 |
| **フェーズ 2** | **基盤コントローラの基本実装 (従来互換)**<br>・WebUICore 配下に新設、配列渡しで既存テスト 705 件パス | 極小 (後方互換担保) | 順次・軽量作業時 |
| **フェーズ 3** | **スクリプト実行エンジン（ハンドラ駆動）の実装**<br>・分岐、データ抽出、ESC 自動復帰の単体テスト整備 | 小 (新設コード中心) | 来週以降 |
| **フェーズ 4** | **既存機能の段階的移行（ちょっとずつ置換）**<br>① 属性・スペル・スキル同期（単純）<br>② インベントリ同期（中度）<br>③ 見回し解析（中度） | 中 (1機能ずつ実機検証) | 来週以降 |
| **フェーズ 5** | **コンテナ UI の再開・本接続 (本丸)**<br>・バイパスを解除し、コンテナ操作をレシピ化<br>・数量移動、アイテムレター、床箱投入の根本解決 | 大 (コンテナ本番検証) | コア安定後 |

---

## 5. 既存呼び出し箇所の初期棚卸しリスト

現時点でプロジェクト内で `querySequenceSilent` / `queueSequence` を使用している主要箇所：

1. **`GKLPlugin.js`**:
   - `syncInventorySilent`: `['i', ' ', '\x1b']`
   - `syncSpellsSilent`: `['+', ' ', '\x1b']`
   - `syncAttributesSilent`: `['\x18', ' ', '\x1b']`
   - `syncSkillsSilent`: `['#', 'enhance', ' ', '\x1b']`
2. **`OnDemandLookService.js`**:
   - `executeLookSequence`: `[';', <DIR_KEY>, ..., '\x1b']`（見回し結果の画面パース）
3. **`WebUICore.js`**:
   - `executeExtendedCommand`: `['#', <cmd>, <dir>]`
4. **`ContainerTransactionFSM.js`（※現在バイパス中）**:
   - `syncContentsSilent`: `['a', letter, 'o', 'a', '\x1b']`
   - `transferItems`: 手持ち/床オープンプレフィックス送出後のプロンプト待機
