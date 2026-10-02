import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProceduralSynthDriver } from '../../../../src/core/sound/drivers/ProceduralSynthDriver.js';

describe('ProceduralSynthDriver Tests', () => {
    let originalWindow;
    let createdOscillators = [];
    let createdGains = [];

    const mockAudioParam = () => ({
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
    });

    const MockAudioContext = class {
        constructor() {
            this.state = 'running';
            this.currentTime = 0;
            this.destination = {};
        }
        resume() {}
        createOscillator() {
            const osc = {
                type: 'sine',
                frequency: mockAudioParam(),
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn()
            };
            createdOscillators.push(osc);
            return osc;
        }
        createGain() {
            const gain = {
                gain: mockAudioParam(),
                connect: vi.fn()
            };
            createdGains.push(gain);
            return gain;
        }
    };

    beforeEach(() => {
        originalWindow = global.window;
        createdOscillators = [];
        createdGains = [];
        global.window = {
            AudioContext: MockAudioContext
        };
    });

    afterEach(() => {
        global.window = originalWindow;
        vi.restoreAllMocks();
    });

    it('should synthesize single oscillator with pitch bend (shriek / drum)', () => {
        const driver = new ProceduralSynthDriver({ volume: 80 });
        driver.play({
            type: 'oscillator',
            wave: 'sawtooth',
            freq: 2000,
            freqEnd: 800,
            duration: 200,
            decay: 'exponential'
        });

        expect(createdOscillators.length).toBe(1);
        expect(createdOscillators[0].type).toBe('sawtooth');
        expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(2000, 0);
        expect(createdOscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(800, 0.2);
        expect(createdOscillators[0].start).toHaveBeenCalled();
        expect(createdOscillators[0].stop).toHaveBeenCalledWith(0.2);
    });

    it('should synthesize chord with multiple oscillators (trumpet)', () => {
        const driver = new ProceduralSynthDriver({ volume: 80 });
        driver.play({
            type: 'chord',
            wave: 'sawtooth',
            freqs: [261.63, 392.0, 523.25],
            duration: 300
        });

        expect(createdOscillators.length).toBe(3);
        createdOscillators.forEach(osc => {
            expect(osc.type).toBe('sawtooth');
            expect(osc.start).toHaveBeenCalled();
            expect(osc.stop).toHaveBeenCalledWith(0.3);
        });
    });

    it('should synthesize amplitude modulation (am: buzz / drone)', () => {
        const driver = new ProceduralSynthDriver({ volume: 80 });
        driver.play({
            type: 'am',
            wave: 'sawtooth',
            freq: 130,
            lfoWave: 'sine',
            lfoFreq: 12,
            lfoDepth: 0.8,
            duration: 250
        });

        // Carrier + LFO
        expect(createdOscillators.length).toBe(2);
        const carrier = createdOscillators[0];
        const lfo = createdOscillators[1];

        expect(carrier.type).toBe('sawtooth');
        expect(carrier.frequency.setValueAtTime).toHaveBeenCalledWith(130, 0);
        expect(lfo.type).toBe('sine');
        expect(lfo.frequency.setValueAtTime).toHaveBeenCalledWith(12, 0);
    });

    it('should synthesize frequency modulation (fm: gurgle)', () => {
        const driver = new ProceduralSynthDriver({ volume: 80 });
        driver.play({
            type: 'fm',
            wave: 'sine',
            freq: 350,
            modWave: 'sine',
            modFreq: 24,
            modDepth: 160,
            duration: 240
        });

        // Carrier + Modulator
        expect(createdOscillators.length).toBe(2);
        const carrier = createdOscillators[0];
        const modulator = createdOscillators[1];

        expect(carrier.type).toBe('sine');
        expect(carrier.frequency.setValueAtTime).toHaveBeenCalledWith(350, 0);
        expect(modulator.frequency.setValueAtTime).toHaveBeenCalledWith(24, 0);
    });

    it('should synthesize melody sequence (flute / bugle / drawbridge)', () => {
        const driver = new ProceduralSynthDriver({ volume: 80 });
        driver.play({
            type: 'sequence',
            wave: 'triangle',
            notes: ['C4', 'E4', 'G4', 'C5'],
            noteDuration: 80
        });

        expect(createdOscillators.length).toBe(4);
        createdOscillators.forEach((osc, idx) => {
            expect(osc.type).toBe('triangle');
            const expectedStartTime = idx * 0.08;
            expect(osc.start).toHaveBeenCalledWith(expectedStartTime);
        });
    });

    it('should synthesize pulses (rattle: bone clatter)', () => {
        const driver = new ProceduralSynthDriver({ volume: 80 });
        driver.play({
            type: 'pulses',
            wave: 'square',
            freq: 220,
            count: 4,
            pulseDuration: 35,
            pulseInterval: 45
        });

        expect(createdOscillators.length).toBe(4);
        createdOscillators.forEach(osc => {
            expect(osc.type).toBe('square');
            expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(220, expect.any(Number));
        });
    });

    it('should trigger onLogCallback when provided', () => {
        const logFn = vi.fn();
        const driver = new ProceduralSynthDriver({ onLogCallback: logFn });
        driver.play({
            type: 'oscillator',
            freq: 440,
            duration: 100
        });

        expect(logFn).toHaveBeenCalledWith('PLAY_SYNTH', expect.stringContaining('Synthesizing oscillator'), expect.any(Object));
    });
});
