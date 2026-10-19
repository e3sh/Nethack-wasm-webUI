/**
 * InventoryStateManager.js
 * 
 * プレイヤーのインベントリ（所持品）状態を管理・キャッシュし、
 * コンテキストアクションに必要なツール（ツルハシ・鍵・斧・杖等）の所持状況とインベントリレターを提供するマネージャー。
 */

import { GLYPH_OFFSETS, classifyGlyph, ENTITY_TYPES, getOnumFromGlyph, getItemInfoFromOnum } from "../engines/glyphClassifier.js";
import { OBJECT_KNOWLEDGE_MAP } from "../data/OBJECT_KNOWLEDGE_FULL.js";
import { MONSTER_KNOWLEDGE_MAP } from "../data/MONSTER_KNOWLEDGE_FULL.js";
import { getSkillProficiencyBadge } from "../presenters/ItemSpecPresenter.js";
import { ItemIdentificationResolver, IDENTIFICATION_LEVELS } from "../engines/ItemIdentificationResolver.js";
import { ActionRecipeFactory } from "../../request/ActionRecipeFactory.js";
import { ItemNormalizer } from "../models/ItemNormalizer.js";

export class InventoryStateManager {
    constructor(options = {}) {
        // 所持品アイテムのリスト
        // item: { letter: 'f', name: 'pick-axe', rawText: '...', glyphId: 3707, onum: 259, isPickAxe: true, knowledge: {...} }
        this.items = [];
        this.isSynced = false; // 一度でもインベントリを同期したかフラグ
        this._lastInventorySignature = ''; // 前回のインベントリシグネチャ（差分検知用）
        this.structuredKnowledgeEngine = options.structuredKnowledgeEngine || null;
        this.skillStateManager = options.skillStateManager || null;
        this.discoveryStateManager = options.discoveryStateManager || null;
        this.adventureLogManager = options.adventureLogManager || null;
        this.onAdventureLogUnlocked = options.onAdventureLogUnlocked || null;
        this.wasmDirectBindingService = options.wasmDirectBindingService || null;
        this.hasCompletedInitialSync = false;
        this.language = options.language || (this.structuredKnowledgeEngine && this.structuredKnowledgeEngine.language) || 'ja';
        this.sagesWisdomMode = Boolean(options.sagesWisdomMode);

        // 動作モード: DirectBinding Native (フォールバック撤廃・純化)
        this.directBindingMode = 'native';

        // 同期テレメトリ
        this.lastSyncMethod = 'SHIM';
        this.shimSyncCount = 0;
        this.macroSyncCount = 0;
    }

    /**
     * 🧙 賢者の知恵モード (Sage's Wisdom Mode) の設定
     * @param {boolean} enabled 
     */
    setSagesWisdomMode(enabled) {
        const prev = this.sagesWisdomMode;
        this.sagesWisdomMode = Boolean(enabled);
        if (prev !== this.sagesWisdomMode) {
            this._lastInventorySignature = '';
        }
    }

    /**
     * 動作モードの設定 (DirectBinding Native 化に伴い no-op 後方互換プロキシ)
     * @param {string} mode
     */
    setDirectBindingMode(mode) {
        this.directBindingMode = 'native';
    }

    setWasmDirectBindingService(service) {
        this.wasmDirectBindingService = service;
    }

    get isDirectBindingAvailable() {
        return Boolean(this.wasmDirectBindingService && this.wasmDirectBindingService.isAvailable());
    }

    setLanguage(lang = 'ja') {
        const prevLang = this.language;
        this.language = (lang === 'ja' || lang === 'jp' || lang === true) ? 'ja' : 'en';
        if (prevLang !== this.language) {
            this._lastInventorySignature = '';
        }
    }

    setStructuredKnowledgeEngine(ske) {
        this.structuredKnowledgeEngine = ske;
        if (ske && ske.language) {
            this.language = ske.language;
            this._lastInventorySignature = '';
        }
    }

    setSkillStateManager(sm) {
        this.skillStateManager = sm;
    }

    setDiscoveryStateManager(dsm) {
        this.discoveryStateManager = dsm;
    }

    setAdventureLogManager(alm) {
        this.adventureLogManager = alm;
    }

    /**
     * キャッシュのリセット
     */
    reset() {
        this.items = [];
        this.isSynced = false;
        this.hasCompletedInitialSync = false;
        this._lastInventorySignature = '';
    }

    /**
     * 所持品アイテム一覧の取得（CanonicalItem 保証）
     * @returns {import('../../../index').CanonicalItem[]}
     */
    getItems() {
        return (this.items || []).map(it => it._canonical ? it : ItemNormalizer.normalize(it, { source: 'INVENTORY' }));
    }

    /**
     * メニュー項目群から軽量なシグネチャ文字列を生成（差分検知用）
     * @private
     */
    _buildSignature(menuItems) {
        const lang = this.language || (this.structuredKnowledgeEngine && this.structuredKnowledgeEngine.language) || 'ja';
        if (!Array.isArray(menuItems) || menuItems.length === 0) {
            return `lang:${lang};;empty`;
        }
        const parts = menuItems.map(mi => {
            if (!mi) return '';
            const rawText = mi.rawStr || mi.str || mi.text || (typeof mi === 'string' ? mi : '');
            const rawCh = mi.charStr || mi.letter || mi.accelerator || mi.selector || mi.ch || '';
            const glyphId = typeof mi.glyph === 'number' ? mi.glyph : (mi.glyphInfo ? mi.glyphInfo.glyph : -1);
            const onum = typeof mi.onum === 'number' ? mi.onum : (mi.glyphInfo && typeof mi.glyphInfo.onum === 'number' ? mi.glyphInfo.onum : -1);
            return `${rawCh}:${rawText}:${glyphId}:${onum}`;
        });
        const discCount = (this.discoveryStateManager && this.discoveryStateManager.discoveredOnums) ? this.discoveryStateManager.discoveredOnums.size : 0;
        return `lang:${lang};;disc:${discCount};;` + parts.join('|');
    }

    /**
     * 自発同期(syncInventorySilent)等のメニュー項目からインベントリ全体を更新
     * @param {Array<Object>} menuItems - メニュー項目の配列
     * @returns {boolean} インベントリ内容に実質的な変更があったかどうか
     */
    updateFromMenuItems(menuItems) {
        if (!Array.isArray(menuItems)) return false;

        // C言語コアの最新識別メモリと即時同期
        if (this.discoveryStateManager && typeof this.discoveryStateManager.syncWithLiveMemory === 'function' && this.wasmDirectBindingService) {
            this.discoveryStateManager.syncWithLiveMemory(this.wasmDirectBindingService);
        }

        // strict モード時はマクロフォールバック（rawObjPtr を持たない純粋テキスト行）を完全遮断 (Stage 8.2-B)
        const hasDirectRawObjPtr = menuItems.some(mi => mi && ((mi.rawObjPtr && mi.rawObjPtr > 0) || (typeof mi.identifier === 'number' && mi.identifier > 0)));
        if (hasDirectRawObjPtr) {
            this.lastSyncMethod = 'SHIM';
            this.shimSyncCount++;
        } else {
            this.lastSyncMethod = 'MACRO';
            this.macroSyncCount++;
        }

        const newSignature = this._buildSignature(menuItems);
        if (this.isSynced && this._lastInventorySignature === newSignature) {
            // 前回のインベントリ内容と完全一致：再パース・ナレッジ再生成・再翻訳をスキップ
            return false;
        }

        const parsedItems = [];

        // 第1パス: アイテム基本情報のパースと分類
        menuItems.forEach(mi => {
            if (!mi) return;
            const rawText = mi.rawStr || mi.str || mi.text || (typeof mi === 'string' ? mi : '');
            if (!rawText) return;

            let letter = '';
            const rawCh = mi.charStr || mi.letter || mi.accelerator || mi.selector || mi.ch || 0;
            if (typeof rawCh === 'number' && rawCh > 0) {
                letter = String.fromCharCode(rawCh);
            } else if (typeof rawCh === 'string' && rawCh.length > 0) {
                letter = rawCh.trim();
            }

            if (!letter && rawText) {
                const match = rawText.match(/^([a-zA-Z])[\s\-\.\)]/);
                if (match) letter = match[1];
            }

            // 英字1文字のアイテムのみ有効なスロット項目としてパース
            if (letter && /^[a-zA-Z]$/.test(letter)) {
                const glyphId = typeof mi.glyph === 'number' ? mi.glyph : (mi.glyphInfo ? mi.glyphInfo.glyph : -1);
                let onum = typeof mi.onum === 'number' && mi.onum >= 0 ? mi.onum : (mi.glyphInfo && typeof mi.glyphInfo.onum === 'number' ? mi.glyphInfo.onum : -1);
                if (onum < 0 && glyphId >= 0) {
                    onum = getOnumFromGlyph(glyphId);
                }

                const categoryFlags = this.categorizeItem(rawText, glyphId, onum);
                const equipState = this.parseEquipState(rawText, categoryFlags);
                const lang = this.language || (this.structuredKnowledgeEngine && this.structuredKnowledgeEngine.language) || 'ja';
                const identification = ItemIdentificationResolver.resolve({
                    rawText,
                    onum,
                    glyphId
                }, {
                    discoveryStateManager: this.discoveryStateManager,
                    sagesWisdomMode: this.sagesWisdomMode,
                    language: lang
                });

                // 🎯 ナレッジ自動物理アタッチ (アイテム専用 getItemKnowledge を直接呼び出し、コンテキストを完全に維持)
                let knowledge = mi.knowledge || null;
                if (!knowledge && this.structuredKnowledgeEngine) {
                    const itemTarget = {
                        type: 'ITEM',
                        rawText,
                        onum,
                        glyph: glyphId,
                        identification
                    };
                    if (typeof this.structuredKnowledgeEngine.getItemKnowledge === 'function') {
                        knowledge = this.structuredKnowledgeEngine.getItemKnowledge(itemTarget, { language: lang, identification, sagesWisdomMode: this.sagesWisdomMode }) ||
                                    this.structuredKnowledgeEngine.getItemKnowledge((identification.isUnidentified && !this.sagesWisdomMode) ? rawText : (onum >= 0 ? onum : rawText), { language: lang, identification, sagesWisdomMode: this.sagesWisdomMode });
                    } else if (typeof this.structuredKnowledgeEngine.getKnowledge === 'function') {
                        knowledge = this.structuredKnowledgeEngine.getKnowledge(itemTarget, { language: lang, identification, sagesWisdomMode: this.sagesWisdomMode }) ||
                                    this.structuredKnowledgeEngine.getKnowledge((identification.isUnidentified && !this.sagesWisdomMode) ? rawText : (onum >= 0 ? onum : rawText), { language: lang, identification, sagesWisdomMode: this.sagesWisdomMode });
                    }
                }
                if (!knowledge && (!identification.isUnidentified || this.sagesWisdomMode) && onum >= 0 && OBJECT_KNOWLEDGE_MAP.has(onum)) {
                    knowledge = OBJECT_KNOWLEDGE_MAP.get(onum);
                }

                let skillBadge = null;
                if (knowledge && this.skillStateManager && (!identification.isUnidentified || this.sagesWisdomMode)) {
                    skillBadge = getSkillProficiencyBadge(knowledge, this.skillStateManager, { language: lang });
                }

                const rawObjPtr = mi.rawObjPtr || (typeof mi.identifier === 'number' ? mi.identifier : 0);

                // 🎯 装備スロット同定 (rawObjPtr があれば C側の uwep 等ポインタと最優先照合)
                let finalEquipState = equipState;
                if (rawObjPtr > 0 && this.wasmDirectBindingService && typeof this.wasmDirectBindingService.getEquipmentPtrs === 'function') {
                    const equipData = this.wasmDirectBindingService.getEquipmentPtrs();
                    if (equipData && equipData.slotByPtr) {
                        const equipSlotName = equipData.slotByPtr.get(rawObjPtr) || null;
                        if (equipSlotName) {
                            const isWielded = equipSlotName === 'weapon';
                            const isOffhand = equipSlotName === 'offhand';
                            const isQuivered = equipSlotName === 'quiver';
                            const isWorn = Boolean(!isWielded && !isOffhand && !isQuivered);
                            finalEquipState = {
                                ...equipState,
                                isWielded,
                                isOffhand,
                                isQuivered,
                                isWorn,
                                equipSlot: equipSlotName
                            };
                        }
                    }
                }

                parsedItems.push({
                    letter,
                    rawText,
                    glyphId,
                    onum,
                    identifier: (mi.identifier !== undefined ? mi.identifier : 0),
                    rawObjPtr,
                    weight: mi.weight !== undefined ? mi.weight : undefined,
                    owt: mi.owt !== undefined ? mi.owt : undefined,
                    quan: mi.quan !== undefined ? mi.quan : undefined,
                    spe: mi.spe !== undefined ? mi.spe : undefined,
                    oclass: mi.oclass !== undefined ? mi.oclass : undefined,
                    cobjPtr: mi.cobjPtr !== undefined ? mi.cobjPtr : (mi.directObject?.cobjPtr || 0),
                    o_id: mi.o_id !== undefined ? mi.o_id : (mi.directObject?.o_id || 0),
                    flags: mi.flags !== undefined ? mi.flags : undefined,
                    identification,
                    knowledge,
                    skillBadge,
                    isRecommendedWeapon: Boolean(skillBadge && skillBadge.isProficient && !identification.isUnidentified),
                    ...categoryFlags,
                    ...finalEquipState
                });
            }
        });

