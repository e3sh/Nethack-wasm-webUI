/**
 * EngravingArchaeologyIntegration.test.js
 *
 * 実機で発生した 2 大課題のシナリオ検証:
 * 1. 墓石 (HEADSTONE) 読み取り時の誤反応防止 (風化警告や再刻みが出ないこと)
 * 2. 同一マスの往復による段階的劣化で、意味が化けずに一貫して追跡されること
 *    (?d acra?ium -> c ?cr??i?m -> ?  ?r? i?m -> ?r  ? m)
 * 3. 踏み荒らしで完全に文字が消滅したときのキャッシュ破棄
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LoreDetector } from '../../src/core/knowledge/lore/LoreDetector.js';
import { EngravingArchaeologist } from '../../src/core/knowledge/lore/EngravingArchaeologist.js';
import { AreaStateManager } from '../../src/core/knowledge/state/AreaStateManager.js';
import { LoreCodex } from '../../src/core/knowledge/lore/LoreCodex.js';
import { LORE_MASTER } from '../../src/core/knowledge/lore/data/LoreMasterData.js';


describe('Engraving Archaeology - 実機劣化シナリオ統合検証', () => {
    let archaeologist;
    let detector;
    let areaStateManager;
    let loreCodex;

    beforeEach(() => {
        archaeologist = new EngravingArchaeologist({ master: LORE_MASTER });
        detector = new LoreDetector({ archaeologist });
        areaStateManager = new AreaStateManager(80, 24);
        loreCodex = new LoreCodex({ autoLoad: false });
    });

    it('課題①: 劣化しない墓石 (HEADSTONE) を踏んだ際、Elbereth結界警告や再刻みが出ず、墓碑銘として手帳に登録されること', () => {
        // 1行目: 墓石プレフィックス
        expect(detector.processMessage('Something is engraved here on the headstone.')).toBeNull();

        // 2行目: 墓碑銘
        const sig = detector.processMessage('You read: "Rest in Peace".');
        expect(sig).not.toBeNull();
        expect(sig.isHeadstone).toBe(true);
        expect(sig.engraveType).toBe('HEADSTONE');
        expect(sig.isElbereth).toBe(false);
        expect(sig.isWardActive).toBe(false);
        expect(sig.warning).toBeNull();
        expect(sig.actualText).toBe('Rest in Peace');

        // LoreCodex に墓碑銘として登録
        const codexRes = loreCodex.addEngraving({
            text: sig.actualText,
            actualText: sig.actualText,
            isHeadstone: true,
            source: '墓碑銘 (Headstone)'
        });
        expect(codexRes.isNew).toBe(true);
        expect(codexRes.engraving.isHeadstone).toBe(true);
        expect(codexRes.engraving.source).toBe('墓碑銘 (Headstone)');
    });

    it('課題②: 実機ログ推移で同じマスを往復して劣化しても、無関係な長文に化けず ad aerarium として追跡されること', () => {
        const playerPos = { x: 15, y: 8 };

        // Step 1: 最初に乗ったマス ('?d acra?ium')
        const sig1 = detector.processMessage('You read: "?d acra?ium".');
        expect(sig1.matched).toBe(true);
        expect(sig1.pristineText).toBe('ad aerarium');

        // AreaStateManager にキャッシュ
        areaStateManager.setEngravingAt(playerPos.x, playerPos.y, sig1.restored);

        // Step 2: 往復して踏み荒らし ('c ?cr??i?m')
        // キャッシュからアンカーを取得
        const anchor2 = areaStateManager.getEngravingAt(playerPos.x, playerPos.y);
        const sig2 = detector.processMessage('You read: "c ?cr??i?m".', { anchorCandidate: anchor2 });
        expect(sig2.matched).toBe(true);
        expect(sig2.pristineText).toBe('ad aerarium');

        // Step 3: さらに往復して劣化 ('?  ?r? i?m')
        // 旧ロジックでは "Madam, in Eden, I'm Adam." に化けていた！
        const anchor3 = areaStateManager.getEngravingAt(playerPos.x, playerPos.y);
        const sig3 = detector.processMessage('You read: "?  ?r? i?m".', { anchorCandidate: anchor3 });
        expect(sig3.matched).toBe(true);
        // 化けずに ad aerarium のまま！
        expect(sig3.pristineText).toBe('ad aerarium');

        // Step 4: さらに往復して末期劣化 ('?r  ? m')
        // 旧ロジックでは "One homunculus a day keeps the doctor away." に化けていた！
        const anchor4 = areaStateManager.getEngravingAt(playerPos.x, playerPos.y);
        const sig4 = detector.processMessage('You read: "?r  ? m".', { anchorCandidate: anchor4 });
        expect(sig4.matched).toBe(true);
        // 化けずに ad aerarium のまま！
        expect(sig4.pristineText).toBe('ad aerarium');

        // Step 5: アンカー無しの状態で '?r  ? m' を読んだ場合 (有効文字が r と m のみ)
        // 意味不明な長文に誤マッチせず、情報不足として安全に弾かれること
        const sigUnanchored = detector.processMessage('You read: "?r  ? m".');
        expect(sigUnanchored.restored).toBeNull();

        // Step 6: たくさん踏んで文字が完全に消滅した場合
        areaStateManager.clearEngravingAt(playerPos.x, playerPos.y);
        expect(areaStateManager.getEngravingAt(playerPos.x, playerPos.y)).toBeNull();
    });
});
