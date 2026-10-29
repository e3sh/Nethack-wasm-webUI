/**
 * MessageTokenParser.js
 * Phase 2: ランタイム・トークンパーサー (V2: 物理コンテキスト制約 ＆ 事後検証ゲート統合)
 *
 * 第1トラック: 日常アイテム・所持品・足元バインド (Core Item & Inventory Track)
 * 第2トラック: 2層防壁戦闘メッセージ検出 (Direct Binding 物理状態 × SVO 構文解析)
 * 第3トラック: 浄化済静的型付きカタログ照合 (MessageTokenCatalog.js) ＋ 事後辞書検証ゲート
 *
 * 仕様書: docs/9_translation/semantic_message_tokenization_and_interactive_rendering_specification.ja.md
 */

import { TOKEN_PATTERNS, TOKEN_PREFIX_BUCKETS } from './data/MessageTokenCatalog.js';
import { MONSTER_KNOWLEDGE_MAP } from '../knowledge/data/MONSTER_KNOWLEDGE_FULL.js';
import { tokenKnowledgeResolver, TokenKnowledgeResolver } from './TokenKnowledgeResolver.js';

// 戦闘動詞定義 (attack.h, uhitm.c, mhitu.c)
const PLAYER_ATTACK_VERBS = [
    'hit', 'slash', 'stab', 'thrust', 'chop', 'hack', 'cleave',
    'smite', 'strike', 'punch', 'kick', 'miss'
];

const MONSTER_ATTACK_VERBS = [
    'hits', 'slashes', 'stabs', 'thrusts', 'chops', 'hacks', 'cleaves',
    'smites', 'strikes', 'punches', 'kicks', 'misses', 'bites', 'claws',
    'stings', 'touches', 'butts', 'engulfs', 'crushes', 'hugs'
];

const CHAIN_STATUS_PATTERNS = [
    'is killed!', 'dies!', 'is destroyed!', 'is poisoned!',
    'turns to stone!', 'freezes!', 'burns!', 'explodes!'
];

// 冠詞・修飾語の除去用正規表現
const ARTICLE_PREFIX_REGEX = /^(?:the\s+|an?\s+|your\s+|The\s+|An?\s+|Your\s+)/i;
const ADJECTIVE_PREFIX_REGEX = /^(?:blind\s+|invisible\s+|hallucinatory\s+|peaceful\s+|tame\s+|hostile\s+)/i;

// 第1トラック: 日常アイテム・所持品・足元バインド構文
const REGEX_INVENTORY_LINE = /^([a-zA-Z\$]\s+-\s+)(.+?)(\s+\(\d+\s+in\s+total\))?([\.\!]?)$/;
const REGEX_DROP_LINE = /^(You\s+drop\s+)(.+?)([\.\!])$/;
const REGEX_INVENTORY_ACTION_LINE = /^(You\s+(?:put\s+on|wear|take\s+off|remove|wield|read|quaff|eat|zap|apply)\s+)(.+?)([\.\!])$/;
const REGEX_LOOK_HERE_LINE = /^(You\s+(?:see|feel)\s+here\s+)(.+?)(\.)$/;
const REGEX_THERE_IS_HERE_LINE = /^(There\s+(?:is|are)\s+)(.+?)(\s+here\.)$/;
const REGEX_GOLD_SOLO_LINE = /^(\d+\s+gold\s+pieces?|a\s+gold\s+piece)([\.\!]?)$/i;

export class MessageTokenParser {
    /**
     * @param {Object} [options]
     * @param {Array} [options.patterns] カスタムパターン配列
     * @param {Object} [options.prefixBuckets] カスタムプレフィックスバケット
     * @param {Map} [options.monsterMap] カスタムモンスター辞書
     * @param {TokenKnowledgeResolver} [options.resolver] トークン知識解決エンジン
     */
    constructor(options = {}) {
        this.patterns = options.patterns || TOKEN_PATTERNS;
        this.prefixBuckets = options.prefixBuckets || TOKEN_PREFIX_BUCKETS;
        this.monsterMap = options.monsterMap || MONSTER_KNOWLEDGE_MAP;
        this.resolver = options.resolver || tokenKnowledgeResolver;

        // RegExp キャッシュ (d フラグ付き: hasIndices)
        this._regexCache = new Map();

        // 戦闘正規表現のコンパイル
        this._initCombatRegexes();
    }

