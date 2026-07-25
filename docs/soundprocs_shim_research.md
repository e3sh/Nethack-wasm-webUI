# NetHack 5.0 soundprocs アーキテクチャと WASM shim 拡張に関する技術考察・研究レポート

> [!NOTE]
> 本ドキュメントは、NetHack 5.0 C言語コアにおける統合サウンド機構 `soundprocs` の構造・仕様の解析結果、および現在実装済みのクライアント側メッセージフック方式（`usersounds` 互換）から、将来的な WASM shim ブリッジへの拡張手法・変更規模に関する技術的考察をまとめた研究レポートです。

---

## 1. 概要と目的

NetHack 5.0.0 正式版には C言語構造体ベースの統合サウンド機構（`soundprocs`）が導入されています。
本レポートでは、`soundprocs` の内部アーキテクチャ、イベントとアセットの割り当て機構を解明し、WebAssembly (WASM) ポートにおける直接的なサウンドイベントブリッジ（`shimsound`）の実現可能性と変更規模を整理・記録することを目的としています。

---

## 2. NetHack 5.0 C言語コアにおける `soundprocs` の仕様

### 2.1. 構造体設計 (`include/sndprocs.h`)
NetHack 5.0 のサウンド機構は、画面描画の `winprocs` と同様に、プラットフォーム独立なインターフェース構造体 `struct sound_procs` を介して呼び出されます。

```c
struct sound_procs {
    const char *soundname;              /* ライブラリ識別名 (例: "fmod", "windsound", "shimsound") */
    enum soundlib_ids soundlib_id;      /* ライブラリID enum */
    unsigned long sound_triggers;       /* 機能フラグ (SOUND_TRIGGER_xxx) */
    void (*sound_init_nhsound)(void);
    void (*sound_exit_nhsound)(const char *);
    void (*sound_achievement)(schar, schar, int32_t);
    void (*sound_soundeffect)(char *desc, int32_t seid, int32_t volume);
    void (*sound_hero_playnotes)(int32_t instrument, const char *str, int32_t volume);
    void (*sound_play_usersound)(char *filename, int32_t volume, int32_t idx);
    void (*sound_ambience)(int32_t ambience_action, int32_t ambienceid, int32_t proximity);
    void (*sound_verbal)(char *text, int32_t gender, int32_t tone, int32_t vol, int32_t moreinfo);
};
```

### 2.2. 6つのイベントトリガーカテゴリ

| トリガー種別 | C言語側の主要マクロ | 発生タイミングと概要 |
| :--- | :--- | :--- |
| **① `SOUNDEFFECTS`** | `Soundeffect(seid, vol)` | 罠発動、ドア破壊、モンスターの鳴き声（犬の吠え声、猫のニャー等）、魔法、爆発などのゲーム内事象。 |
| **② `USERSOUNDS`** | `Play_usersound(filename, vol, idx)` | 設定ファイル（`.nethackrc` / `sysconf`）で指定されたテキストパターンに応じた外部音声ファイル再生。 |
| **③ `HEROMUSIC`** | `Hero_playnotes(instrument, notes, vol)` | プレイヤーが楽器アイテム（フルート、ツノ、ハープ、ベル、太鼓等）を演奏した際の音符と楽器ID。 |
| **④ `ACHIEVEMENTS`** | `SoundAchievement(arg1, arg2, flags)` | レベルアップ、レベルダウン、新規ゲーム開始、ゲーム進行達成時のジングル。 |
| **⑤ `AMBIENCE`** | `sound_ambience(...)` | ダンジョン内の水流、溶岩、風の音などの環境BGM/環境音。 |
| **⑥ `VERBAL`** | `SoundSpeak(text)` | 神の声、神託（Oracle）、喋るアーティファクト、アクセシビリティ用音声読み上げ。 |

### 2.3. 音声ファイル・イベントの割り当て機構

1. **内蔵効果音 (`include/seffects.h`)**:
   `se_door_open`, `se_canine_bark`, `se_explosion` などの enum ID が 200 種類以上定義されており、Cコード側で `Soundeffect(se_door_open, 80)` を呼び出します。
2. **外部設定 (`usersounds`)**:
   `sysconf` 等の `SOUND=MESG "pattern" "filename" vol` の指定に従い、正規表現マッチ時に `soundprocs.sound_play_usersound()` が呼ばれます。
3. **楽器演奏 (`sound/wav/`)**:
   `sound_Wooden_Flute_A.wav` 〜 `G.wav` や `sound_Magic_Harp_A.wav` 〜 `G.wav` のように「楽器名 + 音階ノート (A〜G)」のアセットファイル群が用意されており、`Hero_playnotes()` に渡された MIDI 楽器 ID と音符文字列に応じて順次再生されます。

---

## 3. 現行 WebUI 実装（クライアント側メッセージフック方式）の評価

