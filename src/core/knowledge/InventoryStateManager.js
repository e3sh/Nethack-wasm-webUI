/**
 * InventoryStateManager.js
 * 
 * プレイヤーのインベントリ（所持品）状態を管理・キャッシュし、
 * コンテキストアクションに必要なツール（ツルハシ・鍵・斧・杖等）の所持状況とインベントリレターを提供するマネージャー。
 */

import { GLYPH_OFFSETS, classifyGlyph, ENTITY_TYPES, getOnumFromGlyph, getItemInfoFromOnum } from './glyphClassifier.js';
import { OBJECT_KNOWLEDGE_MAP } from './OBJECT_KNOWLEDGE_FULL.js';

export class InventoryStateManager {
    constructor(options = {}) {
        // 所持品アイテムのリスト
        // item: { letter: 'f', name: 'pick-axe', rawText: '...', glyphId: 3707, onum: 259, isPickAxe: true, knowledge: {...} }
        this.items = [];
        this.isSynced = false; // 一度でもインベントリを同期したかフラグ
        this.structuredKnowledgeEngine = options.structuredKnowledgeEngine || null;
    }

    setStructuredKnowledgeEngine(ske) {
        this.structuredKnowledgeEngine = ske;
    }

    /**
     * キャッシュのリセット
     */
    reset() {
        this.items = [];
        this.isSynced = false;
    }

    /**
     * インベントリメニューダイアログ等のデータから全リストを更新・同期
     * @param {Array<Object>} menuItems - メニュー項目の配列 [{ letter: 'a', text: 'a blessed +1 pick-axe', glyph: 3707, onum: 259 }, ...]
     */
    /**
     * 自発同期(syncInventorySilent)等のメニュー項目からインベントリ全体を更新
     * @param {Array<Object>} menuItems - メニュー項目の配列
     */
    updateFromMenuItems(menuItems) {
        if (!Array.isArray(menuItems)) return;

        const parsedItems = [];

        // 第1パス: アイテム基本情報のパースと分類
        menuItems.forEach(mi => {
            if (!mi) return;
            const rawText = mi.rawStr || mi.str || mi.text || (typeof mi === 'string' ? mi : '');
            if (!rawText) return;

            let letter = '';
            const rawCh = mi.charStr || mi.letter || mi.accelerator || mi.selector || mi.ch || 0;
            if (typeof rawCh === 'number' && rawCh > 0) {
                letter = String.fromCharCode(rawCh);
            } else if (typeof rawCh === 'string' && rawCh.length > 0) {
                letter = rawCh.trim();
            }

            if (!letter && rawText) {
                const match = rawText.match(/^([a-zA-Z])[\s\-\.\)]/);
                if (match) letter = match[1];
            }

            // 英字1文字のアイテムのみ有効なスロット項目としてパース
            if (letter && /^[a-zA-Z]$/.test(letter)) {
                const glyphId = typeof mi.glyph === 'number' ? mi.glyph : (mi.glyphInfo ? mi.glyphInfo.glyph : -1);
                let onum = typeof mi.onum === 'number' && mi.onum >= 0 ? mi.onum : (mi.glyphInfo && typeof mi.glyphInfo.onum === 'number' ? mi.glyphInfo.onum : -1);
                if (onum < 0 && glyphId >= 0) {
                    onum = getOnumFromGlyph(glyphId);
                }

                const categoryFlags = this.categorizeItem(rawText, glyphId, onum);
                const equipState = this.parseEquipState(rawText);

                // 🎯 ナレッジ自動物理アタッチ (DevTool Inspector & クライアントデータ連携の要)
                let knowledge = mi.knowledge || null;
                if (!knowledge && this.structuredKnowledgeEngine) {
                    if (typeof this.structuredKnowledgeEngine.getKnowledge === 'function') {
                        knowledge = this.structuredKnowledgeEngine.getKnowledge(mi) ||
                                    this.structuredKnowledgeEngine.getKnowledge(onum >= 0 ? onum : rawText, { translate: true });
                    }
                }
                if (!knowledge && onum >= 0 && OBJECT_KNOWLEDGE_MAP.has(onum)) {
                    knowledge = OBJECT_KNOWLEDGE_MAP.get(onum);
                }

                parsedItems.push({
                    letter,
                    rawText,
                    glyphId,
                    onum,
                    knowledge,
                    ...categoryFlags,
                    ...equipState
                });
            }
        });

