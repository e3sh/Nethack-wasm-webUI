---
title: 3大不具合是正計画（神託記録・exploreランキング混入・攻撃エフェクト誤爆）設計・調査資料
status: archived
last_updated: 2026-10-08
---

# 🛠️ 3大不具合是正計画（神託記録・exploreランキング混入・攻撃エフェクト誤爆）

本資料は、NetHack WASM WebUI において報告された以下の3件の不具合について、詳細な原因究明結果・コードレベルの解析・修正設計方針・テスト検証手順をまとめた引き継ぎ・実装計画ドキュメントです。
全フェーズの実装およびテスト検証が完了したため、アーカイブ記録として保存されています。

---

## 📌 対象不具合一覧とサマリー

| # | 課題名 | 影響レイヤー | 根本原因 | 解決アプローチ / 進捗状況 |
|---|---|---|---|---|
| **1** | **信託（Oracle）を聞いても冒険手帳に記録されない** | Core / GKL (`GKLPlugin.js`, `LoreDetector.js`) | 信託の複数行テキストは 1行メッセージ（`messageText`）ではなく、テキストウィンドウ（`putstr` / `TextWindowManager`）に出力されるが、GKLのLore検知は `messageText` しか購読していなかったため。 | `🟢 対応完了`: テキストウィンドウ確定・閉じるタイミング（または `putstr` バッファ）でテキストを抽出し、`LoreDetector.processMessage()` へ流すパイプラインを配備。大予言一括管理で OOM 解消。 |
| **2** | **exploreモード（探索モード）終了時にランキングに表示される ＆ 死因判定機能不全** | Core (`GameOverResolver.js`, `WebUICore.js`) | 探索モード除外処理に加えて、quit時や溶岩死等でオープニングテキストが死因に表示される問題・ランキング機能不全が発生。 | `🟢 対応完了 (2026-10-08)`: `topten.c` 準拠 `flags`（discover/wizard）解析除外、Cコア出力 `xlogfile` 死因SSOT化、破壊的 `reverse()` 撤廃、`scoreboard.html` 配備により完全解決。 |
| **3** | **攻撃エフェクト（SLASH / SE）が死亡時（墓）や店主衝突時にも誤発生する** | GKL (`GKLPlugin.js`) | 方向キー入力ハンドラ（`sequence.length === 1`）で `_isPlayerDead` のチェックがなく、さらに隣接セルが `MONSTER` であればペット以外無条件に `ATTACK_HIT` を発火させていたため。 | `🟢 対応完了`: 死亡状態（`this._isPlayerDead`）ガードを追加し、かつ店主（Shopkeeper）や平和的モンスター（`peaceful`）に対して方向キーを押した段階での即時エフェクト発火を抑止。 |

---

## 🔍 詳細解析と修正設計

### 1. 信託（Oracle）記録不具合の解析と是正方針

#### 1.1 現状の動作とレコードシナリオ検証
- **検証レコードデータ**: `record_scenario/Oracles_1791173139967.json`
- レコードデータ内のイベントシーケンス確認結果:
  ```json
  {
    "type": "create_nhwindow",
    "data": { "windowId": 5 }
  },
  {
    "type": "putstr",
    "data": {
      "windowId": 5,
      "text": "The Oracle scornfully takes all your gold and says:"
    }
  },
  {
    "type": "putstr",
    "data": {
      "windowId": 5,
      "text": "\"...it is rather disconcerting to be confronted with the\r"
    }
  }
  ```
- **問題点**:
  - 信託の神託メッセージは、1行メッセージ（`messageText` / `--More--`）ではなく、NetHack の `display_file` や専用ウィンドウ（`NHW_TEXT` / `NHW_MENU`）宛ての `putstr` ストリームとして配信されます。
  - しかし、`src/core/knowledge/GKLPlugin.js` の 729行目:
    ```javascript
    addCoreListener('messageText', ({ text }) => {
        ...
        const loreSignal = this.loreDetector.processMessage(text, { anchorCandidate });
        ...
    });
    ```
    のように、1行メッセージイベントのみで `loreDetector` を呼んでおり、テキストウィンドウの内容が一切渡っていませんでした。

#### 1.2 是正方針
1. **テキストウィンドウバッファの購読**:
   - `core` から送出されるウィンドウ更新・クローズイベント（例: `windowText`, `textWindowClosed`, または `TextWindowManager` のバッファフラッシュ）を `GKLPlugin` で購読。
   - または、`putstr` が蓄積されたテキストウィンドウの全文テキストを取得し、`loreDetector.processMessage(fullText)` に渡す。
