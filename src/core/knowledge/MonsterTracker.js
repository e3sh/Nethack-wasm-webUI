/**
 * MonsterTracker.js
 * 
 * モンスター認知メンタルマップ (Mental Map / Monster Tracker)
 * 画面描画から視界外に消えたモンスターの存在を確信度減衰 (Certainty / Weight Decay) とともに追跡・記憶し、
 * 戦術アドバイス (TacticalAdvisor) に事前警告・準備指示の根拠を提供する。
 */

import { classifyGlyph, ENTITY_TYPES } from './glyphClassifier.js';
import { MONSTER_KNOWLEDGE_MAP } from './MONSTER_KNOWLEDGE_FULL.js';

export class MonsterTracker {
    constructor() {
        /** @type {Map<string, Object>} */
        this.trackedMonsters = new Map();
        this.currentTurn = 1;
        this.currentDlevel = 1;
        this.lastPlayerPos = null;
        /** @type {((reason: string, entry: Object) => void)|null} */
        this.onInventoryInvalidateRequired = null;
    }

    /**
     * 内部ターン時計を進める、または絶対ターン数に同期
     * @param {number} [turn] - BL_TIME 由来の絶対ターン数 (省略時は +1)
     */
    advanceTurn(turn = null) {
        if (typeof turn === 'number' && turn >= 0) {
            this.currentTurn = turn;
        } else {
            this.currentTurn += 1;
        }
        this._decayWeights();
    }

    /**
     * 現在のターン数を取得
     * @returns {number}
     */
    getCurrentTurn() {
        return this.currentTurn;
    }

    /**
     * 窃盗特性敵との交戦・隣接解消（監視外れ）を検知し、インベントリ無効化（再同期要求）を発行
     * @private
     * @param {Object} entry 
     * @param {string} reason 
     */
    _checkDisengage(entry, reason) {
        if (!entry || !entry.hadCloseContact || entry.didInvalidate) return;
        entry.didInvalidate = true;
        if (typeof this.onInventoryInvalidateRequired === 'function') {
            try {
                this.onInventoryInvalidateRequired(reason, entry);
            } catch (e) {
                // コールバックのエラーを吸収して処理継続
            }
        }
    }

    /**
     * 視認されたモンスターを登録または更新
     * @param {number} x 
     * @param {number} y 
     * @param {number} glyphId 
     * @param {Object} [glyphInfo] 
     * @param {Object} [playerPos] - プレイヤーの現在座標 { x, y } または { playerX, playerY }
     * @returns {Object|null} 登録・更新された追跡オブジェクト
     */
    updateVisibleMonster(x, y, glyphId, glyphInfo = null, playerPos = null) {
        if (x < 0 || y < 0) return null;

        const info = classifyGlyph(glyphId);
        if (info.type !== ENTITY_TYPES.MONSTER && info.type !== ENTITY_TYPES.PET) {
            return null;
        }

        const monOffset = info.subType !== undefined ? info.subType : (info.monOffset !== undefined ? info.monOffset : (glyphInfo?.monOffset ?? -1));
        const monKnowledge = (monOffset >= 0 ? MONSTER_KNOWLEDGE_MAP.get(monOffset) : null) || {};

        const fallbackName = info.isInvisible ? 'invisible monster' : (info.isWarning ? `unknown threat (warn:${info.warnLevel || '?'})` : (monOffset < 0 ? 'unknown creature' : (monKnowledge.name || `Monster_${monOffset}`)));
        const fallbackNameJa = info.isInvisible ? '不可視モンスター' : (info.isWarning ? `未知の気配 (警告${info.warnLevel || ''})` : (monOffset < 0 ? '未知のモンスター' : null));

        const name = glyphInfo?.name || monKnowledge.name || info.name || fallbackName;
        const nameJa = glyphInfo?.nameJa || monKnowledge.nameJa || info.nameJa || fallbackNameJa || name;

        // 1. 完全一致座標 (x, y) の既存エントリーがあれば最優先で更新
        let targetKey = null;
        for (const [key, tracked] of this.trackedMonsters.entries()) {
            if (tracked.lastKnownPos.x === x && tracked.lastKnownPos.y === y) {
                targetKey = key;
                break;
            }
        }

        // 2. 座標が異なる場合:
        // 現在「視界外（!inLoS）」になっている同種族のエントリーがあれば、その個体が移動して再出現したと判定（再視認）。
        // ※「今このターンに別マスで直接視認されている（inLoS === true && lastSeenTurn === currentTurn）」個体は除外
        if (!targetKey) {
            let closestUnseenKey = null;
            let minDistance = Infinity;

            for (const [key, tracked] of this.trackedMonsters.entries()) {
                if (tracked.monOffset === monOffset && (!tracked.inLoS || tracked.lastSeenTurn < this.currentTurn)) {
                    const dist = Math.max(Math.abs(tracked.lastKnownPos.x - x), Math.abs(tracked.lastKnownPos.y - y));
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestUnseenKey = key;
                    }
                }
            }

            if (closestUnseenKey) {
                targetKey = closestUnseenKey;
            }
        }

