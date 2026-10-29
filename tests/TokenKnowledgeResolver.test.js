import { describe, it, expect } from 'vitest';
import { TokenKnowledgeResolver } from '../src/core/message/TokenKnowledgeResolver.js';
import { StructuredKnowledgeEngine } from '../src/core/knowledge/engines/StructuredKnowledgeEngine.js';

describe('Phase 3: TokenKnowledgeResolver 遅延解決 ＆ ネタバレ防止テスト', () => {
    const resolver = new TokenKnowledgeResolver();
    const engine = new StructuredKnowledgeEngine({ language: 'ja' });
    const mockGKL = {
        structuredKnowledge: engine
    };

    describe('未識別アイテムのネタバレ (Spoiler) 防止検証', () => {
        it('未識別アイテム外見名をクリックした際、真名がネタバレせず未鑑定図鑑データが返ること', () => {
            const token = {
                type: 'item',
                text: 'a ruby potion',
                range: [0, 13],
                interactive: true
            };

            const knowledge = resolver.resolveTokenKnowledge(token, mockGKL, { translate: true });
            expect(knowledge).not.toBeNull();

            // ネタバレ防止検証: 未識別であること
            expect(knowledge.isUnidentified).toBe(true);
            expect(knowledge.appearanceName).toBe('ruby potion');
            // 真名（extra healing 等）が直接露出していないこと
            expect(knowledge.name).not.toContain('extra healing');
            expect(knowledge.category).toBe('POTION');
        });

        it('賢者の知恵モード (sagesWisdomMode: true) 指定時は未識別アイテムでも詳細が扱えること', () => {
            const token = {
                type: 'item',
                text: 'a ruby potion',
                range: [0, 13],
                interactive: true
            };

            const knowledge = resolver.resolveTokenKnowledge(token, mockGKL, {
                translate: true,
                sagesWisdomMode: true
            });
            expect(knowledge).not.toBeNull();
            expect(knowledge.isUnidentified).toBe(true);
            expect(knowledge.category).toBe('POTION');
        });
    });

    describe('識別済みアイテムの遅延解決', () => {
        it('通常アイテムをクリックした際、正しい真名図鑑データが返ること', () => {
            const token = {
                type: 'item',
                text: 'an elven dagger',
                range: [0, 15],
                interactive: true
            };

            const knowledge = resolver.resolveTokenKnowledge(token, mockGKL, { translate: true });
            expect(knowledge).not.toBeNull();
            expect(knowledge.category).toBe('WEAPON');
            expect(knowledge.stats).toBeDefined();
        });
    });

    describe('モンスターの遅延解決', () => {
        it('冠詞付きモンスタートークンからモンスター図鑑データが正しく解決されること', () => {
            const token = {
                type: 'monster',
                text: 'the cockatrice',
                range: [0, 14],
                interactive: true
            };

            const knowledge = resolver.resolveTokenKnowledge(token, mockGKL, { translate: true });
            expect(knowledge).not.toBeNull();
            expect(knowledge.name).toContain('コカトリス');
            expect(knowledge.dangerLevel).toBe('LETHAL');
            expect(knowledge.traits?.petrifiesOnTouch).toBe(true);
        });
    });

    describe('公式和名の取得 (getJapaneseName)', () => {
        it('モンスタートークンから公式和名が取得できること', () => {
            const token = {
                type: 'monster',
                text: 'the cockatrice'
            };
            const nameJa = resolver.getJapaneseName(token);
            expect(nameJa).toBe('コカトリス');
        });

        it('アイテムトークンから公式和名が取得できること', () => {
            const token = {
                type: 'item',
                text: 'a spear'
            };
            const nameJa = resolver.getJapaneseName(token);
            expect(nameJa).toBe('槍');
        });

        it('不明なエンティティの場合は null を返すこと (推測・捏造防止)', () => {
            const token = {
                type: 'item',
                text: 'some nonexistent item 12345'
            };
            const nameJa = resolver.getJapaneseName(token);
            expect(nameJa).toBeNull();
        });
    });
});