    _initCombatRegexes() {
        const pVerbs = PLAYER_ATTACK_VERBS.join('|');
        const mVerbs = MONSTER_ATTACK_VERBS.join('|');

        // プレイヤー攻撃: "You hit the jackal." / "You miss the goblin."
        this._regexPlayerAttack = new RegExp(
            `^(You\\s+)(${pVerbs})(\\s+(?:the\\s+|an?\\s+)?)(.+?)([\\.\\!]?)$`,
            'd'
        );

        // モンスター攻撃: "The jackal bites you!" / "A goblin misses you." / "The dog bites the jackal."
        this._regexMonsterAttack = new RegExp(
            `^((?:The\\s+|An?\\s+)?)(.+?)(\\s+)(${mVerbs})(\\s+(?:you|the\\s+|an?\\s+)?)(.*)?([\\.\\!]?)$`,
            'd'
        );

        // 連鎖メッセージ: "The jackal is killed!" / "The newt dies!"
        const chainPhrases = CHAIN_STATUS_PATTERNS.map(p => p.replace('!', '\\!')).join('|');
        this._regexChainStatus = new RegExp(
            `^((?:The\\s+|An?\\s+)?)(.+?)(\\s+)(${chainPhrases})$`,
            'd'
        );
    }

    /**
     * パターン文字列から d フラグ付き RegExp を取得 (キャッシュ利用)
     */
    _getCompiledRegex(patternStr) {
        let re = this._regexCache.get(patternStr);
        if (!re) {
            try {
                re = new RegExp(patternStr, 'd');
            } catch (e) {
                // d フラグ非対応環境フォールバック
                re = new RegExp(patternStr);
            }
            this._regexCache.set(patternStr, re);
        }
        return re;
    }

    /**
     * 生テキストを解析して構造化トークン配列を返す
     * @param {string} rawText 原文メッセージ
     * @param {Object} [context] 実行時コンテキスト (gkl, contextFrameBuffer)
     * @returns {Array<Object>} MessageToken[]
     */
    parse(rawText, context = {}) {
        if (!rawText || typeof rawText !== 'string') {
            return [];
        }

        const trimmed = rawText.trim();
        if (!trimmed) {
            return [{
                type: 'text',
                text: rawText,
                range: [0, rawText.length],
                interactive: false
            }];
        }

        // 🌟 第1トラック: 日常アイテム・インベントリ・足元バインド
        const track1Tokens = this._parseTrack1CoreItem(rawText, context);
        if (track1Tokens) {
            return this._applyPostValidationGate(track1Tokens, context, rawText);
        }

        // ⚔️ 第2トラック: 2層防壁戦闘メッセージ検出
        const track2Tokens = this._parseTrack2Combat(rawText, context);
        if (track2Tokens) {
            return this._applyPostValidationGate(track2Tokens, context, rawText);
        }

        // 📡 第3トラック: 静的型付きカタログ照合 (MessageTokenCatalog.js)
        const track3Tokens = this._parseTrack3Catalog(rawText);
        if (track3Tokens) {
            return this._applyPostValidationGate(track3Tokens, context, rawText);
        }

        // 🛡️ フォールバック: 平文トークン
        return [{
            type: 'text',
            text: rawText,
            range: [0, rawText.length],
            interactive: false
        }];
    }

    /**
     * 【第1トラック】日常アイテム・所持品・足元バインド
     */
    _parseTrack1CoreItem(rawText, context) {
        // 1. 単独金貨メッセージ ("100 gold pieces." / "a gold piece.")
        const goldTokens = this._parseGoldSoloLine(rawText);
        if (goldTokens) return goldTokens;

        // 2. インベントリ・ピックアップ構文 (prinv: "f - 5 daggers.")
        const invTokens = this._parseInventoryLine(rawText);
        if (invTokens) return invTokens;

        // 3. ドロップ構文 ("You drop an uncursed +0 dagger.")
        const dropTokens = this._parseDropLine(rawText, context);
        if (dropTokens) return dropTokens;

        // 4. 所持品操作構文 ("You wield ...", "You wear ...")
        const actionTokens = this._parseInventoryActionLine(rawText, context);
        if (actionTokens) return actionTokens;

        // 5. 足元・フロア確認構文 ("You see here ...", "There is ... here.")
        const lookTokens = this._parseLookHereLine(rawText, context);
        if (lookTokens) return lookTokens;

        return null;
    }

