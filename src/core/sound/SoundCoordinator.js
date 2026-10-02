/**
 * SoundCoordinator.js - 統合サウンドコーディネーター (Sound Coordinator & Facade)
 *
 * WebUICore やクライアント UI との単一窓口となる Facade クラス。
 * イベントルーティング (SoundEventRouter)、調停エンジン (SoundArbiter)、
 * モード管理 (SoundModeManager)、および物理駆動ドライバ群 (Wave, PsgBeep, ProceduralSynth)
 * を統合し、疎結合かつ完全な後方互換 API を提供する。
 */

import { SoundModeManager } from './SoundModeManager.js';
import { SoundArbiter } from './SoundArbiter.js';
import { SoundEventRouter, DEFAULT_SOUND_RULES } from './SoundEventRouter.js';
import { WaveAudioDriver } from './drivers/WaveAudioDriver.js';
import { PsgBeepDriver } from './drivers/PsgBeepDriver.js';
import { ProceduralSynthDriver } from './drivers/ProceduralSynthDriver.js';

export class SoundCoordinator {
    /**
     * @param {Object} [options]
     * @param {string} [options.soundMode='auto'] - 'auto' | 'wave' | 'se' | 'beep' | 'mute'
     * @param {number} [options.volume=80] - 0 ~ 100
     * @param {string} [options.soundDir='assets/sounds/'] - 音声アセットパス
     * @param {number} [options.staggerIntervalMs=60] - Audio Queue スタガード再生間隔(ms)
     * @param {Array} [options.rules] - カスタムルール配列
     * @param {Function} [options.onLogCallback] - ログコールバック
     * @param {Object} [options.drivers] - カスタムドライバ注入 (モック用)
     */
    constructor(options = {}) {
        this.onLogCallback = options.onLogCallback || null;

        // 1. サウンドモード＆音量マネージャの初期化
        this.modeManager = new SoundModeManager({
            soundMode: options.soundMode,
            volume: options.volume,
            onModeChange: (mode, norm) => {
                this._log('MODE_CHANGE', `Sound mode changed to: ${mode} (normalized: ${norm})`);
            },
            onVolumeChange: (vol) => {
                this._log('VOLUME_CHANGE', `Sound volume changed to: ${vol}`);
                if (this.drivers) {
                    if (this.drivers.wave) this.drivers.wave.setVolume(vol);
                    if (this.drivers.beep) this.drivers.beep.setVolume(vol);
                    if (this.drivers.synth) this.drivers.synth.setVolume(vol);
                }
            }
        });

        // 2. 物理音響駆動ドライバ群の初期化
        const currentVol = this.modeManager.getVolume();
        const initialSoundDir = options.soundDir || 'assets/sounds/';

        this.drivers = {
            wave: options.drivers?.wave || new WaveAudioDriver({ soundDir: initialSoundDir, volume: currentVol }),
            beep: options.drivers?.beep || new PsgBeepDriver({ volume: currentVol }),
            synth: options.drivers?.synth || new ProceduralSynthDriver({ volume: currentVol, onLogCallback: this.onLogCallback })
        };

        // 3. 調停エンジン (SoundArbiter) の初期化
        this.arbiter = new SoundArbiter({
            staggerIntervalMs: options.staggerIntervalMs !== undefined ? options.staggerIntervalMs : 60,
            modeManager: this.modeManager,
            drivers: this.drivers,
            delegate: this,
            onLogCallback: this.onLogCallback
        });

        // 4. イベントルータ (SoundEventRouter) の初期化
        this.router = new SoundEventRouter({
            rules: options.rules || DEFAULT_SOUND_RULES,
            onLogCallback: this.onLogCallback
        });

        this._fxTriggerHandler = null;
    }

    // --- 既存プロパティ透過アクセス互換性 (Getter / Setter) ---
    get soundMode() { return this.modeManager.soundMode; }
    set soundMode(val) { this.modeManager.setSoundMode(val); }

    get volume() { return this.modeManager.volume; }
    set volume(val) { this.modeManager.setVolume(val); }

    get soundDir() { return this.drivers.wave?.soundDir || 'assets/sounds/'; }
    set soundDir(val) { if (this.drivers.wave) this.drivers.wave.soundDir = val; }

    get staggerIntervalMs() { return this.arbiter.staggerIntervalMs; }
    set staggerIntervalMs(val) { this.arbiter.staggerIntervalMs = val; }

    get audioQueue() { return this.arbiter.audioQueue; }
    set audioQueue(val) { this.arbiter.audioQueue = val; }

    get isProcessingQueue() { return this.arbiter.isProcessingQueue; }
    set isProcessingQueue(val) { this.arbiter.isProcessingQueue = val; }

    get cooldownMap() { return this.arbiter.cooldownMap; }
    set cooldownMap(val) { this.arbiter.cooldownMap = val; }

    get failedAssetCache() { return this.drivers.wave?.failedAssetCache || new Set(); }
    set failedAssetCache(val) { if (this.drivers.wave) this.drivers.wave.failedAssetCache = val; }

    get rules() { return this.router.rules; }
    set rules(val) { this.router.rules = val; }

    get audioCtx() {
        return this.drivers.synth?.audioCtx || this.drivers.beep?.audioCtx || null;
    }
    set audioCtx(val) {
        if (this.drivers.synth) this.drivers.synth.audioCtx = val;
        if (this.drivers.beep) this.drivers.beep.audioCtx = val;
    }

