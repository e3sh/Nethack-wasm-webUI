import { describe, it, expect, beforeEach } from 'vitest';
import { AttributeStateManager, ATTRIBUTE_KEYS } from './AttributeStateManager.js';
import { parseAttributesLine } from './CHARACTER_KNOWLEDGE_BASE.js';

describe('AttributeStateManager Tests', () => {
    let attrManager;

    beforeEach(() => {
        attrManager = new AttributeStateManager();
    });

    it('全38種類の属性キーが定義されており、初期状態ではすべて false であること', () => {
        expect(ATTRIBUTE_KEYS.length).toBe(38);
        const attrs = attrManager.getAttributes();
        expect(attrs.isSynced).toBe(false);

        for (const k of ATTRIBUTE_KEYS) {
            expect(attrs.effectiveResistances[k]).toBe(false);
            expect(attrs.intrinsics[k]).toBe(false);
            expect(attrs.extrinsics[k]).toBe(false);
        }
    });

    it('^X (#attributes) テキスト出力から内因性耐性を正しくパースできること', () => {
        const sampleLines = [
            'You are fire resistant.',
            'You are poison resistant.',
            'You see invisible.',
            'You are warned.',
            'You have teleport control.',
            'You are fast.'
        ];

        attrManager.updateFromIntrinsicsLines(sampleLines);

        const attrs = attrManager.getAttributes();
        expect(attrs.isSynced).toBe(true);

        // 有効化された耐性
        expect(attrs.intrinsics.fire).toBe(true);
        expect(attrs.intrinsics.poison).toBe(true);
        expect(attrs.intrinsics.seeInvis).toBe(true);
        expect(attrs.intrinsics.warning).toBe(true);
        expect(attrs.intrinsics.teleportControl).toBe(true);
        expect(attrs.intrinsics.fast).toBe(true);

        // 未有効化の耐性
        expect(attrs.intrinsics.cold).toBe(false);
        expect(attrs.intrinsics.shock).toBe(false);
        expect(attrs.intrinsics.sleep).toBe(false);
        expect(attrs.intrinsics.reflect).toBe(false);
    });

    it('日本語版 NetHack の ^X 出力から内因性耐性を正しくパースできること', () => {
        const sampleLines = [
            '火炎に対する耐性がある',
            '電撃に対する耐性がある',
            '不可視のものを視認できる',
            '反射能力がある'
        ];

        attrManager.updateFromIntrinsicsLines(sampleLines);

        const eff = attrManager.getEffectiveResistances();
        expect(eff.fire).toBe(true);
        expect(eff.shock).toBe(true);
        expect(eff.seeInvis).toBe(true);
        expect(eff.reflect).toBe(true);
        expect(eff.cold).toBe(false);
    });

    it('装備中アイテム（指輪・防具・靴・外套・盾等）から外因性耐性 (Extrinsics) を正しく自動抽出・マージできること', () => {
        const inventoryItems = [
            { rawText: 'a blessed ring of fire resistance (on right hand)', isWornRight: true },
            { rawText: 'a +1 silver dragon scale mail (being worn)', isWorn: true },
            { rawText: 'a pair of water walking boots (being worn)', isWorn: true },
            { rawText: 'a cloak of protection (being worn)', isWorn: true },
            { rawText: 'a cloak of magic resistance (being worn)', isWorn: true },
            { rawText: 'a ring of levitation (on left hand)', isWornLeft: true },
            { rawText: 'a ring of cold resistance in pack', isWorn: false } // 装備していない指輪
        ];

        attrManager.updateExtrinsicsFromInventory(inventoryItems);

        const attrs = attrManager.getAttributes();
        expect(attrs.extrinsics.fire).toBe(true);
        expect(attrs.extrinsics.reflect).toBe(true); // silver dragon scale mail provides reflection
        expect(attrs.extrinsics.wwalking).toBe(true); // water walking boots
        expect(attrs.extrinsics.protection).toBe(true); // cloak of protection
        expect(attrs.extrinsics.antimagic).toBe(true); // cloak of magic resistance
        expect(attrs.extrinsics.levitation).toBe(true);
        expect(attrs.extrinsics.cold).toBe(false); // バッグ内なので無効

        // 内因性と外因性の統合 (EffectiveResistances)
        expect(attrs.effectiveResistances.fire).toBe(true);
        expect(attrs.effectiveResistances.reflect).toBe(true);
        expect(attrs.effectiveResistances.wwalking).toBe(true);
        expect(attrs.effectiveResistances.protection).toBe(true);
        expect(attrs.effectiveResistances.antimagic).toBe(true);
        expect(attrs.effectiveResistances.levitation).toBe(true);
        expect(attrs.effectiveResistances.cold).toBe(false);
    });

    it('耐性獲得メッセージから動的に内因性耐性が追加されること', () => {
        expect(attrManager.getEffectiveResistances().fire).toBe(false);

        const changed = attrManager.updateFromMessage('You feel a hot sensation.');
        expect(changed).toBe(true);
        expect(attrManager.getEffectiveResistances().fire).toBe(true);

        const changed2 = attrManager.updateFromMessage('You feel healthy.');
        expect(changed2).toBe(true);
        expect(attrManager.getEffectiveResistances().poison).toBe(true);
    });

    it('reset() で全耐性が初期化されること', () => {
        attrManager.updateFromIntrinsicsLines(['You are fire resistant.']);
        expect(attrManager.getEffectiveResistances().fire).toBe(true);

        attrManager.reset();
        expect(attrManager.getEffectiveResistances().fire).toBe(false);
        expect(attrManager.isSynced).toBe(false);
    });

    it('updateCharacter() で種族・職業・レベルに応じた確定内在耐性が決定論的に即時反映されること', () => {
        // Elf Wizard: Level 1 は infravision, Level 4 で sleep 耐性を獲得
        attrManager.updateCharacter({ race: 'Elf', role: 'Wizard', level: 1 });
        let attrs = attrManager.getAttributes();
        expect(attrs.innate.infravision).toBe(true);
        expect(attrs.innate.sleep).toBe(false);
        expect(attrs.effectiveResistances.sleep).toBe(false);

        // レベル 4 に上昇
        attrManager.updateCharacter({ level: 4 });
        attrs = attrManager.getAttributes();
        expect(attrs.innate.sleep).toBe(true);
        expect(attrs.effectiveResistances.sleep).toBe(true);
    });

    it('装備品着脱時も確定内在耐性が失われず、実効耐性が正しく追従すること', () => {
        // Valkyrie Level 1 は先天的に cold 耐性を持つ
        attrManager.updateCharacter({ race: 'Human', role: 'Valkyrie', level: 1 });
        expect(attrManager.getEffectiveResistances().cold).toBe(true);

        // 火炎の指輪を装備
        attrManager.updateExtrinsicsFromInventory([
            { rawText: 'a ring of fire resistance (on left hand)', isWornLeft: true }
        ]);

        expect(attrManager.getEffectiveResistances().cold).toBe(true); // 先天耐性
        expect(attrManager.getEffectiveResistances().fire).toBe(true); // 装備耐性

        // 装備をすべて外す
        attrManager.updateExtrinsicsFromInventory([]);

        // 火炎耐性は消滅するが、先天的冷気耐性は 100% 維持される！
        expect(attrManager.getEffectiveResistances().fire).toBe(false);
        expect(attrManager.getEffectiveResistances().cold).toBe(true);
    });

    it('セーブ＆ロード・リロード後もキャラ情報から即座に耐性が完全復元されること', () => {
        // Monk Level 11 (fast, sleep, poison, seeInvis, stealth, warning, searching, fire)
        const newSessionManager = new AttributeStateManager();
        newSessionManager.updateCharacter({ race: 'Human', role: 'Monk', level: 11 });

        const eff = newSessionManager.getEffectiveResistances();
        expect(eff.fast).toBe(true);
        expect(eff.sleep).toBe(true);
        expect(eff.poison).toBe(true);
        expect(eff.fire).toBe(true);
        expect(eff.shock).toBe(false); // shock は Level 15 で獲得のためまだ false
    });

    it('parseAttributesLine: 性別有無（単語4つ/3つ）や男女別名職・性別限定職・日本語行・形容詞種族から正確にキャラ情報を抽出できること', () => {
        // 1. 男女共通名（単語4つ: 性別あり）
        const p1 = parseAttributesLine('You are a Digger, a level 1 female human archeologist.');
        expect(p1).toEqual({ race: 'human', role: 'archeologist', gender: 'female', level: 1 });

        // NetHack本体が出力する形容詞形 (elven, dwarven, gnomish, orcish)
        const p1Elv = parseAttributesLine('You are a Candidate, a level 1 male elven monk.');
        expect(p1Elv).toEqual({ race: 'elf', role: 'monk', gender: 'male', level: 1 });

        const p1Dwa = parseAttributesLine('You are a Plunderer, a level 1 female dwarven barbarian.');
        expect(p1Dwa).toEqual({ race: 'dwarf', role: 'barbarian', gender: 'female', level: 1 });

        // 2. 男女別名職（単語3つ: Cavewoman / Priestess）
        const p2 = parseAttributesLine('You are an Aspirant, a level 1 elven priestess.');
        expect(p2).toEqual({ race: 'elf', role: 'priest', level: 1 });

        const p3 = parseAttributesLine('You are a Troglodyte, a level 1 dwarven cavewoman.');
        expect(p3).toEqual({ race: 'dwarf', role: 'caveman', level: 1 });

        // 3. 性別限定職（単語3つ: Valkyrie）
        const p4 = parseAttributesLine('You are a Stripling, a level 1 human valkyrie.');
        expect(p4).toEqual({ race: 'human', role: 'valkyrie', level: 1 });

        // 4. タイトル行
        const p5 = parseAttributesLine("Web_user the Monk's attributes:");
        expect(p5).toEqual({ role: 'monk' });
    });

    it('isAttributeBuffer: select_menu形式（menuItems）のバッファを正しく属性バッファと認識できること', () => {
        const menuBuffer = [
            {
                type: 'select_menu',
                windowId: 3,
                prompt: '',
                menuItems: [
                    { str: "Web_user the Monk's attributes:" },
                    { str: "You are a Candidate, a level 1 male elven monk." }
                ]
            }
        ];
        expect(attrManager.isAttributeBuffer(menuBuffer)).toBe(true);
    });

    it('^X 出力バッファ（select_menu形式）から種族と職業が自動特定され、初期耐性（Elven Monk, Barbarian, Valkyrie等）が即座に反映されること', () => {
        // Elven Monk: 初期は sleep, fast, seeInvis, 暗視 (infravision) が点灯するべき
        const monkManager = new AttributeStateManager();
        monkManager.updateFromSequenceBuffer([
            {
                type: 'select_menu',
                windowId: 3,
                prompt: '',
                menuItems: [
                    { rawStr: "Web_user the Monk's attributes:", str: "Monkの属性：Web_user" },
                    { rawStr: " You are a Candidate, a level 1 male elven monk.", str: "あなたはCandidate、レベル1のelven maleでmonkです。" }
                ]
            }
        ]); // force = false で正しく isAttributeBuffer を通過することを検証

        const monkAttrs = monkManager.getEffectiveResistances();
        expect(monkAttrs.sleep).toBe(true);
        expect(monkAttrs.fast).toBe(true);
        expect(monkAttrs.seeInvis).toBe(true);
        expect(monkAttrs.infravision).toBe(true); // Elf の先天性暗視！
        expect(monkAttrs.searching).toBe(false); // Archeologist ではない

        // Elf Priest: 初期は 暗視 (infravision) が点灯するべき
        const elfPriestManager = new AttributeStateManager();
        elfPriestManager.updateFromSequenceBuffer([
            {
                type: 'select_menu',
                windowId: 3,
                menuItems: [
                    { str: "You are an Aspirant, a level 1 elven priestess." }
                ]
            }
        ]);

        const elfAttrs = elfPriestManager.getEffectiveResistances();
        expect(elfAttrs.infravision).toBe(true); // Elf 暗視
        expect(elfAttrs.sleep).toBe(false); // ElfのsleepはLv.4で獲得

        // Human Barbarian: 初期は 毒耐性 (poison) が点灯するべき
        const barManager = new AttributeStateManager();
        barManager.updateFromSequenceBuffer([
            {
                type: 'select_menu',
                windowId: 3,
                menuItems: [
                    { str: "You are a Plunderer, a level 1 male human barbarian." }
                ]
            }
        ]);

        const barAttrs = barManager.getEffectiveResistances();
        expect(barAttrs.poison).toBe(true);
        expect(barAttrs.searching).toBe(false);

        // Human Valkyrie: 初期は 冷気耐性 (cold) が点灯するべき
        const valkManager = new AttributeStateManager();
        valkManager.updateFromSequenceBuffer([
            {
                type: 'select_menu',
                windowId: 3,
                menuItems: [
                    { str: "You are a Stripling, a level 1 human valkyrie." }
                ]
            }
        ]);

        const valkAttrs = valkManager.getEffectiveResistances();
        expect(valkAttrs.cold).toBe(true);
        expect(valkAttrs.searching).toBe(false);
    });
});
