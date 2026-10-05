import { describe, it, expect, beforeEach } from 'vitest';
import { AdventureLogManager } from '../../../../src/core/knowledge/lore/AdventureLogManager.js';
import { AdventureLogStorage } from '../../../../src/core/knowledge/lore/AdventureLogStorage.js';

describe('AdventureLogManager', () => {
    let mockStorage;
    let manager;

    beforeEach(() => {
        // メモリ内フォールバックを使用するストレージ
        mockStorage = new AdventureLogStorage({
            storageKey: 'test_adventure_log'
        });
        mockStorage.clear();
        manager = new AdventureLogManager({
            storage: mockStorage,
            autoLoad: false
        });
    });

    describe('初期状態', () => {
        it('初期状態では何もアンロックされておらず、進捗率が0%であること', () => {
            const progress = manager.getProgress();
            expect(progress.monsters.unlocked).toBe(0);
            expect(progress.monsters.total).toBe(383);
            expect(progress.monsters.percentage).toBe(0);

            expect(progress.objects.unlocked).toBe(0);
            expect(progress.objects.total).toBe(481);
            expect(progress.objects.percentage).toBe(0);

            expect(progress.rumors.unlocked).toBe(0);
            expect(progress.rumors.total).toBe(787);
            expect(progress.rumors.percentage).toBe(0);

            expect(progress.overall.unlocked).toBe(0);
            expect(progress.overall.percentage).toBe(0);
        });
    });

    describe('モンスターアンロック', () => {
        it('monOffset でモンスターをアンロックできること', () => {
            const res = manager.unlockMonster(0); // giant ant
            expect(res).toBe(true);
            expect(manager.isMonsterUnlocked(0)).toBe(true);
            expect(manager.isNew('monster', 0)).toBe(true);

            const progress = manager.getProgress();
            expect(progress.monsters.unlocked).toBe(1);
            expect(progress.monsters.newCount).toBe(1);
        });

        it('名前でモンスターをアンロックできること', () => {
            const res = manager.unlockMonster('killer bee');
            expect(res).toBe(true);
            expect(manager.isMonsterUnlocked(1)).toBe(true);
            expect(manager.isMonsterUnlocked('killer bee')).toBe(true);
        });

        it('すでにアンロック済みのモンスターは重複登録されないこと', () => {
            manager.unlockMonster(0);
            const res = manager.unlockMonster(0);
            expect(res).toBe(false);
            expect(manager.getProgress().monsters.unlocked).toBe(1);
        });

        it('不正な識別子の場合は false を返すこと', () => {
            expect(manager.unlockMonster(9999)).toBe(false);
            expect(manager.unlockMonster('invalid_monster_name_xyz')).toBe(false);
        });
    });

    describe('アイテムアンロック', () => {
        it('onum でアイテムをアンロックできること', () => {
            const res = manager.unlockObject(0);
            expect(res).toBe(true);
            expect(manager.isObjectUnlocked(0)).toBe(true);
            expect(manager.isNew('object', 0)).toBe(true);

            const progress = manager.getProgress();
            expect(progress.objects.unlocked).toBe(1);
            expect(progress.objects.newCount).toBe(1);
        });

        it('名称でアイテムをアンロックできること', () => {
            const res = manager.unlockObject('blindfold');
            expect(res).toBe(true);
            expect(manager.isObjectUnlocked('blindfold')).toBe(true);
        });

        it('重複アンロックを正しく無視すること', () => {
            manager.unlockObject(10);
            const res = manager.unlockObject(10);
            expect(res).toBe(false);
            expect(manager.getProgress().objects.unlocked).toBe(1);
        });
    });

    describe('噂アンロック', () => {
        it('噂IDでアンロックできること', () => {
            const res = manager.unlockRumor('rumor_tru_1');
            expect(res).toBe(true);
            expect(manager.isRumorUnlocked('rumor_tru_1')).toBe(true);
            expect(manager.isNew('rumor', 'rumor_tru_1')).toBe(true);

            const progress = manager.getProgress();
            expect(progress.rumors.unlocked).toBe(1);
        });

        it('真の噂と偽の噂が正しく判定・区別されること', () => {
            manager.unlockRumor('rumor_tru_1');
            manager.unlockRumor('rumor_fal_1');

            const list = manager.getAllRumorsWithStatus();
            const trueRumor = list.find(r => r.id === 'rumor_tru_1');
            const falseRumor = list.find(r => r.id === 'rumor_fal_1');

            expect(trueRumor.isUnlocked).toBe(true);
            expect(trueRumor.isTrue).toBe(true);
            expect(trueRumor.type).toBe('TRUE');
            expect(trueRumor.textJa).toContain('目隠し');

            expect(falseRumor.isUnlocked).toBe(true);
            expect(falseRumor.isTrue).toBe(false);
            expect(falseRumor.type).toBe('FALSE');
        });
    });

    describe('既読管理 (NEW! バッジ)', () => {
        it('markAsRead で特定エントリを既読化できること', () => {
            manager.unlockMonster(5);
            expect(manager.isNew('monster', 5)).toBe(true);

            manager.markAsRead('monster', 5);
            expect(manager.isNew('monster', 5)).toBe(false);
            expect(manager.getProgress().monsters.newCount).toBe(0);
        });

        it('markAllAsRead で全エントリを一括既読化できること', () => {
            manager.unlockMonster(1);
            manager.unlockObject(2);
            manager.unlockRumor('RUMOR_002');
            expect(manager.getProgress().overall.newCount).toBe(3);

            manager.markAllAsRead('all');
            expect(manager.getProgress().overall.newCount).toBe(0);
        });
    });

    describe('状態付き一覧取得', () => {
        it('getAllMonstersWithStatus で未解禁は ??? 、解禁済みは実名が返ること', () => {
            manager.unlockMonster(0); // giant ant
            const list = manager.getAllMonstersWithStatus();
            expect(list.length).toBe(383);

            const ant = list.find(m => m.monOffset === 0);
            expect(ant.isUnlocked).toBe(true);
            expect(ant.name).toBe('giant ant');
            expect(ant.data).not.toBeNull();

            const bee = list.find(m => m.monOffset === 1);
            expect(bee.isUnlocked).toBe(false);
            expect(bee.name).toBe('???');
            expect(bee.data).toBeNull();
        });

        it('getAllObjectsWithStatus で未解禁は ??? 、解禁済みは実名が返ること', () => {
            manager.unlockObject(0);
            const list = manager.getAllObjectsWithStatus();
            expect(list.length).toBe(481);

            const first = list[0];
            expect(first.isUnlocked).toBe(true);
            expect(first.name).not.toBe('???');
            expect(first.data).not.toBeNull();

            const second = list[1];
            expect(second.isUnlocked).toBe(false);
            expect(second.name).toBe('???');
            expect(second.data).toBeNull();
        });
    });

    describe('リセット・永続化・バックアップ', () => {
        it('save と load で状態が復元されること', () => {
            manager.unlockMonster(12); // jackal
            manager.unlockObject(5);
            manager.unlockRumor('RUMOR_003');

            const manager2 = new AdventureLogManager({
                storage: mockStorage,
                autoLoad: true
            });

            expect(manager2.isMonsterUnlocked(12)).toBe(true);
            expect(manager2.isObjectUnlocked(5)).toBe(true);
            expect(manager2.isRumorUnlocked('RUMOR_003')).toBe(true);
            expect(manager2.getProgress().overall.unlocked).toBe(3);
        });

        it('reset で全データが消去され初期状態に戻ること', () => {
            manager.unlockMonster(12);
            manager.unlockObject(5);
            expect(manager.getProgress().overall.unlocked).toBe(2);

            manager.reset();
            expect(manager.getProgress().overall.unlocked).toBe(0);
            expect(manager.isMonsterUnlocked(12)).toBe(false);
            expect(manager.isObjectUnlocked(5)).toBe(false);

            // ストレージ再読込でも空であること
            const manager2 = new AdventureLogManager({
                storage: mockStorage,
                autoLoad: true
            });
            expect(manager2.getProgress().overall.unlocked).toBe(0);
        });

        it('exportJSON と importJSON でバックアップ復元ができること', () => {
            manager.unlockMonster(20);
            manager.unlockObject(30);
            const json = manager.exportJSON();
            expect(typeof json).toBe('string');

            manager.reset();
            expect(manager.getProgress().overall.unlocked).toBe(0);

            const success = manager.importJSON(json);
            expect(success).toBe(true);
            expect(manager.isMonsterUnlocked(20)).toBe(true);
            expect(manager.isObjectUnlocked(30)).toBe(true);
            expect(manager.getProgress().overall.unlocked).toBe(2);
        });
    });

    describe('getRelatedLore 相互参照機能', () => {
        it('エンティティに関連する噂を解禁状態付きで取得できること', () => {
            // onum 233 = blindfold, rumor_tru_1 が関連
            const loreAll = manager.getRelatedLore(233, { unlockedOnly: false });
            expect(loreAll.length).toBeGreaterThan(0);
            const targetRumor = loreAll.find(l => l.id === 'rumor_tru_1');
            expect(targetRumor).toBeDefined();
            expect(targetRumor.isUnlocked).toBe(false);

            // 噂をアンロック
            manager.unlockRumor('rumor_tru_1');

            const loreUpdated = manager.getRelatedLore(233, { unlockedOnly: false });
            const targetRumorUpdated = loreUpdated.find(l => l.id === 'rumor_tru_1');
            expect(targetRumorUpdated.isUnlocked).toBe(true);
            expect(targetRumorUpdated.isNew).toBe(true);

            // unlockedOnly: true では未解禁のものは除外されること
            const unlockedList = manager.getRelatedLore(233, { unlockedOnly: true });
            expect(unlockedList.every(l => l.isUnlocked)).toBe(true);
            expect(unlockedList.some(l => l.id === 'rumor_tru_1')).toBe(true);
        });

        it('神託（Oracle）のアンロック機能および公式ガイドモード切替が正しく動作すること', () => {
            // onum 262 = Candelabrum of Invocation (oracle_17 が関連)
            // 1. デフォルト (アンロック制): 未解禁時は isUnlocked: false
            const loreBefore = manager.getRelatedLore(262, { unlockedOnly: false });
            const oracleBefore = loreBefore.find(l => l.category === 'ORACLE');
            expect(oracleBefore).toBeDefined();
            expect(oracleBefore.isUnlocked).toBe(false);

            // 2. 神託をアンロック (unlockOracle)
            const isNew = manager.unlockOracle(oracleBefore.id);
            expect(isNew).toBe(true);
            expect(manager.isOracleUnlocked(oracleBefore.id)).toBe(true);
            expect(manager.isNew('oracle', oracleBefore.id)).toBe(true);

            const loreAfter = manager.getRelatedLore(262, { unlockedOnly: false });
            const oracleAfter = loreAfter.find(l => l.id === oracleBefore.id);
            expect(oracleAfter.isUnlocked).toBe(true);
            expect(oracleAfter.isNew).toBe(true);

            // 既読化
            manager.markAsRead('oracle', oracleBefore.id);
            expect(manager.isNew('oracle', oracleBefore.id)).toBe(false);

            // 3. 公式ガイドモード (oracleGuideAlwaysUnlocked = true) では未解禁でも常時 isUnlocked: true
            manager.setOracleGuideAlwaysUnlocked(true);
            const allOracles = manager.getAllOraclesWithStatus();
            expect(allOracles.every(o => o.isUnlocked)).toBe(true);

            // getRelatedLore でも常時開示
            const loreGuide = manager.getRelatedLore(262, { unlockedOnly: false });
            const oracleGuide = loreGuide.find(l => l.id === oracleBefore.id);
            expect(oracleGuide.isUnlocked).toBe(true);
            expect(oracleGuide.isNew).toBe(false);

            // getProgress での集計
            const progress = manager.getProgress();
            expect(progress.oracles.isGuideMode).toBe(true);
            expect(progress.oracles.unlocked).toBe(20);
        });

        it('unlockObjects で複数アイテムを一括アンロックできること', () => {
            const res = manager.unlockObjects([1, 2, 3, 'dagger']);
            expect(res.isNew).toBe(true);
            expect(res.count).toBeGreaterThan(0);
            expect(manager.isObjectUnlocked(1)).toBe(true);
            expect(manager.isObjectUnlocked(2)).toBe(true);
            expect(manager.isObjectUnlocked(3)).toBe(true);

            // 重複投入時は新規カウント0
            const res2 = manager.unlockObjects([1, 2]);
            expect(res2.isNew).toBe(false);
            expect(res2.count).toBe(0);
        });

        it('getInstance と resetInstance でシングルトン管理が正常に動作すること', () => {
            AdventureLogManager.resetInstance();
            const inst1 = AdventureLogManager.getInstance();
            const inst2 = AdventureLogManager.getInstance();
            expect(inst1).toBe(inst2);

            AdventureLogManager.resetInstance();
            const inst3 = AdventureLogManager.getInstance();
            expect(inst3).not.toBe(inst1);
        });
    });
});

