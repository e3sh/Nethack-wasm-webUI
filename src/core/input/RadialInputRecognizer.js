/**
 * RadialInputRecognizer.js
 * 
 * アナログスティックの座標 (x, y) から角度・半径を計算し、
 * 8方向セクター量子化およびフリック＆リリース判定（倒して離した時の決定）を行う
 * ラジアルパレット用入力認識ステートマシン。
 */

export const RADIAL_SECTORS = {
    N: 'N',
    NE: 'NE',
    E: 'E',
    SE: 'SE',
    S: 'S',
    SW: 'SW',
    W: 'W',
    NW: 'NW'
};

export const RADIAL_STATE = {
    IDLE: 'IDLE',           // デッドゾーン内（待機中）
    ENGAGED: 'ENGAGED'      // スティックが倒されセクター選択中
};

export class RadialInputRecognizer {
    /**
     * @param {Object} [options={}]
     * @param {number} [options.innerDeadZone=0.25] - デッドゾーン（これ未満はニュートラル）
     * @param {number} [options.outerThreshold=0.6] - セクター確定閾値（これ以上でENGAGED）
     * @param {number} [options.flickMaxHoldMs=1200] - フリック決定が有効な最大ホールド時間（ms）
     */
    constructor(options = {}) {
        this.innerDeadZone = options.innerDeadZone ?? 0.25;
        this.outerThreshold = options.outerThreshold ?? 0.6;
        this.flickMaxHoldMs = options.flickMaxHoldMs ?? 1200;

        this.state = RADIAL_STATE.IDLE;
        this.currentSector = null;
        this.lastEngagedSector = null;
        this.engagedTimestamp = 0;
        this.radius = 0;
        this.angleDeg = 0;

        // イベントリスナー
        this._listeners = {
            sectorChange: [],
            engaged: [],
            disengaged: [],
            flick: []
        };
    }

    /**
     * イベントリスナー登録
     * @param {'sectorChange'|'engaged'|'disengaged'|'flick'} event 
     * @param {Function} callback 
     */
    on(event, callback) {
        if (this._listeners[event]) {
            this._listeners[event].push(callback);
        }
    }

    /**
     * イベント発火
     */
    _emit(event, data) {
        if (this._listeners[event]) {
            this._listeners[event].forEach(cb => cb(data));
        }
    }

    /**
     * スティック座標 (x, y) から8方向セクターを判定
     * - 上 (N): -90° (y = -1, x = 0)
     * - 右 (E): 0° (y = 0, x = 1)
     * - 下 (S): +90° (y = 1, x = 0)
     * - 左 (W): 180°/-180° (y = 0, x = -1)
     * 各セクターは 45° 刻み、境界幅 ±22.5°
     * 
     * @param {number} x 
     * @param {number} y 
     * @returns {{ radius: number, angleDeg: number, sector: string }}
     */
    static calculateSector(x, y) {
        const radius = Math.sqrt(x * x + y * y);
        if (radius === 0) {
            return { radius: 0, angleDeg: 0, sector: null };
        }

        const rad = Math.atan2(y, x);
        let angleDeg = rad * (180 / Math.PI); // -180 ~ +180

        let sector = RADIAL_SECTORS.E;
        if (angleDeg >= -22.5 && angleDeg < 22.5) {
            sector = RADIAL_SECTORS.E;
        } else if (angleDeg >= 22.5 && angleDeg < 67.5) {
            sector = RADIAL_SECTORS.SE;
        } else if (angleDeg >= 67.5 && angleDeg < 112.5) {
            sector = RADIAL_SECTORS.S;
        } else if (angleDeg >= 112.5 && angleDeg < 157.5) {
            sector = RADIAL_SECTORS.SW;
        } else if (angleDeg >= 157.5 || angleDeg < -157.5) {
            sector = RADIAL_SECTORS.W;
        } else if (angleDeg >= -157.5 && angleDeg < -112.5) {
            sector = RADIAL_SECTORS.NW;
        } else if (angleDeg >= -112.5 && angleDeg < -67.5) {
            sector = RADIAL_SECTORS.N;
        } else if (angleDeg >= -67.5 && angleDeg < -22.5) {
            sector = RADIAL_SECTORS.NE;
        }

        return { radius, angleDeg, sector };
    }

    /**
     * フレームごとのスティック入力更新
     * @param {number} x - スティックX軸 (-1.0 ~ 1.0)
     * @param {number} y - スティックY軸 (-1.0 ~ 1.0)
     * @param {number} [now=Date.now()] - 現在タイムスタンプ
     * @returns {Object} フレーム結果情報
     */
    update(x, y, now = Date.now()) {
        const { radius, angleDeg, sector } = RadialInputRecognizer.calculateSector(x, y);
        this.radius = radius;
        this.angleDeg = angleDeg;

        let flickTriggered = null;

        if (this.state === RADIAL_STATE.IDLE) {
            if (radius >= this.outerThreshold) {
                // IDLE -> ENGAGED 遷移
                this.state = RADIAL_STATE.ENGAGED;
                this.currentSector = sector;
                this.lastEngagedSector = sector;
                this.engagedTimestamp = now;
                this._emit('engaged', { sector, angleDeg, radius });
                this._emit('sectorChange', { sector, angleDeg, radius });
            }
        } else if (this.state === RADIAL_STATE.ENGAGED) {
            if (radius >= this.outerThreshold) {
                // セクター変更チェック
                if (sector !== this.currentSector) {
                    this.currentSector = sector;
                    this.lastEngagedSector = sector;
                    this._emit('sectorChange', { sector, angleDeg, radius });
                }
            } else if (radius <= this.innerDeadZone) {
                // ENGAGED -> IDLE 遷移（スティックリリース）
                const holdDuration = now - this.engagedTimestamp;
                const canFlick = holdDuration <= this.flickMaxHoldMs && this.lastEngagedSector;

                if (canFlick) {
                    flickTriggered = {
                        sector: this.lastEngagedSector,
                        holdDuration
                    };
                    this._emit('flick', flickTriggered);
                }

                this._emit('disengaged', { flickTriggered });
                this.reset();
            }
        }

        return {
            state: this.state,
            currentSector: this.currentSector,
            lastEngagedSector: this.lastEngagedSector,
            radius,
            angleDeg,
            flickTriggered
        };
    }

    /**
     * 状態をリセット（キャンセル時やリリース後）
     */
    reset() {
        this.state = RADIAL_STATE.IDLE;
        this.currentSector = null;
        this.lastEngagedSector = null;
        this.engagedTimestamp = 0;
        this.radius = 0;
    }
}
