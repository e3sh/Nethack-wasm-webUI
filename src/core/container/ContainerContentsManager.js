/**
 * ContainerContentsManager.js
 *
 * コンテナの中身を追跡・管理するマネージャー。
 * InventoryStateManager がプレイヤーの所持品を管理するのに対し、
 * このクラスは「現在操作中のコンテナの中身」を管理する。
 *
 * - select_menu の中身一覧 (container_contents) から構築
 * - アイテムの出し入れに応じて差分更新
 * - コンテナ種別 (BoH, Sack, Box 等) の識別情報を保持
 */

/**
 * コンテナ種別定数
 */
export const ContainerType = {
    UNKNOWN: 'UNKNOWN',
    SACK: 'SACK',
    LARGE_BOX: 'LARGE_BOX',
    CHEST: 'CHEST',
    ICE_BOX: 'ICE_BOX',
    BAG_OF_HOLDING: 'BAG_OF_HOLDING',
    OILSKIN_SACK: 'OILSKIN_SACK',
};

/**
 * コンテナ種別を名前テキストから推定
 */
function detectContainerType(name) {
    if (!name || typeof name !== 'string') return ContainerType.UNKNOWN;
    const n = name.toLowerCase();
    if (/bag of holding/i.test(n) || /軽量化の鞄/.test(name)) return ContainerType.BAG_OF_HOLDING;
    if (/oilskin sack/i.test(n) || /油引きの袋/.test(name)) return ContainerType.OILSKIN_SACK;
    if (/\bsack\b/i.test(n) || /\b袋\b/.test(name)) return ContainerType.SACK;
    if (/\bchest\b/i.test(n) || /チェスト/.test(name)) return ContainerType.CHEST;
    if (/large box/i.test(n) || /大箱/.test(name)) return ContainerType.LARGE_BOX;
    if (/ice box/i.test(n) || /氷箱/.test(name)) return ContainerType.ICE_BOX;
    return ContainerType.UNKNOWN;
}


export class ContainerContentsManager {

    constructor() {
        /** @type {string|null} コンテナ名 */
        this.containerName = null;
        /** @type {string} コンテナ種別 */
        this.containerType = ContainerType.UNKNOWN;
        /** @type {number} コンテナの onum (-1 = 不明) */
        this.containerOnum = -1;
        /** @type {Array<Object>} コンテナの中身アイテムリスト */
        this.items = [];
        /** @type {boolean} 中身が既知か (container_contents で確認済みか) */
        this.isKnown = false;
        /** @type {boolean} コンテナが空か */
        this.isEmpty = false;
    }

    /**
     * コンテナの初期化（新しいコンテナ操作トランザクション開始時）
     *
     * @param {Object} info - { name, onum, rawText }
     */
    openContainer(info = {}) {
        this.containerName = info.name || info.rawText || null;
        this.containerOnum = typeof info.onum === 'number' ? info.onum : -1;
        this.containerType = detectContainerType(this.containerName);
        this.items = [];
        this.isKnown = false;
        this.isEmpty = false;
    }

