/**
 * TranslationEngine.js - NetHack オンデマンドローカライズファイルリゾルバー (404 ログ抑止版)
 *
 * 探査パスを標準の ./dat/${filename}_jp 1回のみに極小化し、
 * コンソールが 404 Not Found ログで溢れかえるのを完全に防ぐ。
 */

export class TranslationEngine {
    constructor(options = {}) {
        this.enabled = options.enabled !== undefined ? options.enabled : true;
        this.language = options.language || (this.enabled ? 'ja' : 'en');
        this.options = options;
        this.trMap = new Map();
        this.lookupDict = options.lookupDict || {};
        this.entitiesAndItems = {};
        this.itemCache = {};
        this.lastMatchSuccess = false;
        this.lastMatchMethod = 'none';
        this.lastRawText = '';
        this.lastTranslatedText = '';
        this.onTranslate = options.onTranslate || null;
        this._translateDepth = 0;
        this.initDictionaries();
    }

    /**
     * window.nhMessage / nhEntities / nhItems からの辞書ロード処理
     */
    initDictionaries() {
        // 1. nhMessage() の完全一致辞書をロード
        const rawDict = this.options.lookupDict || (typeof window !== 'undefined' && typeof window.nhMessage === 'function' ? window.nhMessage() : []);
        if (Array.isArray(rawDict) && rawDict.length > 0) {
            for (const item of rawDict) {
                if (item && item.en !== undefined && item.jp !== undefined) {
                    this.trMap.set(item.en, item.jp);
                }
            }
        } else if (rawDict && typeof rawDict === 'object') {
            for (const [k, v] of Object.entries(rawDict)) {
                if (typeof v === 'string') {
                    this.trMap.set(k, v);
                }
            }
        }

        // 2. nhMessagePattern() パターン辞書をロード
        const rawPatterns = this.options.patternDict || (
            typeof window !== 'undefined' && typeof window.nhMessagePattern === 'function' ? window.nhMessagePattern() : (
            typeof window !== 'undefined' && typeof window.nhPatterns === 'function' ? window.nhPatterns() : []
        ));

        this.patternDict = Array.isArray(rawPatterns) ? rawPatterns : [];

        // 3. nhEntities / nhItems 辞書をロード
        const entities = (typeof window !== 'undefined' && typeof window.nhEntities === 'function') ? window.nhEntities() : {};
        const items = (typeof window !== 'undefined' && typeof window.nhItems === 'function') ? window.nhItems() : {};
        this.entitiesAndItems = { ...entities, ...items };
    }

    /**
     * 辞書が未ロードの場合は遅延ロードを自動実行
     */
    ensureDictionariesLoaded() {
        if (this.trMap.size === 0 || Object.keys(this.entitiesAndItems).length === 0) {
            this.initDictionaries();
        }
    }

