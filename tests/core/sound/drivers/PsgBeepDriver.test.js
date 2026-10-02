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

    it('should play via window.Beepcore when available', () => {
        let masterVolCalled = null;
        let oscSetupCalled = null;
        let lfoSetupCalled = false;
        let notePlayCalled = false;

        const mockNote = {
            on: vi.fn(),
            play: vi.fn(() => { notePlayCalled = true; })
        };

        const MockBeepcore = function() {
            this.masterVolume = (v) => { masterVolCalled = v; };
            this.oscSetup = (w) => { oscSetupCalled = w; };
            this.lfoSetup = () => { lfoSetupCalled = true; };
            this.lfoReset = vi.fn();
            this.createNote = () => mockNote;
            this.step = vi.fn();
        };

        global.window = {
            Beepcore: MockBeepcore,
            requestAnimationFrame: vi.fn()
        };
        global.performance = { now: () => 1000 };

        const driver = new PsgBeepDriver({ volume: 60 });
        driver.play({
            notes: ['C4', 'E4'],
            wave: 'square',
            duration: 90,
            lfo: { freq: 6, wave: 'sine', depth: 15 }
        });

        expect(masterVolCalled).toBeCloseTo(0.6 * 0.3);
        expect(oscSetupCalled).toBe(1); // square is index 1
        expect(lfoSetupCalled).toBe(true);
        expect(notePlayCalled).toBe(true);
    });

    it('should fallback to Web Audio API when Beepcore is not available', () => {
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
