/**
 * ItemDisplayPresenter.js
 * 
 * JS層における正規化アイテム (CanonicalItem) の統一表示フォーマッタ / プレゼンタ。
 * 全UI画面 (実インベントリMENU, 拡張インベントリ, コンテナ, ペーパードール, ナレッジモーダル) における
 * アイテム名称、仮名、BUCバッジ、装備状態、強化値の一貫したレンダリングを保証する。
 * 
 * 厳格規約:
 * - 正規表現による文字列削り (.replace) や日本語文字コード判定 (/[\u3040...]/) は 100% 排除。
 * - NetHack 公式 src/objnam.c 仕様に準拠し、強化値 (+N) は武器・防具・weptool・charged指輪のみに表示。
 * - 杖・charged道具はチャージ数 (%d:%d) として安全に表示。
 * 
 * 準拠: docs/3_gkl/canonical_item_schema_and_normalization_architecture.ja.md
 */

import { ItemNormalizer } from '../models/ItemNormalizer.js';
import { OBJECT_KNOWLEDGE_MAP } from '../data/OBJECT_KNOWLEDGE_FULL.js';

export class ItemDisplayPresenter {
    /**
     * アイテムの表示用メインタイトルを取得
     * @param {Object} item - CanonicalItem または任意のアイテムオブジェクト
     * @param {Object} [options={}]
     * @param {'ja'|'en'} [options.language='ja']
     * @param {boolean} [options.sagesWisdomMode=false]
     * @param {boolean} [options.includeLetter=false] - 'a - ' をプレフィックスに含めるか
     * @param {boolean} [options.includeCalled=true] - [仮名: xxx] を含めるか
     * @param {boolean} [options.includeEnchantment=true] - 強化値やチャージ数を含めるか
     * @param {boolean} [options.includeCount=true] - 数量を含めるか
     * @param {boolean} [options.includeBuc=true] - BUCプレフィックスを含めるか
     * @param {boolean} [options.includeEquip=true] - 装備状態サフィックスを含めるか
     * @param {boolean} [options.includeBilingualSubname=false] - 日本語時に (dagger) などの英語真名を併記するか
     * @returns {string} 整形済みタイトル文字列
     */
    static getFormattedTitle(item, options = {}) {
        return ItemNormalizer.formatTitle(item, options);
    }

    /**
     * BUC (祝呪) バッジ HTML を生成
     * @param {Object} item - CanonicalItem またはアイテムオブジェクト
     * @param {Object} [options={}]
     * @param {'ja'|'en'} [options.language='ja']
     * @param {'symbol'|'pill'|'text'} [options.format='symbol'] - 'symbol' (+ / - / ?), 'pill' (ラベル付きバッジ)
     * @returns {string} バッジHTML
     */
    static getBucBadgeHtml(item, options = {}) {
        if (!item) return '';
        const canonical = item._canonical === true ? item : ItemNormalizer.normalize(item);
        const language = options.language === 'en' ? 'en' : 'ja';
        const isEn = language === 'en';
        const format = options.format || 'symbol';
        const isWisdom = Boolean(options.sagesWisdomMode || canonical.isWisdomRevealed || item.isWisdomRevealed || item.identification?.isWisdomRevealed);
        const isUnid = Boolean(canonical.isUnidentified && !isWisdom);
        const buc = canonical.bucStatus || 'UNKNOWN';

        if (format === 'pill') {
            if (isUnid) {
                return `<span class="nh-badge nh-badge-unid" style="background:rgba(234,179,8,0.18);color:#facc15;border:1px solid rgba(234,179,8,0.4);font-size:0.75rem;padding:2px 6px;border-radius:4px;font-weight:600;">🔍 ${isEn ? 'UNIDENTIFIED' : '未識別'}</span>`;
            }
            if (isWisdom && canonical.isUnidentified) {
                return `<span class="nh-badge nh-badge-wisdom" style="background:rgba(168,85,247,0.2);color:#e9d5ff;border:1px solid rgba(168,85,247,0.5);font-size:0.75rem;padding:2px 6px;border-radius:4px;font-weight:600;">🧙 ${isEn ? "Sage's Wisdom" : '賢者の知恵'}</span>`;
            }
            if (buc === 'BLESSED') {
                return `<span class="nh-badge nh-badge-blessed" style="background:rgba(34,197,94,0.2);color:#4ade80;border:1px solid rgba(34,197,94,0.4);font-size:0.75rem;padding:2px 6px;border-radius:4px;font-weight:600;">✨ ${isEn ? 'BLESSED' : '祝福'}</span>`;
            }
            if (buc === 'CURSED') {
                return `<span class="nh-badge nh-badge-danger" style="background:rgba(239,68,68,0.2);color:#f87171;border:1px solid rgba(239,68,68,0.4);font-size:0.75rem;padding:2px 6px;border-radius:4px;font-weight:600;">💀 ${isEn ? 'CURSED' : '呪い'}</span>`;
            }
            if (buc === 'UNCURSED') {
                return `<span class="nh-badge nh-badge-uncursed" style="background:rgba(148,163,184,0.2);color:#cbd5e1;border:1px solid rgba(148,163,184,0.3);font-size:0.75rem;padding:2px 6px;border-radius:4px;font-weight:600;">⚪ ${isEn ? 'UNCURSED' : '通常'}</span>`;
            }
            return '';
        }

        // 'symbol' フォーマット (スロットやグリッド内のミニバッジ)
        if (buc === 'CURSED') {
            const title = isWisdom && canonical.isUnidentified
                ? (isEn ? "Cursed (Sage's Wisdom)" : '呪い (賢者の知恵)')
                : isUnid
                    ? (isEn ? 'Cursed (Unidentified)' : '呪い (未識別)')
                    : (isEn ? 'Cursed' : '呪い');
            return `<span class="slot-badge badge-buc-cursed" title="${title}">-</span>`;
        }
        if (buc === 'BLESSED') {
            const title = isWisdom && canonical.isUnidentified
                ? (isEn ? "Blessed (Sage's Wisdom)" : '祝福 (賢者の知恵)')
                : isUnid
                    ? (isEn ? 'Blessed (Unidentified)' : '祝福 (未識別)')
                    : (isEn ? 'Blessed' : '祝福');
            return `<span class="slot-badge badge-buc-blessed" title="${title}">+</span>`;
        }
        if (isWisdom && canonical.isUnidentified) {
            return `<span class="slot-badge badge-buc-wisdom" title="${isEn ? "Sage's Wisdom" : '賢者の知恵'}">🧙</span>`;
        }
        if (isUnid && buc === 'UNKNOWN') {
            return `<span class="slot-badge badge-buc-unid" title="${isEn ? 'Unidentified' : '未識別'}">?</span>`;
        }
        return '';
    }

