import { describe, it, expect, vi } from 'vitest';
import { GKLPlugin } from './GKLPlugin.js';

function createMockDriver() {
    return {
        on: vi.fn(),
        emit: vi.fn(),
        queueSequence: vi.fn(),
        getPromptCategory: vi.fn(),
        getLastSequenceBuffer: vi.fn().mockReturnValue([])
    };
}

function createMockCore() {
    const listeners = new Map();
    return {
        driver: createMockDriver(),
        on: (event, fn) => {
            if (!listeners.has(event)) listeners.set(event, []);
            listeners.get(event).push(fn);
        },
        emit: (event, payload) => {
            if (listeners.has(event)) {
                listeners.get(event).forEach(fn => fn(payload));
            }
        },
        querySequenceSilent: vi.fn().mockResolvedValue([]),
        sendExtCommand: vi.fn(),
        sendActionKey: vi.fn(),
        sendKey: vi.fn(),
        currentPromptCategory: null,
        lastPutstrText: ''
    };
}

describe('GKLPlugin - 独立モジュール＆イベント連携機能', () => {
    it('isNonItemSequence: 移動キー、カウントキー、抽象方向キーを判定できること', () => {
        const plugin = new GKLPlugin();

        expect(plugin.isNonItemSequence(['k'])).toBe(true);
        expect(plugin.isNonItemSequence(['j'])).toBe(true);
        expect(plugin.isNonItemSequence(['5'])).toBe(true);
        expect(plugin.isNonItemSequence(['DIR_N'])).toBe(true);
        expect(plugin.isNonItemSequence(['5', 'k'])).toBe(true);

        // アイテム操作を含むキーは false
        expect(plugin.isNonItemSequence(['d', 'a'])).toBe(false);
        expect(plugin.isNonItemSequence(['a', 'f'])).toBe(false);
    });

    it('attach: WebUICore にアタッチされ、userActionSent イベントを受信して非アイテム操作以外で invalidate が呼ばれること', () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        
        plugin.inventoryStateManager = {
            isSynced: true,
            invalidate: vi.fn()
        };

        plugin.attach(mockCore);

        // 1. 移動キー (非アイテム操作) の場合: invalidate は呼ばれない
        mockCore.emit('userActionSent', { sequence: ['k'] });
        expect(plugin.inventoryStateManager.invalidate).not.toHaveBeenCalled();

        // 2. ドロップキー 'd' (アイテム操作) の場合: invalidate が呼ばれること
        mockCore.emit('userActionSent', { sequence: ['d', 'a'] });
        expect(plugin.inventoryStateManager.invalidate).toHaveBeenCalledTimes(1);
    });

    it('getSituation: 統合状況 (Situation: status, inventory, area, spells, skills, attributes, actions) を返却すること', () => {
        const plugin = new GKLPlugin();
        const situation = plugin.getSituation();

        expect(situation).toHaveProperty('status');
        expect(situation).toHaveProperty('inventory');
        expect(situation).toHaveProperty('area');
        expect(situation).toHaveProperty('spells');
        expect(situation).toHaveProperty('skills');
        expect(situation).toHaveProperty('attributes');
        expect(situation).toHaveProperty('actions');

        expect(Array.isArray(situation.spells.items)).toBe(true);
        expect(Array.isArray(situation.skills.items)).toBe(true);
        expect(situation.attributes).toHaveProperty('effectiveResistances');
    });

    it('syncSpellsSilent & syncAttributesSilent & syncSkillsSilent: サイレント同期が実行され状態が更新されること', async () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        mockCore.querySequenceSilent.mockResolvedValue([
            { lines: ['a - force bolt          1      attack      0%'] }
        ]);

        plugin.attach(mockCore);

        const spellRes = await plugin.syncSpellsSilent();
        expect(spellRes).toBe(true);
        expect(mockCore.querySequenceSilent).toHaveBeenCalledWith(['+', ' ', '\x1b'], expect.anything());
        expect(plugin.spellStateManager.getSpells().length).toBe(1);

        mockCore.querySequenceSilent.mockResolvedValue([
            { lines: ['You are fire resistant.'] }
        ]);
        const attrRes = await plugin.syncAttributesSilent();
        expect(attrRes).toBe(true);
        expect(mockCore.querySequenceSilent).toHaveBeenCalledWith(['\x18', ' ', '\x1b'], expect.anything());
        expect(plugin.attributeStateManager.getEffectiveResistances().fire).toBe(true);

        mockCore.querySequenceSilent.mockResolvedValue([
            { lines: ['* long sword [Skilled]'] }
        ]);
        const skillRes = await plugin.syncSkillsSilent();
        expect(skillRes).toBe(true);
        expect(mockCore.querySequenceSilent).toHaveBeenCalledWith(['#', 'enhance', ' ', '\x1b'], expect.anything());
        expect(plugin.skillStateManager.getSkills().length).toBe(1);
        expect(plugin.skillStateManager.getSkills()[0].name).toBe('long sword');
    });

    it('syncPendingStateSilent: 未同期ステートを直列・排他制御で安全に同期すること', async () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        mockCore.querySequenceSilent.mockResolvedValue([]);
        plugin.attach(mockCore);

        plugin.inventoryStateManager.isSynced = false;
        plugin.attributeStateManager.isSynced = false;
        plugin.spellStateManager.isSynced = false;
        plugin.skillStateManager.isSynced = false;

        const res = await plugin.syncPendingStateSilent();
        expect(res).toBe(true);
        expect(mockCore.querySequenceSilent).toHaveBeenCalledTimes(4);
        expect(mockCore.querySequenceSilent).toHaveBeenNthCalledWith(1, ['i', ' ', '\x1b'], { syncType: 'inventory' });
        expect(mockCore.querySequenceSilent).toHaveBeenNthCalledWith(2, ['\x18', ' ', '\x1b'], { syncType: 'attributes', force: true });
        expect(mockCore.querySequenceSilent).toHaveBeenNthCalledWith(3, ['+', ' ', '\x1b'], { syncType: 'spells' });
        expect(mockCore.querySequenceSilent).toHaveBeenNthCalledWith(4, ['#', 'enhance', ' ', '\x1b'], { syncType: 'skills' });
    });

    it('syncAllSilent: インベントリ、属性、魔法、スキルの一括直列同期が実行されること', async () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        mockCore.querySequenceSilent.mockResolvedValue([]);
        plugin.attach(mockCore);

        plugin.inventoryStateManager.isSynced = false;
        plugin.attributeStateManager.isSynced = false;
        plugin.spellStateManager.isSynced = false;
        plugin.skillStateManager.isSynced = false;

        await plugin.syncAllSilent();
        expect(mockCore.querySequenceSilent).toHaveBeenCalledTimes(4);
        expect(mockCore.querySequenceSilent).toHaveBeenNthCalledWith(1, ['i', ' ', '\x1b'], { syncType: 'inventory' });
        expect(mockCore.querySequenceSilent).toHaveBeenNthCalledWith(2, ['\x18', ' ', '\x1b'], { syncType: 'attributes', force: true });
        expect(mockCore.querySequenceSilent).toHaveBeenNthCalledWith(3, ['+', ' ', '\x1b'], { syncType: 'spells' });
        expect(mockCore.querySequenceSilent).toHaveBeenNthCalledWith(4, ['#', 'enhance', ' ', '\x1b'], { syncType: 'skills' });
    });

    it('getRecommendedActions: 推奨アクション配列を返却すること', () => {
        const plugin = new GKLPlugin();
        const actions = plugin.getRecommendedActions(1);
        expect(Array.isArray(actions)).toBe(true);
    });

    it('structuredKnowledge: GKL プラグインが StructuredKnowledgeEngine を保持し attach 時に translator がバインドされること', () => {
        const plugin = new GKLPlugin();
        expect(plugin.structuredKnowledge).toBeDefined();

        const mockTranslator = { translate: vi.fn(text => `TR:${text}`) };
        const mockCore = createMockCore();
        mockCore.translator = mockTranslator;

        plugin.attach(mockCore);

        const mon = plugin.structuredKnowledge.getMonsterKnowledge('cockatrice', { translate: true });
        expect(mockTranslator.translate).toHaveBeenCalled();
        expect(mon.name).toBe('TR:cockatrice');
    });

    it('travelTo: 指定座標への隣接移動・遠隔トラベルシーケンスおよび自キャラ位置での待機を実行できること', async () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        plugin.attach(mockCore);

        // プレイヤー初期位置 (10, 10)
        plugin.areaStateManager.playerX = 10;
        plugin.areaStateManager.playerY = 10;

        // 0. 自キャラマス (10, 10) のクリック ➔ 待機 '.'
        const res0 = await plugin.travelTo({ x: 10, y: 10 });
        expect(res0).toBe(true);
        expect(mockCore.driver.queueSequence).toHaveBeenCalledWith(['.'], expect.anything());

        // 1. 隣接マス (11, 10) への移動 ➔ DIR_E
        mockCore.driver.queueSequence.mockClear();
        const res1 = await plugin.travelTo({ x: 11, y: 10 });
        expect(res1).toBe(true);
        expect(mockCore.driver.queueSequence).toHaveBeenCalledWith(['DIR_E'], expect.anything());

        // 2. 遠隔マス (13, 10) へのトラベル (10->13: 3ステップ) ➔ ['_', '@', 'DIR_E', 'DIR_E', 'DIR_E', '.']
        mockCore.driver.queueSequence.mockClear();
        const res2 = await plugin.travelTo({ x: 13, y: 10 });
        expect(res2).toBe(true);
        expect(mockCore.driver.queueSequence).toHaveBeenCalledWith(['_', '@', 'DIR_E', 'DIR_E', 'DIR_E', '.'], expect.anything());
    });

    it('サイレント同期完了時に spellsStateUpdated, attributesStateUpdated, skillsStateUpdated, discoveriesStateUpdated が発火すること', async () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        const emittedEvents = [];
        const origEmit = mockCore.emit;
        mockCore.emit = (evt, data) => {
            emittedEvents.push(evt);
            origEmit(evt, data);
        };
        plugin.attach(mockCore);

        // 1. syncSpellsSilent
        mockCore.querySequenceSilent.mockResolvedValueOnce([
            { lines: ['a - force bolt          1      attack      0%'] }
        ]);
        await plugin.syncSpellsSilent();
        expect(emittedEvents).toContain('spellsStateUpdated');

        // 2. syncAttributesSilent
        mockCore.querySequenceSilent.mockResolvedValueOnce([
            { lines: ['You are fire resistant.'] }
        ]);
        await plugin.syncAttributesSilent();
        expect(emittedEvents).toContain('attributesStateUpdated');

        // 3. syncSkillsSilent
        mockCore.querySequenceSilent.mockResolvedValueOnce([
            { lines: ['* long sword [Skilled]'] }
        ]);
        await plugin.syncSkillsSilent();
        expect(emittedEvents).toContain('skillsStateUpdated');

        // 4. syncDiscoveriesSilent
        mockCore.silentQuery = vi.fn().mockResolvedValueOnce('potion: ruby - healing');
        await plugin.syncDiscoveriesSilent();
        expect(emittedEvents).toContain('discoveriesStateUpdated');
    });

    it('messageText および inventoryStateUpdated による状態変化時に各イベントが発火すること', () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        const emittedEvents = [];
        const origEmit = mockCore.emit;
        mockCore.emit = (evt, data) => {
            emittedEvents.push(evt);
            origEmit(evt, data);
        };
        plugin.attach(mockCore);

        // 1. スキル向上メッセージ検知 ➔ skillsStateUpdated
        mockCore.emit('messageText', { text: 'You feel more confident in your dagger skills.' });
        expect(emittedEvents).toContain('skillsStateUpdated');

        // 2. 呪文習得メッセージ検知 ➔ spellsStateUpdated
        mockCore.emit('messageText', { text: 'You learn the spell force bolt!' });
        expect(emittedEvents).toContain('spellsStateUpdated');

        // 3. 耐性獲得メッセージ検知 ➔ attributesStateUpdated
        mockCore.emit('messageText', { text: 'You feel very hot.' });
        expect(emittedEvents).toContain('attributesStateUpdated');

        // 4. インベントリ更新で未登録の鑑定済みアイテムが出現 ➔ discoveriesStateUpdated
        mockCore.emit('inventoryStateUpdated', {
            items: [
                { onum: 297, rawText: 'a wand of digging', identification: { isUnidentified: false } }
            ]
        });
        expect(emittedEvents).toContain('discoveriesStateUpdated');
    });

    it('castSpell: Z と指定文字のキーシーケンスを実行すること', async () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        mockCore.driver = { queueSequence: vi.fn() };
        plugin.attach(mockCore);

        await plugin.castSpell('a');
        expect(mockCore.driver.queueSequence).toHaveBeenCalledWith(['Z', 'a'], expect.anything());
    });

    it('enhanceSkill: #enhance シーケンスを実行すること', async () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        mockCore.driver = { queueSequence: vi.fn() };
        plugin.attach(mockCore);

        await plugin.enhanceSkill('b');
        expect(mockCore.driver.queueSequence).toHaveBeenCalledWith(['#', 'enhance', '\r', 'b'], expect.anything());
    });

    it('setLanguage: 表示言語の切り替えが各サブマネージャーに正しく同期・反映されること', () => {
        const plugin = new GKLPlugin({ language: 'ja' });
        const mockCore = createMockCore();
        mockCore.language = 'ja';
        plugin.attach(mockCore);

        expect(plugin.language).toBe('ja');
        expect(plugin.situationCache.language).toBe('ja');
        expect(plugin.structuredKnowledge.language).toBe('ja');

        // core の languageChanged イベントで自動追従
        mockCore.emit('languageChanged', { language: 'en', enabled: false });
        expect(plugin.language).toBe('en');
        expect(plugin.situationCache.language).toBe('en');
        expect(plugin.structuredKnowledge.language).toBe('en');

        // plugin.setLanguage で手動切り替え
        plugin.setLanguage('ja');
        expect(plugin.language).toBe('ja');
        expect(plugin.situationCache.language).toBe('ja');
        expect(plugin.structuredKnowledge.language).toBe('ja');
    });

    it('MonsterTracker 連携: status_update (BL_TIME / BL_DLEVEL) および userActionSent でターン同期・階層変更が機能すること', () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        plugin.attach(mockCore);

        const tracker = plugin.getMonsterTracker();
        expect(tracker).toBeDefined();

        // 1. print_glyph でモンスター視認
        mockCore.emit('print_glyph', { x: 10, y: 10, glyph: 10, glyphInfo: { name: 'cockatrice', nameJa: 'コカトリス' } });
        expect(tracker.getTrackedMonsters().length).toBe(1);

        // 2. status_update (field: 16 / BL_TIME) でターン進行
        mockCore.emit('status_update', { field: 16, value: 50 });
        expect(tracker.getCurrentTurn()).toBe(50);

        // 3. userActionSent での自律ターン進行 (BL_TIME 非送信時フォールバック)
        mockCore.emit('userActionSent', { sequence: ['k'] }); // 移動キー
        expect(tracker.getCurrentTurn()).toBe(51);

        // 4. messageText による撃破消滅
        mockCore.emit('messageText', { text: 'You kill the cockatrice!' });
        expect(tracker.getTrackedMonsters().length).toBe(0);

        // 5. status_update (field: 20 / BL_DLEVEL) で階層移動時のクリア
        tracker.updateVisibleMonster(12, 12, 10, { name: 'cockatrice' });
        expect(tracker.getTrackedMonsters().length).toBe(1);
        mockCore.emit('status_update', { field: 20, value: 'Dlvl:2' });
        expect(tracker.getTrackedMonsters().length).toBe(0);
    });

    it('invalidateAllCaches: インベントリ・魔法・スキルの全キャッシュを安全に一括破棄できること', () => {
        const plugin = new GKLPlugin();
        plugin.inventoryStateManager.items = [{ name: 'dagger' }];
        plugin.spellStateManager.spells = [{ name: 'force bolt' }];
        plugin.skillStateManager.skills = [{ name: 'dagger' }];

        plugin.invalidateAllCaches();

        expect(plugin.inventoryStateManager.isSynced).toBe(false);
        expect(plugin.spellStateManager.isSynced).toBe(false);
        expect(plugin.skillStateManager.isSynced).toBe(false);
    });

    it('userActionSent: 射撃 (f) や投擲 (t) では spellStateManager は invalidate されず、詠唱 (Z) や読書 (r) でのみ invalidate されること', () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        plugin.attach(mockCore);

        plugin.inventoryStateManager.isSynced = true;
        plugin.spellStateManager.isSynced = true;

        // 1. 射撃 ['f', 'DIR_E'] -> インベントリは invalidate されるが、魔法ステートは同期済みのまま
        mockCore.emit('userActionSent', { sequence: ['f', 'DIR_E'] });
        expect(plugin.inventoryStateManager.isSynced).toBe(false);
        expect(plugin.spellStateManager.isSynced).toBe(true);

        // 2. 投擲 ['t', 'a', 'DIR_W'] -> 魔法ステートは同期済みのまま
        plugin.inventoryStateManager.isSynced = true;
        mockCore.emit('userActionSent', { sequence: ['t', 'a', 'DIR_W'] });
        expect(plugin.inventoryStateManager.isSynced).toBe(false);
        expect(plugin.spellStateManager.isSynced).toBe(true);

        // 3. 詠唱 ['Z', 'a', 'DIR_S'] -> 魔法ステートが invalidate される
        mockCore.emit('userActionSent', { sequence: ['Z', 'a', 'DIR_S'] });
        expect(plugin.spellStateManager.isSynced).toBe(false);

        // 4. 読書 ['r', 'b'] -> 魔法ステートが invalidate される
        plugin.spellStateManager.isSynced = true;
        mockCore.emit('userActionSent', { sequence: ['r', 'b'] });
        expect(plugin.spellStateManager.isSynced).toBe(false);
    });

    it('detach: detach 呼び出し時に登録した全リスナーが解除され core が null になること', () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        mockCore.off = vi.fn();

        plugin.attach(mockCore);
        expect(plugin.core).toBe(mockCore);
        expect(plugin._coreListeners.length).toBeGreaterThan(0);

        plugin.detach();
        expect(plugin.core).toBeNull();
        expect(plugin._coreListeners.length).toBe(0);
        expect(mockCore.off).toHaveBeenCalled();
    });

    it('フロア移動時 (clear_nhwindow -> print_glyph -> status_update) に前フロアの階段キャッシュが新フロアに漏洩しないこと', () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        plugin.attach(mockCore);

        // 1. Dlvl:1 で (18, 12) に下り階段を発見
        mockCore.emit('status_update', { field: 20, value: 'Dlvl:1' });
        mockCore.emit('print_glyph', { x: 18, y: 12, glyph: 3999 }); // 下り階段
        expect(plugin.areaStateManager.grid[12][18].bottom).not.toBeNull();
        expect(plugin.areaStateManager.grid[12][18].bottom.cmapFlags.isStairDown).toBe(true);

        // 2. 階段を降りて Dlvl:2 へ移動: NetHack はまず clear_nhwindow を発火
        mockCore.emit('clear_nhwindow', { windowId: 2 });
        // この時点でグリッドはリセットされ、旧フロアの階段が展開されていないこと
        expect(plugin.areaStateManager.grid[12][18].bottom).toBeNull();

        // 3. Dlvl:2 の初期位置 (5, 5) のみ print_glyph が届く (18, 12 は未探索マス)
        mockCore.emit('print_glyph', { x: 5, y: 5, glyph: 3998 }); // 上り階段

        // 4. 遅れて status_update で Dlvl:2 が届く
        mockCore.emit('status_update', { field: 20, value: 'Dlvl:2' });

        // Dlvl:2 の (18, 12) は null のままであり、前フロア (Dlvl:1) の階段が残留していないこと
        expect(plugin.areaStateManager.grid[12][18].bottom).toBeNull();
        // Dlvl:2 の (5, 5) には上り階段が正しく登録されていること
        expect(plugin.areaStateManager.grid[5][5].bottom).not.toBeNull();
        expect(plugin.areaStateManager.grid[5][5].bottom.cmapFlags.isStairUp).toBe(true);

        // 5. 再び Dlvl:1 に戻った場合 (clear_nhwindow -> status_update: Dlvl:1)
        mockCore.emit('clear_nhwindow', { windowId: 2 });
        mockCore.emit('status_update', { field: 20, value: 'Dlvl:1' });

        // Dlvl:1 の既知階段 (18, 12) が正しく自動復元されること
        expect(plugin.areaStateManager.grid[12][18].bottom).not.toBeNull();
        expect(plugin.areaStateManager.grid[12][18].bottom.cmapFlags.isStairDown).toBe(true);
    });

    it('status_update (BL_DLEVEL) で dlevelData を用いてブランチ名付きフロアキーに正確に同期すること', () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        plugin.attach(mockCore);

        // dlevelData を含む status_update
        mockCore.emit('status_update', {
            field: 20,
            value: '3',
            dlevelData: { branch: 'Minetown', dlevelNum: 3, dlevelStr: 'Minetown:3' }
        });

        expect(plugin.areaStateManager.currentFloor).toBe('Minetown:3');

        // 階段を記録
        mockCore.emit('print_glyph', { x: 10, y: 15, glyph: 4002 }); // 分岐上り階段
        expect(plugin.areaStateManager.stairCache.has('Minetown:3:10,15')).toBe(true);
    });

    it('restarted イベント受信時に過去セッションの階段・ランドマークキャッシュを完全に初期化すること', () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        plugin.attach(mockCore);

        // 階段をキャッシュ
        mockCore.emit('status_update', { field: 20, value: 'Dlvl:1' });
        mockCore.emit('print_glyph', { x: 10, y: 10, glyph: 3998 });
        expect(plugin.areaStateManager.stairCache.size).toBe(1);

        // restarted イベント送出
        mockCore.emit('restarted');

        // キャッシュがゼロクリアされていること
        expect(plugin.areaStateManager.stairCache.size).toBe(0);
        expect(plugin.areaStateManager.landmarkCache.size).toBe(0);
    });

    describe('Visual FX 演出トリガーイベント (fx_trigger) 発火機能', () => {
        it('HP減少時に DAMAGE_TAKEN イベントが正しく発行されること', () => {
            const plugin = new GKLPlugin();
            const mockCore = createMockCore();
            const fxListener = vi.fn();
            mockCore.on('fx_trigger', fxListener);
            plugin.attach(mockCore);

            // プレイヤー位置設定 (10, 5)
            mockCore.emit('curs', { x: 10, y: 5 });

            // 初期HP: 16 (初回登録はイベント発火しない)
            mockCore.emit('status_update', { field: 18, value: 16 });
            mockCore.emit('status_update', { field: 19, value: 16 }); // maxHp: 16
            expect(fxListener).not.toHaveBeenCalled();

            // 被弾して HP: 12 (-4)
            mockCore.emit('status_update', { field: 18, value: 12 });
            expect(fxListener).toHaveBeenCalledTimes(1);
            const payload = fxListener.mock.calls[0][0];
            expect(payload.type).toBe('DAMAGE_TAKEN');
            expect(payload.targetX).toBe(10);
            expect(payload.targetY).toBe(5);
            expect(payload.amount).toBe(4);
            expect(payload.currentHp).toBe(12);
            expect(payload.maxHp).toBe(16);
            expect(typeof payload.timestamp).toBe('number');
        });

        it('HP回復時に RECOVER_HEAL イベントが正しく発行されること', () => {
            const plugin = new GKLPlugin();
            const mockCore = createMockCore();
            const fxListener = vi.fn();
            mockCore.on('fx_trigger', fxListener);
            plugin.attach(mockCore);

            mockCore.emit('curs', { x: 10, y: 5 });
            mockCore.emit('status_update', { field: 18, value: 8 });
            mockCore.emit('status_update', { field: 19, value: 20 });
            expect(fxListener).not.toHaveBeenCalled();

            // 回復して HP: 14 (+6)
            mockCore.emit('status_update', { field: 18, value: 14 });
            expect(fxListener).toHaveBeenCalledTimes(1);
            const payload = fxListener.mock.calls[0][0];
            expect(payload.type).toBe('RECOVER_HEAL');
            expect(payload.targetX).toBe(10);
            expect(payload.targetY).toBe(5);
            expect(payload.amount).toBe(6);
            expect(payload.currentHp).toBe(14);
            expect(payload.maxHp).toBe(20);
        });

        it('隣接モンスターへの移動操作時に ATTACK_HIT イベントが正しく発行されること', () => {
            const plugin = new GKLPlugin();
            const mockCore = createMockCore();
            const fxListener = vi.fn();
            mockCore.on('fx_trigger', fxListener);
            plugin.attach(mockCore);

            // プレイヤー位置 (10, 5)
            mockCore.emit('curs', { x: 10, y: 5 });
            // 東マス (11, 5) にモンスター (glyph 100) を配置
            mockCore.emit('print_glyph', { x: 11, y: 5, glyph: 100 });

            // 東方向 ('l' または 'DIR_E') へのアクション送信
            mockCore.emit('userActionSent', { sequence: ['l'] });

            expect(fxListener).toHaveBeenCalledTimes(1);
            const payload = fxListener.mock.calls[0][0];
            expect(payload.type).toBe('ATTACK_HIT');
            expect(payload.targetX).toBe(11);
            expect(payload.targetY).toBe(5);
            expect(typeof payload.timestamp).toBe('number');
        });

        it('ペット (PET) がいるマスへの移動操作時は ATTACK_HIT が発火しないこと (位置入れ替え)', () => {
            const plugin = new GKLPlugin();
            const mockCore = createMockCore();
            const fxListener = vi.fn();
            mockCore.on('fx_trigger', fxListener);
            plugin.attach(mockCore);

            // プレイヤー位置 (10, 5)
            mockCore.emit('curs', { x: 10, y: 5 });
            // 東マス (11, 5) にペット (PET) を配置 (GLYPH_PET_OFF = 766)
            mockCore.emit('print_glyph', { x: 11, y: 5, glyph: 766, glyphInfo: { isPet: true } });

            // 東方向 ('l') への移動操作
            mockCore.emit('userActionSent', { sequence: ['l'] });

            // ペットとの位置入れ替えなので ATTACK_HIT は発火しないこと
            expect(fxListener).not.toHaveBeenCalled();
        });

        it('executeAction による攻撃アクション実行時に ATTACK_HIT が発行されること', () => {
            const plugin = new GKLPlugin();
            const mockCore = createMockCore();
            const fxListener = vi.fn();
            mockCore.on('fx_trigger', fxListener);
            plugin.attach(mockCore);

            mockCore.emit('curs', { x: 10, y: 5 });

            const attackAction = {
                id: 'ACTION_ATTACK_N',
                category: 'COMBAT',
                key: 'k',
                directionKey: 'DIR_N',
                targetPos: { x: 10, y: 4 }
            };

            plugin.executeAction(attackAction);

            expect(fxListener).toHaveBeenCalledTimes(1);
            const payload = fxListener.mock.calls[0][0];
            expect(payload.type).toBe('ATTACK_HIT');
            expect(payload.targetX).toBe(10);
            expect(payload.targetY).toBe(4);
        });

        it('撃破メッセージ受信時に KILL_CONFIRMED イベントが発行されること', () => {
            const plugin = new GKLPlugin();
            const mockCore = createMockCore();
            const fxListener = vi.fn();
            mockCore.on('fx_trigger', fxListener);
            plugin.attach(mockCore);

            // モンスターを (12, 6) に登録
            mockCore.emit('print_glyph', { x: 12, y: 6, glyph: 100, glyphInfo: { name: 'jackal', nameJa: 'ジャッカル' } });

            // 撃破メッセージ受信
            mockCore.emit('messageText', { text: 'You kill the jackal!' });

            expect(fxListener).toHaveBeenCalledTimes(1);
            const payload = fxListener.mock.calls[0][0];
            expect(payload.type).toBe('KILL_CONFIRMED');
            expect(payload.targetX).toBe(12);
            expect(payload.targetY).toBe(6);
        });

        it('isNonItemSequence: 「s」(捜索)、「20s」、「^P」、「v」等の安全な非アイテムコマンドで invalidate() が呼ばれないこと', () => {
            const plugin = new GKLPlugin();
            const mockCore = createMockCore();
            plugin.inventoryStateManager = {
                isSynced: true,
                invalidate: vi.fn()
            };
            plugin.attach(mockCore);

            // 's' (search)
            mockCore.emit('userActionSent', { sequence: ['s'] });
            expect(plugin.inventoryStateManager.invalidate).not.toHaveBeenCalled();

            // '20s' (count + search)
            mockCore.emit('userActionSent', { sequence: ['2', '0', 's'] });
            expect(plugin.inventoryStateManager.invalidate).not.toHaveBeenCalled();

            // '^P' (\x10 / prev message)
            mockCore.emit('userActionSent', { sequence: ['\x10'] });
            expect(plugin.inventoryStateManager.invalidate).not.toHaveBeenCalled();

            // 'v' (version)
            mockCore.emit('userActionSent', { sequence: ['v'] });
            expect(plugin.inventoryStateManager.invalidate).not.toHaveBeenCalled();

            // 'd' (drop) -> invalidate されること
            mockCore.emit('userActionSent', { sequence: ['d'] });
            expect(plugin.inventoryStateManager.invalidate).toHaveBeenCalledTimes(1);
        });

        it('syncInventorySilent: 差分がない場合は inventoryStateUpdated を発火せず、force=true時は発火すること', async () => {
            const plugin = new GKLPlugin();
            const mockCore = createMockCore();
            const invUpdatedListener = vi.fn();
            mockCore.on('inventoryStateUpdated', invUpdatedListener);
            plugin.attach(mockCore);

            // 1回目の同期 (アイテムあり)
            mockCore.querySequenceSilent.mockResolvedValue([
                { menuItems: [{ letter: 'a', text: 'a dagger', glyph: 3700, onum: 200 }] }
            ]);
            const res1 = await plugin.syncInventorySilent();
            expect(res1).toBe(true);
            expect(invUpdatedListener).toHaveBeenCalledTimes(1);
            expect(plugin.silentSyncTracker.totalCount).toBe(1);
            expect(plugin.silentSyncTracker.syncCounts.inventory).toBe(1);
            expect(plugin.silentSyncTracker.recentHistory[0].changed).toBe(true);

            // 2回目の同期 (同一アイテム -> 差分なし)
            invUpdatedListener.mockClear();
            const res2 = await plugin.syncInventorySilent();
            expect(res2).toBe(true);
            expect(invUpdatedListener).not.toHaveBeenCalled(); // 差分なしのため emit スキップ
            expect(plugin.silentSyncTracker.totalCount).toBe(2);
            expect(plugin.silentSyncTracker.recentHistory[0].changed).toBe(false);

            // 3回目の同期 (force: true -> 差分なしでも emit)
            invUpdatedListener.mockClear();
            const res3 = await plugin.syncInventorySilent({ force: true });
            expect(res3).toBe(true);
            expect(invUpdatedListener).toHaveBeenCalledTimes(1);
        });

        it('emitFxTrigger: messageText での死亡メッセージ検知時に PLAYER_DIED を発火すること', () => {
            const plugin = new GKLPlugin();
            const mockCore = createMockCore();
            const fxListener = vi.fn();
            mockCore.on('fx_trigger', fxListener);
            plugin.attach(mockCore);

            // プレイヤー座標設定
            plugin.areaStateManager.updatePlayerPosition(15, 8);

            // 死亡メッセージ受信 (EN)
            mockCore.emit('messageText', { text: 'You die...  --More--' });
            expect(fxListener).toHaveBeenCalledWith(expect.objectContaining({
                type: 'PLAYER_DIED',
                targetX: 15,
                targetY: 8,
                isPlayer: true,
                text: 'You die...  --More--'
            }));

            // 死亡メッセージ受信 (JA)
            fxListener.mockClear();
            mockCore.emit('messageText', { text: 'あなたは死んだ。' });
            expect(fxListener).toHaveBeenCalledWith(expect.objectContaining({
                type: 'PLAYER_DIED',
                targetX: 15,
                targetY: 8,
                isPlayer: true
            }));
        });

        it('emitFxTrigger: 命の魔除けによる蘇生メッセージ検知時に PLAYER_RESURRECTED を発火すること', () => {
            const plugin = new GKLPlugin();
            const mockCore = createMockCore();
            const fxListener = vi.fn();
            mockCore.on('fx_trigger', fxListener);
            plugin.attach(mockCore);

            plugin.areaStateManager.updatePlayerPosition(20, 10);

            // 死亡 -> 蘇生
            mockCore.emit('messageText', { text: 'You die...' });
            expect(fxListener).toHaveBeenCalledWith(expect.objectContaining({
                type: 'PLAYER_DIED'
            }));

            fxListener.mockClear();
            mockCore.emit('messageText', { text: 'But wait! Your amulet shines with a brilliant light!' });
            expect(fxListener).toHaveBeenCalledWith(expect.objectContaining({
                type: 'PLAYER_RESURRECTED',
                targetX: 20,
                targetY: 10,
                isPlayer: true
            }));
        });
    });

    describe('AssistState and Landmark Integration', () => {
        it('getAssistState: 瀕死かつ回復薬所持時に CURE Stance の AssistState を取得できること', () => {
            const plugin = new GKLPlugin();
            plugin.statusAccessor.updateField(18, 5);  // HP: 5
            plugin.statusAccessor.updateField(19, 30); // HPMAX: 30
            plugin.inventoryStateManager.items = [
                { invlet: 'a', name: 'potion of extra healing', category: 'POTION' }
            ];

            const assistState = plugin.getAssistState();
            expect(assistState).toBeDefined();
            expect(assistState.primarySignal).toBeDefined();
            expect(assistState.primarySignal.stance).toBe('CURE');
            expect(assistState.primarySignal.priority).toBe(85);
            expect(assistState.primaryAction.keySequence).toEqual(['q', 'a']);
            expect(assistState.slotBadges['a']).toBeDefined();

            // getSituation() にも assistState と landmarks が含まれること
            const situation = plugin.getSituation();
            expect(situation.assistState).toBeDefined();
            expect(situation.assistState.primarySignal.stance).toBe('CURE');
            expect(situation.landmarks).toBeDefined();
        });

        it('getFloorLandmarks / getAllLandmarks: フロア設備台帳を取得できること', () => {
            const plugin = new GKLPlugin();
            plugin.areaStateManager.setCurrentFloor('Dlvl:2');
            plugin.areaStateManager.updateGlyph(10, 10, 4013); // 流し台 (4013)
            plugin.areaStateManager.updateGlyph(15, 10, 4008); // 祭壇中立 (4008)

            const summary = plugin.getFloorLandmarks('Dlvl:2');
            expect(summary).toBeDefined();
            expect(summary.sinks.length).toBe(1);
            expect(summary.altars.length).toBe(1);

            const all = plugin.getAllLandmarks();
            expect(all.length).toBe(2);
        });
    });

    describe('AC Change and Inventory Synchronization Trigger', () => {
        it('status_update (BL_AC = 14) の初回受信時は invalidate されず、値の変化時に inventoryStateManager.invalidate が呼ばれること', () => {
            const plugin = new GKLPlugin();
            const mockCore = createMockCore();
            plugin.attach(mockCore);

            const invalidateSpy = vi.spyOn(plugin.inventoryStateManager, 'invalidate');

            // 1. 初回 AC 受信 (例: AC 10) -> 初回登録のため invalidate は呼ばれない
            mockCore.emit('status_update', { field: 14, value: 10 });
            expect(invalidateSpy).not.toHaveBeenCalled();

            // 2. 同一 AC の連続受信 (AC 10) -> 変化なしのため呼ばれない
            mockCore.emit('status_update', { field: 14, value: 10 });
            expect(invalidateSpy).not.toHaveBeenCalled();

            // 3. 防具装着/盗難等で AC が 6 に変化 -> invalidate が呼ばれる
            mockCore.emit('status_update', { field: 14, value: 6 });
            expect(invalidateSpy).toHaveBeenCalledTimes(1);

            // 4. 文字列形式 "AC:8" や "8" での変化にも対応すること
            mockCore.emit('status_update', { field: 'ac', value: 'AC:8' });
            expect(invalidateSpy).toHaveBeenCalledTimes(2);

            // 5. reset() 実行後は _prevAc がリセットされ、次の受信は初回として扱われること
            plugin.reset();
            invalidateSpy.mockClear();
            mockCore.emit('status_update', { field: 14, value: 8 });
            expect(invalidateSpy).not.toHaveBeenCalled();

            // 再度 AC が変化した場合は invalidate されること
            mockCore.emit('status_update', { field: 14, value: 5 });
            expect(invalidateSpy).toHaveBeenCalledTimes(1);
        });

        it('Phase 2: MonsterTracker と連動して窃盗敵の監視外れ（テレポート・逃走等）時に inventoryStateManager.invalidate が呼ばれること', () => {
            const plugin = new GKLPlugin();
            const mockCore = createMockCore();
            plugin.attach(mockCore);

            const invalidateSpy = vi.spyOn(plugin.inventoryStateManager, 'invalidate');

            // プレイヤー位置を (10, 10) に設定
            plugin.areaStateManager.playerX = 10;
            plugin.areaStateManager.playerY = 10;
            plugin.monsterTracker.handlePlayerPosition(10, 10);

            // ニンフ (monOffset: 67, stealsItems: true) が隣接マス (10, 11) に出現
            plugin.monsterTracker.updateVisibleMonster(10, 11, 67, { monOffset: 67, name: 'wood nymph' });
            expect(invalidateSpy).not.toHaveBeenCalled(); // 交戦中は即座に invalidate しない

            // ニンフがアイテムを盗んでテレポート（視界外れ）
            plugin.monsterTracker.notifyCellLostMonster(10, 11);

            // 監視外れを検知して自動的に invalidate() が呼ばれること
            expect(invalidateSpy).toHaveBeenCalledTimes(1);
            expect(plugin.inventoryStateManager.isSynced).toBe(false);
        });
    });
});

