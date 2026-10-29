import { describe, it, expect } from 'vitest';
import { MessageTokenParser } from './MessageTokenParser.js';
import { tokenKnowledgeResolver } from './TokenKnowledgeResolver.js';
import { WebUICore } from '../WebUICore.js';

import { EventEmitter } from 'events';

class MockDriver extends EventEmitter {
    constructor() {
        super();
        this.stdin = { write: () => {} };
    }
}

describe('Phase 2: MessageTokenParser 単体テスト', () => {
    const parser = new MessageTokenParser();

    describe('第1トラック: カタログ照合と正確な範囲スライス', () => {
        it('アイテムメッセージが正しくトークン化され、原文完全復元が可能であること', () => {
            const rawText = "You drop an elven dagger.";
            const tokens = parser.parse(rawText);

            expect(tokens.length).toBeGreaterThan(1);
            // 原文完全復元検証 (情報の欠落ゼロ)
            const reconstructed = tokens.map(t => t.text).join('');
            expect(reconstructed).toBe(rawText);

            // 各トークンの range 整合性
            for (const t of tokens) {
                expect(rawText.slice(t.range[0], t.range[1])).toBe(t.text);
            }

            // アイテムトークン
            const itemToken = tokens.find(t => t.type === 'item');
            expect(itemToken).toBeDefined();
            expect(itemToken.text).toBe('an elven dagger');
            expect(itemToken.interactive).toBe(true);
            expect(itemToken.meta).toBeDefined();
        });

        it('モンスターメッセージが正しくトークン化されること', () => {
            const rawText = "You release the kitten.";
            const tokens = parser.parse(rawText);

            expect(tokens.length).toBeGreaterThan(1);
            const reconstructed = tokens.map(t => t.text).join('');
            expect(reconstructed).toBe(rawText);

            const monToken = tokens.find(t => t.type === 'monster');
            expect(monToken).toBeDefined();
            expect(monToken.text).toBe('the kitten');
            expect(monToken.interactive).toBe(true);
        });

        it('未登録の通常メッセージは安全に平文トークン1件として返却されること', () => {
            const rawText = "You feel very firm.";
            const tokens = parser.parse(rawText);

            expect(tokens.length).toBe(1);
            expect(tokens[0].type).toBe('text');
            expect(tokens[0].text).toBe(rawText);
            expect(tokens[0].range).toEqual([0, rawText.length]);
            expect(tokens[0].interactive).toBe(false);
        });

        it('足元地形メッセージ (There is a staircase up here. 等) で階段がモンスターと誤認識されないこと', () => {
            const rawText = "There is a staircase up here.";
            const tokens = parser.parse(rawText);

            expect(tokens.length).toBe(1);
            expect(tokens[0].type).toBe('text');
            expect(tokens[0].text).toBe(rawText);
            expect(tokens[0].interactive).toBe(false);
        });

        it('受動態・状態メッセージ (You get zapped! 等) がモンスターやアイテムとして誤抽出されず、安全に平文として扱われること', () => {
            const testMessages = [
                "You get zapped!",
                "You get regurgitated!",
                "You get released!"
            ];

            for (const rawText of testMessages) {
                const tokens = parser.parse(rawText);
                expect(tokens.length).toBe(1);
                expect(tokens[0].type).toBe('text');
                expect(tokens[0].text).toBe(rawText);
                expect(tokens[0].range).toEqual([0, rawText.length]);
                expect(tokens[0].interactive).toBe(false);
            }
        });
    });

    describe('第2トラック: 2層防壁戦闘メッセージ検出と誤検出 0% 保証', () => {
        it('第1防壁: 非戦闘コンテキストでは戦闘動詞を含む文でも戦闘パーサーが起動しないこと (誤検出防止)', () => {
            const combatMsg = "You hit the jackal.";
            // context なし (非戦闘ターン)
            const tokens = parser.parse(combatMsg, {});

            expect(tokens.length).toBe(1);
            expect(tokens[0].type).toBe('text');
            expect(tokens[0].text).toBe(combatMsg);
        });

        it('第1防壁: 戦闘コンテキスト成立時 (lastAttackTarget 等) は正しく戦闘検出が起動すること', () => {
            const combatMsg = "You hit the jackal.";
            const mockContext = {
                gkl: {
                    fxCoordinator: {
                        lastAttackTarget: { x: 5, y: 5, timestamp: Date.now() }
                    }
                }
            };

            const tokens = parser.parse(combatMsg, mockContext);
            expect(tokens.length).toBeGreaterThan(1);

            const reconstructed = tokens.map(t => t.text).join('');
            expect(reconstructed).toBe(combatMsg);

            const targetToken = tokens.find(t => t.type === 'monster');
            expect(targetToken).toBeDefined();
            expect(targetToken.text).toBe('jackal');
            expect(targetToken.meta?.combatRole).toBe('target');
        });

        it('モンスター側からの攻撃メッセージが正しく解析されること', () => {
            const combatMsg = "The jackal bites you!";
            const mockContext = {
                gkl: {
                    fxCoordinator: {
                        lastAttackTarget: { x: 5, y: 5, timestamp: Date.now() }
                    }
                }
            };

            const tokens = parser.parse(combatMsg, mockContext);
            expect(tokens.length).toBeGreaterThan(1);

            const attackerToken = tokens.find(t => t.type === 'monster');
            expect(attackerToken).toBeDefined();
            expect(attackerToken.text).toBe('jackal');
            expect(attackerToken.meta?.combatRole).toBe('attacker');
        });

        it('連鎖撃破メッセージ (is killed! / dies!) がコンテキストを継承してトークン化されること', () => {
            const killMsg = "The jackal is killed!";
            const mockContext = { isCombatContext: true };

            const tokens = parser.parse(killMsg, mockContext);
            expect(tokens.length).toBeGreaterThan(1);

            const monToken = tokens.find(t => t.type === 'monster');
            expect(monToken).toBeDefined();
            expect(monToken.text).toBe('jackal');
        });

        it('第2防壁: モンスター辞書に存在しない主語・目的語は絶対に戦闘トークン化されないこと (誤検出率 0%)', () => {
            const mockContext = { isCombatContext: true };

            // 店主やトラップのセリフ・メッセージ
            const trapMsg = "A bear trap bites into your leg!";
            const tokensTrap = parser.parse(trapMsg, mockContext);
            expect(tokensTrap.every(t => t.type === 'text')).toBe(true);

            const idiomMsg = "That bites!";
            const tokensIdiom = parser.parse(idiomMsg, mockContext);
            expect(tokensIdiom.every(t => t.type === 'text')).toBe(true);
        });
    });

    describe('WebUICore 連携テスト: handleMessageText からの tokens 付与', () => {
        it('WebUICore の messageItem に tokens が自動付与されること', () => {
            const core = new WebUICore({ driver: new MockDriver() });
            let receivedItem = null;

            core.on('messageItem', (item) => {
                receivedItem = item;
            });

            // ドライバーからの putstr をエミュレート
            core.driver.emit('putstr', { windowId: 1, text: 'You drop an elven dagger.' });

            expect(receivedItem).not.toBeNull();
            expect(Array.isArray(receivedItem.tokens)).toBe(true);
            expect(receivedItem.tokens.length).toBeGreaterThan(1);

            const itemToken = receivedItem.tokens.find(t => t.type === 'item');
            expect(itemToken).toBeDefined();
            expect(itemToken.text).toBe('an elven dagger');
        });
    });

    describe('V2: 物理コンテキスト制約 ＆ 多段正規化 ＆ 誤爆根絶回帰テスト', () => {
        it('拾得・インベントリ行: "f - 5 daggers." および "a - an uncursed +1 long sword (weapon in hand)." が正しくアイテム解決されること', () => {
            const raw1 = "f - 5 daggers.";
            const tokens1 = parser.parse(raw1);
            expect(tokens1.map(t => t.text).join('')).toBe(raw1);

            const item1 = tokens1.find(t => t.type === 'item');
            expect(item1).toBeDefined();
            expect(item1.text).toBe('5 daggers');
            expect(item1.interactive).toBe(true);
            const resolved1 = tokenKnowledgeResolver.resolveTokenKnowledge(item1);
            expect(resolved1).not.toBeNull();
            expect(resolved1.name.toLowerCase()).toBe('dagger');

            const raw2 = "a - an uncursed +1 long sword (weapon in hand).";
            const tokens2 = parser.parse(raw2);
            expect(tokens2.map(t => t.text).join('')).toBe(raw2);

            const item2 = tokens2.find(t => t.type === 'item');
            expect(item2).toBeDefined();
            expect(item2.text).toBe('an uncursed +1 long sword (weapon in hand)');
            expect(item2.interactive).toBe(true);
            const resolved2 = tokenKnowledgeResolver.resolveTokenKnowledge(item2);
            expect(resolved2).not.toBeNull();
            expect(resolved2.name.toLowerCase()).toBe('long sword');
        });

        it('ドロップ行: "You drop an uncursed +0 dagger." および "You drop 5 blessed potions of healing." が解決成功すること', () => {
            const raw1 = "You drop an uncursed +0 dagger.";
            const tokens1 = parser.parse(raw1);
            expect(tokens1.map(t => t.text).join('')).toBe(raw1);

            const item1 = tokens1.find(t => t.type === 'item');
            expect(item1).toBeDefined();
            expect(item1.text).toBe('an uncursed +0 dagger');
            expect(item1.interactive).toBe(true);
            const resolved1 = tokenKnowledgeResolver.resolveTokenKnowledge(item1);
            expect(resolved1).not.toBeNull();
            expect(resolved1.name.toLowerCase()).toBe('dagger');

            const raw2 = "You drop 5 blessed potions of healing.";
            const tokens2 = parser.parse(raw2);
            expect(tokens2.map(t => t.text).join('')).toBe(raw2);

            const item2 = tokens2.find(t => t.type === 'item');
            expect(item2).toBeDefined();
            expect(item2.text).toBe('5 blessed potions of healing');
            expect(item2.interactive).toBe(true);
            const resolved2 = tokenKnowledgeResolver.resolveTokenKnowledge(item2);
            expect(resolved2).not.toBeNull();
            expect(resolved2.name.toLowerCase()).toBe('potion of healing');
        });

        it('足元確認行: "You see here a ruby potion." が未識別外見名として抽出されネタバレ防止解決されること', () => {
            const raw = "You see here a ruby potion.";
            const tokens = parser.parse(raw);
            expect(tokens.map(t => t.text).join('')).toBe(raw);

            const item = tokens.find(t => t.type === 'item');
            expect(item).toBeDefined();
            expect(item.text).toBe('a ruby potion');
            expect(item.interactive).toBe(true);

            const resolved = tokenKnowledgeResolver.resolveTokenKnowledge(item);
            expect(resolved).not.toBeNull();
            expect(resolved.isUnidentified).toBe(true);
            expect(resolved.appearanceName.toLowerCase()).toBe('ruby potion');
        });

        it('金貨の一体認識: "100 gold pieces." および "You see here 100 gold pieces." で数値切り取り誤爆がなく全体が item になること', () => {
            const raw1 = "100 gold pieces.";
            const tokens1 = parser.parse(raw1);
            expect(tokens1.map(t => t.text).join('')).toBe(raw1);

            expect(tokens1.some(t => t.type === 'monster')).toBe(false);
            const item1 = tokens1.find(t => t.type === 'item');
            expect(item1).toBeDefined();
            expect(item1.text).toBe('100 gold pieces');
            const resolved1 = tokenKnowledgeResolver.resolveTokenKnowledge(item1);
            expect(resolved1).not.toBeNull();
            expect(resolved1.name.toLowerCase()).toBe('gold piece');

            const raw2 = "You see here 100 gold pieces.";
            const tokens2 = parser.parse(raw2);
            expect(tokens2.map(t => t.text).join('')).toBe(raw2);
            expect(tokens2.some(t => t.type === 'monster')).toBe(false);

            const item2 = tokens2.find(t => t.type === 'item');
            expect(item2).toBeDefined();
            expect(item2.text).toBe('100 gold pieces');
            const resolved2 = tokenKnowledgeResolver.resolveTokenKnowledge(item2);
            expect(resolved2).not.toBeNull();
            expect(resolved2.name.toLowerCase()).toBe('gold piece');
        });

        it('環境・地形誤爆の完全遮断: "The door resists!", "The door is locked.", "You kick the door." が平文維持されること', () => {
            const messages = [
                "The door resists!",
                "The door is locked.",
                "You kick the door."
            ];

            for (const msg of messages) {
                const tokens = parser.parse(msg);
                expect(tokens.map(t => t.text).join('')).toBe(msg);

                const interactiveTokens = tokens.filter(t => t.interactive);
                expect(interactiveTokens.length).toBe(0);

                expect(tokens.every(t => t.type === 'text' && !t.interactive)).toBe(true);
            }
        });
    });
});
