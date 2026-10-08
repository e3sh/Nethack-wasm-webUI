import { describe, it, expect } from 'vitest';
import { GameOverResolver } from './GameOverResolver.js';

describe('GameOverResolver', () => {
    it('record テキスト行を ScoreboardEntry 配列へパースできること', () => {
        // NetHack record / logfile フォーマット例
        const rawRecord = "3.7.0 1050 1 1 50 60 1 Valkyrie Human Female Lawful Agent killed by a goblin";
        const entries = GameOverResolver.parseRecordText(rawRecord);

        expect(entries).toBeDefined();
        expect(Array.isArray(entries)).toBe(true);
    });

    it('driver が null の場合にデフォルトの判定結果を返すこと', async () => {
        const res = await GameOverResolver.resolveGameOver(null);
        expect(res.isGameOver).toBe(false);
        expect(res.reason).toBe('unknown');
        expect(res.scoreboard).toEqual([]);
    });

    it('exploreモード (flags=0x2 / flags=0x6 等) のログが Top 10 ランキング（scoreboard）から除外されること', () => {
        const rawRecord = "5.0.0 1000 0 1 1 50 50 1 20261008 20261008 1000 Val Hum Fem Law Hero,killed by a dart";
        const rawXlog = [
            "version=5.0.0\tpoints=50000\tdeathlev=5\tmaxlvl=5\thp=100\tmaxhp=100\tdeaths=1\tdeathdate=20261008\tbirthdate=20261008\tuid=1000\trole=Val\trace=Hum\tgender=Fem\talign=Law\tname=ExplorerGuy\tdeath=quit\tflags=0x2",
            "version=5.0.0\tpoints=80000\tdeathlev=10\tmaxlvl=10\thp=150\tmaxhp=150\tdeaths=1\tdeathdate=20261008\tbirthdate=20261008\tuid=1000\trole=Wiz\trace=Hum\tgender=Mal\talign=Neu\tname=CheaterGuy\tdeath=ascended\tflags=0x6"
        ].join('\n');

        const scoreboard = GameOverResolver.parseRecordText(rawRecord, rawXlog);
        expect(scoreboard.length).toBe(1);
        expect(scoreboard[0].name).toBe('Hero');
        expect(scoreboard[0].role).toBe('Val');
        expect(scoreboard[0].race).toBe('Hum');
        expect(scoreboard[0].gender).toBe('Fem');
        expect(scoreboard[0].align).toBe('Law');
        expect(scoreboard.some(e => e.name === 'ExplorerGuy')).toBe(false);
        expect(scoreboard.some(e => e.name === 'CheaterGuy')).toBe(false);
    });

    it('recordText 側に探索モードのスコアが混入していても、xlogList の flags=0x2 と照合して確実に除外されること', () => {
        // 過去の IndexedDB や logfile 代替などで recordText 側に explore セッションが紛れ込んだ状況をシミュレート
        const rawRecord = [
            "5.0.0 50000 0 5 5 100 100 1 20261008 20261008 1000 Val Hum Fem Law ExplorerGuy,quit",
            "5.0.0 1000 0 1 1 50 50 1 20261008 20261008 1000 Rog Hum Mal Cha NormalThief,killed by a dart"
        ].join('\n');
        const rawXlog = "version=5.0.0\tpoints=50000\tdeathlev=5\tmaxlvl=5\thp=100\tmaxhp=100\tdeaths=1\tdeathdate=20261008\tbirthdate=20261008\tuid=1000\trole=Val\trace=Hum\tgender=Fem\talign=Law\tname=ExplorerGuy\tdeath=quit\tflags=0x2";

        const scoreboard = GameOverResolver.parseRecordText(rawRecord, rawXlog);
        expect(scoreboard.length).toBe(1);
        expect(scoreboard[0].name).toBe('NormalThief');
        expect(scoreboard[0].role).toBe('Rog');
        expect(scoreboard.some(e => e.name === 'ExplorerGuy')).toBe(false);
    });

    it('NetHack 5.0 の record フォーマットから正しい職業名 (Val, Rog, Wiz, Sam 等) が抽出され Explorer に誤認されないこと', () => {
        const rawRecord = [
            "5.0.0 5000 0 10 10 90 90 1 20261008 20261008 1000 Wiz Hum Mal Neu Gandalf,killed by a dragon",
            "5.0.0 3000 0 7 7 80 80 1 20261008 20261008 1000 Sam Hum Mal Law Musashi,killed by a soldier ant",
            "5.0.0 1500 0 3 3 45 45 1 20261008 20261008 1000 Bar Orc Mal Cha Conan,killed by an arrow"
        ].join('\n');

        const scoreboard = GameOverResolver.parseRecordText(rawRecord);
        expect(scoreboard.length).toBe(3);
        expect(scoreboard[0].name).toBe('Gandalf');
        expect(scoreboard[0].role).toBe('Wiz');
        expect(scoreboard[1].name).toBe('Musashi');
        expect(scoreboard[1].role).toBe('Sam');
        expect(scoreboard[2].name).toBe('Conan');
        expect(scoreboard[2].role).toBe('Bar');
    });

    it('wizardモード (flags=0x1) のログが Top 10 ランキングから除外されること', () => {
        const rawRecord = "5.0.0 500 0 1 1 20 20 1 20261008 20261008 1000 Rog Hum Mal Cha Thief,killed by a kobold";
        const rawXlog = "version=5.0.0\tpoints=99999\tdeathlev=20\tmaxlvl=20\thp=200\tmaxhp=200\tdeaths=1\tdeathdate=20261008\tbirthdate=20261008\tuid=1000\trole=Rog\trace=Hum\tgender=Mal\talign=Cha\tname=WizardGod\tdeath=ascended\tflags=0x1";

        const scoreboard = GameOverResolver.parseRecordText(rawRecord, rawXlog);
        expect(scoreboard.length).toBe(1);
        expect(scoreboard[0].name).toBe('Thief');
        expect(scoreboard.some(e => e.name === 'WizardGod')).toBe(false);
    });

    it('通常モード (flags=0x0 / flags=0x4) のログは正常にスコアボードにマージされること', () => {
        const rawRecord = "5.0.0 500 0 1 1 20 20 1 20261008 20261008 1000 Rog Hum Mal Cha Thief,killed by a kobold";
        const rawXlog = "version=5.0.0\tpoints=1200\tdeathlev=3\tmaxlvl=3\thp=30\tmaxhp=30\tdeaths=1\tdeathdate=20261008\tbirthdate=20261008\tuid=1000\trole=Mon\trace=Hum\tgender=Fem\talign=Neu\tname=NormalHero\tdeath=choked on a tin\tflags=0x0";

        const scoreboard = GameOverResolver.parseRecordText(rawRecord, rawXlog);
        expect(scoreboard.length).toBe(2);
        expect(scoreboard[0].name).toBe('NormalHero');
        expect(scoreboard[0].points).toBe(1200);
        expect(scoreboard[1].name).toBe('Thief');
        expect(scoreboard[1].points).toBe(500);
    });

    it('複数行の xlogfile がある場合、最新行（末尾）が正しく返ること（破壊的 reverse による最古行誤返却の防止）', () => {
        const rawXlog = [
            "version=5.0.0\tpoints=100\tdeathlev=1\tmaxlvl=1\thp=10\tmaxhp=10\tdeaths=1\tname=HeroOld\tdeath=starved to death\tstarttime=100000\tflags=0x0",
            "version=5.0.0\tpoints=200\tdeathlev=2\tmaxlvl=2\thp=20\tmaxhp=20\tdeaths=1\tname=HeroMiddle\tdeath=burned by fire\tstarttime=100100\tflags=0x0",
            "version=5.0.0\tpoints=300\tdeathlev=3\tmaxlvl=3\thp=30\tmaxhp=30\tdeaths=1\tname=HeroNew\tdeath=fell into a pool of lava\tstarttime=100200\tflags=0x0"
        ].join('\n');

        // sessionInfo が空、またはマッチしない場合、末尾の最新レコードが返ること
        const latest = GameOverResolver.parseXlogText(rawXlog, null);
        expect(latest).toBeDefined();
        expect(latest.name).toBe('HeroNew');
        expect(latest.death).toBe('fell into a pool of lava');

        // 存在しないプレイヤー名で検索した場合でも、最古（HeroOld）ではなく最新（HeroNew）にフォールバックすること
        const fallback = GameOverResolver.parseXlogText(rawXlog, { playerName: 'NonExistent' });
        expect(fallback.name).toBe('HeroNew');
    });

    it('過去の別セッション（虐殺の巻物など）が存在していても、今回のセッション（溶岩ダイブ、quit等）が正しく照合されること', () => {
        const rawXlog = [
            "version=5.0.0\tpoints=1000\tdeathlev=1\tmaxlvl=1\thp=10\tmaxhp=10\tdeaths=1\tname=Alice\tdeath=killed by scroll of genocide\tstarttime=1700000000\tflags=0x0",
            "version=5.0.0\tpoints=50\tdeathlev=1\tmaxlvl=1\thp=12\tmaxhp=12\tdeaths=1\tname=Alice\tdeath=fell into a pool of lava\tstarttime=1700003600\tflags=0x2"
        ].join('\n');

        // startTime が直近セッション（1700003600）に近いミリ秒 (1700003600000) または 秒 (1700003600)
        const matched = GameOverResolver.parseXlogText(rawXlog, {
            playerName: 'Alice',
            startTime: 1700003600000 // Date.now() 形式 (ms)
        });

        expect(matched).toBeDefined();
        expect(matched.death).toBe('fell into a pool of lava');
        expect(matched.isDiscover).toBe(true);
    });

    it('sessionInfo.deathMessage に不正確な値があっても、Cコアの effectiveRecord.death が最優先採用されること', async () => {
        const rawXlog = "version=5.0.0\tpoints=50\tdeathlev=1\tmaxlvl=1\thp=15\tmaxhp=15\tdeaths=1\tname=Alice\tdeath=fell into a pool of lava\tstarttime=1700000000\tflags=0x2";
        const mockDriver = {
            fsManager: {
                readXlogText: () => rawXlog,
                readRecordText: () => "",
                hasSaveData: () => false
            }
        };

        const sessionInfo = {
            playerName: 'Alice',
            startTime: 1700000000 * 1000,
            deathMessage: 'It is written in the Book of Footsteps...' // オープニングテキスト誤爆
        };

        const res = await GameOverResolver.resolveGameOver(mockDriver, sessionInfo);
        expect(res.isGameOver).toBe(true);
        expect(res.death).toBe('fell into a pool of lava');
        expect(res.isExploreMode).toBe(true);
        expect(res.deathMessage).toContain('fell into a pool of lava');
        expect(res.deathMessage).not.toContain('Book of Footsteps');
    });

    it('NetHackFSManager.parseRecordList が NetHack 5.0 フォーマットから職業を正しく抽出すること', async () => {
        const { default: NetHackFSManager } = await import('../../driver/NetHackFSManager.js');
        const fsManager = new NetHackFSManager();

        // FS のモック
        const rawRecord = "5.0.0 5000 0 10 10 90 90 1 20261008 20261008 1000 Sam Hum Mal Law Musashi,killed by an ant";
        globalThis.FS = {
            analyzePath: (p) => ({ exists: p === '/save/record' }),
            readFile: () => rawRecord
        };

        try {
            const list = fsManager.parseRecordList();
            expect(list.length).toBe(1);
            expect(list[0].role).toBe('Sam');
            expect(list[0].name).toBe('Musashi');
            expect(list[0].points).toBe(5000);
            expect(list[0].death).toBe('killed by an ant');
        } finally {
            delete globalThis.FS;
        }
    });
});
