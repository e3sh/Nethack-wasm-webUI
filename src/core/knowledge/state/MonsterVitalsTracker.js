/**
 * MonsterVitalsTracker.js
 *
 * C コア由来の視認可能モンスタースナップショット (m_id キー) をターン確定ごとに比較し、
 * HP 減少・撃破を DamageEvent として導出する純粋状態クラス。
 * - fx_trigger の発行は行わない (GKLFxCoordinator の責務)
 * - グリフ・座標からの個体推定は行わない (MonsterTracker の責務)
 */
export class MonsterVitalsTracker {
    constructor() {
        /** @type {Map<number, Object>} */
        this.entries = new Map();
        /** @type {Map<number, number>} */
        this.prevDied = new Map();
        /** @type {Array<{x:number,y:number,byPlayer:boolean}>} */
        this.killHints = [];
        this.primed = false;
    }

    /**
     * 全状態のリセット (階層変更・リスタート時)
     */
    reset() {
        this.entries.clear();
        this.prevDied.clear();
        this.killHints = [];
        this.primed = false;
    }

    /**
     * 撃破メッセージ受信時のヒント登録 (GKLEventRouter.messageText から)
     * @param {{x?:number, y?:number, byPlayer?:boolean}} hint
     */
    noteKillMessage(hint) {
        if (!hint) return;
        this.killHints.push({
            x: hint.x ?? -1,
            y: hint.y ?? -1,
            byPlayer: Boolean(hint.byPlayer)
        });
    }

    /**
     * 視認可能モンスタースナップショットと前回状態を照合し、ダメージ・撃破イベント配列を導出
     * @param {import('../../index').VisibleMonsterSnapshot[]|null} snapshot
     * @param {{ getDied: (mnum:number) => (number|null) }} deps
     * @returns {import('../../index').MonsterDamageEvent[]}
     */
    reconcile(snapshot, { getDied }) {
        if (!Array.isArray(snapshot)) {
            this.killHints = [];
            return []; // 取得失敗時は状態を変更しない (誤差分防止)
        }

        const events = [];
        const next = new Map();

        if (this.primed) {
            // 1. 生存モンスターの HP 減少検知
            for (const cur of snapshot) {
                const prev = this.entries.get(cur.monsterId);
                if (prev && prev.monOffset === cur.monOffset && prev.maxHp === cur.maxHp && cur.hp < prev.hp) {
                    events.push(this._toEvent(prev, cur, cur.x, cur.y, prev.hp - cur.hp, false, false));
                }
            }
            // 2. 消失モンスターの撃破判定 (died 増加に基づく)
            events.push(...this._resolveDisappeared(snapshot, getDied));
        }

        for (const cur of snapshot) {
            next.set(cur.monsterId, { ...cur });
        }
        this.entries = next;
        this.prevDied = this._captureDied(next, getDied);
        this.killHints = [];
        this.primed = true;
        return events;
    }

    /**
     * 消失したモンスターについて svm.mvitals[].died と killHints を照合して撃破を同定
     * @private
     * @param {import('../../index').VisibleMonsterSnapshot[]} snapshot
     * @param {(mnum:number) => (number|null)} getDied
     * @returns {import('../../index').MonsterDamageEvent[]}
     */
    _resolveDisappeared(snapshot, getDied) {
        const seenIds = new Set(snapshot.map(m => m.monsterId));
        /** @type {Map<number, Object[]>} mnum -> 消失エントリリスト */
        const goneBySpecies = new Map();
        for (const prev of this.entries.values()) {
            if (seenIds.has(prev.monsterId)) continue;
            if (!goneBySpecies.has(prev.monOffset)) goneBySpecies.set(prev.monOffset, []);
            goneBySpecies.get(prev.monOffset).push(prev);
        }

        const events = [];
        for (const [mnum, gone] of goneBySpecies) {
            const before = this.prevDied.get(mnum);
            const after = typeof getDied === 'function' ? getDied(mnum) : null;
            if (before == null || after == null) continue;
            const deaths = after - before;
            if (deaths <= 0) continue; // テレポート・視界外離脱 (死亡数増加なし)

            let killed;
            if (gone.length <= deaths) {
                killed = gone;
            } else {
                // 消失数が死亡数より多い場合: ヒント座標と一致する個体のみを撃破判定
                killed = gone.filter(g => this._matchHints(g).length > 0);
                if (killed.length !== deaths) continue; // 依然として曖昧な場合は誤表示防止のため除外
            }

            for (const g of killed) {
                const byPlayer = this._matchHints(g).some(h => h.byPlayer);
                events.push(this._toEvent(g, null, g.x, g.y, g.hp, true, byPlayer));
            }
        }
        return events;
    }

    /**
     * エントリ座標に一致するヒントを取得 (チェビシェフ距離 <= 1、なければ座標不特定ヒント)
     * @private
     * @param {Object} entry
     * @returns {Array<{x:number, y:number, byPlayer:boolean}>}
     */
    _matchHints(entry) {
        const exact = this.killHints.filter(h =>
            h.x >= 0 && Math.max(Math.abs(h.x - entry.x), Math.abs(h.y - entry.y)) <= 1
        );
        if (exact.length > 0) return exact;
        return this.killHints.filter(h => h.x < 0 || h.y < 0);
    }

    /**
     * 現在のスナップショットに存在する種族の died 値を保存
     * @private
     * @param {Map<number, Object>} entries
     * @param {(mnum:number) => (number|null)} getDied
     * @returns {Map<number, number>}
     */
    _captureDied(entries, getDied) {
        const map = new Map();
        if (typeof getDied !== 'function') return map;
        for (const e of entries.values()) {
            if (map.has(e.monOffset)) continue;
            const v = getDied(e.monOffset);
            if (v != null) map.set(e.monOffset, v);
        }
        return map;
    }

    /**
     * @private
     */
    _toEvent(prev, cur, x, y, amount, isKill, byPlayer) {
        return {
            monsterId: prev.monsterId,
            monOffset: prev.monOffset,
            x,
            y,
            amount,
            prevHp: prev.hp,
            currentHp: cur ? cur.hp : 0,
            maxHp: prev.maxHp,
            isKill,
            amountIsLowerBound: isKill, // 撃破時は実ダメージ >= prevHp
            byPlayer,
            isPeaceful: Boolean(prev.peaceful),
            isTame: Boolean(prev.tame)
        };
    }
}
