import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SoundEngine } from './SoundEngine.js';

describe('SoundEngine Configuration & LocalStorage Tests', () => {
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

    it('should initialize with default values when localStorage is empty and no options provided', () => {
        const engine = new SoundEngine();
        expect(engine.soundMode).toBe('auto');
        expect(engine.volume).toBe(80);
    });

    it('should load sound_mode and sound_volume directly from nh.config in localStorage', () => {
        global.localStorage.setItem('nh.config', JSON.stringify({
            sound_mode: 'mute',
            sound_volume: 45
        }));

        const engine = new SoundEngine();
        expect(engine.soundMode).toBe('mute');
        expect(engine.volume).toBe(45);
    });

    it('should allow options to override localStorage sound_volume when explicitly specified', () => {
        global.localStorage.setItem('nh.config', JSON.stringify({
            sound_mode: 'se',
            sound_volume: 30
        }));

        const engine = new SoundEngine({ volume: 90 });
        expect(engine.soundMode).toBe('se');
        expect(engine.volume).toBe(90);
    });

    it('should ignore obsolete nethack_sound_mode key and rely solely on nh.config', () => {
        global.localStorage.setItem('nethack_sound_mode', 'all');
        global.localStorage.setItem('nh.config', JSON.stringify({
            sound_mode: 'mute'
        }));

        const engine = new SoundEngine();
        expect(engine.soundMode).toBe('mute');
    });
});
