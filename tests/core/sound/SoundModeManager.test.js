import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SoundModeManager } from '../../../src/core/sound/SoundModeManager.js';

describe('SoundModeManager Tests', () => {
    let mockStorage = {};

    beforeEach(() => {
        mockStorage = {};
        global.localStorage = {
            getItem: (key) => mockStorage[key] || null,
            setItem: (key, val) => { mockStorage[key] = String(val); },
            removeItem: (key) => { delete mockStorage[key]; },
            clear: () => { mockStorage = {}; }
        };
    });

    afterEach(() => {
        delete global.localStorage;
    });

    it('should initialize with defaults when storage is empty', () => {
        const manager = new SoundModeManager();
        expect(manager.getMode()).toBe('auto');
        expect(manager.getNormalizedSoundMode()).toBe('auto');
        expect(manager.getVolume()).toBe(80);
    });

    it('should restore configuration from nh.config in localStorage', () => {
        global.localStorage.setItem('nh.config', JSON.stringify({
            sound_mode: 'beep',
            sound_volume: 40
        }));

        const manager = new SoundModeManager();
        expect(manager.getMode()).toBe('beep');
        expect(manager.getNormalizedSoundMode()).toBe('beep');
        expect(manager.getVolume()).toBe(40);
    });

    it('should allow options to override localStorage sound_volume while preserving sound_mode', () => {
        global.localStorage.setItem('nh.config', JSON.stringify({
            sound_mode: 'mute',
            sound_volume: 20
        }));

        const manager = new SoundModeManager({ volume: 90 });
        expect(manager.getMode()).toBe('mute');
        expect(manager.getNormalizedSoundMode()).toBe('mute');
        expect(manager.getVolume()).toBe(90);
    });

    it('should update mode, persist to localStorage, and normalize correctly', () => {
        const modeChanges = [];
        const manager = new SoundModeManager({
            onModeChange: (mode, norm) => { modeChanges.push({ mode, norm }); }
        });

        manager.setSoundMode('se');
        expect(manager.getMode()).toBe('se');
        expect(manager.getNormalizedSoundMode()).toBe('wave');

        const saved = JSON.parse(global.localStorage.getItem('nh.config'));
        expect(saved.sound_mode).toBe('se');
        expect(modeChanges.length).toBe(1);
        expect(modeChanges[0]).toEqual({ mode: 'se', norm: 'wave' });

        manager.setSoundMode('mute');
        expect(manager.getNormalizedSoundMode()).toBe('mute');
    });

    it('should clamp volume between 0 and 100, persist to localStorage, and notify listener', () => {
        const volChanges = [];
        const manager = new SoundModeManager({
            onVolumeChange: (vol) => { volChanges.push(vol); }
        });

        manager.setVolume(120);
        expect(manager.getVolume()).toBe(100);

        manager.setVolume(-15);
        expect(manager.getVolume()).toBe(0);

        manager.setVolume(65);
        expect(manager.getVolume()).toBe(65);

        const saved = JSON.parse(global.localStorage.getItem('nh.config'));
        expect(saved.sound_volume).toBe(65);
        expect(volChanges).toEqual([100, 0, 65]);
    });
});
