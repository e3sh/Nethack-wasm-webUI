/**
 * TranslationEngine.js - NetHack オンデマンドローカライズファイルリゾルバー (404 ログ抑止版)
 *
 * 探査パスを標準の ./dat/${filename}_jp 1回のみに極小化し、
 * コンソールが 404 Not Found ログで溢れかえるのを完全に防ぐ。
 */

export class TranslationEngine {
    constructor(options = {}) {
        this.enabled = options.enabled !== undefined ? options.enabled : true;

        this.trMap = new Map();
        this.lookupDict = options.lookupDict || {};
        this.itemCache = {};

        // 1. nhMessage() の完全一致辞書をロード
        const rawDict = options.lookupDict || (typeof window !== 'undefined' && typeof window.nhMessage === 'function' ? window.nhMessage() : []);
        if (Array.isArray(rawDict)) {
            for (const item of rawDict) {
                if (item && item.en !== undefined && item.jp !== undefined) {
                    this.trMap.set(item.en, item.jp);
                }
            }
        }

        // 2. nhMessagePattern() パターン辞書をロード
        const rawPatterns = options.patternDict || (
            typeof window !== 'undefined' && typeof window.nhMessagePattern === 'function' ? window.nhMessagePattern() : (
            typeof window !== 'undefined' && typeof window.nhPatterns === 'function' ? window.nhPatterns() : []
        ));

        this.patternDict = Array.isArray(rawPatterns) ? rawPatterns : [];

        // 3. nhEntities / nhItems 辞書をロード
        const entities = (typeof window !== 'undefined' && typeof window.nhEntities === 'function') ? window.nhEntities() : {};
        const items = (typeof window !== 'undefined' && typeof window.nhItems === 'function') ? window.nhItems() : {};
        this.entitiesAndItems = { ...entities, ...items };
    }

    setEnabled(enabled) {
        this.enabled = !!enabled;
        if (typeof localStorage !== 'undefined') {
            try {
                let nhConfig = {};
                const savedStr = localStorage.getItem("nh.config");
                if (savedStr) {
                    try { nhConfig = JSON.parse(savedStr) || {}; } catch (e) {}
                }
                nhConfig.lang = this.enabled;
                nhConfig.translate_enabled = this.enabled;
                localStorage.setItem("nh.config", JSON.stringify(nhConfig));
            } catch (e) {}
        }
    }

