---
title: official_shim_direct_binding_implementation_plan
status: implemented
last_updated: 2026-10-29
related_code:
  - C:\Users\e3-sh\Desktop\works\NetHack-NetHack-5.0_org\NetHack-NetHack-5.0.1_Oct7_2026 (公式ソース最新原本)
  - src/driver/shim/shim_bridge.c (WebUIリポジトリ管理の単一窓口ブリッジ正本・ビルド時 win/shim/shim_bridge.c へ自動同期)
  - scripts/build_wasm_50.ps1 (自動ビルドスクリプト)
  - src/driver/NetHackWasmDriver.js
  - src/driver/NetHackWasmWorkerBridge.js
  - src/driver/nethack.worker.js
  - src/driver/NetHackMemory.js
  - src/core/knowledge/services/WasmDirectBindingService.js
---

# 📋 公式Shim構造化バインディング＆直接メモリ直結 実装計画書 (完全版)
## (Phase 8: Unified Dispatcher Bridge & Zero-Overhead Memory Access)

---

## 1. 計画概要とアーキテクチャ哲学

### 1.1 目的
従来の「テキストメッセージの正規表現パース」および「画面非表示での自動キー送信（サイレントマクロ）」に依存していたゲーム内情報取得（コンテナ重量、装備・内在耐性、祈りクールダウン/神の怒り、床の罠・施錠、モンスターHP・友好度・状態異常、呪文一覧、スキル熟練度、アイテム鑑定図鑑・外見シャッフル配列等）を、**公式コード非侵襲の単一汎用ディスパッチャー窓口（`shim_bridge_call`）を用いた「構造化データ直結」へ完全移行**します。

### 1.2 達成目標と設計原則（再ビルドゼロ・完全固定化）
1. **公式NetHackコード完全非侵襲（0行改変）**:
   - `win/shim/winshim.c` を含む公式NetHack Cソースコードには **一切手を加えない**。
   - WebUIリポジトリ内の **`src/driver/shim/shim_bridge.c`** を単一正本として管理し、ビルドスクリプト（`scripts/build_wasm_50.ps1`）実行時に `win/shim/shim_bridge.c` へ自動同期・リンクする構成とする。
2. **単一汎用窓口ディスパッチャー ＆ 再ビルド完全固定化**:
   - 個別C関数（`_weight`, `_inv_weight` 等）の直接エクスポートは一切行わず、Unixの `ioctl` やシステムコールのように、**`shim_bridge_call(cmd, arg1, arg2, buf, len)` という単一の窓口関数のみをエクスポート**する（`-sEXPORTED_FUNCTIONS=['_main','_shim_graphics_set_callback','_malloc','_free','_shim_bridge_call']`）。
   - 各マネージャーが将来必要とする全領域（地形・罠・部屋・モンスター・プレイヤー・所持品一括ダンプ・装備・呪文・スキル・図鑑・外見シャッフルインデックス）を網羅したコマンド体系を実装。
   - **究極の保険（シンボルポインタ開示 `0x70`）**: 万が一将来C側に未想定のフィールドが必要になった場合でも、主要構造体の基底アドレス（`&u`, `&gi.invent`, `&svl.level` 等）を直接取得してJS側からメモリ直読可能。これにより**Cコードの修正および再ビルドは原則不要**となる。
3. **責務の完全分離 ＆ 重複実装防止（グリフ判定 vs メモリ直結の責任境界）**:
   - 既存の `glyphClassifier.js` で既に 100% 判明している情報（ペット `GLYPH_PET_OFF`、祭壇の属性、玉座、PileTop等）はそのまま活かす。
   - **メモリ直結は「グリフでは絶対に不可視な真実」のみに特化**:
     - 敵・アイテム下の「真の床（`levl.typ`）」
     - 扉の「施錠・罠（`levl.flags`）」および床の「罠の種類・発見状態（`t_at(x, y)`）」
     - 部屋・店舗の真の種別（`svr.rooms` の武器屋、寺院、動物園等）
     - モンスターの「友好/ペット/HP/状態異常/店主・僧侶」
     - 「ブランチID」「お祈り残りターン ＆ 神の怒り」「真の重量・装備スロット」「呪文・スキル・図鑑」
