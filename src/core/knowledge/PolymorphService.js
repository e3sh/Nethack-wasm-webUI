/**
 * PolymorphService.js
 * 
 * 変化制御 (Polymorph Control) アシスタントの中核サービスクラス。
 * - canPolymorph: true のモンスターを ALL_MONSTER_KNOWLEDGE_BASE から動的抽出
 * - TranslationEngine を用いた日英バイリンガル検索・表示（SSOT原則）
 * - 変身時の防具破壊警告 (size: LARGE, HUGE, GIGANTIC) の判定
 * - 耐性、飛行・壁抜け等の特殊能力、装備可能判定の構造化提示
 * - 目的別定番変身プリセットの提供
 */

import { ALL_MONSTER_KNOWLEDGE_BASE } from './MONSTER_KNOWLEDGE_FULL.js';

export class PolymorphService {
    /**
     * @param {Object} [options]
     * @param {Object} [options.translationEngine] TranslationEngine インスタンス
     * @param {string} [options.language='ja'] デフォルト言語 ('ja' | 'en')
     */
    constructor(options = {}) {
        this.translationEngine = options.translationEngine || null;
        this.language = options.language || 'ja';

        // canPolymorph なモンスター一覧をキャッシュ
        this._polyCandidates = null;
    }

    /**
     * 言語設定を更新
     * @param {string} lang 
     */
    setLanguage(lang) {
        this.language = lang;
    }

    /**
     * TranslationEngine を設定
     * @param {Object} engine 
     */
    setTranslationEngine(engine) {
        this.translationEngine = engine;
    }

