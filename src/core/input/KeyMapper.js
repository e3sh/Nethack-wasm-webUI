/**
 * KeyMapper.js - キーコード合成・修飾キー変換・アクションマッピング層 (WebUICore/Input)
 *
 * 役割:
 * - ブラウザの KeyboardEvent や汎用アクション名を NetHack Cコア用 ASCII / コマンドコードに変換する。
 * - Ctrl / Alt 修飾キー合成、方向キー / テンキー / Viキーマッピング、Enter/Esc/Space などの統一処理。
 */

export class KeyMapper {
    constructor(options = {}) {
        this.useNumberPad = options.useNumberPad !== undefined ? options.useNumberPad : false;
        
        // 汎用アクション名 ➔ 代表キー / コマンドマッピングテーブル
        this.actionMap = {
            'MOVE_NORTH': 'k',
            'MOVE_SOUTH': 'j',
            'MOVE_WEST': 'h',
            'MOVE_EAST': 'l',
            'MOVE_NORTH_WEST': 'y',
            'MOVE_NORTH_EAST': 'u',
            'MOVE_SOUTH_WEST': 'b',
            'MOVE_SOUTH_EAST': 'n',
            'MOVE_UP': 'k',
            'MOVE_DOWN': 'j',
            'MOVE_LEFT': 'h',
            'MOVE_RIGHT': 'l',
            'STAIR_UP': '<',
            'STAIR_DOWN': '>',
            'CONFIRM': '\r',
            'CANCEL': '\x1b', // ESC
            'WAIT': '.',
            'LOOK': ':',
            'INVENTORY': 'i',
            'PICKUP': ',',
            'DROP': 'd',
            'EAT': 'e',
            'QUAFF': 'q',
            'READ': 'r',
            'WEAR': 'W',
            'TAKEOFF': 'T',
            'WIELD': 'w',
            'CAST': 'z',
            'SEARCH': 's',
            'KICK': '\x04', // Ctrl+d
            'OPEN': 'o',
            'CLOSE': 'c',
            'SEARCH_AGAIN': 's'
        };
    }

    /**
     * 生の KeyboardEvent を解析し、NetHack に送るべき ASCII 文字またはキーコードを返却する
     *
     * @param {KeyboardEvent} event - ブラウザの KeyboardEvent
     * @returns {string|number|null} NetHack に送る入力値 (string または charCode)
     */
    mapKeyEvent(event) {
        if (!event || typeof event !== 'object') return null;

        const key = event.key;
        const code = event.code;
        const ctrlKey = !!event.ctrlKey;
        const altKey = !!event.altKey;

        // 1. 特殊キー (Escape, Enter, Space, Backspace, Tab)
        if (key === 'Escape') return '\x1b';
        if (key === 'Enter') return '\r';
        if (key === 'Space' || key === ' ') return ' ';
        if (key === 'Backspace') return '\b';
        if (key === 'Tab') return '\t';

        // 2. 修飾キー Ctrl+アルファベット / 記号の処理
        if (ctrlKey && key && key.length === 1) {
            const charCode = key.toUpperCase().charCodeAt(0);
            if (charCode >= 64 && charCode <= 95) {
                // Ctrl+A = 1, Ctrl+Z = 26
                return String.fromCharCode(charCode & 0x1F);
            }
        }

        // 3. 方向キー (ArrowKeys) ➔ Viキー または テンキー
        if (key === 'ArrowUp') return this.useNumberPad ? '8' : 'k';
        if (key === 'ArrowDown') return this.useNumberPad ? '2' : 'j';
        if (key === 'ArrowLeft') return this.useNumberPad ? '4' : 'h';
        if (key === 'ArrowRight') return this.useNumberPad ? '6' : 'l';

        // 4. テンキー (Numpad)
        if (code && code.startsWith('Numpad')) {
            const numMap = {
                'Numpad8': '8', 'Numpad2': '2', 'Numpad4': '4', 'Numpad6': '6',
                'Numpad7': '7', 'Numpad9': '9', 'Numpad1': '1', 'Numpad3': '3',
                'Numpad5': '.', 'NumpadEnter': '\r'
            };
            if (numMap[code]) return numMap[code];
        }

        // 5. 単一文字キー（通常のアルファベット・記号・数字）
        if (key && key.length === 1) {
            return key;
        }

        return null;
    }

    /**
     * 汎用アクション名から対応するキーコード / 文字を取得する
     *
     * @param {string} actionName - アクション識別子 (例: 'MOVE_UP', 'CONFIRM')
     * @returns {string|null}
     */
    mapAction(actionName) {
        if (!actionName || typeof actionName !== 'string') return null;
        const upperAction = actionName.toUpperCase();
        return this.actionMap[upperAction] || this.actionMap[actionName] || null;
    }
}