    /**
     * コンテナの中身一覧を更新
     * select_menu の menuItems (container_contents / Take out what 表示) から構築する。
     *
     * @param {Array<Object>} menuItems - メニューアイテム配列
     * @returns {boolean} 中身が更新されたか
     */
    updateFromMenuItems(menuItems) {
        if (!Array.isArray(menuItems)) {
            this.items = [];
            this.isKnown = true;
            this.isEmpty = true;
            return true;
        }

        const parsedItems = [];

        // カテゴリヘッダーの判定パターン
        const CATEGORY_HEADER_REGEX = /^(?:Contents of|.+の収納物|.+の中身|Comestibles|Weapons|Armor|Tools|Food|Scrolls|Potions|Wands|Rings|Amulets|Gems|Gold|食料|武器|防具|道具|巻物|薬品|杖|指輪|魔除け|宝石|金貨)[:：]?$/i;

        for (let i = 0; i < menuItems.length; i++) {
            const mi = menuItems[i];
            if (!mi) continue;
            const rawText = mi.rawStr || mi.str || mi.text || '';
            if (!rawText) continue;

            // > (CONTAINED_SYM) プレフィックスの処理
            const cleanedText = rawText.replace(/^>\s*/, '').trim();
            if (!cleanedText) continue;

            const identifier = mi.identifier !== undefined ? mi.identifier : 0;

            let letter = '';
            const rawCh = mi.charStr || mi.letter || mi.accelerator || mi.ch || 0;
            if (typeof rawCh === 'number' && rawCh > 0) {
                letter = String.fromCharCode(rawCh);
            } else if (typeof rawCh === 'string' && rawCh.length > 0 && rawCh !== '\0') {
                letter = rawCh.trim();
            }

            if (!letter) {
                const match = cleanedText.match(/^([a-zA-Z])[\s\-\.]/);
                if (match) letter = match[1];
            }

            // カテゴリヘッダー行（identifier === 0 かつカテゴリ名、または letter がなくヘッダー名）をスキップ
            if ((identifier === 0 && (!letter || !/^[a-zA-Z]$/.test(letter)) && CATEGORY_HEADER_REGEX.test(cleanedText)) ||
                CATEGORY_HEADER_REGEX.test(cleanedText)) {
                continue;
            }

            // 空メッセージ行をスキップ
            if (/is\s+(now\s+)?empty/i.test(cleanedText) || /中身は空/.test(cleanedText) || /^空の/.test(cleanedText)) {
                continue;
            }

            // アクセラレータが空の場合は、コンテナ内メニュー順序 (0-based) に従って 'a', 'b', 'c'... を割り当てる
            if (!letter || !/^[a-zA-Z]$/.test(letter)) {
                letter = String.fromCharCode('a'.charCodeAt(0) + (parsedItems.length % 26));
            }

            const glyphId = typeof mi.glyph === 'number' ? mi.glyph : (mi.glyphInfo ? mi.glyphInfo.glyph : -1);
            const onum = typeof mi.onum === 'number' ? mi.onum : (mi.glyphInfo && typeof mi.glyphInfo.onum === 'number' ? mi.glyphInfo.onum : -1);

            parsedItems.push({
                letter: letter,
                accelerator: letter,
                rawText: cleanedText,
                name: cleanedText,
                str: cleanedText,
                glyphId,
                onum,
                identifier: identifier !== 0 ? identifier : (i + 1),
                count: mi.count || -1,
            });
        }

        this.items = parsedItems;
        this.reindexLetters();
        this.isKnown = true;
        this.isEmpty = parsedItems.length === 0;
        return true;
    }

    /**
     * テキストウィンドウの行配列 (display_nhwindow 由来) からコンテナ中身をパースして更新
     *
     * NetHack C コアの container_contents() は select_menu ではなく
     * display_nhwindow(tmpwin, TRUE) で行テキスト ("  a food ration", "  6 daggers" 等) を出力する。
     *
     * @param {Array<string>} lines - テキストウィンドウの行配列
     * @returns {boolean} 中身が更新されたか
     */
    updateFromLines(lines) {
        if (!Array.isArray(lines)) {
            this.items = [];
            this.isKnown = true;
            this.isEmpty = true;
            return true;
        }

        const parsedItems = [];

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            if (!rawLine || typeof rawLine !== 'string') continue;

            const trimmed = rawLine.trim();
            if (!trimmed) continue;

            // ヘッダー行をスキップ (Contents of ... / ...の収納物: / ...の中身:)
            if (/^contents\s+of\s+/i.test(trimmed) || /収納物[:：]?$/i.test(trimmed) || /中身[:：]?$/i.test(trimmed)) {
                continue;
            }

            // 「〜は空です」メッセージ行のスキップ
            if (/is\s+(now\s+)?empty/i.test(trimmed) || /中身は空/i.test(trimmed) || /^空の/.test(trimmed)) {
                continue;
            }
            if (/is\s+(now\s+)?empty/i.test(trimmed) || /中身は空/i.test(trimmed)) {
                continue;
            }

            // 数量と名前のパース
            let count = 1;
            let name = trimmed;

            // 英語数量マッチ: "6 uncursed daggers", "234 gold pieces"
            const numMatch = trimmed.match(/^(\d+)\s+(.+)$/);
            if (numMatch) {
                count = parseInt(numMatch[1], 10);
                name = numMatch[2];
            } else {
                // "a food ration", "an uncursed sack"
                const articleMatch = trimmed.match(/^(?:an?|one)\s+(.+)$/i);
                if (articleMatch) {
                    count = 1;
                    name = articleMatch[1];
                } else {
                    // 日本語数量マッチ: "6本のダガー", "2個の林檎"
                    const jaNumMatch = trimmed.match(/^(\d+)(?:個|本|枚|つ|杯|巻|着|缶|服|袋)?の?\s*(.+)$/);
                    if (jaNumMatch) {
                        count = parseInt(jaNumMatch[1], 10);
                        name = jaNumMatch[2];
                    }
                }
            }

            parsedItems.push({
                letter: '',
                rawText: trimmed,
                name: name,
                glyphId: -1,
                onum: -1,
                identifier: i + 1,
                count: count,
            });
        }