    /**
     * 単独金貨メッセージ解析
     */
    _parseGoldSoloLine(rawText) {
        const m = REGEX_GOLD_SOLO_LINE.exec(rawText);
        if (!m) return null;
        const entityText = m[1];
        const punct = m[2] || '';
        return this._build3PartToken(rawText, '', entityText, punct, 'item', { category: 'gold' });
    }

    /**
     * インベントリ行 (prinv: "f - 5 daggers." / "a - an uncursed +1 long sword (weapon in hand).")
     */
    _parseInventoryLine(rawText) {
        const m = REGEX_INVENTORY_LINE.exec(rawText);
        if (!m) return null;
        const prefix = m[1];
        const entityText = m[2];
        const totalSuffix = m[3] || '';
        const punct = m[4] || '';
        const suffix = totalSuffix + punct;

        if (this.resolver.isIgnoredEntity(entityText)) {
            return null;
        }

        return this._build3PartToken(rawText, prefix, entityText, suffix, 'item', { category: 'inventory' });
    }

    /**
     * ドロップメッセージ ("You drop an uncursed +0 dagger.")
     */
    _parseDropLine(rawText, context) {
        const m = REGEX_DROP_LINE.exec(rawText);
        if (!m) return null;
        const prefix = m[1];
        const entityText = m[2];
        const punct = m[3] || '';

        if (this.resolver.isIgnoredEntity(entityText)) {
            return null;
        }

        return this._build3PartToken(rawText, prefix, entityText, punct, 'item', { action: 'drop' });
    }

    /**
     * 所持品操作構文 ("You put on ...", "You wield ...", "You eat ...")
     */
    _parseInventoryActionLine(rawText, context) {
        const m = REGEX_INVENTORY_ACTION_LINE.exec(rawText);
        if (!m) return null;
        const prefix = m[1];
        const entityText = m[2];
        const punct = m[3] || '';

        if (this.resolver.isIgnoredEntity(entityText)) {
            return null;
        }

        return this._build3PartToken(rawText, prefix, entityText, punct, 'item', { action: 'use' });
    }

    /**
     * 足元・フロア確認構文 ("You see here ...", "There is ... here.")
     */
    _parseLookHereLine(rawText, context) {
        const m1 = REGEX_LOOK_HERE_LINE.exec(rawText);
        if (m1) {
            const prefix = m1[1];
            const entityText = m1[2];
            const punct = m1[3] || '';

            if (this.resolver.isIgnoredEntity(entityText)) {
                return [{
                    type: 'text',
                    text: rawText,
                    range: [0, rawText.length],
                    interactive: false
                }];
            }

            return this._build3PartToken(rawText, prefix, entityText, punct, 'item', { context: 'floor' });
        }

        const m2 = REGEX_THERE_IS_HERE_LINE.exec(rawText);
        if (m2) {
            const prefix = m2[1];
            const entityText = m2[2];
            const suffix = m2[3];

            if (this.resolver.isIgnoredEntity(entityText)) {
                return [{
                    type: 'text',
                    text: rawText,
                    range: [0, rawText.length],
                    interactive: false
                }];
            }

            return this._build3PartToken(rawText, prefix, entityText, suffix, 'item', { context: 'floor' });
        }

        return null;
    }

    /**
     * 接頭辞・対象名詞句・接尾辞から range 整合性を保ったトークン列を構築
     */
    _build3PartToken(rawText, prefix, entityText, suffix, entityType, meta = {}) {
        const pLen = prefix ? prefix.length : 0;
        const eLen = entityText.length;
        const sLen = suffix ? suffix.length : 0;

        const isIgnored = this.resolver.isIgnoredEntity(entityText);
        const isInteractive = !isIgnored && (entityType === 'item' || entityType === 'monster');

        const tokens = [];
        if (pLen > 0) {
            tokens.push({
                type: 'text',
                text: prefix,
                range: [0, pLen],
                interactive: false
            });
        }

        tokens.push({
            type: isInteractive ? entityType : 'text',
            text: entityText,
            range: [pLen, pLen + eLen],
            interactive: isInteractive,
            ...(isInteractive && meta ? { meta: { ...meta } } : {})
        });

        if (sLen > 0) {
            tokens.push({
                type: 'text',
                text: suffix,
                range: [pLen + eLen, rawText.length],
                interactive: false
            });
        }

        return tokens;
    }

