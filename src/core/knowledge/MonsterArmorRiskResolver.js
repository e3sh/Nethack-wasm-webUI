/**
 * MonsterArmorRiskResolver.js
 * NetHack 5.0 (3.7) 変身時防具破壊・脱落リスク判定 SSOT モジュール
 *
 * C言語コア（breakarm / sliparm / break_armor）に準拠:
 * - sliparm (渦巻き, 小型/極小, 非実体): 壊れず足元に脱落
 * - breakarm (大型, または中型以上で非人型): 着用中の鎧・シャツを突き破って破壊！
 * - has_horns: 兜が破壊または脱落
 * - nohands / verysmall: 手袋・盾・武器・兜が脱落
 * - nohands / verysmall / slithy / centaur: ブーツが脱落
 */

export class MonsterArmorRiskResolver {
    /**
     * 変身時の防具リスクを判定
     * @param {Object|string} monsterOrName モンスター情報または名前/サイズ文字列
     * @param {Function} [monsterLookupFn] 名前からモンスターを取得する関数 (省略時は簡易判定)
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
    static checkArmorRisk(monsterOrName, monsterLookupFn = null) {
        let mon = null;
        if (typeof monsterOrName === 'string') {
            if (typeof monsterLookupFn === 'function') {
                mon = monsterLookupFn(monsterOrName);
            }
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
                messageJa: `⚠️ 一部防具脱落: ${parts.join('・')}が足元に脱落します。`,
                messageEn: `⚠️ Partial Armor Drop: ${partsEn.join(', ')} will drop to the floor.`,
                detailsJa: parts.map(p => `${p}は脱落します。`),
                detailsEn: partsEn.map(p => `${p} will drop.`)
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
            messageJa: '✅ 安全: 全身の防具を破壊せず着用したまま変身できます。',
            messageEn: '✅ Safe: All worn armor can be safely retained without breaking.',
            detailsJa: ['防具破壊・脱落のリスクはありません。'],
            detailsEn: ['No risk of armor damage or dropping.']
        };
    }
}
