import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    AreaStateManager,
    TerrainInferenceEngine,
    DungeonLandmarkRegistry,
    ViewportTileProjector,
    DEFAULT_INFERRED_FLOOR_GLYPH,
    DEFAULT_TOMBSTONE_GLYPH,
    createInferredFloor,
    normalizeFloorKey,
    parseFloorLevel
} from '../../../../src/core/knowledge/state/AreaStateManager.js';
import { GLYPH_OFFSETS, ENTITY_TYPES } from '../../../../src/core/knowledge/engines/glyphClassifier.js';

describe('AreaStateManager 4-Module Architecture & Backward Compatibility', () => {
    let asm;

    beforeEach(() => {
        asm = new AreaStateManager(80, 24);
    });

    describe('1. Sub-module Instantiation & Facade Proxy Compatibility', () => {
        it('initializes landmarkRegistry, terrainInference, and viewportProjector instances', () => {
            expect(asm.landmarkRegistry).toBeInstanceOf(DungeonLandmarkRegistry);
            expect(asm.terrainInference).toBeInstanceOf(TerrainInferenceEngine);
            expect(asm.viewportProjector).toBeInstanceOf(ViewportTileProjector);
        });

        it('synchronizes property getters and setters transparently with DungeonLandmarkRegistry', () => {
            asm.currentFloor = 'Mines:3';
            expect(asm.landmarkRegistry.currentFloor).toBe('Mines:3');

            asm.prevFloor = 'Dlvl:2';
            expect(asm.landmarkRegistry.prevFloor).toBe('Dlvl:2');

            asm.justTransitionedFloor = true;
            expect(asm.landmarkRegistry.justTransitionedFloor).toBe(true);

            asm._hasSeededInitialStair = true;
            expect(asm.landmarkRegistry._hasSeededInitialStair).toBe(true);

            asm.isFloorPending = true;
            expect(asm.landmarkRegistry.isFloorPending).toBe(true);

            asm.pendingStairs = [{ x: 1, y: 2, entity: { glyph: 4000 } }];
            expect(asm.landmarkRegistry.pendingStairs.length).toBe(1);

            asm.pendingLandmarks = [{ x: 3, y: 4, entity: { type: 'FOUNTAIN' } }];
            expect(asm.landmarkRegistry.pendingLandmarks.length).toBe(1);

            expect(asm.stairCache).toBe(asm.landmarkRegistry.stairCache);
            expect(asm.landmarkCache).toBe(asm.landmarkRegistry.landmarkCache);
        });
    });

    describe('2. TerrainInferenceEngine Unit Tests', () => {
        it('maps all NetHack terrain typ codes to accurate glyph IDs', () => {
            const engine = asm.terrainInference;
            expect(engine.getGlyphForTerrainType(18)).toBe(4015); // WATER
            expect(engine.getGlyphForTerrainType(20)).toBe(4017); // LAVAPOOL
            expect(engine.getGlyphForTerrainType(22)).toBe(3990); // IRONBARS
            expect(engine.getGlyphForTerrainType(23, 0, 0, { isOpen: true })).toBe(3986); // Open DOOR
            expect(engine.getGlyphForTerrainType(23, 0, 0, { isOpen: false })).toBe(3988); // Closed DOOR
            expect(engine.getGlyphForTerrainType(24)).toBe(3995); // CORR
            expect(engine.getGlyphForTerrainType(25)).toBe(3992); // ROOM
            expect(engine.getGlyphForTerrainType(28)).toBe(4014); // FOUNTAIN
            expect(engine.getGlyphForTerrainType(29)).toBe(4012); // THRONE
            expect(engine.getGlyphForTerrainType(30)).toBe(4013); // SINK
            expect(engine.getGlyphForTerrainType(31)).toBe(4011); // GRAVE
            expect(engine.getGlyphForTerrainType(32)).toBe(4008); // ALTAR
            expect(engine.getGlyphForTerrainType(33)).toBe(4016); // ICE
            expect(engine.getGlyphForTerrainType(35)).toBe(4023); // AIR
            expect(engine.getGlyphForTerrainType(36)).toBe(4024); // CLOUD
            expect(engine.getGlyphForTerrainType(5)).toBe(3930);  // WALL (1..12)
        });

        it('evaluates bkglyphInfo and guards against GLYPH_UNEXPLORED_OFF (9622)', () => {
            const engine = asm.terrainInference;
            // Valid background terrain (water: 4015)
            const validBg = engine.resolveBackgroundTerrain(10, 10, { glyph: 4015, ch: '}', color: 4 });
            expect(validBg.glyph).toBe(4015);
            expect(validBg.inferred).toBeUndefined();

            // 9622 guard -> falls back to getGenuineFloor (inferred floor 3992 in auto mode without direct binding)
            const guardedBg = engine.resolveBackgroundTerrain(10, 10, { glyph: 9622, ch: ' ', color: 8 });
            expect(guardedBg.glyph).toBe(DEFAULT_INFERRED_FLOOR_GLYPH);
            expect(guardedBg.inferred).toBe(true);
        });

        it('handles Boulder Push inference for both Case A (move onto boulder) and Case B (delayed boulder glyph)', () => {
            const BOULDER_GLYPH = GLYPH_OFFSETS.GLYPH_OBJ_OFF + 475;

            // Case B: player moves onto boulder first, then boulder glyph arrives at pushed destination
            asm.updateGlyph(5, 5, BOULDER_GLYPH);
            asm.updatePlayerPosition(4, 5);
            asm.updatePlayerPosition(5, 5);
            expect(asm.grid[5][5].middle).not.toBeNull();

            asm.terrainInference.handleBoulderPushOnGlyphUpdate(6, 5, BOULDER_GLYPH);
            expect(asm.grid[5][5].middle).toBeNull();
        });
    });

    describe('3. DungeonLandmarkRegistry Unit Tests', () => {
        it('normalizes floor keys and parses floor levels accurately', () => {
            expect(normalizeFloorKey('Minetown: 3')).toBe('Minetown:3');
            expect(normalizeFloorKey('Sokoban 2')).toBe('Sokoban:2');
            expect(parseFloorLevel('Minetown:3')).toBe(3);
            expect(parseFloorLevel('Dlvl:12')).toBe(12);
        });

        it('registers stairs, extracts landmarks, and deduplicates moving shopkeepers', () => {
            const registry = asm.landmarkRegistry;
            registry.setCurrentFloor('Dlvl:2');

            // Register stair directly via registry
            registry.registerStairAt(10, 8, 4000, 'Dlvl:2');
            expect(registry.stairCache.has('Dlvl:2:10,8')).toBe(true);
            expect(asm.grid[8][10].bottom.glyph).toBe(4000);

            // Shopkeeper moves across 2 coordinates
            const shkGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 271;
            const lm1 = registry.extractLandmarkEntity(12, 10, shkGlyph);
            registry.saveLandmarkToCache(lm1, 12, 10, 'Dlvl:2');
            const lm2 = registry.extractLandmarkEntity(13, 10, shkGlyph);
            registry.saveLandmarkToCache(lm2, 13, 10, 'Dlvl:2');

            const floorLandmarks = registry.getFloorLandmarks('Dlvl:2');
            expect(floorLandmarks.shops.length).toBe(1);
            expect(floorLandmarks.shops[0].x).toBe(13);
            expect(floorLandmarks.shops[0].y).toBe(10);
        });
    });

    describe('4. ViewportTileProjector Unit Tests', () => {
        it('resolves direction keys for both numpad and vi key modes', () => {
            const projector = asm.viewportProjector;
            expect(projector.getDirectionInfo(0, -1, 'numpad')).toEqual({ code: 'N', name: '北', key: '8' });
            expect(projector.getDirectionInfo(0, -1, 'vi')).toEqual({ code: 'N', name: '北', key: 'k' });
            expect(projector.getDirectionInfo(-1, -1, 'numpad')).toEqual({ code: 'NW', name: '北西', key: '7' });
            expect(projector.getDirectionInfo(-1, -1, 'vi')).toEqual({ code: 'NW', name: '北西', key: 'y' });
            expect(projector.getDirectionInfo(0, 0, 'numpad')).toEqual({ code: 'SELF', name: '足元', key: '5' });
            expect(projector.getDirectionInfo(0, 0, 'vi')).toEqual({ code: 'SELF', name: '足元', key: '.' });
        });

        it('projects focus camera tiles with tombstone replacement on player death and knowledge enrichment', () => {
            asm.updatePlayerPosition(10, 10);
            asm.updateGlyph(10, 10, 3992);

            const mockKnowledgeEngine = {
                getKnowledgeByGlyph: vi.fn((g) => {
                    if (g === DEFAULT_TOMBSTONE_GLYPH) {
                        return { name: 'headstone', nameJa: '墓標' };
                    }
                    return null;
                })
            };

            const tiles = asm.viewportProjector.getFocusCameraTiles(1, 1, {
                isDead: true,
                structuredKnowledge: mockKnowledgeEngine,
                language: 'en'
            });

            const centerTile = tiles.find(t => t.isPlayer);
            expect(centerTile).toBeDefined();
            expect(centerTile.topGlyph).toBe(DEFAULT_TOMBSTONE_GLYPH);
            expect(centerTile.name).toBe('headstone');
            expect(centerTile.nameJa).toBe('墓標');
        });
    });
});
