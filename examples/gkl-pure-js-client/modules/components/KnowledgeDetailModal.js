import { getAdaptiveItemSpecs } from "../../../../src/core/knowledge/presenters/ItemSpecPresenter.js";

const ATTACK_TYPE_LABELS = {
  ja: {
    'weapon/hit': '武器/打撃',
    'weapon': '武器攻撃',
    'hit': '打撃',
    'bite': '噛みつき',
    'claw': 'ひっかき',
    'sting': '刺突',
    'touch': '接触',
    'butt': '頭突き/角',
    'gash': '引き裂き',
    'tentacle': '触手',
    'wrap': '巻きつき',
    'gaze': '凝視',
    'breath': 'ブレス',
    'brea': 'ブレス',
    'spell': '呪文詠唱',
    'explode': '自爆',
    'hiss': '威嚇',
    'passive': '受動反撃',
    'psychic': '精神波'
  },
  en: {
    'weapon/hit': 'Weapon/Hit',
    'weapon': 'Weapon',
    'hit': 'Hit',
    'bite': 'Bite',
    'claw': 'Claw',
    'sting': 'Sting',
    'touch': 'Touch',
    'butt': 'Butt',
    'gash': 'Gash',
    'tentacle': 'Tentacle',
    'wrap': 'Wrap',
    'gaze': 'Gaze',
    'breath': 'Breath',
    'brea': 'Breath',
    'spell': 'Spell',
    'explode': 'Explode',
    'hiss': 'Hiss',
    'passive': 'Passive',
    'psychic': 'Psychic'
  }
};

const ATTACK_EFFECT_LABELS = {
  ja: {
    'poison': '毒',
    'fire': '火炎',
    'cold': '冷気',
    'shock': '電撃',
    'acid': '酸',
    'paralysis': '麻痺',
    'petrify': '石化',
    'lycanthropy': '獣化病',
    'drain_level': 'レベルドレイン',
    'brain_eat': '脳食い即死',
    'slime': 'スライム化',
    'disintegration': '分解',
    'instant_death': '即死',
    'sleep': '睡眠',
    'confusion': '混乱',
    'blind': '盲目',
    'sickness': '病気',
    'starvation': '飢餓',
    'rust': '錆',
    'curse_items': 'アイテム呪い',
    'disenchant': '劣化',
    'steal_item': 'アイテム盗み',
    'steal_amulet': '魔除け盗み',
    'drown': '溺死',
    'stick': '付着',
    'swallow': '丸呑み',
    'summon': '召喚',
    'explosion': '爆発',
    'magic_missile': '魔法の矢'
  },
  en: {
    'poison': 'Poison',
    'fire': 'Fire',
    'cold': 'Cold',
    'shock': 'Shock',
    'acid': 'Acid',
    'paralysis': 'Paralysis',
    'petrify': 'Petrification',
    'lycanthropy': 'Lycanthropy',
    'drain_level': 'Level Drain',
    'brain_eat': 'Brain Eat',
    'slime': 'Slime',
    'disintegration': 'Disintegration',
    'instant_death': 'Instant Death',
    'sleep': 'Sleep',
    'confusion': 'Confusion',
    'blind': 'Blindness',
    'sickness': 'Sickness',
    'starvation': 'Starvation',
    'rust': 'Rust',
    'curse_items': 'Curse Items',
    'disenchant': 'Disenchant',
    'steal_item': 'Steal Item',
    'steal_amulet': 'Steal Amulet',
    'drown': 'Drown',
    'stick': 'Stick',
    'swallow': 'Swallow',
    'summon': 'Summon',
    'explosion': 'Explosion',
    'magic_missile': 'Magic Missile'
  }
};

/**
 * 攻撃データをフォーマットして人間可読な文字列・HTMLを生成
 * @param {string|Object} atk 
 * @param {boolean} isEn 
 * @returns {string}
 */
export function formatMonsterAttack(atk, isEn) {
  if (typeof atk === 'string') return atk;
  if (!atk || typeof atk !== 'object') return '';

  if (atk.desc) return atk.desc;
  if (atk.name) return atk.name;

  const lang = isEn ? 'en' : 'ja';
  const typeKey = (atk.type || '').toLowerCase();
  const typeLabel = (ATTACK_TYPE_LABELS[lang] && ATTACK_TYPE_LABELS[lang][typeKey]) || atk.type || (isEn ? 'Attack' : '攻撃');

  const damageStr = atk.damage ? `(${atk.damage})` : '';

  let effectStr = '';
  let badgeStr = '';
  if (atk.effect && atk.effect !== 'none') {
    const effectKey = String(atk.effect).toLowerCase();
    const effectLabel = (ATTACK_EFFECT_LABELS[lang] && ATTACK_EFFECT_LABELS[lang][effectKey]) || atk.effect;
    effectStr = isEn ? ` - ${effectLabel}` : ` [${effectLabel}]`;

    if (effectKey === 'petrify') {
      badgeStr = `<span class="kn-pill kn-lethal" style="margin-left:6px;">⚠️ ${isEn ? 'Fatal Petrification' : '石化即死危険'}</span>`;
    } else if (effectKey === 'brain_eat') {
      badgeStr = `<span class="kn-pill kn-lethal" style="margin-left:6px;">⚠️ ${isEn ? 'Lethal Brain-eating' : '脳食い即死危険'}</span>`;
    } else if (effectKey === 'drain_level') {
      badgeStr = `<span class="kn-pill kn-lethal" style="margin-left:6px;">⚠️ ${isEn ? 'Level Drain' : 'レベルドレイン'}</span>`;
    } else if (effectKey === 'instant_death') {
      badgeStr = `<span class="kn-pill kn-lethal" style="margin-left:6px;">⚠️ ${isEn ? 'Instant Death' : '即死危険'}</span>`;
    } else if (effectKey === 'paralysis') {
      badgeStr = `<span class="kn-pill kn-poison" style="margin-left:6px;">⚡ ${isEn ? 'Paralysis' : '麻痺危険'}</span>`;
    } else if (effectKey === 'poison') {
      badgeStr = `<span class="kn-pill kn-poison" style="margin-left:6px;">☠️ ${isEn ? 'Poison' : '毒効果'}</span>`;
    }
  }

  let icon = '⚔️';
  if (typeKey === 'breath' || typeKey === 'brea') icon = '💨';
  else if (typeKey === 'gaze') icon = '👁️';
  else if (typeKey === 'explode') icon = '💥';
  else if (typeKey === 'bite') icon = '🦷';
  else if (typeKey === 'claw') icon = '🐾';
  else if (typeKey === 'sting') icon = '🦂';
  else if (typeKey === 'spell') icon = '🪄';
  else if (typeKey === 'touch') icon = '✋';
  else if (typeKey === 'tentacle') icon = '🐙';
  else if (typeKey === 'wrap') icon = '🐍';
  else if (typeKey === 'psychic') icon = '🧠';

  const parts = [typeLabel];
  if (damageStr) parts.push(damageStr);
  if (effectStr) parts.push(effectStr);

  const mainText = `${icon} ${parts.join(' ').replace(/\s+\[/, ' [').replace(/\s+-\s+/, ' - ')}`;
  return badgeStr ? `${mainText} ${badgeStr}` : mainText;
}

