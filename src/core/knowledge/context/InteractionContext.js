/**
 * InteractionContext.js
 * Game Knowledge Layer (GKL) - 対話・対峙コンテキスト管理サブステート
 *
 * 【アーキテクチャ上の責務】
 * 1. 空間・オブジェクト対峙文脈 (Spatial / Proximity):
 *    - 足元 (atFeet) および隣接 (adjacent) の対象 (箱、扉、アイテム、祭壇等) を独立管理。
 *    - チェビシェフ距離 <= 1 に留まっている限り文脈を維持し、2歩離脱で安全に消去。
 * 2. 多重状況レイヤー (Multi-Layer Context):
 *    - 即時プロンプト文脈 (Immediate / Turn-local: Y/N、方向入力等、1入力で即クリア)。
 *    - 空間対峙文脈 (Spatial: 距離離脱または TTL 減衰でクリア)。
 *    - 戦闘・警戒文脈 (Combat: 被弾・交戦・隣接敵数・危険度 SAFE/NORMAL/WARNING/CRITICAL)。
 *    - 直前意図文脈 (Recent Intent: UNLOCK, FORCE, KICK, LOOT 等のアクション履歴)。
 * 3. 能力評価 (Capability Assessment):
 *    - 所持品マネージャーと連携し、鍵・開錠具・こじ開け用具・魔法の有無を即時判定。
 *
 * ※ブラウザネイティブ ESM 互換のため、import には必ず .js 拡張子を使用すること。
 */

export class InteractionContext {
    /**
     * @param {Object} [gkl=null] - GKLPlugin インスタンス
     * @param {Object} [options={}] - オプション設定
     */
    constructor(gkl = null, options = {}) {
        this.gkl = gkl;
        this.options = options;
        this.defaultTtl = options.defaultTtl !== undefined ? options.defaultTtl : 3;
        this.currentPos = { x: 0, y: 0 };
        this.currentTurn = 0;
        this.reset();
    }

    /**
     * ステートを初期化
     */
    reset() {
        // ① フォーカス候補群 (Multi-Focus Stack / Spatial Candidates)
        this.focusCandidates = {
            atFeet: null,       // 足元の対象 { type, name, isLocked, ttl, pos: { x, y } }
            adjacent: []        // 隣接する対象 [{ type, name, isLocked, direction, ttl, pos: { x, y } }]
        };

        // ② 戦闘・危険状態 (Combat Context)
        this.combat = {
            inCombat: false,        // 直近ターンでの被弾・交戦有無
            adjacentHostiles: 0,    // 隣接する敵対モンスター数
            dangerLevel: 'NORMAL',  // 'SAFE' | 'NORMAL' | 'WARNING' | 'CRITICAL'
            lastAttackedTurn: -1
        };

        // ③ 直前のアクション履歴
        this.lastAction = {
            turn: 0,
            command: null,
            attempt: null,          // 'UNLOCK', 'FORCE', 'KICK', 'LOOT' 等
            targetType: null
        };

        // ④ 即時プロンプト文脈 (Immediate / Turn-local)
        this.immediate = {
            active: false,
            type: null,             // 'YN' | 'DIRECTION' | 'ITEM' | 'POSKEY'
            prompt: null,
            timestamp: 0
        };
    }

    /**
     * プレイヤー座標の更新およびチェビシェフ距離判定による空間維持・安全消去
     * @param {number} x
     * @param {number} y
     */
    updatePlayerPosition(x, y) {
        if (typeof x !== 'number' || typeof y !== 'number') return;
        this.currentPos = { x, y };

        // 空間候補の距離チェック（チェビシェフ距離 <= 1 なら維持、> 1 なら消去）
        const candidates = [];
        if (this.focusCandidates.atFeet) {
            candidates.push(this.focusCandidates.atFeet);
        }
        for (const adj of this.focusCandidates.adjacent) {
            if (adj) candidates.push(adj);
        }

        const validCandidates = candidates.filter(target => {
            if (!target.pos || typeof target.pos.x !== 'number' || typeof target.pos.y !== 'number') {
                return false;
            }
            const dx = Math.abs(target.pos.x - x);
            const dy = Math.abs(target.pos.y - y);
            const chebyshevDist = Math.max(dx, dy);
            return chebyshevDist <= 1;
        });

        // 距離チェック通過候補を足元 (atFeet) と隣接 (adjacent) に再分類
        let newAtFeet = null;
        const newAdjacent = [];

        for (const item of validCandidates) {
            if (item.pos.x === x && item.pos.y === y) {
                if (!newAtFeet) {
                    newAtFeet = item;
                } else {
                    newAdjacent.push(item);
                }
            } else {
                newAdjacent.push(item);
            }
        }

        this.focusCandidates.atFeet = newAtFeet;
        this.focusCandidates.adjacent = newAdjacent;
    }

