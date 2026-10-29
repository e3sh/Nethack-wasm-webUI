import { isShopkeeperMonster } from "../engines/glyphClassifier.js";
import { MONSTER_KNOWLEDGE_MAP } from "../data/MONSTER_KNOWLEDGE_FULL.js";

/**
 * GKLFxCoordinator
 * 攻撃ヒット (ATTACK_HIT)、被ダメージ (DAMAGE_TAKEN)、与ダメージ (DAMAGE_DEALT)、回復 (RECOVER_HEAL)、
 * プレイヤー死亡/蘇生 (PLAYER_DIED / PLAYER_RESURRECTED)、モンスター撃破 (KILL_CONFIRMED)、
 * エリア突入 (AREA_ENTERED) の視覚演出トリガー (fx_trigger) と関連する内部状態を管理する。
 */
export class GKLFxCoordinator {
    /**
     * @param {import('../GKLPlugin.js').GKLPlugin} plugin
     */
    constructor(plugin) {
        this.plugin = plugin;
        this.isPlayerDead = false;
        this.lastAttackTarget = null;
        this.prevHp = null;
        this.prevAc = null;
        this.emittedFxList = [];
    }

    /**
     * 状態の初期化
     */
    reset() {
        this.prevHp = null;
        this.prevAc = null;
        this.lastAttackTarget = null;
        this.isPlayerDead = false;
    }

    /**
     * 方向キー・トークンから相対オフセット {dx, dy} を取得
     * @param {string} dirKey
     * @returns {{dx: number, dy: number}|null}
     */
    getDirOffset(dirKey) {
        if (!dirKey) return null;
        const str = String(dirKey).trim();
        const map = {
            'k': { dx: 0, dy: -1 }, 'DIR_N': { dx: 0, dy: -1 }, '8': { dx: 0, dy: -1 }, 'N': { dx: 0, dy: -1 },
            'l': { dx: 1, dy: 0 }, 'DIR_E': { dx: 1, dy: 0 }, '6': { dx: 1, dy: 0 }, 'E': { dx: 1, dy: 0 },
            'j': { dx: 0, dy: 1 }, 'DIR_S': { dx: 0, dy: 1 }, '2': { dx: 0, dy: 1 }, 'S': { dx: 0, dy: 1 },
            'h': { dx: -1, dy: 0 }, 'DIR_W': { dx: -1, dy: 0 }, '4': { dx: -1, dy: 0 }, 'W': { dx: -1, dy: 0 },
            'u': { dx: 1, dy: -1 }, 'DIR_NE': { dx: 1, dy: -1 }, '9': { dx: 1, dy: -1 }, 'NE': { dx: 1, dy: -1 },
            'y': { dx: -1, dy: -1 }, 'DIR_NW': { dx: -1, dy: -1 }, '7': { dx: -1, dy: -1 }, 'NW': { dx: -1, dy: -1 },
            'n': { dx: 1, dy: 1 }, 'DIR_SE': { dx: 1, dy: 1 }, '3': { dx: 1, dy: 1 }, 'SE': { dx: 1, dy: 1 },
            'b': { dx: -1, dy: 1 }, 'DIR_SW': { dx: -1, dy: 1 }, '1': { dx: -1, dy: 1 }, 'SW': { dx: -1, dy: 1 },
        };
        return map[str] || null;
    }

    /**
     * 演出トリガーイベント (fx_trigger) を安全に発行
     * @param {Object} payload
     */
    emitFxTrigger(payload) {
        const fullPayload = {
            timestamp: Date.now(),
            ...payload
        };
        if (this.emittedFxList) {
            this.emittedFxList.push(fullPayload);
            if (this.emittedFxList.length > 20) this.emittedFxList.shift();
        }
        const core = this.plugin?.core;
        if (!core || typeof core.emit !== 'function') return;
        core.emit('fx_trigger', fullPayload);
    }

