/**
 * PromptPayloadBuilder.js - WebUICore プロンプト GUI ペイロード構築モジュール
 *
 * 生の C コアプロンプト（YN選択肢, MENUアイテム, LINE_TEXT, DIRECTION 等）を
 * フロントエンド UI モーダルが直接バインド可能な構造化データ (GUIInputRequiredPayload) へパース・変換する。
 */

import { PROMPT_CATEGORY } from '../types.js';
import { SignalDetector } from './SignalDetector.js';

export class PromptPayloadBuilder {
    constructor(options = {}) {
        this.translator = options.translator || null;
        this.gkl = options.gkl || null;
        this.enableKnowledge = options.enableKnowledge !== false;
        this.signalDetector = options.signalDetector || SignalDetector.createDefault();
        this._autoFallbackJa = !options.signalDetector;
        this._jaSignalDetector = this._autoFallbackJa ? SignalDetector.createForLocale('ja') : null;
    }

    setSignalDetector(signalDetector) {
        this.signalDetector = signalDetector;
        this._autoFallbackJa = false;
        this._jaSignalDetector = null;
    }

    /**
     * プロンプト/ペイロードから制御シグナルを検知
     * @private
     */
    _detectSignal(payload) {
        if (!this.signalDetector) return null;
        const result = this.signalDetector.detect(payload);
        if (result && result.matched) {
            return result;
        }
        if (this._autoFallbackJa && this._jaSignalDetector) {
            const jaResult = this._jaSignalDetector.detect(payload);
            if (jaResult && jaResult.matched) {
                return jaResult;
            }
        }
        return result;
    }

    setTranslator(translator) {
        this.translator = translator;
    }

    setGkl(gkl) {
        this.gkl = gkl;
    }

    setKnowledgeEnabled(enabled) {
        this.enableKnowledge = !!enabled;
    }

