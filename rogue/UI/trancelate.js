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
    const trtable_items = (typeof nhMessage_item === 'function') ? nhMessage_entity_items() : {};

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

        // 3. 正規表現パターンマッチング
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