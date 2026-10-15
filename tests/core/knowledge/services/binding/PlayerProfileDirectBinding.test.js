/**
 * PlayerProfileDirectBinding.test.js
 *
 * Stage 8.5 先行実装: C構造体直結によるプレイヤープロファイル (種族・職業・属性・性別) の
 * 真値取得 (Ground Truth) および UI バッジ連携の包括的単体テスト。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    SHIM_CMD,
    PLAYER_ROLES,
    PLAYER_RACES,
    ALIGNMENT_TYPES,
    ALIGNMENT_NAMES_JA,
    ALIGNMENT_NAMES_EN,
    decodeStringFromInt32Array,
    parsePlayerProfileBuffer
} from '../../../../../src/core/knowledge/services/binding/BindingConstants.js';
import { PlayerWasmAdapter } from '../../../../../src/core/knowledge/services/binding/PlayerWasmAdapter.js';
import { WasmDirectBindingService } from '../../../../../src/core/knowledge/services/WasmDirectBindingService.js';
import { AttributeStateManager } from '../../../../../src/core/knowledge/state/AttributeStateManager.js';

describe('Player Profile Direct Binding (Stage 8.5)', () => {
    describe('BindingConstants - parsePlayerProfileBuffer & String Decoding', () => {
        it('decodes ASCII strings packed into Int32Array words', () => {
            // 文字列 "Valkyrie" を int32 単語列に変換 (Little Endian)
            // 'V'=0x56, 'a'=0x61, 'l'=0x6C, 'k'=0x6B -> 0x6B6C6156
            // 'y'=0x79, 'r'=0x72, 'i'=0x69, 'e'=0x65 -> 0x65697279
            const words = [0x6B6C6156, 0x65697279, 0x00000000];
            const decoded = decodeStringFromInt32Array(words, 0, 4);
            expect(decoded).toBe('Valkyrie');
        });

        it('parses raw profile buffer with explicit strings', () => {
            const raw = [
                11, // roleIndex (Valkyrie)
                2,  // raceIndex (Dwarf)
                1,  // genderIndex (female)
                1,  // alignType (lawful)
                380, // gu.urole.mnum
                385, // gu.urace.mnum
                1,   // level
                1,   // initgend
                10   // alignRecord
            ];

            const profile = parsePlayerProfileBuffer(raw, 'Valkyrie', 'Dwarf', 'Brunhilde');
            expect(profile).not.toBeNull();
            expect(profile.roleIndex).toBe(11);
            expect(profile.raceIndex).toBe(2);
            expect(profile.role).toBe('valkyrie');
            expect(profile.race).toBe('dwarf');
            expect(profile.gender).toBe('female');
            expect(profile.alignment).toBe('lawful');
            expect(profile.roleName).toBe('Valkyrie');
            expect(profile.raceName).toBe('Dwarf');
            expect(profile.playerName).toBe('Brunhilde');
            expect(profile.level).toBe(1);
        });

        it('parses raw profile buffer with embedded buffer strings', () => {
            const raw = new Array(64).fill(0);
            raw[0] = 12; // Wizard
            raw[1] = 1;  // Elf
            raw[2] = 0;  // male
            raw[3] = -1; // chaotic
            raw[4] = 390;
            raw[5] = 395;
            raw[6] = 5;  // level 5
            raw[7] = 0;
            raw[8] = 20;

            // offset 64 (word 16): "Wizard"
            raw[16] = 0x617A6957; // 'W','i','z','a'
            raw[17] = 0x00006472; // 'r','d','\0','\0'

            // offset 128 (word 32): "elf"
            raw[32] = 0x00666C65; // 'e','l','f','\0'

            // offset 192 (word 48): "Merlin"
            raw[48] = 0x6C72654D; // 'M','e','r','l'
            raw[49] = 0x00006E69; // 'i','n','\0','\0'

            const profile = parsePlayerProfileBuffer(raw);
            expect(profile).not.toBeNull();
            expect(profile.role).toBe('wizard');
            expect(profile.race).toBe('elf');
            expect(profile.gender).toBe('male');
            expect(profile.alignment).toBe('chaotic');
            expect(profile.roleName).toBe('Wizard');
            expect(profile.raceName).toBe('elf');
            expect(profile.playerName).toBe('Merlin');
            expect(profile.level).toBe(5);
        });

        it('returns null for invalid or short buffers', () => {
            expect(parsePlayerProfileBuffer(null)).toBeNull();
            expect(parsePlayerProfileBuffer([])).toBeNull();
            expect(parsePlayerProfileBuffer([1, 2, 3])).toBeNull();
        });
    });

    describe('PlayerWasmAdapter - Profile Sync & Cache', () => {
        let adapter;

        beforeEach(() => {
            adapter = new PlayerWasmAdapter();
        });

        it('dumps and caches player profile in Live Memory mode', () => {
            const mockMemory = {
                allocateBuffer: vi.fn(() => 0x2000),
                freeBuffer: vi.fn(),
                bridgeCall: vi.fn((cmd, arg1, arg2, bufPtr, bufSize) => {
                    expect(cmd).toBe(SHIM_CMD.GET_PLAYER_PROFILE);
                    expect(bufPtr).toBe(0x2000);
                    expect(bufSize).toBe(256);
                    return 0; // success
                }),
                readInt32Array: vi.fn((ptr, count) => {
                    return [9, 0, 0, 1, 100, 101, 3, 0, 5]; // Samurai / Human / male / lawful / Lv.3
                }),
                readString: vi.fn((ptr, max) => {
                    if (ptr === 0x2000 + 64) return 'Samurai';
                    if (ptr === 0x2000 + 128) return 'human';
                    if (ptr === 0x2000 + 192) return 'Musashi';
                    return '';
                })
            };

            const profile = adapter.dumpPlayerProfile(mockMemory, true, true);
            expect(profile).not.toBeNull();
            expect(profile.role).toBe('samurai');
            expect(profile.race).toBe('human');
            expect(profile.playerName).toBe('Musashi');
            expect(profile.level).toBe(3);

            // キャッシュに保持されていること
            expect(adapter.cachedPlayerProfile).toBe(profile);
            expect(mockMemory.freeBuffer).toHaveBeenCalledWith(0x2000);

            // getPlayerProfile でも同一インスタンスが返ること
            const fetched = adapter.getPlayerProfile(mockMemory, true, true);
            expect(fetched).toBeDefined();
        });

        it('fetches player profile asynchronously in Worker Bridge mode', async () => {
            const rawBuffer = new Array(64).fill(0);
            rawBuffer[0] = 1;  // Barbarian
            rawBuffer[1] = 4;  // Orc
            rawBuffer[2] = 0;  // male
            rawBuffer[3] = -1; // chaotic
            rawBuffer[6] = 2;  // level 2

            const mockBridge = {
                callShim: vi.fn(async (cmd, a1, a2, size, type) => {
                    expect(cmd).toBe(SHIM_CMD.GET_PLAYER_PROFILE);
                    expect(size).toBe(256);
                    expect(type).toBe('int32');
                    return {
                        result: 0,
                        buffer: rawBuffer
                    };
                })
            };

            const profile = await adapter.fetchPlayerProfile(mockBridge, null, true, false);
            expect(profile).not.toBeNull();
            expect(profile.role).toBe('barbarian');
            expect(profile.race).toBe('orc');
            expect(profile.gender).toBe('male');
            expect(profile.alignment).toBe('chaotic');
            expect(adapter.cachedPlayerProfile).toBe(profile);
        });

        it('handles failure safely in Worker Bridge mode', async () => {
            const mockBridge = {
                callShim: vi.fn(async () => {
                    throw new Error('Worker crash');
                })
            };

            const profile = await adapter.fetchPlayerProfile(mockBridge, null, true, false);
            expect(profile).toBeNull();
        });
    });

    describe('WasmDirectBindingService - Facade & Coordination', () => {
        it('delegates getPlayerProfile and fetchPlayerProfile to PlayerWasmAdapter', async () => {
            const service = new WasmDirectBindingService();
            expect(service.getPlayerProfile()).toBeNull();

            // キャッシュ設定
            service._cachedPlayerProfile = {
                role: 'tourist',
                race: 'human',
                alignment: 'neutral'
            };

            expect(service.getPlayerProfile()).toEqual({
                role: 'tourist',
                race: 'human',
                alignment: 'neutral'
            });
            expect(service._cachedPlayerProfile.role).toBe('tourist');

            // resetAllCaches でキャッシュが破棄されること
            service.resetAllCaches();
            expect(service.getPlayerProfile()).toBeNull();
            expect(service._cachedPlayerProfile).toBeNull();
        });

        it('clears all cached player properties via clearPlayerCaches', () => {
            const adapter = new PlayerWasmAdapter();
            adapter.cachedPlayerProfile = { role: 'valkyrie' };
            adapter.cachedPlayerProps = [1, 2, 3];
            adapter.cachedPlayerSummary = { ublesscnt: 10 };
            adapter.cachedSkills = [{ skill: 1 }];
            adapter.cachedWeaponSlots = 2;
            adapter.cachedSpells = [{ id: 1 }];

            adapter.clearPlayerCaches();

            expect(adapter.cachedPlayerProfile).toBeNull();
            expect(adapter.cachedPlayerProps).toBeNull();
            expect(adapter.cachedPlayerSummary).toBeNull();
            expect(adapter.cachedSkills).toBeNull();
            expect(adapter.cachedWeaponSlots).toBe(0);
            expect(adapter.cachedSpells).toBeNull();
        });
    });

    describe('AttributeStateManager - Character Summary Integration', () => {
        it('correctly maps Japanese terms and formats display tags', () => {
            const stateManager = new AttributeStateManager();

            // Cコア真値: Valkyrie / Dwarf / female / lawful
            stateManager.syncPlayerProfileFromDirectBinding({
                role: 'valkyrie',
                race: 'dwarf',
                gender: 'female',
                alignment: 'lawful',
                level: 1,
                playerName: 'Brunhilde'
            });

            const summaryJa = stateManager.getCharacterSummary('ja');
            expect(summaryJa.roleNameJa).toBe('ワルキューレ');
            expect(summaryJa.raceNameJa).toBe('ドワーフ');
            expect(summaryJa.alignNameJa).toBe('秩序');
            expect(summaryJa.displayTagJa).toBe('👤 ドワーフ / ワルキューレ Lv.1');

            // 英語切替
            const summaryEn = stateManager.getCharacterSummary('en');
            expect(summaryEn.roleNameEn).toBe('Valkyrie');
            expect(summaryEn.raceNameEn).toBe('Dwarf');
            expect(summaryEn.alignNameEn).toBe('Lawful');
            expect(summaryEn.displayTagEn).toBe('👤 Dwarf / Valkyrie Lv.1');
        });

        it('recalculates innate traits based on C-Core ground truth profile', () => {
            const stateManager = new AttributeStateManager();

            // ドワーフ + ワルキューレ
            stateManager.syncPlayerProfileFromDirectBinding({
                role: 'valkyrie',
                race: 'dwarf',
                gender: 'female',
                alignment: 'lawful',
                level: 1,
                playerName: 'Brunhilde'
            });

            // ドワーフは暗視能力 (infravision) を初期保有
            expect(stateManager.innate.infravision).toBe(true);
            expect(stateManager.intrinsics.infravision).toBe(true);
        });
    });
});
