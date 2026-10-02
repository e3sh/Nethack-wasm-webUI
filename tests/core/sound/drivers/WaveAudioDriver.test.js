import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WaveAudioDriver } from '../../../../src/core/sound/drivers/WaveAudioDriver.js';

describe('WaveAudioDriver Tests', () => {
    let originalWindow;
    let originalFetch;

    beforeEach(() => {
        originalWindow = global.window;
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.window = originalWindow;
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('should initialize with default volume and custom soundDir', () => {
        const driver = new WaveAudioDriver({ soundDir: 'custom/sounds/' });
        expect(driver.volume).toBe(80);
        expect(driver.soundDir).toBe('custom/sounds/');
        expect(driver.failedAssetCache.size).toBe(0);
    });

    it('should clamp volume between 0 and 100 in setVolume', () => {
        const driver = new WaveAudioDriver();
        driver.setVolume(150);
        expect(driver.volume).toBe(100);
        driver.setVolume(-10);
        expect(driver.volume).toBe(0);
        driver.setVolume(50);
        expect(driver.volume).toBe(50);
    });

    it('should return false immediately when filename is empty or in failedAssetCache', async () => {
        const driver = new WaveAudioDriver();
        expect(await driver.play('')).toBe(false);
        expect(await driver.play(null)).toBe(false);

        driver.failedAssetCache.add('missing.mp3');
        expect(await driver.play('missing.mp3')).toBe(false);
    });

    it('should prioritize window.Howl when available and return true on success', async () => {
        let howlOptions = null;
        let playCalled = false;

        const MockHowl = function(opts) {
            howlOptions = opts;
            this.play = () => {
                playCalled = true;
                setTimeout(() => opts.onplay(), 0);
            };
        };

        global.window = {
            Howl: MockHowl
        };

        const driver = new WaveAudioDriver({ volume: 70 });
        const result = await driver.play('welcome.mp3');

        expect(result).toBe(true);
        expect(playCalled).toBe(true);
        expect(howlOptions.volume).toBeCloseTo(0.7);
        expect(howlOptions.src).toContain('assets/sounds/welcome.mp3');
    });

    it('should add to failedAssetCache and return false when Howler fails to load', async () => {
        const MockHowl = function(opts) {
            this.play = () => {
                setTimeout(() => opts.onloaderror(), 0);
            };
        };

        global.window = {
            Howl: MockHowl
        };

        const driver = new WaveAudioDriver();
        const result = await driver.play('notfound.mp3');

        expect(result).toBe(false);
        expect(driver.failedAssetCache.has('notfound.mp3')).toBe(true);
    });

    it('should fallback to fetch HEAD and HTML5 Audio when Howler is not available', async () => {
        global.window = {}; // No Howl

        let headCheckedPath = null;
        global.fetch = vi.fn().mockImplementation(async (path, opts) => {
            headCheckedPath = path;
            if (path.includes('valid.mp3')) {
                return { ok: true, status: 200 };
            }
            return { ok: false, status: 404 };
        });

        let audioPlayCalled = false;
        global.Audio = class {
            constructor(src) {
                this.src = src;
                this.volume = 1.0;
            }
            async play() {
                audioPlayCalled = true;
            }
        };

        const driver = new WaveAudioDriver({ volume: 50 });
        const result = await driver.play('valid.mp3');

        expect(result).toBe(true);
        expect(audioPlayCalled).toBe(true);
        expect(headCheckedPath).toContain('valid.mp3');
    });

    it('should blacklist asset and return false when all candidate paths 404 on fetch HEAD', async () => {
        global.window = {};
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

        const driver = new WaveAudioDriver();
        const result = await driver.play('nonexistent.mp3');

        expect(result).toBe(false);
        expect(driver.failedAssetCache.has('nonexistent.mp3')).toBe(true);
    });

    it('should support stopAll and clearCache', () => {
        const driver = new WaveAudioDriver();
        driver.failedAssetCache.add('test.mp3');
        expect(driver.failedAssetCache.size).toBe(1);

        let stopped = false;
        driver.activeSounds.add({ stop: () => { stopped = true; } });
        driver.stopAll();

        expect(stopped).toBe(true);
        expect(driver.activeSounds.size).toBe(0);

        driver.clearCache();
        expect(driver.failedAssetCache.size).toBe(0);
    });
});
