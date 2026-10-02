# 🎮 GamePad 右ホイール・ボタンセット切替構想 (Radial Button Set Switching Concept)

**作成日**: 2026-10-01  
**ステータス**: `💡 proposed` (将来の実証実験構想 / PoC候補)  
**関連モジュール**: `GamepadInputController`, `GamepadManager`, `NhGamepadGuideBar`, `ContextActionEngine`  
**実験検証環境**: `examples/console-client/` (`tools/cltest.html` 経由)

---

## 1. 背景と課題

NetHack におけるゲームパッド操作では、ボタン数が限られているため以下のような課題が存在する：

1. **固定ボタンアサインの非効率性**:
   - 例えば「Xボタン＝投てき」と固定してしまうと、弓や飛び道具を持たない職業・序盤ではXボタンが死にボタン化する。
2. **単発コマンドホイール選択の操作負荷**:
   - 右ホイール（ラジアルメニュー）で「飲む」「食べる」「杖を振る」などの単発アクションを毎回スティックを倒して選ぶのは、ターン制とはいえ操作テンポが損なわれやすい。

---

## 2. コアコンセプト：ホイールによる「ボタンセット（スタンス）」切替

**「右ホイールで単発コマンドを選ぶ」のではなく、「右ホイールで『ボタンセット（スタンス／モード）』を切り替え、手元のボタン（A/X等）で軽快に連打・実行する」** というUXモデル。

- アクションRPGのスタイルチェンジやFPSの武器スワップのように、右スティックを「クイッ」と倒すだけでプレイスタイルそのものを瞬時にスイッチする。
- 親指をボタン群（A/B/X/Y）に置いたまま、直感的に行動を切り替えることができる。

---

## 3. ボタンセットの構成例（4方向 / 8方向）

### 基本4方向スタンス構成

| ホイール方向 | スタンス / セット名 | A ボタン (Primary) | X ボタン (Secondary) | 適用シーン |
| :---: | :--- | :--- | :--- | :--- |
| **⬆️ (上)** | **🔍 探索セット (Exploration)** | 🚪 扉開閉 / 階段昇降 / 拾う | 🕵️ 周囲の探査・罠探し (`s`) | ダンジョン内の通常歩行時 |
| **➡️ (右)** | **🏹 射撃・投てきセット (Ranged)** | 🎯 弓矢・スリング発射 (`f`) | 🪓 飛び道具投てき (`t`) | 遠距離からモンスターが接近してきた時 |
| **⬇️ (下)** | **✨ 魔法・ワンドセット (Magic)** | 🪄 登録スペル詠唱 (`Z`) | ⚡ 装備ワンドを振る (`z`) | ピンチ時や特殊能力・遠隔攻撃時 |
| **⬅️ (左)** | **🛡️ 防御・戦術セット (Tactical)** | ✍️ 床へのElbereth刻み (`E`) | 🧪 緊急回復ポーション飲む (`q`) | 強敵に隣接された際の一時退避・延命時 |

※ Bボタンは全セット共通で「待機（1ターン: `.`）/ キャンセル」、Yボタンは「道具袋（インベントリ）」を維持。

---

## 4. UIガイダンスとの完全連動 (`<nh-gamepad-guide-bar>`)

右スティックを倒してセットを切り替えた瞬間、画面最下部のボタンガイドバー（`<nh-gamepad-guide-bar>`）の表示がリアルタイムに更新される：

- **⬆️ 探索時**:  
  `[探索] A: 足元・扉 | X: 探査(s) | B: 待機(1T) | Y: 道具袋 | R-Stick: セット切替`
- **➡️ 射撃時**:  
  `[射撃] A: 射撃(f) | X: 投てき(t) | B: 待機(1T) | Y: 道具袋 | R-Stick: セット切替`
- **⬇️ 魔法時**:  
  `[魔法] A: 詠唱(Z) | X: ワンド(z) | B: 待機(1T) | Y: 道具袋 | R-Stick: セット切替`
- **⬅️ 防御時**:  
  `[防御] A: Elbereth | X: 回復薬(q) | B: 待機(1T) | Y: 道具袋 | R-Stick: セット切替`

プレイヤーは画面下のガイドを見るだけで、今どのボタンを押せば何が起こるかを瞬時に把握でき、誤爆を防止できる。

---

## 5. 実装アーキテクチャ案

### `GamepadInputController.js` での管理構造

```javascript
class GamepadInputController {
  constructor(options) {
    // ...
    this._currentActionSet = 'EXPLORATION'; // 'EXPLORATION' | 'RANGED' | 'MAGIC' | 'TACTICAL'
    this._actionSets = {
      EXPLORATION: {
        name: '探索',
        A: { type: 'context_primary' }, // 扉や足元を優先
        X: { key: 's', label: '探査' }
      },
      RANGED: {
        name: '射撃',
        A: { key: 'f', label: '射撃' },
        X: { key: 't', label: '投てき' }
      },
      MAGIC: {
        name: '魔法',
        A: { key: 'Z', label: '詠唱' },
        X: { key: 'z', label: 'ワンド' }
      },
      TACTICAL: {
        name: '戦術',
        A: { key: 'E', label: 'Elbereth' },
        X: { key: 'q', label: '飲む' }
      }
    };
  }

  // 右スティック入力時のセット切替ハンドラ
  onRadialFlick(sector) {
    switch (sector) {
      case 'N': this.setActionSet('EXPLORATION'); break;
      case 'E': this.setActionSet('RANGED'); break;
      case 'S': this.setActionSet('MAGIC'); break;
      case 'W': this.setActionSet('TACTICAL'); break;
    }
  }
}
```

---

## 6. 実験・検証ロードマップ

再度ゲームパッド操作の実証実験を行いたくなった場合は、以下の手順で安全にPoCを実施可能：

1. `examples/console-client/` 内で上記 `actionSets` の切り替えプロトタイプを組む。
2. `tools/cltest.html` から `Gamepad Input Experimental Client` を起動して実機パッドで操作感をテスト。
3. 良好な結果が得られた場合、Nehww 等の本番UIや共通コンポーネントへ機能導入を検討。