    /**
     * ターン進行と TTL 減衰
     * @param {number} [newTurn]
     */
    advanceTurn(newTurn = null) {
        if (typeof newTurn === 'number' && !isNaN(newTurn)) {
            this.currentTurn = newTurn;
        } else {
            this.currentTurn++;
        }

        // TTL 減衰処理 (atFeet)
        if (this.focusCandidates.atFeet) {
            if (typeof this.focusCandidates.atFeet.ttl === 'number') {
                this.focusCandidates.atFeet.ttl--;
                if (this.focusCandidates.atFeet.ttl <= 0) {
                    this.focusCandidates.atFeet = null;
                }
            }
        }

        // TTL 減衰処理 (adjacent)
        this.focusCandidates.adjacent = this.focusCandidates.adjacent.filter(item => {
            if (typeof item.ttl === 'number') {
                item.ttl--;
                return item.ttl > 0;
            }
            return true;
        });

        // 戦闘状態の沈静化（直近攻撃から 4 ターン以上経過で非戦闘化）
        if (this.combat.inCombat && this.combat.lastAttackedTurn >= 0) {
            if (this.currentTurn - this.combat.lastAttackedTurn > 3) {
                this.combat.inCombat = false;
                if (this.combat.dangerLevel === 'CRITICAL' || this.combat.dangerLevel === 'WARNING') {
                    this.combat.dangerLevel = 'NORMAL';
                }
            }
        }

        // 危険度の更新
        this._updateDangerLevel();
    }

    /**
     * フォーカス候補を登録
     * @param {Object} candidate - { type, name, isLocked, pos: {x, y}, direction?, ttl? }
     * @param {'atFeet'|'adjacent'} [preferredSlot='atFeet']
     */
    setFocus(candidate, preferredSlot = 'atFeet') {
        if (!candidate || !candidate.type) return;

        const targetPos = candidate.pos || { ...this.currentPos };
        const ttl = candidate.ttl !== undefined ? candidate.ttl : this.defaultTtl;

        const enrichedCandidate = {
            type: candidate.type,
            name: candidate.name || candidate.type.toLowerCase(),
            isLocked: candidate.isLocked !== undefined ? Boolean(candidate.isLocked) : false,
            pos: { x: targetPos.x, y: targetPos.y },
            direction: candidate.direction || null,
            ttl
        };

        const isSameAsPlayer = (targetPos.x === this.currentPos.x && targetPos.y === this.currentPos.y);

        if (preferredSlot === 'adjacent') {
            // 重複チェック（同一座標または同一タイプ・方向の既存候補を更新）
            const existingIdx = this.focusCandidates.adjacent.findIndex(adj =>
                (adj.pos.x === targetPos.x && adj.pos.y === targetPos.y) ||
                (adj.type === enrichedCandidate.type && adj.direction === enrichedCandidate.direction)
            );
            if (existingIdx >= 0) {
                this.focusCandidates.adjacent[existingIdx] = enrichedCandidate;
            } else {
                this.focusCandidates.adjacent.push(enrichedCandidate);
            }
        } else if (preferredSlot === 'atFeet' || isSameAsPlayer) {
            this.focusCandidates.atFeet = enrichedCandidate;
        } else {
            this.focusCandidates.adjacent.push(enrichedCandidate);
        }
    }

