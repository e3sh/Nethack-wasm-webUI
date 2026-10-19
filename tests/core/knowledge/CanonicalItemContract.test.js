import { describe, it, expect } from 'vitest';
import { ItemNormalizer } from '../../../src/core/knowledge/models/ItemNormalizer.js';
import { InventoryStateManager } from '../../../src/core/knowledge/state/InventoryStateManager.js';
import { DiscoveryStateManager } from '../../../src/core/knowledge/state/DiscoveryStateManager.js';
import { AreaStateManager } from '../../../src/core/knowledge/state/AreaStateManager.js';

describe('CanonicalItemContract - スキーマ契約テスト (Schema Contract Tests)', () => {

    describe('1. InventoryStateManager 出力に対するスキーマ適合性契約', () => {
        it('updateFromMenuItems (テキストパース方式) で生成された全アイテムが CanonicalItem 契約を満たすこと', () => {
            const manager = new InventoryStateManager();
            const sampleMenu = [
                { selector: 97, str: 'a - a blessed +1 long sword (weapon in hand)' },
                { selector: 98, str: 'b - an uncursed smoky potion called myjump' },
                { selector: 99, str: 'c - a cursed scroll of teleportation' },
                { selector: 100, str: 'd - a wand of striking (0:4)' },
                { selector: 101, str: 'e - 150 gold pieces' }
            ];

            manager.updateFromMenuItems(sampleMenu);
            const items = manager.getItems();

            expect(items.length).toBe(5);
            for (const item of items) {
                expect(ItemNormalizer.assertCanonicalItem(item)).toBe(true);
                expect(item._canonical).toBe(true);
                expect(item.source).toBe('INVENTORY');
                expect(typeof item.category).toBe('string');
                expect(item.category).toBe(item.category.toUpperCase());
                expect(item.isUnidentified).toBe(!item.isDiscovered);
                expect(item.identification.isUnidentified).toBe(item.isUnidentified);
                expect(item.identification.isDiscovered).toBe(item.isDiscovered);
            }

            // 個別アイテムの精密検査
            const sword = items.find(it => it.letter === 'a');
            expect(sword.category).toBe('WEAPON');
            expect(sword.isEquipped).toBe(true);
            expect(sword.isWielded).toBe(true);
            expect(sword.bucStatus).toBe('BLESSED');

            const potion = items.find(it => it.letter === 'b');
            expect(potion.category).toBe('POTION');
            expect(potion.isUnidentified).toBe(true);
            expect(potion.calledName).toBe('myjump');
            expect(potion.idLevel).toBe('NAMED');
        });

        it('syncFromDirectBinding (Wasm Direct Binding 方式) で生成された全アイテムが CanonicalItem 契約を満たすこと', () => {
            const mockWasmBinding = {
                isAvailable: () => true,
                getInventory: () => [
                    {
                        ptr: 0x1000,
                        cobjPtr: 0x1000,
                        onum: 54, // long sword
                        oclass: 2,
                        invlet: 'a',
                        quan: 1,
                        spe: 2,
                        weight: 40,
                        flags: { bknown: true, blessed: true, dknown: true, known: true },
                        name: 'long sword'
                    },
                    {
                        ptr: 0x2000,
                        cobjPtr: 0x2000,
                        onum: 310, // potion
                        oclass: 8,
                        invlet: 'b',
                        quan: 2,
                        spe: 0,
                        weight: 40,
                        flags: { bknown: true, cursed: true, dknown: false, known: false },
                        name: 'smoky potion'
                    }
                ],
                getEquipmentPtrs: () => ({
                    slotByPtr: new Map([[0x1000, 'weapon']])
                })
            };

            const manager = new InventoryStateManager({ wasmDirectBindingService: mockWasmBinding });
            manager.syncFromDirectBinding();
            const items = manager.getItems();

            expect(items.length).toBe(2);
            for (const item of items) {
                expect(ItemNormalizer.assertCanonicalItem(item)).toBe(true);
                expect(item._canonical).toBe(true);
                expect(item.source).toBe('INVENTORY');
                expect(item.isUnidentified).toBe(!item.isDiscovered);
            }

            const sword = items.find(it => it.letter === 'a');
            expect(sword.category).toBe('WEAPON');
            expect(sword.isWielded).toBe(true);
            expect(sword.bucStatus).toBe('BLESSED');
            expect(sword.spe).toBe(2);

            const potion = items.find(it => it.letter === 'b');
            expect(potion.category).toBe('POTION');
            expect(potion.isUnidentified).toBe(true);
            expect(potion.bucStatus).toBe('CURSED');
        });
    });

    describe('2. DiscoveryStateManager 出力に対するスキーマ適合性契約', () => {
        it('getDiscoveredItems で生成された全エントリが CanonicalItem 契約を満たすこと', () => {
            const manager = new DiscoveryStateManager();
            manager.registerKnownItem(null, 'long sword');
            manager.appearanceMap.set('ruby', 'potion of healing');
            manager.calledNamesMap.set('silver wand', 'digging?');

            const items = manager.getDiscoveredItems();
            expect(items.length).toBeGreaterThanOrEqual(3);

            for (const entry of items) {
                expect(ItemNormalizer.assertCanonicalItem(entry)).toBe(true);
                expect(entry._canonical).toBe(true);
                expect(entry.source).toBe('CODEX');
                expect(typeof entry.category).toBe('string');
                expect(entry.category).toBe(entry.category.toUpperCase());
                expect(entry.isUnidentified).toBe(!entry.isDiscovered);
            }

            const potion = items.find(it => it.trueName === 'potion of healing');
            expect(potion.category).toBe('POTION');
            expect(potion.isDiscovered).toBe(true);

            const wand = items.find(it => it.appearance === 'silver wand');
            expect(wand.category).toBe('WAND');
            expect(wand.calledName).toBe('digging?');
            expect(wand.idLevel).toBe('NAMED');
        });
    });

    describe('3. AreaStateManager (床落ちアイテム) 出力に対するスキーマ適合性契約', () => {
        it('cell.middle.floorObjects に格納される全アイテムが CanonicalItem 契約を満たすこと', () => {
            const mockDirectBinding = {
                getObjectsAt: (x, y) => {
                    if (x === 10 && y === 10) {
                        return [
                            {
                                onum: 28,
                                oclass: 2,
                                quan: 1,
                                spe: 0,
                                flags: { dknown: true, bknown: true, uncursed: true }
                            },
                            {
                                onum: 265, // corpse
                                oclass: 7,
                                corpsenm: 105,
                                quan: 1,
                                flags: { dknown: true, bknown: false }
                            }
                        ];
                    }
                    return [];
                },
                isAvailable: () => true,
                hasFloorObjectsCacheAt: () => true
            };

            const areaManager = new AreaStateManager(80, 24, null, mockDirectBinding);
            areaManager.syncCellObjects(10, 10);

            const cell = areaManager.grid[10][10];
            expect(cell.middle).toBeDefined();
            expect(Array.isArray(cell.middle.floorObjects)).toBe(true);
            expect(cell.middle.floorObjects.length).toBe(2);

            for (const floorItem of cell.middle.floorObjects) {
                expect(ItemNormalizer.assertCanonicalItem(floorItem)).toBe(true);
                expect(floorItem._canonical).toBe(true);
                expect(floorItem.source).toBe('FLOOR');
                expect(floorItem.category).toBe(floorItem.category.toUpperCase());
                expect(floorItem.isUnidentified).toBe(!floorItem.isDiscovered);
            }

            const corpse = cell.middle.floorObjects.find(it => it.category === 'FOOD');
            expect(corpse).toBeDefined();
            expect(corpse.corpsenm).toBe(105);
        });
    });

    describe('4. ItemNormalizer の identifier / isGold / quan 保持契約 (Container Gold & Menu pointer)', () => {
        it('rawItem.identifier または rawObjPtr が CanonicalItem.identifier として確実に保持されること', () => {
            const rawItemWithId = {
                identifier: 0x4567,
                letter: '$',
                rawText: '250 gold pieces',
                count: 250,
                isGold: true
            };

            const canonical = ItemNormalizer.normalize(rawItemWithId, { source: 'CONTAINER' });
            expect(ItemNormalizer.assertCanonicalItem(canonical)).toBe(true);
            expect(canonical._canonical).toBe(true);
            expect(canonical.identifier).toBe(0x4567);
            expect(canonical.isGold).toBe(true);
            expect(canonical.category).toBe('GOLD');
            expect(canonical.quan).toBe(250);
            expect(canonical.count).toBe(250);

            // ポインタのみの場合も identifier として解決されること
            const rawItemWithPtr = {
                rawObjPtr: 0x89ab,
                letter: 'a',
                rawText: 'a +0 dagger',
                quan: 1
            };
            const canonicalFromPtr = ItemNormalizer.normalize(rawItemWithPtr, { source: 'INVENTORY' });
            expect(canonicalFromPtr.identifier).toBe(0x89ab);
        });

        it('正規化済み CanonicalItem を再正規化（クローン）しても identifier / isGold / quan が欠落しないこと', () => {
            const initial = ItemNormalizer.normalize({
                identifier: 8888,
                letter: '$',
                rawText: '100 gold pieces',
                quan: 100,
                isGold: true
            }, { source: 'CONTAINER' });

            const cloned = ItemNormalizer.normalize(initial, { source: 'CONTAINER' });
            expect(cloned._canonical).toBe(true);
            expect(cloned.identifier).toBe(8888);
            expect(cloned.isGold).toBe(true);
            expect(cloned.quan).toBe(100);
            expect(cloned.count).toBe(100);
        });
    });
});