4. **全サイレントマクロの完全撤廃によるモダンRPG化**:
   - Far Look（`;`）、Discoveries（`\`）、Enhance（`#enhance`）、Spells（`Z`/`+`）、Attributes（`#attributes`）などの裏マクロ・テキストパースを完全撤廃。
   - ラグ・画面チラつき・誤爆が一切ない、100%同期の次世代WebUIを実現。

### 1.3 新たに判明したアーキテクチャ課題：Web Worker 隔離環境の壁と真の調停
1. **ブラウザ実稼働環境の実態（スレッド隔離）**:
   - 単体テスト（Node.js/Vitest）では単一スレッド上で仮想モックを注入していたため直接メモリ直結（`driver.memory`）が成立していたが、**実際のブラウザ環境（PureJS, Vue, React 等）では NetHack Wasm と `NetHackMemory` は Web Worker (`nethack.worker.js`) 内で完全に隔離実行**されている。
   - メインスレッド側の `core.driver` は `NetHackWasmWorkerBridge` であり、ヒープメモリ（TypedArray）への直接ポインタ参照は存在しない（`driver.memory` は undefined）。
2. **責務境界の崩壊と反省（過去の歪みの是正）**:
   - 過去に「Worker 側からデータを手っ取り早く送りたい」という理由で、原本の `curs` イベントに `cellInfo` を同梱させたり、Driver/Worker に個別ドメイン処理を持たせようとする設計の迷走が発生した。
   - **Driver / Worker はゲームルールやドメイン知識を一切持たない純粋な通信インフラ（手足）に徹するべき**であり、ゲーム知識の解釈・判断は 100% メインスレッドの GKL（頭脳）が担う大原則を再確立する。
3. **解決方針：ターン確定時の正規調停システム (`queueSequence` 型の非同期同期)**:
   - Wasm コアが 1 ターンの演算を終えて静止確定する唯一のタイミングは **`state === 'WAITING_INPUT' && isTopLevelTurn === true`** である。
   - `queueSequence` が Promise でトークンを消費してバッファを回収するように、メインスレッド（GKL）主導で Worker 内の `shim_bridge_call` を呼び出し、構造化された確定データを 1 往復の非同期通信で安全に受け取る調停プロトコルを構築する。

---

## 2. 責任境界マトリクス (グリフ処理 vs メモリ直結)

実装時の重複実装・抜け漏れを防止するための単一の正解（SSOT）です。

| 対象エンティティ | 既存グリフで判定（glyphClassifier） | メモリ直結で取得（shim_bridge_call） | 役割とプレイヤー体験への効果 |
| :--- | :--- | :--- | :--- |
| **モンスター (生物)** | ペット (766〜1531)<br>不可視 (1532)<br>モンスター種別 (monOffset) | **友好・NPC (`mpeaceful`)**<br>**HP/最大HP (`mhp`/`mhpmax`)**<br>**状態異常 (睡眠/逃走/麻痺)**<br>**店主・僧侶フラグ (`isshk`/`ispriest`)** | 視界に入った瞬間に NPC / 敵を自動識別（Look不要）。HPゲージ表示。睡眠中の敵への不用意な接近防止。店主の誤攻撃を完全防止。 |
| **地形 (セル・部屋)** | 通常の床・壁・ドア・水・溶岩<br>祭壇の属性 (4006〜4010)<br>玉座・泉・シンク・墓石<br>階段の向き (上り/下り/梯子) | **真の床 (`levl.typ`)**<br>**扉施錠・罠 (`levl.flags`)**<br>**床の罠 (`t_at`)**<br>**部屋/店舗種別 (`svr.rooms`)**<br>**刻み文字 (`engr_at`)** | 仮床推測（3992番）完全撤廃。<br>扉前のワンタップで解錠提示。<br>床の罠・店舗名（武器屋・寺院等）・Elbereth安全状態を即座に判定。 |
| **アイテム・インベントリ** | アイテムカテゴリ・種別 (onum)<br>山積み PileTop (7992〜) | **全所持品 (`gi.invent`)**<br>**全装備品 (`uwep`, `uarm`等)**<br>**真の重量 (`weight`)**<br>**祭壇判明BUC (`bknown`)** | メニューを開かずに常時正確なインベントリ同期と所持重量・装備状況を把握。鞄の補正重量も完全自動計算。 |
| **自キャラ / ダンジョン** | なし（ステータス行は Dlvl のみ） | **ブランチID (`u.uz.dnum`)**<br>**お祈りターン (`ublesscnt`)**<br>**神の怒り (`ugangr`)**<br>**信仰値 (`ualign.record`)**<br>**内在耐性 (`uprops`)**<br>**全踏破履歴・メモ (`svm.mapseenchn`)** | 階層キャッシュの完全分離（`branch:dlvl`）。神の怒りを加味した推測誤差ゼロの絶対安全お祈りインジケーター。耐性カードの即時表示。<br>過去全フロアの施設（祭壇・店・泉・シンク）と `#annotate` メモの一括取得（自前キャッシュ全廃）。 |
| **呪文・スキル・図鑑** | なし（メニュー画面のみ） | **習得呪文配列 (`svs.spl_book`)**<br>**スキル熟練度 (`u.weapon_skills`)**<br>**発見・鑑定済図鑑 (`objects[].oc_name_known`)** | キーマクロによるウィンドウ展開を完全撤廃。常時最新の呪文パレット・スキル画面・ネタバレ防止マスクを0ms同期。 |