        // 第2パス: 全件コンテキストを踏まえたスマートアクション/推奨・副次的アクション判定
        if (parsedItems.length > 0) {
            parsedItems.forEach(item => {
                const defaultAction = this.determineDefaultAction(
                    item.rawText,
                    item,
                    item,
                    item.letter,
                    parsedItems,
                    item
                );
                Object.assign(item, defaultAction);
            });

            this.items = parsedItems;
            this.isSynced = true;
        } else {
            this.items = [];
            this.isSynced = true;
        }
    }

    /**
     * driver.getLastSequenceBuffer() のバッファデータからインベントリメニュー・テキスト行を抽出して一括更新
     * @param {Array<Object>} sequenceBuffer - シーケンスバッファの配列
     */
    updateFromSequenceBuffer(sequenceBuffer) {
        if (!Array.isArray(sequenceBuffer) || sequenceBuffer.length === 0) {
            this.items = [];
            this.isSynced = true;
            return;
        }

        let menuParsed = false;
        for (const item of sequenceBuffer) {
            if (!item) continue;

            if (item.menuItems || item.items) {
                const menuItems = item.menuItems || item.items;
                if (Array.isArray(menuItems) && menuItems.length > 0) {
                    this.updateFromMenuItems(menuItems);
                    menuParsed = true;
                    return;
                }
            }

            if (item.lines || item.text) {
                const lines = item.lines || (typeof item.text === 'string' ? item.text.split('\n') : []);
                if (Array.isArray(lines) && lines.length > 0) {
                    this.updateFromLines(lines);
                    menuParsed = true;
                    return;
                }
            }
        }

        // メニューアイテムも有効テキスト行も見つからなかった場合 ("Not carrying anything." 等)
        if (!menuParsed) {
            this.items = [];
            this.isSynced = true;
        }
    }

    /**
     * テキスト行の配列（例: ["a - a lock pick", "b - a +0 dagger"]）からインベントリ状態を抽出・同期
     * @param {Array<string>} lines 
     */
    updateFromLines(lines) {
        if (!Array.isArray(lines) || lines.length === 0) return;

        const menuItems = [];
        lines.forEach(line => {
            if (!line || typeof line !== 'string') return;
            const match = line.match(/^([a-zA-Z])[\s\-\.\)]+(.+)$/);
            if (match) {
                menuItems.push({
                    letter: match[1],
                    rawStr: match[2].trim(),
                    str: match[2].trim()
                });
            }
        });

        this.updateFromMenuItems(menuItems);
    }

    /** エイリアスメソッド (互換性担保) */
    syncFromMenu(menuItems) {
        return this.updateFromMenuItems(menuItems);
    }

    /**
     * ログメッセージ（例: "You pick up...", "You drop...", "Your pick-axe breaks!"）を受信した際の状態判定
     * 不確実なアドホック推測登録を行わず、インベントリが変更された可能性があるとして未同期（dirty）化する。
     * @param {string} message 
     */
    updateFromMessage(message) {
        if (!message) return false;

        const prevSynced = this.isSynced;
        const prevCount = this.items ? this.items.length : 0;

        // 壊れたメッセージ検知 ("Your pick-axe breaks!")
        if (message.includes('breaks') || message.includes('destroyed')) {
            if (message.includes('pick-axe')) {
                this.items = this.items.filter(i => !i.isPickAxe);
            }
            this.isSynced = false;
            return true;
        }

        // アイテム拾得時の単一スロット表示メッセージ検知 ("f - a dagger.", "a - 短剣" 等)
        const trimmed = message.trim();
        if (/^[a-zA-Z]\s*[\-\.]\s*.+$/.test(trimmed)) {
            this.isSynced = false;
            return prevSynced !== false;
        }

        // ドロップメッセージ・拾得・投げる/射出・消費・使用・状態変更メッセージ検知 (小文字化して大文字小文字表記揺れを吸収)
        const msg = message.toLowerCase();
        if (msg.includes('pick up') || msg.includes('picked up') || msg.includes('pick') || msg.includes('picked') ||
            msg.includes('got ') || msg.includes('find') || msg.includes('now have') || msg.includes('obtain') ||
            msg.includes('grab') || msg.includes('loot') || msg.includes('拾') || msg.includes('手に入れ') || msg.includes('入手') ||
            msg.includes('throw') || msg.includes('threw') || msg.includes('fire') || msg.includes('fired') ||
            msg.includes('shoot') || msg.includes('shot') || msg.includes('投') || msg.includes('放つ') || msg.includes('射出') ||
            msg.includes('drop') || msg.includes('start with') ||
            msg.includes('put on') || msg.includes('take off') ||
            msg.includes('wield') || msg.includes('wear') || msg.includes('remove') ||
            msg.includes('drink') || msg.includes('eat') || msg.includes('read') ||
            msg.includes('zap') || msg.includes('quaff') || msg.includes('disappears') ||
            msg.includes('consume') || msg.includes('swallow')) {
            
            // 能動取得が必要であることを示すため未同期 (dirty) フラグに変更
            this.isSynced = false;
            return prevSynced !== false;
        }

        return (this.items ? this.items.length : 0) !== prevCount || this.isSynced !== prevSynced;
    }

    /** インベントリの同期状態を破棄 (dirty 化) し、次回機会での自動再同期を促す */
    invalidate() {
        this.isSynced = false;
    }

    /** エイリアスメソッド (互換性担保) */
    syncFromMessage(message) {
        return this.updateFromMessage(message);
    }

    /**
     * 三層識別アルゴリズム (onum -> Glyph ID -> 正規表現) によるアイテム分類
     * @param {string} rawText 
     * @param {number} glyphId 
     * @param {number} onum 
     * @returns {Object} フラグ構造体
     */
    categorizeItem(rawText, glyphId = -1, onum = -1) {
        if (typeof onum !== 'number' || onum < 0) {
            onum = -1;
        }
        // onum が未セットの場合、glyphId から自動補填
        if (onum < 0 && typeof glyphId === 'number' && glyphId >= 0) {
            onum = getOnumFromGlyph(glyphId);
        }

        let isPickAxe = false;
        let isDigWand = false;
        let isKey = false;
        let isAxe = false;
        let isFrostWand = false;
        let isAmmo = false;
        let isLauncher = false;
        let isCanOpener = false;
        let isTin = false;
        let isBox = false;
        let isBag = false;
        let isTouchstone = false;
        let isGem = false;
        let isRock = false;
        let onumCategory = 'OTHER';

        // 【層1】onum (オブジェクト固有番号) による確定判定
        if (onum >= 0) {
            const info = getItemInfoFromOnum(onum);
            onumCategory = info.category;
            isPickAxe = info.isPickAxe;
            isKey = info.isKey;
            isAxe = info.isAxe;
            isDigWand = info.isDigWand;
            isFrostWand = info.isFrostWand;
            isAmmo = info.isAmmo;
            isLauncher = info.isLauncher;
            isCanOpener = info.isCanOpener;
            isTin = info.isTin;
            isBox = info.isBox;
            isBag = info.isBag;
            isTouchstone = info.isTouchstone;
            isGem = info.isGem;
            isRock = info.isRock;
        }

        // 【層2】テキストパース（onum で未特定または不一致のフォールバック）
        const cleanText = this.cleanItemText(rawText);

        if (!isCanOpener && (/\bcan opener\b/i.test(cleanText) || /缶切り/.test(cleanText))) {
            isCanOpener = true;
        }
        if (!isTin && (/\b(tin|tins)\b/i.test(cleanText) || /缶詰/.test(cleanText))) {
            isTin = true;
        }
        if (!isBox && (/\b(large box|chest|box)\b/i.test(cleanText) && !/chestplate/i.test(cleanText) || /(大箱|箱|チェスト)/.test(cleanText))) {
            isBox = true;
        }
        if (!isBag && (/\b(sack|bag of holding|oilskin sack|bag|bags)\b/i.test(cleanText) || /(袋|バックパック)/.test(cleanText))) {
            isBag = true;
        }
        if (!isTouchstone && (/\b(touchstone|whetstone)\b/i.test(cleanText) || /(タッチストーン|砥石)/.test(cleanText))) {
            isTouchstone = true;
        }
        if (!isGem && !/ring|amulet|鎧|指輪|魔よけ/i.test(cleanText) && (/\b(gem|gems|ruby|diamond|emerald|sapphire|amethyst|topaz|aquamarine|turquoise|opal|garnet|jacinth|fluorite|agate|jet|obsidian|jade)\b/i.test(cleanText) || /(宝石|ルビー|ダイヤモンド|エメラルド|サファイア)/.test(cleanText))) {
            isGem = true;
        }
        if (onumCategory === 'RING' || onumCategory === 'AMULET' || /ring|amulet|指輪|魔よけ/i.test(cleanText)) {
            isGem = false;
        }
        if (!isRock && (/\b(rock|rocks|flint)\b/i.test(cleanText) || /(岩|石|火打ち石)/.test(cleanText))) {
            isRock = true;
        }

        if (!isAmmo && !isLauncher) {
            if (/\b(arrow|arrows|bolt|bolts|dart|darts|shuriken|shurikens|boomerang|boomerangs|javelin|javelins|flint|rock|rocks)\b/i.test(cleanText) || /(矢|ボルト|ダーツ|手裏剣|ブーメラン|ジャベリン|火打ち石|岩|石)/.test(cleanText)) {
                isAmmo = true;
            } else if (/\b(bow|bows|yumi|sling|slings|crossbow|crossbows)\b/i.test(cleanText) || /(弓|スリング|投石器|クロスボウ)/.test(cleanText)) {
                isLauncher = true;
            }
        }

        if (!isPickAxe && !isDigWand) {
            if (/\b(wand of digging)\b/i.test(cleanText) || /採掘の杖/.test(cleanText)) {
                isDigWand = true;
            } else if (/\b(pick-axe|dwarvish mattock)\b/i.test(cleanText) || /(つるはし|ドワーフのマトック)/.test(cleanText)) {
                isPickAxe = true;
            }
        }

        if (!isKey) {
            isKey = /\b(skeleton key|lock\s*pick|lockpick|lock-pick|credit card|\b\w+\s+key|keys?)\b/i.test(cleanText) ||
                    /(鍵|合鍵|ロックピック|クレジットカード)/.test(cleanText);
        }

        if (!isAxe && !isPickAxe) {
            isAxe = (/(^|[\s])(axe|battle-axe)($|[\s])/i.test(cleanText) || /(斧|戦斧)/.test(cleanText)) && !/pick-axe/i.test(cleanText);
        }

        if (!isFrostWand) {
            isFrostWand = /\bwand of frost\b/i.test(cleanText) ||
                          /氷の杖/.test(cleanText);
        }

        // 発動コマンドキー (verb) の付与
        const verb = isDigWand ? 'z' : 'a';

        // 装備状態のパース (Wielded, Offhand, Quivered, Worn)
        const equipState = this.parseEquipState(rawText);

        // カテゴリ別デフォルト推奨アクションおよび副次的アクションの判定
        const defaultAction = this.determineDefaultAction(rawText, {
            isPickAxe, isDigWand, isKey, isAxe, isFrostWand, isAmmo, isLauncher,
            isCanOpener, isTin, isBox, isBag, isTouchstone, isGem, isRock, onumCategory
        }, equipState, '', Array.isArray(this.items) ? this.items : []);

        return {
            isPickAxe,
            isDigWand,
            isDigTool: isPickAxe || isDigWand,
            verb,
            isKey,
            isAxe,
            isFrostWand,
            isAmmo,
            isLauncher,
            isCanOpener,
            isTin,
            isBox,
            isBag,
            isTouchstone,
            isGem,
            isRock,
            onum,
            onumCategory,
            ...equipState,
            ...defaultAction
        };
    }

    /**
     * カテゴリおよび装備状態からのデフォルト推奨アクションおよび副次的アクション判定
     * @param {string} rawText 
     * @param {Object} categoryFlags 
     * @param {Object} equipState 
     * @param {string} [letter=''] 
     * @param {Array<Object>} [allItems=[]]
     * @param {Object} [itemObj=null]
     * @returns {Object} { defaultVerb, defaultSequence, defaultActionLabel, defaultActionLabelJa, itemCategory, alternativeActions }
     */
    determineDefaultAction(rawText, categoryFlags = {}, equipState = {}, letter = '', allItems = [], itemObj = null) {
        const cleanText = this.cleanItemText(rawText);
        const { isWielded, isOffhand, isQuivered, isWorn, equipSlot } = equipState;
        const { onumCategory = 'OTHER' } = categoryFlags;
        const itemList = Array.isArray(allItems) && allItems.length > 0 ? allItems : (Array.isArray(this.items) ? this.items : []);

        // itemObj / categoryFlags から knowledge または onum を解明
        let knowledge = (itemObj && itemObj.knowledge) || categoryFlags.knowledge || null;
        const onum = (itemObj && typeof itemObj.onum === 'number' && itemObj.onum >= 0)
            ? itemObj.onum
            : (typeof categoryFlags.onum === 'number' && categoryFlags.onum >= 0 ? categoryFlags.onum : -1);

        if (!knowledge && onum >= 0 && OBJECT_KNOWLEDGE_MAP.has(onum)) {
            knowledge = OBJECT_KNOWLEDGE_MAP.get(onum);
        }

        let defaultVerb = null;
        let defaultSequence = letter ? [letter] : [];
        let defaultActionLabel = 'Select';
        let defaultActionLabelJa = '選択';
        let itemCategory = (knowledge && knowledge.category) ? knowledge.category : (onumCategory !== 'OTHER' ? onumCategory : 'OTHER');
        let alternativeActions = [];

        // ヘルパー: 標準選択肢の組み立て
        const makeAlt = (verb, seq, labelJa, isDefault = false) => ({
            verb,
            sequence: seq,
            labelJa,
            isDefault
        });

        // 1. 既に装備・着用・装填中のアイテムの解除アクション優先 (動的状態判定)
        if (isWielded || isOffhand) {
            defaultVerb = 'w';
            defaultSequence = ['w', '-'];
            defaultActionLabel = 'Unwield weapon';
            defaultActionLabelJa = '手放す (w-)';
            itemCategory = 'WEAPON';
            alternativeActions = [
                makeAlt('w', ['w', '-'], '手放す (w-)', true),
                letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
            ].filter(Boolean);
        } else if (isQuivered) {
            defaultVerb = 'Q';
            defaultSequence = ['Q', '-'];
            defaultActionLabel = 'Unquiver ammo';
            defaultActionLabelJa = '装填解除 (Q-)';
            itemCategory = 'WEAPON';
            alternativeActions = [
                makeAlt('Q', ['Q', '-'], '装填解除 (Q-)', true),
                letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
            ].filter(Boolean);
        } else if (isWorn) {
            if (equipSlot === 'ring_left' || equipSlot === 'ring_right' || equipSlot === 'amulet') {
                defaultVerb = 'R';
                defaultSequence = letter ? ['R', letter] : ['R'];
                defaultActionLabel = 'Remove ring/amulet';
                defaultActionLabelJa = '外す (R)';
                itemCategory = equipSlot === 'amulet' ? 'AMULET' : 'RING';
                alternativeActions = [
                    makeAlt('R', defaultSequence, '外す (R)', true)
                ];
            } else {
                defaultVerb = 'T';
                defaultSequence = letter ? ['T', letter] : ['T'];
                defaultActionLabel = 'Take off armor';
                defaultActionLabelJa = '脱ぐ (T)';
                itemCategory = 'ARMOR';
                alternativeActions = [
                    makeAlt('T', defaultSequence, '脱ぐ (T)', true)
                ];
            }
        } else {
            // 2. 缶切り (Can Opener) のスマート判定 (所持品に缶詰 Tin があればスマートシーケンス 'a' + letter + tinLetter)
            const isCanOpener = categoryFlags.isCanOpener || (knowledge && (knowledge.isCanOpener || knowledge.onum === 239)) || /can opener|缶切り/i.test(cleanText);
            if (isCanOpener) {
                itemCategory = 'TOOL';
                const tinItem = itemList.find(i => i.letter && i.letter !== letter && (i.isTin || (i.knowledge && (i.knowledge.isTin || i.knowledge.onum === 263 || i.knowledge.onum === 296)) || /tin|缶詰/i.test(i.rawText || '')));
                if (tinItem && letter) {
                    defaultVerb = 'a';
                    defaultSequence = ['a', letter, tinItem.letter];
                    defaultActionLabel = 'Open tin';
                    defaultActionLabelJa = `缶詰を開ける (a ➔ ${tinItem.letter})`;
                    alternativeActions = [
                        makeAlt('a', defaultSequence, `缶詰を開ける (a ➔ ${tinItem.letter})`, true),
                        makeAlt('a', ['a', letter], '使う (a)'),
                        makeAlt('d', ['d', letter], '置く/落とす (d)')
                    ];
                } else {
                    defaultVerb = 'a';
                    defaultSequence = letter ? ['a', letter] : ['a'];
                    defaultActionLabel = 'Apply can opener';
                    defaultActionLabelJa = '使う (a)';
                    alternativeActions = [
                        makeAlt('a', defaultSequence, '使う (a)', true),
                        letter ? makeAlt('w', ['w', letter], '手に持つ (w)') : null,
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                }
            }
            // 3. 指輪 (RING) の左右装着キー構築
            else if (itemCategory === 'RING' || (knowledge && (knowledge.category === 'RING' || knowledge.defaultVerb === 'put_on' && knowledge.category !== 'AMULET'))) {
                defaultVerb = 'P';
                const hasLeftRing = Array.isArray(itemList) && itemList.some(i => i.isWorn && i.equipSlot === 'ring_left');
                const hasRightRing = Array.isArray(itemList) && itemList.some(i => i.isWorn && i.equipSlot === 'ring_right');
                let targetFinger = (hasLeftRing && !hasRightRing) ? 'r' : 'l';
                defaultSequence = letter ? ['P', letter, targetFinger] : ['P'];
                defaultActionLabel = 'Put on ring';
                defaultActionLabelJa = `はめる (P:${targetFinger === 'l' ? '左手' : '右手'})`;
                itemCategory = 'RING';
                alternativeActions = [
                    makeAlt('P', defaultSequence, `はめる (P:${targetFinger === 'l' ? '左手' : '右手'})`, true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            }
            // 4. ナレッジデータ駆動 (Single Source of Truth 参照)
            else if (knowledge && knowledge.defaultVerb) {
                const verbKeyMap = {
                    wield: 'w',
                    wear: 'W',
                    quaff: 'q',
                    read: 'r',
                    zap: 'z',
                    apply: 'a',
                    quiver: 'Q',
                    put_on: 'P',
                    eat: 'e',
                    throw: 't',
                    drop: 'd',
                    inventory: 'i'
                };
                const verbKey = knowledge.verbKey || verbKeyMap[knowledge.defaultVerb] || 'a';
                defaultVerb = verbKey;
                defaultSequence = letter ? [verbKey, letter] : [verbKey];
                defaultActionLabel = knowledge.defaultActionLabel || 'Action';
                defaultActionLabelJa = knowledge.actionLabelJa || '選択';
                itemCategory = knowledge.category || onumCategory;

                const alts = [makeAlt(verbKey, defaultSequence, defaultActionLabelJa, true)];
                if (letter && verbKey !== 'd') {
                    alts.push(makeAlt('d', ['d', letter], '置く/落とす (d)'));
                }
                if (letter && verbKey !== 't' && (itemCategory === 'WEAPON' || itemCategory === 'GEM')) {
                    alts.push(makeAlt('t', ['t', letter], '投げる (t)'));
                }
                alternativeActions = alts;
            }
            // 5. 箱・チェスト (Box / Chest) の重量軽減優先判定 (推奨: d 落とす)
            else if ((categoryFlags.isBox || /\b(large box|chest|box)\b/i.test(cleanText) || /(大箱|箱|チェスト)/.test(cleanText)) && !/chestplate/i.test(cleanText)) {
                defaultVerb = 'd';
                defaultSequence = letter ? ['d', letter] : ['d'];
                defaultActionLabel = 'Drop container';
                defaultActionLabelJa = '置く/落とす (d)';
                itemCategory = 'TOOL';
                alternativeActions = [
                    makeAlt('d', defaultSequence, '置く/落とす (d)', true),
                    letter ? makeAlt('a', ['a', letter], '開ける/使う (a)') : null
                ].filter(Boolean);
            }
            // 4. 袋類 (Sack / Bag of Holding) (推奨: a 中を見る)
            else if (categoryFlags.isBag || /sack|bag|袋|バックパック/i.test(cleanText)) {
                defaultVerb = 'a';
                defaultSequence = letter ? ['a', letter] : ['a'];
                defaultActionLabel = 'Look inside bag';
                defaultActionLabelJa = '中を見る/使う (a)';
                itemCategory = 'TOOL';
                alternativeActions = [
                    makeAlt('a', defaultSequence, '中を見る/使う (a)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            }
            // 5. 砥石・タッチストーン (Touchstone / Whetstone)
            else if (categoryFlags.isTouchstone || /touchstone|whetstone|タッチストーン|砥石/i.test(cleanText)) {
                defaultVerb = 'a';
                defaultSequence = letter ? ['a', letter] : ['a'];
                defaultActionLabel = 'Apply touchstone';
                defaultActionLabelJa = '使う/鑑定する (a)';
                itemCategory = 'TOOL';
                alternativeActions = [
                    makeAlt('a', defaultSequence, '使う/鑑定する (a)', true),
                    letter ? makeAlt('w', ['w', letter], '手に持つ (w)') : null,
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            }
            // 6. 宝石・石・鉱石 (Gem / Rock)
            else if ((categoryFlags.isGem || categoryFlags.isRock || /gem|ruby|diamond|emerald|sapphire|rock|flint|宝石|岩|石/i.test(cleanText)) && !categoryFlags.isAmmo && !categoryFlags.isLauncher) {
                defaultVerb = 't';
                defaultSequence = letter ? ['t', letter] : ['t'];
                defaultActionLabel = 'Throw gem/rock';
                defaultActionLabelJa = '投げる (t)';
                itemCategory = categoryFlags.isGem ? 'GEM' : 'OTHER';
                alternativeActions = [
                    makeAlt('t', defaultSequence, '投げる (t)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null,
                    letter ? makeAlt('a', ['a', letter], '使う (a)') : null
                ].filter(Boolean);
            }
            // 7. 缶詰 (Tin)
            else if (categoryFlags.isTin || /tin|tins|缶詰/i.test(cleanText)) {
                defaultVerb = 'e';
                defaultSequence = letter ? ['e', letter] : ['e'];
                defaultActionLabel = 'Eat tin';
                defaultActionLabelJa = '開けて食べる (e)';
                itemCategory = 'FOOD';
                alternativeActions = [
                    makeAlt('e', defaultSequence, '開けて食べる (e)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            }
            // 8. 弾薬・投擲物 (isAmmo) の優先装填 (Q) 判定
            else if (categoryFlags.isAmmo) {
                defaultVerb = 'Q';
                defaultSequence = letter ? ['Q', letter] : ['Q'];
                defaultActionLabel = 'Quiver ammo';
                defaultActionLabelJa = '装填/矢筒 (Q)';
                itemCategory = 'WEAPON';
                alternativeActions = [
                    makeAlt('Q', defaultSequence, '装填/矢筒 (Q)', true),
                    letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            }
            // 9. onumCategory に基づく推奨アクション判定
            else if (onumCategory === 'POTION') {
                defaultVerb = 'q';
                defaultSequence = letter ? ['q', letter] : ['q'];
                defaultActionLabel = 'Quaff potion';
                defaultActionLabelJa = '飲む (q)';
                alternativeActions = [
                    makeAlt('q', defaultSequence, '飲む (q)', true),
                    letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (onumCategory === 'FOOD') {
                defaultVerb = 'e';
                defaultSequence = letter ? ['e', letter] : ['e'];
                defaultActionLabel = 'Eat food';
                defaultActionLabelJa = '食べる (e)';
                alternativeActions = [
                    makeAlt('e', defaultSequence, '食べる (e)', true),
                    letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (onumCategory === 'SCROLL') {
                defaultVerb = 'r';
                defaultSequence = letter ? ['r', letter] : ['r'];
                defaultActionLabel = 'Read scroll';
                defaultActionLabelJa = '読む (r)';
                alternativeActions = [
                    makeAlt('r', defaultSequence, '読む (r)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (onumCategory === 'SPELLBOOK') {
                defaultVerb = 'r';
                defaultSequence = letter ? ['r', letter] : ['r'];
                defaultActionLabel = 'Read spellbook';
                defaultActionLabelJa = '勉強する (r)';
                alternativeActions = [
                    makeAlt('r', defaultSequence, '勉強する (r)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (onumCategory === 'WAND') {
                defaultVerb = 'z';
                defaultSequence = letter ? ['z', letter] : ['z'];
                defaultActionLabel = 'Zap wand';
                defaultActionLabelJa = '振る (z)';
                alternativeActions = [
                    makeAlt('z', defaultSequence, '振る (z)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (onumCategory === 'RING') {
                defaultVerb = 'P';
                const hasLeftRing = Array.isArray(itemList) && itemList.some(i => i.isWorn && i.equipSlot === 'ring_left');
                const hasRightRing = Array.isArray(itemList) && itemList.some(i => i.isWorn && i.equipSlot === 'ring_right');
                let targetFinger = (hasLeftRing && !hasRightRing) ? 'r' : 'l';
                defaultSequence = letter ? ['P', letter, targetFinger] : ['P'];
                defaultActionLabel = 'Put on ring';
                defaultActionLabelJa = `はめる (P:${targetFinger === 'l' ? '左手' : '右手'})`;
                alternativeActions = [
                    makeAlt('P', defaultSequence, `はめる (P:${targetFinger === 'l' ? '左手' : '右手'})`, true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (onumCategory === 'AMULET') {
                defaultVerb = 'P';
                defaultSequence = letter ? ['P', letter] : ['P'];
                defaultActionLabel = 'Put on amulet';
                defaultActionLabelJa = '首にかける (P)';
                alternativeActions = [
                    makeAlt('P', defaultSequence, '首にかける (P)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (onumCategory === 'ARMOR') {
                defaultVerb = 'W';
                defaultSequence = letter ? ['W', letter] : ['W'];
                defaultActionLabel = 'Wear armor';
                defaultActionLabelJa = '着用する (W)';
                alternativeActions = [
                    makeAlt('W', defaultSequence, '着用する (W)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (onumCategory === 'TOOL') {
                if (categoryFlags.isDigWand) {
                    defaultVerb = 'z';
                    defaultSequence = letter ? ['z', letter] : ['z'];
                    defaultActionLabel = 'Zap wand';
                    defaultActionLabelJa = '振る (z)';
                    alternativeActions = [
                        makeAlt('z', defaultSequence, '振る (z)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else {
                    defaultVerb = 'a';
                    defaultSequence = letter ? ['a', letter] : ['a'];
                    defaultActionLabel = 'Apply tool';
                    defaultActionLabelJa = '使う (a)';
                    alternativeActions = [
                        makeAlt('a', defaultSequence, '使う (a)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                }
            } else if (onumCategory === 'WEAPON') {
                defaultVerb = 'w';
                defaultSequence = letter ? ['w', letter] : ['w'];
                defaultActionLabel = 'Wield weapon';
                defaultActionLabelJa = '手に持つ (w)';
                alternativeActions = [
                    makeAlt('w', defaultSequence, '手に持つ (w)', true),
                    letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else {
                // 10. テキストパターンによるフォールバック判定
                if (/\b(potion|potions|milky|smoky|cloudy|bubbly|ruby|pink|clear|viscous|effervescent|murky|fizzy|golden|dark|cyan|yellow|emerald|amber|swirly)\b/i.test(cleanText) || /ポーション|薬/.test(cleanText)) {
                    defaultVerb = 'q';
                    defaultSequence = letter ? ['q', letter] : ['q'];
                    defaultActionLabel = 'Quaff potion';
                    defaultActionLabelJa = '飲む (q)';
                    itemCategory = 'POTION';
                    alternativeActions = [
                        makeAlt('q', defaultSequence, '飲む (q)', true),
                        letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(ration|food|corpse|tripe|apple|carrot|tin|tins|pear|banana|orange|candy|clove|jelly|pie|pancake|cookie|leaf|garlic|mold|meat|egg|melon|spinach|kelp|lump)\b/i.test(cleanText) || /食料|死体|缶詰|りんご|にんじん|トリップ|パン|パイ|クッキー|コンブ|肉|卵/.test(cleanText)) {
                    defaultVerb = 'e';
                    defaultSequence = letter ? ['e', letter] : ['e'];
                    defaultActionLabel = 'Eat food';
                    defaultActionLabelJa = '食べる (e)';
                    itemCategory = 'FOOD';
                    alternativeActions = [
                        makeAlt('e', defaultSequence, '食べる (e)', true),
                        letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(scroll|scrolls|stamped|unlabeled|labeled)\b/i.test(cleanText) || /巻物/.test(cleanText)) {
                    defaultVerb = 'r';
                    defaultSequence = letter ? ['r', letter] : ['r'];
                    defaultActionLabel = 'Read scroll';
                    defaultActionLabelJa = '読む (r)';
                    itemCategory = 'SCROLL';
                    alternativeActions = [
                        makeAlt('r', defaultSequence, '読む (r)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(spellbook|spellbooks|book of|paperback|leather-bound|canvas-bound|velvet-bound|parchment|papyrus)\b/i.test(cleanText) || /呪文書|魔法書/.test(cleanText)) {
                    defaultVerb = 'r';
                    defaultSequence = letter ? ['r', letter] : ['r'];
                    defaultActionLabel = 'Read spellbook';
                    defaultActionLabelJa = '勉強する (r)';
                    itemCategory = 'SPELLBOOK';
                    alternativeActions = [
                        makeAlt('r', defaultSequence, '勉強する (r)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(wand|wands|balsa|ebony|runed|oak|pine|maple|copper|silver|iron|brass|crystal|marble|platinum|bamboo)\b/i.test(cleanText) || /杖/.test(cleanText) || categoryFlags.isDigWand || categoryFlags.isFrostWand) {
                    defaultVerb = 'z';
                    defaultSequence = letter ? ['z', letter] : ['z'];
                    defaultActionLabel = 'Zap wand';
                    defaultActionLabelJa = '振る (z)';
                    itemCategory = 'WAND';
                    alternativeActions = [
                        makeAlt('z', defaultSequence, '振る (z)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(ring|rings|pearl|twisted|wire|engagement|shiny)\b/i.test(cleanText) || /指輪/.test(cleanText)) {
                    defaultVerb = 'P';
                    const hasLeftRing = Array.isArray(itemList) && itemList.some(i => i.isWorn && i.equipSlot === 'ring_left');
                    const hasRightRing = Array.isArray(itemList) && itemList.some(i => i.isWorn && i.equipSlot === 'ring_right');
                    let targetFinger = (hasLeftRing && !hasRightRing) ? 'r' : 'l';
                    defaultSequence = letter ? ['P', letter, targetFinger] : ['P'];
                    defaultActionLabel = 'Put on ring';
                    defaultActionLabelJa = `はめる (P:${targetFinger === 'l' ? '左手' : '右手'})`;
                    itemCategory = 'RING';
                    alternativeActions = [
                        makeAlt('P', defaultSequence, `はめる (P:${targetFinger === 'l' ? '左手' : '右手'})`, true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(amulet|amulets|circular|spherical|oval|triangular|pyramidal|square|concave|hexagonal|octagonal)\b/i.test(cleanText) || /魔よけ|お守り/.test(cleanText)) {
                    defaultVerb = 'P';
                    defaultSequence = letter ? ['P', letter] : ['P'];
                    defaultActionLabel = 'Put on amulet';
                    defaultActionLabelJa = '首にかける (P)';
                    itemCategory = 'AMULET';
                    alternativeActions = [
                        makeAlt('P', defaultSequence, '首にかける (P)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(armor|mail|suit|cloak|helm|helmet|boots|shoes|gloves|gauntlets|shield|shirt|robe|hat|cap|apron|coif|bracer)\b/i.test(cleanText) || /鎧|兜|靴|手袋|盾|マント|服|帽子|ローブ/.test(cleanText)) {
                    defaultVerb = 'W';
                    defaultSequence = letter ? ['W', letter] : ['W'];
                    defaultActionLabel = 'Wear armor';
                    defaultActionLabelJa = '着用する (W)';
                    itemCategory = 'ARMOR';
                    alternativeActions = [
                        makeAlt('W', defaultSequence, '着用する (W)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (categoryFlags.isKey || categoryFlags.isDigTool || /\b(towel|kit|lamp|lantern|whistle|horn|harp|mirror|leash|touchstone|whetstone|box|chest|sack|bag|blindfold|flute|bell|candle)\b/i.test(cleanText) || /鍵|ピック|タオル|キット|ランプ|笛|鏡|紐|砥石|袋|箱|目隠し/.test(cleanText)) {
                    defaultVerb = 'a';
                    defaultSequence = letter ? ['a', letter] : ['a'];
                    defaultActionLabel = 'Apply tool';
                    defaultActionLabelJa = '使う (a)';
                    itemCategory = 'TOOL';
                    alternativeActions = [
                        makeAlt('a', defaultSequence, '使う (a)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(sword|saber|dagger|knife|axe|spear|bow|arrow|crossbow|bolt|sling|flint|mace|flail|hammer|lance|trident|staff|pick-axe|mattock|dart|shuriken|boomerang|whip|scythe|halberd|glaive|javelin|club|katana|wakizashi|tsurugi|blade)\b/i.test(cleanText) || /剣|刀|短剣|ダガー|斧|槍|弓|矢|ツルハシ|棍棒|ハンマー|ダーツ|手裏剣|鞭/.test(cleanText) || categoryFlags.isPickAxe || categoryFlags.isAxe) {
                    defaultVerb = 'w';
                    defaultSequence = letter ? ['w', letter] : ['w'];
                    defaultActionLabel = 'Wield weapon';
                    defaultActionLabelJa = '手に持つ (w)';
                    itemCategory = 'WEAPON';
                    alternativeActions = [
                        makeAlt('w', defaultSequence, '手に持つ (w)', true),
                        letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else {
                    defaultVerb = 'i';
                    defaultSequence = letter ? ['i', letter] : ['i'];
                    defaultActionLabel = 'Inventory item';
                    defaultActionLabelJa = '一覧から選択 (i)';
                    itemCategory = 'OTHER';
                    alternativeActions = [
                        makeAlt('i', defaultSequence, '一覧から選択 (i)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                }
            }
        }

        return {
            defaultVerb,
            defaultSequence,
            defaultActionLabel,
            defaultActionLabelJa,
            itemCategory,
            alternativeActions
        };
    }



    /**
     * テキスト表現からの装備状態（Wielded, Offhand, Quivered, Worn, スロット）のパース
     * @param {string} rawText 
     * @returns {Object} { isWielded, isOffhand, isQuivered, isWorn, equipSlot }
     */
    parseEquipState(rawText) {
        if (!rawText || typeof rawText !== 'string') {
            return { isWielded: false, isOffhand: false, isQuivered: false, isWorn: false, equipSlot: null };
        }

        let isWielded = false;
        let isOffhand = false;
        let isQuivered = false;
        let isWorn = false;
        let equipSlot = null;

        // メイン武器 (weapon in hand, weapon in hands, weapon in right hand, wielded)
        if (/\b(weapon in hand|weapon in hands|weapon in right hand|\(wielded\))\b/i.test(rawText) || /手に持っている/i.test(rawText)) {
            isWielded = true;
            equipSlot = 'weapon';
        }

        // サブ武器 / 二刀流 (weapon in left hand, in off hand, off-hand, alternate weapon)
        if (/\b(weapon in left hand|in off hand|off-hand|alternate weapon)\b/i.test(rawText) || /左手に持っている|副武器/i.test(rawText)) {
            isOffhand = true;
            equipSlot = 'offhand';
        }

        // 矢筒 (in quiver, quivered)
        if (/\b(in quiver|quivered)\b/i.test(rawText) || /矢筒/i.test(rawText)) {
            isQuivered = true;
            equipSlot = 'quiver';
        }

        // 着用中 (being worn, on left hand, on right hand, around neck, on head, on feet, on hands)
        if (/\b(being worn|on left hand|on right hand|around neck|on head|on feet|on hands|embedded in shield)\b/i.test(rawText) || /着用|装備中/i.test(rawText)) {
            isWorn = true;
            if (!equipSlot) {
                if (/on left hand/i.test(rawText)) equipSlot = 'ring_left';
                else if (/on right hand/i.test(rawText)) equipSlot = 'ring_right';
                else if (/around neck/i.test(rawText)) equipSlot = 'amulet';
                else if (/shield/i.test(rawText)) equipSlot = 'shield';
                else equipSlot = 'worn';
            }
        }

        return {
            isWielded,
            isOffhand,
            isQuivered,
            isWorn,
            equipSlot
        };
    }

    /**
     * テキストパース前処理（レター・数量・BUC・状態・装備タグの削除）
     * @param {string} text 
     * @returns {string} 除去済みテキスト
     */
    cleanItemText(text) {
        if (!text) return '';
        return text
            .replace(/^[a-zA-Z][\s\-\.\)]+/, '') // "a - ", "a) ", "a. " レタープレフィックス削除
            .replace(/\(.*?\)/g, '')             // "(weapon in hand)" 削除
            .replace(/\b(a|an|the|\d+)\b/gi, '') // 冠詞・数値削除
            .replace(/\b(blessed|uncursed|cursed)\b/gi, '') // BUC削除
            .replace(/\b(rusty|corroded|burnt|poisoned|\+\d+|-\d+)\b/gi, '') // 状態・強化値削除
            .trim();
    }

    // =========================================================================
    // クエリ API (ContextActionEngine & UI から利用)
    // =========================================================================

    /** レター (英字1文字) から指定アイテムオブジェクトを取得 */
    getItemByLetter(letter) {
        if (!letter || typeof letter !== 'string') return null;
        const targetStr = letter.trim();
        return this.items.find(i => i.letter === targetStr) || null;
    }

    /** レター (英字1文字) から指定アイテムのデフォルト推奨アクション情報を取得 */
    getItemDefaultAction(letter) {
        const item = this.getItemByLetter(letter);
        if (!item) return null;
        return {
            letter: item.letter,
            rawText: item.rawText,
            defaultVerb: item.defaultVerb,
            defaultSequence: item.defaultSequence,
            defaultActionLabel: item.defaultActionLabel,
            defaultActionLabelJa: item.defaultActionLabelJa,
            itemCategory: item.itemCategory,
            alternativeActions: item.alternativeActions || []
        };
    }

    /** ツルハシ/掘削ツールを取得 (所持していない場合は null)。verb ('a' か 'z') を含む */
    getPickAxe() {
        return this.items.find(i => i.isPickAxe || i.isDigWand || i.isDigTool) || null;
    }

    /** 掘削ツール (ツルハシまたは採掘の杖) を取得 */
    getDigTool() {
        return this.items.find(i => i.isDigTool || i.isPickAxe || i.isDigWand) || null;
    }

    /** 鍵/解錠アイテムを取得 (所持していない場合は null) */
    getKeyOrLockPick() {
        return this.items.find(i => i.isKey) || null;
    }

    /** 斧/伐採アイテムを取得 (所持していない場合は null) */
    getAxe() {
        return this.items.find(i => i.isAxe) || null;
    }

    /** 氷の杖を取得 (所持していない場合は null) */
    getFrostWand() {
        return this.items.find(i => i.isFrostWand) || null;
    }

    /** 手に持っているメイン武器を取得 */
    getWieldedWeapon() {
        return this.items.find(i => i.isWielded) || null;
    }

    /** 二刀流時の副武器 (Off-hand weapon) を取得 */
    getOffhandWeapon() {
        return this.items.find(i => i.isOffhand) || null;
    }

    /** 現在「二刀流」状態かどうか判定 */
    isTwoWeaponing() {
        return !!(this.getWieldedWeapon() && this.getOffhandWeapon());
    }

    /** 矢筒 (Quiver) にセットされているアイテムを取得 */
    getQuiveredItem() {
        return this.items.find(i => i.isQuivered) || null;
    }

    /** 装備中の全アイテムを取得 */
    getEquippedItems() {
        return this.items.filter(i => i.isWielded || i.isOffhand || i.isQuivered || i.isWorn);
    }

    /** スロット別の詳細装備マップを取得 */
    getEquipmentMap() {
        return {
            weapon: this.getWieldedWeapon(),
            offhand: this.getOffhandWeapon(),
            isTwoWeapon: this.isTwoWeaponing(),
            quiver: this.getQuiveredItem(),
            wornList: this.items.filter(i => i.isWorn),
            equippedList: this.getEquippedItems()
        };
    }
}


