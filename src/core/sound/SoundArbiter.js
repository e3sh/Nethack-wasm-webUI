/**
 * SoundArbiter.js - 音響調停エンジン (Sound Arbitration Engine)
 *
 * オーディオハードウェアや DOM に依存しない純粋な Headless 調停エンジン。
 * クールダウン管理、優先度ソート（Priority 100〜30）、スタガード遅延キュー（60ms）、
 * および動作モード（Auto/Wave/Beep/Mute）に基づく再生ドライバの選定を一元的に統括する。
 */

export class SoundArbiter {
    /**
     * @param {Object} [options]
     * @param {number} [options.staggerIntervalMs=60] - Audio Queue スタガード再生間隔(ms)
     * @param {import('./SoundModeManager.js').SoundModeManager} [options.modeManager] - モードマネージャ
     * @param {Function} [options.onLogCallback] - ログコールバック
     * @param {Object} [options.drivers] - 初期ドライバセット { wave, beep, synth }
     */
    constructor(options = {}) {
        this.staggerIntervalMs = options.staggerIntervalMs !== undefined ? options.staggerIntervalMs : 60;
        this.modeManager = options.modeManager || null;
        this.onLogCallback = options.onLogCallback || null;
        this.audioQueue = [];
        this.isProcessingQueue = false;
        this.cooldownMap = new Map();
        this.delegate = options.delegate || null;
        this.drivers = {
            wave: null,
            beep: null,
            synth: null
        };

        if (options.drivers) {
            this.bindDrivers(options.drivers);
        }
    }

    /**
     * 発音委譲先デリゲート (SoundCoordinator等) を設定
     * @param {Object} delegate
     */
    setDelegate(delegate) {
        this.delegate = delegate;
    }

    /**
     * 再生ドライバ群を登録・バインドする
     *
     * @param {Object} drivers - { wave, beep, synth }
     */
    bindDrivers(drivers = {}) {
        if (drivers.wave) this.drivers.wave = drivers.wave;
        if (drivers.beep) this.drivers.beep = drivers.beep;
        if (drivers.synth) this.drivers.synth = drivers.synth;
    }

    /**
     * ログ通知ヘルパー
     */
    _log(type, msg, meta = {}) {
        if (typeof this.onLogCallback === 'function') {
            this.onLogCallback(type, msg, meta);
        }
    }

    /**
     * 現在の正規化されたサウンドモードを取得
     * @returns {string} 'auto' | 'wave' | 'beep' | 'mute'
     */
    getNormalizedMode() {
        if (this.modeManager) {
            return this.modeManager.getNormalizedSoundMode();
        }
        return 'auto';
    }

    /**
     * キューへの投入および調停
     * クールダウンとモード判定を行い、優先度順にソートしてスタガード再生キューに登録する。
     *
     * @param {Object} ruleOrDef - 効果音ルール定義
     * @param {Object|null} [context=null] - 発生コンテキスト
     * @returns {Object|null} 投入されたルール、破棄された場合は null
     */
    enqueue(ruleOrDef, context = null) {
        if (!ruleOrDef) return null;

        const mode = this.getNormalizedMode();
        if (mode === 'mute') return null;

        const rule = typeof ruleOrDef === 'string'
            ? { id: 'manual_se', sound: ruleOrDef, priority: 50 }
            : ruleOrDef;

        const priority = rule.priority !== undefined ? rule.priority : 50;
        const now = Date.now();

        // 1. クールダウン管理 (cooldownMs)
        if (rule.cooldownMs && rule.id) {
            const lastTime = this.cooldownMap.get(rule.id) || 0;
            if (now - lastTime < rule.cooldownMs) {
                this._log('COOLDOWN_SKIP', `Sound ${rule.id} skipped due to cooldown (${rule.cooldownMs}ms)`, { rule, context });
                return null;
            }
            this.cooldownMap.set(rule.id, now);
        }

        const queueItem = {
            rule,
            context,
            priority,
            enqueuedAt: now
        };

        this.audioQueue.push(queueItem);

        // 2. 優先度ソート（降順: 優先度大が先頭。同優先度は enqueuedAt 先着順）
        this.audioQueue.sort((a, b) => {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            return a.enqueuedAt - b.enqueuedAt;
        });

        this._log('SOUND_ENQUEUED', `Sound enqueued: ${rule.id || 'unnamed'} (priority: ${priority})`, {
            rule,
            context,
            queueLength: this.audioQueue.length
        });

        // 3. Audio Queue 処理ループを開始
        if (!this.isProcessingQueue) {
            this._processAudioQueue();
        }

        return rule;
    }