    _log(type, msg, meta = {}) {
        if (typeof this.onLogCallback === 'function') {
            this.onLogCallback(type, msg, meta);
        }
    }

    /**
     * サウンドモードを設定する
     * @param {string} mode - 'auto' | 'wave' | 'se' | 'beep' | 'mute'
     */
    setSoundMode(mode) {
        this.modeManager.setSoundMode(mode);
    }

    /**
     * 標準化されたサウンドモードを取得
     * @returns {string} 'auto' | 'wave' | 'beep' | 'mute'
     */
    getNormalizedSoundMode() {
        return this.modeManager.getNormalizedSoundMode();
    }

    /**
     * 音量を設定する (0〜100)
     * @param {number} vol
     */
    setVolume(vol) {
        this.modeManager.setVolume(vol);
    }

    /**
     * ユーザージェスチャーによるオーディオロック解除
     */
    unlockAudio() {
        if (this.drivers.synth) this.drivers.synth.unlockAudio();
        if (this.drivers.beep) this.drivers.beep.unlockAudio();
        if (this.drivers.wave) this.drivers.wave.unlockAudio();
    }

    /**
     * WebUICore インスタンスを購読し、Visual FX / Combat FX トリガーと自動連携
     *
     * @param {Object} core - WebUICore インスタンス
     */
    attachCore(core) {
        if (!core || typeof core.on !== 'function') return;

        if (this._fxTriggerHandler && typeof core.off === 'function') {
            core.off('fx_trigger', this._fxTriggerHandler);
        }

        this._fxTriggerHandler = (fx) => {
            this.handleFxTrigger(fx);
        };

        core.on('fx_trigger', this._fxTriggerHandler);
        this._log('CORE_ATTACHED', 'SoundCoordinator attached to WebUICore fx_trigger');
    }

    /**
     * Visual / Combat FX トリガーを処理し、対応する効果音を発火
     *
     * @param {Object} fx - FXイベントオブジェクト
     * @returns {Object|null} 発火した効果音ルールまたは null
     */
    handleFxTrigger(fx) {
        if (!fx || !fx.type) return null;
        if (this.getNormalizedSoundMode() === 'mute') return null;

        const soundEvent = this.router.resolveFxTrigger(fx);
        if (soundEvent) {
            return this.enqueueSound(soundEvent, { fx });
        }
        return null;
    }

    /**
     * Wasm メッセージコンテキストから効果音を自動判定・キューイング
     *
     * @param {Object|null} context - MessageContext
     * @param {string} [fallbackText=''] - 生テキストフォールバック
     * @returns {Object|null} マッチした効果音ルールまたは null
     */
    processMessageContext(context, fallbackText = '') {
        if (this.getNormalizedSoundMode() === 'mute') return null;

        const rule = this.router.resolveMessageContext(context, fallbackText);
        if (rule) {
            return this.enqueueSound(rule, context);
        }
        return null;
    }

    /**
     * カタログ定義から再生用ルールを構築 (直接試聴・テストベンチ用)
     *
     * @param {Object} eventDef - SOUND_EVENT_MAP の定義
     * @param {string|null} [eventKey=null] - カタログキー
     * @returns {Object}
     */
    _resolveRuleFromEventDef(eventDef, eventKey = null) {
        return this.router.resolveRuleFromEventDef(eventDef, eventKey);
    }

    /**
     * 効果音ルールをスタガード Audio Queue に投入
     *
     * @param {Object|string} ruleOrDef
     * @param {Object|null} [context=null]
     * @returns {Object|null}
     */
    enqueueSound(ruleOrDef, context = null) {
        return this.arbiter.enqueue(ruleOrDef, context);
    }

    /**
     * Audio Queue スタガード遅延処理ループ
     */
    async _processAudioQueue() {
        return this.arbiter._processAudioQueue();
    }

    /**
     * Wasm からの生メッセージログを受け取り、正規表現マッチした効果音を自動トリガー
     *
     * @param {string} text - メッセージテキスト
     * @returns {Object|null} マッチしたルールオブジェクトまたは null
     */
    processLogMessage(text) {
        if (!text) return null;
        if (this.getNormalizedSoundMode() === 'mute') return null;

        const rule = this.router.resolveLogMessage(text);
        if (rule) {
            return this.enqueueSound(rule, { rawText: text });
        }
        return null;
    }

    /**
     * ルールに従って物理発音を実行する (調停エンジン委譲)
     *
     * @param {Object} rule
     */
    async playSoundByRule(rule) {
        return this.arbiter.playSoundByRule(rule);
    }

    /**
     * プロシージャルシンセ直接発音
     *
     * @param {Object} synthDef
     */
    playSynth(synthDef) {
        if (this.drivers.synth) {
            this.drivers.synth.play(synthDef);
        }
    }

    /**
     * Beep / PSG 音源直接発音
     *
     * @param {Object} beepDef
     */
    playBeep(beepDef) {
        if (this.drivers.beep) {
            this.drivers.beep.play(beepDef);
        }
    }

    /**
     * 音声ファイル直接再生
     *
     * @param {string} filename
     * @returns {Promise<boolean>}
     */
    async playAudioFile(filename) {
        if (this.drivers.wave) {
            return this.drivers.wave.play(filename);
        }
        return false;
    }
}