        // 3. 店主 (monOffset: 271) の特別ハンドリング (同一フロアでの重複登録を防止)
        if (!targetKey && monOffset === 271) {
            for (const [key, tracked] of this.trackedMonsters.entries()) {
                if (tracked.monOffset === 271) {
                    targetKey = key;
                    break;
                }
            }
        }

        const existingEntry = targetKey ? this.trackedMonsters.get(targetKey) : null;

        // 4. 潜伏中の同種エントリーもなく、現在同時に視認されている数が増えた場合のみ新個体として追加
        if (!targetKey) {
            targetKey = `mon_${monOffset}_${x}_${y}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        }

        const entry = {
            id: targetKey,
            monOffset,
            name,
            nameJa,
            glyph: glyphId,
            glyphInfo,
            knowledge: monKnowledge,
            isPet: info.type === ENTITY_TYPES.PET,
            lastKnownPos: { x, y },
            lastSeenTurn: this.currentTurn,
            inLoS: true,
            weight: 1.0,
            decayStatus: 'VISIBLE',
            hadCloseContact: existingEntry ? Boolean(existingEntry.hadCloseContact) : false,
            didInvalidate: existingEntry ? Boolean(existingEntry.didInvalidate) : false
        };

        const px = playerPos?.x ?? playerPos?.playerX ?? this.lastPlayerPos?.x;
        const py = playerPos?.y ?? playerPos?.playerY ?? this.lastPlayerPos?.y;
        if (typeof px === 'number' && typeof py === 'number') {
            const dist = Math.max(Math.abs(x - px), Math.abs(y - py));
            if (dist <= 1 && monKnowledge?.traits?.stealsItems) {
                entry.hadCloseContact = true;
            }
        }

        this.trackedMonsters.set(targetKey, entry);
        return entry;
    }

    /**
     * 座標 (x, y) がモンスター以外の地形・アイテムで上書きされた（視界外または移動した）場合の通知
     * @param {number} x 
     * @param {number} y 
     */
    notifyCellLostMonster(x, y) {
        for (const entry of this.trackedMonsters.values()) {
            if (entry.lastKnownPos.x === x && entry.lastKnownPos.y === y) {
                entry.inLoS = false;
                // 視認中から視界外へ移行。ターン経過に応じた重み付けを再評価
                this._updateEntryDecay(entry);
                this._checkDisengage(entry, 'lost_los');
            }
        }
    }

    /**
     * プレイヤーの現在地更新（位置不整合チェック）
     * プレイヤーがモンスターの最後に確認された位置に入った場合、そのモンスターはそのマスにいないので削除
     * @param {number} px 
     * @param {number} py 
     */
    handlePlayerPosition(px, py) {
        this.lastPlayerPos = { x: px, y: py };
        for (const [key, entry] of this.trackedMonsters.entries()) {
            if (entry.lastKnownPos.x === px && entry.lastKnownPos.y === py) {
                this._checkDisengage(entry, 'player_stepped_on_monster');
                this.trackedMonsters.delete(key);
            } else if (entry.knowledge?.traits?.stealsItems) {
                const dist = Math.max(Math.abs(entry.lastKnownPos.x - px), Math.abs(entry.lastKnownPos.y - py));
                if (dist <= 1) {
                    entry.hadCloseContact = true;
                }
            }
        }
    }

    /**
     * ログメッセージ（撃破・消滅・死亡）の処理
     * @param {string} text 
     * @returns {Object|null} 撃破されたモンスターエントリーまたは撃破判定結果
     */
    handleMessage(text) {
        if (!text || typeof text !== 'string') return null;
        const lower = text.toLowerCase();

        // 撃破・消滅パターンの判定
        const isKillMessage = 
            lower.includes('you kill') || 
            lower.includes('you destroy') || 
            lower.includes('is killed') || 
            lower.includes('is destroyed') || 
            lower.includes('dies') || 
            lower.includes('you defeated') ||
            lower.includes('death cry') ||
            text.includes('倒した') ||
            text.includes('破壊した') ||
            text.includes('死んだ') ||
            text.includes('消滅した');

        if (!isKillMessage) return null;

        // 追跡中のモンスター名と照合し、撃破されたモンスターを削除
        let killedEntry = null;
        for (const [key, entry] of this.trackedMonsters.entries()) {
            const mName = (entry.name || '').toLowerCase();
            const mNameJa = entry.nameJa || '';

            if ((mName && lower.includes(mName)) || (mNameJa && text.includes(mNameJa))) {
                killedEntry = { ...entry };
                this._checkDisengage(entry, 'killed');
                this.trackedMonsters.delete(key);
                break; // 1件削除
            }
        }

        return killedEntry || { isKillMessage: true };
    }

    /**
     * ダンジョン階層変更時の処理
     * @param {number|string} newDlevel 
     */
    handleDlevelChange(newDlevel) {
        if (newDlevel !== this.currentDlevel) {
            this.currentDlevel = newDlevel;
            this.reset('dlevel_change');
        }
    }

    /**
     * 全追跡データのクリア
     * @param {string} [reason='reset']
     */
    reset(reason = 'reset') {
        for (const entry of this.trackedMonsters.values()) {
            this._checkDisengage(entry, reason);
        }
        this.trackedMonsters.clear();
    }

    /**
     * 追跡中の認知モンスター一覧を取得
     * @param {number} [minWeight=0.1] - 取得する最小確信度
     * @returns {Array<Object>}
     */
    getTrackedMonsters(minWeight = 0.1) {
        const result = [];
        for (const entry of this.trackedMonsters.values()) {
            if (entry.weight >= minWeight) {
                result.push({ ...entry });
            }
        }
        return result;
    }

    /**
     * プレイヤー視点での認知モンスター要約リスト（気配レーダー）を取得
     * @param {Object} [options={}]
     * @param {number} [options.playerX=0]
     * @param {number} [options.playerY=0]
     * @param {'ja'|'en'} [options.language='ja']
     * @param {number} [options.minWeight=0.1]
     * @returns {Array<Object>}
     */
    getPerceivedMonstersSummary(options = {}) {
        const px = options.playerX ?? 0;
        const py = options.playerY ?? 0;
        const isJa = (options.language !== 'en');
        const minWeight = options.minWeight ?? 0.1;

        const getDirection = (dx, dy) => {
            if (dx === 0 && dy === 0) return { code: 'SELF', name: isJa ? '足元' : 'Feet' };
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            if (angle >= -22.5 && angle < 22.5) return { code: 'E', name: isJa ? '東' : 'East' };
            if (angle >= 22.5 && angle < 67.5) return { code: 'SE', name: isJa ? '南東' : 'South-East' };
            if (angle >= 67.5 && angle < 112.5) return { code: 'S', name: isJa ? '南' : 'South' };
            if (angle >= 112.5 && angle < 157.5) return { code: 'SW', name: isJa ? '南西' : 'South-West' };
            if (angle >= 157.5 || angle < -157.5) return { code: 'W', name: isJa ? '西' : 'West' };
            if (angle >= -157.5 && angle < -112.5) return { code: 'NW', name: isJa ? '北西' : 'North-West' };
            if (angle >= -112.5 && angle < -67.5) return { code: 'N', name: isJa ? '北' : 'North' };
            if (angle >= -67.5 && angle < -22.5) return { code: 'NE', name: isJa ? '北東' : 'North-East' };
            return { code: 'UNKNOWN', name: isJa ? '不明' : 'Unknown' };
        };

        const grid = options.grid || null;

        const list = [];
        for (const entry of this.trackedMonsters.values()) {
            const mx = entry.lastKnownPos ? entry.lastKnownPos.x : px;
            const my = entry.lastKnownPos ? entry.lastKnownPos.y : py;

            // もし grid 上の該当セルにモンスターが存在し続けていれば、視認中 (100%) を確定維持
            if (grid && Array.isArray(grid[my]) && grid[my][mx]) {
                const top = grid[my][mx].top;
                if (top && (top.type === 'MONSTER' || top.type === 'PET')) {
                    entry.inLoS = true;
                    entry.decayStatus = 'VISIBLE';
                    entry.weight = 1.0;
                    entry.lastSeenTurn = this.currentTurn;
                }
            }

            if (entry.weight < minWeight) continue;

            const dx = mx - px;
            const dy = my - py;
            const distance = Math.max(Math.abs(dx), Math.abs(dy));
            const direction = getDirection(dx, dy);
            const turnsAgo = Math.max(0, this.currentTurn - entry.lastSeenTurn);
            const confidencePercent = Math.round(entry.weight * 100);

            let statusLabel = '';
            let statusIcon = '';
            if (entry.decayStatus === 'VISIBLE') {
                statusIcon = '👁️';
                statusLabel = isJa ? '視認中' : 'Visible';
            } else if (entry.decayStatus === 'NEARBY_UNSEEN') {
                statusIcon = '❓';
                statusLabel = isJa ? '潜伏中' : 'Lurking';
            } else {
                statusIcon = '🌫️';
                statusLabel = isJa ? '気配あり' : 'Trace';
            }

            const dangerLevel = entry.knowledge?.dangerLevel || 'NORMAL';

            list.push({
                id: entry.id,
                monOffset: entry.monOffset,
                name: entry.name,
                nameJa: entry.nameJa,
                displayName: isJa ? (entry.nameJa || entry.name) : entry.name,
                isPet: Boolean(entry.isPet),
                dangerLevel,
                weight: entry.weight,
                confidencePercent,
                decayStatus: entry.decayStatus,
                statusIcon,
                statusLabel,
                formattedStatus: `${statusIcon} ${statusLabel}`,
                distance,
                direction,
                lastKnownPos: { x: mx, y: my },
                lastSeenTurn: entry.lastSeenTurn,
                lastSeenTurnsAgo: turnsAgo,
                summaryText: isJa 
                    ? `${statusIcon} ${entry.nameJa || entry.name} (${statusLabel} / 距離:${distance}マス ${direction.name} / 確信度:${confidencePercent}%)`
                    : `${statusIcon} ${entry.name} (${statusLabel} / Dist:${distance} ${direction.name} / ${confidencePercent}%)`
            });
        }

        list.sort((a, b) => {
            if (a.distance !== b.distance) return a.distance - b.distance;
            return b.weight - a.weight;
        });

        return list;
    }

    /**
     * ターン経過に伴う全エントリーの重み減衰処理
     * @private
     */
    _decayWeights() {
        const expiredKeys = [];

        for (const [key, entry] of this.trackedMonsters.entries()) {
            const prevStatus = entry.decayStatus;
            this._updateEntryDecay(entry);

            if (prevStatus === 'VISIBLE' && entry.decayStatus !== 'VISIBLE') {
                this._checkDisengage(entry, `decay_${entry.decayStatus.toLowerCase()}`);
            }

            if (entry.weight <= 0.0 || entry.decayStatus === 'EXPIRED') {
                this._checkDisengage(entry, 'expired');
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            this.trackedMonsters.delete(key);
        }
    }

    /**
     * 単一エントリーの減衰ステータス更新
     * @private
     */
    _updateEntryDecay(entry) {
        const deltaTurn = Math.max(0, this.currentTurn - entry.lastSeenTurn);

        if (entry.inLoS && deltaTurn === 0) {
            entry.weight = 1.0;
            entry.decayStatus = 'VISIBLE';
        } else if (deltaTurn <= 3) {
            entry.weight = 0.8;
            entry.decayStatus = 'NEARBY_UNSEEN';
        } else if (deltaTurn <= 7) {
            entry.weight = 0.4;
            entry.decayStatus = 'DECAYING';
        } else {
            entry.weight = 0.0;
            entry.decayStatus = 'EXPIRED';
        }
    }
}