---

## 3. 単一汎用ブリッジ完全版設計 (`src/driver/shim/shim_bridge.c`)

公式ソースコードには一切触れず、WebUIリポジトリ内の `src/driver/shim/shim_bridge.c` を正本として管理し、ビルド時に `win/shim/shim_bridge.c` へ自動同期・リンクします。

```c
/* src/driver/shim/shim_bridge.c
 * GKL 専用 統合ディスパッチャーブリッジ (再ビルドゼロ・完全版)
 * 公式NetHack 5.0 完全非侵襲・独立エクステンション
 */
#include "hack.h"

/* コマンドID定義 (GKLとCで共有するEnum) */
enum ShimBridgeCmd {
    /* 1. 地形・マップ・部屋系 (0x10〜0x1F) */
    SHIM_CMD_GET_CELL_INFO      = 0x10, /* a1=x, a2=y -> typ(8) | flags(8) | lit(1) | roomno(8) */
    SHIM_CMD_DUMP_LEVEL_TERRAIN = 0x11, /* buf=先頭ポインタ, len=80*21 -> 全フロアtyp一括コピー */
    SHIM_CMD_GET_TRAP_AT        = 0x12, /* a1=x, a2=y -> ttyp(8) | tseen(1) | once(1) (不在時 0) */
    SHIM_CMD_GET_ENGRAVING_AT   = 0x13, /* a1=x, a2=y, buf=char*, len=max -> 文字列コピー (返値: type) */
    SHIM_CMD_GET_ROOM_TYPE      = 0x14, /* a1=roomno -> rtype (SHOP, TEMPLE, ZOO, VAULT等) */

    /* 2. マップ上のエンティティ系 (0x20〜0x2F) */
    SHIM_CMD_GET_OBJECT_AT          = 0x20, /* a1=x, a2=y -> 先頭 struct obj* */
    SHIM_CMD_GET_MONSTER_AT         = 0x21, /* a1=x, a2=y -> struct monst* */
    SHIM_CMD_GET_MONSTER_INFO       = 0x22, /* a1=x, a2=y -> mpeaceful(1) | mtame(1) | 予約(6) | mhp(12) | mhpmax(12) */
    SHIM_CMD_GET_MONSTER_STATE      = 0x23, /* a1=x, a2=y -> msleeping(1) | mflee(1) | mcanmove(1) | isshk(1) | ispriest(1) */
    SHIM_CMD_DUMP_VISIBLE_MONSTERS  = 0x24, /* buf=int32[256*8] -> 視界内モンスター一括ダンプ */
    SHIM_CMD_GET_MVITALS_DIED       = 0x25, /* a1=mnum -> mvitals[mnum].died (撃破数) */

    /* 3. プレイヤー状態・ダンジョン系 (0x30〜0x3F) */
    SHIM_CMD_GET_PLAYER_SUMMARY = 0x30, /* buf=long[8] -> [dnum, dlevel, ublesscnt, ugangr, uluck, ualign_record, uhunger, moves] */
    SHIM_CMD_GET_PLAYER_PTR     = 0x31, /* -> &u */
    SHIM_CMD_GET_PLAYER_PROPS   = 0x32, /* buf=long[LAST_PROP+1] -> uprops (耐性・能力配列一括コピー) */
    SHIM_CMD_DUMP_MAPSEEN       = 0x34, /* buf=MapseenDumpEntry[], len=max -> 全踏破階層・施設・#annotate メモ一括ダンプ */

    /* 4. インベントリ・装備・アイテム系 (0x40〜0x4F) */
    SHIM_CMD_GET_INVENT_PTR     = 0x40, /* -> gi.invent (所持品リンクリスト先頭) */
    SHIM_CMD_GET_EQUIPMENT_PTRS = 0x41, /* buf=long[14] -> [uwep, uswapwep, uquiver, uarm, uarmc, uarmh, uarms, uarmg, uarmf, uarmu, uamul, uleft, uright, ublindf] */
    SHIM_CMD_DUMP_OBJECT_INFO   = 0x42, /* a1=obj*, buf=long[8] -> [otyp, owt, quan, spe, oclass, invlet, flags, weight] */
    SHIM_CMD_DUMP_ALL_INVENT    = 0x43, /* buf=long[max*12], len=max_bytes -> 全所持品の一括ダンプ (返値: 件数) */

    /* 5. 呪文・スキル系 (0x50〜0x5F) */
    SHIM_CMD_DUMP_SPELL_BOOK    = 0x50, /* buf=int[(MAXSPELL+1)*3] -> [sp_id, sp_lev, sp_know] の3つ組配列 */
    SHIM_CMD_DUMP_SKILLS        = 0x51, /* buf=int[P_NUM_SKILLS*2] -> [skill, max_skill] 配列 (返値: weapon_slots) */

    /* 6. 発見・鑑定図鑑系 (0x60〜0x6F) */
    SHIM_CMD_DUMP_DISCOVERIES   = 0x60, /* buf=unsigned char[NUM_OBJECTS+1] -> oc_name_known 配列一括コピー */
    SHIM_CMD_GET_OBJECT_UNAME   = 0x61, /* a1=otyp, buf=char*, len=max -> oc_uname (仮名) コピー */
    SHIM_CMD_DUMP_DESCR_INDEXES = 0x62, /* buf=int[NUM_OBJECTS+1] -> oc_descr_idx (シャッフル外見インデックス) 一括コピー */

    /* 7. 究極の保険：シンボル基底ポインタ直接取得 (0x70〜) */
    SHIM_CMD_GET_SYMBOL_PTR     = 0x70, /* a1=sym_id -> 各種主要構造体の基底アドレス */
};
```

