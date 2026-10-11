import { describe, it, expect, vi } from 'vitest';
import { GKLPlugin } from '../../../src/core/knowledge/GKLPlugin.js';
import { SilentSyncCoordinator } from '../../../src/core/knowledge/coordinators/SilentSyncCoordinator.js';
import { GKLFxCoordinator } from '../../../src/core/knowledge/coordinators/GKLFxCoordinator.js';
import { GKLEventRouter } from '../../../src/core/knowledge/coordinators/GKLEventRouter.js';
import { InspectionService } from '../../../src/core/knowledge/services/InspectionService.js';
import { AutoTravelService } from '../../../src/core/knowledge/services/AutoTravelService.js';

describe('ROADMAP 2.2: GKLPlugin Modularization & Coordinator/Service Delegation', () => {
    it('initializes all extracted coordinators and services and wires backward-compatible proxies', () => {
        const gkl = new GKLPlugin();

        expect(gkl.silentSyncCoordinator).toBeInstanceOf(SilentSyncCoordinator);
        expect(gkl.fxCoordinator).toBeInstanceOf(GKLFxCoordinator);
        expect(gkl.eventRouter).toBeInstanceOf(GKLEventRouter);
        expect(gkl.inspectionService).toBeInstanceOf(InspectionService);
        expect(gkl.autoTravelService).toBeInstanceOf(AutoTravelService);

        expect(gkl.silentSyncTracker).toBe(gkl.silentSyncCoordinator.tracker);

        // Internal proxy getters/setters
        gkl._isPlayerDead = true;
        expect(gkl.fxCoordinator.isPlayerDead).toBe(true);
        gkl._prevHp = 42;
        expect(gkl.fxCoordinator.prevHp).toBe(42);
        gkl._prevAc = -5;
        expect(gkl.fxCoordinator.prevAc).toBe(-5);
        gkl._lastReceivedMessage = 'Hello Dungeon';
        expect(gkl.eventRouter.lastReceivedMessage).toBe('Hello Dungeon');

        gkl.reset();
        expect(gkl._isPlayerDead).toBe(false);
        expect(gkl._prevHp).toBeNull();
        expect(gkl._prevAc).toBeNull();
    });

    it('delegates sequence classification and silent sync methods to SilentSyncCoordinator', async () => {
        const gkl = new GKLPlugin();
        const spyTurn = vi.spyOn(gkl.silentSyncCoordinator, 'isTurnConsumingSequence');
        const spyNonItem = vi.spyOn(gkl.silentSyncCoordinator, 'isNonItemSequence');
        const spySpell = vi.spyOn(gkl.silentSyncCoordinator, 'isSpellAffectingSequence');

        expect(gkl.isTurnConsumingSequence(['h'])).toBe(true);
        expect(spyTurn).toHaveBeenCalledWith(['h']);

        expect(gkl.isNonItemSequence(['k'])).toBe(true);
        expect(spyNonItem).toHaveBeenCalledWith(['k']);

        expect(gkl.isSpellAffectingSequence(['Z', 'a'])).toBe(true);
        expect(spySpell).toHaveBeenCalledWith(['Z', 'a']);
    });

    it('delegates inspectCellOnDemand and travelTo to InspectionService and AutoTravelService', async () => {
        const gkl = new GKLPlugin();
        const spyInspect = vi.spyOn(gkl.inspectionService, 'inspectCellOnDemand');
        const spyTravel = vi.spyOn(gkl.autoTravelService, 'travelTo');

        gkl.areaStateManager.playerX = 10;
        gkl.areaStateManager.playerY = 5;

        const selfCard = await gkl.inspectCellOnDemand({ x: 10, y: 5 });
        expect(spyInspect).toHaveBeenCalledWith({ x: 10, y: 5 }, {});
        expect(selfCard.isPlayer).toBe(true);

        const travelRes = await gkl.travelTo({ x: 10, y: 5 });
        expect(spyTravel).toHaveBeenCalledWith({ x: 10, y: 5 }, {});
        expect(travelRes).toBe(false); // core is not attached
    });
});