    /**
     * 【第2トラック】2層防壁戦闘メッセージ検出
     */
    _parseTrack2Combat(rawText, context) {
        // 🧱 第1防壁: 物理状態遷移ゲート
        if (!this._checkPhysicalCombatGate(context)) {
            return null; // 非戦闘コンテキストでは戦闘パーサーを完全バイパス (誤検出率 0%)
        }

        // 🧱 第2防壁: S-V-O 構文解析 × モンスター辞書完全一致
        return this._evaluateSVOCombat(rawText);
    }

    /**
     * 第1防壁: 物理状態ゲート判定
     * putstr (Phase 2) 時点で参照可能な Direct Binding 状態およびフレーム情報を検証
     */
    _checkPhysicalCombatGate(context) {
        const gkl = context.gkl;
        if (!gkl) {
            // GKL が提供されていない場合は安全のため ContextFrameBuffer または単体テストモードをチェック
            return Boolean(context.isCombatContext || context.forceCombatCheck);
        }

        // 1. 直前のユーザー入力が隣接敵への攻撃キー (GKLFxCoordinator.lastAttackTarget)
        const fx = gkl.fxCoordinator;
        if (fx && fx.lastAttackTarget) {
            const age = Date.now() - (fx.lastAttackTarget.timestamp || 0);
            if (age < 2000) { // 2秒以内の直近攻撃アクション
                return true;
            }
        }

        // 2. 直近フレームバッファで戦闘・ダメージ状況が検知されているか
        const fb = context.contextFrameBuffer;
        if (fb && typeof fb.getRecent === 'function') {
            const recent = fb.getRecent(3);
            for (const f of recent) {
                if (f.rawText && /hits|bites|claws|attacks|is killed|dies/i.test(f.rawText)) {
                    return true;
                }
            }
        }

        // 3. 視界内または隣接マスにモンスターが存在するか (AreaStateManager / MonsterTracker)
        const mt = gkl.monsterTracker;
        if (mt && typeof mt.getTrackedMonsters === 'function') {
            const monsters = mt.getTrackedMonsters();
            if (monsters && monsters.length > 0) {
                return true;
            }
        }

        const asm = gkl.areaStateManager;
        if (asm && typeof asm.getMonstersInView === 'function') {
            const inView = asm.getMonstersInView();
            if (inView && inView.length > 0) {
                return true;
            }
        }

        // 明示的フラグ (テスト用)
        if (context.isCombatContext || context.forceCombatCheck) {
            return true;
        }

        return false;
    }

