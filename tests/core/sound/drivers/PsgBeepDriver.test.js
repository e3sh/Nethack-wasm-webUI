import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PsgBeepDriver } from '../../../../src/core/sound/drivers/PsgBeepDriver.js';

describe('PsgBeepDriver Tests', () => {
    let originalWindow;

    beforeEach(() => {
        originalWindow = global.window;
    });

    afterEach(() => {
        global.window = originalWindow;
        vi.restoreAllMocks();
    });

    it('should initialize with default volume', () => {
        const driver = new PsgBeepDriver();
        expect(driver.volume).toBe(80);
    });

    it('should correctly calculate note frequencies using _noteToFreq', () => {
        const driver = new PsgBeepDriver();
        expect(driver._noteToFreq(440)).toBe(440);
        expect(driver._noteToFreq(null)).toBe(440);
        expect(driver._noteToFreq('invalid')).toBe(440);

        // A4 should be 440Hz
        expect(driver._noteToFreq('A4')).toBeCloseTo(440.0, 1);
        // A3 should be 220Hz
        expect(driver._noteToFreq('A3')).toBeCloseTo(220.0, 1);
        // C4 should be ~261.63Hz
        expect(driver._noteToFreq('C4')).toBeCloseTo(261.63, 1);
    });

    it('should synthesize notes via Web Audio API', () => {
        const mockParam = () => ({
            value: 0,
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn()
        });

        const createdOscillators = [];
        const MockAudioContext = class {
            constructor() {
                this.state = 'running';
                this.currentTime = 0;
                this.destination = {};
            }
            createOscillator() {
                const osc = {
                    type: 'sine',
                    frequency: mockParam(),
                    connect: vi.fn(),
                    start: vi.fn(),
                    stop: vi.fn()
                };
                createdOscillators.push(osc);
                return osc;
            }
            createGain() {
                return {
                    gain: mockParam(),
                    connect: vi.fn()
                };
            }
        };

        global.window = {
            AudioContext: MockAudioContext
        };

        const driver = new PsgBeepDriver({ volume: 80 });
        driver.play({
            notes: ['C4', 'G4'],
            wave: 'sawtooth',
            duration: 100
        });

        expect(createdOscillators.length).toBe(2);
        expect(createdOscillators[0].type).toBe('sawtooth');
        expect(createdOscillators[0].start).toHaveBeenCalled();
    });

    it('should add LFO vibrato oscillator when lfo is specified', () => {
        const mockParam = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
        const oscs = [];
        const lfoConnect = [];
        const MockAudioContext = class {
            constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
            createOscillator() {
                const osc = { type: 'sine', frequency: mockParam(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
                oscs.push(osc);
                return osc;
            }
            createGain() {
                const g = { gain: mockParam(), connect: vi.fn((t) => lfoConnect.push(t)) };
                return g;
            }
        };
        global.window = { AudioContext: MockAudioContext };

        const driver = new PsgBeepDriver({ volume: 80 });
        driver.play({ notes: ['C4'], duration: 100, lfo: { freq: 7, wave: 'triangle', depth: 15 } });

        // 1音につきキャリア + LFO の 2 オシレーター
        expect(oscs.length).toBe(2);
        expect(oscs[1].type).toBe('triangle');
        expect(oscs[1].frequency.value).toBe(7);
        expect(lfoConnect).toContain(oscs[0].frequency);
    });
    it('should resume suspended AudioContext in unlockAudio', () => {
        let resumeCalled = false;
        const MockAudioContext = class {
            constructor() {
                this.state = 'suspended';
            }
            resume() {
                resumeCalled = true;
                this.state = 'running';
            }
        };

        global.window = {
            AudioContext: MockAudioContext
        };

        const driver = new PsgBeepDriver();
        driver.unlockAudio();

        expect(resumeCalled).toBe(true);
    });
});