    /**
     * 単一方向キー入力による近接攻撃 (ATTACK_HIT) の判定と発火
     * @param {string|number} key
     */
    checkMeleeAttackFromKey(key) {
        const p = this.plugin;
        if (!p.areaStateManager || this.isPlayerDead) return;
        const offset = p._getDirOffset(key);
        if (!offset) return;

        const px = p.areaStateManager.playerX;
        const py = p.areaStateManager.playerY;
        const tx = px + offset.dx;
        const ty = py + offset.dy;
        const targetCell = p.areaStateManager.grid?.[ty]?.[tx];
        const top = targetCell?.top;

        let directMon = top?.directState || null;
        if (!directMon && p.wasmDirectBindingService && typeof p.wasmDirectBindingService.isAvailable === 'function' && p.wasmDirectBindingService.isAvailable()) {
            directMon = p.wasmDirectBindingService.getFullMonsterAt(tx, ty);
        }

        const isPet = (top && (top.type === 'PET' || top.isPet || top.isTame || top.glyphInfo?.isPet)) ||
                      Boolean(directMon?.tame);

        const monOffset = top ? (top.monOffset !== undefined ? top.monOffset : (top.subType !== undefined ? top.subType : top.glyphInfo?.monOffset)) : undefined;
        const monKnowledge = (monOffset !== undefined && MONSTER_KNOWLEDGE_MAP) ? MONSTER_KNOWLEDGE_MAP.get(monOffset) : null;
        const isExplicitHostile = top && (
            top.isHostile ||
            top.attitude === 'HOSTILE' ||
            top.glyphInfo?.isHostile ||
            top.glyphInfo?.attitude === 'HOSTILE' ||
            top.dynamicState?.isHostile
        );

        const isPeaceful = ((top && (
            top.isPeaceful ||
            top.peaceful ||
            top.attitude === 'PEACEFUL' ||
            top.dynamicState?.isPeaceful ||
            top.glyphInfo?.isPeaceful ||
            top.glyphInfo?.peaceful ||
            monKnowledge?.defaultPeaceful ||
            /\b(peaceful|平和)\b/i.test(top.name || top.glyphInfo?.name || '')
        )) || Boolean(directMon?.peaceful)) && !isExplicitHostile;

        const isShopkeeper = (top && (
            top.isShopkeeper ||
            top.glyphInfo?.isShopkeeper ||
            isShopkeeperMonster(top) ||
            isShopkeeperMonster(top.glyphInfo) ||
            /\b(shopkeeper|店主)\b/i.test(top.name || top.glyphInfo?.name || '')
        )) || Boolean(directMon?.isShopkeeper);

        const isPriest = (top && (
            top.isPriest ||
            top.glyphInfo?.isPriest
        )) || Boolean(directMon?.isPriest);

        if (top && top.type === 'MONSTER' && !isPet && !isPeaceful && !isShopkeeper && !isPriest) {
            this.lastAttackTarget = { x: tx, y: ty, timestamp: Date.now() };
            p.emitFxTrigger({
                type: 'ATTACK_HIT',
                targetX: tx,
                targetY: ty
            });
        }
    }

    /**
     * ContextAction 実行時の近接攻撃 (ATTACK_HIT) の判定と発火
     * @param {Object} action
     */
    checkMeleeAttackFromAction(action) {
        const p = this.plugin;
        if (!action || this.isPlayerDead) return;

        const isMeleeAttack = action.id?.startsWith('ACTION_ATTACK_') ||
            (action.category === 'COMBAT' && action.target !== 'ranged' && !action.id?.startsWith('ACTION_FIRE_')) ||
            (action.isAttack && !action.isRanged && action.target !== 'ranged');

        if (!isMeleeAttack) return;

        const dirKey = action.dirCode || action.directionKey || action.direction;
        const offset = p._getDirOffset(dirKey);
        const px = p.areaStateManager ? p.areaStateManager.playerX : 0;
        const py = p.areaStateManager ? p.areaStateManager.playerY : 0;
        const tx = action.targetPos?.x ?? (offset ? px + offset.dx : px);
        const ty = action.targetPos?.y ?? (offset ? py + offset.dy : py);

        const targetCell = p.areaStateManager?.grid?.[ty]?.[tx];
        const top = targetCell?.top;
        let directMon = top?.directState || null;
        if (!directMon && p.wasmDirectBindingService && typeof p.wasmDirectBindingService.isAvailable === 'function' && p.wasmDirectBindingService.isAvailable()) {
            directMon = p.wasmDirectBindingService.getFullMonsterAt(tx, ty);
        }
        const isPet = (top && (top.type === 'PET' || top.isPet || top.isTame)) || Boolean(directMon?.tame);
        const isPeaceful = (top && (top.isPeaceful || top.attitude === 'PEACEFUL')) || Boolean(directMon?.peaceful);
        const isShopkeeper = (top && top.isShopkeeper) || Boolean(directMon?.isShopkeeper);
        const isPriest = (top && top.isPriest) || Boolean(directMon?.isPriest);

        if (!isPet && !isPeaceful && !isShopkeeper && !isPriest) {
            this.lastAttackTarget = { x: tx, y: ty, timestamp: Date.now() };
            p.emitFxTrigger({
                type: 'ATTACK_HIT',
                targetX: tx,
                targetY: ty
            });
        }
    }

    /**
     * メッセージテキストからのプレイヤー死亡・蘇生検知
     * @param {string} text
     * @param {number} px
     * @param {number} py
     */
    checkMessageDeathOrResurrection(text, px, py) {
        const p = this.plugin;
        if (/^You die\.\.\./.test(text)) {
            this.isPlayerDead = true;
            p.emitFxTrigger({
                type: 'PLAYER_DIED',
                targetX: px,
                targetY: py,
                isPlayer: true,
                text: text
            });
        }

        if (/Your amulet shines|OK, so you don't|survived that attempt|averted death/.test(text)) {
            this.isPlayerDead = false;
            p.emitFxTrigger({
                type: 'PLAYER_RESURRECTED',
                targetX: px,
                targetY: py,
                isPlayer: true,
                text: text
            });
        }
    }

