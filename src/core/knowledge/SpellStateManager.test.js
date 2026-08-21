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

    it('日本語および英語の魔法習得・忘却メッセージからキャッシュが無効化 (invalidate) されること', () => {
        spellManager.isSynced = true;
        
        // 日本語: 初回習得メッセージで invalidate
        const res1 = spellManager.updateFromMessage('「力のボルト」の呪文を習得した.');
        expect(res1).toBe(true);
        expect(spellManager.isSynced).toBe(false);

        // 再同期後、英語メッセージで invalidate
        spellManager.isSynced = true;
        const res2 = spellManager.updateFromMessage('You add "magic missile" to your repertoire.');
        expect(res2).toBe(true);
        expect(spellManager.isSynced).toBe(false);

        // 忘却メッセージで invalidate
        spellManager.isSynced = true;
        const res3 = spellManager.updateFromMessage('You forget the spell force bolt!');
        expect(res3).toBe(true);
        expect(spellManager.isSynced).toBe(false);
    });

    it('アイテム比較メッセージ等の無関係なメッセージで誤検知・無効化されないこと', () => {
        spellManager.isSynced = true;

        // アイテム比較メッセージ
        const res1 = spellManager.updateFromMessage('You learn more about your items by comparing them.');
        expect(res1).toBe(false);
        expect(spellManager.isSynced).toBe(true);

        // 一般メッセージ
        const res2 = spellManager.updateFromMessage('You hit the goblin.');
        expect(res2).toBe(false);
        expect(spellManager.isSynced).toBe(true);
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

    it('reset() および invalidate() で適切に状態変更されること', () => {
        spellManager.updateFromLines(['a - force bolt 1 attack 0%']);
        expect(spellManager.getSpells().length).toBe(1);
        expect(spellManager.isSynced).toBe(true);

        spellManager.invalidate();
        expect(spellManager.isSynced).toBe(false);
        expect(spellManager.getSpells().length).toBe(1); // キャッシュ自体は保持

        spellManager.reset();
        expect(spellManager.getSpells().length).toBe(0);
        expect(spellManager.isSynced).toBe(false);
    });

    it('魔法未習得メッセージ受信時またはforceサイレント同期時にisSynced=trueかつspells=[]となること', () => {
        // メッセージからの未習得検知
        spellManager.isSynced = false;
        const res = spellManager.updateFromMessage("You don't know any spells right now.");
        expect(res).toBe(true);
        expect(spellManager.isSynced).toBe(true);
        expect(spellManager.getSpells()).toEqual([]);

        // forceサイレント同期での空バッファ
        spellManager.isSynced = false;
        spellManager.updateFromSequenceBuffer([{ type: 'raw_print', text: "You don't know any spells right now." }], true);
        expect(spellManager.isSynced).toBe(true);
        expect(spellManager.getSpells()).toEqual([]);
    });
});
