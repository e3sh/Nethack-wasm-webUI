import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    MonsterWasmAdapter,
    unpackMonsterInfo
} from '../../../../src/core/knowledge/services/binding/MonsterWasmAdapter.js';
import NetHackMemory from '../../../../src/driver/NetHackMemory.js';

describe('MonsterWasmAdapter & unpackMonsterInfo', () => {
    describe('unpackMonsterInfo (Pure Bit-Unpacking)', () => {
        it('returns null for absent monster (res = 0)', () => {
            expect(unpackMonsterInfo(0)).toBeNull();
        });

        it('returns null for out-of-bounds error code (res = -1)', () => {
            expect(unpackMonsterInfo(-1)).toBeNull();
        });

        it('returns null when reserved bits 2..7 (0xFC) are set', () => {
            // e.g. error code with bits 2..7 set
            expect(unpackMonsterInfo(0x04)).toBeNull();
            expect(unpackMonsterInfo(0xFC)).toBeNull();
        });

        it('correctly unpacks regular monster (peaceful=1, tame=0, hp=15, hpmax=20)', () => {
            // (1) | (0 << 1) | (15 << 8) | (20 << 20) = 1 | 3840 | 20971520 = 20975361
            const packed = 1 | (0 << 1) | (15 << 8) | (20 << 20);
            const unpacked = unpackMonsterInfo(packed);
            expect(unpacked).toEqual({
                peaceful: true,
                tame: false,
                hp: 15,
                hpmax: 20
            });
        });

        it('correctly unpacks tame monster (peaceful=1, tame=1, hp=50, hpmax=60)', () => {
            const packed = 1 | (1 << 1) | (50 << 8) | (60 << 20);
            const unpacked = unpackMonsterInfo(packed);
            expect(unpacked).toEqual({
                peaceful: true,
                tame: true,
                hp: 50,
                hpmax: 60
            });
        });

        it('correctly unpacks boundary HP at positive signed 32-bit limit (hpmax=2047, 0x7FF)', () => {
            // 2047 << 20 = 0x7FF00000 (bit 31 is 0, positive signed 32-bit int)
            const packed = (0) | (1 << 1) | (1000 << 8) | (2047 << 20);
            expect(packed).toBeGreaterThan(0);
            const unpacked = unpackMonsterInfo(packed);
            expect(unpacked).toEqual({
                peaceful: false,
                tame: true,
                hp: 1000,
                hpmax: 2047
            });
        });

        it('correctly unpacks high HP monsters where bit 31 is set (hpmax >= 2048, 0x800)', () => {
            // In wasm32 / signed 32-bit: 2048 << 20 = 0x80000000 = -2147483648
            // With hp=2048: (2048 << 8) = 0x00080000
            // Total packed = 0x80080000 = -2146959360 (negative signed 32-bit int!)
            const packedSigned = (2048 << 8) | (2048 << 20);
            expect(packedSigned).toBeLessThan(0); // confirms negative signed representation

            const unpacked = unpackMonsterInfo(packedSigned);
            expect(unpacked).not.toBeNull();
            expect(unpacked).toEqual({
                peaceful: false,
                tame: false,
                hp: 2048,
                hpmax: 2048
            });
        });

        it('correctly unpacks maximum 12-bit HP (hpmax=4095, hp=4095, peaceful=1, tame=1)', () => {
            // 4095 = 0xFFF.
            // (1) | (2) | (0xFFF << 8) | (0xFFF << 20)
            const packedSigned = 1 | 2 | (4095 << 8) | (4095 << 20);
            expect(packedSigned).toBeLessThan(0);

            const unpacked = unpackMonsterInfo(packedSigned);
            expect(unpacked).not.toBeNull();
            expect(unpacked).toEqual({
                peaceful: true,
                tame: true,
                hp: 4095,
                hpmax: 4095
            });
        });
    });

    describe('MonsterWasmAdapter Service Methods', () => {
        let memory;
        let adapter;

        beforeEach(() => {
            memory = new NetHackMemory({});
            adapter = new MonsterWasmAdapter();
        });

        it('getMonsterInfo returns unpacked info via memory.bridgeCall even when res is negative', () => {
            // hpmax = 3000, hp = 2500, peaceful = 0, tame = 0
            const packedNegative = (2500 << 8) | (3000 << 20);
            expect(packedNegative).toBeLessThan(0);

            vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd, x, y) => {
                if (cmd === NetHackMemory.SHIM_CMD.GET_MONSTER_INFO && x === 10 && y === 12) {
                    return packedNegative;
                }
                return 0;
            });

            const info = adapter.getMonsterInfo(10, 12, memory, true, true);
            expect(info).toEqual({
                peaceful: false,
                tame: false,
                hp: 2500,
                hpmax: 3000
            });
        });

        it('fetchFullMonsterAt returns unpacked info via worker bridge even when res is negative', async () => {
            const packedNegative = 1 | (1500 << 8) | (2500 << 20);
            const mockBridge = {
                callShim: vi.fn().mockImplementation(async (cmd, x, y) => {
                    if (cmd === NetHackMemory.SHIM_CMD.GET_MONSTER_AT && x === 20 && y === 15) {
                        return { result: 0x5432 };
                    }
                    if (cmd === NetHackMemory.SHIM_CMD.GET_MONSTER_INFO && x === 20 && y === 15) {
                        return { result: packedNegative };
                    }
                    if (cmd === NetHackMemory.SHIM_CMD.GET_MONSTER_STATE && x === 20 && y === 15) {
                        return { result: 0 };
                    }
                    return { result: 0 };
                })
            };

            const info = await adapter.fetchFullMonsterAt(20, 15, mockBridge, null, true, false);

            expect(info).toMatchObject({
                x: 20,
                y: 15,
                ptr: 0x5432,
                peaceful: true,
                tame: false,
                hp: 1500,
                hpmax: 2500
            });
        });
    });
});
