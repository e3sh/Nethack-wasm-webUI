import { describe, it, expect, beforeEach } from 'vitest';
import { LoreCodex } from './LoreCodex.js';
import { LoreCodexStorage } from './LoreCodexStorage.js';

describe('LoreCodex - 冒険手帳・伝承コレクションマネージャ', () => {
    let mockStorageMap;
    let customStorage;
    let codex;

    beforeEach(() => {
        mockStorageMap = new Map();
        customStorage = {
            getItem: (k) => mockStorageMap.get(k) || null,
            setItem: (k, v) => mockStorageMap.set(k, String(v)),
            removeItem: (k) => mockStorageMap.delete(k),
            clear: () => mockStorageMap.clear()
        };
        const storage = new LoreCodexStorage({ customStorage });
        codex = new LoreCodex({ storage, autoLoad: false });
    });

    it('噂話を追加し、真偽判定および重複防止・訪問回数カウントが行われること', () => {
        const res1 = codex.addRumor({
            id: 'rumor_tru_1',
            text: "A blindfold can be very useful if you're telepathic.",
            translatedText: "テレパシー能力があるなら、目隠しはとても役に立つ。",
            isTrue: true,
            source: 'cookie'
        });

        expect(res1.isNew).toBe(true);
        expect(res1.rumor.seenCount).toBe(1);

        // 同じ噂話を再度獲得
        const res2 = codex.addRumor({
            id: 'rumor_tru_1',
            text: "A blindfold can be very useful if you're telepathic.",
            isTrue: true,
            source: 'cookie'
        });

        expect(res2.isNew).toBe(false);
        expect(res2.rumor.seenCount).toBe(2);
        expect(codex.getRumors().length).toBe(1);
    });

    it('神託の追加と一覧取得ができること', () => {
        const res = codex.addOracle({
            id: 'oracle_1',
            title: 'If thy wand hath run out...',
            text: 'If thy wand hath run out of charges...',
            translatedText: 'もし杖のチャージが切れても...',
            isSpecial: false
        });

        expect(res.isNew).toBe(true);
        expect(codex.getOracles().length).toBe(1);
        expect(codex.getOracles()[0].id).toBe('oracle_1');
    });

    it('統計集計 (getStats) が正しく計算されること', () => {
        codex.addRumor({ id: 'rumor_tru_1', text: 'True 1', isTrue: true });
        codex.addRumor({ id: 'rumor_tru_2', text: 'True 2', isTrue: true });
        codex.addRumor({ id: 'rumor_fal_1', text: 'False 1', isTrue: false });
        codex.addOracle({ id: 'oracle_1', text: 'Oracle 1' });

        const stats = codex.getStats();
        expect(stats.rumors.collected).toBe(3);
        expect(stats.rumors.trueCount).toBe(2);
        expect(stats.rumors.falseCount).toBe(1);
        expect(stats.oracles.collected).toBe(1);
        expect(stats.overall.totalCollected).toBe(4);
    });

    it('検索機能 (search) で英和キーワードおよび真偽フィルタが機能すること', () => {
        codex.addRumor({ id: 'rumor_tru_1', text: 'A blindfold is useful', translatedText: '目隠しは便利', isTrue: true });
        codex.addRumor({ id: 'rumor_fal_1', text: 'Dragons love water', translatedText: 'ドラゴンは水が好き', isTrue: false });

        // 英語検索
        const hitsEn = codex.search('blindfold');
        expect(hitsEn.length).toBe(1);
        expect(hitsEn[0].id).toBe('rumor_tru_1');

        // 日本語検索
        const hitsJp = codex.search('ドラゴン');
        expect(hitsJp.length).toBe(1);
        expect(hitsJp[0].id).toBe('rumor_fal_1');

        // フィルタ (TRUE のみ)
        const trueItems = codex.search('', 'TRUE');
        expect(trueItems.length).toBe(1);
        expect(trueItems[0].isTrue).toBe(true);

        // フィルタ (FALSE のみ)
        const falseItems = codex.search('', 'FALSE');
        expect(falseItems.length).toBe(1);
        expect(falseItems[0].isTrue).toBe(false);
    });

    it('セッション横断保存 (Storage) への保存と復元が正しく動作すること', () => {
        codex.addRumor({ id: 'rumor_tru_10', text: 'Rumor 10', isTrue: true });
        codex.addOracle({ id: 'oracle_5', text: 'Oracle 5' });

        // 別インスタンスで同じストレージから復元 (autoLoad: true によるコンストラクタ即時復元)
        const autoLoadedCodex = new LoreCodex({
            storage: new LoreCodexStorage({ customStorage })
        });
        expect(autoLoadedCodex.getRumors().length).toBe(1);
        expect(autoLoadedCodex.getRumors()[0].id).toBe('rumor_tru_10');
        expect(autoLoadedCodex.getOracles().length).toBe(1);
        expect(autoLoadedCodex.getOracles()[0].id).toBe('oracle_5');

        // 明示的な load() 呼び出しも同期で機能すること
        const manualCodex = new LoreCodex({
            storage: new LoreCodexStorage({ customStorage }),
            autoLoad: false
        });
        expect(manualCodex.getRumors().length).toBe(0);
        manualCodex.load();
        expect(manualCodex.getRumors().length).toBe(1);
    });

    it('床文字・落書き・墓碑銘の追加 (addEngraving) と一覧取得ができること', () => {
        const res1 = codex.addEngraving({
            text: 'The cake is a lie',
            actualText: 'Th? c?ke ?s a l?e',
            translatedText: 'ケーキは嘘だ',
            source: 'Portal (Valve)',
            category: 'ENGRAVING'
        });

        expect(res1.isNew).toBe(true);
        expect(res1.engraving.seenCount).toBe(1);
        expect(codex.getEngravings().length).toBe(1);

        // 重複追加時は seenCount がインクリメントされる
        const res2 = codex.addEngraving({
            text: 'The cake is a lie',
            actualText: 'The cake is a lie'
        });
        expect(res2.isNew).toBe(false);
        expect(res2.engraving.seenCount).toBe(2);
        expect(codex.getEngravings().length).toBe(1);

        // 墓碑銘の追加
        codex.addEngraving({
            text: 'Rest in Peace',
            isHeadstone: true,
            source: '墓碑銘 (Headstone)'
        });
        expect(codex.getEngravings().length).toBe(2);
    });

    it('addEngraving で category: RUMOR が渡されても ENGRAVING に正規化され、噂話検索と混ざらないこと', () => {
        // 床文字に RUMOR カテゴリを指定して追加
        const res = codex.addEngraving({
            text: 'A crystal plate mail will not rust.',
            actualText: 'A cry?tal pl?te ma?l wi?l not ru?t.',
            category: 'RUMOR',
            source: 'rumors.tru'
        });

        expect(res.engraving.category).toBe('ENGRAVING');
        expect(res.engraving.subCategory).toBe('RUMOR');

        // 正規の噂話を追加
        codex.addRumor({
            id: 'rumor_tru_4',
            text: 'A crystal plate mail will not rust.',
            isTrue: true,
            source: 'engraving'
        });

        // 噂話のみの検索 ('RUMOR')
        const rumorResults = codex.search('', 'RUMOR');
        expect(rumorResults.length).toBe(1);
        expect(rumorResults[0].id).toBe('rumor_tru_4');
        expect(rumorResults[0].category).toBe('RUMOR');
        expect(rumorResults[0].isTrue).toBe(true);

        // 全件検索 ('ALL') の結果から category: 'RUMOR' でフィルタしても床文字は混入しない
        const allResults = codex.search('', 'ALL');
        const rumorsFromAll = allResults.filter(item => item.category === 'RUMOR');
        expect(rumorsFromAll.length).toBe(1);
        expect(rumorsFromAll[0].id).toBe('rumor_tru_4');

        // 床文字一覧 (getEngravings) には正常に登録されている
        expect(codex.getEngravings().length).toBe(1);
        expect(codex.getEngravings()[0].id.startsWith('engr_')).toBe(true);
    });

    it('JSON エクスポートとインポートが機能すること', () => {
        codex.addRumor({ id: 'rumor_tru_1', text: 'Rumor 1', isTrue: true });
        codex.addEngraving({ text: 'The cake is a lie', translatedText: 'ケーキは嘘だ' });
        const json = codex.exportJSON();
        expect(json).toContain('nethack-wasm-webui');

        const anotherCodex = new LoreCodex({ autoLoad: false });
        anotherCodex.importJSON(json);

        expect(anotherCodex.getRumors().length).toBe(1);
        expect(anotherCodex.getRumors()[0].id).toBe('rumor_tru_1');
        expect(anotherCodex.getEngravings().length).toBe(1);
        expect(anotherCodex.getEngravings()[0].text).toBe('The cake is a lie');
    });

    it('removeEntry および removeEngraving で個別伝承を安全に削除できること', () => {
        // 噂話・神託・床文字を登録
        codex.addRumor({ id: 'rumor_del_1', text: 'Rumor to delete', isTrue: true });
        codex.addOracle({ id: 'oracle_del_1', text: 'Oracle to delete' });
        const engrRes = codex.addEngraving({ text: 'Scuffed text ?l?er??h', isHeadstone: false });

        expect(codex.getRumors().length).toBe(1);
        expect(codex.getOracles().length).toBe(1);
        expect(codex.getEngravings().length).toBe(1);

        // 床文字の個別削除 (removeEngraving)
        const engrId = engrRes.engraving.id;
        const deletedEngr = codex.removeEngraving(engrId);
        expect(deletedEngr).toBe(true);
        expect(codex.getEngravings().length).toBe(0);

        // 噂話の個別削除 (removeEntry)
        const deletedRumor = codex.removeEntry('rumor_del_1', 'RUMOR');
        expect(deletedRumor).toBe(true);
        expect(codex.getRumors().length).toBe(0);

        // 存在しないIDは false
        expect(codex.removeEntry('not_exist_id')).toBe(false);

        // 神託は残っている
        expect(codex.getOracles().length).toBe(1);
    });

    it('LocalStorage 保存時 (serialize) に translatedText が除外され、復元時 (load) に動的補完されること', () => {
        const mockTranslator = {
            translate: (text) => {
                if (text === '...and they made me engrave my own headstone too!') {
                    return '....それに、自分の墓石を自分で彫らされたんだぜ！';
                }
                return text;
            }
        };

        codex.setTranslationEngine(mockTranslator);

        // 1. 噂話 (マスタ由来)、神託 (マスタ由来)、墓碑銘 (TranslationEngine由来) を追加
        codex.addRumor({ id: 'rumor_tru_1', text: "A blindfold can be very useful if you're telepathic.", isTrue: true });
        codex.addOracle({ id: 'oracle_1', text: 'If thy wand hath run out of charges...' });
        codex.addEngraving({
            text: '...and they made me engrave my own headstone too!',
            category: 'HEADSTONE',
            isHeadstone: true
        });

        // メモリ上では翻訳がセットされている
        expect(codex.getRumors()[0].translatedText).toContain('テレパシー');
        expect(codex.getOracles()[0].translatedText).toContain('もし汝の杖');
        expect(codex.getEngravings()[0].translatedText).toBe('....それに、自分の墓石を自分で彫らされたんだぜ！');

        // 2. serialize() の結果に translatedText が含まれていないこと (容量節約の確認)
        const serialized = codex.serialize();
        expect(serialized.rumors[0].translatedText).toBeUndefined();
        expect(serialized.oracles[0].translatedText).toBeUndefined();
        expect(serialized.engravings[0].translatedText).toBeUndefined();

        // 3. 別の Codex インスタンスでストレージから復元した際、翻訳が動的に再解決されること
        const restoredCodex = new LoreCodex({
            storage: codex.storage,
            translationEngine: mockTranslator,
            autoLoad: true
        });

        expect(restoredCodex.getRumors()[0].translatedText).toContain('テレパシー');
        expect(restoredCodex.getOracles()[0].translatedText).toContain('もし汝の杖');
        expect(restoredCodex.getEngravings()[0].translatedText).toBe('....それに、自分の墓石を自分で彫らされたんだぜ！');

        // 4. 動的解決された墓碑銘の日本語訳で検索できること
        const searchHits = restoredCodex.search('彫らされた');
        expect(searchHits.length).toBe(1);
        expect(searchHits[0].isHeadstone).toBe(true);
    });

    it('辞書更新時に refreshTranslations / setTranslationEngine で翻訳が最新化されること', () => {
        let currentTranslation = '旧訳：墓石を彫った';
        const dynamicTranslator = {
            translate: () => currentTranslation
        };

        codex.setTranslationEngine(dynamicTranslator);
        codex.addEngraving({
            text: 'custom epitaph',
            isHeadstone: true
        });

        expect(codex.getEngravings()[0].translatedText).toBe('旧訳：墓石を彫った');

        // 辞書更新をシミュレート
        currentTranslation = '新訳：墓石を自分で彫らされた！';
        codex.refreshTranslations();

        expect(codex.getEngravings()[0].translatedText).toBe('新訳：墓石を自分で彫らされた！');
    });
});
