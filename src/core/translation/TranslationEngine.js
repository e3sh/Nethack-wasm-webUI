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
     * NetHack 5.0 アイテム名分解 ＆ 日本語合成構文解析
     */
    decomposeItemName(msg) {
        if (!msg || typeof msg !== 'string') return msg;

        let cur = msg.trim();
        let suffix = "";
        let contents = "";

        // 1. Suffix (接尾辞) の抽出
        // 1a. 括弧付き接尾辞: 例: (being worn), (0:5), (weapon in right hand), (for sale, 50 zorkmids)
        const parenMatch = cur.match(/^(.*?)(\s*\([^(]*?\))$/);
        if (parenMatch) {
            cur = parenMatch[1].trim();
            suffix = parenMatch[2];
        }

        // 1b. 括弧なし内容物: 例: containing 3 items
        const contMatch = cur.match(/^(.*?)\s+(containing\s+\d+\s+items?)$/i);
        if (contMatch) {
            cur = contMatch[1].trim();
            const trCont = this.translate(contMatch[2]);
            if (trCont && trCont !== contMatch[2]) {
                contents = /^[（【『「]/.test(trCont) ? trCont : ` (${trCont})`;
            } else {
                contents = ` (${contMatch[2]})`;
            }
        }

        // 2. Prefix 多段抽出パイプライン
        // 2a. 数量/冠詞 (Quantity / Article / Pronoun)
        let quantity = "";
        let isYour = false;
        let isSome = false;
        const qtyMatch = cur.match(/^(Your|your|The|the|A|An|a|an|some|\d+)\s+(.*)$/i);
        if (qtyMatch) {
            const qStr = qtyMatch[1];
            cur = qtyMatch[2].trim();
            if (/^your$/i.test(qStr)) {
                isYour = true;
            } else if (/^some$/i.test(qStr)) {
                isSome = true;
            } else if (/^\d+$/.test(qStr)) {
                quantity = qStr;
            }
        }

        // 2b. 空状態 (Empty)
        let empty = "";
        const emptyMatch = cur.match(/^(empty)\s+(.*)$/i);
        if (emptyMatch) {
            empty = emptyMatch[1];
            cur = emptyMatch[2].trim();
        }

        // 2c. BUC 状態 (Blessed / Cursed / Uncursed)
        let buc = "";
        const bucMatch = cur.match(/^(blessed|cursed|uncursed)\s+(.*)$/i);
        if (bucMatch) {
            buc = bucMatch[1];
            cur = bucMatch[2].trim();
        }

        // 2d. 罠状態 (Trapped)
        let trapped = "";
        const trapMatch = cur.match(/^(trapped)\s+(.*)$/i);
        if (trapMatch) {
            trapped = trapMatch[1];
            cur = trapMatch[2].trim();
        }

        // 2e. 施錠状態 (Locked / Unlocked / Broken)
        let locked = "";
        const lockMatch = cur.match(/^(locked|unlocked|broken)\s+(.*)$/i);
        if (lockMatch) {
            locked = lockMatch[1];
            cur = lockMatch[2].trim();
        }

        // 2f. 油 / 使用状態 / 食用状態 (Greased / Partly used / Partly eaten)
        let greaseUse = "";
        const greaseUseMatch = cur.match(/^(greased|partly used|partly eaten)\s+(.*)$/i);
        if (greaseUseMatch) {
            greaseUse = greaseUseMatch[1];
            cur = greaseUseMatch[2].trim();
        }

        // 2g. 毒 (Poisoned)
        let poisoned = "";
        const poisonMatch = cur.match(/^(poisoned)\s+(.*)$/i);
        if (poisonMatch) {
            poisoned = poisonMatch[1];
            cur = poisonMatch[2].trim();
        }

        // 2h. 侵食状態 (Erosion 1 & 2): (very |thoroughly )?(rusty|cracked|burnt|corroded|rotted)
        let erosion1 = "";
        const ero1Match = cur.match(/^((?:very |thoroughly )?(?:rusty|cracked|burnt))\s+(.*)$/i);
        if (ero1Match) {
            erosion1 = ero1Match[1];
            cur = ero1Match[2].trim();
        }

        let erosion2 = "";
        const ero2Match = cur.match(/^((?:very |thoroughly )?(?:corroded|rotted))\s+(.*)$/i);
        if (ero2Match) {
            erosion2 = ero2Match[1];
            cur = ero2Match[2].trim();
        }

        // 2i. 耐性 (Proof)
        let proof = "";
        const proofMatch = cur.match(/^(fixed|rustproof|corrodeproof|fireproof|tempered|rotproof)\s+(.*)$/i);
        if (proofMatch) {
            proof = proofMatch[1];
            cur = proofMatch[2].trim();
        }

        // 2j. 修正値 (Enchantment) & 数量単位 (Pair of) - 順不同対応
        let enchant = "";
        let pairof = "";
        for (let k = 0; k < 2; k++) {
            if (!pairof) {
                const pairofMatch = cur.match(/^(pair of)\s+(.*)$/i);
                if (pairofMatch) {
                    pairof = pairofMatch[1];
                    cur = pairofMatch[2].trim();
                }
            }
            if (!enchant) {
                const enchantMatch = cur.match(/^([+-]\d+)\s+(.*)$/);
                if (enchantMatch) {
                    enchant = enchantMatch[1];
                    cur = enchantMatch[2].trim();
                }
            }
        }

        // 3. アイテム本体名 (xname) の分解
        // 3a. 希釈 (Diluted)
        let diluted = "";
        const diluteMatch = cur.match(/^(diluted)\s+(.*)$/i);
        if (diluteMatch) {
            diluted = diluteMatch[1];
            cur = diluteMatch[2].trim();
        }

        // 3b. ユーザー命名 (called <name>) または 固有名 (named <name>)
        let called = "";
        let named = "";
        const calledMatch = cur.match(/^(.*?)\s+called\s+(.*)$/i);
        if (calledMatch) {
            cur = calledMatch[1].trim();
            called = calledMatch[2].trim();
        } else {
            const namedMatch = cur.match(/^(.*?)\s+named\s+(.*)$/i);
            if (namedMatch) {
                cur = namedMatch[1].trim();
                named = namedMatch[2].trim();
            }
        }

        // 3c. 本体名の辞書引き (単数形・複数形・パターン照合)
        let bodyTranslated = this.lookupWord(cur, 'noun');
        let singularBody = "";
        if (!bodyTranslated) {
            // 不規則複数形・通常複数形変換
            singularBody = cur
                .replace(/\bknives\b/gi, "knife")
                .replace(/\bboots\b/gi, "boot")
                .replace(/\bgloves\b/gi, "glove")
                .replace(/\bshoes\b/gi, "shoe")
                .replace(/\bteeth\b/gi, "tooth")
                .replace(/s(\s+of\s+)/i, "$1")
                .replace(/s$/i, "");
            bodyTranslated = this.lookupWord(singularBody, 'noun');
        }

        if (!bodyTranslated) {
            bodyTranslated = this.applyPatterns(singularBody || cur);
        }

        // 4. 日本語構文合成
        if (bodyTranslated) {
            let finalMsg = "";
            if (isYour) finalMsg += (this.lookupWord('your', 'adj') || this.translate('Your') || 'あなたの') + " ";
            if (empty) finalMsg += (this.lookupWord(empty, 'adj') || this.translate(empty)) + " ";
            if (buc) finalMsg += (this.lookupWord(buc, 'adj') || this.translate(buc)) + " ";
            if (trapped) finalMsg += (this.lookupWord(trapped, 'adj') || this.translate(trapped)) + " ";
            if (locked) finalMsg += (this.lookupWord(locked, 'adj') || this.translate(locked)) + " ";
            if (greaseUse) finalMsg += (this.lookupWord(greaseUse, 'adj') || this.translate(greaseUse)) + " ";
            if (poisoned) finalMsg += (this.lookupWord(poisoned, 'adj') || this.translate(poisoned)) + " ";
            if (erosion1) finalMsg += (this.lookupWord(erosion1, 'adj') || this.translate(erosion1)) + " ";
            if (erosion2) finalMsg += (this.lookupWord(erosion2, 'adj') || this.translate(erosion2)) + " ";
            if (proof) finalMsg += (this.lookupWord(proof, 'adj') || this.translate(proof)) + " ";
            if (pairof) finalMsg += (this.lookupWord(pairof, 'adj') || this.translate(pairof)) + " ";
            if (enchant) finalMsg += enchant + " ";
            if (diluted) finalMsg += (this.lookupWord(diluted, 'adj') || this.translate(diluted)) + " ";

            finalMsg += bodyTranslated;

            if (called) finalMsg += `（呼称: ${called}）`;
            if (named) finalMsg += `「${named}」`;

            if (quantity) {
                finalMsg += ` (${quantity}個)`;
            } else if (isSome) {
                finalMsg += ` (複数)`;
            }

            if (contents) {
                finalMsg += contents;
            }

            if (suffix) {
                const trimmedSuffix = suffix.trim();
                const trSuffix = this.translate(trimmedSuffix);

                if (trSuffix && trSuffix !== trimmedSuffix) {
                    // 全角括弧で始まっていればスペースなし、半角ならスペース付与
                    if (/^[（【『「]/.test(trSuffix)) {
                        finalMsg += trSuffix;
                    } else {
                        finalMsg += " " + trSuffix;
                    }
                } else {
                    finalMsg += suffix;
                }
            }
            return finalMsg.trim();
        }

        return msg;
    }
}