        // 第2パス: 全件コンテキストを踏まえたスマートアクション/推奨・副次的アクション判定
        if (parsedItems.length > 0) {
            // 武器スロットの正規化 (二刀流時: 2本ある場合は片方を副武器に正規化、単一の場合は左利き/右利き問わずメイン武器に維持)
            const wieldedWeapons = parsedItems.filter(i => i.isWielded);
            if (wieldedWeapons.length > 1) {
                wieldedWeapons[1].isWielded = false;
                wieldedWeapons[1].isOffhand = true;
                wieldedWeapons[1].equipSlot = 'offhand';
            }

            parsedItems.forEach(item => {
                const defaultAction = this.determineDefaultAction(
                    item.rawText,
                    item,
                    item,
                    item.letter,
                    parsedItems,
                    item
                );
                Object.assign(item, defaultAction);
                if (defaultAction.defaultActionRecipe) {
                    item.actionRecipe = defaultAction.defaultActionRecipe;
                }
            });
 
            const canonicalItems = parsedItems.map(item => ItemNormalizer.normalize(item, { source: 'INVENTORY', sagesWisdomMode: this.sagesWisdomMode }));
            this.items = canonicalItems;
            this.isSynced = true;
            this._lastInventorySignature = newSignature;
            this._syncWithAdventureLog(canonicalItems);
            this.hasCompletedInitialSync = true;
            return true;
        } else {
            const hadItems = this.items.length > 0;
            this.items = [];
            this.isSynced = true;
            this._lastInventorySignature = newSignature;
            this.hasCompletedInitialSync = true;
            return hadItems;
        }
    }

    /**
     * 識別済みインベントリアイテムを冒険手帳にアンロック
     * @private
     * @param {Array<Object>} items 
     */
    _syncWithAdventureLog(items) {
        if (!this.adventureLogManager) {
            return;
        }
        if (!Array.isArray(items) || items.length === 0) return;

        const isInitial = !this.hasCompletedInitialSync;
        const onumsToUnlock = [];

        for (const item of items) {
            if (!item || !item.identification) continue;
            // 未識別（isUnidentified === true）のアイテムは手帳アンロック対象外
            if (item.identification.isUnidentified) continue;

            let onum = typeof item.onum === 'number' && item.onum >= 0 ? item.onum : -1;
            if (onum < 0 && this.discoveryStateManager && typeof this.discoveryStateManager.lookupOnum === 'function') {
                onum = this.discoveryStateManager.lookupOnum(item.identification.trueName || item.rawText) ?? -1;
            }
            if (onum < 0) continue;

            if (this.discoveryStateManager && this.discoveryStateManager.discoveredOnums && typeof this.discoveryStateManager.discoveredOnums.add === 'function') {
                this.discoveryStateManager.discoveredOnums.add(onum);
            }
            onumsToUnlock.push(onum);
        }

        if (onumsToUnlock.length === 0) return;

        if (typeof this.adventureLogManager.unlockObjects === 'function') {
            const res = this.adventureLogManager.unlockObjects(onumsToUnlock);
            if (res.isNew && !isInitial && typeof this.onAdventureLogUnlocked === 'function') {
                for (const onum of (res.newOnums || [])) {
                    const itemData = OBJECT_KNOWLEDGE_MAP ? OBJECT_KNOWLEDGE_MAP.get(onum) : null;
                    const finalJa = itemData?.nameJa || itemData?.japaneseName || itemData?.name || `アイテム #${onum}`;
                    const finalEn = itemData?.name || `Object #${onum}`;
                    this.onAdventureLogUnlocked({
                        category: 'object',
                        onum,
                        name: finalEn,
                        nameJa: finalJa
                    });
                }
            }
        } else if (typeof this.adventureLogManager.unlockObject === 'function') {
            for (const onum of onumsToUnlock) {
                const isNew = this.adventureLogManager.unlockObject(onum);
                if (isNew && !isInitial && typeof this.onAdventureLogUnlocked === 'function') {
                    const itemData = OBJECT_KNOWLEDGE_MAP ? OBJECT_KNOWLEDGE_MAP.get(onum) : null;
                    const finalJa = itemData?.nameJa || itemData?.japaneseName || itemData?.name || `アイテム #${onum}`;
                    const finalEn = itemData?.name || `Object #${onum}`;
                    this.onAdventureLogUnlocked({
                        category: 'object',
                        onum,
                        name: finalEn,
                        nameJa: finalJa
                    });
                }
            }
        }
    }

    /**
     * WasmDirectBindingService を通じて C言語メモリから直接インベントリ配列を即時同期 (Stage 8.2)
     * メニューマクロ展開や文字列正規表現パースを完全にバイパスし、0ms・100%同期を実現。
     * @returns {boolean} インベントリ内容に実質的な変更があったかどうか
     */
    syncFromDirectBinding() {
        if (!this.wasmDirectBindingService || !this.wasmDirectBindingService.isAvailable()) {
            return false;
        }

        // C言語コアの最新識別メモリと即時同期
        if (this.discoveryStateManager && typeof this.discoveryStateManager.syncWithLiveMemory === 'function' && this.wasmDirectBindingService) {
            this.discoveryStateManager.syncWithLiveMemory(this.wasmDirectBindingService);
        }

        const rawItems = this.wasmDirectBindingService.getInventory();
        const equipData = this.wasmDirectBindingService.getEquipmentPtrs();
        const slotByPtr = equipData.slotByPtr || new Map();

        // 🎯 Worker 隔離環境用ハイブリッド連動 (Stage 8.2):
        // 生メモリ (gi.invent) 走査結果が存在しない場合でも、メニュー連動 (nh_menu) で保持された
        // 既存アイテム群の rawObjPtr と CALL_SHIM 経由で取得した装備スロットポインタを直接照合して更新
        if ((!rawItems || rawItems.length === 0) && this.items.length > 0) {
            let changed = false;
            for (const item of this.items) {
                const ptr = item.rawObjPtr || (typeof item.identifier === 'number' ? item.identifier : 0);
                if (ptr > 0) {
                    const equipSlotName = slotByPtr.get(ptr) || null;
                    const isWielded = equipSlotName === 'weapon';
                    const isOffhand = equipSlotName === 'offhand';
                    const isQuivered = equipSlotName === 'quiver';
                    const isWorn = Boolean(equipSlotName && !isWielded && !isOffhand && !isQuivered);
                    if (item.isWielded !== isWielded || item.isOffhand !== isOffhand || item.equipSlot !== equipSlotName || item.isWorn !== isWorn) {
                        item.isWielded = isWielded;
                        item.isOffhand = isOffhand;
                        item.isQuivered = isQuivered;
                        item.isWorn = isWorn;
                        item.equipSlot = equipSlotName;
                        changed = true;
                    }
                }
            }
            if (changed) {
                this.lastSyncMethod = 'SHIM';
                this.shimSyncCount++;
            }
            return changed;
        }

        const lang = this.language || (this.structuredKnowledgeEngine && this.structuredKnowledgeEngine.language) || 'ja';

        const parsedItems = [];

        for (const rawItem of rawItems) {
            const letter = rawItem.invlet;
            if (!letter || !/^[a-zA-Z]$/.test(letter)) continue;

            const onum = rawItem.onum;
            const corpsenm = typeof rawItem.corpsenm === 'number' ? rawItem.corpsenm : -1;
            let glyphId = (typeof onum === 'number' && onum >= 0) ? (GLYPH_OFFSETS.GLYPH_OBJ_OFF + onum) : -1;
            if (onum === 265 && corpsenm >= 0) {
                glyphId = GLYPH_OFFSETS.GLYPH_BODY_OFF + corpsenm;
            } else if (onum === 476 && corpsenm >= 0) {
                glyphId = GLYPH_OFFSETS.GLYPH_STATUE_OFF + corpsenm;
            }

            const objInfo = (onum >= 0 && OBJECT_KNOWLEDGE_MAP) ? OBJECT_KNOWLEDGE_MAP.get(onum) : getItemInfoFromOnum(onum);

            // 装備スロット同定 (C側の uwep 等ポインタと照合)
            const equipSlotName = slotByPtr.get(rawItem.ptr) || null;
            const isWielded = equipSlotName === 'weapon';
            const isOffhand = equipSlotName === 'offhand';
            const isQuivered = equipSlotName === 'quiver';
            const isWorn = Boolean(equipSlotName && !isWielded && !isOffhand && !isQuivered);
            let equipSlot = equipSlotName;

            // 🎯 未鑑定アイテムの真名露出防止 (要件A & 要件B)
            const memoryDiscoveries = (this.wasmDirectBindingService && typeof this.wasmDirectBindingService.getDiscoveries === 'function')
                ? this.wasmDirectBindingService.getDiscoveries()
                : null;
            const isKnownInMemory = (memoryDiscoveries && typeof onum === 'number' && onum >= 0)
                ? (memoryDiscoveries[onum] === 1)
                : false;

            const isIdentified = isKnownInMemory || (this.discoveryStateManager
                ? this.discoveryStateManager.isIdentified(onum)
                : (objInfo ? (objInfo.canBeUnidentified === false) : true));

            if (isIdentified && this.discoveryStateManager && typeof onum === 'number' && onum >= 0 && typeof this.discoveryStateManager.discoveredOnums?.add === 'function') {
                this.discoveryStateManager.discoveredOnums.add(onum);
            }

            // 既存アイテム情報の引き継ぎ (メニューや前回同期からの外見・テキスト)
            const prevItem = this.items.find(it => it.letter === letter || (rawItem.ptr && it.rawObjPtr === rawItem.ptr));
            let baseName = '';
            let customNameJa = '';
            let appName = null;
            let appNameJa = null;
            let descr = null;

            // Cコア真値 (getObjectUname) を最優先で参照
            const liveUname = (this.wasmDirectBindingService && typeof this.wasmDirectBindingService.getObjectUname === 'function')
                ? this.wasmDirectBindingService.getObjectUname(onum)
                : null;
            const called = liveUname || (typeof this.discoveryStateManager?.getCalledName === 'function' ? this.discoveryStateManager.getCalledName(onum) : null);

            // 💀 死体 (265)・像 (476)・缶詰 (296) の専用名称合成 (rawText は 100% 英語 ASCII に純化)
            if (onum === 265 && corpsenm >= 0) {
                const mon = MONSTER_KNOWLEDGE_MAP.get(corpsenm);
                baseName = `${mon?.name || 'corpse'} corpse`;
                if (mon?.nameJa) customNameJa = `${mon.nameJa}の死体`;
            } else if (onum === 476 && corpsenm >= 0) {
                const mon = MONSTER_KNOWLEDGE_MAP.get(corpsenm);
                baseName = `statue of a ${mon?.name || 'statue'}`;
                if (mon?.nameJa) customNameJa = `${mon.nameJa}の像`;
            } else if (onum === 296) {
                // 缶詰 (spe は強化値ではなくほうれん草/自家製フラグ)
                if (rawItem.spe === 1) {
                    baseName = 'tin of spinach';
                    customNameJa = 'ほうれん草の缶詰';
                } else if (corpsenm < 0) {
                    baseName = 'empty tin';
                    customNameJa = '空の缶詰';
                } else {
                    const mon = MONSTER_KNOWLEDGE_MAP.get(corpsenm);
                    const monName = mon?.name || 'meat';
                    if (rawItem.spe < 0) {
                        baseName = `homemade tin of ${monName} meat`;
                        if (mon?.nameJa) customNameJa = `自家製の${mon.nameJa}の缶詰`;
                    } else {
                        baseName = `tin of ${monName} meat`;
                        if (mon?.nameJa) customNameJa = `${mon.nameJa}の缶詰`;
                    }
                }
            } else {
                if (isIdentified || (objInfo && objInfo.canBeUnidentified === false)) {
                    baseName = objInfo ? (objInfo.name || `item #${onum}`) : `item #${onum}`;
                    if (objInfo?.nameJa) customNameJa = objInfo.nameJa;
                    // NetHack Cコア xname() 仕様: 識別済みアイテムには種類仮名 (called) は付与しない (真名表示優先)
                } else {
                    // 未鑑定アイテム: 動的シャッフル外見名 (getAppearance) を最優先で参照しフォーマット
                    const dynDescr = this.discoveryStateManager ? this.discoveryStateManager.getAppearance(onum) : null;
                    descr = dynDescr || objInfo?.descr || objInfo?.appearance || prevItem?.appearance || '';
                    const cat = objInfo?.category || '';
                    appName = (descr && cat)
                        ? ItemIdentificationResolver.formatAppearanceName(descr, cat, 'en')
                        : (descr || (cat ? cat.toLowerCase() : `item #${onum}`));
                    appNameJa = (descr && cat)
                        ? ItemIdentificationResolver.formatAppearanceName(descr, cat, 'ja')
                        : (descr || (cat ? cat.toLowerCase() : `アイテム #${onum}`));

                    baseName = appName;
                    if (called) {
                        baseName += ` called ${called}`;
                    }

                    // 🧙 賢者の知恵モード時のみ真名を併記 (rawText は英語真名)
                    if (this.sagesWisdomMode && objInfo?.name) {
                        baseName += ` [${objInfo.name}]`;
                        const trueJaPart = objInfo.nameJa || objInfo.name;
                        customNameJa = `${appNameJa} [${trueJaPart}]`;
                        if (called) {
                            customNameJa += ` [仮名: ${called}]`;
                        }
                    } else {
                        customNameJa = called ? `${appNameJa} [仮名: ${called}]` : appNameJa;
                    }
                }

            }
            let rawText = '';

            // 数量
            if (rawItem.quan > 1) {
                rawText += `${rawItem.quan} `;
            }

            // BUC
            if (rawItem.flags && rawItem.flags.bknown) {
                if (rawItem.flags.blessed) rawText += 'blessed ';
                else if (rawItem.flags.cursed) rawText += 'cursed ';
                else rawText += 'uncursed ';
            }

            // 強化値: known かつ WEAPON / ARMOR / RING / 強化値付きTOOL のみ表示 (缶詰や魔法書にspeを付加しない)
            const isEnchantableCategory = (objInfo && ['WEAPON', 'ARMOR', 'RING'].includes(objInfo.category)) || onum === 253 || onum === 261;
            const isKnownItem = Boolean(rawItem.flags && rawItem.flags.known) || this.sagesWisdomMode;
            if (isEnchantableCategory && isKnownItem && rawItem.spe !== 0) {
                rawText += rawItem.spe > 0 ? `+${rawItem.spe} ` : `${rawItem.spe} `;
            }

            rawText += baseName;

            // 杖のチャージ数表示 (known時のみ)
            if (objInfo && objInfo.category === 'WAND' && isKnownItem) {
                rawText += ` (${rawItem.spe} charges)`;
            }

            // 装備サフィックス
            if (isWielded) {
                rawText += ' (weapon in hand)';
            } else if (isOffhand) {
                rawText += ' (in off hand)';
            } else if (isQuivered) {
                rawText += ' (in quiver)';
            } else if (equipSlot === 'ring_left') {
                rawText += ' (on left hand)';
            } else if (equipSlot === 'ring_right') {
                rawText += ' (on right hand)';
            } else if (equipSlot === 'amulet') {
                rawText += ' (around neck)';
            } else if (isWorn) {
                rawText += ' (being worn)';
            }

            // 🎯 Direct Binding 経路では決定論的テーブル解決のみを行い、文字列正規表現パースは一切呼ばない
            const categoryFlags = this.categorizeItemFromOnum(onum, rawItem.oclass, equipSlot);
            const identification = ItemIdentificationResolver.resolve({
                rawText,
                onum,
                glyphId,
                directObject: rawItem,
                flags: rawItem.flags
            }, {
                discoveryStateManager: this.discoveryStateManager,
                sagesWisdomMode: this.sagesWisdomMode,
                language: lang
            });
            if (!isIdentified && called && !identification.calledName) {
                identification.calledName = called;
            }

            // ナレッジの付与
            let knowledge = null;
            if (this.structuredKnowledgeEngine) {
                const itemTarget = {
                    type: 'ITEM',
                    rawText,
                    onum,
                    corpsenm,
                    glyph: glyphId,
                    directObject: rawItem,
                    flags: rawItem.flags,
                    identification
                };
                if (typeof this.structuredKnowledgeEngine.getItemKnowledge === 'function') {
                    knowledge = this.structuredKnowledgeEngine.getItemKnowledge(itemTarget, { language: lang, identification, sagesWisdomMode: this.sagesWisdomMode, directObject: rawItem }) ||
                                this.structuredKnowledgeEngine.getItemKnowledge((identification.isUnidentified && !this.sagesWisdomMode) ? rawText : (onum >= 0 ? onum : rawText), { language: lang, identification, sagesWisdomMode: this.sagesWisdomMode, directObject: rawItem });
                } else if (typeof this.structuredKnowledgeEngine.getKnowledge === 'function') {
                    knowledge = this.structuredKnowledgeEngine.getKnowledge(itemTarget, { language: lang, identification, sagesWisdomMode: this.sagesWisdomMode, directObject: rawItem }) ||
                                this.structuredKnowledgeEngine.getKnowledge((identification.isUnidentified && !this.sagesWisdomMode) ? rawText : (onum >= 0 ? onum : rawText), { language: lang, identification, sagesWisdomMode: this.sagesWisdomMode, directObject: rawItem });
                }
            }
            if (!knowledge && (!identification.isUnidentified || this.sagesWisdomMode) && onum >= 0 && OBJECT_KNOWLEDGE_MAP.has(onum)) {
                knowledge = OBJECT_KNOWLEDGE_MAP.get(onum);
            }

            let skillBadge = null;
            if (knowledge && this.skillStateManager && (!identification.isUnidentified || this.sagesWisdomMode)) {
                skillBadge = getSkillProficiencyBadge(knowledge, this.skillStateManager, { language: lang });
            }

            // C コア shim_bridge 直接真値による BUC 決定
            const bucStatus = (rawItem.flags && rawItem.flags.bknown)
                ? (rawItem.flags.blessed ? 'BLESSED' : (rawItem.flags.cursed ? 'CURSED' : 'UNCURSED'))
                : (this.sagesWisdomMode ? (rawItem.flags?.blessed ? 'BLESSED' : (rawItem.flags?.cursed ? 'CURSED' : 'UNCURSED')) : 'UNKNOWN');

            parsedItems.push({
                letter,
                name: baseName,
                baseName,
                nameJa: customNameJa || (isIdentified ? (objInfo ? (objInfo.nameJa || objInfo.japaneseName) : '') : baseName) || baseName,
                trueName: objInfo?.name || null,
                trueNameJa: objInfo?.nameJa || objInfo?.japaneseName || null,
                appearance: appName || descr,
                appearanceName: appName || descr,
                appearanceNameJa: appNameJa,
                descr,
                sagesWisdomMode: this.sagesWisdomMode,
                rawText,
                glyphId,
                onum,
                corpsenm: typeof rawItem.corpsenm === 'number' ? rawItem.corpsenm : corpsenm,
                identifier: rawItem.ptr,
                rawObjPtr: rawItem.ptr,
                weight: rawItem.weight,
                owt: rawItem.owt,
                quan: rawItem.quan,
                spe: rawItem.spe,
                oclass: rawItem.oclass,
                cobjPtr: rawItem.cobjPtr,
                o_id: rawItem.o_id,
                flags: rawItem.flags,
                directObject: rawItem,
                bucStatus,
                identification,
                knowledge,
                skillBadge,
                isRecommendedWeapon: Boolean(skillBadge && skillBadge.isProficient && !identification.isUnidentified),
                ...categoryFlags,
                isWielded,
                isOffhand,
                isQuivered,
                isWorn,
                equipSlot
            });
        }

        // 第2パス: アクション判定
        if (parsedItems.length > 0) {
            parsedItems.forEach(item => {
                const defaultAction = this.determineDefaultAction(
                    item.rawText,
                    item,
                    item,
                    item.letter,
                    parsedItems,
                    item
                );
                Object.assign(item, defaultAction);
                if (defaultAction.defaultActionRecipe) {
                    item.actionRecipe = defaultAction.defaultActionRecipe;
                }
            });

            const newSignature = this._buildSignature(parsedItems.map(p => ({
                charStr: p.letter,
                rawStr: p.rawText,
                glyph: p.glyphId,
                onum: p.onum
            })));

            if (this.isSynced && this._lastInventorySignature === newSignature) {
                return false;
            }

            this.lastSyncMethod = 'SHIM';
            this.shimSyncCount++;

            const canonicalItems = parsedItems.map(item => ItemNormalizer.normalize(item, { source: 'INVENTORY', sagesWisdomMode: this.sagesWisdomMode }));
            this.items = canonicalItems;
            this.isSynced = true;
            this._lastInventorySignature = newSignature;
            this._syncWithAdventureLog(canonicalItems);
            this.hasCompletedInitialSync = true;
            return true;
        } else {
            const hadItems = this.items.length > 0;
            const newSignature = this._buildSignature([]);
            if (this.isSynced && this._lastInventorySignature === newSignature) {
                return false;
            }
            this.lastSyncMethod = 'SHIM';
            this.shimSyncCount++;

            this.items = [];
            // 🛡️ 初回同期が一度も完了していない段階で 0 件が返った場合、
            // セーブ復帰やCコア復元中の過渡期（一時的な空状態）の可能性があるため
            // isSynced = true と確定させず保留する
            if (this.hasCompletedInitialSync) {
                this.isSynced = true;
                this._lastInventorySignature = newSignature;
                return hadItems;
            } else {
                this.isSynced = false;
                this._lastInventorySignature = '';
                return hadItems;
            }
        }
    }

    /**
     * インベントリの同期を実行 (Wasmメモリ直結が利用可能な場合は直接取得、なければ false)
     * @returns {boolean}
     */
    sync() {
        if (this.isDirectBindingAvailable) {
            return this.syncFromDirectBinding();
        }
        return false;
    }

    /**
     * driver.getLastSequenceBuffer() のバッファデータからインベントリメニュー・テキスト行を抽出して一括更新
     * @param {Array<Object>} sequenceBuffer - シーケンスバッファの配列
     * @returns {boolean} インベントリ内容に実質的な変更があったかどうか
     */
    updateFromSequenceBuffer(sequenceBuffer) {
        if (!Array.isArray(sequenceBuffer) || sequenceBuffer.length === 0) {
            // バッファが空の場合は同期失敗またはキャンセルとみなし、既存のアイテム状態を安全に保持
            return false;
        }

        for (const item of sequenceBuffer) {
            if (!item) continue;

            if (item.menuItems || item.items) {
                const menuItems = item.menuItems || item.items;
                if (Array.isArray(menuItems) && menuItems.length > 0) {
                    const changed = this.updateFromMenuItems(menuItems);
                    if (changed || this.items.length > 0) {
                        return changed;
                    }
                }
            }

            if (item.lines || item.text) {
                const lines = item.lines || (typeof item.text === 'string' ? item.text.split('\n') : []);
                if (Array.isArray(lines) && lines.length > 0) {
                    const changed = this.updateFromLines(lines);
                    if (changed) {
                        return true;
                    }
                }
            }
        }

        // メニューアイテムも有効テキスト行も見つからなかった場合
        // 明示的な「何も持っていない」メッセージ（Not carrying anything / 何も持っていません）があるか検査
        const hasExplicitEmptyMessage = sequenceBuffer.some(item => {
            const txt = [
                item.text || '',
                item.prompt || '',
                item.message || '',
                (Array.isArray(item.lines) ? item.lines.join(' ') : '')
            ].join(' ').toLowerCase();
            return txt.includes('not carrying anything') || txt.includes('何も持っていません');
        });

        if (hasExplicitEmptyMessage) {
            const emptySig = this._buildSignature([]);
            if (this.isSynced && this._lastInventorySignature === emptySig) {
                return false;
            }
            const hadItems = this.items.length > 0;
            this.items = [];
            this.isSynced = true;
            this._lastInventorySignature = emptySig;
            return hadItems;
        }

        // 明示的な空メッセージがない場合は、インベントリとは無関係のバッファ（別プロンプト等）とみなし既存状態を維持
        return false;
    }

    /**
     * テキスト行の配列（例: ["a - a lock pick", "b - a +0 dagger"]）からインベントリ状態を抽出・同期
     * @param {Array<string>} lines 
     * @returns {boolean}
     */
    updateFromLines(lines) {
        if (!Array.isArray(lines) || lines.length === 0) return false;

        const menuItems = [];
        lines.forEach(line => {
            if (!line || typeof line !== 'string') return;
            const match = line.match(/^([a-zA-Z])[\s\-\.\)]+(.+)$/);
            if (match) {
                menuItems.push({
                    letter: match[1],
                    rawStr: match[2].trim(),
                    str: match[2].trim()
                });
            }
        });

        if (menuItems.length === 0) {
            // アイテム行が1行もマッチしなかった場合（プロンプト質問文や一般ログ等）
            const hasExplicitEmpty = lines.some(l => {
                const s = String(l).toLowerCase();
                return s.includes('not carrying anything') || s.includes('何も持っていません');
            });
            if (hasExplicitEmpty) {
                return this.updateFromMenuItems([]);
            }
            return false;
        }

        return this.updateFromMenuItems(menuItems);
    }

    /** エイリアスメソッド (互換性担保) */
    syncFromMenu(menuItems) {
        return this.updateFromMenuItems(menuItems);
    }

    /**
     * ログメッセージ（例: "You pick up...", "You drop...", "Your pick-axe breaks!"）を受信した際の状態判定
     * 不確実なアドホック推測登録を行わず、インベントリが変更された可能性があるとして未同期（dirty）化する。
     * @param {string} message 
     */
    updateFromMessage(message) {
        if (!message) return false;

        const prevSynced = this.isSynced;
        const prevCount = this.items ? this.items.length : 0;

        // 壊れたメッセージ検知 ("Your pick-axe breaks!")
        if (message.includes('breaks') || message.includes('destroyed')) {
            if (message.includes('pick-axe')) {
                this.items = this.items.filter(i => !i.isPickAxe);
            }
            this.isSynced = false;
            return true;
        }

        // アイテム拾得時の単一スロット表示メッセージ検知 ("f - a dagger.", "a - 短剣" 等)
        const trimmed = message.trim();
        if (/^[a-zA-Z]\s*[\-\.]\s*.+$/.test(trimmed)) {
            this.isSynced = false;
            return prevSynced !== false;
        }

        // ドロップメッセージ・拾得・投げる/射出・消費・使用・識別・状態変更メッセージ検知 (小文字化して大文字小文字表記揺れを吸収)
        const msg = message.toLowerCase();
        if (msg.includes('pick up') || msg.includes('picked up') || msg.includes('picking up') ||
            msg.includes('got ') || msg.includes('find') || msg.includes('now have') || msg.includes('obtain') ||
            msg.includes('grab') || msg.includes('loot') || msg.includes('拾') || msg.includes('手に入れ') || msg.includes('入手') ||
            msg.includes('throw') || msg.includes('threw') || msg.includes('fire') || msg.includes('fired') ||
            msg.includes('shoot') || msg.includes('shot') || msg.includes('投') || msg.includes('放つ') || msg.includes('射出') ||
            msg.includes('drop') || msg.includes('start with') ||
            msg.includes('put on') || msg.includes('take off') ||
            msg.includes('wield') || msg.includes('wear') || msg.includes('remove') ||
            msg.includes('drink') || msg.includes('eat') || msg.includes('read') ||
            msg.includes('zap') || msg.includes('quaff') || msg.includes('disappears') ||
            msg.includes('consume') || msg.includes('swallow') ||
            msg.includes('identify') || msg.includes('identifies') || msg.includes('called') ||
            msg.includes('named') || msg.includes('識別') || msg.includes('鑑定') || msg.includes('名付')) {
            
            // 能動取得が必要であることを示すため未同期 (dirty) フラグに変更
            this.isSynced = false;
            return prevSynced !== false;
        }

        return (this.items ? this.items.length : 0) !== prevCount || this.isSynced !== prevSynced;
    }

    /** インベントリの同期状態を破棄 (dirty 化) し、次回機会での自動再同期を促す */
    invalidate() {
        this.isSynced = false;
    }

    /** エイリアスメソッド (互換性担保) */
    syncFromMessage(message) {
        return this.updateFromMessage(message);
    }

    /**
     * 🎯 Direct Binding 専用アイテム分類 (正規表現ゼロ・100%決定論的解決)
     * @param {number} onum 
     * @param {number} [oclass=0] 
     * @param {string|null} [equipSlot=null] 
    /**
     * 🎯 Direct Binding 専用アイテム分類 (正規表現ゼロ・100%決定論的解決)
     * @param {number} onum 
     * @param {number} [oclass=0] 
     * @param {string|null} [equipSlot=null] 
     * @returns {Object} カテゴリフラグ構造体
     */
    categorizeItemFromOnum(onum, oclass = 0, equipSlot = null) {
        let category = 'OTHER';
        let isPickAxe = false;
        let isKey = false;
        let isAxe = false;
        let isDigWand = false;
        let isFrostWand = false;
        let isAmmo = false;
        let isLauncher = false;
        let isCanOpener = false;
        let isTin = false;
        let isBox = false;
        let isBag = false;
        let isTouchstone = false;
        let isGem = false;
        let isRock = false;

        if (typeof onum === 'number' && onum >= 0) {
            const info = getItemInfoFromOnum(onum);
            category = info.category;
            isPickAxe = info.isPickAxe;
            isKey = info.isKey;
            isAxe = info.isAxe;
            isDigWand = info.isDigWand;
            isFrostWand = info.isFrostWand;
            isAmmo = info.isAmmo;
            isLauncher = info.isLauncher;
            isCanOpener = info.isCanOpener;
            isTin = info.isTin;
            isBox = info.isBox;
            isBag = info.isBag;
            isTouchstone = info.isTouchstone;
            isGem = info.isGem;
            isRock = info.isRock;
        }

        const verb = isDigWand ? 'z' : 'a';
        const isWielded = equipSlot === 'weapon';
        const isOffhand = equipSlot === 'offhand';
        const isQuivered = equipSlot === 'quiver';
        const isWorn = Boolean(equipSlot && !isWielded && !isOffhand && !isQuivered);
        const equipState = {
            isWielded,
            isOffhand,
            isQuivered,
            isWorn,
            equipSlot,
            isEquipped: Boolean(isWielded || isOffhand || isQuivered || isWorn)
        };

        const defaultAction = this.determineDefaultAction('', {
            isPickAxe, isDigWand, isKey, isAxe, isFrostWand, isAmmo, isLauncher,
            isCanOpener, isTin, isBox, isBag, isTouchstone, isGem, isRock, category, onum
        }, equipState, '', Array.isArray(this.items) ? this.items : []);

        return {
            isPickAxe,
            isDigWand,
            isDigTool: isPickAxe || isDigWand,
            verb,
            isKey,
            isAxe,
            isFrostWand,
            isAmmo,
            isLauncher,
            isCanOpener,
            isTin,
            isBox,
            isBag,
            isTouchstone,
            isGem,
            isRock,
            onum,
            category,
            ...equipState,
            ...defaultAction
        };
    }

    /**
     * 三層識別アルゴリズム (onum -> Glyph ID -> 正規表現) によるアイテム分類
     * @param {string} rawText 
     * @param {number} glyphId 
     * @param {number} onum 
     * @returns {Object} フラグ構造体
     */
    categorizeItem(rawText, glyphId = -1, onum = -1) {
        if (typeof onum !== 'number' || onum < 0) {
            onum = -1;
        }
        // onum が未セットの場合、glyphId から自動補填
        if (onum < 0 && typeof glyphId === 'number' && glyphId >= 0) {
            onum = getOnumFromGlyph(glyphId);
        }

        let isPickAxe = false;
        let isDigWand = false;
        let isKey = false;
        let isAxe = false;
        let isFrostWand = false;
        let isAmmo = false;
        let isLauncher = false;
        let isCanOpener = false;
        let isTin = false;
        let isBox = false;
        let isBag = false;
        let isTouchstone = false;
        let isGem = false;
        let isRock = false;
        let category = 'OTHER';

        // 【層1】onum (オブジェクト固有番号) による確定判定
        if (onum >= 0) {
            const info = getItemInfoFromOnum(onum);
            category = info.category;
            isPickAxe = info.isPickAxe;
            isKey = info.isKey;
            isAxe = info.isAxe;
            isDigWand = info.isDigWand;
            isFrostWand = info.isFrostWand;
            isAmmo = info.isAmmo;
            isLauncher = info.isLauncher;
            isCanOpener = info.isCanOpener;
            isTin = info.isTin;
            isBox = info.isBox;
            isBag = info.isBag;
            isTouchstone = info.isTouchstone;
            isGem = info.isGem;
            isRock = info.isRock;
        }

        // 【層2】テキストパース（onum で未特定のフォールバック）
        const cleanText = this.cleanItemText(rawText);

        if (!isCanOpener && (/\bcan opener\b/i.test(cleanText) || /缶切り/.test(cleanText))) {
            isCanOpener = true;
        }
        if (!isTin && (/\b(tin|tins)\b/i.test(cleanText) || /缶詰/.test(cleanText))) {
            isTin = true;
        }
        if (!isBox && (/\b(large box|chest|box)\b/i.test(cleanText) && !/chestplate/i.test(cleanText) || /(大箱|箱|チェスト)/.test(cleanText))) {
            isBox = true;
        }
        if (!isBag && (/\b(sack|bag of holding|oilskin sack|bag|bags)\b/i.test(cleanText) || /(袋|バックパック)/.test(cleanText))) {
            isBag = true;
        }
        if (!isTouchstone && (/\b(touchstone|whetstone)\b/i.test(cleanText) || /(タッチストーン|砥石)/.test(cleanText))) {
            isTouchstone = true;
        }
        if (!isGem && !/ring|amulet|spellbook|potion|wand|scroll|book|鎧|指輪|魔よけ/i.test(cleanText) && (/\b(gem|gems|ruby|diamond|emerald|sapphire|amethyst|topaz|aquamarine|turquoise|opal|garnet|jacinth|fluorite|agate|jet|obsidian|jade)\b/i.test(cleanText) || /(宝石|ルビー|ダイヤモンド|エメラルド|サファイア)/.test(cleanText))) {
            isGem = true;
        }
        if (category === 'RING' || category === 'AMULET' || category === 'SPELLBOOK' || category === 'POTION' || category === 'WAND' || category === 'SCROLL' || /\brings?\b|amulet|spellbook|potion|wand|scroll|指輪|魔よけ/i.test(cleanText)) {
            isGem = false;
        }
        if (!isRock && (/\b(rock|rocks|flint)\b/i.test(cleanText) || /(岩|石|火打ち石)/.test(cleanText))) {
            isRock = true;
        }

        if (!isAmmo && !isLauncher) {
            if (/\b(arrow|arrows|bolt|bolts|dart|darts|shuriken|shurikens|boomerang|boomerangs|javelin|javelins|flint|rock|rocks)\b/i.test(cleanText) || /(矢|ボルト|ダーツ|手裏剣|ブーメラン|ジャベリン|火打ち石|岩|石)/.test(cleanText)) {
                isAmmo = true;
            } else if (/\b(bow|bows|yumi|sling|slings|crossbow|crossbows)\b/i.test(cleanText) || /(弓|スリング|投石器|クロスボウ)/.test(cleanText)) {
                isLauncher = true;
            }
        }

        if (!isPickAxe && !isDigWand) {
            if (/\b(wand of digging)\b/i.test(cleanText) || /採掘の杖/.test(cleanText)) {
                isDigWand = true;
            } else if (/\b(pick-axe|dwarvish mattock)\b/i.test(cleanText) || /(つるはし|ドワーフのマトック)/.test(cleanText)) {
                isPickAxe = true;
            }
        }

        if (!isKey) {
            isKey = /\b(skeleton key|lock\s*pick|lockpick|lock-pick|credit card|\b\w+\s+key|keys?)\b/i.test(cleanText) ||
                    /(鍵|合鍵|ロックピック|クレジットカード)/.test(cleanText);
        }

        if (!isAxe && !isPickAxe) {
            isAxe = (/(^|[\s])(axe|battle-axe)($|[\s])/i.test(cleanText) || /(斧|戦斧)/.test(cleanText)) && !/pick-axe/i.test(cleanText);
        }

        if (!isFrostWand) {
            isFrostWand = /\bwand of frost\b/i.test(cleanText) ||
                          /氷の杖/.test(cleanText);
        }

        // 発動コマンドキー (verb) の付与
        const verb = isDigWand ? 'z' : 'a';

        // 装備状態のパース (Wielded, Offhand, Quivered, Worn)
        const equipState = this.parseEquipState(rawText, {
            category, isPickAxe, isAxe, isAmmo, isLauncher
        });

        // カテゴリ別デフォルト推奨アクションおよび副次的アクションの判定
        const defaultAction = this.determineDefaultAction(rawText, {
            isPickAxe, isDigWand, isKey, isAxe, isFrostWand, isAmmo, isLauncher,
            isCanOpener, isTin, isBox, isBag, isTouchstone, isGem, isRock, category
        }, equipState, '', Array.isArray(this.items) ? this.items : []);

        return {
            isPickAxe,
            isDigWand,
            isDigTool: isPickAxe || isDigWand,
            verb,
            isKey,
            isAxe,
            isFrostWand,
            isAmmo,
            isLauncher,
            isCanOpener,
            isTin,
            isBox,
            isBag,
            isTouchstone,
            isGem,
            isRock,
            onum,
            category,
            ...equipState,
            ...defaultAction
        };
    }

    /**
     * カテゴリおよび装備状態からのデフォルト推奨アクションおよび副次的アクション判定
     * @param {string} rawText 
     * @param {Object} categoryFlags 
     * @param {Object} equipState 
     * @param {string} [letter=''] 
     * @param {Array<Object>} [allItems=[]]
     * @param {Object} [itemObj=null]
     * @returns {Object} { defaultVerb, defaultSequence, defaultActionLabel, defaultActionLabelJa, category, alternativeActions }
     */
    determineDefaultAction(rawText, categoryFlags = {}, equipState = {}, letter = '', allItems = [], itemObj = null) {
        const cleanText = this.cleanItemText(rawText);
        const { isWielded, isOffhand, isQuivered, isWorn, equipSlot } = equipState;
        const { category: catFlag = 'OTHER' } = categoryFlags;
        const itemList = Array.isArray(allItems) && allItems.length > 0 ? allItems : (Array.isArray(this.items) ? this.items : []);

        // itemObj / categoryFlags から knowledge または onum を解明
        let knowledge = (itemObj && itemObj.knowledge) || categoryFlags.knowledge || null;
        const onum = (itemObj && typeof itemObj.onum === 'number' && itemObj.onum >= 0)
            ? itemObj.onum
            : (typeof categoryFlags.onum === 'number' && categoryFlags.onum >= 0 ? categoryFlags.onum : -1);

        if (!knowledge && onum >= 0 && OBJECT_KNOWLEDGE_MAP.has(onum)) {
            knowledge = OBJECT_KNOWLEDGE_MAP.get(onum);
        }

        let defaultVerb = null;
        let defaultSequence = letter ? [letter] : [];
        let defaultActionLabel = 'Select';
        let defaultActionLabelJa = '選択';
        let category = (knowledge && knowledge.category) ? knowledge.category : (catFlag !== 'OTHER' ? catFlag : 'OTHER');
        let alternativeActions = [];

        // ヘルパー: 標準選択肢の組み立て
        const makeAlt = (verb, seq, labelJa, isDefault = false) => ({
            verb,
            sequence: seq,
            labelJa,
            isDefault
        });

        // ヘルパー: 指輪 (RING) の左右装着アクション構築
        const resolveRingAction = () => {
            const hasLeftRing = Array.isArray(itemList) && itemList.some(i => i.isWorn && i.equipSlot === 'ring_left');
            const hasRightRing = Array.isArray(itemList) && itemList.some(i => i.isWorn && i.equipSlot === 'ring_right');
            let seq, label, labelJa;
            if (hasLeftRing && hasRightRing) {
                seq = ['P'];
                label = 'Already wearing two rings';
                labelJa = '両手に装着中 (P)';
            } else {
                const isOneRingWorn = (hasLeftRing && !hasRightRing) || (!hasLeftRing && hasRightRing);
                const targetFinger = (hasLeftRing && !hasRightRing) ? 'r' : 'l';
                // 1個装着中の場合は自動的に空いている手に入るため targetFinger を送ってはならない
                seq = isOneRingWorn ? (letter ? ['P', letter] : ['P']) : (letter ? ['P', letter, targetFinger] : ['P']);
                label = 'Put on ring';
                labelJa = `はめる (P:${targetFinger === 'l' ? '左手' : '右手'})`;
            }
            return {
                defaultVerb: 'P',
                defaultSequence: seq,
                defaultActionLabel: label,
                defaultActionLabelJa: labelJa,
                category: 'RING',
                alternativeActions: [
                    makeAlt('P', seq, labelJa, true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean)
            };
        };

        // 1. 既に装備・着用・装填中のアイテムの解除アクション優先 (動的状態判定)
        if (isWielded || isOffhand) {
            defaultVerb = 'w';
            defaultSequence = ['w', '-'];
            defaultActionLabel = 'Unwield weapon';
            defaultActionLabelJa = '手放す (w-)';
            category = 'WEAPON';
            alternativeActions = [
                makeAlt('w', ['w', '-'], '手放す (w-)', true),
                letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
            ].filter(Boolean);
        } else if (isQuivered) {
            defaultVerb = 'Q';
            defaultSequence = ['Q', '-'];
            defaultActionLabel = 'Unquiver ammo';
            defaultActionLabelJa = '装填解除 (Q-)';
            category = 'WEAPON';
            alternativeActions = [
                makeAlt('Q', ['Q', '-'], '装填解除 (Q-)', true),
                letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
            ].filter(Boolean);
        } else if (isWorn) {
            if (equipSlot === 'ring_left' || equipSlot === 'ring_right' || equipSlot === 'amulet') {
                defaultVerb = 'R';
                const wornRingCount = Array.isArray(itemList) ? itemList.filter(i => i.isWorn && (i.equipSlot === 'ring_left' || i.equipSlot === 'ring_right')).length : 0;
                if (equipSlot === 'amulet') {
                    defaultSequence = letter ? ['R', letter] : ['R'];
                } else if (wornRingCount <= 1) {
                    // 指輪が1個だけ装着されている場合、R を押すだけで NetHack が外すため余剰キーを送信しない
                    defaultSequence = ['R'];
                } else {
                    // 指輪が2個装着されている場合のみ、R の後に指輪文字を指定する
                    defaultSequence = letter ? ['R', letter] : ['R'];
                }
                defaultActionLabel = 'Remove ring/amulet';
                defaultActionLabelJa = '外す (R)';
                category = equipSlot === 'amulet' ? 'AMULET' : 'RING';
                alternativeActions = [
                    makeAlt('R', defaultSequence, '外す (R)', true)
                ];
            } else {
                defaultVerb = 'T';
                // NetHack Cソース (do_wear.c count_worn_stuff) 準拠の脱衣可能防具数 (Narmorpieces) 算出
                // 兜、盾、手袋、靴は各独立。胴体部位 (cloak/suit/shirt) は最外層の1点のみが脱衣対象としてカウントされる。
                const wornArmors = Array.isArray(itemList)
                    ? itemList.filter(i => i.isWorn && i.equipSlot !== 'ring_left' && i.equipSlot !== 'ring_right' && i.equipSlot !== 'amulet')
                    : [];

                let hasHelm = false;
                let hasShield = false;
                let hasGloves = false;
                let hasBoots = false;
                let hasCloak = false;
                let hasSuit = false;
                let hasShirt = false;

                for (const wa of wornArmors) {
                    const slot = this._resolveArmorSlot(wa);
                    if (slot === 'helm' || slot === 'helmet') hasHelm = true;
                    else if (slot === 'shield') hasShield = true;
                    else if (slot === 'gloves') hasGloves = true;
                    else if (slot === 'boots') hasBoots = true;
                    else if (slot === 'cloak') hasCloak = true;
                    else if (slot === 'shirt') hasShirt = true;
                    else hasSuit = true;
                }

                let removableArmorCount = 0;
                if (hasHelm) removableArmorCount++;
                if (hasShield) removableArmorCount++;
                if (hasGloves) removableArmorCount++;
                if (hasBoots) removableArmorCount++;
                // 胴体防具: cloak -> suit -> shirt の順に最外層の1点のみが脱衣可能
                if (hasCloak) removableArmorCount++;
                else if (hasSuit) removableArmorCount++;
                else if (hasShirt) removableArmorCount++;

                if (removableArmorCount <= 1) {
                    // 脱衣可能な防具が1個だけの場合、NetHack は文字を聞かずに即座に脱ぐため余剰キーを送信しない
                    defaultSequence = ['T'];
                } else {
                    // 脱衣可能な防具が2個以上ある場合のみ、T の後に防具文字を指定する
                    defaultSequence = letter ? ['T', letter] : ['T'];
                }
                defaultActionLabel = 'Take off armor';
                defaultActionLabelJa = '脱ぐ (T)';
                category = 'ARMOR';
                alternativeActions = [
                    makeAlt('T', defaultSequence, '脱ぐ (T)', true)
                ];
            }
        } else {
            // 2. 缶切り (Can Opener) のスマート判定 (所持品に缶詰 Tin があればスマートシーケンス 'a' + letter + tinLetter)
            const isCanOpener = categoryFlags.isCanOpener || (knowledge && (knowledge.isCanOpener || knowledge.onum === 239)) || /can opener|缶切り/i.test(cleanText);
            if (isCanOpener) {
                category = 'TOOL';
                const tinItem = itemList.find(i => i.letter && i.letter !== letter && (i.isTin || (i.knowledge && (i.knowledge.isTin || i.knowledge.onum === 263 || i.knowledge.onum === 296)) || /tin|缶詰/i.test(i.rawText || '')));
                if (tinItem && letter) {
                    defaultVerb = 'a';
                    defaultSequence = ['a', letter, tinItem.letter];
                    defaultActionLabel = 'Open tin';
                    defaultActionLabelJa = `缶詰を開ける (a ➔ ${tinItem.letter})`;
                    alternativeActions = [
                        makeAlt('a', defaultSequence, `缶詰を開ける (a ➔ ${tinItem.letter})`, true),
                        makeAlt('a', ['a', letter], '使う (a)'),
                        makeAlt('d', ['d', letter], '置く/落とす (d)')
                    ];
                } else {
                    defaultVerb = 'a';
                    defaultSequence = letter ? ['a', letter] : ['a'];
                    defaultActionLabel = 'Apply can opener';
                    defaultActionLabelJa = '使う (a)';
                    alternativeActions = [
                        makeAlt('a', defaultSequence, '使う (a)', true),
                        letter ? makeAlt('w', ['w', letter], '手に持つ (w)') : null,
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                }
            }
            // 3. 指輪 (RING) の左右装着キー構築
            else if (category === 'RING' || (knowledge && (knowledge.category === 'RING' || knowledge.defaultVerb === 'put_on' && knowledge.category !== 'AMULET'))) {
                const ringRes = resolveRingAction();
                defaultVerb = ringRes.defaultVerb;
                defaultSequence = ringRes.defaultSequence;
                defaultActionLabel = ringRes.defaultActionLabel;
                defaultActionLabelJa = ringRes.defaultActionLabelJa;
                category = ringRes.category;
                alternativeActions = ringRes.alternativeActions;
            }
            // 4. ナレッジデータ駆動 (Single Source of Truth 参照)
            else if (knowledge && knowledge.defaultVerb) {
                const verbKeyMap = {
                    wield: 'w',
                    wear: 'W',
                    quaff: 'q',
                    read: 'r',
                    zap: 'z',
                    apply: 'a',
                    quiver: 'Q',
                    put_on: 'P',
                    eat: 'e',
                    throw: 't',
                    drop: 'd',
                    inventory: 'i',
                    w: 'w',
                    W: 'W',
                    q: 'q',
                    r: 'r',
                    z: 'z',
                    a: 'a',
                    Q: 'Q',
                    P: 'P',
                    e: 'e',
                    t: 't',
                    d: 'd',
                    i: 'i'
                };
                const verbKey = knowledge.verbKey || verbKeyMap[knowledge.defaultVerb] || (typeof knowledge.defaultVerb === 'string' && knowledge.defaultVerb.length === 1 ? knowledge.defaultVerb : 'a');
                defaultVerb = verbKey;
                defaultSequence = letter ? [verbKey, letter] : [verbKey];
                const catUpper = (knowledge.category || catFlag || '').toUpperCase();
                defaultActionLabel = knowledge.actionLabel || knowledge.defaultActionLabel || (verbKey === 'r' ? 'Read' : (verbKey === 'q' ? 'Quaff' : (verbKey === 'z' ? 'Zap' : (verbKey === 'e' ? 'Eat' : (verbKey === 'P' ? 'Put on' : 'Action')))));
                defaultActionLabelJa = knowledge.actionLabelJa || knowledge.defaultActionLabelJa || (catUpper === 'SPELLBOOK' ? '勉強する' : (catUpper === 'SCROLL' ? '読む' : (catUpper === 'POTION' ? '飲む' : (catUpper === 'WAND' ? '振る' : (catUpper === 'FOOD' ? '食べる' : '選択')))));
                category = knowledge.category || catFlag;

                const alts = [makeAlt(verbKey, defaultSequence, defaultActionLabelJa, true)];
                if (letter && verbKey !== 'd') {
                    alts.push(makeAlt('d', ['d', letter], '置く/落とす (d)'));
                }
                if (letter && verbKey !== 't' && (category === 'WEAPON' || category === 'GEM')) {
                    alts.push(makeAlt('t', ['t', letter], '投げる (t)'));
                }
                alternativeActions = alts;
            }
            // 5. 箱・チェスト (Box / Chest) の重量軽減優先判定 (推奨: d 落とす)
            else if ((categoryFlags.isBox || /\b(large box|chest|box)\b/i.test(cleanText) || /(大箱|箱|チェスト)/.test(cleanText)) && !/chestplate/i.test(cleanText)) {
                defaultVerb = 'd';
                defaultSequence = letter ? ['d', letter] : ['d'];
                defaultActionLabel = 'Drop container';
                defaultActionLabelJa = '置く/落とす (d)';
                category = 'TOOL';
                alternativeActions = [
                    makeAlt('d', defaultSequence, '置く/落とす (d)', true),
                    letter ? makeAlt('a', ['a', letter], '開ける/使う (a)') : null
                ].filter(Boolean);
            }
            // 4. 袋類 (Sack / Bag of Holding) (推奨: a 中を見る)
            else if (categoryFlags.isBag || /sack|bag|袋|バックパック/i.test(cleanText)) {
                defaultVerb = 'a';
                defaultSequence = letter ? ['a', letter] : ['a'];
                defaultActionLabel = 'Look inside bag';
                defaultActionLabelJa = '中を見る/使う (a)';
                category = 'TOOL';
                alternativeActions = [
                    makeAlt('a', defaultSequence, '中を見る/使う (a)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            }
            // 5. 砥石・タッチストーン (Touchstone / Whetstone)
            else if (categoryFlags.isTouchstone || /touchstone|whetstone|タッチストーン|砥石/i.test(cleanText)) {
                defaultVerb = 'a';
                defaultSequence = letter ? ['a', letter] : ['a'];
                defaultActionLabel = 'Apply touchstone';
                defaultActionLabelJa = '使う/鑑定する (a)';
                category = 'TOOL';
                alternativeActions = [
                    makeAlt('a', defaultSequence, '使う/鑑定する (a)', true),
                    letter ? makeAlt('w', ['w', letter], '手に持つ (w)') : null,
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            }
            // 6. 宝石・石・鉱石 (Gem / Rock)
            else if ((categoryFlags.isGem || categoryFlags.isRock || /gem|ruby|diamond|emerald|sapphire|rock|flint|宝石|岩|石/i.test(cleanText)) &&
                     !categoryFlags.isAmmo && !categoryFlags.isLauncher &&
                     !['SPELLBOOK', 'POTION', 'SCROLL', 'WAND', 'RING', 'AMULET', 'FOOD', 'ARMOR', 'WEAPON'].includes(catFlag)) {
                defaultVerb = 't';
                defaultSequence = letter ? ['t', letter] : ['t'];
                defaultActionLabel = 'Throw gem/rock';
                defaultActionLabelJa = '投げる (t)';
                category = categoryFlags.isGem ? 'GEM' : 'OTHER';
                alternativeActions = [
                    makeAlt('t', defaultSequence, '投げる (t)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null,
                    letter ? makeAlt('a', ['a', letter], '使う (a)') : null
                ].filter(Boolean);
            }
            // 7. 缶詰 (Tin)
            else if (categoryFlags.isTin || /tin|tins|缶詰/i.test(cleanText)) {
                defaultVerb = 'e';
                defaultSequence = letter ? ['e', letter] : ['e'];
                defaultActionLabel = 'Eat tin';
                defaultActionLabelJa = '開けて食べる (e)';
                category = 'FOOD';
                alternativeActions = [
                    makeAlt('e', defaultSequence, '開けて食べる (e)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            }
            // 8. 弾薬・投擲物 (isAmmo) の優先装填 (Q) 判定
            else if (categoryFlags.isAmmo) {
                defaultVerb = 'Q';
                defaultSequence = letter ? ['Q', letter] : ['Q'];
                defaultActionLabel = 'Quiver ammo';
                defaultActionLabelJa = '装填/矢筒 (Q)';
                category = 'WEAPON';
                alternativeActions = [
                    makeAlt('Q', defaultSequence, '装填/矢筒 (Q)', true),
                    letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            }
            // 9. catFlag に基づく推奨アクション判定
            else if (catFlag === 'POTION') {
                defaultVerb = 'q';
                defaultSequence = letter ? ['q', letter] : ['q'];
                defaultActionLabel = 'Quaff potion';
                defaultActionLabelJa = '飲む (q)';
                alternativeActions = [
                    makeAlt('q', defaultSequence, '飲む (q)', true),
                    letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (catFlag === 'FOOD') {
                defaultVerb = 'e';
                defaultSequence = letter ? ['e', letter] : ['e'];
                defaultActionLabel = 'Eat food';
                defaultActionLabelJa = '食べる (e)';
                alternativeActions = [
                    makeAlt('e', defaultSequence, '食べる (e)', true),
                    letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (catFlag === 'SCROLL') {
                defaultVerb = 'r';
                defaultSequence = letter ? ['r', letter] : ['r'];
                defaultActionLabel = 'Read scroll';
                defaultActionLabelJa = '読む (r)';
                alternativeActions = [
                    makeAlt('r', defaultSequence, '読む (r)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (catFlag === 'SPELLBOOK') {
                defaultVerb = 'r';
                defaultSequence = letter ? ['r', letter] : ['r'];
                defaultActionLabel = 'Read spellbook';
                defaultActionLabelJa = '勉強する (r)';
                alternativeActions = [
                    makeAlt('r', defaultSequence, '勉強する (r)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (catFlag === 'WAND') {
                defaultVerb = 'z';
                defaultSequence = letter ? ['z', letter] : ['z'];
                defaultActionLabel = 'Zap wand';
                defaultActionLabelJa = '振る (z)';
                alternativeActions = [
                    makeAlt('z', defaultSequence, '振る (z)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (catFlag === 'RING') {
                const ringRes = resolveRingAction();
                defaultVerb = ringRes.defaultVerb;
                defaultSequence = ringRes.defaultSequence;
                defaultActionLabel = ringRes.defaultActionLabel;
                defaultActionLabelJa = ringRes.defaultActionLabelJa;
                category = ringRes.category;
                alternativeActions = ringRes.alternativeActions;
            } else if (catFlag === 'AMULET') {
                defaultVerb = 'P';
                defaultSequence = letter ? ['P', letter] : ['P'];
                defaultActionLabel = 'Put on amulet';
                defaultActionLabelJa = '首にかける (P)';
                alternativeActions = [
                    makeAlt('P', defaultSequence, '首にかける (P)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (catFlag === 'ARMOR') {
                defaultVerb = 'W';
                defaultSequence = letter ? ['W', letter] : ['W'];
                defaultActionLabel = 'Wear armor';
                defaultActionLabelJa = '着用する (W)';
                alternativeActions = [
                    makeAlt('W', defaultSequence, '着用する (W)', true),
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else if (catFlag === 'TOOL') {
                if (categoryFlags.isDigWand) {
                    defaultVerb = 'z';
                    defaultSequence = letter ? ['z', letter] : ['z'];
                    defaultActionLabel = 'Zap wand';
                    defaultActionLabelJa = '振る (z)';
                    alternativeActions = [
                        makeAlt('z', defaultSequence, '振る (z)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else {
                    defaultVerb = 'a';
                    defaultSequence = letter ? ['a', letter] : ['a'];
                    defaultActionLabel = 'Apply tool';
                    defaultActionLabelJa = '使う (a)';
                    alternativeActions = [
                        makeAlt('a', defaultSequence, '使う (a)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                }
            } else if (catFlag === 'WEAPON') {
                defaultVerb = 'w';
                defaultSequence = letter ? ['w', letter] : ['w'];
                defaultActionLabel = 'Wield weapon';
                defaultActionLabelJa = '手に持つ (w)';
                alternativeActions = [
                    makeAlt('w', defaultSequence, '手に持つ (w)', true),
                    letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                    letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                ].filter(Boolean);
            } else {
                // 10. テキストパターンによるフォールバック判定
                if (/\b(potion|potions|milky|smoky|cloudy|bubbly|ruby|pink|clear|viscous|effervescent|murky|fizzy|golden|dark|cyan|yellow|emerald|amber|swirly)\b/i.test(cleanText) || /ポーション|薬/.test(cleanText)) {
                    defaultVerb = 'q';
                    defaultSequence = letter ? ['q', letter] : ['q'];
                    defaultActionLabel = 'Quaff potion';
                    defaultActionLabelJa = '飲む (q)';
                    category = 'POTION';
                    alternativeActions = [
                        makeAlt('q', defaultSequence, '飲む (q)', true),
                        letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(ration|food|corpse|tripe|apple|carrot|tin|tins|pear|banana|orange|candy|clove|jelly|pie|pancake|cookie|leaf|garlic|mold|meat|egg|melon|spinach|kelp|lump)\b/i.test(cleanText) || /食料|死体|缶詰|りんご|にんじん|トリップ|パン|パイ|クッキー|コンブ|肉|卵/.test(cleanText)) {
                    defaultVerb = 'e';
                    defaultSequence = letter ? ['e', letter] : ['e'];
                    defaultActionLabel = 'Eat food';
                    defaultActionLabelJa = '食べる (e)';
                    category = 'FOOD';
                    alternativeActions = [
                        makeAlt('e', defaultSequence, '食べる (e)', true),
                        letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(scroll|scrolls|stamped|unlabeled|labeled)\b/i.test(cleanText) || /巻物/.test(cleanText)) {
                    defaultVerb = 'r';
                    defaultSequence = letter ? ['r', letter] : ['r'];
                    defaultActionLabel = 'Read scroll';
                    defaultActionLabelJa = '読む (r)';
                    category = 'SCROLL';
                    alternativeActions = [
                        makeAlt('r', defaultSequence, '読む (r)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(spellbook|spellbooks|book of|paperback|leather-bound|canvas-bound|velvet-bound|parchment|papyrus)\b/i.test(cleanText) || /呪文書|魔法書/.test(cleanText)) {
                    defaultVerb = 'r';
                    defaultSequence = letter ? ['r', letter] : ['r'];
                    defaultActionLabel = 'Read spellbook';
                    defaultActionLabelJa = '勉強する (r)';
                    category = 'SPELLBOOK';
                    alternativeActions = [
                        makeAlt('r', defaultSequence, '勉強する (r)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(wand|wands|balsa|ebony|runed|oak|pine|maple|copper|silver|iron|brass|crystal|marble|platinum|bamboo)\b/i.test(cleanText) || /杖/.test(cleanText) || categoryFlags.isDigWand || categoryFlags.isFrostWand) {
                    defaultVerb = 'z';
                    defaultSequence = letter ? ['z', letter] : ['z'];
                    defaultActionLabel = 'Zap wand';
                    defaultActionLabelJa = '振る (z)';
                    category = 'WAND';
                    alternativeActions = [
                        makeAlt('z', defaultSequence, '振る (z)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(ring|rings|pearl|twisted|wire|engagement|shiny)\b/i.test(cleanText) || /指輪/.test(cleanText)) {
                    defaultVerb = 'P';
                    const hasLeftRing = Array.isArray(itemList) && itemList.some(i => i.isWorn && i.equipSlot === 'ring_left');
                    const hasRightRing = Array.isArray(itemList) && itemList.some(i => i.isWorn && i.equipSlot === 'ring_right');
                    let targetFinger = (hasLeftRing && !hasRightRing) ? 'r' : 'l';
                    defaultSequence = letter ? ['P', letter, targetFinger] : ['P'];
                    defaultActionLabel = 'Put on ring';
                    defaultActionLabelJa = `はめる (P:${targetFinger === 'l' ? '左手' : '右手'})`;
                    category = 'RING';
                    alternativeActions = [
                        makeAlt('P', defaultSequence, `はめる (P:${targetFinger === 'l' ? '左手' : '右手'})`, true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(amulet|amulets|circular|spherical|oval|triangular|pyramidal|square|concave|hexagonal|octagonal)\b/i.test(cleanText) || /魔よけ|魔除け|お守り|アミュレット|護符|首飾り/.test(cleanText)) {
                    defaultVerb = 'P';
                    defaultSequence = letter ? ['P', letter] : ['P'];
                    defaultActionLabel = 'Put on amulet';
                    defaultActionLabelJa = '首にかける (P)';
                    category = 'AMULET';
                    alternativeActions = [
                        makeAlt('P', defaultSequence, '首にかける (P)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(armor|mail|suit|cloak|helm|helmet|boots|shoes|gloves|gauntlets|shield|shirt|robe|hat|cap|apron|coif|bracer)\b/i.test(cleanText) || /鎧|兜|靴|手袋|盾|マント|服|帽子|ローブ/.test(cleanText)) {
                    defaultVerb = 'W';
                    defaultSequence = letter ? ['W', letter] : ['W'];
                    defaultActionLabel = 'Wear armor';
                    defaultActionLabelJa = '着用する (W)';
                    category = 'ARMOR';
                    alternativeActions = [
                        makeAlt('W', defaultSequence, '着用する (W)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (categoryFlags.isKey || categoryFlags.isDigTool || /\b(towel|kit|lamp|lantern|whistle|horn|harp|mirror|leash|touchstone|whetstone|box|chest|sack|bag|blindfold|flute|bell|candle)\b/i.test(cleanText) || /鍵|ピック|タオル|キット|ランプ|笛|鏡|紐|砥石|袋|箱|目隠し/.test(cleanText)) {
                    defaultVerb = 'a';
                    defaultSequence = letter ? ['a', letter] : ['a'];
                    defaultActionLabel = 'Apply tool';
                    defaultActionLabelJa = '使う (a)';
                    category = 'TOOL';
                    alternativeActions = [
                        makeAlt('a', defaultSequence, '使う (a)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else if (/\b(swords?|sabers?|daggers?|knives|knife|axes?|spears?|bows?|arrows?|crossbows?|bolts?|slings?|flint|maces?|flails?|hammers?|lances?|tridents?|staffs?|staves|pick-axes?|mattocks?|darts?|shurikens?|boomerangs?|whips?|scythes?|halberds?|glaives?|javelins?|clubs?|katanas?|wakizashis?|tsurugis?|blades?)\b/i.test(cleanText) || /剣|刀|短剣|ダガー|斧|槍|弓|矢|ツルハシ|棍棒|ハンマー|ダーツ|手裏剣|鞭/.test(cleanText) || categoryFlags.isPickAxe || categoryFlags.isAxe) {
                    defaultVerb = 'w';
                    defaultSequence = letter ? ['w', letter] : ['w'];
                    defaultActionLabel = 'Wield weapon';
                    defaultActionLabelJa = '手に持つ (w)';
                    category = 'WEAPON';
                    alternativeActions = [
                        makeAlt('w', defaultSequence, '手に持つ (w)', true),
                        letter ? makeAlt('t', ['t', letter], '投げる (t)') : null,
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                } else {
                    defaultVerb = 'i';
                    defaultSequence = letter ? ['i', letter] : ['i'];
                    defaultActionLabel = 'Inventory item';
                    defaultActionLabelJa = '一覧から選択 (i)';
                    category = 'OTHER';
                    alternativeActions = [
                        makeAlt('i', defaultSequence, '一覧から選択 (i)', true),
                        letter ? makeAlt('d', ['d', letter], '置く/落とす (d)') : null
                    ].filter(Boolean);
                }
            }
        }

        // 動的アクションの対話レシピ (ActionRecipe) の自動生成
        let defaultActionRecipe = null;
        if (letter) {
            if (defaultVerb === 'z') {
                defaultActionRecipe = ActionRecipeFactory.createZapWandRecipe(letter);
            } else if (defaultVerb === 'e') {
                defaultActionRecipe = ActionRecipeFactory.createEatFoodRecipe(letter);
            } else if (defaultVerb === 'd') {
                defaultActionRecipe = ActionRecipeFactory.createDropItemRecipe(letter);
            } else if (defaultVerb === 't') {
                defaultActionRecipe = ActionRecipeFactory.createThrowItemRecipe(letter, 'DIR_SELF');
            } else if (defaultVerb === 'f') {
                defaultActionRecipe = ActionRecipeFactory.createFireAmmoRecipe('DIR_SELF');
            }
        }

        return {
            defaultVerb,
            defaultSequence,
            defaultActionRecipe,
            defaultActionLabel,
            defaultActionLabelJa,
            category,
            alternativeActions
        };
    }



    /**
     * テキスト表現からの装備状態（Wielded, Offhand, Quivered, Worn, スロット）のパース
     * @param {string} rawText 
     * @param {Object} [categoryFlags={}]
     * @returns {Object} { isWielded, isOffhand, isQuivered, isWorn, equipSlot }
     */
    parseEquipState(rawText, categoryFlags = {}) {
        if (!rawText || typeof rawText !== 'string') {
            return { isWielded: false, isOffhand: false, isQuivered: false, isWorn: false, equipSlot: null };
        }

        let isWielded = false;
        let isOffhand = false;
        let isQuivered = false;
        let isWorn = false;
        let equipSlot = null;

        // 明示的なサブ武器 / 二刀流の副手 (in off hand, in off-hand, alternate weapon; not wielded, 副武器, 逆の手に持っている)
        const isExplicitOffhand = /\b(in off hand|in off-hand|off-hand weapon|alternate weapon)\b/i.test(rawText) || /副武器|逆の手に持っている/i.test(rawText);

        // 武器候補判定 (categoryFlags、または武器・投擲物名キーワード)
        const isWeaponCandidate = (categoryFlags && (
            categoryFlags.category === 'WEAPON' ||
            categoryFlags.isAxe ||
            categoryFlags.isPickAxe ||
            categoryFlags.isAmmo ||
            categoryFlags.isLauncher
        )) || /\b(?:swords?|sabers?|daggers?|knives|knife|axes?|spears?|bows?|arrows?|crossbows?|bolts?|slings?|maces?|flails?|hammers?|lances?|tridents?|staffs?|staves|pick-axes?|mattocks?|darts?|shurikens?|boomerangs?|whips?|scythes?|halberds?|glaives?|javelins?|clubs?|katanas?|wakizashis?|tsurugis?|blades?)\b/i.test(rawText)
           || /(?:剣|刀|短剣|ダガー|斧|槍|弓|矢|ツルハシ|棍棒|ハンマー|ダーツ|手裏剣|鞭)/.test(rawText);

        // 英語のメイン武器装備表現:
        // - (weapon in hand), (weapon in right hand), (weapon in left hand), (weapon in hands)
        // - (wielded), (wielded in right hand), (wielded in left hand)
        // - (tethered to ...)
        const isEnglishWielded = /(?:\bweapon in (?:hands?|right hand|left hand)\b|\bwielded\b|\btethered to\b)/i.test(rawText);

        // 日本語のメイン武器装備表現:
        // - (手に装備中), (右手に装備中), (左手に装備中), (両手に装備中)
        // - (手に持っている), (右手に持っている), (左手に持っている), (両手に持っている)
        // - (武器：右手), (武器：左手), (武器：両手), 武器：手に持っている
        // - (右手持ち), (左手持ち)
        // - (二刀流中), (右手に二刀流中), (左手に二刀流中)
        // - 武器候補かつ (装備中)
        const isJapaneseWielded = /(?:[左右両]?手に装備中|[左右両]?手に持っている|武器：[左右両手]|二刀流中|[左右]手持ち)/.test(rawText) ||
            (isWeaponCandidate && /[\(（]装備中[\)）]/.test(rawText));

        if (isExplicitOffhand) {
            isOffhand = true;
            equipSlot = 'offhand';
        } else if (isEnglishWielded || isJapaneseWielded) {
            // メイン武器 (左利き時の weapon in left hand も含む)
            isWielded = true;
            equipSlot = 'weapon';
        }

        // 矢筒 (in quiver, quivered, at the ready, 準備完了, 矢筒)
        if (/\b(in quiver|quivered|at the ready)\b/i.test(rawText) || /矢筒|準備完了/.test(rawText)) {
            isQuivered = true;
            equipSlot = 'quiver';
        }

        // 着用中 (being worn, on left hand, on right hand, on left finger, on right finger, around neck, on head, on feet, on hands, embedded in shield)
        // ※メイン武器 (isWielded) や副手 (isOffhand) と判定されたアイテムは除外
        if (!isWielded && !isOffhand) {
            if (/\b(being worn|on left hand|on right hand|on left finger|on right finger|around neck|on head|on feet|on hands|embedded in shield)\b/i.test(rawText) || /(着用|装備中|装着中|左手|右手)/i.test(rawText)) {
                isWorn = true;
                if (!equipSlot) {
                    if (/on left hand|on left finger|\(左手\)|\(左手に装着\)|左手/i.test(rawText)) equipSlot = 'ring_left';
                    else if (/on right hand|on right finger|\(右手\)|\(右手に装着\)|右手/i.test(rawText)) equipSlot = 'ring_right';
                    else if (/around neck|首/i.test(rawText) || categoryFlags?.category === 'AMULET' || /\b(amulet|necklace|pendant)\b|首飾り|護符|アミュレット/i.test(rawText)) equipSlot = 'amulet';
                    else if (/shield|盾/i.test(rawText) || categoryFlags?.isShield || categoryFlags?.armorSlot === 'shield') equipSlot = 'shield';
                    else if (categoryFlags?.armorSlot) equipSlot = categoryFlags.armorSlot;
                    else equipSlot = 'worn';
                }
            }
        }

        return {
            isWielded,
            isOffhand,
            isQuivered,
            isWorn,
            equipSlot
        };
    }

    /**
     * テキストパース前処理（レター・数量・BUC・状態・装備タグの削除）
     * @param {string} text 
     * @returns {string} 除去済みテキスト
     */
    cleanItemText(text) {
        if (!text) return '';
        return text
            .replace(/^[a-zA-Z][\s\-\.\)]+/, '') // "a - ", "a) ", "a. " レタープレフィックス削除
            .replace(/\(.*?\)/g, '')             // "(weapon in hand)" 削除
            .replace(/\b(a|an|the|\d+)\b/gi, '') // 冠詞・数値削除
            .replace(/\b(blessed|uncursed|cursed)\b/gi, '') // BUC削除
            .replace(/\b(rusty|corroded|burnt|poisoned|\+\d+|-\d+)\b/gi, '') // 状態・強化値削除
            .trim();
    }

    /**
     * 防具アイテムの装備部位スロット (helm, shield, gloves, boots, cloak, suit, shirt) を解決
     * @param {Object} item 
     * @returns {string} 'helm'|'shield'|'gloves'|'boots'|'cloak'|'suit'|'shirt'
     */
    _resolveArmorSlot(item) {
        if (!item) return 'suit';
        if (item.equipSlot === 'shield') return 'shield';
        if (item.knowledge && item.knowledge.armorSlot) return item.knowledge.armorSlot;
        if (item.armorSlot) return item.armorSlot;
        if (typeof item.onum === 'number' && item.onum >= 0 && OBJECT_KNOWLEDGE_MAP.has(item.onum)) {
            const k = OBJECT_KNOWLEDGE_MAP.get(item.onum);
            if (k && k.armorSlot) return k.armorSlot;
        }
        const text = (item.rawText || '').toLowerCase();
        if (/\b(?:shield)\b|盾/.test(text)) return 'shield';
        if (/\b(?:helm|helmet|hat|cap|cornuthaum|dunce cap)\b|兜|帽子/.test(text)) return 'helm';
        if (/\b(?:gloves?|gauntlets?)\b|手袋|ガントレット/.test(text)) return 'gloves';
        if (/\b(?:boots?|shoes?)\b|靴|ブーツ/.test(text)) return 'boots';
        if (/\b(?:cloak|cape|robe|mantle)\b|外套|マント|ローブ/.test(text)) return 'cloak';
        if (/\b(?:shirt|t-shirt)\b|シャツ|ｔシャツ/i.test(text)) return 'shirt';
        return 'suit';
    }

    // =========================================================================
    // クエリ API (ContextActionEngine & UI から利用)
    // =========================================================================

    /** レター (英字1文字) から指定アイテムオブジェクトを取得 */
    getItemByLetter(letter) {
        if (!letter || typeof letter !== 'string') return null;
        const targetStr = letter.trim();
        return this.items.find(i => i.letter === targetStr) || null;
    }

    /** レター (英字1文字) から指定アイテムのデフォルト推奨アクション情報を取得 */
    getItemDefaultAction(letter) {
        const item = this.getItemByLetter(letter);
        if (!item) return null;
        return {
            letter: item.letter,
            rawText: item.rawText,
            defaultVerb: item.defaultVerb,
            defaultSequence: item.defaultSequence,
            defaultActionRecipe: item.defaultActionRecipe || item.actionRecipe || null,
            actionRecipe: item.actionRecipe || item.defaultActionRecipe || null,
            defaultActionLabel: item.defaultActionLabel,
            defaultActionLabelJa: item.defaultActionLabelJa,
            category: item.category,
            alternativeActions: item.alternativeActions || []
        };
    }

    /** ツルハシ/掘削ツールを取得 (所持していない場合は null)。verb ('a' か 'z') を含む */
    getPickAxe() {
        return this.items.find(i => i.isPickAxe || i.isDigWand || i.isDigTool) || null;
    }

    /** 掘削ツール (ツルハシまたは採掘の杖) を取得 */
    getDigTool() {
        return this.items.find(i => i.isDigTool || i.isPickAxe || i.isDigWand) || null;
    }

    /** 鍵/解錠アイテムを取得 (所持していない場合は null) */
    getKeyOrLockPick() {
        return this.items.find(i => i.isKey) || null;
    }

    /** 斧/伐採アイテムを取得 (所持していない場合は null) */
    getAxe() {
        return this.items.find(i => i.isAxe) || null;
    }

    /** 氷の杖を取得 (所持していない場合は null) */
    getFrostWand() {
        return this.items.find(i => i.isFrostWand) || null;
    }

    /** 手に持っているメイン武器を取得 */
    getWieldedWeapon() {
        return this.items.find(i => i.isWielded) || null;
    }

    /** 二刀流時の副武器 (Off-hand weapon) を取得 */
    getOffhandWeapon() {
        return this.items.find(i => i.isOffhand) || null;
    }

    /** 現在「二刀流」状態かどうか判定 */
    isTwoWeaponing() {
        return !!(this.getWieldedWeapon() && this.getOffhandWeapon());
    }

    /** 矢筒 (Quiver) にセットされているアイテムを取得 */
    getQuiveredItem() {
        return this.items.find(i => i.isQuivered) || null;
    }

    /** 装備中の全アイテムを取得 */
    getEquippedItems() {
        return this.items.filter(i => i.isWielded || i.isOffhand || i.isQuivered || i.isWorn);
    }

    /** スロット別の詳細装備マップを取得 */
    getEquipmentMap() {
        return {
            weapon: this.getWieldedWeapon(),
            offhand: this.getOffhandWeapon(),
            isTwoWeapon: this.isTwoWeaponing(),
            quiver: this.getQuiveredItem(),
            wornList: this.items.filter(i => i.isWorn),
            equippedList: this.getEquippedItems()
        };
    }
}