    /**
     * モンスター撃破時の KILL_CONFIRMED 発火
     * @param {Object} killedInfo
     */
    onMonsterKilled(killedInfo) {
        if (!killedInfo) return;
        const tx = killedInfo.lastKnownPos?.x ?? this.lastAttackTarget?.x;
        const ty = killedInfo.lastKnownPos?.y ?? this.lastAttackTarget?.y;
        this.plugin.emitFxTrigger({
            type: 'KILL_CONFIRMED',
            targetX: tx,
            targetY: ty
        });
    }

    /**
     * 新規ダンジョンブランチ突入時の AREA_ENTERED 発火
     * @param {Object} areaInfo
     */
    onAreaEntered(areaInfo) {
        if (!areaInfo || areaInfo.isNewBranch === false) return;
        const dlevel = areaInfo.dlevel ?? 1;
        this.emitFxTrigger({
            type: 'AREA_ENTERED',
            branchId: areaInfo.branchId,
            floorKey: areaInfo.floorKey,
            dlevel,
            title: areaInfo.branchName || areaInfo.title || 'Dungeon',
            titleJa: areaInfo.branchNameJa || areaInfo.titleJa || areaInfo.branchName || 'ダンジョン',
            subtitle: areaInfo.subtitle || `Level ${dlevel}`,
            subtitleJa: areaInfo.subtitleJa || `地下 ${dlevel} 階`,
            theme: areaInfo.theme || 'dungeon',
            bannerDurationMs: areaInfo.bannerDurationMs || 4000
        });
    }

    /**
     * MonsterVitalsTracker の差分結果を DAMAGE_DEALT として発行
     * @param {import('../../index').MonsterDamageEvent[]} events
     */
    emitDamageEvents(events) {
        if (!Array.isArray(events) || events.length === 0 || this.isPlayerDead) return;
        for (const ev of events) {
            if (!(ev.amount > 0)) continue;
            this.plugin.emitFxTrigger({
                type: 'DAMAGE_DEALT',
                targetX: ev.x,
                targetY: ev.y,
                isPlayer: false,
                monsterId: ev.monsterId,
                monOffset: ev.monOffset,
                amount: ev.amount,
                prevHp: ev.prevHp,
                currentHp: ev.currentHp,
                maxHp: ev.maxHp,
                isKill: ev.isKill,
                amountIsLowerBound: ev.amountIsLowerBound,
                byPlayer: ev.byPlayer,
                isPeaceful: ev.isPeaceful,
                isTame: ev.isTame
            });
        }
    }

    /**
     * HP 変動時の被ダメージ・回復・フェイルセーフ蘇生検知
     * @param {number|string} value
     */
    checkHpTransition(value) {
        const p = this.plugin;
        const newHp = typeof value === 'number' ? value : parseInt(value, 10);
        if (isNaN(newHp)) return;

        if (this.prevHp !== null && this.prevHp !== undefined) {
            const px = p.areaStateManager ? p.areaStateManager.playerX : 0;
            const py = p.areaStateManager ? p.areaStateManager.playerY : 0;
            const st = p.statusAccessor?.getStatus();
            const maxHp = st?.hp?.max || newHp;

            // 💀 死亡状態からHPが正の値に回復した際のフェイルセーフ蘇生復帰
            if (this.isPlayerDead && newHp > 0) {
                this.isPlayerDead = false;
                p.emitFxTrigger({
                    type: 'PLAYER_RESURRECTED',
                    targetX: px,
                    targetY: py,
                    isPlayer: true,
                    text: 'Resurrected (HP restored)'
                });
            }

            if (newHp < this.prevHp) {
                p.emitFxTrigger({
                    type: 'DAMAGE_TAKEN',
                    targetX: px,
                    targetY: py,
                    isPlayer: true,
                    amount: this.prevHp - newHp,
                    currentHp: newHp,
                    maxHp
                });
            } else if (newHp > this.prevHp) {
                p.emitFxTrigger({
                    type: 'RECOVER_HEAL',
                    targetX: px,
                    targetY: py,
                    isPlayer: true,
                    amount: newHp - this.prevHp,
                    currentHp: newHp,
                    maxHp
                });
            }
        }
        this.prevHp = newHp;
    }

    /**
     * AC 変動検知 (防具着脱・破壊・腐食によるインベントリ無効化トリガー)
     * @param {number|string} value
     * @returns {boolean} ACが変化したかどうか
     */
    checkAcTransition(value) {
        let parsedAc = null;
        if (typeof value === 'number') {
            parsedAc = isNaN(value) ? null : value;
        } else if (typeof value === 'string') {
            const match = value.match(/-?\d+/);
            if (match) parsedAc = parseInt(match[0], 10);
        }
        if (parsedAc !== null) {
            const changed = (this.prevAc !== null && this.prevAc !== undefined && this.prevAc !== parsedAc);
            this.prevAc = parsedAc;
            return changed;
        }
        return false;
    }
}