> ※完全な実装コードは [`src/driver/shim/shim_bridge.c`](../../src/driver/shim/shim_bridge.c) を参照してください。

### 3.1 モンスター情報取得 (`SHIM_CMD_GET_MONSTER_INFO` 0x22) の 32bit パッキング仕様 ＆ 符号反転対策

C コアと JS (GKL) 間の通信オーバーヘッドを極小化するため、`0x22` は 1 回の 32bit long 戻り値でモンスターの友好度・ペット状態・HP・最大HPをパッキングして返却します。

#### ① ビットレイアウト
| ビット位置 | 幅 | 意味 | 範囲・説明 |
| :--- | :---: | :--- | :--- |
| **bit 0** | 1 bit | `mpeaceful` (友好フラグ) | `0`: 敵対 / `1`: 友好 |
| **bit 1** | 1 bit | `mtame` (ペットフラグ) | `0`: 野生 / `1`: ペット |
| **bit 2..7** | 6 bits | 予約ビット (Reserved) | 常に `0` (安全検証用 `0xFC`) |
| **bit 8..19** | 12 bits | `hp` (現在HP) | `0..4095` (0xFFFU 安全クランプ) |
| **bit 20..31** | 12 bits | `hpmax` (最大HP) | `0..4095` (0xFFFU 安全クランプ) |