    /**
     * Raw ペイロードを構造化 GUIInputRequiredPayload オブジェクトに変換
     */
    build(payload) {
        if (!payload) return null;

        const signal = this._detectSignal(payload);

        const category = payload.category || payload.promptCategory || PROMPT_CATEGORY.OTHER;
        const rawPrompt = payload.rawPrompt || payload.prompt || payload.question || payload.message || '';
        const choices = payload.choices || '';
        const items = payload.items || payload.menuItems || [];

        let inputType = 'CONFIRM';
        let options = [];
        let choicesHint = choices;

        const isDirectionCategory = category === PROMPT_CATEGORY.DIRECTION || category === 'DIRECTION';
        const isDirectionSignal = signal && (signal.signalId === 'SIGNAL_DIRECTION' || signal.subCategory === 'DIRECTION' || signal.inputType === 'DIRECTION');

        if (category === PROMPT_CATEGORY.MENU || (items && items.length > 0)) {
            inputType = 'MENU';
            options = items.map(item => {
                const charStr = item.charStr || (typeof item.ch === 'number' ? String.fromCharCode(item.ch) : String(item.ch || ''));
                const labelStr = item.str || item.rawStr || item.label || '';

                // ナレッジ自動パイプライン (enableKnowledge が true の時のみ自動添付)
                let knowledge = item.knowledge || null;
                if (this.enableKnowledge && !knowledge && this.gkl) {
                    if (typeof this.gkl.getKnowledge === 'function') {
                        knowledge = this.gkl.getKnowledge(item) || this.gkl.getKnowledge(labelStr);
                    }
                    if (!knowledge && this.gkl.structuredKnowledge && typeof this.gkl.structuredKnowledge.getKnowledge === 'function') {
                        knowledge = this.gkl.structuredKnowledge.getKnowledge(item, { translate: true }) || this.gkl.structuredKnowledge.getKnowledge(labelStr, { translate: true });
                    }
                }

                // 元のアイテムオブジェクト自体にもナレッジを確実に物理アタッチ！
                item.knowledge = knowledge;

                return {
                    ...item,
                    knowledge: knowledge,
                    key: charStr,
                    label: labelStr,
                    str: labelStr,
                    charStr: charStr,
                    accelerator: item.accelerator || item.ch,
                    identifier: item.identifier,
                    isSelectable: item.isSelectable !== false
                };
            });
        } else if (isDirectionCategory || (isDirectionSignal && (category === PROMPT_CATEGORY.YN || !choices || choices.trim() === ''))) {
            inputType = 'DIRECTION';
            options = []; // 方向入力時の誤爆を防止するため汎用選択肢ボタンは生成しない
        } else if (category === PROMPT_CATEGORY.YN || category === 'YN' || payload.context === 'yn_function' || payload.context === 'yn') {
            // choices が存在するか、あるいは質問文から選択肢を抽出
            let effectiveChoices = choices ? choices.trim() : '';
            if (!effectiveChoices && rawPrompt) {
                const match = rawPrompt.match(/\[([a-zA-Z0-9\*\?\s\/\-\#]+)\]/);
                if (match && match[1]) {
                    effectiveChoices = match[1].trim();
                }
            }

            if (effectiveChoices) {
                inputType = 'CHOICE_BUTTONS';
                let keys = [];

                // 'or' という単語を空白に置換して区切り文字として扱い、カンマ・スラッシュ・空白で分割
                const cleaned = effectiveChoices.replace(/\bor\b/gi, ' ');
                const tokens = cleaned.split(/[\s,\/]+/);
                for (const token of tokens) {
                    if (!token) continue;
                    // 範囲表記 (例: a-d, 1-5) のチェック
                    const rangeMatch = token.match(/^([a-zA-Z0-9])-([a-zA-Z0-9])$/);
                    if (rangeMatch) {
                        const start = rangeMatch[1].charCodeAt(0);
                        const end = rangeMatch[2].charCodeAt(0);
                        if (start <= end && (end - start) <= 26) {
                            for (let c = start; c <= end; c++) {
                                keys.push(String.fromCharCode(c));
                            }
                            continue;
                        }
                    }
                    // 範囲でない場合は1文字ずつ分解
                    for (const ch of token) {
                        if (ch !== '-' && ch !== ' ') {
                            keys.push(ch);
                        }
                    }
                }

                // 重複除去
                keys = Array.from(new Set(keys));

                // コンテキスト判定 (左右選択 vs アイテム選択 vs YN確認)
                const lowerChoices = effectiveChoices.toLowerCase();

                // 1. 左右選択 (Side Selection)
                const isSideSelectionSignal = signal && (signal.signalId === 'SIGNAL_SIDE_SELECT' || signal.subCategory === 'SIDE_SELECT');
                const isSideSelection = (lowerChoices === 'lr' || lowerChoices === 'l/r' || lowerChoices === 'rl') ||
                    ((lowerChoices.includes('l') && lowerChoices.includes('r') && lowerChoices.length <= 4) && isSideSelectionSignal);

                // 2. Y/N 確認ダイアログ判定用のキー・選択肢チェック
                const isYnKeysOnly = keys.length > 0 && keys.every(k => ['y', 'n', 'q', 'a', ' '].includes(k.toLowerCase()));
                const isYnChoices = /^[ynqa\s\/]+$/i.test(effectiveChoices);

                // 3. アイテム選択プロンプト (Item Selection)
                const isItemSelectSignal = signal && (signal.signalId === 'SIGNAL_ITEM_SELECT' || signal.subCategory === 'ITEM_SELECT');
                const hasItemSpecialKeys = effectiveChoices.includes('?') || effectiveChoices.includes('*') || /\[.*?(\?|\*).*?\]/.test(rawPrompt || '');
                const hasNonYnKeys = keys.some(k => !['y', 'n', 'q', 'a', ' '].includes(k.toLowerCase()));
                
                const invManager = (this.gkl && this.gkl.inventoryStateManager) ? this.gkl.inventoryStateManager : null;
                const hasMatchingInvLetters = invManager && Array.isArray(invManager.items) &&
                    keys.some(k => k !== '?' && k !== '*' && invManager.items.some(it => it.letter === k));

                let isItemSelection = false;
                if (!isSideSelection) {
                    if (hasItemSpecialKeys || isItemSelectSignal) {
                        isItemSelection = true;
                    } else if (!isYnKeysOnly && !isYnChoices && hasNonYnKeys && hasMatchingInvLetters) {
                        isItemSelection = true;
                    }
                }

                if (keys.length > 0 && keys.length <= 16) {
                    options = keys.map(k => {
                        let label = `${k}`;
                        let btnClass = 'btn-default';

                        if (isItemSelection) {
                            if (k === '?') {
                                label = 'List (?)';
                            } else if (k === '*') {
                                label = 'All (*)';
                            } else {
                                if (invManager && invManager.items) {
                                    const matchedInv = invManager.items.find(it => it.letter === k);
                                    if (matchedInv) {
                                        const rawName = matchedInv.name || matchedInv.text || matchedInv.rawText || '';
                                        const itemName = (this.translator && typeof this.translator.translate === 'function')
                                            ? this.translator.translate(rawName)
                                            : rawName;
                                        if (itemName) {
                                            label = `${itemName} (${k})`;
                                        }
                                    }
                                }
                            }
                        } else if (isSideSelection) {
                            if (k.toLowerCase() === 'l') {
                                label = 'Left (l)';
                            } else if (k.toLowerCase() === 'r') {
                                label = 'Right (r)';
                            }
                        } else {
                            // Y/N / 一般確認ダイアログ
                            const ynLabelMap = {
                                'y': 'Yes (y)',
                                'n': 'No (n)',
                                'q': 'Quit (q)',
                                'a': 'All (a)',
                                '*': 'All (*)',
                                '?': 'List (?)'
                            };
                            label = ynLabelMap[k.toLowerCase()] || ynLabelMap[k] || `${k}`;
                            if (k === 'y' || k === 'Y') {
                                btnClass = 'btn-primary';
                            } else if (k === 'n' || k === 'N') {
                                btnClass = 'btn-secondary';
                            }
                        }

                        return {
                            key: k,
                            label: label,
                            btnClass: btnClass
                        };
                    });
                } else {
                    inputType = 'SINGLE_KEY';
                    options = [];
                }
            } else {
                // choices が完全に空のアイテムレター等の単一キー入力
                inputType = 'SINGLE_KEY';
                options = [];
            }
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
        } else if (category === PROMPT_CATEGORY.POSKEY) {
            inputType = 'TURN_INPUT';
            options = [];
        } else if (category === PROMPT_CATEGORY.KEY || category === PROMPT_CATEGORY.FILE) {

            inputType = 'CONFIRM';
            options = [
                { key: ' ', label: 'Continue (Space)' }
            ];
        }

const DEFAULT_TITLES = {
    [PROMPT_CATEGORY.MENU]: { en: 'Menu', ja: 'メニュー' },
    [PROMPT_CATEGORY.FILE]: { en: 'Document', ja: 'ドキュメント' },
    [PROMPT_CATEGORY.YN]: { en: 'Choice', ja: '選択' },
    [PROMPT_CATEGORY.EXTCMD]: { en: 'Extended Command', ja: '拡張コマンド' },
    [PROMPT_CATEGORY.TEXT]: { en: 'Input', ja: '入力' },
    OTHER: { en: 'Dialog', ja: 'ダイアログ' }
};

        let rawTitle = payload.rawTitle || payload.title || '';
        let translatedTitle = payload.title || '';
        let usedFallback = false;

        if (!rawTitle && rawPrompt) {
            rawTitle = rawPrompt.replace(/\(?[P|p]ress\s+(?:[S|s]pace|[E|e]nter|[E|e]sc|[A|a]ny\s+key)[^)]*\)?/gi, '').trim();
            rawTitle = rawTitle.replace(/^#/, '').trim();
        }

        if (!rawTitle || rawTitle.length > 50) {
            usedFallback = true;
            const isJapanese = this.translator ? this.translator.enabled !== false : true;
            const fb = DEFAULT_TITLES[category] || (inputType === 'LINE_TEXT' ? DEFAULT_TITLES[PROMPT_CATEGORY.TEXT] : DEFAULT_TITLES.OTHER);
            if (category === PROMPT_CATEGORY.FILE && payload.filename) {
                rawTitle = payload.filename;
                translatedTitle = payload.filename;
            } else {
                rawTitle = fb.en;
                translatedTitle = isJapanese ? fb.ja : fb.en;
            }
        }

        if (!usedFallback && (!translatedTitle || translatedTitle === rawTitle)) {
            translatedTitle = (this.translator && typeof this.translator.translate === 'function')
                ? this.translator.translate(rawTitle)
                : rawTitle;
        }

        // シグナル検知結果に基づく subCategory の決定
        let subCategory = payload.subCategory || null;
        let assistant = payload.assistant || null;

        // 1. 願い（Wishing）プロンプトのシグナル検知
        const isWishSignal = signal && (signal.subCategory === 'WISH' || signal.signalId === 'SIGNAL_WISH');
        const isWishPrompt = isWishSignal || payload.subCategory === 'WISH';

        if (isWishPrompt) {
            subCategory = 'WISH';
            if (!assistant) {
                const wishService = (this.gkl && typeof this.gkl.getWishService === 'function')
                    ? this.gkl.getWishService()
                    : (this.gkl && this.gkl.wishService ? this.gkl.wishService : null);

                if (wishService) {
                    let charInfo = { race: 'human', role: 'valkyrie', alignment: 'neutral' };
                    if (this.gkl) {
                        if (typeof this.gkl.getCharacterInfo === 'function') {
                            charInfo = this.gkl.getCharacterInfo() || charInfo;
                        } else if (this.gkl.attributeStateManager?.characterInfo) {
                            charInfo = this.gkl.attributeStateManager.characterInfo;
                        }
                    }
                    const playerRole = payload.playerRole || charInfo.role || 'valkyrie';
                    const playerAlignment = payload.playerAlignment || charInfo.alignment || 'neutral';
                    const playerRace = payload.playerRace || charInfo.race || 'human';

                    assistant = {
                        type: 'WISH',
                        presets: typeof wishService.getPresets === 'function' ? wishService.getPresets() : [],
                        categories: typeof wishService.getCatalogByCategory === 'function' ? Object.keys(wishService.getCatalogByCategory()) : [],
                        wishService: wishService,
                        playerRole: playerRole,
                        playerAlignment: playerAlignment,
                        playerRace: playerRace,
                        existingArtifactCount: payload.existingArtifactCount || 0
                    };
                }
            }
        }

        // 2. 💀 虐殺（Genocide）プロンプトのシグナル検知
        const isGenocideSignal = signal && (signal.subCategory === 'GENOCIDE' || signal.signalId?.startsWith('SIGNAL_GENOCIDE'));
        const isGenocidePrompt = isGenocideSignal || payload.subCategory === 'GENOCIDE';

        if (isGenocidePrompt) {
            subCategory = 'GENOCIDE';
            if (!assistant) {
                const genocideService = (this.gkl && typeof this.gkl.getGenocideService === 'function')
                    ? this.gkl.getGenocideService()
                    : (this.gkl && this.gkl.genocideService ? this.gkl.genocideService : null);

                let charInfo = { race: 'human', role: 'valkyrie' };
                if (this.gkl) {
                    if (typeof this.gkl.getCharacterInfo === 'function') {
                        charInfo = this.gkl.getCharacterInfo() || charInfo;
                    } else if (this.gkl.attributeStateManager?.characterInfo) {
                        charInfo = this.gkl.attributeStateManager.characterInfo;
                    }
                }
                const playerRace = payload.playerRace || charInfo.race || 'human';
                const playerRole = payload.playerRole || charInfo.role || 'valkyrie';
                const genocideMode = (signal && signal.params && signal.params.mode) || payload.genocideMode || 'ALL';

                assistant = {
                    type: 'GENOCIDE',
                    mode: genocideMode,
                    playerRace: playerRace,
                    playerRole: playerRole,
                    presets: genocideService && typeof genocideService.getPresets === 'function' ? genocideService.getPresets(genocideMode) : [],
                    classes: genocideService && typeof genocideService.getMonsterClasses === 'function' ? genocideService.getMonsterClasses() : [],
                    genocideService: genocideService
                };
            }
        }

        // 3. 🦎 変化制御（Polymorph Control）プロンプトのシグナル検知
        const isPolymorphSignal = signal && (signal.subCategory === 'POLYMORPH' || signal.signalId === 'SIGNAL_POLYMORPH');
        const isPolymorphPrompt = isPolymorphSignal || payload.subCategory === 'POLYMORPH';

        if (isPolymorphPrompt) {
            subCategory = 'POLYMORPH';
            if (!assistant) {
                const polymorphService = (this.gkl && typeof this.gkl.getPolymorphService === 'function')
                    ? this.gkl.getPolymorphService()
                    : (this.gkl && this.gkl.polymorphService ? this.gkl.polymorphService : null);

                assistant = {
                    type: 'POLYMORPH',
                    presets: polymorphService && typeof polymorphService.getPresets === 'function' ? polymorphService.getPresets() : [],
                    polymorphService: polymorphService
                };
            }
        }

        return {
            inputType: inputType,
            subCategory: subCategory,
            title: translatedTitle,
            rawTitle: rawTitle,
            promptText: payload.prompt || rawPrompt,
            rawPromptText: rawPrompt,
            choicesHint: choicesHint,
            options: options,
            items: options,
            assistant: assistant
        };
    }
}