    /**
     * 第2防壁: S-V-O 構文解析
     */
    _evaluateSVOCombat(rawText) {
        // パターンA: プレイヤー攻撃 ("You hit the jackal.")
        let match = this._regexPlayerAttack.exec(rawText);
        if (match && match.indices) {
            const targetRaw = match[4];
            if (this.resolver.isIgnoredEntity(targetRaw)) {
                return null;
            }
            const cleanTarget = this._cleanMonsterName(targetRaw);
            if (this._isKnownMonster(cleanTarget)) {
                const targetRange = match.indices[4];
                return [
                    {
                        type: 'text',
                        text: rawText.slice(0, targetRange[0]),
                        range: [0, targetRange[0]],
                        interactive: false
                    },
                    {
                        type: 'monster',
                        text: targetRaw,
                        range: targetRange,
                        interactive: true,
                        meta: { combatRole: 'target' }
                    },
                    {
                        type: 'text',
                        text: rawText.slice(targetRange[1]),
                        range: [targetRange[1], rawText.length],
                        interactive: false
                    }
                ];
            }
        }

        // パターンB: モンスター攻撃 ("The jackal bites you!" / "A goblin misses you.")
        match = this._regexMonsterAttack.exec(rawText);
        if (match && match.indices) {
            const attackerRaw = match[2];
            if (this.resolver.isIgnoredEntity(attackerRaw)) {
                return null;
            }
            const cleanAttacker = this._cleanMonsterName(attackerRaw);
            if (this._isKnownMonster(cleanAttacker)) {
                const attackerRange = match.indices[2];
                const tokens = [];

                if (attackerRange[0] > 0) {
                    tokens.push({
                        type: 'text',
                        text: rawText.slice(0, attackerRange[0]),
                        range: [0, attackerRange[0]],
                        interactive: false
                    });
                }

                tokens.push({
                    type: 'monster',
                    text: attackerRaw,
                    range: attackerRange,
                    interactive: true,
                    meta: { combatRole: 'attacker' }
                });

                // 目的語がモンスターの場合の検査 (例: "The dog bites the jackal.")
                const targetRaw = match[6];
                if (targetRaw && match.indices[6]) {
                    if (this.resolver.isIgnoredEntity(targetRaw)) {
                        return null;
                    }
                    const cleanTarget = this._cleanMonsterName(targetRaw);
                    const targetRange = match.indices[6];

                    if (this._isKnownMonster(cleanTarget)) {
                        tokens.push({
                            type: 'text',
                            text: rawText.slice(attackerRange[1], targetRange[0]),
                            range: [attackerRange[1], targetRange[0]],
                            interactive: false
                        });
                        tokens.push({
                            type: 'monster',
                            text: targetRaw,
                            range: targetRange,
                            interactive: true,
                            meta: { combatRole: 'target' }
                        });
                        if (targetRange[1] < rawText.length) {
                            tokens.push({
                                type: 'text',
                                text: rawText.slice(targetRange[1]),
                                range: [targetRange[1], rawText.length],
                                interactive: false
                            });
                        }
                        return tokens;
                    }
                }

                if (attackerRange[1] < rawText.length) {
                    tokens.push({
                        type: 'text',
                        text: rawText.slice(attackerRange[1]),
                        range: [attackerRange[1], rawText.length],
                        interactive: false
                    });
                }

                return tokens;
            }
        }

        // パターンC: 連鎖撃破・状態 ("The jackal is killed!" / "The newt dies!")
        match = this._regexChainStatus.exec(rawText);
        if (match && match.indices) {
            const subjectRaw = match[2];
            if (this.resolver.isIgnoredEntity(subjectRaw)) {
                return null;
            }
            const cleanSubject = this._cleanMonsterName(subjectRaw);
            if (this._isKnownMonster(cleanSubject)) {
                const subjectRange = match.indices[2];
                const tokens = [];

                if (subjectRange[0] > 0) {
                    tokens.push({
                        type: 'text',
                        text: rawText.slice(0, subjectRange[0]),
                        range: [0, subjectRange[0]],
                        interactive: false
                    });
                }

                tokens.push({
                    type: 'monster',
                    text: subjectRaw,
                    range: subjectRange,
                    interactive: true,
                    meta: { combatRole: 'target' }
                });

                if (subjectRange[1] < rawText.length) {
                    tokens.push({
                        type: 'text',
                        text: rawText.slice(subjectRange[1]),
                        range: [subjectRange[1], rawText.length],
                        interactive: false
                    });
                }

                return tokens;
            }
        }

        return null;
    }

    /**
     * 冠詞や形容詞を除去して基底モンスター名を抽出
     */
    _cleanMonsterName(nameStr) {
        if (!nameStr) return '';
        let cleaned = nameStr.trim();
        cleaned = cleaned.replace(ARTICLE_PREFIX_REGEX, '');
        cleaned = cleaned.replace(ADJECTIVE_PREFIX_REGEX, '');
        return cleaned.trim().toLowerCase();
    }

    /**
     * MONSTER_KNOWLEDGE_MAP (384種) に完全一致するか判定
     */
    _isKnownMonster(nameLower) {
        if (!nameLower || !this.monsterMap) return false;
        return this.monsterMap.has(nameLower);
    }

    /**
     * 【第3トラック】静的型付きカタログ照合
     */
    _parseTrack3Catalog(rawText) {
        if (!this.patterns || !this.prefixBuckets) return null;

        // プレフィックスバケットの決定
        let candidateIndices = null;
        for (const pfix of ['You ', 'Your ', 'The ', 'An ', 'A ', 'It ']) {
            if (rawText.startsWith(pfix)) {
                candidateIndices = this.prefixBuckets[pfix];
                break;
            }
        }
        if (!candidateIndices) {
            candidateIndices = this.prefixBuckets['*'] || [];
        }

        for (const idx of candidateIndices) {
            const entry = this.patterns[idx];
            if (!entry) continue;

            const [patternStr, tokenTypes, id, callee, file] = entry;
            const re = this._getCompiledRegex(patternStr);
            const match = re.exec(rawText);

            if (match) {
                return this._buildTokensFromMatch(rawText, match, tokenTypes, { id, callee, file });
            }
        }

        return null;
    }

