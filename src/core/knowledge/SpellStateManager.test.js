import { describe, it, expect, beforeEach } from 'vitest';
import { SpellStateManager } from './SpellStateManager.js';

describe('SpellStateManager Tests', () => {
    let spellManager;

    beforeEach(() => {
        spellManager = new SpellStateManager();
    });

    it('初期状態は空配列で未同期であること', () => {
        expect(spellManager.getSpells()).toEqual([]);
        expect(spellManager.isSynced).toBe(false);
    });

    it('NetHack の典型的な魔法リストメニューから正しくパースできること', () => {
        const sampleMenuItems = [
            { ch: 97, text: 'a - force bolt          1      attack      0%' },
            { ch: 98, text: 'b - cure blindness      2      healing     0%' },
            { ch: 99, text: 'c - create monster      2      clerical    15%' },
            { ch: 100, text: 'd - identify            3      divination  25%' }
        ];

        spellManager.updateFromMenuItems(sampleMenuItems);

        expect(spellManager.isSynced).toBe(true);
        const spells = spellManager.getSpells();
        expect(spells.length).toBe(4);

        expect(spells[0]).toEqual({
            letter: 'a',
            name: 'force bolt',
            level: 1,
            category: 'attack',
            categoryRaw: 'attack',
            failRate: '0%',
            retention: '',
            rawText: 'a - force bolt          1      attack      0%'
        });

        expect(spells[1]).toEqual({
            letter: 'b',
            name: 'cure blindness',
            level: 2,
            category: 'healing',
            categoryRaw: 'healing',
            failRate: '0%',
            retention: '',
            rawText: 'b - cure blindness      2      healing     0%'
        });

        expect(spells[2].failRate).toBe('15%');
        expect(spells[2].category).toBe('clerical');

        expect(spells[3].level).toBe(3);
        expect(spells[3].category).toBe('divination');
    });

    it('日本語版 NetHack の魔法リスト行から正しくパースできること', () => {
        const sampleLines = [
            'a - 力のボルト          1      攻撃        0%',
            'b - 盲目の治癒          2      回復        5%'
        ];

        spellManager.updateFromLines(sampleLines);

        expect(spellManager.isSynced).toBe(true);
        const spells = spellManager.getSpells();
        expect(spells.length).toBe(2);
        expect(spells[0].name).toBe('力のボルト');
        expect(spells[0].category).toBe('attack');
        expect(spells[1].name).toBe('盲目の治癒');
        expect(spells[1].category).toBe('healing');
    });

    it('シーケンスバッファ (sequenceBuffer) からの抽出更新ができること', () => {
        const sequenceBuffer = [
            {
                type: 'menu',
                menuItems: [
                    { letter: 'a', text: 'a - magic missile       2      attack      0%' }
                ]
            }
        ];

        spellManager.updateFromSequenceBuffer(sequenceBuffer);
        expect(spellManager.isSynced).toBe(true);
        expect(spellManager.getSpells().length).toBe(1);
        expect(spellManager.getSpells()[0].name).toBe('magic missile');
    });

    it('日本語および英語の魔法習得メッセージから自動的に呪文が登録・更新されること', () => {
        spellManager.reset();
        
        // 日本語: 初回習得
        const res1 = spellManager.updateFromMessage('「力のボルト」の呪文を習得した.');
        expect(res1).toBe(true);
        expect(spellManager.getSpells().length).toBe(1);
        expect(spellManager.getSpells()[0]).toEqual({
            letter: 'a',
            name: '力のボルト',
            level: 1,
            category: 'attack',
            categoryRaw: 'attack',
            failRate: '0%',
            retention: '',
            rawText: 'a - 力のボルト  1  attack  0%'
        });

        // 日本語: スロット指定習得
        const res2 = spellManager.updateFromMessage('「治癒」の呪文を呪文一覧に\'b\'として加えた.');
        expect(res2).toBe(true);
        expect(spellManager.getSpells().length).toBe(2);
        expect(spellManager.getSpells()[1].letter).toBe('b');
        expect(spellManager.getSpells()[1].name).toBe('治癒');
        expect(spellManager.getSpells()[1].category).toBe('healing');

        // 英語: 習得
        const res3 = spellManager.updateFromMessage('You add "magic missile" to your repertoire.');
        expect(res3).toBe(true);
        expect(spellManager.getSpells().length).toBe(3);
        expect(spellManager.getSpells()[2].name).toBe('magic missile');
        expect(spellManager.getSpells()[2].level).toBe(2);
    });

    it('インベントリのアイテム行やバッファが魔法として誤パースされないこと', () => {
        const inventoryItems = [
            { ch: 97, text: 'a - a cursed +1 dagger (weapon in hand)' },
            { ch: 98, text: 'b - a blessed ring of fire resistance (on right hand)' },
            { ch: 99, text: 'c - 14 uncursed food rations' },
            { ch: 100, text: 'd - a potion of healing' }
        ];

        // メニュー項目直接パース
        spellManager.updateFromMenuItems(inventoryItems);
        expect(spellManager.getSpells().length).toBe(0);

        // シーケンスバッファパース
        const invBuffer = [
            {
                title: 'Inventory',
                menuItems: inventoryItems
            }
        ];
        spellManager.updateFromSequenceBuffer(invBuffer);
        expect(spellManager.getSpells().length).toBe(0);
    });

    it('reset() で初期化されること', () => {
        spellManager.updateFromLines(['a - force bolt 1 attack 0%']);
        expect(spellManager.getSpells().length).toBe(1);

        spellManager.reset();
        expect(spellManager.getSpells().length).toBe(0);
        expect(spellManager.isSynced).toBe(false);
    });
});
