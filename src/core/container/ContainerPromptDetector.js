/**
 * ContainerPromptDetector.js
 *
 * C コアから発行されるプロンプト/メニューが
 * コンテナ操作に関連するものかを判定するパターンマッチャー。
 *
 * - FULL menu_style 前提: 主要プロンプトは select_menu 経由
 * - rawPrompt (英語原文) を基に判定
 */

/**
 * コンテナプロンプトの種別定数
 */
export const ContainerPromptType = {
    /** コンテナ操作ではない */
    NONE: 'NONE',
    /** アクション選択メニュー (Do what with X?) — select_menu (FULL) or yn_function (TRADITIONAL) */
    ACTION_MENU: 'ACTION_MENU',
    /** 床の複数コンテナから選択 (Loot which containers?) */
    CONTAINER_SELECT: 'CONTAINER_SELECT',
    /** カテゴリ選択 (Take out / Put in what type of objects?) */
    CATEGORY_SELECT: 'CATEGORY_SELECT',
    /** アイテム選択 (Take out / Put in what?) */
    ITEM_SELECT: 'ITEM_SELECT',
    /** コンテナ中身一覧表示 (container_contents) */
    CONTENTS_VIEW: 'CONTENTS_VIEW',
    /** 数量指定プロンプト (How many?) */
    COUNT_PROMPT: 'COUNT_PROMPT',
    /** ヘルプテキスト (Container actions:) */
    HELP_TEXT: 'HELP_TEXT',
};

/**
 * アクション選択メニューの操作種別
 */
export const ContainerAction = {
    LOOK: ':',        // 中身を見る
    TAKE_OUT: 'o',    // 取り出す
    PUT_IN: 'i',      // 入れる
    BOTH: 'b',        // 取り出してから入れる
    REVERSED: 'r',    // 入れてから取り出す
    STASH: 's',       // 1個入れる
    NEXT: 'n',        // 次のコンテナ
    QUIT: 'q',        // 終了
};

export class ContainerPromptDetector {

    /**
     * inputRequired イベントの payload からコンテナプロンプト種別を判定
     *
     * @param {Object} payload - WebUICore の inputRequired payload
     * @returns {{ type: string, direction?: 'in'|'out'|null, containerName?: string }}
     */
    static detect(payload) {
        if (!payload) return { type: ContainerPromptType.NONE };

        const rawPrompt = payload.rawPrompt || payload.prompt || payload.query || payload.question || '';
        const context = payload.context || '';
        const category = payload.promptCategory || payload.category || '';
        const items = payload.items || payload.menuItems || [];

        // 0. インベントリアクションメニュー (右クリック/長押し/i + letter 由来) の場合はコンテナメニューとして扱わない
        if (ContainerPromptDetector.isInventoryActionMenu(items)) {
            return { type: ContainerPromptType.NONE };
        }

        // 1. コンテナ選択メニュー (#loot 時の複数コンテナ)
        if (ContainerPromptDetector.isContainerSelectMenu(rawPrompt)) {
            return { type: ContainerPromptType.CONTAINER_SELECT };
        }

        // 2. アクション選択プロンプト / メニュー
        if (ContainerPromptDetector.isActionPrompt(rawPrompt) || ContainerPromptDetector.isActionMenuByItems(items)) {
            const containerName = ContainerPromptDetector.extractContainerName(rawPrompt, items);
            return { type: ContainerPromptType.ACTION_MENU, containerName };
        }

        // 3. カテゴリ選択メニュー
        if (ContainerPromptDetector.isCategoryMenu(rawPrompt)) {
            const direction = ContainerPromptDetector.extractDirection(rawPrompt);
            return { type: ContainerPromptType.CATEGORY_SELECT, direction };
        }

        // 4. アイテム選択メニュー
        if (ContainerPromptDetector.isItemSelectMenu(rawPrompt)) {
            const direction = ContainerPromptDetector.extractDirection(rawPrompt);
            return { type: ContainerPromptType.ITEM_SELECT, direction };
        }

        // 4.5 数量指定プロンプト (How many?)
        if (ContainerPromptDetector.isCountPrompt(rawPrompt)) {
            return { type: ContainerPromptType.COUNT_PROMPT };
        }

        // 5. 中身一覧表示 (Contents of ...)
        if (ContainerPromptDetector.isContentsView(rawPrompt)) {
            return { type: ContainerPromptType.CONTENTS_VIEW };
        }

        // display_nhwindow 由来の payload.lines による中身一覧判定
        if (Array.isArray(payload.lines) && payload.lines.length > 0) {
            const firstLine = payload.lines[0];
            if (ContainerPromptDetector.isContentsView(firstLine)) {
                return { type: ContainerPromptType.CONTENTS_VIEW };
            }
        }

        // 6. ヘルプテキスト
        if (ContainerPromptDetector.isHelpText(rawPrompt)) {
            return { type: ContainerPromptType.HELP_TEXT };
        }

        return { type: ContainerPromptType.NONE };
    }