2. **改行・フォーマットの正規化**:
   - `putstr` で流れてくるテキストには末尾に `\r` や改行が含まれ、文が途中で折り返されているため、行を結合・トリムして空白を正規化してから判定エンジンに渡す。
3. **冒険手帳（LoreCodex / AdventureLogManager）のアンロック**:
   - `SIGNAL_LORE_ORACLE` が検知されたら、既存の `this.adventureLogManager.unlockOracle(orc.id)` が自動的に呼ばれ、手帳の信託一覧に解禁されることをテスト（シナリオ再生または単体テスト）で確認する。

#### 1.3 大予言（Major Consultation）時の OOM クラッシュ解消と一括管理への刷新
- **問題（ブラウザクラッシュ / OutOfMemory）**:
  - 初回実装後、NetHack WASM版で高い方の信託（Major Consultation / 大予言）を聞くとブラウザが OutOfMemory (OOM) でクラッシュする重大な問題が発生。
  - WASM/Cコアの挙動上、`outoracle()` を呼ぶと神託ファイル（`oracles`）に記載された全20個の神託（約120行）が一度にテキストウィンドウに送出される。
  - `GKLPlugin` でこの巨大テキストから20個の神託を検出し、`for (const orc of oracles)` ループで個別に `unlockOracle`（および `save()` / `_emitAdventureLogUnlocked` / `LoreCodex.addOracle`）を20回連続で即時乱発。
  - UI層（`main.js`）でトーストDOM生成・floatingMessageHud・Codexバッジ更新が20重に走り、同期ストレージ書き込みとイベントキューが爆発してブラウザが OOM に至った。
- **解決アプローチ（聞いたことの一括管理）**:
  - 複雑な文字列パースや20重ループ通知を撤廃し、「信託を聞いた（大予言ヘッダー検知）」事実をトリガーとして一括管理する設計に刷新。
  - `AdventureLogManager.prototype.unlockAllOracles()`: 全20個の神託を一括アンロックし、`save()` と通知を **1回だけ** 実行。
  - `LoreCodex.prototype.addOracles()`: 全20個の神託を一括登録し、`_autoSave()` と通知を **1回だけ** 実行。
  - `GKLPlugin.prototype._handleOracleUnlock()`: 大予言（`isBulk: true`）受信時、1回のみ `category: 'oracle'`（`isBulk: true, count: 20`）のアンロックイベントを発行。
  - UI層（`AdventureLogToast.js`, `main.js`）: 単一のトースト・HUDメッセージとして「🏛️ [冒険手帳] オラクルの大予言を手帳に記録しました！」を安全に表示。
- **効果**: ブラウザのフリーズ・クラッシュが根本的に解消され、処理がミリ秒単位で完了する軽量・堅牢な構造を実現。

---

### 2. exploreモードのランキング混入不具合の解析と是正方針

#### 2.1 NetHack Cコア仕様と表示側の不一致
- **NetHack Cコア側 (`topten.c`)**:
  ```c
  /* topten.c:395 encodeflags() */
  staticfn long encodeflags(void) {
      long e = 0L;
      if (wizard)   e |= 1L << 0; /* 0x1 */
      if (discover) e |= 1L << 1; /* 0x2 (探索モード) */
      if (!u.uroleplay.numbones) e |= 1L << 2;
      if (u.uroleplay.reroll)   e |= 1L << 3;
      return e;
  }
  
  /* topten.c:725 topten() */
  #ifdef XLOGFILE
      ... XLOGFILE には全セッション（flags含む）を出力 ...
  #endif
  if (wizard || discover) {
      if (how != PANICKED)
          topten_print("Since you were in discover mode, the score list will not be checked.");
      goto showwin; // ★ RECORD（公式スコアリスト）には絶対に追記されない！
  }
  ```
- **WebUI Core側 (`src/core/lifecycle/GameOverResolver.js`)**:
  - `GameOverResolver.parseRecordText(rawRecord, rawXlog, ...)` では、公式ファイル `record` と拡張ログ `xlogfile` の両方を読み込んでマージしています。
  - しかし、`parseXlogList()` および `parseRecordText()` のマージ処理では、`xlog.flags` のビット判定（探索モードフラグ `0x2`）や探索モード識別（`xlog.mode === 'explore'` 等）が全く行われておらず、**xlogfile にある全セッションをスコア降順でランキング上位10件に無条件マージ**していました。
  - ユーザーが推測された通り、セーブデータではなく **WebUI のランキング生成ロジック側の問題** です。

