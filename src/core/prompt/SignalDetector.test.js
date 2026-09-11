import { describe, it, expect } from 'vitest';
import { SignalDetector } from './SignalDetector.js';
import { PROMPT_CATEGORY } from '../types.js';

describe('SignalDetector - バリアント/ロケール別辞書分離構成', () => {

    describe('1. Vanilla NetHack 5.0 (英語 Wasm コア / デフォルト辞書) の検証', () => {
        const enDetector = SignalDetector.createDefault();

        it('デフォルトカタログが vanilla / en であること', () => {
            const catalog = enDetector.getCurrentCatalog();
            expect(catalog.variant).toBe('vanilla');
            expect(catalog.locale).toBe('en');
        });

        it('Wish (願い) の英語プロンプトを検知できること', () => {
            const payload = {
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'For what do you wish?'
            };
            const result = enDetector.detect(payload);
            expect(result.matched).toBe(true);
            expect(result.signalId).toBe('SIGNAL_WISH');
            expect(result.subCategory).toBe('WISH');
            expect(result.inputType).toBe('LINE_TEXT');
            expect(enDetector.isSignal(payload, 'SIGNAL_WISH')).toBe(true);
        });

        it('Genocide (虐殺) の英語プロンプトを種別ごとに検知できること', () => {
            // クラス虐殺
            const classRes = enDetector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'What class of monsters do you want to genocide?'
            });
            expect(classRes.matched).toBe(true);
            expect(classRes.signalId).toBe('SIGNAL_GENOCIDE_CLASS');
            expect(classRes.params.mode).toBe('CLASS');

            // 単体虐殺
            const singleRes = enDetector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'What kind of monsters do you wish to genocide?'
            });
            expect(singleRes.matched).toBe(true);
            expect(singleRes.signalId).toBe('SIGNAL_GENOCIDE_SINGLE');
            expect(singleRes.params.mode).toBe('SINGLE');

            // 汎用虐殺
            const genericRes = enDetector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'Genocide which one?'
            });
            expect(genericRes.matched).toBe(true);
            expect(genericRes.signalId).toBe('SIGNAL_GENOCIDE_GENERIC');
            expect(genericRes.params.mode).toBe('ALL');
        });

        it('Polymorph (変化制御) の英語プロンプトを検知できること', () => {
            const result = enDetector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'Become what kind of monster?'
            });
            expect(result.matched).toBe(true);
            expect(result.signalId).toBe('SIGNAL_POLYMORPH');
            expect(result.subCategory).toBe('POLYMORPH');
        });

        it('Container (コンテナ操作) の英語プロンプトを検知できること', () => {
            // ActionMenu
            const actionRes = enDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'Do what with the large box?'
            });
            expect(actionRes.matched).toBe(true);
            expect(actionRes.signalId).toBe('SIGNAL_CONTAINER_ACTION_MENU');
            expect(actionRes.params.containerName).toBe('the large box');

            // Empty container
            const emptyRes = enDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'There is a chest here. chest is empty. Do what with it?'
            });
            expect(emptyRes.matched).toBe(true);
            expect(emptyRes.params.containerName).toBe('chest');

            // FloorSelect
            const floorRes = enDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'Loot which containers?'
            });
            expect(floorRes.matched).toBe(true);
            expect(floorRes.signalId).toBe('SIGNAL_CONTAINER_FLOOR_SELECT');

            // CategorySelect (out)
            const catOutRes = enDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'Take out what type of objects?'
            });
            expect(catOutRes.matched).toBe(true);
            expect(catOutRes.signalId).toBe('SIGNAL_CONTAINER_CATEGORY_SELECT');
            expect(catOutRes.params.direction).toBe('out');

            // CategorySelect (in)
            const catInRes = enDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'Put in what type of objects?'
            });
            expect(catInRes.matched).toBe(true);
            expect(catInRes.params.direction).toBe('in');

            // ItemSelect (out)
            const itemOutRes = enDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'Take out what?'
            });
            expect(itemOutRes.matched).toBe(true);
            expect(itemOutRes.signalId).toBe('SIGNAL_CONTAINER_ITEM_SELECT');
            expect(itemOutRes.params.direction).toBe('out');

            // ItemSelect (in)
            const itemInRes = enDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'Put in what?'
            });
            expect(itemInRes.matched).toBe(true);
            expect(itemInRes.params.direction).toBe('in');
        });

        it('CountPrompt (数量指定) の英語プロンプトを検知できること', () => {
            const countRes = enDetector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'How many [food rations]?'
            });
            expect(countRes.matched).toBe(true);
            expect(countRes.signalId).toBe('SIGNAL_COUNT_PROMPT');
            expect(countRes.params.targetItem).toBe('food rations');
        });

        it('【重要】英語版カタログでは日本語プロンプトが検知されないこと (言語分離の検証)', () => {
            const jaWishResult = enDetector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: '何を願いますか？'
            });
            expect(jaWishResult.matched).toBe(false);

            const jaGenoResult = enDetector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'どのクラスのモンスターを虐殺しますか？'
            });
            expect(jaGenoResult.matched).toBe(false);
        });
    });

    describe('2. JNetHack (日本語 Wasm コア辞書) の検証', () => {
        const jaDetector = SignalDetector.createForLocale('ja');

        it('JNetHack カタログが jnethack / ja であること', () => {
            const catalog = jaDetector.getCurrentCatalog();
            expect(catalog.variant).toBe('jnethack');
            expect(catalog.locale).toBe('ja');
        });

        it('Wish (願い) の日本語プロンプトを検知できること', () => {
            const payload = {
                category: 'LINE_TEXT',
                rawPrompt: '何を願いますか？'
            };
            const result = jaDetector.detect(payload);
            expect(result.matched).toBe(true);
            expect(result.signalId).toBe('SIGNAL_WISH');
            expect(result.subCategory).toBe('WISH');
            expect(result.inputType).toBe('LINE_TEXT');
        });

        it('Genocide (虐殺) の日本語プロンプトを種別ごとに検知できること', () => {
            // クラス虐殺
            const classRes = jaDetector.detect({
                context: 'getlin',
                rawPrompt: 'どのクラスのモンスターを虐殺しますか？'
            });
            expect(classRes.matched).toBe(true);
            expect(classRes.signalId).toBe('SIGNAL_GENOCIDE_CLASS');
            expect(classRes.params.mode).toBe('CLASS');

            // 単体虐殺
            const singleRes = jaDetector.detect({
                context: 'getlin',
                rawPrompt: 'どの種類のモンスターを虐殺しますか？'
            });
            expect(singleRes.matched).toBe(true);
            expect(singleRes.signalId).toBe('SIGNAL_GENOCIDE_SINGLE');
            expect(singleRes.params.mode).toBe('SINGLE');

            // 汎用虐殺
            const genericRes = jaDetector.detect({
                context: 'getlin',
                rawPrompt: '虐殺の対象'
            });
            expect(genericRes.matched).toBe(true);
            expect(genericRes.signalId).toBe('SIGNAL_GENOCIDE_GENERIC');
            expect(genericRes.params.mode).toBe('ALL');
        });

        it('Polymorph (変化制御) の日本語プロンプトを検知できること', () => {
            const result = jaDetector.detect({
                context: 'getlin',
                rawPrompt: 'どの種類のモンスターになりますか？'
            });
            expect(result.matched).toBe(true);
            expect(result.signalId).toBe('SIGNAL_POLYMORPH');
        });

        it('Container (コンテナ操作) の日本語プロンプトを検知できること', () => {
            // ActionMenu
            const actionRes = jaDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: '大きな箱の中身をどうしますか？'
            });
            expect(actionRes.matched).toBe(true);
            expect(actionRes.signalId).toBe('SIGNAL_CONTAINER_ACTION_MENU');
            expect(actionRes.params.containerName).toBe('大きな箱');

            // FloorSelect
            const floorRes = jaDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'どのコンテナを物色しますか？'
            });
            expect(floorRes.matched).toBe(true);
            expect(floorRes.signalId).toBe('SIGNAL_CONTAINER_FLOOR_SELECT');

            // CategorySelect (out / in)
            const catOutRes = jaDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: '取り出すオブジェクトの種類'
            });
            expect(catOutRes.matched).toBe(true);
            expect(catOutRes.params.direction).toBe('out');

            const catInRes = jaDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: '入れるオブジェクトの種類'
            });
            expect(catInRes.matched).toBe(true);
            expect(catInRes.params.direction).toBe('in');

            // ItemSelect (out / in)
            const itemOutRes = jaDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: '何を取り出しますか？'
            });
            expect(itemOutRes.matched).toBe(true);
            expect(itemOutRes.params.direction).toBe('out');

            const itemInRes = jaDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: '何を中に入れますか？'
            });
            expect(itemInRes.matched).toBe(true);
            expect(itemInRes.params.direction).toBe('in');
        });

        it('CountPrompt (数量指定) の日本語プロンプトを検知できること', () => {
            const countRes = jaDetector.detect({
                category: 'LINE_TEXT',
                rawPrompt: '何個のリンゴ？'
            });
            expect(countRes.matched).toBe(true);
            expect(countRes.signalId).toBe('SIGNAL_COUNT_PROMPT');
            expect(countRes.params.targetItemJa).toBe('リンゴ');
        });

        it('【重要】日本語版カタログでは英語プロンプトが検知されないこと (言語分離の検証)', () => {
            const enWishResult = jaDetector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'For what do you wish?'
            });
            expect(enWishResult.matched).toBe(false);
        });
    });

    describe('3. トリガコマンド・コンテキスト制御と安全性', () => {
        const detector = SignalDetector.createDefault();

        it('同じプロンプトでも triggerCommand: "#loot" が指定されている場合は専用シグナルへ分岐すること', () => {
            const payload = {
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'Do what with the chest?'
            };

            // トリガなし
            const normalResult = detector.detect(payload);
            expect(normalResult.signalId).toBe('SIGNAL_CONTAINER_ACTION_MENU');
            expect(normalResult.params.source).toBeUndefined();

            // triggerCommand: '#loot' 指定時
            const lootResult = detector.detect(payload, { triggerCommand: '#loot' });
            expect(lootResult.signalId).toBe('SIGNAL_CONTAINER_ACTION_MENU_LOOT');
            expect(lootResult.params.source).toBe('LOOT_COMMAND');
        });

        it('インベントリアクションメニューの項目 (drop, throw等) がある場合はコンテナメニューとして除外されること', () => {
            const payload = {
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'Do what with the bag?',
                items: [
                    { charStr: 'd', label: 'drop bag' },
                    { charStr: 't', label: 'throw bag' }
                ]
            };
            const result = detector.detect(payload);
            expect(result.matched).toBe(false);
        });

        it('一般的な Yes/No プロンプトでは matched: false となること', () => {
            const result = detector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: 'Shall I pick up the gold? [y/n]'
            });
            expect(result.matched).toBe(false);
            expect(result.signalId).toBeNull();
        });
    });

    describe('4. カスタムカタログの動的注入', () => {
        it('外部からカスタムカタログを渡して独自バリアントを検知できること', () => {
            const customCatalog = {
                version: '1.0.0',
                variant: 'slashem',
                signals: [
                    {
                        id: 'SLASH_SIGNAL_TECHNIQUE',
                        subCategory: 'TECHNIQUE',
                        inputType: 'MENU',
                        priority: 200,
                        patterns: ['Which technique do you want to use\\?'],
                        params: { variant: 'slashem' }
                    }
                ]
            };

            const customDetector = new SignalDetector(customCatalog);
            const result = customDetector.detect({
                category: 'MENU',
                rawPrompt: 'Which technique do you want to use?'
            });

            expect(result.matched).toBe(true);
            expect(result.signalId).toBe('SLASH_SIGNAL_TECHNIQUE');
            expect(result.subCategory).toBe('TECHNIQUE');
            expect(result.params.variant).toBe('slashem');
        });
    });
});