    setEnabled(enabled) {
        this.enabled = !!enabled;
        this.language = this.enabled ? 'ja' : 'en';
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

    setLanguage(lang = 'ja') {
        const isJa = (lang === 'ja' || lang === 'jp' || lang === true);
        this.language = isJa ? 'ja' : 'en';
        this.setEnabled(isJa);
    }

    /**
     * ファイル名から baseName (英語版) と jpName (日本語版) を分離・算出
     */
    getFileVariants(filename) {
        const cleanName = String(filename).trim().replace(/^\/+/, '').replace(/^dat\//, '');
        let baseName = cleanName;
        let jpName = cleanName;

        if (cleanName.includes('_jp')) {
            baseName = cleanName.replace(/_jp(\.[^.]+$|$)/, '$1');
            jpName = cleanName;
        } else {
            baseName = cleanName;
            jpName = cleanName.includes('.') ? cleanName.replace(/(\.[^.]+$)/, '_jp$1') : `${cleanName}_jp`;
        }

        return { cleanName, baseName, jpName };
    }

    /**
     * テキスト内に日本語（ひらがな・カタカナ・漢字・全角記号）が含まれるか判定
     */
    containsJapanese(text) {
        if (!text || typeof text !== 'string') return false;
        return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(text);
    }

    /**
     * VFS 探査 ➔ Web サーバー (HTTP fetch) からのオンデマンドローカライズファイル解決 (言語整合性対応)
     */
    async resolveFileText(filename, rawFileText, FS) {
        if (!filename) return rawFileText;

        const { cleanName, baseName, jpName } = this.getFileVariants(filename);
        const desiredTarget = this.enabled ? jpName : baseName;

        // VFS (仮想ファイルシステム) チェック用ヘルパー
        const tryVFS = (target) => {
            if (!FS || !FS.analyzePath) return null;
            const vfsPaths = [`/dat/${target}`, `/${target}`, target];
            for (const vp of vfsPaths) {
                try {
                    if (FS.analyzePath(vp).exists) {
                        const content = FS.readFile(vp, { encoding: 'utf8' });
                        if (content && content.length > 0) return content;
                    }
                } catch (e) {}
            }
            return null;
        };

        // HTTP fetch チェック用ヘルパー
        const tryFetch = async (target) => {
            if (typeof fetch === 'undefined') return null;
            const fetchPaths = [
                `./dat/${target}`,
                `../dat/${target}`,
                `../../dat/${target}`,
                `/dat/${target}`,
                `./${target}`,
                `../${target}`
            ];
            for (const fp of fetchPaths) {
                try {
                    const res = await fetch(fp);
                    if (res.ok) {
                        const text = await res.text();
                        if (text && text.trim().length > 0) return text;
                    }
                } catch (e) {}
            }
            return null;
        };

        const isRawJp = this.containsJapanese(rawFileText);

        // 1. rawFileText が既に要求言語と一致している場合の即時返却
        if (this.enabled && isRawJp) {
            return rawFileText;
        }
        if (!this.enabled && !isRawJp && rawFileText && rawFileText.trim().length > 0) {
            if (!cleanName.includes('_jp')) {
                return rawFileText;
            }
        }

        // 2. 要求ターゲット (desiredTarget) を VFS から探索
        const vfsContent = tryVFS(desiredTarget);
        if (vfsContent) return vfsContent;

        // 3. 要求ターゲット (desiredTarget) を HTTP fetch から探索
        const fetchContent = await tryFetch(desiredTarget);
        if (fetchContent) return fetchContent;

        // 4. 日本語モードで jpName が見つからなかった場合で、rawFileText があるなら rawFileText
        if (this.enabled && rawFileText && rawFileText.trim().length > 0) {
            return rawFileText;
        }

        // 5. 英語モードで baseName が見つからず、rawFileText があるなら rawFileText
        return rawFileText;
    }

    /**
     * 品詞対応単語辞書引き (noun, adj, verb)
     */
    lookupWord(word, pos = 'noun') {
        if (!word) return null;
        this.ensureDictionariesLoaded();
        const entry = this.entitiesAndItems[word] || this.lookupDict[word];
        if (!entry) return null;
        if (typeof entry === 'string') return entry;
        return entry[pos] || entry['noun'] || entry;
    }

    /**
     * 直近の翻訳マッチ成否およびメタデータを取得
     * @returns {{success: boolean, method: string, raw: string, translated: string}}
     */
    getLastMatchInfo() {
        return {
            success: this.lastMatchSuccess,
            method: this.lastMatchMethod,
            raw: this.lastRawText,
            translated: this.lastTranslatedText
        };
    }

    /**
     * 翻訳辞書登録が不要なノイズメッセージか判定
     * (数字のみ、単一文字、時刻比率など)
     * @param {string} text 
     * @returns {boolean}
     */
    isNoiseMessage(text) {
        if (!text || typeof text !== 'string') return true;
        const trimmed = text.trim();
        if (!trimmed) return true;
        if (/^\d+$/.test(trimmed)) return true; // 数字のみ
        if (/^[a-zA-Z$]$/.test(trimmed)) return true; // 単一文字
        if (/^\d+:\d+$/.test(trimmed)) return true; // 12:34 等の比率・時間
        if (/^\d+\/\d+$/.test(trimmed)) return true; // 1/2 等の分数
        return false;
    }

    /**
     * メイン動的翻訳関数
     */
    translate(text) {
        this.lastRawText = text;
        this.lastMatchSuccess = false;
        this.lastMatchMethod = 'none';
        this.lastTranslatedText = text;

        if (!this.enabled || !text || typeof text !== 'string') return text;

        // すでに日本語（ひらがな・カタカナ・漢字・全角記号）が含まれている場合は翻訳不要（既翻訳・オリジナル日本語）
        if (this.containsJapanese(text)) {
            this.lastMatchSuccess = true;
            this.lastMatchMethod = 'already_japanese';
            this.lastTranslatedText = text;
            return text;
        }

        this._translateDepth++;
        let result = text;
        try {
            this.ensureDictionariesLoaded();

            const cleanMsg = text.replace(/\r/g, "").replace(/_+$/, "");

            // 1. 完全一致辞書引き
            if (this.trMap.has(cleanMsg)) {
                const res = this.trMap.get(cleanMsg);
                this.lastMatchSuccess = true;
                this.lastMatchMethod = 'exact';
                this.lastTranslatedText = res;
                result = res;
            } else {
                // 2. 単体単語辞書引き
                const wordTr = this.lookupWord(cleanMsg);
                if (wordTr) {
                    this.lastMatchSuccess = true;
                    this.lastMatchMethod = 'word';
                    this.lastTranslatedText = wordTr;
                    result = wordTr;
                } else if (this.itemCache[cleanMsg]) {
                    // 2.5 アイテムキャッシュ検査
                    const cached = this.itemCache[cleanMsg];
                    this.lastMatchSuccess = true;
                    this.lastMatchMethod = 'decompose';
                    this.lastTranslatedText = cached;
                    result = cached;
                } else {
                    // 3. 正規表現パターンマッチング
                    const patternResult = this.applyPatterns(cleanMsg);
                    if (patternResult) {
                        this.lastMatchSuccess = true;
                        this.lastMatchMethod = 'pattern';
                        this.lastTranslatedText = patternResult;
                        result = patternResult;
                    } else {
                        // 4. NetHack アイテム名分解構文解析
                        const decomposedResult = this.decomposeItemName(cleanMsg);
                        if (decomposedResult && decomposedResult !== cleanMsg) {
                            this.itemCache[cleanMsg] = decomposedResult;
                            this.lastMatchSuccess = true;
                            this.lastMatchMethod = 'decompose';
                            this.lastTranslatedText = decomposedResult;
                            result = decomposedResult;
                        }
                    }
                }
            }
        } finally {
            this._translateDepth--;
            if (this._translateDepth === 0 && typeof this.onTranslate === 'function') {
                try {
                    this.onTranslate({
                        raw: text,
                        translated: result,
                        success: this.lastMatchSuccess,
                        method: this.lastMatchMethod,
                        timestamp: Date.now()
                    });
                } catch (e) {
                    console.error('TranslationEngine onTranslate error:', e);
                }
            }
        }

        return result;
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
