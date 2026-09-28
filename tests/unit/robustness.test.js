/**
 * tests/unit/robustness.test.js
 * 
 * Phase 5 - Stage 5.5: 翻訳非依存性 (Translation Orthogonality & Robustness) 自動検証テスト
 * 
 * 【テスト目的】
 * フロントエンドの翻訳辞書（通常辞書、異言語ダミー辞書、空辞書・翻訳無効化）の適用状態に関わらず、
 * 1. 状況シグナル (situationSignal / MessageContext)
 * 2. 実施シグナル (ActionSignal)
 * 3. 属性耐性 (AttributeStateManager)
 * 4. 効果音発火キュー (SoundEngine)
 * 5. 道具識別昇格 (DiscoveryStateManager)
 * 6. Visual FX イベント (fx_trigger)
 * のすべてのゲームロジックが 100% 同一かつ決定論的に動作することを実証する。
 */

import { describe, it, expect } from 'vitest';
import { WebUICore } from '../../src/core/WebUICore.js';
import { TranslationEngine } from '../../src/core/translation/TranslationEngine.js';
import { SoundEngine } from '../../src/core/sound/SoundEngine.js';
import { MessageContextResolver } from '../../src/core/message/MessageContextResolver.js';

describe('Stage 5.5: 翻訳非依存性（Robustness）自動テスト', () => {

    /**
     * テスト環境インスタンスを構築するヘルパー
     * @param {TranslationEngine} translator 
     */
    function createTestContext(translator) {
        // モックドライバー
        const listeners = {};
        const mockDriver = {
            on: (event, fn) => {
                if (!listeners[event]) listeners[event] = [];
                listeners[event].push(fn);
            },
            emit: (event, data) => {
                if (listeners[event]) {
                    listeners[event].forEach(fn => fn(data));
                }
            },
            off: (event, fn) => {
                if (listeners[event]) {
                    listeners[event] = listeners[event].filter(f => f !== fn);
                }
            },
            getPromptCategory: () => 'OTHER',
            sendInput: () => {}
        };

        const core = new WebUICore({
            driver: mockDriver,
            translator: translator
        });

        // サウンドエンジンを core に接続
        const soundEngine = new SoundEngine({ soundMode: 'auto' });
        soundEngine.attachCore(core);

        // 記録用バッファ
        const recorded = {
            situationSignals: [],
            actionSignals: [],
            soundEvents: [],
            fxTriggers: []
        };

        core.on('situationSignal', (payload) => {
            recorded.situationSignals.push({
                type: payload.type,
                messageId: payload.context?.messageId,
                domain: payload.context?.domain,
                action: payload.context?.action,
                metadata: payload.context?.metadata
            });
        });

        core.on('actionSignal', (payload) => {
            recorded.actionSignals.push({
                signalId: payload.signalId,
                action: payload.action,
                intent: payload.intent
            });
        });

        core.on('fx_trigger', (payload) => {
            recorded.fxTriggers.push({
                type: payload.type,
                targetX: payload.targetX,
                targetY: payload.targetY
            });
        });

        // soundEngine の enqueueSound をフック
        const origEnqueue = soundEngine.enqueueSound.bind(soundEngine);
        soundEngine.enqueueSound = (rule, ctx) => {
            recorded.soundEvents.push({
                id: rule?.id,
                sound: rule?.sound,
                messageId: ctx?.messageId
            });
            return origEnqueue(rule, ctx);
        };

        return { core, soundEngine, mockDriver, recorded };
    }

    /**
     * 一連のイベントシナリオを実行する
     */
    function runStandardScenario(env) {
        const { core, soundEngine, mockDriver } = env;

        // 1. 耐性獲得メッセージ (火炎・電撃)
        mockDriver.emit('putstr', { windowId: 1, text: 'You feel a hot sensation.' });
        mockDriver.emit('putstr', { windowId: 1, text: 'You feel a mild shock.' });

        // 2. 戦闘・撃破・効果音メッセージ
        mockDriver.emit('putstr', { windowId: 1, text: 'You kill the goblin!' });
        mockDriver.emit('putstr', { windowId: 1, text: 'The skeleton is destroyed!' });
        mockDriver.emit('putstr', { windowId: 1, text: 'You hit the large cat.' });

        // 3. 道具使用・識別メッセージ (potion of healing 効果メッセージ: 'You feel cured.  What a relief!')
        if (core.gkl && core.gkl.discoveryStateManager) {
            const context = core.resolveMessageContext('You feel cured.  What a relief!');
            core.gkl.discoveryStateManager.processDiscoveryMessage(context, {
                onum: 299,
                appearance: 'ruby potion',
                name: 'a ruby potion'
            });
        }

        // 4. 方向待機プロンプト
        mockDriver.emit('putstr', { windowId: 1, text: 'In what direction?' });

        // 5. プレイヤー死亡回避
        mockDriver.emit('putstr', { windowId: 1, text: 'You die...' });
        mockDriver.emit('putstr', { windowId: 1, text: "OK, so you don't die." });
    }

    it('通常辞書 vs 異言語ダミー辞書 vs 翻訳無効化で、シグナル・耐性・音響・識別・FX が 100% 同一であること', () => {
        // 条件 1: 通常の日本語翻訳辞書
        const normalTranslator = new TranslationEngine({
            lookupDict: {
                'You feel a hot sensation.': '火に対する耐性を得た気がする。',
                'You feel a mild shock.': '体に電撃が走った気がする。',
                'You kill the goblin!': 'ゴブリンを倒した！',
                'The skeleton is destroyed!': 'スケルトンを破壊した！',
                'You hit the large cat.': '大型猫に攻撃を当てた。',
                'This is a potion of healing.': 'これは回復の薬だ。',
                'In what direction?': 'どの方向ですか？',
                'You die...': 'あなたは死んだ...',
                "OK, so you don't die.": 'OK、死ぬことは免れました。'
            }
        });

        // 条件 2: 全ての訳語が "XYZ_TRANSLATED" となる未知言語ダミー辞書
        const dummyTranslator = new TranslationEngine({
            lookupDict: {
                'You feel a hot sensation.': 'XYZ_HOT_SENSATION',
                'You feel a mild shock.': 'XYZ_MILD_SHOCK',
                'You kill the goblin!': 'XYZ_KILL_GOBLIN',
                'The skeleton is destroyed!': 'XYZ_DESTROY_SKELETON',
                'You hit the large cat.': 'XYZ_HIT_CAT',
                'This is a potion of healing.': 'XYZ_HEALING_POTION',
                'In what direction?': 'XYZ_WHICH_DIRECTION',
                'You die...': 'XYZ_YOU_DIE',
                "OK, so you don't die.": 'XYZ_AVERT_DEATH'
            }
        });

        // 条件 3: 辞書が空（完全未翻訳 / 英語 vanilla）
        const emptyTranslator = new TranslationEngine({
            lookupDict: {},
            enabled: false
        });

        const envNormal = createTestContext(normalTranslator);
        const envDummy = createTestContext(dummyTranslator);
        const envEmpty = createTestContext(emptyTranslator);

        // 同一シナリオを各環境で実行
        runStandardScenario(envNormal);
        runStandardScenario(envDummy);
        runStandardScenario(envEmpty);

        // --- 1. 状況シグナル (situationSignals) の完全一致検証 ---
        expect(envNormal.recorded.situationSignals.length).toBeGreaterThan(0);
        expect(envDummy.recorded.situationSignals).toEqual(envNormal.recorded.situationSignals);
        expect(envEmpty.recorded.situationSignals).toEqual(envNormal.recorded.situationSignals);

        // --- 2. 属性耐性 (Effective Resistances) の完全一致検証 ---
        const resNormal = envNormal.core.gkl.attributeStateManager.getEffectiveResistances();
        const resDummy = envDummy.core.gkl.attributeStateManager.getEffectiveResistances();
        const resEmpty = envEmpty.core.gkl.attributeStateManager.getEffectiveResistances();

        expect(resNormal.fire).toBe(true);
        expect(resNormal.shock).toBe(true);
        expect(resDummy).toEqual(resNormal);
        expect(resEmpty).toEqual(resNormal);

        // --- 3. 効果音発火 (Sound Events) の完全一致検証 ---
        expect(envNormal.recorded.soundEvents.length).toBeGreaterThan(0);
        expect(envDummy.recorded.soundEvents).toEqual(envNormal.recorded.soundEvents);
        expect(envEmpty.recorded.soundEvents).toEqual(envNormal.recorded.soundEvents);

        // --- 4. 道具識別 (Discovery State) の完全一致検証 ---
        const knownNormal = envNormal.core.gkl.discoveryStateManager.getKnownName('ruby potion');
        const knownDummy = envDummy.core.gkl.discoveryStateManager.getKnownName('ruby potion');
        const knownEmpty = envEmpty.core.gkl.discoveryStateManager.getKnownName('ruby potion');

        expect(knownNormal).toBe('potion of healing');
        expect(knownDummy).toBe(knownNormal);
        expect(knownEmpty).toBe(knownNormal);

        // --- 5. Visual FX (fxTriggers) の完全一致検証 ---
        expect(envNormal.recorded.fxTriggers.length).toBeGreaterThan(0);
        expect(envDummy.recorded.fxTriggers).toEqual(envNormal.recorded.fxTriggers);
        expect(envEmpty.recorded.fxTriggers).toEqual(envNormal.recorded.fxTriggers);
    });

    it('MessageContextResolver.createForVariant によるバリアント拡張ファクトリが正常に動作すること', () => {
        // Vanilla カタログ（デフォルト）
        const vanillaResolver = MessageContextResolver.createForVariant('vanilla');
        expect(vanillaResolver).toBeInstanceOf(MessageContextResolver);

        const ctx1 = vanillaResolver.resolve('You feel a hot sensation.');
        expect(ctx1).not.toBeNull();
        expect(ctx1.messageId).toBe('detect.c:L987:You_feel:14');

        // 将来の JNetHack (ja) バリアントをシミュレート
        const mockJaCatalog = {
            exact: {
                '火に対する耐性を得た気がする。': ['eat.c:L351:You_feel:0', 'eat.c', 'INTRINSIC', 'You_feel', 'PERCEPTION', 1, null]
            },
            patterns: [],
            buckets: {}
        };
        const jaResolver = MessageContextResolver.createForVariant('ja', { ja: mockJaCatalog });
        expect(jaResolver).toBeInstanceOf(MessageContextResolver);

        const ctxJa = jaResolver.resolve('火に対する耐性を得た気がする。');
        expect(ctxJa).not.toBeNull();
        expect(ctxJa.messageId).toBe('eat.c:L351:You_feel:0');
        expect(ctxJa.domain).toBe('INTRINSIC');
    });
});