    // ========================================================================
    // 個別パターンマッチ判定
    // ========================================================================

    /**
     * アクション選択プロンプト
     * - "Do what with <container>?"
     * - "<Container> is empty.  Do what with it?"
     * - yn_function (TRADITIONAL) or select_menu (FULL)
     */
    static isActionPrompt(prompt) {
        if (!prompt || typeof prompt !== 'string') return false;
        const p = prompt.trim();
        return /Do what with .+\?/i.test(p)
            || /is\s+(?:now\s+)?empty\.\s*Do what with it\?/i.test(p)
            || /どうしますか|何(を|に)しますか/i.test(p);
    }

    /**
     * 数量指定プロンプト
     * - "How many?" / "How many [items]?"
     */
    static isCountPrompt(prompt) {
        if (!prompt || typeof prompt !== 'string') return false;
        const p = prompt.trim();
        return /^How many/i.test(p) || /何個|幾つ/i.test(p);
    }

    /**
     * コンテナ選択メニュー (#loot 時の複数コンテナ)
     * - "Loot which containers?"
     */
    static isContainerSelectMenu(prompt) {
        if (!prompt || typeof prompt !== 'string') return false;
        return /Loot which containers/i.test(prompt.trim());
    }

    /**
     * カテゴリ選択メニュー
     * - "Take out what type of objects?"
     * - "Put in what type of objects?"
     */
    static isCategoryMenu(prompt) {
        if (!prompt || typeof prompt !== 'string') return false;
        return /^(Take out|Put in) what type of objects\?$/i.test(prompt.trim());
    }

    /**
     * アイテム選択メニュー
     * - "Take out what?"
     * - "Put in what?"
     */
    static isItemSelectMenu(prompt) {
        if (!prompt || typeof prompt !== 'string') return false;
        return /^(Take out|Put in) what\?$/i.test(prompt.trim());
    }

    /**
     * コンテナ中身一覧
     * - "Contents of <container>:"
     * - "大きな箱の中身:" / "袋の中身"
     */
    static isContentsView(prompt) {
        if (!prompt || typeof prompt !== 'string') return false;
        const trimmed = prompt.trim();
        return /^Contents of .+:?$/i.test(trimmed)
            || /^(?:.+ の中身|.+の中身)[:：]?$/i.test(trimmed);
    }

    /**
     * ヘルプテキスト
     * - "Container actions:"
     */
    static isHelpText(prompt) {
        if (!prompt || typeof prompt !== 'string') return false;
        return /^Container actions:/i.test(prompt.trim());
    }

    /**
     * インベントリアクションメニュー (右クリック/長押し/i + letter 由来) かどうかを判定
     * drop, name, throw などの一般アイテム操作メニュー項目が含まれている場合は
     * コンテナ操作メニュー (use_container) ではなくインベントリメニューと判定する。
     */
    static isInventoryActionMenu(items) {
        if (!Array.isArray(items) || items.length === 0) return false;
        for (const item of items) {
            if (!item) continue;
            const text = (item.rawStr || item.str || item.text || '').toLowerCase().trim();
            // インベントリメニューの選択肢項目 (drop ..., name ..., throw ...)
            if (/^(?:drop|落とす|置く)(?:\s|$)/i.test(text)) {
                return true;
            }
            if (/^(?:name|call|名付ける|名前)(?:\s|$)/i.test(text)) {
                return true;
            }
            if (/^(?:throw|投げる)(?:\s|$)/i.test(text)) {
                return true;
            }
        }
        return false;
    }

