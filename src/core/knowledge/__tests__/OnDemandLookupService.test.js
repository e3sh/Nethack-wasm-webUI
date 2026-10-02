import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OnDemandLookupService } from '../services/OnDemandLookupService.js';

describe('OnDemandLookupService - WASM動的サイレントクエリ (Gap 3)', () => {
    let service;
    let mockCore;

    beforeEach(() => {
        mockCore = {
            querySequenceSilent: vi.fn()
        };
        service = new OnDemandLookupService({ core: mockCore });
    });

    describe('buildLookupSequence - シーケンス生成', () => {
        it('対象名から正しい NetHack checkwhatis シーケンス (/, ?, name, space) を生成できること', () => {
            const seq = service.buildLookupSequence('blindfold');
            expect(seq).toEqual([
                '/',
                '?',
                'blindfold',
                ' '
            ]);
        });

        it('ナレッジオブジェクトから内部一次識別子 (nameEn / english / oc_name) を抽出してシーケンスを生成できること', () => {
            const seqObj1 = service.buildLookupSequence({ nameEn: 'little dog', name: '仔犬' });
            expect(seqObj1).toEqual(['/', '?', 'little dog', ' ']);

            const seqObj2 = service.buildLookupSequence({ oc_name: 'blindfold', english: 'blindfold', name: '目隠し' });
            expect(seqObj2).toEqual(['/', '?', 'blindfold', ' ']);
        });

        it('アイコンインベントリのアイテムなどスロット文字 (letter) を持つ場合は Cコア純正のインベントリ照会ルート (/, i, letter, space) を生成すること', () => {
            const invItem = {
                letter: 'a',
                rawText: 'a - an uncursed +1 long sword (weapon in hand)',
                glyphId: 1234,
                onum: 56,
                identification: {
                    isUnidentified: false,
                    trueName: 'long sword'
                },
                knowledge: {
                    id: 'item_56',
                    name: '長剣',
                    nameEn: 'long sword',
                    oc_name: 'long sword'
                }
            };
            const seq = service.buildLookupSequence(invItem);
            expect(seq).toEqual(['/', 'i', 'a', ' ']);
        });

        it('スロット文字 (letter) を持たない床のアイテム等の場合は名前指定照会ルート (/, ?, name, space) を生成すること', () => {
            const floorItem = {
                rawText: 'an uncursed +1 long sword',
                glyphId: 1234,
                onum: 56,
                identification: {
                    isUnidentified: false,
                    trueName: 'long sword'
                },
                knowledge: {
                    id: 'item_56',
                    name: '長剣',
                    nameEn: 'long sword',
                    oc_name: 'long sword'
                }
            };
            const seq = service.buildLookupSequence(floorItem);
            expect(seq).toEqual(['/', '?', 'long sword', ' ']);
        });

        it('空文字列や無効値の場合は空配列を返すこと', () => {
            expect(service.buildLookupSequence('')).toEqual([]);
            expect(service.buildLookupSequence('   ')).toEqual([]);
            expect(service.buildLookupSequence(null)).toEqual([]);
            expect(service.buildLookupSequence(undefined)).toEqual([]);
        });
    });

    describe('parseLookupResponse - バッファパースとクレンジング', () => {
        it('プロンプト行を除去し、純粋な公式解説と出典を抽出できること', () => {
            const rawBuffer = [
                { type: 'putstr', text: 'What is this? blindfold' },
                { type: 'putstr', text: 'More info? [y/n]' },
                { type: 'putstr', text: 'A piece of cloth used to cover the eyes.' },
                { type: 'putstr', text: 'Blindness can enhance other senses...' },
                { type: 'putstr', text: '[ NetHack 3.6 data.base ]' },
                { type: 'putstr', text: '--More--' },
                { type: 'putstr', text: '(end)' }
            ];

            const parsed = service.parseLookupResponse(rawBuffer, 'blindfold');
            expect(parsed.found).toBe(true);
            expect(parsed.text).toContain('A piece of cloth used to cover the eyes.');
            expect(parsed.text).toContain('Blindness can enhance other senses...');
            expect(parsed.text).not.toContain('What is this?');
            expect(parsed.text).not.toContain('More info?');
            expect(parsed.text).not.toContain('--More--');
            expect(parsed.source).toBe('NetHack 3.6 data.base');
        });

        it('該当なし・エラーメッセージの場合は found: false を返すこと', () => {
            const rawBuffer = [
                { text: 'What is this? unknown_monster' },
                { text: 'I\'ve never heard of such a monster.' }
            ];

            const parsed = service.parseLookupResponse(rawBuffer, 'unknown_monster');
            expect(parsed.found).toBe(false);
            expect(parsed.text).toBe('');
        });

        it('Unknown command などのエラーメッセージ行を除去し空の場合は found: false とすること', () => {
            const rawBuffer = [
                { text: "Unknown command 'M-.'." },
                { text: "Unknown command '^J'." },
                { text: "Unknown command 'y'." },
                { text: "Unknown command ' '." },
                { text: "You don't have any information on those things." }
            ];

            const parsed = service.parseLookupResponse(rawBuffer, 'invalid_target');
            expect(parsed.found).toBe(false);
            expect(parsed.text).toBe('');
        });

        it('文字列バッファの改行区切りにも正しく対応すること', () => {
            const rawStr = 'What is this? jackal\nA canine scavenger.\n--More--';
            const parsed = service.parseLookupResponse(rawStr, 'jackal');
            expect(parsed.found).toBe(true);
            expect(parsed.text).toBe('A canine scavenger.');
        });
    });

    describe('lookup - 動的サイレントクエリ & メモリキャッシュ', () => {
        it('初回取得時は querySequenceSilent を呼び出し、2回目はキャッシュから即座に返すこと', async () => {
            const sampleBuffer = [
                { text: 'A canine scavenger that hunts in packs.' },
                { text: '[ NetHack 3.6 data.base ]' }
            ];
            mockCore.querySequenceSilent.mockResolvedValue(sampleBuffer);

            // 1回目のクエリ
            const res1 = await service.lookup('jackal');
            expect(res1.found).toBe(true);
            expect(res1.fromCache).toBe(false);
            expect(res1.text).toContain('A canine scavenger');
            expect(mockCore.querySequenceSilent).toHaveBeenCalledTimes(1);

            // 2回目のクエリ (0ms レスポンス・キャッシュヒット)
            const res2 = await service.lookup('jackal');
            expect(res2.found).toBe(true);
            expect(res2.fromCache).toBe(true);
            expect(res2.text).toContain('A canine scavenger');
            expect(mockCore.querySequenceSilent).toHaveBeenCalledTimes(1); // 呼ばれていないこと
        });

        it('冠詞 (a, an, the) の有無にかかわらず同一キーとしてキャッシュヒットすること', async () => {
            const sampleBuffer = [
                { text: 'An item of headgear.' }
            ];
            mockCore.querySequenceSilent.mockResolvedValue(sampleBuffer);

            await service.lookup('helmet');
            expect(mockCore.querySequenceSilent).toHaveBeenCalledTimes(1);

            const res = await service.lookup('a helmet');
            expect(res.fromCache).toBe(true);
            expect(mockCore.querySequenceSilent).toHaveBeenCalledTimes(1);
        });

        it('同一クエリが並行実行された場合、重複したサイレントクエリを発行せず同一 Promise を共有すること', async () => {
            let resolveQuery;
            mockCore.querySequenceSilent.mockReturnValue(new Promise(resolve => {
                resolveQuery = resolve;
            }));

            // 2つのリクエストを同時に開始
            const p1 = service.lookup('dragon');
            const p2 = service.lookup('dragon');

            resolveQuery([{ text: 'A ferocious winged beast.' }]);

            const [r1, r2] = await Promise.all([p1, p2]);
            expect(r1.found).toBe(true);
            expect(r2.found).toBe(true);
            expect(mockCore.querySequenceSilent).toHaveBeenCalledTimes(1);
        });

        it('bypassCache: true を指定した場合はキャッシュを迂回して再取得すること', async () => {
            mockCore.querySequenceSilent.mockResolvedValue([{ text: 'Version 1' }]);
            await service.lookup('dog');
            expect(mockCore.querySequenceSilent).toHaveBeenCalledTimes(1);

            mockCore.querySequenceSilent.mockResolvedValue([{ text: 'Version 2' }]);
            const res = await service.lookup('dog', { bypassCache: true });
            expect(res.text).toBe('Version 2');
            expect(res.fromCache).toBe(false);
            expect(mockCore.querySequenceSilent).toHaveBeenCalledTimes(2);
        });

        it('キャッシュリミットを超えた場合に最も古いエントリが削除されること', async () => {
            const tinyService = new OnDemandLookupService({ core: mockCore, cacheLimit: 2 });
            mockCore.querySequenceSilent.mockResolvedValue([{ text: 'Text' }]);

            await tinyService.lookup('item1');
            await tinyService.lookup('item2');
            expect(tinyService.cache.has('item1')).toBe(true);
            expect(tinyService.cache.has('item2')).toBe(true);

            await tinyService.lookup('item3');
            // item1 が押し出されていること
            expect(tinyService.cache.has('item1')).toBe(false);
            expect(tinyService.cache.has('item2')).toBe(true);
            expect(tinyService.cache.has('item3')).toBe(true);
        });

        it('TranslationEngine 連携: 日本語モード時に公式解説の各行が日本語に動的翻訳されること', async () => {
            const mockTranslator = {
                translate: vi.fn((str) => {
                    const dict = {
                        'Sleep is a death; oh, make me try': '眠りは死なり。おお、我に試させたまえ',
                        'By sleeping, what it is to die,': '眠りによって、死とは何たるかを。',
                        'Religio Medici, by Sir Thomas Browne': 'サー・トーマス・ブラウン『医師の宗教』',
                        '[ Religio Medici, by Sir Thomas Browne ]': '[ サー・トーマス・ブラウン『医師の宗教』 ]'
                    };
                    return dict[str] || str;
                })
            };

            const sampleBuffer = [
                { text: 'Sleep is a death; oh, make me try' },
                { text: 'By sleeping, what it is to die,' },
                { text: '        [ Religio Medici, by Sir Thomas Browne ]' }
            ];
            mockCore.querySequenceSilent.mockResolvedValue(sampleBuffer);

            const trService = new OnDemandLookupService({
                core: mockCore,
                translator: mockTranslator,
                language: 'ja'
            });

            // 1. 日本語モードでの照会
            const resJa = await trService.lookup('wand of sleep', { language: 'ja' });
            expect(resJa.found).toBe(true);
            expect(resJa.text).toContain('眠りは死なり。おお、我に試させたまえ');
            expect(resJa.text).toContain('眠りによって、死とは何たるかを。');
            expect(resJa.rawText).toContain('Sleep is a death; oh, make me try');
            expect(resJa.source).toBe('サー・トーマス・ブラウン『医師の宗教』');

            // 2. 英語モードでの照会 (キャッシュから原文を返却)
            const resEn = await trService.lookup('wand of sleep', { language: 'en' });
            expect(resEn.found).toBe(true);
            expect(resEn.text).toContain('Sleep is a death; oh, make me try');
            expect(resEn.fromCache).toBe(true);
        });
    });
});