/**
 * KnowledgeDetailModal.js
 * 
 * 構造化ナレッジ詳細モーダル
 * マップ上のモンスター、アイテム、ギミック等の詳細データ
 * （耐性・弱点・攻撃方法・BUC効果・適応スペック・識別テクニック・戦術アドバイス）
 * をフルスペックで表示する独立ウィンドウコンポーネント。
 */
export class KnowledgeDetailModal {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.elModal] - モーダル外枠DOM
   * @param {Function} options.getCore - WebUICore インスタンス取得関数
   * @param {string} [options.language='ja'] - 言語 ('ja' | 'en')
   */
  constructor(options = {}) {
    this.options = options;
    this.elModal = options.elModal || (typeof document !== 'undefined' ? document.getElementById('knowledge-detail-modal') : null);
    this.getCore = options.getCore || (() => null);
    this.currentLanguage = options.language || 'ja';
    this.isVisible = false;
    this.currentTarget = null;
    this.activeTab = 'spec'; // 'spec' | 'official' | 'lore'
    this.officialData = null;
    this.isOfficialLoading = false;
    this.loreEntries = [];

    this._boundKeyDown = (e) => {
      if (this.isVisible) {
        const isInputFocused = e.target && e.target.tagName === 'INPUT';
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.close();
        } else if (!isInputFocused) {
          if (e.key === 'q' || e.key === 'Q') {
            e.preventDefault();
            e.stopPropagation();
            this.close();
          } else if (e.key === '1') {
            this.activeTab = 'spec';
            this.render();
          } else if (e.key === '2') {
            this.activeTab = 'official';
            this.render();
          } else if (e.key === '3') {
            this.activeTab = 'lore';
            this.render();
          }
        }
      }
    };

    this._ensureDom();
  }

  setLanguage(lang) {
    this.currentLanguage = lang === 'en' ? 'en' : 'ja';
    if (this.isVisible && this.currentTarget) {
      this._fetchOfficialInfo();
      this.render();
    }
  }

  _ensureDom() {
    if (!this.elModal && typeof document !== 'undefined') {
      let el = document.getElementById('knowledge-detail-modal');
      if (!el) {
        el = document.createElement('div');
        el.id = 'knowledge-detail-modal';
        el.className = 'knowledge-modal-backdrop hidden';
        document.body.appendChild(el);
      }
      this.elModal = el;
    }

    if (this.elModal) {
      this.elModal.onclick = (e) => {
        if (e.target === this.elModal) {
          this.close();
        }
      };
      this.elModal.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this._boundKeyDown);
      document.addEventListener('keydown', this._boundKeyDown);
    }
  }

  /**
   * 詳細モーダルを開く
   * @param {Object} targetData - 対象のカードデータまたはオブジェクト
   * @param {Object} [options={}] - オプション
   */
  open(targetData, options = {}) {
    if (!targetData) return;
    this._ensureDom();
    this.currentTarget = targetData;
    this.currentTargetOptions = options;
    this.isVisible = true;
    this.activeTab = options.activeTab || 'spec';
    this.officialData = null;
    this.isOfficialLoading = false;
    this.loreEntries = [];

    if (this.elModal) {
      this.elModal.classList.remove('hidden');
    }

    // Lore抽出 (Layer 3)
    this._resolveLore();

    // WASM動的取得 (Layer 2)
    this._fetchOfficialInfo();

    this.render();
  }

  /**
   * 対象の名前を抽出
   * @private
   */
  _getTargetName() {
    if (!this.currentTarget) return null;
    if (typeof this.currentTarget === 'string') return this.currentTarget;
    const t = this.currentTarget;

    // 1. target.knowledge (インベントリやコンテナのアイテムスロット)
    if (t.knowledge) {
      const k = t.knowledge;
      const kName = k.nameEn || k.oc_name || k.english || k.trueName || k.rawName;
      if (kName) return kName;
    }

    // 2. target.identification (真名識別情報)
    if (t.identification) {
      const iden = t.identification;
      const idenName = iden.trueName || iden.rawName;
      if (idenName) return idenName;
    }

    // 3. トップレベル
    return t.nameEn || t.oc_name || t.english || t.trueName || t.rawName || t.name || null;
  }

  /**
   * WASM公式解説の動的取得 (Layer 2)
   * @private
   */
  async _fetchOfficialInfo() {
    const core = this.getCore();
    if (!core || !core.gkl || typeof core.gkl.lookupOfficialInformation !== 'function') return;

    const target = this.currentTarget;
    if (!target) return;

    this.isOfficialLoading = true;
    this.render();

    try {
      const result = await core.gkl.lookupOfficialInformation(target, { language: this.currentLanguage });
      this.officialData = result;
    } catch (e) {
      console.warn('[KnowledgeDetailModal] Official lookup error:', e);
    } finally {
      this.isOfficialLoading = false;
      if (this.isVisible) {
        this.render();
      }
    }
  }

  /**
   * LoreCodex / AdventureLogManager から関連する噂や伝承を抽出 (Layer 3)
   * @private
   */
  _resolveLore() {
    const core = this.getCore();
    const alm = core?.gkl?.adventureLogManager || core?.adventureLogManager;
    const target = this.currentTarget || this._getTargetName();
    if (!target) {
      this.loreEntries = [];
      return;
    }

    if (alm && typeof alm.getRelatedLore === 'function') {
      this.loreEntries = alm.getRelatedLore(target, { unlockedOnly: false }) || [];
    } else if (core?.gkl?.loreCodex && typeof core.gkl.loreCodex.getRelatedLore === 'function') {
      this.loreEntries = core.gkl.loreCodex.getRelatedLore(target, { unlockedOnly: false }) || [];
    } else if (this.currentTarget?.relatedLore && Array.isArray(this.currentTarget.relatedLore)) {
      this.loreEntries = this.currentTarget.relatedLore;
    } else {
      this.loreEntries = [];
    }
  }

  /**
   * 詳細モーダルを閉じる
   */
  close() {
    this.isVisible = false;
    this.currentTarget = null;
    if (this.elModal) {
      this.elModal.classList.add('hidden');
    }
  }

  /**
   * モーダル内部の描画
   */
  render() {
    if (!this.elModal || !this.currentTarget) return;

    const isEn = this.currentLanguage === 'en';
    const target = this.currentTarget;
    const core = this.getCore();

    // データの解決
    let data = null;
    let isPet = target.type === 'PET' || (target.entity && target.entity.type === 'PET');
    let isPlayer = target.isPlayer || target.category === 'PLAYER' || target.type === 'PLAYER';

    if (isPlayer) {
      data = (target && target.stats && target.stats.hp) ? target : {
        name: isEn ? 'You (Player)' : '自キャラ (Player)',
        category: 'PLAYER',
        dangerLevel: 'NONE',
        dispositionStatus: 'PLAYER',
        stats: { hd: 'Player', ac: 'Self', speed: 'Self', mr: 0 },
        effectSummary: isEn ? 'The adventurer exploring the Mazes of Menace.' : 'ダンジョンを探索中のプレイヤー自身です。'
      };
    } else if (target.knowledge) {
      data = {
        ...target.knowledge,
        rawText: target.rawText || target.knowledge.rawText,
        identification: target.identification || target.knowledge.identification,
        bucStatus: target.bucStatus || target.knowledge.bucStatus,
        isWielded: target.isWielded,
        isOffhand: target.isOffhand,
        isQuivered: target.isQuivered,
        isWorn: target.isWorn,
        letter: target.letter
      };
    } else if (target.dangerLevel || target.category || target.isUnidentified || target.effectSummary || target.name) {
      data = target;
    } else if (core?.gkl?.structuredKnowledge) {
      data = core.gkl.structuredKnowledge.getKnowledge(target, { isPet, isPlayer, translate: true, language: this.currentLanguage });
    }

    if (!data) {
      data = target;
    }

    const isMonsterType = Boolean(
      data.dangerLevel || data.category === 'MONSTER' || data.hasMonster || data.dispositionStatus || isPet
    );

    const isFeatureType = Boolean(
      data.category === 'TERRAIN' || data.category === 'FEATURE' ||
      data.category === 'DOOR' || data.category === 'ALTAR' ||
      data.category === 'FOUNTAIN' || data.category === 'SINK' ||
      data.category === 'THRONE' || data.category === 'GRAVE' ||
      data.category === 'STAIRS' || data.category === 'TRAP' ||
      data.isFeature || data.isTerrain || data.isTrap || data.isDoor || data.isAltar ||
      data.isFountain || data.isSink || data.isThrone || data.isGrave || data.isStairs
    );

    const isItemType = !isMonsterType && (
      !isFeatureType ||
      data.category === 'OBJECT' || data.category === 'ITEM' || data.category === 'CORPSE' ||
      data.category === 'FOOD' || data.category === 'WEAPON' || data.category === 'ARMOR' ||
      data.category === 'POTION' || data.category === 'SCROLL' || data.category === 'WAND' ||
      data.category === 'RING' || data.category === 'AMULET' || data.category === 'TOOL' ||
      data.category === 'GEM' || data.category === 'BOOK' || data.category === 'SPELLBOOK' ||
      data.category === 'GOLD' || data.category === 'COIN' || data.category === 'CONTAINER' ||
      data.category === 'STATUE' || data.hasItems || data.rawText || data.bucStatus || data.corpseInfo
    );

    let contentHtml = '';
    let headerIcon = '💡';
    const nameJa = data.nameJa || data.knowledge?.nameJa || data.japanese || target.nameJa || target.knowledge?.nameJa;
    const nameEn = data.nameEn || data.trueName || data.name || data.knowledge?.name || target.trueName || target.name;
    let headerTitle = '';
    if (!isEn) {
      if (nameJa) {
        headerTitle = `${nameJa}${nameEn && nameEn !== nameJa ? ` (${nameEn})` : ''}`;
      } else {
        headerTitle = data.name || nameEn || 'ナレッジ詳細';
      }
    } else {
      headerTitle = nameEn || data.name || 'Knowledge Detail';
    }
    let categoryBadge = String(data.category || (isMonsterType ? 'MONSTER' : (isFeatureType ? 'FEATURE' : 'ITEM'))).toUpperCase();

    if (isMonsterType) {
      headerIcon = data.isHostile ? '👾' : (data.isTame || isPet ? '🐾' : '👹');
      contentHtml = this._buildMonsterDetailHtml(data, isEn);
    } else if (isItemType) {
      const cat = String(data.category || '').toUpperCase();
      if (cat === 'CORPSE') headerIcon = '🥩';
      else if (cat === 'FOOD') headerIcon = '🍖';
      else if (cat === 'WEAPON') headerIcon = '⚔️';
      else if (cat === 'ARMOR') headerIcon = '🛡️';
      else if (cat === 'POTION') headerIcon = '🧪';
      else if (cat === 'SCROLL') headerIcon = '📜';
      else if (cat === 'WAND') headerIcon = '🪄';
      else if (cat === 'RING') headerIcon = '💍';
      else if (cat === 'AMULET') headerIcon = '📿';
      else if (cat === 'GOLD' || cat === 'COIN') headerIcon = '💰';
      else if (cat === 'CONTAINER' || cat === 'CHEST') headerIcon = '📦';
      else if (cat === 'STATUE') headerIcon = '🗿';
      else headerIcon = '📦';

      contentHtml = this._buildItemDetailHtml(data, isEn);
    } else {
      const cat = String(data.category || '').toUpperCase();
      if (cat === 'ALTAR' || data.isAltar) headerIcon = '⛩️';
      else if (cat === 'FOUNTAIN' || data.isFountain) headerIcon = '⛲';
      else if (cat === 'DOOR' || data.isDoor) headerIcon = '🚪';
      else if (cat === 'STAIRS' || data.isStairs) headerIcon = '🪜';
      else if (cat === 'TRAP' || data.isTrap) headerIcon = '⚠️';
      else headerIcon = '🏛️';

      contentHtml = this._buildFeatureDetailHtml(data, isEn);
    }

    // タブごとのボディHTML
    let bodyHtml = '';
    if (this.activeTab === 'spec') {
      bodyHtml = contentHtml;
    } else if (this.activeTab === 'official') {
      if (this.isOfficialLoading) {
        bodyHtml = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; color: #94a3b8; gap: 12px;">
            <div style="width: 28px; height: 28px; border: 3px solid rgba(56, 189, 248, 0.2); border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            <div>${isEn ? 'Querying NetHack C core data.base...' : 'WASM Cコア (data.base) より公式解説を抽出中...'}</div>
          </div>
        `;
      } else if (this.officialData && this.officialData.found) {
        bodyHtml = `
          <div class="kn-detail-container">
            <div class="kn-section-box" style="background: rgba(30, 41, 59, 0.6); padding: 16px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.2);">
              <div class="kn-section-label" style="color: #38bdf8; font-weight: 700; margin-bottom: 8px;">📖 ${isEn ? 'Official Literature & Lore' : 'NetHack 公式文学引用・解説'}</div>
              <div style="font-size: 0.9rem; line-height: 1.6; color: #e2e8f0; white-space: pre-wrap;">${this.officialData.text}</div>
              ${(!isEn && this.officialData.rawText && this.officialData.rawText !== this.officialData.text) ? `
                <details style="margin-top: 12px; font-size: 0.8rem; color: #94a3b8; border-top: 1px dashed rgba(148, 163, 184, 0.2); padding-top: 8px;">
                  <summary style="cursor: pointer; color: #38bdf8; user-select: none;">🔍 英語原文 (Original English text)</summary>
                  <div style="font-style: italic; margin-top: 6px; white-space: pre-wrap; color: #cbd5e1;">${this.officialData.rawText}</div>
                </details>
              ` : ''}
              <div style="margin-top: 12px; text-align: right; font-size: 0.75rem; color: #38bdf8; font-weight: 600;">［${this.officialData.source || 'NetHack data.base'}］</div>
            </div>
          </div>
        `;
      } else {
        bodyHtml = `
          <div style="text-align: center; padding: 40px 10px; color: #64748b; font-size: 0.85rem;">
            ${isEn ? 'No official literature quote found in data.base.' : 'NetHack 公式 data.base に該当する文学解説はありません。'}
          </div>
        `;
      }
    } else if (this.activeTab === 'lore') {
      const unlockedEntries = this.loreEntries.filter(l => l.isUnlocked !== false);
      const lockedCount = this.loreEntries.filter(l => l.isUnlocked === false).length;

      if (unlockedEntries.length === 0 && lockedCount === 0) {
        bodyHtml = `
          <div style="text-align: center; padding: 40px 10px; color: #64748b; font-size: 0.85rem;">
            ${isEn ? 'No related rumors recorded in LoreCodex yet.' : 'この対象に関する噂や伝承はまだ冒険手帳に記録されていません。'}
          </div>
        `;
      } else if (unlockedEntries.length === 0 && lockedCount > 0) {
        bodyHtml = `
          <div style="text-align: center; padding: 40px 10px; color: #64748b; font-size: 0.85rem;">
            🔒 ${isEn ? `${lockedCount} related rumor${lockedCount > 1 ? 's' : ''} not yet unlocked.` : `この対象に関する噂はまだ解禁されていません（未解禁: ${lockedCount}件）`}
          </div>
        `;
      } else {
        bodyHtml = `
          <div class="kn-detail-container" style="display: flex; flex-direction: column; gap: 8px;">
            ${unlockedEntries.map((lore, idx) => {
              const isOracle = lore.category === 'ORACLE';
              const isTrue = lore.isTrue !== undefined ? Boolean(lore.isTrue) : (lore.type === 'TRUE');
              const isFalse = lore.isFalse !== undefined ? Boolean(lore.isFalse) : (lore.type === 'FALSE');
              const mainText = !isEn && (lore.translatedText || lore.textJa) ? (lore.translatedText || lore.textJa) : (lore.text || lore.rawText || '');

              let badgeHtml = '';
              if (isOracle) {
                badgeHtml = `<span style="font-weight: 700; padding: 2px 6px; border-radius: 4px; color: #c084fc; background: rgba(192, 132, 252, 0.15); border: 1px solid rgba(192, 132, 252, 0.3);">🏛️ ${isEn ? 'ORACLE' : '神託'}</span>`;
              } else if (isTrue) {
                badgeHtml = `<span style="font-weight: 700; padding: 2px 6px; border-radius: 4px; color: #4ade80; background: rgba(34, 197, 94, 0.15);">✓ ${isEn ? 'TRUE RUMOR' : '真の噂'}</span>`;
              } else if (isFalse) {
                badgeHtml = `<span style="font-weight: 700; padding: 2px 6px; border-radius: 4px; color: #f87171; background: rgba(239, 68, 68, 0.15);">✗ ${isEn ? 'FALSE RUMOR' : '偽りの噂'}</span>`;
              } else {
                badgeHtml = `<span style="font-weight: 700; padding: 2px 6px; border-radius: 4px; color: #facc15; background: rgba(234, 179, 8, 0.15);">? ${isEn ? 'RUMOR' : '噂'}</span>`;
              }

              const entryNo = isOracle
                ? (lore.id ? `#${lore.id}` : (isEn ? 'Oracle' : '神託'))
                : (lore.index ? `#${String(lore.index).padStart(3, '0')}` : (lore.id ? `No.${lore.id}` : `No.${idx + 1}`));

              return `
              <div class="kn-section-box" style="background: rgba(30, 41, 59, 0.5); padding: 10px 14px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.15);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.72rem;">
                  ${badgeHtml}
                  <span style="color: #94a3b8;">${entryNo}</span>
                </div>
                <div style="font-size: 0.85rem; line-height: 1.45; color: #cbd5e1;">「${mainText}」</div>
              </div>
              `;
            }).join('')}
            ${lockedCount > 0 ? `
              <div style="color: #94a3b8; font-size: 0.8rem; padding: 8px 12px; background: rgba(148, 163, 184, 0.06); border-radius: 6px; border: 1px dashed rgba(148, 163, 184, 0.25); display: flex; align-items: center; gap: 8px;">
                <span>🔒</span>
                <span>${isEn ? `${lockedCount} related rumor${lockedCount > 1 ? 's' : ''} not yet unlocked` : `未解禁の噂: ${lockedCount}件`}</span>
              </div>
            ` : ''}
          </div>
        `;
      }
    }

    this.elModal.innerHTML = `
      <div class="knowledge-modal-dialog" role="dialog" aria-modal="true">
        <div class="knowledge-modal-header">
          <div class="knowledge-header-left">
            <span class="knowledge-header-icon">${headerIcon}</span>
            <div class="knowledge-header-title-box">
              <span class="knowledge-header-title">${headerTitle}</span>
              <span class="knowledge-category-pill">${categoryBadge}</span>
            </div>
          </div>
          <button class="knowledge-modal-close" id="btn-knowledge-modal-close" title="${isEn ? 'Close [Esc / q]' : '閉じる [Esc / q]'}">×</button>
        </div>

        <!-- What is this? 検索バー (プログレッシブ拡張) -->
        <div class="knowledge-modal-search" style="padding: 8px 16px; background: rgba(15, 23, 42, 0.4); border-bottom: 1px solid rgba(148, 163, 184, 0.15); display: flex; gap: 8px; align-items: center;">
          <span style="font-size: 0.85rem; color: #38bdf8;">🔍</span>
          <input type="text" id="kn-search-input" placeholder="${isEn ? 'What is this? (Type monster, item, or symbol...)' : 'What is this? (モンスター名・アイテム名・シンボルを入力...)'}" style="flex: 1; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.3); border-radius: 4px; padding: 4px 8px; color: #f8fafc; font-size: 0.82rem; outline: none;" />
          <button id="kn-search-btn" style="background: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; border-radius: 4px; padding: 4px 12px; font-size: 0.8rem; cursor: pointer; font-family: inherit;">${isEn ? 'Lookup' : '照会'}</button>
        </div>

        <!-- 3層タブナビゲーション -->
        <div class="knowledge-modal-tabs" style="display: flex; gap: 4px; padding: 6px 16px; background: rgba(15, 23, 42, 0.6); border-bottom: 1px solid rgba(148, 163, 184, 0.2);">
          <button class="kn-tab-btn ${this.activeTab === 'spec' ? 'active' : ''}" data-tab="spec" style="flex: 1; padding: 6px 8px; border-radius: 6px; border: ${this.activeTab === 'spec' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent'}; background: ${this.activeTab === 'spec' ? 'rgba(56, 189, 248, 0.2)' : 'transparent'}; color: ${this.activeTab === 'spec' ? '#38bdf8' : '#94a3b8'}; cursor: pointer; font-size: 0.8rem; font-weight: 600; font-family: inherit;">
            📊 ${isEn ? '1. Specs' : '1. 実用スペック'}
          </button>
          <button class="kn-tab-btn ${this.activeTab === 'official' ? 'active' : ''}" data-tab="official" style="flex: 1; padding: 6px 8px; border-radius: 6px; border: ${this.activeTab === 'official' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent'}; background: ${this.activeTab === 'official' ? 'rgba(56, 189, 248, 0.2)' : 'transparent'}; color: ${this.activeTab === 'official' ? '#38bdf8' : '#94a3b8'}; cursor: pointer; font-size: 0.8rem; font-weight: 600; font-family: inherit;">
            📖 ${isEn ? '2. Official Lore' : '2. 公式解説 (WASM)'}
          </button>
          <button class="kn-tab-btn ${this.activeTab === 'lore' ? 'active' : ''}" data-tab="lore" style="flex: 1; padding: 6px 8px; border-radius: 6px; border: ${this.activeTab === 'lore' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent'}; background: ${this.activeTab === 'lore' ? 'rgba(56, 189, 248, 0.2)' : 'transparent'}; color: ${this.activeTab === 'lore' ? '#38bdf8' : '#94a3b8'}; cursor: pointer; font-size: 0.8rem; font-weight: 600; font-family: inherit;">
            💡 ${isEn ? '3. Rumors' : '3. 冒険の噂'} ${this.loreEntries.filter(l => l.isUnlocked !== false).length > 0 ? `(${this.loreEntries.filter(l => l.isUnlocked !== false).length})` : ''}
          </button>
        </div>

        <div class="knowledge-modal-body" style="max-height: 400px; overflow-y: auto;">
          ${bodyHtml}
        </div>

        <div style="padding: 8px 16px; border-top: 1px solid rgba(148, 163, 184, 0.15); display: flex; justify-content: space-between; font-size: 0.72rem; color: #64748b;">
          <span>[1][2][3] ${isEn ? 'Switch Tab' : 'タブ切替'} | [Esc] / [q] ${isEn ? 'Close' : '閉じる'}</span>
          <span>NetHack WebUI Knowledge Integration</span>
        </div>
      </div>
    `;

    const btnClose = this.elModal.querySelector('#btn-knowledge-modal-close');
    if (btnClose) {
      btnClose.onclick = (e) => {
        e.stopPropagation();
        this.close();
      };
    }

    // 検索入力イベント結線
    const searchInput = this.elModal.querySelector('#kn-search-input');
    const searchBtn = this.elModal.querySelector('#kn-search-btn');
    const doSearch = () => {
      const query = (searchInput?.value || '').trim();
      if (query) {
        this.open(query);
      }
    };
    if (searchBtn) {
      searchBtn.onclick = (e) => {
        e.stopPropagation();
        doSearch();
      };
    }
    if (searchInput) {
      searchInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          doSearch();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          searchInput.blur();
        }
      };
    }

    // タブクリックイベント
    const tabBtns = this.elModal.querySelectorAll('.kn-tab-btn');
    tabBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const tab = btn.getAttribute('data-tab');
        if (tab) {
          this.activeTab = tab;
          this.render();
        }
      };
    });
  }

  /**
   * モンスター詳細HTMLの構築
   */
  _buildMonsterDetailHtml(data, isEn) {
    const danger = data.dangerLevel || (data.isHostile ? 'MEDIUM' : 'LOW');
    const badgeClass = `kn-danger-${danger}`;

    let dispositionBadge = '';
    let dispositionNote = '';
    if (data.dispositionStatus === 'PEACEFUL' || (data.isPeaceful && !data.isHostile && data.dispositionStatus !== 'DEFAULT_PEACEFUL')) {
      dispositionBadge = `<span class="kn-status-badge kn-status-peaceful">${isEn ? '☮️ Peaceful (SAFE)' : '☮️ 平和的 (SAFE)'}</span>`;
    } else if (data.dispositionStatus === 'DEFAULT_PEACEFUL' || (data.defaultPeaceful && !data.isHostile)) {
      dispositionBadge = `<span class="kn-status-badge kn-status-peaceful">${isEn ? '☮️ Normally Peaceful' : '☮️ 通常平和 (SAFE)'}</span>`;
      dispositionNote = `<div class="kn-note-box">${isEn ? '※ Normally peaceful; becomes hostile if attacked or stolen from.' : '※ 通常は平和的ですが、攻撃や泥棒を行うと敵対化します。'}</div>`;
    } else if (data.dispositionStatus === 'TAMED' || data.isTame || data.type === 'PET') {
      dispositionBadge = `<span class="kn-status-badge kn-status-tamed">${isEn ? '🐾 Pet (TAMED)' : '🐾 ペット (TAMED)'}</span>`;
    } else if (data.dispositionStatus === 'PLAYER') {
      dispositionBadge = `<span class="kn-status-badge kn-status-player">${isEn ? '👤 Player' : '👤 プレイヤー'}</span>`;
    } else {
      dispositionBadge = `<span class="kn-status-badge kn-status-hostile">${isEn ? `⚔️ Hostile (${danger})` : `⚔️ 敵対的 (${danger})`}</span>`;
    }

    const stats = data.stats || {};
    const hd = stats.hd ?? (data.level ?? '-');
    const ac = stats.ac ?? '-';
    const spd = stats.speed ?? '-';
    const mr = stats.mr ?? '-';

    // 耐性・弱点
    const resists = data.resistances || data.resist || [];
    const resistHtml = (Array.isArray(resists) && resists.length > 0)
      ? `<div class="kn-section-item"><span class="kn-field-label">🛡️ ${isEn ? 'Resistances:' : '耐性:'}</span> <span class="kn-field-value">${resists.join(', ')}</span></div>`
      : '';

    const weak = data.weaknesses || data.weakness || [];
    const weakHtml = (Array.isArray(weak) && weak.length > 0)
      ? `<div class="kn-section-item"><span class="kn-field-label">⚡ ${isEn ? 'Weaknesses:' : '弱点:'}</span> <span class="kn-field-value weak-val">${weak.join(', ')}</span></div>`
      : '';

    // 死体安全性
    let corpseHtml = '';
    const cs = data.corpseSafety || data.corpseInfo;
    if (cs) {
      const parts = [];
      if (cs.petrifying) parts.push(`<span class="kn-pill kn-lethal">⚠️ ${isEn ? 'Petrifying (Lethal!)' : '石化危険 (即死級!)'}</span>`);
      if (cs.poisonous) parts.push(`<span class="kn-pill kn-poison">☠️ ${isEn ? 'Poisonous' : '毒性あり'}</span>`);
      if (cs.isSafe) parts.push(`<span class="kn-pill kn-safe">🍖 ${isEn ? 'Safe to eat' : '食用安全'}</span>`);
      if (cs.nutrition) parts.push(`<span>${isEn ? `Nutrition: ${cs.nutrition}` : `栄養価: ${cs.nutrition}`}</span>`);
      if (cs.warningNote) parts.push(`<span class="weak-val">${cs.warningNote}</span>`);
      if (parts.length > 0) {
        corpseHtml = `
          <div class="kn-section-box">
            <div class="kn-section-label">🍖 ${isEn ? 'Corpse & Nutrition' : '死体・食用特性'}</div>
            <div class="kn-row-wrap">${parts.join(' ')}</div>
          </div>
        `;
      }
    }

    // 攻撃手段・特殊能力
    const attacks = data.attacks || [];
    const attacksHtml = (Array.isArray(attacks) && attacks.length > 0)
      ? `
        <div class="kn-section-box">
          <div class="kn-section-label">⚔️ ${isEn ? 'Attacks & Capabilities' : '攻撃手段・特殊能力'}</div>
          <ul class="kn-detail-list">${attacks.map(atk => `<li>• ${formatMonsterAttack(atk, isEn)}</li>`).join('')}</ul>
        </div>
      `
      : '';

    // 戦術アドバイス
    const tactical = data.tacticalAdvice || data.tacticalSummary || (data.advices ? data.advices.map(a => a.message || a.messageJa) : null);
    let tacticalHtml = '';
    if (Array.isArray(tactical) && tactical.length > 0) {
      tacticalHtml = `
        <div class="kn-section-box kn-tactical-box">
          <div class="kn-section-label">💡 ${isEn ? 'Tactical Advice' : '実戦戦術アドバイス'}</div>
          <ul class="kn-detail-list">${tactical.map(adv => `<li>• ${adv}</li>`).join('')}</ul>
        </div>
      `;
    } else if (typeof tactical === 'string' && tactical) {
      tacticalHtml = `
        <div class="kn-section-box kn-tactical-box">
          <div class="kn-section-label">💡 ${isEn ? 'Tactical Advice' : '実戦戦術アドバイス'}</div>
          <div class="kn-desc-text">${tactical}</div>
        </div>
      `;
    }

    return `
      <div class="kn-detail-container">
        <div class="kn-status-row">
          <span class="kn-danger-badge ${badgeClass}">${danger} DANGER</span>
          ${dispositionBadge}
        </div>
        ${dispositionNote}

        <div class="kn-grid-stats">
          <div class="stat-cell"><span class="stat-k">HD/Lv</span><span class="stat-v">${hd}</span></div>
          <div class="stat-cell"><span class="stat-k">AC</span><span class="stat-v">${ac}</span></div>
          <div class="stat-cell"><span class="stat-k">Spd</span><span class="stat-v">${spd}</span></div>
          <div class="stat-cell"><span class="stat-k">MR</span><span class="stat-v">${mr}</span></div>
          ${stats.hp ? `<div class="stat-cell"><span class="stat-k">HP</span><span class="stat-v stat-hp">${stats.hp}</span></div>` : ''}
          ${stats.pw ? `<div class="stat-cell"><span class="stat-k">Pw</span><span class="stat-v stat-pw">${stats.pw}</span></div>` : ''}
        </div>

        ${(resistHtml || weakHtml) ? `
          <div class="kn-section-box">
            ${resistHtml}
            ${weakHtml}
          </div>
        ` : ''}

        ${corpseHtml}
        ${attacksHtml}

        ${data.effectSummary ? `
          <div class="kn-section-box">
            <div class="kn-section-label">📖 ${isEn ? 'Overview' : '概要'}</div>
            <div class="kn-desc-text">${data.effectSummary}</div>
          </div>
        ` : ''}

        ${tacticalHtml}
      </div>
    `;
  }

  /**
   * アイテム詳細HTMLの構築
   */
  _buildItemDetailHtml(data, isEn) {
    const core = this.getCore();
    const sm = core?.gkl?.skillStateManager || null;
    const adaptiveSpecs = getAdaptiveItemSpecs(data, { skillStateManager: sm, language: this.currentLanguage });

    let specsHtml = '';
    if (adaptiveSpecs.length > 0) {
      specsHtml = `
        <div class="kn-section-box">
          <div class="kn-section-label">📊 ${isEn ? 'Adaptive Specs' : '適応スペック (装備・威力)'}</div>
          <div class="kn-specs-grid">
            ${adaptiveSpecs.map(s => {
              const hl = s.highlight ? 'highlight' : '';
              return `
                <div class="spec-cell ${hl}">
                  <span class="spec-k">${s.label}</span>
                  <span class="spec-v">${s.value}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // 識別・BUCステータス
    const id = data.identification || {};
    const isUnid = Boolean(id.isUnidentified || data.isUnidentified);
    const rawLower = (data.rawText || data.name || '').toLowerCase();
    const bucStatus = id.bucStatus || data.bucStatus || (rawLower.includes('blessed') ? 'BLESSED' : rawLower.includes('cursed') ? 'CURSED' : rawLower.includes('uncursed') ? 'UNCURSED' : 'UNKNOWN');

    const idBadges = [];
    const canUnid = data.canBeUnidentified !== false && data.category !== 'CORPSE' && data.category !== 'GOLD';
    if (canUnid) {
      if (isUnid) {
        idBadges.push(`<span class="kn-status-badge kn-status-unid">${isEn ? '🔍 UNIDENTIFIED' : '🔍 未識別 (UNIDENTIFIED)'}</span>`);
      } else {
        idBadges.push(`<span class="kn-status-badge kn-status-known">${isEn ? '✅ IDENTIFIED' : '✅ 識別済み (IDENTIFIED)'}</span>`);
      }
    }

    if (bucStatus === 'BLESSED') {
      idBadges.push(`<span class="kn-status-badge kn-status-blessed">${isEn ? '✨ BLESSED' : '✨ 祝福 (BLESSED)'}</span>`);
    } else if (bucStatus === 'CURSED') {
      idBadges.push(`<span class="kn-status-badge kn-status-cursed">${isEn ? '💀 CURSED' : '💀 呪い (CURSED)'}</span>`);
    } else if (bucStatus === 'UNCURSED') {
      idBadges.push(`<span class="kn-status-badge kn-status-uncursed">${isEn ? '⚪ UNCURSED' : '⚪ 通常 (UNCURSED)'}</span>`);
    }

    if (id.appearanceName) {
      idBadges.push(`<span class="kn-status-badge kn-status-named">${isEn ? `🎨 Appearance: ${id.appearanceName}` : `🎨 外見: ${id.appearanceName}`}</span>`);
    }
    if (id.calledName) {
      idBadges.push(`<span class="kn-status-badge kn-status-named">${isEn ? `🏷️ Called: ${id.calledName}` : `🏷️ 仮名: ${id.calledName}`}</span>`);
    }

    // 死体・食用情報 (CORPSE / FOOD)
    let corpseHtml = '';
    const cs = data.corpseInfo || data.corpseSafety;
    if (cs) {
      const parts = [];
      if (cs.petrifying || cs.causesPetrification) parts.push(`<span class="kn-pill kn-lethal">⚠️ ${isEn ? 'Petrifying (Lethal!)' : '石化危険 (即死級!)'}</span>`);
      if (cs.poisonous || cs.causesPoison) parts.push(`<span class="kn-pill kn-poison">☠️ ${isEn ? 'Poisonous' : '毒性あり'}</span>`);
      if (cs.causesSlime) parts.push(`<span class="kn-pill kn-poison">🟢 ${isEn ? 'Slime hazard' : 'スライム化'}</span>`);
      if (cs.isSafe || (!cs.petrifying && !cs.causesPetrification && !cs.poisonous && !cs.causesPoison && !cs.causesSlime)) {
        if (!cs.warningNote) {
          parts.push(`<span class="kn-pill kn-safe">🍖 ${isEn ? 'Safe to eat' : '食用安全'}</span>`);
        }
      }
      if (cs.nutrition) parts.push(`<span>${isEn ? `Nutrition: ${cs.nutrition}` : `栄養価: ${cs.nutrition}`}</span>`);
      if (cs.grantResist) parts.push(`<span class="kn-pill kn-safe">🛡️ ${isEn ? `Gain resist: ${cs.grantResist}` : `耐性獲得: ${cs.grantResist}`}</span>`);
      if (cs.warningNote) parts.push(`<span class="weak-val">⚠️ ${cs.warningNote}</span>`);

      if (parts.length > 0) {
        corpseHtml = `
          <div class="kn-section-box">
            <div class="kn-section-label">🍖 ${isEn ? 'Corpse & Nutrition' : '死体・食用特性'}</div>
            <div class="kn-row-wrap">${parts.join(' ')}</div>
          </div>
        `;
      }
    }

    // BUC効果
    let bucHtml = '';
    const b = data.bucEffects;
    if (b) {
      const bParts = [];
      if (b.blessed) bParts.push(`<li class="buc-blessed"><strong>${isEn ? 'Blessed:' : '祝福:'}</strong> ${b.blessed}</li>`);
      if (b.uncursed) bParts.push(`<li class="buc-uncursed"><strong>${isEn ? 'Uncursed:' : '通常:'}</strong> ${b.uncursed}</li>`);
      if (b.cursed) bParts.push(`<li class="buc-cursed"><strong>${isEn ? 'Cursed:' : '呪い:'}</strong> ${b.cursed}</li>`);
      if (bParts.length > 0) {
        bucHtml = `
          <div class="kn-section-box">
            <div class="kn-section-label">⚖️ ${isEn ? 'BUC Effects' : 'BUC効果 (祝福・通常・呪い)'}</div>
            <ul class="kn-detail-list">${bParts.join('')}</ul>
          </div>
        `;
      }
    }

    // 識別テクニック
    let tipsHtml = '';
    if (data.unidentifiedTips && data.unidentifiedTips.length > 0) {
      tipsHtml = `
        <div class="kn-section-box">
          <div class="kn-section-label">🔍 ${isEn ? 'Identification Tips' : '識別戦術テクニック'}</div>
          <ul class="kn-detail-list">${data.unidentifiedTips.map(tip => `<li>• ${tip}</li>`).join('')}</ul>
        </div>
      `;
    }

    // 用途・アドバイス
    let adviceHtml = '';
    if (data.usageAdvice && data.usageAdvice.length > 0) {
      adviceHtml = `
        <div class="kn-section-box kn-tactical-box">
          <div class="kn-section-label">💡 ${isEn ? 'Usage & Strategy Advice' : '用途・活用アドバイス'}</div>
          <ul class="kn-detail-list">${data.usageAdvice.map(adv => `<li>• ${adv}</li>`).join('')}</ul>
        </div>
      `;
    }

    return `
      <div class="kn-detail-container">
        ${idBadges.length > 0 ? `
          <div class="kn-status-row">
            ${idBadges.join('')}
          </div>
        ` : ''}

        ${specsHtml}
        ${corpseHtml}

        ${data.effectSummary ? `
          <div class="kn-section-box">
            <div class="kn-section-label">📖 ${isEn ? 'Effect Summary' : '効果要約'}</div>
            <div class="kn-desc-text">${data.effectSummary}</div>
          </div>
        ` : ''}

        ${data.flavorNote ? `
          <div class="kn-flavor-box">"${data.flavorNote}"</div>
        ` : ''}

        ${bucHtml}
        ${tipsHtml}
        ${adviceHtml}
      </div>
    `;
  }

  /**
   * ギミック・地形詳細HTMLの構築
   */
  _buildFeatureDetailHtml(data, isEn) {
    const desc = data.effectSummary || data.description || (isEn ? 'Dungeon feature or interactive object.' : 'ダンジョン内のギミックまたは設置物です。');
    return `
      <div class="kn-detail-container">
        <div class="kn-section-box">
          <div class="kn-section-label">🏛️ ${isEn ? 'Dungeon Feature' : 'ダンジョンギミック/地形'}</div>
          <div class="kn-desc-text">${desc}</div>
        </div>
        ${data.usageAdvice ? `
          <div class="kn-section-box kn-tactical-box">
            <div class="kn-section-label">💡 ${isEn ? 'Tips' : 'ヒント・アドバイス'}</div>
            <div class="kn-desc-text">${Array.isArray(data.usageAdvice) ? data.usageAdvice.join('<br>') : data.usageAdvice}</div>
          </div>
        ` : ''}
      </div>
    `;
  }
}