#### ② C 側 (shim_bridge.c) の安全パッキング
```c
case SHIM_CMD_GET_MONSTER_INFO: {
    int x = (int) arg1, y = (int) arg2;
    if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) return -1;
    struct monst *m = svl.level.monsters[x][y];
    if (!m) return 0;
    uint32_t hp = m->mhp > 0 ? ((uint32_t) m->mhp > 0xFFFU ? 0xFFFU : (uint32_t) m->mhp) : 0U;
    uint32_t hpmax = m->mhpmax > 0 ? ((uint32_t) m->mhpmax > 0xFFFU ? 0xFFFU : (uint32_t) m->mhpmax) : 0U;
    uint32_t packed = (m->mpeaceful ? 1U : 0U)
                    | ((m->mtame ? 1U : 0U) << 1)
                    | (hp << 8)
                    | (hpmax << 20);
    return (long) packed;
}
```

#### ③ wasm32 符号反転と JS 側 (MonsterWasmAdapter.js) の符号なし解釈
- **課題（符号反転問題）**:
  - wasm32 では C の `long` 型戻り値が符号付き 32bit 整数（Signed 32-bit Integer）として JavaScript に渡されます。
  - `hpmax >= 2048 (0x800)` となる高 HP モンスター（上級ドラゴン、魔王等）では最上位ビット（bit 31）が立つため、JavaScript 側で負数（例: `-1073741824` 等）となり、従来の単純な `res <= 0` 判定では「モンスター不在またはエラー」と誤判定されて情報が消失するバグがありました。
- **解決策 (`unpackMonsterInfo`)**:
  - 純粋関数 `unpackMonsterInfo(res)` を導入。
  - 不在 (`res === 0`)、範囲外エラー (`res === -1`)、および予約ビット不正 (`(res & 0xFC) !== 0`) のみを `null` として除外。
  - `const u = res >>> 0;` により符号なし 32bit 整数にキャストした上で、ゼロ埋め右シフト (`>>> 8`, `>>> 20`) を用いて安全にアンパックします：
    ```javascript
    export function unpackMonsterInfo(res) {
        if (typeof res !== 'number' || res === 0 || res === -1 || (res & 0xFC) !== 0) {
            return null;
        }
        const u = res >>> 0;
        return {
            peaceful: Boolean(u & 0x01),
            tame: Boolean((u >>> 1) & 0x01),
            hp: (u >>> 8) & 0xFFF,
            hpmax: (u >>> 20) & 0xFFF
        };
    }
    ```

---

## 4. システムレイヤー別 設計・接続仕様 (Web Worker 隔離調停対応)