#### 2.2 是正方針
1. **`GameOverResolver.js` における explore / discover 判定**:
   - `xlog` エントリの `flags`（16進数値 `0x...` または10進数）をパースし、ビット1（`flags & 2`：discover/explore）またはビット0（`flags & 1`：wizard）が立っているエントリを検知。
   - または `xlog` に `explore=1` / `mode=explore` 等がある場合も同様に検知。
2. **公式スコアボード（Top 10）からの除外フィルタリング**:
   - `parseRecordText()` でスコアボードを生成する際、通常ランキングからは探索モード・デバッグモードのエントリを除外する。
   - （オプション/将来拡張）もし探索モード専用の別枠ログ表示を設ける場合でも、公式ハイスコアとは明確に分離する。
3. **ユニットテストの配備**:
   - `GameOverResolver.test.js` に「exploreモード（`flags=0x2` 等）の xlog 行が含まれていても、返却される scoreboard 配列には含まれないこと」を検証するテストを追加。

#### 2.3 ⚠️ 実機検証での死因不一致・ランキング機能不全（次週繰り越し課題）
- **現象**:
  - 実機プレイにおいて、`#quit` で終了したりチュートリアル等で溶岩に飛び込んで死亡した場合に、死因としてゲーム開始時のオープニングテキストが表示されてしまう不具合が発生。
- **原因の所在**:
  - `src/core/WebUICore.js:1393` において、`sessionInfo.deathMessage` のフォールバックに `this.lastPutstrText`（ゲーム開始時等の直近 putstr 出力）が渡されていた。
  - `detectedDeath` が null の場合、オープニング等の任意のテキストが `deathMessage` に混入し、それがスコアボード・終了リゾルバ側で最優先採用されてしまっていた。
  - 加えて、`GameOverResolver.js` における `xlogfile`（`topten()` 由来）のレコード照合と画面メッセージ抽出の優先順位・ライフサイクルが整合しておらず、ランキング機能全体が正常に動作しない。
- **対応方針**:
  - 本件は表面的なフォールバック修正ではなく、NetHack Cコアの終了フロー（`topten` 出力・`xlogfile` / `record` 生成タイミング）と WebUI メッセージバッファの整合性を包括的に再設計する必要があるため、**次週繰り越し**として抜本的に改修を行う。
  - **現状の処置**: 修正途中で発生したエンバグ（オープニングテキスト最優先採用等）を完全に除去するため、`GameOverResolver.js` および `GameOverResolver.test.js` は修正前の安全な状態へロールバック（フォールバック）済み。次週クリーンな状態から再設計を開始する。

---

### 3. 攻撃効果エフェクト（ATTACK_HIT）の誤爆不具合の解析と是正方針

#### 3.1 現状コードの欠陥
- **該当箇所**: `src/core/knowledge/GKLPlugin.js:705-723`
  ```javascript
  // 近接攻撃アクション (ATTACK_HIT) の検知 (※ ペットとの位置入れ替え/displaceは除外)
  if (sequence.length === 1 && this.areaStateManager) {
      const offset = this._getDirOffset(sequence[0]);
      if (offset) {
          const px = this.areaStateManager.playerX;
          const py = this.areaStateManager.playerY;
          const tx = px + offset.dx;
          const ty = py + offset.dy;
          const targetCell = this.areaStateManager.grid?.[ty]?.[tx];
          const isPet = targetCell?.top && (targetCell.top.type === 'PET' || targetCell.top.isPet);
          if (targetCell?.top && targetCell.top.type === 'MONSTER' && !isPet) {
              this._lastAttackTarget = { x: tx, y: ty, timestamp: Date.now() };
              this.emitFxTrigger({
                  type: 'ATTACK_HIT',
                  targetX: tx,
                  targetY: ty
              });
          }
      }
  }
  ```
- **発生している不具合**:
  1. **死亡時（墓）の誤爆**:
     - プレイヤーが死亡して墓（tombstone）になっている状態でも、方向キーを押すと周囲にモンスターがいれば即座に `ATTACK_HIT`（スラッシュ演出＋斬撃SE）が発生してしまう。`this._isPlayerDead` のチェックが抜けています。
  2. **店主・平和的モンスター衝突時の誤爆**:
     - 店主（Shopkeeper）や平和的モンスター（peaceful）は内部グリフ的に `MONSTER` ですが、方向キーを押しただけでは攻撃になりません（店主との会話、または `"Really attack the shopkeeper?"` の確認プロンプトが出る、あるいは押し合って位置が変わらない等）。
     - しかし、現状の実装では「方向キーを押した瞬間」に無条件で攻撃ヒット演出を行っているため、ぶつかっただけで斬撃エフェクトや攻撃音が鳴ってしまいます。

