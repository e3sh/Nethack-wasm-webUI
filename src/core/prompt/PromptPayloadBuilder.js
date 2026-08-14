/**
 * PromptPayloadBuilder.js - WebUICore プロンプト GUI ペイロード構築モジュール
 *
 * 生の C コアプロンプト（YN選択肢, MENUアイテム, LINE_TEXT, DIRECTION 等）を
 * フロントエンド UI モーダルが直接バインド可能な構造化データ (GUIInputRequiredPayload) へパース・変換する。
 */

import { PROMPT_CATEGORY } from '../types.js';

export class PromptPayloadBuilder {
    constructor(options = {}) {
        this.translator = options.translator || null;
    }

    setTranslator(translator) {
        this.translator = translator;
    }

    /**
     * Raw ペイロードを構造化 GUIInputRequiredPayload オブジェクトに変換
     */
    build(payload) {
        if (!payload) return null;

        const category = payload.category || payload.promptCategory || PROMPT_CATEGORY.OTHER;
        const rawPrompt = payload.rawPrompt || payload.prompt || payload.question || payload.message || '';
        const choices = payload.choices || '';
        const items = payload.items || payload.menuItems || [];

        let inputType = 'CONFIRM';
        let options = [];
        let choicesHint = choices;

        if (category === PROMPT_CATEGORY.MENU || (items && items.length > 0)) {
            inputType = 'MENU';
            options = items.map(item => {
                const charStr = item.charStr || (typeof item.ch === 'number' ? String.fromCharCode(item.ch) : String(item.ch || ''));
                return {
                    ...item,
                    key: charStr,
                    label: item.str || item.rawStr || item.label || '',
                    str: item.str || item.rawStr || item.label || '',
                    charStr: charStr,
                    accelerator: item.accelerator || item.ch,
                    identifier: item.identifier,
                    isSelectable: item.isSelectable !== false
                };
            });
        } else if (category === PROMPT_CATEGORY.YN) {
            inputType = 'CHOICE_BUTTONS';
            let keys = [];
            if (choices) {
                if (choices.includes(' or ')) {
                    keys = choices.split(' or ').map(s => s.trim().charAt(0));
                } else if (choices.includes('/')) {
                    keys = choices.split('/').map(s => s.trim().charAt(0));
                } else {
                    keys = choices.replace(/[^a-zA-Z0-9#]/g, '').split('');
                }
            }
            if (keys.length === 0) {
                keys = ['y', 'n'];
            }

            const labelMap = {
                'y': 'Yes (y)',
                'n': 'No (n)',
                'q': 'Quit (q)',
                'a': 'All (a)',
                'r': 'Right (r)',
                'l': 'Left (l)'
            };

            options = keys.map(k => ({
                key: k,
                label: labelMap[k.toLowerCase()] || `${k}`,
                btnClass: k === 'y' ? 'btn-primary' : (k === 'n' ? 'btn-secondary' : 'btn-default')
            }));
        } else if (
            category === PROMPT_CATEGORY.TEXT || 
            category === PROMPT_CATEGORY.ASKNAME || 
            category === PROMPT_CATEGORY.EXTCMD || 
            category === 'LINE' || 
            category === 'LINE_TEXT' || 
            payload.inputType === 'LINE_TEXT' || 
            payload.context === 'text' || 
            payload.context === 'extcmd' || 
            payload.context === 'get_ext_cmd' || 
            payload.context === 'getlin'
        ) {
            inputType = 'LINE_TEXT';
        } else if (category === PROMPT_CATEGORY.DIRECTION || category === PROMPT_CATEGORY.POSKEY || category === 'DIRECTION') {
            inputType = 'DIRECTION';
            options = [
                { key: 'k', label: 'North (k)', direction: 'N' },
                { key: 'j', label: 'South (j)', direction: 'S' },
                { key: 'h', label: 'West (h)', direction: 'W' },
                { key: 'l', label: 'East (l)', direction: 'E' },
                { key: 'y', label: 'North-West (y)', direction: 'NW' },
                { key: 'u', label: 'North-East (u)', direction: 'NE' },
                { key: 'b', label: 'South-West (b)', direction: 'SW' },
                { key: 'n', label: 'South-East (n)', direction: 'SE' },
                { key: '<', label: 'Up (<)', direction: 'UP' },
                { key: '>', label: 'Down (>)', direction: 'DN' }
            ];
        } else if (category === PROMPT_CATEGORY.KEY || category === PROMPT_CATEGORY.FILE) {
            inputType = 'CONFIRM';
            options = [
                { key: ' ', label: 'Continue (Space)' }
            ];
        }

        let title = payload.title || '';
        if (!title && rawPrompt) {
            title = rawPrompt.replace(/\(?[P|p]ress\s+(?:[S|s]pace|[E|e]nter|[E|e]sc|[A|a]ny\s+key)[^)]*\)?/gi, '').trim();
            title = title.replace(/^#/, '').trim();
        }
        if (!title || title.length > 50) {
            if (category === PROMPT_CATEGORY.MENU) title = 'Menu';
            else if (category === PROMPT_CATEGORY.FILE) title = payload.filename || 'Document';
            else if (category === PROMPT_CATEGORY.YN) title = 'Choice';
            else if (category === PROMPT_CATEGORY.EXTCMD) title = 'Extended Command';
            else if (category === PROMPT_CATEGORY.TEXT || inputType === 'LINE_TEXT') title = 'Input';
            else title = 'Dialog';
        }
        const translatedTitle = (this.translator && typeof this.translator.translate === 'function')
            ? this.translator.translate(title)
            : title;

        return {
            inputType: inputType,
            title: translatedTitle,
            rawTitle: title,
            promptText: payload.prompt || rawPrompt,
            rawPromptText: rawPrompt,
            choicesHint: choicesHint,
            options: options,
            items: options
        };
    }
}