    /**
     * フォーカス候補のクリア
     * @param {string|null} [type=null] - 特定の type のみクリア、指定なしですべてクリア
     */
    clearFocus(type = null) {
        if (!type) {
            this.focusCandidates.atFeet = null;
            this.focusCandidates.adjacent = [];
            return;
        }
        if (this.focusCandidates.atFeet && this.focusCandidates.atFeet.type === type) {
            this.focusCandidates.atFeet = null;
        }
        this.focusCandidates.adjacent = this.focusCandidates.adjacent.filter(item => item.type !== type);
    }

    /**
     * 最適なフォーカス候補を取得（atFeet を優先し、なければ最初の adjacent を返却）
     * @returns {Object|null}
     */
    getPrimaryFocus() {
        if (this.focusCandidates.atFeet) {
            return this.focusCandidates.atFeet;
        }
        if (this.focusCandidates.adjacent.length > 0) {
            return this.focusCandidates.adjacent[0];
        }
        return null;
    }

    /**
     * 即時プロンプト文脈の設定
     * @param {Object} promptInfo - { type, prompt }
     */
    setImmediatePrompt(promptInfo) {
        if (!promptInfo) {
            this.clearImmediatePrompt();
            return;
        }
        this.immediate = {
            active: true,
            type: promptInfo.type || 'PROMPT',
            prompt: promptInfo.prompt || '',
            timestamp: Date.now()
        };
    }

    /**
     * 即時プロンプト文脈の破棄（1入力完了または ESC 時）
     */
    clearImmediatePrompt() {
        this.immediate = {
            active: false,
            type: null,
            prompt: null,
            timestamp: 0
        };
    }

    /**
     * 直前アクション履歴の記録
     * @param {string} command - キーまたはコマンド名
     * @param {string} [attempt=null] - 意図種別 ('UNLOCK', 'FORCE', 'KICK', 'LOOT' 等)
     * @param {string} [targetType=null]
     */
    recordAction(command, attempt = null, targetType = null) {
        this.lastAction = {
            turn: this.currentTurn,
            command,
            attempt,
            targetType
        };
        // 即時プロンプト文脈はアクション完了で自動クリア
        this.clearImmediatePrompt();
    }

    /**
     * 能力評価 (Capability Assessment)
     * 所持品マネージャー等から、現在の道具・魔法の有無を即時判定
     * @returns {Object}
     */
    assessCapabilities() {
        const inv = this.gkl ? this.gkl.inventoryStateManager : null;
        const spells = this.gkl ? this.gkl.spellStateManager : null;

        // 鍵・開錠具
        let hasKey = false;
        let keyItem = null;
        if (inv && typeof inv.getKeyOrLockPick === 'function') {
            keyItem = inv.getKeyOrLockPick();
            hasKey = Boolean(keyItem);
        } else if (inv && Array.isArray(inv.items)) {
            keyItem = inv.items.find(it => {
                const name = (it.name || it.rawText || '').toLowerCase();
                return name.includes('key') || name.includes('lock pick') || name.includes('skeleton key') || name.includes('credit card');
            }) || null;
            hasKey = Boolean(keyItem);
        }

        // 強制こじ開け道具 (バール、ツルハシ、斧等)
        let hasForceTool = false;
        let forceToolItem = null;
        if (inv && typeof inv.getPickAxe === 'function') {
            forceToolItem = inv.getPickAxe();
        }
        if (!forceToolItem && inv && typeof inv.getAxe === 'function') {
            forceToolItem = inv.getAxe();
        }
        if (!forceToolItem && inv && Array.isArray(inv.items)) {
            forceToolItem = inv.items.find(it => {
                const name = (it.name || it.rawText || '').toLowerCase();
                return name.includes('crowbar') || name.includes('pick-axe') || name.includes('axe') || name.includes('mattock');
            }) || null;
        }
        hasForceTool = Boolean(forceToolItem);

        // ノックの魔法 / 杖
        let hasKnock = false;
        if (spells && Array.isArray(spells.spells)) {
            hasKnock = spells.spells.some(sp => (sp.name || '').toLowerCase().includes('knock'));
        }
        if (!hasKnock && inv && Array.isArray(inv.items)) {
            hasKnock = inv.items.some(it => {
                const name = (it.name || it.rawText || '').toLowerCase();
                return name.includes('wand of opening') || name.includes('knock');
            });
        }

        return {
            hasKey,
            keyItem,
            hasForceTool,
            forceToolItem,
            hasKnock
        };
    }