```mermaid
flowchart TD
    subgraph WorkerThread ["【Web Worker 隔離スレッド (nethack.worker.js)】"]
        subgraph BuildLayer ["1. Cコア・ビルド層 (Build Layer: 0% Intrusion)"]
            Bridge["src/driver/shim/shim_bridge.c\n(単一公式窓口: _shim_bridge_call)"]
            WASM["nethack.wasm / nethack.js\n(NetHack 5.0.1 Cコア生データ)"]
            Bridge --> WASM
        end

        subgraph WorkerDriver ["2. Worker Driver層 (Pure Transport / 手足)"]
            NHM["NetHackMemory.js\n・bridgeCall(cmd, a1, a2, buf, len)\n(メモリ/ポインタ読み出し透過ゲートウェイ)"]
            WorkerHost["nethack.worker.js\n・CALL_SHIM メッセージ受信\n・bridgeCall 実行 ＆ バッファ返却\n(※ドメイン知識は一切持たない)"]
            
            WASM <-->|"_shim_bridge_call"| NHM
            NHM <--> WorkerHost
        end
    end

    WorkerHost <==|"postMessage 非同期調停 (queueSequence と同等の 1往復 Promise)"| BridgeClient

    subgraph MainThread ["【メインスレッド (ブラウザ実行環境)】"]
        subgraph DriverBridgeLayer ["3. メイン側 Bridge層 (Pure Transport / 手足)"]
            BridgeClient["NetHackWasmWorkerBridge.js\n・callShim(cmd, a1, a2, bufLen, bufType)\n・_pendingShimCalls (Map による Promise 管理)"]
        end

        subgraph GKLLayer ["4. ナレッジ層 (GKL: Unified Domain & 頭脳)"]
            GKL_Service["WasmDirectBindingService.js\n・SHIM_CMD 定数管理\n・Bridge 経由の非同期 callShim 呼び出し\n・C 構造体バイナリのオブジェクト化 (POJO)\n・getCellInfo / getInventory / dumpLevelTerrain 等のドメインAPI提供"]
            
            BridgeClient <--> GKL_Service
            
            StateArea["AreaStateManager\n(真の床・フロア80x21地形・施錠・罠・部屋判定)"]
            ContextAct["ActionSignalResolver\n(平和/攻撃・解錠・罠解除)"]
            StateAttr["AttributeStateManager\n(耐性・お祈り・怒り同期)"]
            StateInv["InventoryStateManager & EncumbranceStateManager\n(所持品・装備スロット・真の総重量同期)"]
            StateSpell["SpellStateManager\n(習得呪文・残ターン同期)"]
            StateSkill["SkillStateManager\n(スキル熟練度同期)"]
            StateDisc["DiscoveryStateManager\n(鑑定図鑑・外見シャッフル配列・仮名同期)"]
            BranchTrk["BranchTracker\n(dnum によるブランチ同定)"]
            
            GKL_Service --> StateArea & ContextAct & StateAttr & StateInv & StateSpell & StateSkill & StateDisc & BranchTrk
        end

        subgraph FacadeLayer ["5. 統合・UI層 (SituationCache & Client UI)"]
            SC["SituationCache\n(完全互換 SSOT)"]
            StateArea & ContextAct & StateAttr & StateInv & StateSpell & StateSkill & StateDisc & BranchTrk --> SC
            UI["Client UI (HUD, パレット, ナレッジカード, 演出)\n【誤爆ゼロ・裏マクロゼロ・100%即時反映】"]
            SC --> UI
        end
    end
```

### 4.1 通信・調停プロトコル仕様 (`NetHackWasmWorkerBridge` ↔ `nethack.worker.js`)
- **呼出側（メインスレッド）**:
  - `bridge.callShim(cmd, arg1 = 0, arg2 = 0, bufferSize = 0, bufferType = 'int32')`
  - ユニークな `callId` を発番し、`this._pendingShimCalls.set(callId, { resolve, reject })` で登録。
  - Worker へ `{ type: 'CALL_SHIM', callId, payload: { cmd, arg1, arg2, bufferSize, bufferType } }` を送信。
- **実行側（Workerスレッド）**:
  - Driver/Worker はゲームルールの意味を一切解釈しない。
  - `NetHackMemory.bridgeCall(cmd, arg1, arg2, bufPtr, bufferSize)` を実行。
  - 戻り値（数値）および確保バッファ（`int32` / `uint8` / `string`）を `{ type: 'SHIM_RESULT', callId, result, buffer }` として `postMessage` で即時返却。
- **解決側（メインスレッド）**:
  - `callId` をキーに Promise を解決。
  - メインスレッド側の `WasmDirectBindingService` がバッファバイナリを解読し、UI/GKL向けドメインオブジェクト（アイテム、セル情報、地形配列、外見インデックス配列等）を構築。
- **ターン静止確定時の調停フロー**:
  - `stateChange (WAITING_INPUT)` かつ `isTopLevelTurn === true` になったタイミングで GKL が最新状態を要求し、UI へ確定状態を展開。

---

## 5. 段階的マイグレーション・タスクリスト (Task List)

### 【Stage 8.1】完全版ブリッジ配備 ＆ ビルド固定化・Driverゲートウェイ整備（完了）
- [x] `src/driver/shim/shim_bridge.c` を作成（全カテゴリ網羅＋シンボルポインタ開示完全版）
- [x] `scripts/build_wasm_50.ps1` を更新：
  - `$NH_ROOT` の対象を `NetHack-NetHack-5.0.1_Oct7_2026` に設定
  - `src/driver/shim/shim_bridge.c` を `win/shim/shim_bridge.c` へ自動同期し `$wasm_sys_src` に追記
  - `-sEXPORTED_FUNCTIONS` を `['_main','_shim_graphics_set_callback','_malloc','_free','_shim_bridge_call']` の単一窓口へ統一
