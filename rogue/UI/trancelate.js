function trancelate(r) {

    const d = r.define;

    // Translation mode
    const tmode = d.LANG_JP;
    // Save translation data mode
    const cmode = d.LANG_LARNMODE;

    // Load dictionaries from unified nhMessage.js
    const trMap = new Map();

    /**
     * Merge external translation data into trMap.
     * @param {Array} dataArray - Array of {en: "...", jp: "..."}
     */
    this.add_ext_data = (dataArray) => {
        if (!Array.isArray(dataArray)) return;
        dataArray.forEach(item => {
            if (item.en !== undefined) {
                trMap.set(item.en, item.jp);
            }
        });
    };

    if (typeof nhMessage === 'function') {
        const data = nhMessage();
        this.add_ext_data(data);
    }

    // Load from localStorage if available (for instant feedback)
    try {
        const extData = localStorage.getItem("nh.ext_data");
        if (extData) {
            this.add_ext_data(JSON.parse(extData));
        }
    } catch (e) {
        console.error("Failed to load nh.ext_data from localStorage", e);
    }

    const trtable_entities = (typeof nhEntities === 'function') ? nhEntities() : {};
    const trtable_items = (typeof nhItems === 'function') ? nhItems() : {};
    const trtable_patterns = (typeof nhPatterns === 'function') ? nhPatterns() : [];

    let refcnt = 0;
    let buf = [];
    const icache = {};

    if (Boolean(localStorage.getItem("nh.temp"))) {
        buf = JSON.parse(localStorage.getItem("nh.temp"));
    }

    /**
     * Helper for POS-aware translation.
     * @param {string} word - English word.
     * @param {string} pos - Part Of Speech ('noun', 'adj', 'verb').
     * @returns {string|null} - Translated word or null.
     */
    function lookup_word(word, pos = 'noun') {
        const entry = trtable_items[word] || trtable_entities[word];
        if (!entry) return null;
        if (typeof entry === 'string') return entry;
        return entry[pos] || entry['noun'] || entry;
    }

    this.message = (msg) => {
        refcnt = 0;
        const result = get_translation_data(msg);
        if (d.DEBUG_MSG) {
            if (msg != result) {
                console.log(`o ref: ${refcnt}, msg: "${msg}", result: "${result}"`);
            } else {
                console.log(`x ref: ${refcnt}, msg: "${msg}"`);
            }
        }
        return result;
    }

    function get_translation_data(msg) {
        if (!msg || typeof msg !== 'string') return msg;
        refcnt++;
        if (tmode == false) return msg;

        // 1. Exact Match Lookup (O(1))
        if (trMap.has(msg)) {
            return trMap.get(msg);
        }

        // 2. Word/Entity lookup
        const wordTr = lookup_word(msg);
        if (wordTr) return wordTr;

        // 2.5 Item cache check
        if (icache[msg]) {
            return icache[msg];
        }

        // 3. Pattern Matching (Priority 1)
        // Check for patterns before decomposition to allow complex phrases
        const patternResult = apply_patterns(msg);
        if (patternResult) return patternResult;

        // 4. Item Name Decomposition (NetHack 3.7 format)
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
        let pairofMatch = itemResult.match(
            /^(pair of)\s+(.*)$/i
        );
        if (pairofMatch) {
            pairof = pairofMatch[1];
            itemResult = pairofMatch[2];
        }

        // Look up body name (noun)
        let bodyTranslated = lookup_word(itemResult, 'noun');

        // Try singular
        let singularBody = "";
        if (!bodyTranslated) {
            singularBody = itemResult.replace(/s(\s+of\s+)/i, "$1").replace(/s$/i, "");
            bodyTranslated = lookup_word(singularBody, 'noun');
        }

        // Try pattern matching on the body (e.g. "scroll of identify")
        if (!bodyTranslated) {
            bodyTranslated = apply_patterns(singularBody || itemResult);
        }

        // Assemble translation if success
        if (bodyTranslated) {
            let finalMsg = "";
            if (empty) finalMsg += (lookup_word(empty, 'adj') || get_translation_data(empty)) + " ";
            if (buc) finalMsg += (lookup_word(buc, 'adj') || get_translation_data(buc)) + " ";
            if (erosion) finalMsg += (lookup_word(erosion, 'adj') || get_translation_data(erosion)) + " ";
            if (enchant) finalMsg += enchant + " ";
            if (pairof) finalMsg += (lookup_word(pairof, 'adj') || get_translation_data(pairof)) + " ";

            finalMsg += bodyTranslated;
            if (quantity && !(/^(The|A|An|the|a|an)$/i.test(quantity))) {
                finalMsg += " (" + quantity + "個)";
            }
            if (suffix) {
                finalMsg += get_translation_data(suffix);
            }
            let chResult = finalMsg.trim();
            if (!icache[msg]) {
                icache[msg] = chResult;
            }
            return chResult;
        }

        save_translation_data(msg);
        return msg;
    }

    /**
     * Applies regular expression patterns from the translation table.
     * @param {string} text - Message to translate.
     * @returns {string|null} - Translated message or null if no match.
     */
    function apply_patterns(text) {
        for (let entry of trtable_patterns) {
            let match = text.match(entry.pattern);
            if (match) {
                let result = entry.replace;
                for (let i = 1; i < match.length; i++) {
                    const placeholder = `$${i}`;
                    const adjPlaceholder = `$${i}:adj`;
                    const verbPlaceholder = `$${i}:verb`;

                    if (result.includes(adjPlaceholder)) {
                        result = result.replace(adjPlaceholder, lookup_word(match[i], 'adj') || get_translation_data(match[i]));
                    } else if (result.includes(verbPlaceholder)) {
                        result = result.replace(verbPlaceholder, lookup_word(match[i], 'verb') || get_translation_data(match[i]));
                    } else {
                        result = result.split(placeholder).join(get_translation_data(match[i]));
                    }
                }
                return result;
            }
        }
        return null;
    }

    function save_translation_data(msg) {
        //翻訳不要分のチェック
        if (/^\d+$/.test(msg)) return; //数字だけは保存しない
        if (/^[a-zA-Z$]$/.test(msg)) return; //一文字だけのIndex
        if (/^\d+:d+$/.test(msg)) return; //num:num
        if (/^\d+\/d+$/.test(msg)) return; //num/num

        if (!buf.includes(msg)) {
            buf.push(msg);
            if (cmode) localStorage.setItem("nh.temp", JSON.stringify(buf));
        }
    }
}
