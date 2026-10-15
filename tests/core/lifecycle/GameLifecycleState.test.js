import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GAME_LIFECYCLE_STATE, GameLifecycleManager } from '../../../src/core/lifecycle/GameLifecycleState.js';

describe('GameLifecycleManager', () => {
    let manager;

    beforeEach(() => {
        manager = new GameLifecycleManager();
    });

    it('initializes with INITIALIZING state and isSaveResuming=false', () => {
        expect(manager.state).toBe(GAME_LIFECYCLE_STATE.INITIALIZING);
        expect(manager.isSaveResuming).toBe(false);
    });

    it('transitions through valid lifecycle states and notifies subscribers', () => {
        const listener = vi.fn();
        const unsubscribe = manager.subscribe(listener);

        const ok1 = manager.transitionTo(GAME_LIFECYCLE_STATE.BOOTSTRAPPING);
        expect(ok1).toBe(true);
        expect(manager.state).toBe(GAME_LIFECYCLE_STATE.BOOTSTRAPPING);
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({
            prevState: GAME_LIFECYCLE_STATE.INITIALIZING,
            nextState: GAME_LIFECYCLE_STATE.BOOTSTRAPPING
        }));

        manager.isSaveResuming = true;
        expect(manager.isSaveResuming).toBe(true);

        const ok2 = manager.transitionTo(GAME_LIFECYCLE_STATE.CORE_STARTING);
        expect(ok2).toBe(true);
        expect(manager.state).toBe(GAME_LIFECYCLE_STATE.CORE_STARTING);

        const ok3 = manager.transitionTo(GAME_LIFECYCLE_STATE.ATOMIC_INITIAL_SYNC);
        expect(ok3).toBe(true);
        expect(manager.state).toBe(GAME_LIFECYCLE_STATE.ATOMIC_INITIAL_SYNC);

        const ok4 = manager.transitionTo(GAME_LIFECYCLE_STATE.READY_STANDBY);
        expect(ok4).toBe(true);
        expect(manager.state).toBe(GAME_LIFECYCLE_STATE.READY_STANDBY);

        const ok5 = manager.transitionTo(GAME_LIFECYCLE_STATE.ACTIVE_PLAY);
        expect(ok5).toBe(true);
        expect(manager.state).toBe(GAME_LIFECYCLE_STATE.ACTIVE_PLAY);

        unsubscribe();
        manager.transitionTo(GAME_LIFECYCLE_STATE.GAME_OVER);
        expect(listener).toHaveBeenCalledTimes(5); // GAME_OVER not called after unsubscribe
    });

    it('rejects duplicate or invalid state transitions', () => {
        manager.transitionTo(GAME_LIFECYCLE_STATE.BOOTSTRAPPING);
        const duplicate = manager.transitionTo(GAME_LIFECYCLE_STATE.BOOTSTRAPPING);
        expect(duplicate).toBe(false);

        const invalid = manager.transitionTo('INVALID_STATE_XYZ');
        expect(invalid).toBe(false);
        expect(manager.state).toBe(GAME_LIFECYCLE_STATE.BOOTSTRAPPING);
    });

    it('resets to initial state properly', () => {
        manager.transitionTo(GAME_LIFECYCLE_STATE.ACTIVE_PLAY);
        manager.isSaveResuming = true;

        manager.reset();
        expect(manager.state).toBe(GAME_LIFECYCLE_STATE.INITIALIZING);
        expect(manager.isSaveResuming).toBe(false);
    });
});