    /**
     * 装備状態バッジ HTML を生成
     * @param {Object} item 
     * @param {Object} [options={}]
     * @param {'ja'|'en'} [options.language='ja']
     * @returns {string} バッジHTML
     */
    static getEquipBadgeHtml(item, options = {}) {
        if (!item) return '';
        const canonical = item._canonical === true ? item : ItemNormalizer.normalize(item);
        const language = options.language === 'en' ? 'en' : 'ja';
        const isEn = language === 'en';

        if (canonical.isWielded) {
            return `<span class="slot-badge badge-wielded" title="${isEn ? 'Main weapon' : 'メイン武器'}">${isEn ? 'W' : '手'}</span>`;
        }
        if (canonical.isOffhand) {
            return `<span class="slot-badge badge-offhand" title="${isEn ? 'Off-hand weapon' : '副武器'}">${isEn ? 'O' : '副'}</span>`;
        }
        if (canonical.isQuivered) {
            return `<span class="slot-badge badge-quivered" title="${isEn ? 'Quiver' : '矢筒'}">${isEn ? 'Q' : '筒'}</span>`;
        }
        if (canonical.isWorn) {
            return `<span class="slot-badge badge-worn" title="${isEn ? 'Worn armor/accessory' : '着用防具・装身具'}">${isEn ? 'A' : '着'}</span>`;
        }
        return '';
    }

    /**
     * 仮名 (calledName) タグ HTML を生成
     * @param {Object} item 
     * @param {Object} [options={}]
     * @param {'ja'|'en'} [options.language='ja']
     * @returns {string}
     */
    static getCalledTagHtml(item, options = {}) {
        if (!item) return '';
        const canonical = item._canonical === true ? item : ItemNormalizer.normalize(item);
        if (!canonical.calledName) return '';
        const language = options.language === 'en' ? 'en' : 'ja';
        const isEn = language === 'en';

        return `<span class="tag tag-called" style="background:rgba(168,85,247,0.25);color:#e9d5ff;border:1px solid rgba(168,85,247,0.5);font-weight:bold;padding:1px 6px;border-radius:4px;font-size:0.75rem;">${isEn ? `🏷️ Called: ${canonical.calledName}` : `🏷️ 仮名: ${canonical.calledName}`}</span>`;
    }