    /**
     * NetHack Cコアに送信可能な形式にモンスター名をサニタイズ（{...} 注釈の除去など）
     * 例: "vampire leader {vampire lord}" -> "vampire lord" または "vampire leader"
     * @param {string} rawName 
     * @returns {string}
     */
    static cleanMonsterName(rawName) {
        if (!rawName) return '';
        // 波括弧がある場合、括弧内の表記（より通称・別名として馴染みがある場合が多い）を優先するか、
        // または NetHack が認識できるプレーン名に成形
        const altMatch = rawName.match(/\{([^}]+)\}/);
        if (altMatch && altMatch[1]) {
            return altMatch[1].trim();
        }
        return rawName.replace(/\{[^}]+\}/g, '').trim();
    }

    /**
     * 変身可能なモンスター一覧を取得
     * @returns {Array<Object>}
     */
    getPolymorphCandidates() {
        if (!this._polyCandidates) {
            this._polyCandidates = ALL_MONSTER_KNOWLEDGE_BASE.filter(m => m.canPolymorph === true);
        }

        return this._polyCandidates.map(m => this._enrichMonsterEntry(m));
    }

    /**
     * 目的別の定番変身プリセットを取得
     * @returns {Object} カテゴリ別のプリセット定義
     */
    getPresets() {
        const presets = [
            {
                categoryKey: 'combat',
                categoryLabelJa: '戦闘・防御特化',
                categoryLabelEn: 'Combat & Defense',
                items: [
                    {
                        nameEn: 'silver dragon',
                        noteJa: '反射, 電撃耐性, 飛行, 冷気/炎/毒耐性',
                        noteEn: 'Reflection, Shock res, Flying, Breath weapon',
                        reason: 'defense'
                    },
                    {
                        nameEn: 'gray dragon',
                        noteJa: '魔法抵抗, 飛行, 元素耐性',
                        noteEn: 'Magic resistance, Flying',
                        reason: 'magic_res'
                    },
                    {
                        nameEn: 'black dragon',
                        noteJa: '分解耐性, 即死ブレス, 飛行',
                        noteEn: 'Disintegration res, Death breath, Flying',
                        reason: 'disintegration'
                    }
                ]
            },
            {
                categoryKey: 'magic_caster',
                categoryLabelJa: '魔法・万能',
                categoryLabelEn: 'Magic & Versatile',
                items: [
                    {
                        nameEn: 'master lich',
                        noteJa: '冷気/電撃/毒耐性, 手あり・装備可能, 瞬間移動',
                        noteEn: 'Cold/Shock/Poison res, Has hands, Teleport',
                        reason: 'caster'
                    },
                    {
                        nameEn: 'titan',
                        noteJa: '巨人力, 魔法耐性, 手あり・防具破壊なし',
                        noteEn: 'Giant strength, Magic res, Has hands',
                        reason: 'strength'
                    },
                    {
                        nameEn: 'vampire lord',
                        noteJa: '飛行, 手あり, 生命力吸収, 再生',
                        noteEn: 'Flying, Has hands, Drain life, Regen',
                        reason: 'undead'
                    }
                ]
            },
            {
                categoryKey: 'utility',
                categoryLabelJa: '移動・探索ユーティリティ',
                categoryLabelEn: 'Utility & Exploration',
                items: [
                    {
                        nameEn: 'xorn',
                        noteJa: '壁抜け (土・岩の中を移動可能), 岩石喰い ※鎧破壊注意',
                        noteEn: 'Phasing (walk through walls), Stone eater *Breaks armor',
                        reason: 'phasing'
                    },
                    {
                        nameEn: 'jabberwock',
                        noteJa: '超高速高火力近接戦闘, 飛行 ※鎧破壊注意',
                        noteEn: 'Very fast high-damage melee, Flying *Breaks armor',
                        reason: 'speed_melee'
                    }
                ]
            }
        ];

        // 各アイテムに日本語名や詳細スペックを付与
        return presets.map(category => ({
            ...category,
            label: this.language === 'ja' ? category.categoryLabelJa : category.categoryLabelEn,
            items: category.items.map(item => {
                const mon = this.findMonsterByName(item.nameEn);
                return {
                    ...item,
                    nameJa: this._translateName(item.nameEn),
                    displayName: this.language === 'ja' && this._translateName(item.nameEn) ? this._translateName(item.nameEn) : item.nameEn,
                    note: this.language === 'ja' ? item.noteJa : item.noteEn,
                    monster: mon
                };
            })
        }));
    }

    /**
     * 変身時の防具リスクを NetHack C言語コア仕様（breakarm / sliparm / break_armor）に準拠して判定
     * - sliparm (渦巻き, 小型/極小, 非実体): 壊れず足元に脱落
     * - breakarm (大型, または中型以上で非人型): 着用中の鎧・シャツを突き破って破壊！
     * - has_horns: 兜が破壊または脱落
     * - nohands / verysmall: 手袋・盾・武器・兜が脱落
     * - nohands / verysmall / slithy / centaur: ブーツが脱落
     *
     * @param {Object|string} monsterOrName モンスター情報または名前/サイズ文字列
     * @returns {{
     *   willBreakArmor: boolean,
     *   willDropArmor: boolean,
     *   breaksSuit: boolean,
     *   breaksShirt: boolean,
     *   dropsCloak: boolean,
     *   dropsGloves: boolean,
     *   dropsShield: boolean,
     *   dropsHelmet: boolean,
     *   dropsBoots: boolean,
     *   severity: 'DANGER' | 'WARNING' | 'SAFE',
     *   size: string,
     *   messageJa: string,
     *   messageEn: string,
     *   detailsJa: string[],
     *   detailsEn: string[]
     * }}
     */
    checkArmorRisk(monsterOrName) {
        let mon = null;
        if (typeof monsterOrName === 'string') {
            mon = this.findMonsterByName(monsterOrName);
            if (!mon && ['TINY', 'SMALL', 'MEDIUM', 'LARGE', 'HUGE', 'GIGANTIC'].includes(monsterOrName.toUpperCase())) {
                mon = { size: monsterOrName.toUpperCase() };
            }
        } else if (monsterOrName && typeof monsterOrName === 'object') {
            mon = monsterOrName;
        }

        const size = (mon && mon.size ? mon.size : 'MEDIUM').toUpperCase();
        const cleanName = mon && mon.name ? mon.name.toLowerCase().replace(/\{[^}]+\}/g, '').trim() : '';

        // 特殊属性
        const isWhirly = mon?.isWhirly || /vortex|whirlwind|air elemental/i.test(cleanName);
        const isNoncorporeal = mon?.isNoncorporeal || /ghost|shade/i.test(cleanName);
        const isSmallOrTiny = size === 'TINY' || size === 'SMALL';
        const isLargeOrBigger = size === 'LARGE' || size === 'HUGE' || size === 'GIGANTIC';

        // 人型判定 (M1_HUMANOID):
        // canWearArmor が true のものは基本的に人型。または humanoid/クラス判定
        const isHumanoid = mon?.isHumanoid ?? (
            mon?.canWearArmor ?? (
                mon?.className === 'human' ||
                mon?.className === 'elf' ||
                mon?.className === 'dwarf' ||
                mon?.className === 'gnome' ||
                mon?.className === 'orc' ||
                mon?.className === 'vampire' ||
                /human|elf|dwarf|gnome|orc|vampire|lich|titan|giant/i.test(cleanName)
            )
        );

        // 特殊な例外 (marilith, winged gargoyle は人型だがスーツ破壊)
        const isSuitException = cleanName === 'marilith' || cleanName === 'winged gargoyle';

        // 1. sliparm: 防具が脱落（壊れずに滑り落ちる）
        const sliparm = isWhirly || isSmallOrTiny || isNoncorporeal;

        // 2. breakarm: 鎧・シャツを突き破って破壊！
        let breakarm = false;
        if (!sliparm) {
            if (isLargeOrBigger || (!isHumanoid && size !== 'SMALL' && size !== 'TINY') || isSuitException) {
                breakarm = true;
            }
        }

        // 部位別脱落フラグ
        const hasHorns = mon?.hasHorns || /horned|minotaur|unicorn/i.test(cleanName);
        const noHands = mon ? !mon.hasHands : false;
        const verySmall = size === 'TINY';
        const slithyOrCentaur = mon?.isSlithy || mon?.symbol === 'c' || mon?.className === 'centaur' || /snake|naga|worm|eel/i.test(cleanName);

        const dropsGloves = noHands || verySmall;
        const dropsShield = noHands || verySmall;
        const dropsHelmet = hasHorns || noHands || verySmall;
        const dropsBoots = noHands || verySmall || slithyOrCentaur;

        if (breakarm) {
            const detailsJa = ['胴体の鎧・シャツは破壊されます！'];
            const detailsEn = ['Torso armor and shirt will be destroyed!'];
            detailsJa.push('マントは留め金が外れて足元に脱落します。');
            detailsEn.push('Cloak will unfasten and drop to the floor.');
            if (dropsGloves) { detailsJa.push('手袋は脱落します。'); detailsEn.push('Gloves will drop.'); }
            if (dropsShield) { detailsJa.push('盾は持てなくなって脱落します。'); detailsEn.push('Shield will drop.'); }
            if (dropsHelmet) { detailsJa.push('兜は脱落または破損します。'); detailsEn.push('Helmet will drop or break.'); }
            if (dropsBoots) { detailsJa.push('ブーツは脱落します。'); detailsEn.push('Boots will drop.'); }

            return {
                willBreakArmor: true,
                willDropArmor: true,
                breaksSuit: true,
                breaksShirt: true,
                dropsCloak: true,
                dropsGloves,
                dropsShield,
                dropsHelmet,
                dropsBoots,
                severity: 'DANGER',
                size,
                messageJa: `⚠️ 防具破壊警告: 体型不一致(非人型/${size})のため、着用中の鎧・シャツが破壊されます！`,
                messageEn: `⚠️ Armor Destruction: Due to body shape (non-humanoid/${size}), worn armor and shirt will be broken!`,
                detailsJa,
                detailsEn
            };
        }

        if (sliparm) {
            return {
                willBreakArmor: false,
                willDropArmor: true,
                breaksSuit: false,
                breaksShirt: false,
                dropsCloak: true,
                dropsGloves: true,
                dropsShield: true,
                dropsHelmet: true,
                dropsBoots: true,
                severity: 'WARNING',
                size,
                messageJa: 'ℹ️ 小型・非実体のため、着用防具は破壊されず足元に脱落します。',
                messageEn: 'ℹ️ Due to small/noncorporeal form, worn armor will safely drop without breaking.',
                detailsJa: ['防具はすべて足元に落ちます（破壊はされません）。'],
                detailsEn: ['All armor drops to the floor safely without breaking.']
            };
        }

        // breakarm でも sliparm でもない場合（人型で中型）
        // ただし手袋や兜やブーツが脱落するかチェック
        if (dropsGloves || dropsShield || dropsHelmet || dropsBoots) {
            const parts = [];
            const partsEn = [];
            if (dropsGloves) { parts.push('手袋'); partsEn.push('gloves'); }
            if (dropsShield) { parts.push('盾'); partsEn.push('shield'); }
            if (dropsHelmet) { parts.push('兜'); partsEn.push('helmet'); }
            if (dropsBoots) { parts.push('ブーツ'); partsEn.push('boots'); }

            return {
                willBreakArmor: false,
                willDropArmor: true,
                breaksSuit: false,
                breaksShirt: false,
                dropsCloak: false,
                dropsGloves,
                dropsShield,
                dropsHelmet,
                dropsBoots,
                severity: 'WARNING',
                size,
                messageJa: `⚠️ 胴体防具は安全ですが、一部の装備(${parts.join('・')})が脱落します。`,
                messageEn: `⚠️ Body armor is safe, but some gear (${partsEn.join(', ')}) will drop.`,
                detailsJa: [`脱落部位: ${parts.join(', ')}`],
                detailsEn: [`Dropping items: ${partsEn.join(', ')}`]
            };
        }

        return {
            willBreakArmor: false,
            willDropArmor: false,
            breaksSuit: false,
            breaksShirt: false,
            dropsCloak: false,
            dropsGloves: false,
            dropsShield: false,
            dropsHelmet: false,
            dropsBoots: false,
            severity: 'SAFE',
            size,
            messageJa: '🛡️ 防具を破壊することなく安全に変身・着用維持が可能です。',
            messageEn: '🛡️ Safe to polymorph and keep wearing armor.',
            detailsJa: [],
            detailsEn: []
        };
    }

    /**
     * モンスター名（英名または和名）で完全一致・エイリアス一致検索
     * @param {string} name 
     * @returns {Object|null}
     */
    findMonsterByName(name) {
        if (!name) return null;
        const query = name.trim().toLowerCase();
        const all = this.getPolymorphCandidates();

        return all.find(m => {
            const n = m.name.toLowerCase();
            const clean = n.replace(/\{[^}]+\}/g, '').trim();
            const altMatch = n.match(/\{([^}]+)\}/);
            const alt = altMatch ? altMatch[1].trim().toLowerCase() : null;
            const ja = (m.nameJa || '').toLowerCase();
            const aliases = (m.aliases || []).map(a => a.toLowerCase());

            return n === query || 
                   clean === query || 
                   (alt && alt === query) || 
                   ja === query || 
                   aliases.includes(query);
        }) || null;
    }

    /**
     * インクリメンタル検索・フィルタ
     * @param {string} query 検索キーワード
     * @param {Object} [filters] フィルタ条件
     * @param {boolean} [filters.hasHands] 手があるか
     * @param {boolean} [filters.canFly] 飛行できるか
     * @param {boolean} [filters.passesWalls] 壁抜けできるか
     * @param {boolean} [filters.safeArmor] 防具破壊なし (size <= MEDIUM)
     * @returns {Array<Object>}
     */
    searchCandidates(query, filters = {}) {
        let results = this.getPolymorphCandidates();
        const q = (query || '').trim().toLowerCase();

        if (q) {
            results = results.filter(m => {
                const matchEn = m.name.toLowerCase().includes(q);
                const matchJa = m.nameJa ? m.nameJa.toLowerCase().includes(q) : false;
                const matchSymbol = m.symbol.toLowerCase() === q;
                return matchEn || matchJa || matchSymbol;
            });
        }

        if (filters.hasHands) {
            results = results.filter(m => m.hasHands === true);
        }
        if (filters.canFly) {
            results = results.filter(m => m.canFly === true);
        }
        if (filters.passesWalls) {
            results = results.filter(m => m.passesWalls === true);
        }
        if (filters.safeArmor) {
            results = results.filter(m => {
                const risk = this.checkArmorRisk(m);
                return !risk.willBreakArmor;
            });
        }

        return results;
    }

    /**
     * モンスターエントリに和名や防具警告などの補足情報を付与
     * @private
     */
    _enrichMonsterEntry(mon) {
        const nameJa = this._translateName(mon.name) || mon.nameJa || null;
        const armorRisk = this.checkArmorRisk(mon);
        const cleanName = PolymorphService.cleanMonsterName(mon.name);

        return {
            ...mon,
            cleanName: cleanName,
            nameJa: nameJa,
            displayName: this.language === 'ja' && nameJa ? nameJa : (cleanName || mon.name),
            armorRisk: armorRisk
        };
    }

    /**
     * 英名から和名を動的に翻訳（SSOT）
     * @private
     */
    _translateName(enName) {
        if (this.translationEngine) {
            if (typeof this.translationEngine.translateMonster === 'function') {
                const res = this.translationEngine.translateMonster(enName);
                if (res && res !== enName) return res;
            }
            if (typeof this.translationEngine.translate === 'function') {
                const res = this.translationEngine.translate(enName);
                if (res && res !== enName) return res;
            }
            if (typeof this.translationEngine.t === 'function') {
                const res = this.translationEngine.t(enName);
                if (res && res !== enName) return res;
            }
        }
        return null;
    }
}
