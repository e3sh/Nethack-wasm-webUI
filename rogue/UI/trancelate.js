function trancelate(r) {

    const d = r.define;

    // Translation mode
    const tmode = d.LANG_JP;
    // Save translation data mode
    const cmode = d.LANG_LARNMODE;

    const trtable_org = nhMessage_org();
    const trtable_answar = nhMessage_jp();
    const trtable_patterns = (typeof nhMessage_pattern === 'function') ? nhMessage_pattern() : [];
    const trtable_entities = (typeof nhMessage_entity === 'function') ? nhMessage_entity() : {};
    const trtable_p_items = (typeof nhMessage_pattern_items === 'function') ? nhMessage_pattern_items() : [];
    const trtable_e_items = (typeof nhMessage_entity_items === 'function') ? nhMessage_entity_items() : {};

    let buf = [];

    if (Boolean(localStorage.getItem("nh.temp"))) {
        buf = JSON.parse(localStorage.getItem("nh.temp"));
    }

    this.message = (msg) => {
        return get_translation_data(msg);
    }

    function get_translation_data(msg) {
        if (tmode == false) return msg;
        if (!msg || typeof msg !== 'string') return msg;

        // 1. 完全一致
        let idx = trtable_org.indexOf(msg);
        if (idx != -1) {
            return trtable_answar[idx];
        }

        // 2. 単語・エンティティ一致（再帰翻訳の終端）
        // そのまま検索
        if (trtable_entities[msg]) {
            return trtable_entities[msg];
        }

        // 正規化して検索（冠詞の除去など）
        let normalized = msg.replace(/^(?:the|a|an)\s+/i, "").trim();
        // 複数形sの簡易除去（末尾のsを消して辞書にあるか確認）
        let singural = normalized.replace(/s$/i, "");

        if (trtable_entities[normalized]) {
            return trtable_entities[normalized];
        } else if (trtable_entities[singural]) {
            return trtable_entities[singural];
        }

        // 3. アイテム名の翻訳 (正規表現パターンより優先)
        // NetHack 3.7 format: [quantity] [BUC] [erosion] [enchantment] [body] [charges] [contents] [status]
        let itemResult = msg;

        // 装備状態や個数情報などの括弧付き付録を分離
        // e.g. "a blessed +1 long sword (being worn)" -> body: "a blessed +1 long sword", suffix: " (being worn)"
        let suffixMatch = itemResult.match(/(.*?)(\s*\(.*?\))$/);
        let suffix = "";
        if (suffixMatch) {
            itemResult = suffixMatch[1];
            suffix = suffixMatch[2];
        }

        // 数量/冠詞の分離
        let quantity = "";
        let qtyMatch = itemResult.match(/^(the|a|an|\d+)\s+(.*)$/i);
        if (qtyMatch) {
            quantity = qtyMatch[1];
            itemResult = qtyMatch[2];
        }

        // BUC (blessed, cursed, uncursed)
        let buc = "";
        let bucMatch = itemResult.match(/^(blessed|cursed|uncursed)\s+(.*)$/i);
        if (bucMatch) {
            buc = bucMatch[1];
            itemResult = bucMatch[2];
        }

        // 侵食・状態 (greased, burnt, very burnt, thoroughly burnt, rusted, very rusted, thoroughly rusted, corroded, very corroded, thoroughly corroded, rotted, very rotted, thoroughly rotted, poisoned)
        let erosion = "";
        let erosionMatch = itemResult.match(/^(greased|burnt|very burnt|thoroughly burnt|rusted|very rusted|thoroughly rusted|corroded|very corroded|thoroughly corroded|rotted|very rotted|thoroughly rotted|poisoned)\s+(.*)$/i);
        if (erosionMatch) {
            erosion = erosionMatch[1];
            itemResult = erosionMatch[2];
        }

        // 強化値 (+1, -2, etc.)
        let enchant = "";
        let enchantMatch = itemResult.match(/^([+-]\d+)\s+(.*)$/);
        if (enchantMatch) {
            enchant = enchantMatch[1];
            itemResult = enchantMatch[2];
        }

        // 本体名の翻訳 (辞書引き)
        let bodyTranslated = trtable_e_items[itemResult] || trtable_entities[itemResult];

        // 複数形sの試行
        if (!bodyTranslated) {
            let singularBody = itemResult.replace(/s$/i, "");
            bodyTranslated = trtable_e_items[singularBody] || trtable_entities[singularBody];
        }

        // アイテム専用パターンの試行 (corpse, statue, etc.)
        if (!bodyTranslated) {
            for (let entry of trtable_p_items) {
                let pMatch = itemResult.match(entry.pattern);
                if (pMatch) {
                    bodyTranslated = entry.replace;
                    for (let i = 1; i < pMatch.length; i++) {
                        let innerTranslated = get_translation_data(pMatch[i]);
                        bodyTranslated = bodyTranslated.replace(`$${i}`, innerTranslated);
                    }
                    break;
                }
            }
        }

        // 翻訳が成功した場合のみ合成
        if (bodyTranslated) {
            let finalMsg = "";
            if (buc) finalMsg += get_translation_data(buc) + " ";
            if (erosion) finalMsg += get_translation_data(erosion) + " ";
            if (enchant) finalMsg += enchant + " ";
            finalMsg += bodyTranslated;
            if (quantity && !(/^(the|a|an)$/i.test(quantity))) {
                finalMsg += " (" + quantity + "個)";
            }
            if (suffix) {
                finalMsg += get_translation_data(suffix);
            }
            return finalMsg.trim();
        }

        // 4. 正規表現パターンマッチング
        for (let entry of trtable_patterns) {
            let match = msg.match(entry.pattern);
            if (match) {
                let result = entry.replace;
                // キャプチャグループ ($1, $2, ...) を再帰的に翻訳して置換
                for (let i = 1; i < match.length; i++) {
                    let translatedValue = get_translation_data(match[i]);
                    // $1 などのプレースホルダを実際の翻訳後の値に置換
                    result = result.replace(`$${i}`, translatedValue);
                }
                return result;
            }
        }

        save_translation_data(msg);
        return msg;
    }

    function save_translation_data(msg) {

        if (buf.includes(msg) == false) {
            buf.push(msg);
            if (cmode) localStorage.setItem("nh.temp", JSON.stringify(buf));
        }
    }
}