    /**
     * 個別銘 (namedInstance) タグ HTML を生成
     * @param {Object} item 
     * @param {Object} [options={}]
     * @param {'ja'|'en'} [options.language='ja']
     * @returns {string}
     */
    static getNamedTagHtml(item, options = {}) {
        if (!item) return '';
        const canonical = item._canonical === true ? item : ItemNormalizer.normalize(item);
        if (!canonical.namedInstance) return '';
        const language = options.language === 'en' ? 'en' : 'ja';
        const isEn = language === 'en';

        return `<span class="tag tag-named" style="background:rgba(59,130,246,0.25);color:#93c5fd;border:1px solid rgba(59,130,246,0.5);font-weight:bold;padding:1px 6px;border-radius:4px;font-size:0.75rem;">${isEn ? `🗡️ Named: ${canonical.namedInstance}` : `🗡️ 銘: ${canonical.namedInstance}`}</span>`;
    }

    /**
     * 強化値バッジ HTML を生成
     * @param {Object} item 
     * @returns {string}
     */
    static getEnchantmentBadgeHtml(item) {
        if (!item) return '';
        const canonical = item._canonical === true ? item : ItemNormalizer.normalize(item);
        if (typeof canonical.spe !== 'number') return '';
        const speStr = canonical.spe >= 0 ? `+${canonical.spe}` : `${canonical.spe}`;
        const color = canonical.spe > 0 ? '#4ade80' : (canonical.spe < 0 ? '#f87171' : '#94a3b8');
        return `<span class="badge-enchantment" style="color:${color};font-weight:bold;font-size:0.78rem;">${speStr}</span>`;
    }

    /**
     * 実インベントリメニューやリスト行用の統一 HTML コンポーネントを出力
     * @param {Object} item 
     * @param {Object} [options={}]
     * @param {'ja'|'en'} [options.language='ja']
     * @param {Object} [options.core=null]
     * @param {string} [options.tileImagePath='']
     * @returns {string}
     */
    static getItemMenuRowContentHtml(item, options = {}) {
        if (!item) return '';
        const canonical = item._canonical === true ? item : ItemNormalizer.normalize(item);
        const language = options.language === 'en' ? 'en' : 'ja';
        const core = options.core || null;
        const tileImgPath = options.tileImagePath || '';
        const sagesWisdomMode = Boolean(options.sagesWisdomMode);

        // 1. レターバッジ
        const chStr = canonical.letter || '';
        const letterHtml = chStr ? `<strong style="color:var(--accent-gold);margin-right:6px;">${chStr})</strong>` : '';

        // 2. タイルグリフ
        let glyphHtml = '';
        const glyphId = canonical.glyphId >= 0 ? canonical.glyphId : -1;
        if (glyphId >= 0 && core && typeof core.getGlyphHtml === 'function') {
            glyphHtml = core.getGlyphHtml(glyphId, { displaySize: 20, tileImage: tileImgPath });
        }

        // 3. 装備バッジ
        const equipBadge = this.getEquipBadgeHtml(canonical, { language });

        // 4. BUCバッジ
        const bucBadge = this.getBucBadgeHtml(canonical, { language, format: 'symbol', sagesWisdomMode });

        // 5. 表示名称 (和名 / 英名 + 仮名)
        const title = this.getFormattedTitle(canonical, {
            language,
            includeLetter: false,
            includeCalled: true,
            sagesWisdomMode,
            includeBuc: false,
            includeEquip: false
        });

        return `
          <div style="display:inline-flex;align-items:center;gap:6px;width:100%;text-align:left;">
            ${letterHtml}
            ${glyphHtml ? `<span style="display:inline-flex;align-items:center;">${glyphHtml}</span>` : ''}
            ${equipBadge}
            ${bucBadge}
            <span class="item-name-text" style="flex:1;">${title}</span>
          </div>
        `.trim();
    }

    static _getCategoryDefaultNameJa(category) {
        const cat = String(category || '').toUpperCase();
        switch (cat) {
            case 'POTION': return '薬';
            case 'SCROLL': return '巻物';
            case 'WAND': return '杖';
            case 'RING': return '指輪';
            case 'AMULET': return '魔除け';
            case 'SPELLBOOK': return '魔法書';
            case 'ARMOR': return '防具';
            case 'WEAPON': return '武器';
            case 'TOOL': return '道具';
            case 'FOOD': return '食料';
            case 'GEM': return '宝石';
            case 'ROCK': return '石';
            default: return 'アイテム';
        }
    }

    static _getCategoryDefaultNameEn(category) {
        const cat = String(category || '').toUpperCase();
        switch (cat) {
            case 'POTION': return 'potion';
            case 'SCROLL': return 'scroll';
            case 'WAND': return 'wand';
            case 'RING': return 'ring';
            case 'AMULET': return 'amulet';
            case 'SPELLBOOK': return 'spellbook';
            case 'ARMOR': return 'armor';
            case 'WEAPON': return 'weapon';
            case 'TOOL': return 'tool';
            case 'FOOD': return 'food';
            case 'GEM': return 'gem';
            case 'ROCK': return 'rock';
            default: return 'item';
        }
    }
}