    /**
     * メニュー項目構造からアクション選択メニューを判定
     * Look inside (':') と Put in ('i') / Take out ('o') が含まれているか
     */
    static isActionMenuByItems(items) {
        if (!Array.isArray(items) || items.length === 0) return false;
        let hasLookInside = false;
        let hasPutOrTake = false;
        for (const item of items) {
            if (!item) continue;
            const text = (item.rawStr || item.str || item.text || '').toLowerCase();
            const acc = item.accelerator || item.charStr || (item.ch ? String.fromCharCode(item.ch) : '');
            if (acc === ':' || text.includes('look inside') || text.includes('中身を見る')) {
                hasLookInside = true;
            }
            if (acc === 'i' || acc === 'o' ||
                text.includes('put something in') || text.includes('take something out') ||
                text.includes('中に入れる') || text.includes('外に出す')) {
                hasPutOrTake = true;
            }
        }
        return hasLookInside && hasPutOrTake;
    }

    // ========================================================================
    // ユーティリティ
    // ========================================================================

    /**
     * アクション選択プロンプトからコンテナ名を抽出
     * "Do what with the bag of holding?" → "the bag of holding"
     */
    static extractContainerName(prompt, items = []) {
        if (prompt && typeof prompt === 'string') {
            const mEmpty = prompt.match(/(?:^|[\.\!\?]\s+)(?:There is [^.]+?\.\s+)?(.+?)\s+is\s+(?:now\s+)?empty\.\s*Do what with it\?/i);
            if (mEmpty) return mEmpty[1].trim();
            const m3 = prompt.match(/(?:^|[\.\!\?]\s+)(?:There is [^.]+?\.\s+)?(.+?)\s+is\s+(?:now\s+)?empty\./i);
            if (m3) return m3[1].trim();
            const m = prompt.match(/Do what with (.+?)\?/i);
            if (m && m[1].toLowerCase() !== 'it') return m[1].trim();
        }
        if (Array.isArray(items)) {
            for (const item of items) {
                const text = item.rawStr || item.str || item.text || '';
                const m = text.match(/Look inside (.+)$/i);
                if (m) return m[1].trim();
            }
        }
        return null;
    }

    /**
     * "Take out" / "Put in" の方向を抽出
     * @returns {'in'|'out'|null}
     */
    static extractDirection(prompt) {
        if (!prompt) return null;
        if (/^Put in/i.test(prompt.trim())) return 'in';
        if (/^Take out/i.test(prompt.trim())) return 'out';
        return null;
    }

    /**
     * アクション選択メニューの項目からアクションコード (:oibrsq) を特定
     *
     * in_or_out_menu() が返すメニュー項目のテキストから
     * 対応する ContainerAction を特定する。
     *
     * @param {Object} menuItem - メニューアイテム
     * @returns {string|null} ContainerAction の値 or null
     */
    static identifyActionFromMenuItem(menuItem) {
        if (!menuItem) return null;
        const text = (menuItem.rawStr || menuItem.str || menuItem.text || '').toLowerCase();

        if (/look inside/i.test(text)) return ContainerAction.LOOK;
        if (/take .* out/i.test(text)) return ContainerAction.TAKE_OUT;
        if (/put .* in$/i.test(text)) return ContainerAction.PUT_IN;
        if (/take out.+then put in/i.test(text) || /^both;?\s*take/i.test(text)) return ContainerAction.BOTH;
        if (/put in.+then take out/i.test(text) || /^both reversed/i.test(text) || /reversed/i.test(text)) return ContainerAction.REVERSED;
        if (/stash one/i.test(text)) return ContainerAction.STASH;
        if (/next/i.test(text) || /loot next/i.test(text)) return ContainerAction.NEXT;
        if (/^done$|^do nothing$/i.test(text) || /quit/i.test(text)) return ContainerAction.QUIT;

        return null;
    }
}