    /**
     * Audio Queue スタガード遅延ループ
     * キューから順次アイテムを取り出し、SSOT調停アルゴリズムに基づいてドライバへ再生指示を行う。
     */
    async _processAudioQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        while (this.audioQueue.length > 0) {
            const mode = this.getNormalizedMode();
            if (mode === 'mute') {
                this.audioQueue = [];
                break;
            }

            const item = this.audioQueue.shift();
            if (item && item.rule) {
                if (item.rule.synth) {
                    if (mode === 'wave' && item.rule.sound) {
                        await this.playSoundByRule(item.rule);
                    } else {
                        // シンセシスはスタガード遅延キューを介しつつ即時合成発音
                        await this.playSoundByRule(item.rule);
                    }
                } else {
                    await this.playSoundByRule(item.rule);
                }
            }

            if (this.audioQueue.length > 0) {
                await new Promise(r => setTimeout(r, this.staggerIntervalMs));
            }
        }

        this.isProcessingQueue = false;
    }

    async playSynth(synthDef) {
        if (this.delegate && typeof this.delegate.playSynth === 'function') {
            return this.delegate.playSynth(synthDef);
        }
        if (this.drivers.synth) {
            return this.drivers.synth.play(synthDef);
        }
    }

    async playBeep(beepDef) {
        if (this.delegate && typeof this.delegate.playBeep === 'function') {
            return this.delegate.playBeep(beepDef);
        }
        if (this.drivers.beep) {
            return this.drivers.beep.play(beepDef);
        }
    }

    async playAudioFile(filename) {
        if (this.delegate && typeof this.delegate.playAudioFile === 'function') {
            return this.delegate.playAudioFile(filename);
        }
        if (this.drivers.wave) {
            return this.drivers.wave.play(filename);
        }
        return false;
    }

    /**
     * 調停アルゴリズム（SSOT: Single Source of Truth）
     * 現在の再生モードと定義に基づき、適切な音響ドライバを呼び出す。
     *
     * @param {Object} rule
     */
    async playSoundByRule(rule) {
        if (!rule) return;
        const mode = this.getNormalizedMode();
        if (mode === 'mute') return;

        // 1. Beep モード: レトロ Beep / PSG 音源
        if (mode === 'beep') {
            if (rule.synth) {
                await this.playSynth(rule.synth);
                return;
            }
            if (rule.beep) {
                await this.playBeep(rule.beep);
                return;
            }
            return;
        }

        // 2. Wave モード: 音声ファイル再生
        if (mode === 'wave') {
            if (rule.sound) {
                const played = await this.playAudioFile(rule.sound);
                if (!played) {
                    this._log('WARN_WAVE_NOT_FOUND', `Sound asset not found: ${rule.sound}`);
                }
                return;
            }
            if (rule.synth) {
                await this.playSynth(rule.synth);
                return;
            }
            return;
        }

        // 3. Auto モード: Waveファイルがあれば優先、無ければ Beep / Synth へフォールバック
        if (mode === 'auto') {
            let played = false;
            const failedCache = this.delegate?.failedAssetCache || this.drivers.wave?.failedAssetCache;
            if (rule.sound && (!failedCache || !failedCache.has(rule.sound))) {
                played = await this.playAudioFile(rule.sound);
            }
            if (!played) {
                if (rule.synth) {
                    await this.playSynth(rule.synth);
                    return;
                }
                if (rule.beep) {
                    await this.playBeep(rule.beep);
                    return;
                }
            }
        }
    }

    /**
     * キューを即時クリアする
     */
    clearQueue() {
        this.audioQueue = [];
    }
}