#### 3.2 是正方針
1. **死亡状態ガードの配備**:
   - `if (this._isPlayerDead) return;` を先頭に追加。死亡中は一切の攻撃エフェクト・SEを抑止。
2. **平和的NPC・店主への誤爆抑止**:
   - `targetCell.top` の属性（`isPeaceful`, `peaceful`, またはモンスター名やIDが店主/番兵/僧侶などの非敵対状態）をチェック。
   - 平和的モンスター（`top.isPeaceful || top.peaceful`）に対しては、方向キー入力時点での即時 `ATTACK_HIT` は発火させない。
   - （より確実な設計）方向キー押下時点での即時発火ではなく、攻撃の成否（NetHackから返る戦闘メッセージ、または確認プロンプトの有無）を検証するか、あるいは明示的な戦闘アクション（IRC `ACTION_ATTACK_*`）実行時、または非平和モンスターへの移動時のみに限定する。
3. **ユニットテストの配備**:
   - `GKLPlugin.test.js` にて、
     - `_isPlayerDead = true` の時に方向キーを入力しても `ATTACK_HIT` が発火しないこと
     - 隣接マスが `peaceful: true` のモンスターである場合に方向キーを入力しても `ATTACK_HIT` が発火しないこと
     をテストで担保。

---

## 📋 実装・検証タスクチェックリスト（マイグレーションステップ）

本作業を順次進めるための具体的タスクリストです。

### フェーズ 1: exploreモード ランキング除外 ＆ 死因判定堅牢化 【完了】
- [x] `src/core/lifecycle/GameOverResolver.js` の `parseXlogList` / `parseRecordText` に `flags` ビット判定ロジックを実装
  - `flags` から `isDiscover = (flagsNum & 2) !== 0`、`isWizard = (flagsNum & 1) !== 0` を判定
  - 通常ランキング構築時にこれらを除外
- [x] 死因抽出ロジック（`WebUICore.js` の `lastPutstrText` 誤爆および `GameOverResolver.js` の優先順位・ライフサイクル）の抜本的再設計
  - Cコア出力 `effectiveRecord.death` を単一情報源 (SSOT) とし、フォールバックを撤廃
  - 末尾走査とセッション開始時刻照合による配列破壊バグの解消
- [x] `GameOverResolver.test.js` に各種死因・探索モード判定の網羅的回帰テストを追加

### フェーズ 2: 攻撃エフェクト（ATTACK_HIT）の条件厳格化 【完了】
- [x] `src/core/knowledge/GKLPlugin.js` の方向キー入力部（705行付近）および `executeAction`（1790行付近）に `_isPlayerDead` ガードを追加
- [x] 店主・平和的NPC（`isPeaceful` / `peaceful`）に対する事前エフェクト発火の抑止条件を追加
- [x] `src/core/knowledge/__tests__/GKLPlugin.test.js` に誤爆抑止のテストケースを追加
- [x] `npx vitest run src/core/knowledge/__tests__/GKLPlugin.test.js` で通過を確認

### フェーズ 3: 信託（Oracle）テキストウィンドウ検知と冒険手帳アンロック 【完了】
- [x] テキストウィンドウ（`putstr` / `TextWindowManager`）の出力テキストを `GKLPlugin` 経由で `LoreDetector` へ流すパイプラインを実装
- [x] 複数行・改行コード（`\r`）を含む信託テキストの正規化処理を実装
- [x] `src/core/knowledge/lore/LoreDetector.test.js` および `GKLPlugin.test.js` にテキストウィンドウ経由の信託アンロックテストを追加
- [x] `record_scenario/Oracles_1791173139967.json` のシナリオデータを用いたリプレイ検証を行い、神託が確実に冒険手帳にアンロックされることを実証

### フェーズ 4: 全体リグレッションテストとダッシュボード更新 【完了】
- [x] `npm test`（または `npx vitest run`）で全テストスイートの 100% PASS を確認（全125スイート・1,566テスト通過）
- [x] 各クライアント（gkl-pure-js-client 等）の実機死因・ランキング動作確認および `tools/scoreboard.html` 新設
- [x] `docs/ROADMAP.md` のステータスを更新（Living Specs 昇格完了）
