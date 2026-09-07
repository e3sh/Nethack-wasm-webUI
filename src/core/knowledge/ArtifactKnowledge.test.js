import { describe, it, expect } from 'vitest';
import { ARTIFACT_KNOWLEDGE_BASE, getArtifactDefinition, getAllArtifactDefinitions } from './ARTIFACT_KNOWLEDGE_BASE.js';
import { WishService } from './WishService.js';
import { StructuredKnowledgeEngine } from './StructuredKnowledgeEngine.js';

describe('ARTIFACT_KNOWLEDGE_BASE & Service Integration (Phase 6 SSOT)', () => {
    it('全33種の固有アーティファクトが正しく定義されていること', () => {
        expect(ARTIFACT_KNOWLEDGE_BASE.length).toBe(33);

        // クエストアーティファクトが13種あること
        const questArts = ARTIFACT_KNOWLEDGE_BASE.filter(a => a.isQuestArtifact);
        expect(questArts.length).toBe(13);

        // 各アーティファクトの必須プロパティチェック
        for (const art of ARTIFACT_KNOWLEDGE_BASE) {
            expect(art.id).toBeDefined();
            expect(art.name).toBeDefined();
            expect(art.nameJa).toBeDefined();
            expect(art.baseName).toBeDefined();
            expect(typeof art.baseOnum).toBe('number');
            expect(art.baseOnum).toBeGreaterThanOrEqual(0);
            expect(art.category).toBeDefined();
            expect(['LAWFUL', 'NEUTRAL', 'CHAOTIC', 'UNALIGNED']).toContain(art.alignment);
            expect(Array.isArray(art.intrinsics)).toBe(true);
            expect(typeof art.descJa).toBe('string');
            expect(typeof art.descEn).toBe('string');
        }
    });

    it('getArtifactDefinition でIDまたは英語名から取得できること', () => {
        const excal = getArtifactDefinition('Excalibur');
        expect(excal).toBeDefined();
        expect(excal.nameJa).toBe('エクスカリバー');
        expect(excal.baseName).toBe('long sword');
        expect(excal.alignment).toBe('LAWFUL');

        const storm = getArtifactDefinition('art_stormbringer');
        expect(storm).toBeDefined();
        expect(storm.name).toBe('Stormbringer');
        expect(storm.alignment).toBe('CHAOTIC');

        const muramasa = getArtifactDefinition('The Tsurugi of Muramasa');
        expect(muramasa).toBeDefined();
        expect(muramasa.role).toBe('samurai');
        expect(muramasa.isQuestArtifact).toBe(true);
    });

    it('WishService のカタログに全33種のアーティファクトが含まれサジェスト可能なこと', () => {
        const wishService = new WishService();
        const catalog = wishService.getCatalog();
        const artifactsInCatalog = catalog.filter(item => item.category === 'ARTIFACT' && item.isArtifact);

        expect(artifactsInCatalog.length).toBe(33);

        // Excalibur がカタログに存在すること
        const excal = artifactsInCatalog.find(a => a.name === 'Excalibur');
        expect(excal).toBeDefined();
        expect(excal.baseName).toBe('long sword');
        expect(excal.baseOnum).toBe(54);

        // クエストアーティファクト（例: The Orb of Fate）もカタログに存在すること
        const fate = artifactsInCatalog.find(a => a.name === 'The Orb of Fate');
        expect(fate).toBeDefined();
        expect(fate.role).toBe('valkyrie');

        // カテゴリ別カタログにも正しく分類されていること
        const byCat = wishService.getCatalogByCategory();
        expect(byCat.ARTIFACT).toBeDefined();
        expect(byCat.ARTIFACT.length).toBe(33);
    });

    it('StructuredKnowledgeEngine からアーティファクトナレッジとベースアイテムが取得できること', () => {
        const engine = new StructuredKnowledgeEngine();
        const excal = engine.getArtifactKnowledge('Excalibur', { language: 'ja' });

        expect(excal).toBeDefined();
        expect(excal.nameJa).toBe('エクスカリバー');
        expect(excal.displayName).toBe('エクスカリバー');
        expect(excal.baseItem).toBeDefined();
        expect(excal.baseItem.name).toBe('ロングソード');

        const allArts = engine.getAllArtifacts({ language: 'ja' });
        expect(allArts.length).toBe(33);
    });
});