    /**
     * VFS 探査 ➔ Web サーバー (HTTP fetch) からのオンデマンドローカライズファイル解決 (404最小化)
     */
    async resolveFileText(filename, rawFileText, FS) {
        if (!this.enabled || !filename) return rawFileText;

        const cleanName = String(filename).trim().replace(/^\/+/, '').replace(/^dat\//, '');
        
        // 標準の日本語ファイル命名規則 (例: "license" -> "license_jp", "nethack.txt" -> "nethack_jp.txt")
        const targetFile = cleanName.includes('.') ? cleanName.replace(/(\.[^.]+$)/, '_jp$1') : `${cleanName}_jp`;

        // 1. VFS (仮想ファイルシステム) チェック
        if (FS && FS.analyzePath) {
            const vfsPaths = [`/dat/${targetFile}`, `/${targetFile}`, targetFile];
            for (const vp of vfsPaths) {
                try {
                    if (FS.analyzePath(vp).exists) {
                        const content = FS.readFile(vp, { encoding: 'utf8' });
                        if (content && content.length > 0) return content;
                    }
                } catch (e) {}
            }
        }

        // 2. HTTP fetch オンデマンド取得 (標準 ./dat/ の 1 回のみ試行)
        if (typeof fetch !== 'undefined') {
            try {
                const res = await fetch(`./dat/${targetFile}`);
                if (res.ok) {
                    const text = await res.text();
                    if (text && text.trim().length > 0) {
                        return text;
                    }
                }
            } catch (e) {}
        }

        return rawFileText;
    }

    /**
     * 品詞対応単語辞書引き (noun, adj, verb)
     */
    lookupWord(word, pos = 'noun') {
        if (!word) return null;
        const entry = this.entitiesAndItems[word] || this.lookupDict[word];
        if (!entry) return null;
        if (typeof entry === 'string') return entry;
        return entry[pos] || entry['noun'] || entry;
    }

    /**
     * メイン動的翻訳関数
     */
    translate(text) {
        if (!this.enabled || !text || typeof text !== 'string') return text;

        const cleanMsg = text.replace(/\r/g, "").replace(/_+$/, "");

        // 1. 完全一致辞書引き
        if (this.trMap.has(cleanMsg)) {
            return this.trMap.get(cleanMsg);
        }

        // 2. 単体単語辞書引き
        const wordTr = this.lookupWord(cleanMsg);
        if (wordTr) return wordTr;

        // 2.5 アイテムキャッシュ検査
        if (this.itemCache[cleanMsg]) {
            return this.itemCache[cleanMsg];
        }

        // 3. 正規表現パターンマッチング
        const patternResult = this.applyPatterns(cleanMsg);
        if (patternResult) {
            return patternResult;
        }

        // 4. NetHack アイテム名分解構文解析
        const decomposedResult = this.decomposeItemName(cleanMsg);
        if (decomposedResult && decomposedResult !== cleanMsg) {
            this.itemCache[cleanMsg] = decomposedResult;
            return decomposedResult;
        }

        return text;
    }

    /**
     * パターンマッチングアルゴリズム
     */
    applyPatterns(text) {
        if (!this.patternDict || this.patternDict.length === 0) return null;

        for (const entry of this.patternDict) {
            if (!entry || !entry.pattern) continue;

            const match = text.match(entry.pattern);
            if (match) {
                let result = entry.replace;
                for (let i = 1; i < match.length; i++) {
                    const placeholder = `$${i}`;
                    const adjPlaceholder = `$${i}:adj`;
                    const verbPlaceholder = `$${i}:verb`;
                    const capturedStr = match[i] || '';

                    if (result.includes(adjPlaceholder)) {
                        const trVal = this.lookupWord(capturedStr, 'adj') || this.translate(capturedStr);
                        result = result.replace(adjPlaceholder, trVal);
                    } else if (result.includes(verbPlaceholder)) {
                        const trVal = this.lookupWord(capturedStr, 'verb') || this.translate(capturedStr);
                        result = result.replace(verbPlaceholder, trVal);
                    } else if (result.includes(placeholder)) {
                        const trVal = this.translate(capturedStr);
                        result = result.split(placeholder).join(trVal);
                    }
                }
                return result;
            }
        }
        return null;
    }

    /**
     * NetHack アイテム名分解 ＆ 日本語合成構文解析
     */
    decomposeItemName(msg) {
        let itemResult = msg;
        let suffix = "";
        let suffixMatch = itemResult.match(/(.*?)(\s*\(.*?\))$/);
        if (suffixMatch) {
            itemResult = suffixMatch[1];
            suffix = suffixMatch[2];
        }

        let quantity = "";
        let qtyMatch = itemResult.match(/^(Your|your|The|A|An|the|a|an|\d+)\s+(.*)$/i);
        if (qtyMatch) {
            quantity = qtyMatch[1];
            itemResult = qtyMatch[2];
        }

        let empty = "";
        let emptyMatch = itemResult.match(/^(empty)\s+(.*)$/i);
        if (emptyMatch) {
            empty = emptyMatch[1];
            itemResult = emptyMatch[2];
        }

        let buc = "";
        let bucMatch = itemResult.match(/^(blessed|cursed|uncursed|locked|unlocked|trapped|broken)\s+(.*)$/i);
        if (bucMatch) {
            buc = bucMatch[1];
            itemResult = bucMatch[2];
        }

        let erosion = "";
        let erosionMatch = itemResult.match(
            /^(greased|burnt|very burnt|thoroughly burnt|rustproof|rusty|very rusty|thoroughly rusty|rusted|very rusted|thoroughly rusted|corroded|very corroded|thoroughly corroded|rotted|very rotted|thoroughly rotted|poisoned)\s+(.*)$/i
        );
        if (erosionMatch) {
            erosion = erosionMatch[1];
            itemResult = erosionMatch[2];
        }

        let enchant = "";
        let enchantMatch = itemResult.match(/^([+-]\d+)\s+(.*)$/);
        if (enchantMatch) {
            enchant = enchantMatch[1];
            itemResult = enchantMatch[2];
        }

        let pairof = "";
        let pairofMatch = itemResult.match(/^(pair of)\s+(.*)$/i);
        if (pairofMatch) {
            pairof = pairofMatch[1];
            itemResult = pairofMatch[2];
        }

        let bodyTranslated = this.lookupWord(itemResult, 'noun');

        let singularBody = "";
        if (!bodyTranslated) {
            singularBody = itemResult.replace(/s(\s+of\s+)/i, "$1").replace(/s$/i, "");
            bodyTranslated = this.lookupWord(singularBody, 'noun');
        }

        if (!bodyTranslated) {
            bodyTranslated = this.applyPatterns(singularBody || itemResult);
        }

        if (bodyTranslated) {
            let finalMsg = "";
            if (empty) finalMsg += (this.lookupWord(empty, 'adj') || this.translate(empty)) + " ";
            if (buc) finalMsg += (this.lookupWord(buc, 'adj') || this.translate(buc)) + " ";
            if (erosion) finalMsg += (this.lookupWord(erosion, 'adj') || this.translate(erosion)) + " ";
            if (enchant) finalMsg += enchant + " ";
            if (pairof) finalMsg += (this.lookupWord(pairof, 'adj') || this.translate(pairof)) + " ";

            finalMsg += bodyTranslated;

            if (quantity && !(/^(The|A|An|the|a|an)$/i.test(quantity))) {
                finalMsg += " (" + quantity + "個)";
            }
            if (suffix) {
                finalMsg += this.translate(suffix);
            }
            return finalMsg.trim();
        }

        return msg;
    }
}
