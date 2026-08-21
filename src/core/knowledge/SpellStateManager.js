/**
 * SpellStateManager.js
 * 
 * プレイヤーの習得魔法（Spell）状態を管理・キャッシュし、
 * コンテキストアクションやUI描画に必要な呪文一覧、レベル、系統、詠唱失敗率等を提供するマネージャー。
 */

export class SpellStateManager {
    constructor(options = {}) {
        // 習得魔法のリスト
        // item: { letter: 'a', name: 'force bolt', level: 1, category: 'attack', failRate: '0%', rawText: '...' }
        this.spells = [];
        this.isSynced = false; // 一度でも魔法リストを同期したかフラグ
    }

    /**
     * キャッシュのリセット
     */
    reset() {
        this.spells = [];
        this.isSynced = false;
    }

    /**
     * 習得魔法のリストを取得
     * @returns {Array<Object>}
     */
    getSpells() {
        return this.spells;
    }

    /**
     * メニュー項目から魔法リストを更新
     * @param {Array<Object>} menuItems - メニュー項目の配列
     */
    updateFromMenuItems(menuItems) {
        if (!Array.isArray(menuItems)) return;

        const parsedSpells = [];

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

            // 英字1文字のスロット
            if (letter && /^[a-zA-Z]$/.test(letter)) {
                const spellInfo = this.parseSpellLine(rawText, letter);
                if (spellInfo) {
                    parsedSpells.push(spellInfo);
                }
            }
        });

        if (parsedSpells.length > 0) {
            this.spells = parsedSpells;
            this.isSynced = true;
        } else {
            // メニュー項目があったがパースされなかった、あるいは空の場合
            this.spells = [];
            this.isSynced = true;
        }
    }

    /**
     * テキスト行の配列から魔法リストを更新
     * @param {Array<string>} lines - テキスト行
     */
    updateFromLines(lines) {
        if (!Array.isArray(lines) || lines.length === 0) return;

        const parsedSpells = [];
        for (const line of lines) {
            if (typeof line !== 'string') continue;
            const trimmed = line.trim();
            if (!trimmed) continue;

            const match = trimmed.match(/^([a-zA-Z])[\s\-\.\)](.*)$/);
            if (match) {
                const letter = match[1];
                const rest = match[2];
                const spellInfo = this.parseSpellLine(trimmed, letter);
                if (spellInfo) {
                    parsedSpells.push(spellInfo);
                }
            }
        }

        if (parsedSpells.length > 0) {
            this.spells = parsedSpells;
            this.isSynced = true;
        }
    }

    /**
     * 単一行テキストから魔法情報をパース
     * @param {string} rawText 
     * @param {string} letter 
     * @returns {Object|null}
     */
    /**
     * 単一行テキストから魔法情報をパース
     * @param {string} rawText 
     * @param {string} letter 
     * @returns {Object|null}
     */
    parseSpellLine(rawText, letter) {
        if (!rawText) return null;

        // アイテムやインベントリ行の誤検知排除ガード
        const lowerRaw = rawText.toLowerCase();
        if (lowerRaw.includes('blessed') || lowerRaw.includes('cursed') || lowerRaw.includes('uncursed') ||
            lowerRaw.includes('being worn') || lowerRaw.includes('in hand') || lowerRaw.includes('on left') || lowerRaw.includes('on right') ||
            lowerRaw.includes('potion') || lowerRaw.includes('scroll') || lowerRaw.includes('wand of') || lowerRaw.includes('ring of') ||
            lowerRaw.includes('dagger') || lowerRaw.includes('sword') || lowerRaw.includes('armor') || lowerRaw.includes('shield') ||
            lowerRaw.includes('rations') || lowerRaw.includes('food') || lowerRaw.includes('gold piece')) {
            return null;
        }

        let textWithoutLetter = rawText.trim();
        const prefixMatch = textWithoutLetter.match(/^[a-zA-Z](?:\s*[\-\.\)]\s*|\s+)(.*)$/);
        if (prefixMatch) {
            textWithoutLetter = prefixMatch[1].trim();
        }

        let name = textWithoutLetter;
        let level = 1;
        let category = 'unknown';
        let failRate = '';
        let retention = '';
        let matchedFormat = false;

        // 空白区切りのテーブルフォーマット判定: "name level category fail [retention]"
        // 例: "force bolt          1      attack      0%"
        const columns = textWithoutLetter.split(/\s{2,}|\t+/);
        if (columns.length >= 3) {
            name = columns[0].replace(/^[\-\.\)]\s*/, '').trim();
            const lvl = parseInt(columns[1], 10);
            if (!isNaN(lvl)) level = lvl;
            category = columns[2].trim();
            if (columns[3]) {
                failRate = columns[3].trim();
            }
            if (columns[4]) {
                retention = columns[4].trim();
            }
            // 魔法テーブルの妥当性チェック（カテゴリが有効、または失敗率に % が含まれる）
            const normCat = this.normalizeCategory(category);
            if (normCat !== 'unknown' || (failRate && failRate.includes('%'))) {
                matchedFormat = true;
            }
        } else {
            // パターンマッチ: "force bolt 1 attack 0%" or "force bolt (level 1, attack, 0%)"
            const lineMatch = textWithoutLetter.match(/^(.+?)\s+(\d+)\s+([a-zA-Z\u3000-\u9fff]+)\s+(\d+%?)(?:\s+(.*))?$/);
            if (lineMatch) {
                const testCat = this.normalizeCategory(lineMatch[3]);
                if (testCat !== 'unknown' || lineMatch[4].includes('%')) {
                    name = lineMatch[1].replace(/^[\-\.\)]\s*/, '').trim();
                    level = parseInt(lineMatch[2], 10);
                    category = lineMatch[3].trim();
                    failRate = lineMatch[4].trim();
                    if (lineMatch[5]) retention = lineMatch[5].trim();
                    matchedFormat = true;
                }
            }

            if (!matchedFormat) {
                const bracketMatch = textWithoutLetter.match(/^([^(]+)\s*\((?:level\s*(\d+))?[,\s]*([a-zA-Z\u3000-\u9fff]+)?[,\s]*(\d+%)?\)/i);
                if (bracketMatch) {
                    name = bracketMatch[1].replace(/^[\-\.\)]\s*/, '').trim();
                    if (bracketMatch[2]) level = parseInt(bracketMatch[2], 10);
                    if (bracketMatch[3]) category = bracketMatch[3].trim();
                    if (bracketMatch[4]) failRate = bracketMatch[4].trim();
                    matchedFormat = true;
                }
            }
        }

        if (!matchedFormat) {
            // 魔法のフォーマットに合致しない行は除外
            return null;
        }

        if (!failRate) {
            failRate = '0%';
        } else if (typeof failRate === 'string' && !failRate.includes('%') && /^\d+$/.test(failRate)) {
            failRate = `${failRate}%`;
        }

        return {
            letter,
            name,
            level,
            category: this.normalizeCategory(category),
            categoryRaw: category,
            failRate,
            retention,
            rawText
        };
    }

    /**
     * 系統（Discipline / Category）の正規化
     * @param {string} cat 
     * @returns {string}
     */
    normalizeCategory(cat) {
        if (!cat) return 'unknown';
        const lower = cat.toLowerCase();
        if (lower.includes('att') || lower.includes('攻撃')) return 'attack';
        if (lower.includes('heal') || lower.includes('回復')) return 'healing';
        if (lower.includes('div') || lower.includes('予知')) return 'divination';
        if (lower.includes('ench') || lower.includes('付与')) return 'enchantment';
        if (lower.includes('cler') || lower.includes('僧侶')) return 'clerical';
        if (lower.includes('esc') || lower.includes('脱出')) return 'escape';
        if (lower.includes('matt') || lower.includes('変化')) return 'matter';
        return 'unknown';
    }

    /**
     * バッファが魔法一覧のものであるか判定
     * @param {Array<Object>} sequenceBuffer 
     * @returns {boolean}
     */
    isSpellBuffer(sequenceBuffer) {
        if (!Array.isArray(sequenceBuffer) || sequenceBuffer.length === 0) return false;

        for (const item of sequenceBuffer) {
            if (!item) continue;
            const title = (item.title || item.prompt || '').toLowerCase();
            if (title.includes('spell') || title.includes('魔法')) return true;

            const items = item.menuItems || item.items || [];
            if (items.length > 0) {
                let validSpellCount = 0;
                for (const mi of items) {
                    const str = mi.rawStr || mi.str || mi.text || (typeof mi === 'string' ? mi : '');
                    if (str && this.parseSpellLine(str, 'a')) {
                        validSpellCount++;
                    }
                }
                if (validSpellCount > 0 && validSpellCount >= Math.min(items.length, 2)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * シーケンスバッファから魔法リストを抽出して一括更新
     * @param {Array<Object>} sequenceBuffer 
     * @param {boolean} [force=false] 
     */
    updateFromSequenceBuffer(sequenceBuffer, force = false) {
        if (!Array.isArray(sequenceBuffer) || sequenceBuffer.length === 0) {
            if (force) {
                this.spells = [];
                this.isSynced = true;
            }
            return;
        }

        // バッファ内に「魔法を覚えていない」メッセージがあるかチェック
        for (const item of sequenceBuffer) {
            if (!item) continue;
            const text = (item.text || item.str || item.prompt || '').toLowerCase();
            if (text.includes("don't know any spells") || text.includes("know no spells") || 
                text.includes("呪文を覚えて") || text.includes("魔法を覚えて") || text.includes("呪文を知ら")) {
                this.spells = [];
                this.isSynced = true;
                return;
            }
        }

        if (!force && !this.isSpellBuffer(sequenceBuffer)) return;

        let parsed = false;
        for (const item of sequenceBuffer) {
            if (!item) continue;

            if (item.menuItems || item.items) {
                const menuItems = item.menuItems || item.items;
                if (Array.isArray(menuItems) && menuItems.length > 0) {
                    this.updateFromMenuItems(menuItems);
                    parsed = true;
                    return;
                }
            }

            if (item.lines || item.text) {
                const lines = item.lines || (typeof item.text === 'string' ? item.text.split('\n') : []);
                if (Array.isArray(lines) && lines.length > 0) {
                    this.updateFromLines(lines);
                    parsed = true;
                    return;
                }
            }
        }

        // force (明示的サイレント同期) の場合で、魔法リストが抽出されなかった場合 (魔法を覚えていない時など)
        if (force && !parsed) {
            this.spells = [];
            this.isSynced = true;
        }
    }

    /**
     * 既知の魔法マスター辞書（英語・日本語）
     */
    static get SPELL_CATALOG() {
        return {
            'force bolt': { level: 1, category: 'attack' },
            '力のボルト': { level: 1, category: 'attack' },
            'magic missile': { level: 2, category: 'attack' },
            'マジックミサイル': { level: 2, category: 'attack' },
            '魔法の矢': { level: 2, category: 'attack' },
            'fireball': { level: 4, category: 'attack' },
            '火の玉': { level: 4, category: 'attack' },
            'ファイアーボール': { level: 4, category: 'attack' },
            'cone of cold': { level: 4, category: 'attack' },
            '冷気の円錐': { level: 4, category: 'attack' },
            'finger of death': { level: 7, category: 'attack' },
            '死の指': { level: 7, category: 'attack' },
            'drain energy': { level: 5, category: 'attack' },
            'エネルギー吸収': { level: 5, category: 'attack' },
            'sleep': { level: 1, category: 'enchantment' },
            '睡眠': { level: 1, category: 'enchantment' },
            'confuse monster': { level: 2, category: 'enchantment' },
            'モンスター混乱': { level: 2, category: 'enchantment' },
            'slow monster': { level: 2, category: 'enchantment' },
            'モンスター減速': { level: 2, category: 'enchantment' },
            'cause fear': { level: 3, category: 'enchantment' },
            '恐怖': { level: 3, category: 'enchantment' },
            'charm monster': { level: 3, category: 'enchantment' },
            'モンスター魅了': { level: 3, category: 'enchantment' },
            'healing': { level: 1, category: 'healing' },
            '治癒': { level: 1, category: 'healing' },
            '回復': { level: 1, category: 'healing' },
            'cure blindness': { level: 2, category: 'healing' },
            '盲目の治療': { level: 2, category: 'healing' },
            '盲目の治癒': { level: 2, category: 'healing' },
            'cure sickness': { level: 3, category: 'healing' },
            '病気の治療': { level: 3, category: 'healing' },
            '病気の治癒': { level: 3, category: 'healing' },
            'extra healing': { level: 3, category: 'healing' },
            '大回復': { level: 3, category: 'healing' },
            '超治癒': { level: 3, category: 'healing' },
            'stone to flesh': { level: 3, category: 'healing' },
            '石を肉に': { level: 3, category: 'healing' },
            'restore ability': { level: 4, category: 'healing' },
            '能力回復': { level: 4, category: 'healing' },
            'detect monsters': { level: 1, category: 'divination' },
            'モンスター探知': { level: 1, category: 'divination' },
            'light': { level: 1, category: 'divination' },
            '明かり': { level: 1, category: 'divination' },
            '照明': { level: 1, category: 'divination' },
            'detect food': { level: 2, category: 'divination' },
            '食料探知': { level: 2, category: 'divination' },
            'clairvoyance': { level: 3, category: 'divination' },
            '透視': { level: 3, category: 'divination' },
            'detect unseen': { level: 3, category: 'divination' },
            '不可視探知': { level: 3, category: 'divination' },
            'identify': { level: 3, category: 'divination' },
            '識別': { level: 3, category: 'divination' },
            'detect treasure': { level: 4, category: 'divination' },
            '財宝探知': { level: 4, category: 'divination' },
            'jumping': { level: 1, category: 'escape' },
            '跳躍': { level: 1, category: 'escape' },
            'teleport away': { level: 6, category: 'escape' },
            'テレポート': { level: 6, category: 'escape' },
            'invisibility': { level: 4, category: 'escape' },
            '透明化': { level: 4, category: 'escape' },
            '不可視': { level: 4, category: 'escape' },
            'levitation': { level: 4, category: 'escape' },
            '浮遊': { level: 4, category: 'escape' },
            'dig': { level: 5, category: 'matter' },
            '採掘': { level: 5, category: 'matter' },
            '穴掘り': { level: 5, category: 'matter' },
            'polymorph': { level: 6, category: 'matter' },
            '変化': { level: 6, category: 'matter' },
            'knock': { level: 1, category: 'matter' },
            '開錠': { level: 1, category: 'matter' },
            '施錠解除': { level: 1, category: 'matter' },
            'wizard lock': { level: 2, category: 'matter' },
            '施錠': { level: 2, category: 'matter' },
            '魔法の鍵': { level: 2, category: 'matter' },
            'create monster': { level: 2, category: 'clerical' },
            'モンスター作成': { level: 2, category: 'clerical' },
            'turn undead': { level: 6, category: 'clerical' },
            'アンデッド退散': { level: 6, category: 'clerical' },
            'remove curse': { level: 3, category: 'clerical' },
            '解呪': { level: 3, category: 'clerical' },
            'create familiar': { level: 6, category: 'clerical' },
            'ペット作成': { level: 6, category: 'clerical' }
        };
    }

    /**
     * キャッシュの無効化（次回入力待ち等でのサイレント再同期を要求）
     */
    invalidate() {
        this.isSynced = false;
    }

    /**
     * メッセージテキストからの学習・忘却・変化検知
     * メッセージから勝手にリストを捏造せず、検知時にキャッシュを無効化 (invalidate) して
     * 正式なサイレント同期 (+ キー) を促す。
     * @param {string} text 
     * @returns {boolean} 無効化・変化があったかどうか
     */
    updateFromMessage(text) {
        if (!text || typeof text !== 'string') return false;

        const lower = text.toLowerCase();

        // 0. 魔法を覚えていないメッセージの検知:
        // 例: You don't know any spells right now. / 呪文を覚えていない
        if (lower.includes("don't know any spells") || lower.includes("know no spells") ||
            lower.includes("呪文を覚えて") || lower.includes("魔法を覚えて") || lower.includes("呪文を知ら")) {
            this.spells = [];
            this.isSynced = true;
            return true;
        }

        // 1. 日本語版の学習・復習・忘却メッセージ:
        // 例: 「力のボルト」の呪文を習得した. / 「治癒」の呪文を呪文一覧に'b'として加えた.
        // 例: 「力のボルト」の呪文に関する知識はより鋭くなった.
        const isJpLearn = /[「"]([^「"」]+)[」"](?:の呪文)?を(?:呪文一覧に'([a-zA-Z])'として加えた|習得した|覚えた)/.test(text) ||
                          /[「"]([^「"」]+)[」"](?:の呪文)?に関する知識は(?:より鋭くなった|元に戻った)/.test(text);

        if (isJpLearn) {
            this.invalidate();
            return true;
        }

        // 2. 英語版の学習・復習メッセージ:
        // 例: You add "force bolt" to your repertoire.
        // 例: You learn the spell force bolt!
        // 例: Your knowledge of "force bolt" is sharper.
        const isEnLearn = /You add "[^"]+" to your repertoire/i.test(text) ||
                          /You learn the spell\s+/i.test(text) ||
                          /Your knowledge of "[^"]+" is (?:sharper|restored)/i.test(text);

        if (isEnLearn) {
            this.invalidate();
            return true;
        }

        // 3. 忘却メッセージ
        if (lower.includes('forget the spell') || lower.includes('forgot the spell') ||
            lower.includes('knowledge of the spell') || lower.includes('呪文を忘れた')) {
            this.invalidate();
            return true;
        }

        return false;
    }
}
