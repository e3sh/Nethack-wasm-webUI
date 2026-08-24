import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { WebUICore } from './WebUICore.js';
import { GKLPlugin } from './knowledge/GKLPlugin.js';

describe('Architecture Boundary & Layer Isolation Guard Tests (再発防止テスト)', () => {

    /**
     * 指定ディレクトリ内の対象拡張子ファイルを再帰的に収集
     */
    function collectSourceFiles(dir, extensions = ['.js', '.ts', '.tsx', '.vue', '.svelte']) {
        const results = [];
        if (!fs.existsSync(dir)) return results;

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
                    results.push(...collectSourceFiles(fullPath, extensions));
                }
            } else if (entry.isFile()) {
                if (extensions.some(ext => entry.name.endsWith(ext))) {
                    results.push(fullPath);
                }
            }
        }
        return results;
    }

    it('UI層 / サンプルクライアント層から GKL 内部マネージャーへの直接アクセスが存在しないこと', () => {
        const rootDir = path.resolve(__dirname, '../../');
        const searchDirs = [
            path.join(rootDir, 'examples'),
            path.join(rootDir, 'src/client')
        ];

        const forbiddenPatterns = [
            /\.gkl\s*\.\s*areaStateManager/,
            /\.gkl\s*\.\s*inventoryStateManager\s*\.\s*update/,
            /\.gkl\s*\.\s*spellStateManager\s*\.\s*update/,
            /areaStateManager\s*\.\s*updateGlyph/,
            /areaStateManager\s*\.\s*updatePlayerPosition/
        ];

        const violations = [];

        for (const dir of searchDirs) {
            const files = collectSourceFiles(dir);
            for (const file of files) {
                const content = fs.readFileSync(file, 'utf-8');
                for (const pattern of forbiddenPatterns) {
                    if (pattern.test(content)) {
                        violations.push({ file, pattern: pattern.toString() });
                    }
                }
            }
        }

        expect(violations, `UI層からGKL内部マネージャーへの不正な直接アクセスが検出されました:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
    });

    it('全サンプルの GameCanvas に常時 requestAnimationFrame 無限描画ループが存在しないこと', () => {
        const rootDir = path.resolve(__dirname, '../../');
        const examplesDir = path.join(rootDir, 'examples');
        const canvasFiles = collectSourceFiles(examplesDir).filter(f => f.includes('GameCanvas'));

        const forbiddenLoopPatterns = [
            /const\s+renderLoop\s*=\s*\(\)\s*=>\s*\{[\s\S]*requestAnimationFrame\(renderLoop\)/,
            /function\s+renderLoop\s*\(\)\s*\{[\s\S]*requestAnimationFrame\(renderLoop\)/
        ];

        const violations = [];

        for (const file of canvasFiles) {
            const content = fs.readFileSync(file, 'utf-8');
            for (const pattern of forbiddenLoopPatterns) {
                if (pattern.test(content)) {
                    violations.push({ file, pattern: pattern.toString() });
                }
            }
        }

        expect(violations, `GameCanvas に常時 requestAnimationFrame ループが検出されました (オンデマンド描画にしてください):\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
    });

    it('WebUICore の destroy() が Driver / GKL / Gamepad を漏れなく安全に破棄すること', () => {
        const mockDriver = {
            destroy: vi.fn(),
            on: vi.fn(),
            off: vi.fn()
        };

        const core = new WebUICore({ driver: mockDriver });
        const gkl = new GKLPlugin();
        const detachSpy = vi.spyOn(gkl, 'detach');
        gkl.attach(core);

        expect(core.state).toBe('UNINITIALIZED');
        expect(gkl.core).toBe(core);

        core.destroy();

        expect(core.state).toBe('DESTROYED');
        expect(mockDriver.destroy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(1);
        expect(gkl.core).toBeNull();
        expect(core.listeners.size).toBe(0);
    });

    it('GKLPlugin の invalidateAllCaches() が全内部ステートのキャッシュを安全に破棄すること', () => {
        const gkl = new GKLPlugin();
        gkl.inventoryStateManager.isSynced = true;
        gkl.spellStateManager.isSynced = true;
        gkl.skillStateManager.isSynced = true;

        gkl.invalidateAllCaches();

        expect(gkl.inventoryStateManager.isSynced).toBe(false);
        expect(gkl.spellStateManager.isSynced).toBe(false);
        expect(gkl.skillStateManager.isSynced).toBe(false);
    });
});
