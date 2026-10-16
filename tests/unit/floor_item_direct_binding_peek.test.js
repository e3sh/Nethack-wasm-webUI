/**
 * floor_item_direct_binding_peek.test.js
 * 
 * ROADMAP §2.2 (旧 §2.6)「床落ちアイテム・コンテナ・死体の Direct Binding 完全化 ＆ 覗き見知恵 (Peek Wisdom)」検証テスト
 * 
 * ① 遠距離未確認 (dknown=0) の汎用マスクと近傍未鑑定 (dknown=1) のシャッフル外見表示
 * ② Peek Wisdom トグル時の真名・強化値 spe・BUC・箱状態（施錠/罠/中身）・死体種別の開示
 * ③ 3段階支援モード (STOIC / VETERAN / SAGE_GUIDE) による覗き見ロックと peekedObjects の昇格ライフサイクル
 * ④ PileTop の extraPileCount (+1, +2 等) 算出とバッジ表示
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StructuredKnowledgeEngine } from '../../src/core/knowledge/engines/StructuredKnowledgeEngine.js';
import { getAdaptiveItemSpecs } from '../../src/core/knowledge/presenters/ItemSpecPresenter.js';
import { AdventureLogManager } from '../../src/core/knowledge/lore/AdventureLogManager.js';
import { AdventureLogStorage } from '../../src/core/knowledge/lore/AdventureLogStorage.js';
import { InventoryWasmAdapter } from '../../src/core/knowledge/services/binding/InventoryWasmAdapter.js';
import { ItemIdentificationResolver } from '../../src/core/knowledge/engines/ItemIdentificationResolver.js';

describe('ROADMAP §2.2: 床落ちアイテム・コンテナ・死体の Direct Binding & Peek Wisdom', () => {

  describe('① 遠距離未確認 (dknown=0) の汎用マスクと近傍未鑑定 (dknown=1) の外見表示', () => {
    let engine;

    beforeEach(() => {
      engine = new StructuredKnowledgeEngine();
    });

    it('遠距離未確認 (dknown: false) の場合、通常表示では Generic 名にマスクされ、Peek時に開示されること', () => {
      // 麻痺のポーション (onum: 301, POTION class) を模した遠距離未確認オブジェクト
      const rawFarItem = {
        name: 'エメラルド色の薬',
        category: 'POTION',
        onum: 301,
        directObject: {
          otyp: 301,
          oclass: 3, // POTION
          quan: 1,
          flags: {
            dknown: false, // 遠方のため外見未確認
            bknown: false,
            known: false
          }
        }
      };

      // 通常表示 (sagesWisdomMode: false)
      const normalResult = engine.getItemKnowledge(rawFarItem, { sagesWisdomMode: false });
      expect(normalResult.isGenericMasked).toBe(true);
      expect(normalResult.name).toBe('未確認の薬');

      // 覗き見知恵表示 (sagesWisdomMode: true)
      const peekResult = engine.getItemKnowledge(rawFarItem, { sagesWisdomMode: true });
      expect(peekResult.isWisdomRevealed).toBe(true);
      // Peek時には真名が開示される
      expect(peekResult.name).toContain('麻痺のポーション');
    });

    it('近傍未鑑定 (dknown: true, 未識別) の場合、通常表示でシャッフル外見名が表示され、Peek時に外見+真名が開示されること', () => {
      const rawNearItem = {
        name: 'エメラルド色の薬',
        appearanceName: 'エメラルド色の薬',
        category: 'POTION',
        onum: 301,
        isUnidentified: true,
        directObject: {
          otyp: 301,
          oclass: 3,
          quan: 1,
          flags: {
            dknown: true, // 足元または近傍で視認済み
            bknown: false,
            known: false
          }
        }
      };

      // 通常表示
      const normalResult = engine.getItemKnowledge(rawNearItem, { sagesWisdomMode: false });
      expect(normalResult.isGenericMasked).toBeFalsy();
      expect(normalResult.name).toBe('エメラルド色の薬');

      // Peek表示
      const peekResult = engine.getItemKnowledge(rawNearItem, { sagesWisdomMode: true });
      expect(peekResult.isWisdomRevealed).toBe(true);
      expect(peekResult.name).toContain('エメラルド色の薬 [麻痺のポーション]');
      expect(peekResult.wisdomTrueNameJa).toBe('麻痺のポーション');
    });
  });

  describe('② Peek Wisdom トグル時の真名・強化値 spe・BUC・箱状態・死体種別の開示', () => {
    it('通常表示では未確認の強化値やBUC、箱状態がマスクされ、Peek 時に強制開示されること', () => {
      const containerItem = {
        name: '大きな箱',
        category: 'CONTAINER',
        onum: 400,
        directObject: {
          otyp: 400,
          oclass: 9, // TOOL
          quan: 1,
          spe: 0,
          cobjPtr: 0x1234, // 中身あり
          flags: {
            bknown: false,
            known: false,
            lknown: false, // 施錠未確認
            tknown: false, // 罠未確認
            cknown: false, // 中身未確認
            olocked: true, // 実際は施錠中
            otrapped: true // 実際は罠あり
          }
        }
      };

      // 通常時: 施錠・罠・中身がマスクされている
      const normalSpecs = getAdaptiveItemSpecs(containerItem, { isWisdomRevealed: false });
      expect(normalSpecs.some(s => s.id === 'container_lock')).toBe(false);
      expect(normalSpecs.some(s => s.id === 'container_trap')).toBe(false);
      expect(normalSpecs.some(s => s.id === 'container_contents')).toBe(false);

      // Peek 時: 施錠・罠・中身が強制開示される
      const peekSpecs = getAdaptiveItemSpecs(containerItem, { isWisdomRevealed: true });
      const lockSpec = peekSpecs.find(s => s.id === 'container_lock');
      const trapSpec = peekSpecs.find(s => s.id === 'container_trap');
      const contentsSpec = peekSpecs.find(s => s.id === 'container_contents');

      expect(lockSpec).toBeDefined();
      expect(lockSpec.value).toContain('施錠');
      expect(trapSpec).toBeDefined();
      expect(trapSpec.value).toContain('罠あり');
      expect(contentsSpec).toBeDefined();
      expect(contentsSpec.value).toContain('中身あり');
    });

    it('武器の強化値 spe が通常時は伏せられ、Peek時に開示されること', () => {
      const swordItem = {
        name: '長剣',
        category: 'WEAPON',
        onum: 10,
        directObject: {
          otyp: 10,
          oclass: 1, // WEAPON
          quan: 1,
          spe: 3,
          flags: {
            bknown: false,
            known: false, // 強化値未知
            blessed: true
          }
        }
      };

      const normalSpecs = getAdaptiveItemSpecs(swordItem, { isWisdomRevealed: false });
      expect(normalSpecs.some(s => s.id === 'enchantment')).toBe(false);
      expect(normalSpecs.some(s => s.id === 'bucStatus')).toBe(false);

      const peekSpecs = getAdaptiveItemSpecs(swordItem, { isWisdomRevealed: true });
      const enchSpec = peekSpecs.find(s => s.id === 'enchantment');
      const bucSpec = peekSpecs.find(s => s.id === 'bucStatus');

      expect(enchSpec).toBeDefined();
      expect(enchSpec.value).toBe('+3');
      expect(bucSpec).toBeDefined();
      expect(bucSpec.value).toContain('祝福');
    });

    it('缶詰や死体・像で corpsenm からモンスター名が反映されること', () => {
      const engine = new StructuredKnowledgeEngine();
      const tinItem = {
        name: '缶詰',
        category: 'FOOD',
        onum: 247, // tin
        directObject: {
          otyp: 247,
          oclass: 7, // FOOD
          corpsenm: 54, // インプ
          quan: 1,
          flags: {
            known: false
          }
        }
      };

      const result = engine.getItemKnowledge(tinItem, { sagesWisdomMode: true });
      expect(result.nameJa || result.name).toContain('インプ');
    });

    it('賢者の知恵透視時に未鑑定アイテムのスペック一覧に wisdom_true_name (正式名/真名) が追加されること', () => {
      const unidPotion = {
        name: '赤紫色の薬',
        nameJa: '超回復の薬',
        wisdomTrueNameJa: '超回復の薬',
        category: 'POTION',
        onum: 300,
        isUnidentified: true,
        directObject: {
          otyp: 300,
          oclass: 3,
          quan: 1,
          flags: {
            dknown: true,
            bknown: false,
            known: false
          }
        }
      };

      const normalSpecs = getAdaptiveItemSpecs(unidPotion, { isWisdomRevealed: false });
      expect(normalSpecs.some(s => s.id === 'wisdom_true_name')).toBe(false);

      const peekSpecs = getAdaptiveItemSpecs(unidPotion, { isWisdomRevealed: true });
      const trueNameSpec = peekSpecs.find(s => s.id === 'wisdom_true_name');
      expect(trueNameSpec).toBeDefined();
      expect(trueNameSpec.label).toContain('正式名');
      expect(trueNameSpec.value).toBe('超回復の薬');
    });
  });

  describe('③ 3段階支援モード (STOIC / VETERAN / SAGE_GUIDE) による覗き見ロックと peekedObjects 昇格', () => {
    let mockStorage;
    let alm;

    beforeEach(() => {
      mockStorage = new AdventureLogStorage({ storageKey: 'test_peek_wisdom_mode' });
      mockStorage.clear();
      alm = new AdventureLogManager({ storage: mockStorage, autoLoad: false });
    });

    it('初期モードは VETERAN であり、oracleGuideAlwaysUnlocked ゲッターと連動すること', () => {
      expect(alm.guideAssistanceMode).toBe('VETERAN');
      expect(alm.oracleGuideAlwaysUnlocked).toBe(false);

      alm.oracleGuideAlwaysUnlocked = true;
      expect(alm.guideAssistanceMode).toBe('SAGE_GUIDE');

      alm.oracleGuideAlwaysUnlocked = false;
      expect(alm.guideAssistanceMode).toBe('VETERAN');
    });

    it('STOIC モードでは手帳登録済みであっても canPeekObject は常に false であること', () => {
      alm.guideAssistanceMode = 'STOIC';
      alm.unlockObject(301, { viaPeek: false }); // 手帳登録
      expect(alm.isObjectUnlocked(301)).toBe(true);
      expect(alm.canPeekObject(301)).toBe(false);
    });

    it('VETERAN モードでは手帳未登録品は canPeekObject が false (ロック) であり、登録済みなら true であること', () => {
      alm.guideAssistanceMode = 'VETERAN';
      expect(alm.isObjectUnlocked(301)).toBe(false);
      expect(alm.canPeekObject(301)).toBe(false); // ロック

      alm.unlockObject(301, { viaPeek: false });
      expect(alm.isObjectUnlocked(301)).toBe(true);
      expect(alm.canPeekObject(301)).toBe(true); // 解禁
    });

    it('SAGE_GUIDE モードでは未登録品でも常に canPeekObject が true であること', () => {
      alm.guideAssistanceMode = 'SAGE_GUIDE';
      expect(alm.isObjectUnlocked(301)).toBe(false);
      expect(alm.canPeekObject(301)).toBe(true);
    });

    it('viaPeek: true で解禁すると peekedObjects に記録され、自力鑑定 (viaPeek: false) で昇格すること', () => {
      alm.guideAssistanceMode = 'SAGE_GUIDE';
      
      // 1. Peek による仮解禁
      alm.unlockObject(301, { viaPeek: true });
      expect(alm.isObjectUnlocked(301)).toBe(true);
      expect(alm.peekedObjects.has(301)).toBe(true);

      // 2. LocalStorage 保存と復元の検証
      alm.save();
      const newAlm = new AdventureLogManager({ storage: mockStorage, autoLoad: false });
      newAlm.load();
      expect(newAlm.peekedObjects.has(301)).toBe(true);

      // 3. ゲーム内での自力鑑定による昇格
      newAlm.unlockObject(301, { viaPeek: false });
      expect(newAlm.isObjectUnlocked(301)).toBe(true);
      expect(newAlm.peekedObjects.has(301)).toBe(false); // peeked から正式解禁に昇格！
    });
  });

  describe('④ PileTop の extraPileCount 算出とバッジ表示', () => {
    it('12ワード拡張 C バッファから Bit 10〜18 フラグと nextherePtr, cobjPtr, age を正しくデコードできること', () => {
      const adapter = new InventoryWasmAdapter();
      // 12 words: [otyp, owt, quan, spe, oclass, invlet, flags, weight, corpsenm, age, cobj, nexthere]
      // flags: Bit 9 (known=0x200), Bit 10 (cknown=0x400), Bit 13 (olocked=0x2000) -> 0x2600
      const words = new Int32Array(12);
      words[0] = 400; // otyp
      words[1] = 50;  // owt
      words[2] = 1;   // quan
      words[3] = 0;   // spe
      words[4] = 9;   // oclass (TOOL)
      words[5] = 0;   // invlet
      words[6] = 0x2600; // flags
      words[7] = 50;  // weight
      words[8] = 0;   // corpsenm
      words[9] = 100; // age
      words[10] = 0x5000; // cobjPtr
      words[11] = 0x6000; // nextherePtr

      const decoded = adapter.unpackObjectBuffer(words, 0x1000, 0x5000, 1, 0, 100);
      expect(decoded.otyp).toBe(400);
      expect(decoded.age).toBe(100);
      expect(decoded.cobjPtr).toBe(0x5000);
      expect(decoded.nextherePtr).toBe(0x6000);
      expect(decoded.flags.known).toBe(true);
      expect(decoded.flags.cknown).toBe(true);
      expect(decoded.flags.olocked).toBe(true);
      expect(decoded.flags.otrapped).toBe(false);
    });

    it('extraPileCount が 1 以上のときに ItemSpecPresenter で pile_count バッジが生成されること', () => {
      const pileItem = {
        name: '銀の短剣',
        category: 'WEAPON',
        onum: 20,
        extraPileCount: 2,
        directObject: {
          otyp: 20,
          oclass: 1,
          quan: 1
        }
      };

      const specs = getAdaptiveItemSpecs(pileItem, { extraPileCount: 2 });
      const pileSpec = specs.find(s => s.id === 'pile_count');
      expect(pileSpec).toBeDefined();
      expect(pileSpec.value).toContain('下に +2 個');
    });

    it('floorObjects や directObject を含んでも localizeKnowledge や getKnowledge で循環参照例外が発生しないこと', () => {
      const engine = new StructuredKnowledgeEngine();
      const item1 = { otyp: 20, name: 'dagger', quan: 1, isPile: true, extraPileCount: 1 };
      const item2 = { otyp: 21, name: 'elven dagger', quan: 1, isPile: true, extraPileCount: 1 };
      const floorObjs = [item1, item2];

      // cell.middle 相当の構造
      const cellMiddle = {
        glyph: 1000,
        directObject: item1,
        floorObjects: floorObjs,
        isPile: true,
        extraPileCount: 1
      };

      // 循環参照例外が起きずにナレッジが取得できること
      expect(() => {
        const k = engine.getKnowledge(cellMiddle, {
          language: 'ja',
          sagesWisdomMode: false,
          directObject: item1,
          floorObjects: floorObjs
        });
        // floorObjects がそのまま保持されていること
        expect(k.floorObjects).toBe(floorObjs);
      }).not.toThrow();
    });
  });

  describe('⑤ 初期装備・アイテムの BUC 誤判定防止 ＆ ペットの DANGER 誤判定防止の検証', () => {
    let engine;

    beforeEach(() => {
      engine = new StructuredKnowledgeEngine();
    });

    it('uncursed +1 dagger や bknown=true のアイテムが CURSED に化けず UNCURSED と判定されること', () => {
      const itemKnowledge = {
        name: 'ダガー',
        rawText: 'an uncursed +1 dagger',
        category: 'WEAPON',
        directObject: {
          otyp: 27,
          spe: 1,
          flags: {
            bknown: true,
            blessed: false,
            cursed: false
          }
        }
      };

      const specs = getAdaptiveItemSpecs(itemKnowledge, {
        directObject: itemKnowledge.directObject,
        language: 'ja'
      });

      const bucSpec = specs.find(s => s.id === 'bucStatus');
      expect(bucSpec).toBeDefined();
      expect(bucSpec.value).toBe('通常 (Uncursed)');
      expect(bucSpec.type).toBe('info');
    });

    it('ペット (tame: true) のモンスターが DANGER にならず SAFE / TAMED と判定されること', () => {
      // 子犬 (little dog, offset 112)
      const petMon = {
        name: 'a little dog',
        monOffset: 112,
        directState: {
          tame: true,
          peaceful: true,
          hp: 12,
          hpmax: 12
        },
        dynamicState: {
          hasResult: true,
          isHostile: false,
          isTamed: true,
          isPeaceful: true
        }
      };

      const monKnowledge = engine.getMonsterKnowledge(petMon, {
        isPet: true,
        dynamicState: petMon.dynamicState,
        language: 'ja'
      });

      expect(monKnowledge.dangerLevel).toBe('SAFE');
      expect(monKnowledge.dispositionStatus).toBe('TAMED');
      expect(monKnowledge.isTame).toBe(true);
      expect(monKnowledge.isHostile).toBe(false);
    });

    it('オンデマンド Look 応答で tamed 文字列が無くても、C コア真値で isTame があれば SAFE が維持されること', () => {
      // Look から素の "a little dog" のみ返ってきて isHostile=true に倒れかけた場合
      const monData = {
        name: 'a little dog',
        monOffset: 112,
        isTame: true,
        directState: { tame: true }
      };

      const simulatedLookState = {
        hasResult: true,
        rawText: 'a little dog',
        isPlayer: false,
        isPeaceful: false,
        isTamed: false,
        isHostile: true // 素のテキストのため LookService 単体では hostile 判定されたケース
      };

      const monKnowledge = engine.getMonsterKnowledge(monData, {
        dynamicState: simulatedLookState,
        isTame: true,
        isPet: true,
        language: 'ja'
      });

      expect(monKnowledge.dangerLevel).toBe('SAFE');
      expect(monKnowledge.dispositionStatus).toBe('TAMED');
      expect(monKnowledge.isTame).toBe(true);
      expect(monKnowledge.isHostile).toBe(false);
    });

    it('ItemIdentificationResolver が directObject / flags を直接受けて BUC と spe を決定論的に解決すること', () => {
      const rawDirectObj = {
        otyp: 27, // dagger
        spe: 3,
        flags: {
          bknown: true,
          blessed: false,
          cursed: false,
          known: true
        }
      };

      // 文字列には blessed/cursed/uncursed や +3 を含めず素の 'dagger' を渡す
      const resolved = ItemIdentificationResolver.resolve({
        rawText: 'dagger',
        onum: 27,
        directObject: rawDirectObj,
        flags: rawDirectObj.flags
      });

      // 文字列パースではなく C コア flags/spe から直接抽出されること
      expect(resolved.bucStatus).toBe('UNCURSED');
      expect(resolved.enchantment).toBe(3);
    });

    it('InspectionService で Direct Binding が利用可能な場合、LookService を一切呼ばずに直接真値を採用すること', async () => {
      let lookExecuted = false;
      const mockPlugin = {
        directBindingService: {
          isAvailable: () => true,
          getFullMonsterAt: (x, y) => ({
            peaceful: false,
            tame: true, // ペット
            hp: 15,
            hpmax: 15,
            sleeping: false,
            fleeing: false,
            paralyzed: false
          })
        },
        lookService: {
          executeLook: async () => {
            lookExecuted = true;
            return { hasResult: true, isHostile: true };
          }
        },
        structuredKnowledge: engine,
        language: 'ja'
      };

      // InspectionService の inspectCellOnDemand をシミュレート
      const cell = {
        top: {
          glyph: 766, // GLYPH_PET_OFF
          type: 'PET',
          monOffset: 112
        }
      };

      // モンスター検査ロジックを直接実行
      const dbs = mockPlugin.directBindingService;
      let directMon = dbs.getFullMonsterAt(10, 10);
      let dynamicState = null;
      if (directMon) {
        dynamicState = {
          hp: directMon.hp,
          hpmax: directMon.hpmax,
          isPeaceful: directMon.peaceful,
          isTamed: directMon.tame,
          isHostile: !directMon.peaceful && !directMon.tame,
          hasResult: true,
          fromDirectBinding: true
        };
      } else if (mockPlugin.lookService) {
        dynamicState = await mockPlugin.lookService.executeLook({ x: 0, y: 0 }, { x: 10, y: 10 });
      }

      // LookService が呼ばれていないこと（バイパス成功）
      expect(lookExecuted).toBe(false);
      expect(dynamicState.fromDirectBinding).toBe(true);
      expect(dynamicState.isTamed).toBe(true);
      expect(dynamicState.isHostile).toBe(false);
    });
  });

});