        this.items = parsedItems;
        this.reindexLetters();
        this.isKnown = true;
        this.isEmpty = parsedItems.length === 0;
        return true;
    }

    /**
     * シーケンス実行結果バッファ (querySequenceSilent 由来) からコンテナ中身を更新
     *
     * @param {Array<Object>} sequenceBuffer - シーケンスバッファ配列
     * @returns {boolean} 中身が更新されたか
     */
    updateFromSequenceBuffer(sequenceBuffer) {
        if (!Array.isArray(sequenceBuffer) || sequenceBuffer.length === 0) {
            return false;
        }

        // 先に空メッセージを走査
        let hasEmptyMessage = false;
        for (const item of sequenceBuffer) {
            if (!item) continue;
            const text = item.text || item.str || item.prompt || item.rawPrompt || '';
            if (/is\s+(now\s+)?empty/i.test(text) || /中身は空/.test(text) || /^空の/.test(text)) {
                hasEmptyMessage = true;
                break;
            }
        }

        // 1. メニュー項目バッファ (select_menu 由来: Take out what 等) を最優先探索
        for (const item of sequenceBuffer) {
            if (!item) continue;
            if (item.menuItems || item.items) {
                const menuItems = item.menuItems || item.items;
                if (Array.isArray(menuItems) && menuItems.length > 0) {
                    // アクション選択メニュー (Do what with... / Look inside... 等) は中身ではないためスキップ
                    const isActionMenu = menuItems.some(mi => {
                        const s = (mi.str || mi.rawStr || '').toLowerCase();
                        return s.includes('look inside') || s.includes('put something in') || s.includes('take something out') || s.includes('中身を見る') || s.includes('中に入れる');
                    });
                    if (isActionMenu) continue;

                    // カテゴリ選択メニュー (All types 等) も中身ではないためスキップ
                    const isCategoryMenu = menuItems.some(mi => {
                        const s = (mi.str || mi.rawStr || '').toLowerCase();
                        return s.includes('all types') || mi.identifier === -2;
                    });
                    if (isCategoryMenu) continue;

                    return this.updateFromMenuItems(menuItems);
                }
            }
        }

        // 2. 中身一覧の行バッファ (display_nhwindow 由来) をフォールバック探索
        for (const item of sequenceBuffer) {
            if (!item) continue;
            if (item.lines || item.text) {
                const lines = item.lines || (typeof item.text === 'string' ? item.text.split('\n') : []);
                if (Array.isArray(lines) && lines.length > 0) {
                    // Contents of ... または 収納物: 等のヘッダーがある行バッファ
                    const isContentsWindow = lines.some(l => /^contents of /i.test(l.trim()) || /収納物[:：]?$/i.test(l.trim()) || /中身[:：]?$/i.test(l.trim()));
                    if (isContentsWindow) {
                        return this.updateFromLines(lines);
                    }
                }
            }
        }

        // 3. 中身一覧が見つからず、空メッセージがあった場合は確実に空として設定
        if (hasEmptyMessage) {
            this.items = [];
            this.isKnown = true;
            this.isEmpty = true;
            return true;
        }

        return false;
    }

    /**
     * シーケンス実行結果バッファから転送処理の実行結果（成否、メッセージ）を解析
     * @param {Array<Object>} sequenceBuffer - シーケンスバッファ配列
     * @returns {{
     *   success: boolean,
     *   direction: 'in'|'out'|null,
     *   isFull: boolean,
     *   isEmpty: boolean,
     *   messages: Array<string>
     * }}
     */
    parseTransferResult(sequenceBuffer) {
        if (!Array.isArray(sequenceBuffer) || sequenceBuffer.length === 0) {
            return { success: false, direction: null, isFull: false, isEmpty: false, messages: [] };
        }

        const messages = [];
        let hasPutIn = false;
        let hasTakenOut = false;
        let isFull = false;
        let isEmpty = false;

        for (const item of sequenceBuffer) {
            if (!item) continue;
            const text = item.text || item.str || item.prompt || item.rawPrompt || '';
            if (!text) continue;
            messages.push(text);

            if (/you\s+put\s+.+?\s+into/i.test(text) || /に入れ(た|ます)/.test(text)) {
                hasPutIn = true;
            }
            if (/you\s+take\s+.+?\s+out\s+of/i.test(text) || /から取り出し(た|ます)/.test(text)) {
                hasTakenOut = true;
            }
            if (/doesn't\s+fit/i.test(text) || /is\s+full/i.test(text) || /入りきらない/.test(text) || /満杯/.test(text)) {
                isFull = true;
            }
            if (/is\s+(now\s+)?empty/i.test(text) || /中身は空/.test(text) || /^空の/.test(text)) {
                isEmpty = true;
            }
        }

        return {
            success: hasPutIn || hasTakenOut,
            direction: hasPutIn ? 'in' : (hasTakenOut ? 'out' : null),
            isFull,
            isEmpty,
            messages,
        };
    }

    /**
     * シーケンス実行結果バッファにカテゴリ選択メニュー（Put in / Take out what type of objects?）が含まれているかを判定
     * @param {Array<Object>} sequenceBuffer - シーケンスバッファ配列
     * @returns {boolean}
     */
    hasCategoryMenu(sequenceBuffer) {
        if (!Array.isArray(sequenceBuffer) || sequenceBuffer.length === 0) return false;

        for (const item of sequenceBuffer) {
            if (!item) continue;
            // 1. プロンプトテキストの検査
            const text = item.text || item.str || item.prompt || item.rawPrompt || '';
            if (/what type of objects\?/i.test(text)) {
                return true;
            }
            // 2. メニュー項目内の検査 (All types や identifier: -2)
            const menuItems = item.menuItems || item.items;
            if (Array.isArray(menuItems) && menuItems.length > 0) {
                const hasAllTypes = menuItems.some(mi => {
                    const s = (mi.str || mi.rawStr || '').toLowerCase();
                    return s.includes('all types') || mi.identifier === -2;
                });
                if (hasAllTypes) return true;
            }
        }
        return false;
    }

    /**
     * 「コンテナは空です」メッセージを処理
     * @param {string} message - pline メッセージ
     * @returns {boolean} 空メッセージだったか
     */
    handleEmptyMessage(message) {
        if (!message) return false;
        if (/is\s+(now\s+)?empty/i.test(message) || /中身は空/.test(message) || /^空の/.test(message)) {
            this.items = [];
            this.isKnown = true;
            this.isEmpty = true;
            return true;
        }
        return false;
    }

    /**
     * アイテムが投入されたことを反映（楽観的更新）
     * @param {Object} item - 投入されたアイテム { letter, rawText, ... }
     */
    onItemPutIn(item) {
        if (!item) return;
        const targetName = (item.name || item.rawText || '').trim();
        const targetLetter = item.letter || item.invlet || '';
        const targetIdentifier = item.identifier || 0;

        // 同一アイテムの重複追加（二重 push）を完全ガード
        const existing = this.items.find(it => {
            if (targetIdentifier !== 0 && it.identifier !== 0 && it.identifier === targetIdentifier) return true;
            if (targetLetter && /^[a-zA-Z]$/.test(targetLetter) && it.letter === targetLetter && it.name === targetName) return true;
            if (targetName && it.name === targetName && it.rawText === (item.rawText || item.name)) return true;
            return false;
        });

        if (existing) {
            if (typeof item.count === 'number' && item.count > 0 && typeof existing.count === 'number' && existing.count > 0) {
                existing.count += item.count;
            }
            this.isKnown = true;
            this.isEmpty = false;
            return;
        }

        this.items.push({
            letter: targetLetter,
            rawText: item.rawText || item.name || '',
            name: item.name || item.rawText || '',
            glyphId: item.glyphId !== undefined ? item.glyphId : -1,
            onum: item.onum !== undefined ? item.onum : -1,
            identifier: targetIdentifier,
            count: typeof item.count === 'number' ? item.count : -1,
        });
        this.reindexLetters();
        this.isKnown = true;
        this.isEmpty = false;
    }

    /**
     * アイテムが取り出されたことを反映（楽観的更新）
     * @param {Object} item - 取り出されたアイテム { letter, rawText, ... }
     */
    onItemTakenOut(item) {
        if (!item) return;
        // identifier または letter または rawText または name で一致するものを探索
        const idx = this.items.findIndex(i =>
            (item.identifier && i.identifier === item.identifier) ||
            (item.letter && i.letter === item.letter) ||
            (item.rawText && i.rawText === item.rawText) ||
            (item.name && i.name === item.name)
        );
        if (idx >= 0) {
            const existing = this.items[idx];
            // 部分取り出し（数量指定）判定
            if (typeof item.count === 'number' && item.count > 0 && typeof existing.count === 'number' && existing.count > item.count) {
                existing.count -= item.count;
            } else {
                this.items.splice(idx, 1);
            }
        }
        this.reindexLetters();
        this.isKnown = true;
        this.isEmpty = this.items.length === 0;
    }

    /**
     * 中身アイテムのレターを一意かつ連続して再採番 ('a'..'z', 'A'..'Z')
     */
    reindexLetters() {
        for (let i = 0; i < this.items.length; i++) {
            let letter = '';
            if (i < 26) {
                letter = String.fromCharCode('a'.charCodeAt(0) + i);
            } else if (i < 52) {
                letter = String.fromCharCode('A'.charCodeAt(0) + (i - 26));
            } else {
                letter = String.fromCharCode('a'.charCodeAt(0) + (i % 26));
            }
            this.items[i].letter = letter;
            this.items[i].accelerator = letter;
        }
    }

    /**
     * 鞄爆発処理 — コンテナが爆発で消滅した場合
     */
    onContainerExploded() {
        this.items = [];
        this.isKnown = false;
        this.isEmpty = true;
        this.containerName = null;
        this.containerType = ContainerType.UNKNOWN;
        this.containerOnum = -1;
    }

    /**
     * コンテナ操作トランザクション終了時のリセット
     */
    closeContainer() {
        this.containerName = null;
        this.containerType = ContainerType.UNKNOWN;
        this.containerOnum = -1;
        this.items = [];
        this.isKnown = false;
        this.isEmpty = false;
    }

    /**
     * コンテナ中身のアイテム配列を取得
     * @returns {Array<Object>}
     */
    getItems() {
        return Array.isArray(this.items) ? [...this.items] : [];
    }

    /**
     * コンテナ中身のスナップショットまたはアイテム配列を取得 (互換性用)
     * @returns {Object}
     */
    getContents() {
        return this.getSnapshot();
    }

    /**
     * 現在のコンテナ情報をスナップショットとして取得
     * @returns {Object}
     */
    getSnapshot() {
        return {
            containerName: this.containerName,
            containerType: this.containerType,
            containerOnum: this.containerOnum,
            items: [...this.items],
            isKnown: this.isKnown,
            isEmpty: this.isEmpty,
            itemCount: this.items.length,
        };
    }

    /**
     * Bag of Holding かどうかの簡易チェック
     * @returns {boolean}
     */
    isBagOfHolding() {
        return this.containerType === ContainerType.BAG_OF_HOLDING;
    }
}