- [x] `scripts/build_wasm_50.ps1` を実行し、成果物（`nethack.js`, `nethack.wasm`, `tilemappings.lst`）を WebUI へデプロイ
- [x] `src/driver/NetHackMemory.js` に `bridgeCall(cmd, arg1, arg2, buf, len)` を実装

### 【Stage 8.2-A】Web Worker 隔離調停プロトコルの設計・配備（完了）
- [x] **ライフサイクル観察の完了**（ターン待ち `WAITING_INPUT && isTopLevelTurn` での静止確定を確認）
- [x] **Driver 側調停システムの設計**:
  - `NetHackWasmWorkerBridge` ↔ `nethack.worker.js` 間に、`queueSequence` と等価な非同期通信プロトコル（`CALL_SHIM` / `SHIM_RESULT`）を整備。
  - Driver/Worker はドメイン知識を持たない「純粋な透過的プロキシ（手足）」に徹し、GKL が主導してデータを要求・解釈する責務境界を徹底。
- [x] **最小単位 PoC の検証**:
  - Worker 隔離環境下で `bridgeCall` を非同期 1 往復で実行し、構造化データがメインスレッドに安全に届くことを実証（単体テスト・結合テスト完備）。

### 【Stage 8.2-B】inspector_console 連携型 公式Shim直接調停 ＆ フォールバック検証環境の構築（完了）
- [x] 設計書策定・アーカイブ済: [direct_binding_verification_environment_plan.md](./archive/direct_binding_verification_environment_plan.md)
- [x] GKL / StateManager への動作モード (`directBindingMode: 'auto' | 'strict' | 'fallback'`) 実装
- [x] `InventoryStateManager`: 直近同期方式 (`lastSyncMethod: 'SHIM' | 'MACRO'`) 記録 ＆ `strict` 時のマクロ完全ブロック
- [x] `AreaStateManager`: 直近足元同期方式 (`lastFloorMethod: 'SHIM' | 'INFERRED'`) 記録 ＆ `strict` 時の推測床（3992番）完全ブロック
- [x] `DebugInspector.js`: `broadcastState()` スナップショットへの同期方式・ランプ状態同梱 ＆ `BroadcastChannel` 切替コマンド受信対応
- [x] `inspector_console.html`:
  - ヘッダーへの「所持品同期方式ランプ (🟢SHIM vs 🔵MACRO)」および「足元床ランプ (🟢SHIM vs 🟡INFERRED)」新設
  - Direct Injector / ヘッダーからのリアルタイムモード切替ボタングループ配備
- [x] 自動テスト（`DirectBindingVerificationEnvironment.test.js`）による `strict` モード下の完全動作検証

### 【Stage 8.2-C】インベントリ・装備スロット・コンテナ重量の隔離環境直結（完了）
- [x] `WasmDirectBindingService.js` を Worker 隔離環境に対応（WorkerBridge 経由の調停サポート、`hasLiveMemory` とキャッシュ透過アクセサ完備）
- [x] `SHIM_CMD_DUMP_ALL_INVENT (0x43)` および `SHIM_CMD_DUMP_OBJECT_INFO (0x42)` により、`InventoryStateManager` の全所持品走査をブラウザ実機で一括直結（キー送信マクロバイパス確認）
- [x] `SHIM_CMD_GET_EQUIPMENT_PTRS (0x41)` により、全14装備スロット（武器・防具・指輪等）の装着状態を即時同期
- [x] `EncumbranceStateManager.js` に重量直結（`getInventoryWeight()`）を配備し、鞄補正・金貨込みの真の所持重量を反映
- [x] 地面に落ちているアイテムの取得・BUC 判定（`SHIM_CMD_GET_OBJECT_AT` 0x20）を実装

### 【Stage 8.3-A】真の地形・床の罠・店舗種別・刻み文字 ＆ モンスター詳細直結（完了）
- [x] `AreaStateManager.js`:
  - `SHIM_CMD_GET_CELL_INFO (0x10)` により足元の真の床を即時確定（仮床推測 3992 番バイパス確認）
  - `SHIM_CMD_DUMP_LEVEL_TERRAIN (0x11)` によりフロア全域 (80×21) の真の地形・階段を一括ダンプし、`stairCache` 描画依存をスリム化
  - `SHIM_CMD_GET_TRAP_AT (0x12)` により床の罠（ピット・落とし穴等）を100%同定
  - `SHIM_CMD_GET_ROOM_TYPE (0x14)` により武器屋・寺院・動物園等の部屋種別を判定
  - `SHIM_CMD_GET_ENGRAVING_AT (0x13)` により Elbereth の有効性を即座に判定
