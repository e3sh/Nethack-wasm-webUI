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

        it('Write (魔法のマーカー書き込み) の英語プロンプトを検知できること', () => {
            const scrollRes = enDetector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'What type of scroll do you want to write?'
            });
            expect(scrollRes.matched).toBe(true);
            expect(scrollRes.signalId).toBe('SIGNAL_WRITE_SCROLL');
            expect(scrollRes.subCategory).toBe('WRITE');
            expect(scrollRes.params.targetType).toBe('SCROLL');

            const bookRes = enDetector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'What type of spellbook do you want to write?'
            });
            expect(bookRes.matched).toBe(true);
            expect(bookRes.signalId).toBe('SIGNAL_WRITE_SPELLBOOK');
            expect(bookRes.subCategory).toBe('WRITE');
            expect(bookRes.params.targetType).toBe('SPELLBOOK');
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

        it('Direction, SideSelect, ItemSelect の英語プロンプトを検知できること', () => {
            // Direction
            const dirRes = enDetector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: 'In what direction?'
            });
            expect(dirRes.matched).toBe(true);
            expect(dirRes.signalId).toBe('SIGNAL_DIRECTION');
            expect(dirRes.subCategory).toBe('DIRECTION');
            expect(dirRes.inputType).toBe('DIRECTION');

            // SideSelect
            const sideRes = enDetector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: 'Which ring? [lr]'
            });
            expect(sideRes.matched).toBe(true);
            expect(sideRes.signalId).toBe('SIGNAL_SIDE_SELECT');
            expect(sideRes.subCategory).toBe('SIDE_SELECT');

            // ItemSelect
            const itemRes = enDetector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: 'What do you want to eat? [efgh or ?*]'
            });
            expect(itemRes.matched).toBe(true);
            expect(itemRes.signalId).toBe('SIGNAL_ITEM_SELECT');
            expect(itemRes.subCategory).toBe('ITEM_SELECT');

            // ConfirmYN
            const confirmRes = enDetector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: 'Are you sure you want to pray? [yn]'
            });
            expect(confirmRes.matched).toBe(true);
            expect(confirmRes.signalId).toBe('SIGNAL_CONFIRM_YN');
            expect(confirmRes.subCategory).toBe('CONFIRM_YN');

            const eatConfirmRes = enDetector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: 'This corpse smells terrible! Eat it anyway? [yn]'
            });
            expect(eatConfirmRes.matched).toBe(true);
            expect(eatConfirmRes.signalId).toBe('SIGNAL_CONFIRM_YN');

            // TextInput
            const textRes = enDetector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'What do you want to engrave on the floor?'
            });
            expect(textRes.matched).toBe(true);
            expect(textRes.signalId).toBe('SIGNAL_TEXT_INPUT');
            expect(textRes.subCategory).toBe('TEXT_INPUT');

            // ToolSelect
            const toolRes = enDetector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: 'What do you want to write with?'
            });
            expect(toolRes.subCategory).toBe('TOOL_SELECT');

            // CharacterCreation
            const roleRes = enDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'Pick a role or profession'
            });
            expect(roleRes.matched).toBe(true);
            expect(roleRes.signalId).toBe('SIGNAL_CHARACTER_CREATION');
            expect(roleRes.subCategory).toBe('CHARACTER_CREATION');
            expect(roleRes.params.step).toBe('role');

            const raceRes = enDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'Pick a race or species'
            });
            expect(raceRes.matched).toBe(true);
            expect(raceRes.params.step).toBe('race');

            const genderRes = enDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'Pick a gender or sex'
            });
            expect(genderRes.matched).toBe(true);
            expect(genderRes.params.step).toBe('gender');

            const alignRes = enDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'Pick an alignment or creed'
            });
            expect(alignRes.matched).toBe(true);
            expect(alignRes.params.step).toBe('alignment');

            // Step 13 (最終確認メニュー)
            const confirmMenuRes = enDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'Is this ok? [ynq]',
                items: [
                    { identifier: 0, str: 'home the lawful male human Archeologist' },
                    { identifier: 1, accelerator: 'y', str: 'Yes; start game' },
                    { identifier: 2, accelerator: 'n', str: 'No; choose role again' }
                ]
            });
            expect(confirmMenuRes.matched).toBe(true);
            expect(confirmMenuRes.signalId).toBe('SIGNAL_CHARACTER_CREATION');
            expect(confirmMenuRes.params.step).toBe('confirm');

            // アイテム使用メニューはキャラ作成シグナルとして誤検知されないこと
            const itemMenuRes = enDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'What do you want to use or apply?',
                items: [
                    { identifier: 1, accelerator: 'a', str: 'the blessed +1 silver dragon scale mail' },
                    { identifier: 2, accelerator: 'b', str: 'the +0 Hawaiian shirt' }
                ]
            });
            expect(itemMenuRes.signalId).not.toBe('SIGNAL_CHARACTER_CREATION');
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

        it('Write (魔法のマーカー書き込み) の日本語プロンプトを検知できること', () => {
            const scrollRes = jaDetector.detect({
                context: 'getlin',
                rawPrompt: 'どんな巻物を書くか?'
            });
            expect(scrollRes.matched).toBe(true);
            expect(scrollRes.signalId).toBe('SIGNAL_WRITE_SCROLL');
            expect(scrollRes.subCategory).toBe('WRITE');
            expect(scrollRes.params.targetType).toBe('SCROLL');

            const bookRes = jaDetector.detect({
                context: 'getlin',
                rawPrompt: 'どんな呪文書を書くか?'
            });
            expect(bookRes.matched).toBe(true);
            expect(bookRes.signalId).toBe('SIGNAL_WRITE_SPELLBOOK');
            expect(bookRes.subCategory).toBe('WRITE');
            expect(bookRes.params.targetType).toBe('SPELLBOOK');
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

        it('Direction, SideSelect, ItemSelect の日本語プロンプトを検知できること', () => {
            // Direction
            const dirRes = jaDetector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: 'どの方向に進みますか？'
            });
            expect(dirRes.matched).toBe(true);
            expect(dirRes.signalId).toBe('SIGNAL_DIRECTION');
            expect(dirRes.subCategory).toBe('DIRECTION');
            expect(dirRes.inputType).toBe('DIRECTION');

            // SideSelect
            const sideRes = jaDetector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: 'どちらの指輪を外しますか？ [lr]'
            });
            expect(sideRes.matched).toBe(true);
            expect(sideRes.signalId).toBe('SIGNAL_SIDE_SELECT');
            expect(sideRes.subCategory).toBe('SIDE_SELECT');

            // ItemSelect
            const itemRes = jaDetector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: '何を食べますか？ [efgh or ?*]'
            });
            expect(itemRes.matched).toBe(true);
            expect(itemRes.signalId).toBe('SIGNAL_ITEM_SELECT');
            expect(itemRes.subCategory).toBe('ITEM_SELECT');

            // ConfirmYN
            const confirmRes = jaDetector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: '本当によろしいですか？ [y/n]'
            });
            expect(confirmRes.matched).toBe(true);
            expect(confirmRes.signalId).toBe('SIGNAL_CONFIRM_YN');

            const eatConfirmRes = jaDetector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: '古い死体です。本当に食べますか？ [y/n]'
            });
            expect(eatConfirmRes.matched).toBe(true);
            expect(eatConfirmRes.signalId).toBe('SIGNAL_CONFIRM_YN');

            // TextInput
            const textRes = jaDetector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: '床に何と刻みますか？'
            });
            expect(textRes.matched).toBe(true);
            expect(textRes.signalId).toBe('SIGNAL_TEXT_INPUT');

            // ToolSelect
            const toolRes = jaDetector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: '何を使って書きますか？'
            });
            expect(toolRes.matched).toBe(true);
            expect(toolRes.signalId).toBe('SIGNAL_TOOL_SELECT');

            // キャラクタ作成 (JNetHack)
            const jaRoleRes = jaDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: '職業を選択してください'
            });
            expect(jaRoleRes.matched).toBe(true);
            expect(jaRoleRes.signalId).toBe('SIGNAL_CHARACTER_CREATION');
            expect(jaRoleRes.params.step).toBe('role');

            const jaConfirmRes = jaDetector.detect({
                category: PROMPT_CATEGORY.MENU,
                rawPrompt: 'よろしいですか？ [ynq]',
                items: [
                    { identifier: 0, str: 'home 秩序 男 人間 考古学者' },
                    { identifier: 1, accelerator: 'y', str: 'はい; ゲームを開始' }
                ]
            });
            expect(jaConfirmRes.matched).toBe(true);
            expect(jaConfirmRes.signalId).toBe('SIGNAL_CHARACTER_CREATION');
            expect(jaConfirmRes.params.step).toBe('confirm');
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

        it('payload にプロンプト文面が無い場合でも、contextInfo.lastMessage から SIGNAL_DIRECTION を正しく同定できること (en / ja)', () => {
            const enDetector = SignalDetector.createDefault();
            const jaDetector = SignalDetector.createForLocale('ja');

            // 英語バリアント (Vanilla NetHack 5.0)
            const resEn = enDetector.detect(
                { type: 'poskey', context: 'poskey' },
                { lastMessage: 'In what direction?' }
            );
            expect(resEn.matched).toBe(true);
            expect(resEn.signalId).toBe('SIGNAL_DIRECTION');
            expect(resEn.inputType).toBe('DIRECTION');

            // 日本語バリアント (JNetHack)
            const resJa = jaDetector.detect(
                { type: 'poskey', context: 'poskey' },
                { lastMessage: 'どの方向に？' }
            );
            expect(resJa.matched).toBe(true);
            expect(resJa.signalId).toBe('SIGNAL_DIRECTION');
            expect(resJa.inputType).toBe('DIRECTION');

            // 実機等価: TranslationEngine で日本語化された inputType: 'DIRECTION', prompt: 'どの方向？'
            const resRealDevice = enDetector.detect(
                { inputType: 'DIRECTION', prompt: 'どの方向？', title: 'どの方向？' },
                { lastMessage: 'In what direction?' }
            );
            expect(resRealDevice.matched).toBe(true);
            expect(resRealDevice.signalId).toBe('SIGNAL_DIRECTION');
            expect(resRealDevice.subCategory).toBe('DIRECTION');
        });
    });

    describe('5. Phase 3: NetHack 5.0 C コア由来の完全網羅制御シグナル検証', () => {
        const detector = SignalDetector.createDefault();

        it('音楽演奏プロンプト (SIGNAL_MUSIC_TUNE) を正しく検知できること', () => {
            const res = detector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'What tune are you playing? [5 notes, A-G]'
            });
            expect(res.matched).toBe(true);
            expect(res.signalId).toBe('SIGNAL_MUSIC_TUNE');
            expect(res.subCategory).toBe('MUSIC');
            expect(res.inputType).toBe('LINE_TEXT');
            expect(res.params.maxNotes).toBe(5);
        });

        it('レベルテレポートプロンプト (SIGNAL_LEVEL_TELEPORT) を正しく検知できること', () => {
            const res = detector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'To what level do you want to teleport?'
            });
            expect(res.matched).toBe(true);
            expect(res.signalId).toBe('SIGNAL_LEVEL_TELEPORT');
            expect(res.subCategory).toBe('TELEPORT');
            expect(res.inputType).toBe('LINE_TEXT');
        });

        it('命名・アノテーション・身元確認プロンプトを種別ごとに検知できること', () => {
            // 道具・モンスター命名
            const nameRes = detector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'What do you want to name this broadsword?'
            });
            expect(nameRes.matched).toBe(true);
            expect(nameRes.signalId).toBe('SIGNAL_TEXT_INPUT');

            // ダンジョン階層アノテーション
            const annotRes = detector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'What do you want to call this dungeon level?'
            });
            expect(annotRes.matched).toBe(true);
            expect(annotRes.signalId).toBe('SIGNAL_DUNGEON_ANNOTATION');
            expect(annotRes.subCategory).toBe('NAME');

            // 門番の身元確認
            const guardRes = detector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: '"Hello stranger, who are you?" -'
            });
            expect(guardRes.matched).toBe(true);
            expect(guardRes.signalId).toBe('SIGNAL_GUARD_NAME_INQUIRY');
        });

        it('刻み文字追記確認プロンプト (SIGNAL_ENGRAVE_ADD_QUERY) を正しく検知できること', () => {
            const res = detector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: 'Do you want to add to the current engraving?'
            });
            expect(res.matched).toBe(true);
            expect(res.signalId).toBe('SIGNAL_ENGRAVE_ADD_QUERY');
            expect(res.subCategory).toBe('ENGRAVE');
            expect(res.validKeys).toBe('ynq');
            expect(res.defaultKey).toBe('y');
        });

        it('食事確認プロンプト (SIGNAL_EAT_QUERY / SIGNAL_EAT_FLOOR_QUERY) を正しく検知できること', () => {
            // 持ち物食事
            const invEat = detector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: 'Eat the tripe ration?'
            });
            expect(invEat.matched).toBe(true);
            expect(invEat.signalId).toBe('SIGNAL_EAT_QUERY');
            expect(invEat.subCategory).toBe('EAT');
            expect(invEat.validKeys).toBe('yn');
            expect(invEat.defaultKey).toBe('n');

            // 床の食事
            const floorEat = detector.detect({
                category: PROMPT_CATEGORY.YN,
                rawPrompt: 'There is a pear here; eat it?'
            });
            expect(floorEat.matched).toBe(true);
            expect(floorEat.signalId).toBe('SIGNAL_EAT_FLOOR_QUERY');
            expect(floorEat.subCategory).toBe('EAT');
            expect(floorEat.validKeys).toBe('ynq');
            expect(floorEat.defaultKey).toBe('n');
        });

        it('ゲーム終了時開示プロンプト群 (DISCLOSE) を正確に識別できること', () => {
            // 所持品
            const possRes = detector.detect({
                rawPrompt: 'Do you want your possessions identified?'
            });
            expect(possRes.matched).toBe(true);
            expect(possRes.signalId).toBe('SIGNAL_DISCLOSE_POSSESSIONS');
            expect(possRes.params.discloseType).toBe('POSSESSIONS');
            expect(possRes.validKeys).toBe('ynq');

            // 属性
            const attrRes = detector.detect({
                rawPrompt: 'Do you want to see your attributes?'
            });
            expect(attrRes.matched).toBe(true);
            expect(attrRes.signalId).toBe('SIGNAL_DISCLOSE_ATTRIBUTES');
            expect(attrRes.params.discloseType).toBe('ATTRIBUTES');

            // 行動
            const condRes = detector.detect({
                rawPrompt: 'Do you want to see your conduct?'
            });
            expect(condRes.matched).toBe(true);
            expect(condRes.signalId).toBe('SIGNAL_DISCLOSE_CONDUCT');
            expect(condRes.params.discloseType).toBe('CONDUCT');

            // ダンジョン概要
            const overRes = detector.detect({
                rawPrompt: 'Do you want to see the dungeon overview?'
            });
            expect(overRes.matched).toBe(true);
            expect(overRes.signalId).toBe('SIGNAL_DISCLOSE_OVERVIEW');
            expect(overRes.params.discloseType).toBe('OVERVIEW');

            // 撃破記録
            const vanqRes = detector.detect({
                rawPrompt: 'Do you want an account of creatures vanquished?'
            });
            expect(vanqRes.matched).toBe(true);
            expect(vanqRes.signalId).toBe('SIGNAL_DISCLOSE_VANQUISHED');
            expect(vanqRes.params.discloseType).toBe('VANQUISHED');

            // 虐殺一覧
            const genoRes = detector.detect({
                rawPrompt: 'Do you want a list of species genocided?'
            });
            expect(genoRes.matched).toBe(true);
            expect(genoRes.signalId).toBe('SIGNAL_DISCLOSE_GENOCIDED');
            expect(genoRes.params.discloseType).toBe('GENOCIDED');
            expect(genoRes.validKeys).toBe('ynaq');
        });

        it('特殊能力・アクションプロンプトを正確に検知できること', () => {
            // クモ能力 (hide or spin)
            const spiderRes = detector.detect({
                rawPrompt: 'Hide [h] or spin a web [s]?'
            });
            expect(spiderRes.matched).toBe(true);
            expect(spiderRes.signalId).toBe('SIGNAL_SPIDER_ABILITY');
            expect(spiderRes.validKeys).toBe('hsq');
            expect(spiderRes.defaultKey).toBe('q');

            // 水晶玉探索
            const ballRes = detector.detect({
                rawPrompt: 'What do you look for?'
            });
            expect(ballRes.matched).toBe(true);
            expect(ballRes.signalId).toBe('SIGNAL_CRYSTAL_BALL');

            // 乗騎キック確認
            const kickRes = detector.detect({
                rawPrompt: 'Kick your steed?'
            });
            expect(kickRes.matched).toBe(true);
            expect(kickRes.signalId).toBe('SIGNAL_STEED_KICK');
            expect(kickRes.validKeys).toBe('yn');
            expect(kickRes.defaultKey).toBe('y');

            // 悪魔への賄賂額入力
            const bribeRes = detector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'How much will you offer?'
            });
            expect(bribeRes.matched).toBe(true);
            expect(bribeRes.signalId).toBe('SIGNAL_BRIBE_AMOUNT');

            // 店主の明細請求
            const billRes = detector.detect({
                rawPrompt: 'Itemized billing?'
            });
            expect(billRes.matched).toBe(true);
            expect(billRes.signalId).toBe('SIGNAL_ITEMIZED_BILLING');
            expect(billRes.validKeys).toBe('ynqm');
            expect(billRes.defaultKey).toBe('q');
        });

        it('操作・インベントリ・コマンド系プロンプトを正確に検知できること', () => {
            // 分割数
            const splitRes = detector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'Split off how many?'
            });
            expect(splitRes.matched).toBe(true);
            expect(splitRes.signalId).toBe('SIGNAL_SPLIT_PROMPT');

            // 見る対象の指定
            const lookRes = detector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'Specify what? (type the word)'
            });
            expect(lookRes.matched).toBe(true);
            expect(lookRes.signalId).toBe('SIGNAL_SPECIFY_OBJECT');

            // コマンドヘルプ
            const cmdRes = detector.detect({
                rawPrompt: 'What command?'
            });
            expect(cmdRes.matched).toBe(true);
            expect(cmdRes.signalId).toBe('SIGNAL_WHAT_COMMAND');

            // 拡張コマンド検索
            const extRes = detector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'Search for which extended command?'
            });
            expect(extRes.matched).toBe(true);
            expect(extRes.signalId).toBe('SIGNAL_EXTCMD_SEARCH');

            // 呪文詠唱
            const spellRes = detector.detect({
                rawPrompt: 'Cast which spell?'
            });
            expect(spellRes.matched).toBe(true);
            expect(spellRes.signalId).toBe('SIGNAL_CAST_SPELL');

            // システムエラーレポート
            const sysRes = detector.detect({
                rawPrompt: 'Report now?'
            });
            expect(sysRes.matched).toBe(true);
            expect(sysRes.signalId).toBe('SIGNAL_SYSTEM_REPORT_NOW');
            expect(sysRes.validKeys).toBe('yn');
            expect(sysRes.defaultKey).toBe('n');

            // モンスター生成
            const createRes = detector.detect({
                category: PROMPT_CATEGORY.TEXT,
                rawPrompt: 'Create what kind of monster?'
            });
            expect(createRes.matched).toBe(true);
            expect(createRes.signalId).toBe('SIGNAL_CREATE_MONSTER');
        });

        it('通常のゲームプレイナレーションが制御シグナルに誤爆しないこと (False Positive ゼロ検証)', () => {
            const falsePositives = [
                'You hit the goblin.',
                'The door opens.',
                'You feel much better.',
                'You hear someone crying out.',
                'There is a closed door here.',
                'You displace the kitten.',
                'Welcome to NetHack! You are an elven wizard.',
                'The stairs lead up.'
            ];

            for (const text of falsePositives) {
                const res = detector.detect({ rawPrompt: text });
                expect(res.matched).toBe(false);
                expect(res.signalId).toBeNull();
            }
        });
    });
});