    /**
     * 正規表現マッチ結果とトークン型配列から完全な MessageToken[] を構築
     */
    _buildTokensFromMatch(rawText, match, tokenTypes, meta = {}) {
        const tokens = [];
        const indices = match.indices; // d フラグによる [start, end] 配列

        // indices が利用可能な場合 (モダン環境)
        if (indices && indices.length > 1) {
            let lastPos = 0;

            for (let i = 1; i < indices.length; i++) {
                const groupRange = indices[i];
                if (!groupRange) continue;

                const [start, end] = groupRange;
                const tokenType = tokenTypes[i - 1] || 'text';

                // 前のトークンとの間の平文部分
                if (start > lastPos) {
                    tokens.push({
                        type: 'text',
                        text: rawText.slice(lastPos, start),
                        range: [lastPos, start],
                        interactive: false
                    });
                }

                const capturedText = rawText.slice(start, end);
                const isIgnored = this.resolver.isIgnoredEntity(capturedText);
                const isInteractive = !isIgnored && (tokenType === 'monster' || tokenType === 'item');

                tokens.push({
                    type: isInteractive ? tokenType : 'text',
                    text: capturedText,
                    range: [start, end],
                    interactive: isInteractive,
                    ...(isInteractive && meta ? { meta: { ...meta } } : {})
                });

                lastPos = end;
            }

            // 残りの末尾テキスト
            if (lastPos < rawText.length) {
                tokens.push({
                    type: 'text',
                    text: rawText.slice(lastPos, rawText.length),
                    range: [lastPos, rawText.length],
                    interactive: false
                });
            }

            return tokens;
        }

        // indices が利用できない環境用の位置スライスフォールバック
        return this._buildTokensFallback(rawText, match, tokenTypes, meta);
    }

    /**
     * indices 非対応環境でのフォールバックスライス
     */
    _buildTokensFallback(rawText, match, tokenTypes, meta) {
        const tokens = [];
        let cursor = 0;

        for (let i = 1; i < match.length; i++) {
            const captured = match[i];
            if (captured === undefined) continue;

            const tokenType = tokenTypes[i - 1] || 'text';
            const start = rawText.indexOf(captured, cursor);
            if (start === -1) continue;

            if (start > cursor) {
                tokens.push({
                    type: 'text',
                    text: rawText.slice(cursor, start),
                    range: [cursor, start],
                    interactive: false
                });
            }

            const end = start + captured.length;
            const isIgnored = this.resolver.isIgnoredEntity(captured);
            const isInteractive = !isIgnored && (tokenType === 'monster' || tokenType === 'item');

            tokens.push({
                type: isInteractive ? tokenType : 'text',
                text: captured,
                range: [start, end],
                interactive: isInteractive,
                ...(isInteractive && meta ? { meta: { ...meta } } : {})
            });

            cursor = end;
        }

        if (cursor < rawText.length) {
            tokens.push({
                type: 'text',
                text: rawText.slice(cursor, rawText.length),
                range: [cursor, rawText.length],
                interactive: false
            });
        }

        return tokens;
    }

    /**
     * 事後辞書検証ゲート (Post-Match Validation Gate)
     * 抽出されたトークンが環境遮断語彙に該当するか、または辞書/GKLで解決可能か検証する。
     * 解決できないトークンは type: 'text', interactive: false に降格。
     */
    _applyPostValidationGate(tokens, context, rawText) {
        if (!tokens || !Array.isArray(tokens)) return tokens;

        let hasInteractive = false;
        const validatedTokens = tokens.map(token => {
            if (!token.interactive) {
                return token;
            }

            // 環境・地形遮断リスト判定
            if (this.resolver.isIgnoredEntity(token.text)) {
                return {
                    ...token,
                    type: 'text',
                    interactive: false
                };
            }

            // 辞書・GKL 実在性検証 (軽量判定で翻訳イベント発火などの副作用を完全防止)
            const canResolve = typeof this.resolver.canResolve === 'function'
                ? this.resolver.canResolve(token, context.gkl)
                : Boolean(this.resolver.resolveTokenKnowledge(token, context.gkl));

            if (!canResolve) {
                // 辞書にもコンテキストにも存在しない死にリンクは平文へ降格
                return {
                    ...token,
                    type: 'text',
                    interactive: false
                };
            }

            hasInteractive = true;
            return token;
        });

        // もしすべてのトークンが interactive: false になった場合、単一平文トークンに統合
        if (!hasInteractive) {
            return [{
                type: 'text',
                text: rawText,
                range: [0, rawText.length],
                interactive: false
            }];
        }

        return validatedTokens;
    }
}

export default MessageTokenParser;