- [x] `ActionSignalResolver.js` / `ContextActionEngine.js`:
  - 扉の `flags`（`D_LOCKED` / `D_TRAPPED`）から最適な解錠・罠解除アクションを即時導出（罠なし扉への `#untrap` 誤表示を根絶）
  - `SHIM_CMD_GET_MONSTER_INFO (0x22)` / `GET_MONSTER_STATE (0x23)` により、友好 (`mpeaceful`)/ペット (`mtame`)、HPゲージ、睡眠/逃走/麻痺/店主を判別し誤攻撃・攻撃FX誤爆を完全防止

### 【Stage 8.3-B】モジュール分割基盤整備 ＆ Shim-Driven 確定同期型レンダリング・パイプライン刷新（進行中）
- [x] **【先行着手 1】ROADMAP 2.1**: GKL Pure JS Client (`main.js` 2,364行 ➔ 618行) のモジュール分割完了（[gkl_client_modularization_plan.ja.md](../2_client_ui/archive/gkl_client_modularization_plan.ja.md)）
- [ ] **【先行着手 2】ROADMAP 2.2**: `GKLPlugin.js` モジュール分割（`GKLEventRouter`, `SilentSyncCoordinator`, `GKLFxCoordinator` 等の分離：[GKLPlugin_Modularization_and_Refactoring_Architecture.ja.md](../3_gkl/GKLPlugin_Modularization_and_Refactoring_Architecture.ja.md)）
- [ ] **確定同期型レンダリング刷新**: ターン同期ライフサイクル (Sync Barrier) の導入と `VirtualDungeonScreen` / `MainViewportRenderer` の Commit 駆動型確定描画制御（[shim_driven_rendering_pipeline_architecture.ja.md](../2_client_ui/shim_driven_rendering_pipeline_architecture.ja.md)）

### 【Stage 8.4】プレイヤー完全ステータス・呪文・スキル・鑑定図鑑直結（一部完了・進行中）
- [x] `SHIM_CMD_DUMP_DISCOVERIES (0x60)` ＆ `SHIM_CMD_DUMP_DESCR_INDEXES (0x62)`: `DiscoveryStateManager` の `\` パース依存を解消し、鑑定図鑑（`oc_name_known`）および外見シャッフル配列（`oc_descr_idx`）を即時同期
- [x] `SHIM_CMD_GET_PLAYER_SUMMARY (0x30)`:
  - `dnum` による全9ブランチ同定（`branch:dlvl` キャッシュ分離と `AREA_ENTERED` 発火）
  - `ublesscnt` と `ugangr`（神の怒り）から絶対安全お祈りインジケーターを構築
  - `uhunger`（空腹度真値）の反映
- [x] `SHIM_CMD_GET_MONSTER_INFO (0x22)` 符号反転対応 ＆ `DUMP_VISIBLE_MONSTERS (0x24)` / `GET_MVITALS_DIED (0x25)`:
  - HP/HPMAX の 12bit 安全クランプと `unpackMonsterInfo` による 32bit 符号なしアンパック
  - 視界内モンスター HP 差分検出による `DAMAGE_DEALT` 発行基盤
- [ ] `SHIM_CMD_GET_PLAYER_PROPS (0x32)`: 耐性配列（`uprops`）を `AttributeStateManager` へ注入
- [ ] `SHIM_CMD_GET_PLAYER_PROPS (0x32)`: 耐性配列（`uprops`）を `AttributeStateManager` へ注入
- [ ] `SHIM_CMD_DUMP_SPELL_BOOK (0x50)`: `SpellStateManager` のメニューパースを撤廃し、習得呪文を0ms同期
- [ ] `SHIM_CMD_DUMP_SKILLS (0x51)`: `SkillStateManager` の `#enhance` パースを撤廃し、スキル熟練度を即時同期