現在 WebUI に実装されている `SoundManager.js` は、WASM ビルド（C言語側）を一切変更せず、**「(2) `usersounds` 方式」のロジックを JavaScript 側で完全に再現・拡張したもの** です。

### 現行実装の特徴
* **フック対象**: `GameManager.js` における `shim_raw_print`, `shim_raw_print_bold`, `shim_putstr` から英語原文および日本語翻訳メッセージをキャプチャ。
* **ハイブリッド音色エンジン**: WAV/MP3 アセット再生と、アセット不要な `Beepcore` (8bit レトロシンセサイザー / Web Audio API オシレーター) の自動フォールバック。
* **独立ボリュームゲイン**: マスター音量 (`volume`) とは独立した `waveGain` (100%) および `beepGain` (30%) の調整により、WAV と Beep 混在時の物理音量バランスを最適化。

---

## 4. WASM `winshim.c` への `soundprocs` ブリッジ拡張の考察

将来の拡張研究テーマとして、C言語側から直接サウンドイベントを受け取る `shimsound` ブリッジを実装する場合の設計と変更規模のまとめです。

### 4.1. 必要な変更箇所とコード規模（合計 約 50〜80 行）

#### 1. `win/shim/winshim.c` （または新規 `sound/shimsound/shimsound.c`）
* **作業量**: 約 40 行
* **内容**: `soundprocs` のコールバック関数群と `shimsound_procs` 構造体インスタンスを記述。
```c
#ifdef SND_LIB_SHIMSOUND
VDECLCB(shim_sound_init_nhsound, (void), "v")
VDECLCB(shim_sound_exit_nhsound, (const char *reason), "vs", P2V reason)
VDECLCB(shim_sound_achievement, (schar ach1, schar ach2, int32_t flags), "v22i", A2P ach1, A2P ach2, A2P flags)
VDECLCB(shim_sound_soundeffect, (const char *desc, int32_t seid, int32_t vol), "vsii", P2V desc, A2P seid, A2P vol)
VDECLCB(shim_sound_hero_playnotes, (int32_t instrument, const char *str, int32_t vol), "visi", A2P instrument, P2V str, A2P vol)
VDECLCB(shim_sound_play_usersound, (const char *filename, int32_t vol, int32_t idx), "vsii", P2V filename, A2P vol, A2P idx)

struct sound_procs shimsound_procs = {
    SOUNDID(shimsound),
    SOUND_TRIGGER_USERSOUNDS | SOUND_TRIGGER_SOUNDEFFECTS | SOUND_TRIGGER_HEROMUSIC | SOUND_TRIGGER_ACHIEVEMENTS,
    shim_sound_init_nhsound, shim_sound_exit_nhsound, shim_sound_achievement,
    shim_sound_soundeffect, shim_sound_hero_playnotes, shim_sound_play_usersound, 0, 0
};
#endif
```

#### 2. `include/sndprocs.h` の更新
* **作業量**: 約 5 行
* **内容**: `enum soundlib_ids` に `soundlib_shimsound` を追加し、マクロ `#define SND_LIB_INTEGRATED` に `SND_LIB_SHIMSOUND` を定義。

#### 3. `src/sounds.c` (または `sys/share/syssound.c`)
* **作業量**: 約 5 行
* **内容**: `sound_init_nhsound()` 内で `soundprocs = shimsound_procs;` を割り当てる条件文を追加。

#### 4. Wasm ビルド環境 (`build_wasm_50.ps1` または `Makefile`)
* **作業量**: 1 行
* **内容**: Emscripten コンパイルフラグに `-DSND_LIB_SHIMSOUND` を追加。

---

### 4.2. JavaScript 側 (`SoundManager.js`) での受取イメージ

C言語側の改修・再ビルド後、JavaScript 側には以下の精密なイベントメッセージが直接届くようになります：

```javascript
// イベントハンドラー拡張例
case "shim_soundeffect": // args: [desc, seid, volume]
    SoundManager.playEffectById(args[1], args[2]);
    break;

case "shim_hero_playnotes": // args: [instrument, notes, volume]
    SoundManager.playInstrumentNotes(args[0], args[1], args[2]);
    break;
```

---

## 5. まとめ

1. **現行実装の優位性**:
   WASM の再ビルドや C コードの改修を行わないクライアント側メッセージフック（`usersounds`）方式は、保守性・安全性が極めて高く、現時点におけるベストソリューションです。
2. **将来の拡張性**:
   `winshim.c` および `soundprocs` の改修規模は実質 50〜80 行程度と非常に小さいため、将来的に C 言語側からのダイレクトなサウンドイベントをブリッジする場合でも、現行の `SoundManager.js` の再生エンジン（WAV再生 & Beepcore 8bit Synth & 独立ゲイン）をそのまま完全流用して美しく統合することが可能です。