    /**
     * 第1層 状況シグナル (situationSignal) の受信処理
     * @param {Object} signal - { type, context, ... }
     */
    handleSituationSignal(signal) {
        if (!signal) return;

        // 1. テキストメッセージ起因のシグナル
        if (signal.type === 'MESSAGE' && signal.context) {
            const ctx = signal.context;
            const domain = ctx.domain;
            const subDomain = ctx.subDomain;
            const tags = Array.isArray(ctx.tags) ? ctx.tags : [];

            // A. コンテナ関連
            if (domain === 'CONTAINER' || tags.includes('container')) {
                const isLocked = tags.includes('locked') || subDomain === 'LOCKED' || /locked/i.test(ctx.subDomain || '');
                const isUnlocked = tags.includes('unlocked') || subDomain === 'UNLOCKED';

                const targetName = ctx.params?.containerName || 'box';
                const currentPrimary = this.getPrimaryFocus();

                if (isLocked) {
                    this.setFocus({
                        type: 'CONTAINER',
                        name: targetName,
                        isLocked: true,
                        pos: { ...this.currentPos },
                        ttl: this.defaultTtl
                    }, 'atFeet');
                } else if (isUnlocked && currentPrimary && currentPrimary.type === 'CONTAINER') {
                    currentPrimary.isLocked = false;
                }
            }

            // B. 扉関連
            if (domain === 'DOOR' || tags.includes('door')) {
                const isLocked = tags.includes('locked') || subDomain === 'LOCKED';
                if (isLocked) {
                    this.setFocus({
                        type: 'DOOR',
                        name: 'door',
                        isLocked: true,
                        pos: { ...this.currentPos },
                        ttl: this.defaultTtl
                    }, 'adjacent');
                }
            }

            // C. 戦闘関連
            if (domain === 'COMBAT' || tags.includes('combat') || tags.includes('attack') || tags.includes('damage')) {
                this.combat.inCombat = true;
                this.combat.lastAttackedTurn = this.currentTurn;
                this._updateDangerLevel();
            }
        }

        // 2. プロンプト入力要求起因のシグナル
        if (signal.type === 'INPUT_REQUIRED' || signal.type === 'PROMPT') {
            this.setImmediatePrompt({
                type: signal.promptCategory || signal.inputType || 'PROMPT',
                prompt: signal.prompt || signal.rawPrompt || ''
            });
        }
    }

    /**
     * 危険度 (dangerLevel) の内部更新
     * @private
     */
    _updateDangerLevel() {
        // HP 割合による判定
        let hpRatio = 1.0;
        if (this.gkl && this.gkl.statusAccessor && typeof this.gkl.statusAccessor.getStatus === 'function') {
            const st = this.gkl.statusAccessor.getStatus();
            if (st && st.hp && st.hp.max > 0) {
                hpRatio = st.hp.current / st.hp.max;
            }
        }

        if (hpRatio <= 0.25) {
            this.combat.dangerLevel = 'CRITICAL';
        } else if (hpRatio <= 0.5 || (this.combat.inCombat && hpRatio <= 0.75)) {
            this.combat.dangerLevel = 'WARNING';
        } else if (this.combat.inCombat) {
            this.combat.dangerLevel = 'NORMAL';
        } else {
            this.combat.dangerLevel = 'SAFE';
        }
    }

    /**
     * 外部公開用のプレーンな状態オブジェクトを取得
     * @returns {Object}
     */
    getState() {
        return {
            focus: this.getPrimaryFocus(),
            focusCandidates: {
                atFeet: this.focusCandidates.atFeet ? { ...this.focusCandidates.atFeet } : null,
                adjacent: this.focusCandidates.adjacent.map(a => ({ ...a }))
            },
            combat: { ...this.combat },
            lastAction: { ...this.lastAction },
            immediate: { ...this.immediate },
            capabilities: this.assessCapabilities(),
            currentPos: { ...this.currentPos },
            currentTurn: this.currentTurn
        };
    }
}
