/**
 * InventoryView - アイコン型インベントリグリッド & ツールチップ & BUCバッジ & 長押し/右クリックアクションマネージャー
 */
export class InventoryView {
  constructor({
    elGklInventoryGrid,
    elGklInvCount,
    elGklTooltip,
    elGklTtName,
    elGklTtTags,
    getCore,
    getLoadedTileImagePath,
    onInspectItem
  }) {
    this.elGklInventoryGrid = elGklInventoryGrid;
    this.elGklInvCount = elGklInvCount;
    this.elGklTooltip = elGklTooltip;
    this.elGklTtName = elGklTtName;
    this.elGklTtTags = elGklTtTags;

    this.getCore = getCore || (() => null);
    this.getLoadedTileImagePath = getLoadedTileImagePath || (() => '../../pict/nethack_default_32.png');
    this.onInspectItem = onInspectItem || (() => {});

    this.currentLanguage = 'ja';
    this._lastInvHtml = null;
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
    this._lastInvHtml = null;
  }

  getItemSymbol(item) {
    if (item.isPickAxe) return '⛏️';
    if (item.isDigWand) return '🪄';
    if (item.isKey) return '🗝️';
    if (item.isAxe) return '🪓';
    if (item.isFrostWand) return '❄️';
    if (item.isWielded) return '⚔️';
    if (item.isOffhand) return '🗡️';
    if (item.isQuivered) return '🏹';
    if (item.isWorn) return '🛡️';

    const text = (item.rawText || '').toLowerCase();
    if (text.includes('potion') || text.includes('薬')) return '🧪';
    if (text.includes('scroll') || text.includes('巻物')) return '📜';
    if (text.includes('wand') || text.includes('杖')) return '🪄';
    if (text.includes('ring') || text.includes('指輪')) return '💍';
    if (text.includes('amulet') || text.includes('魔除け')) return '🧿';
    if (text.includes('spellbook') || text.includes('魔法書')) return '📖';
    if (text.includes('food') || text.includes('ration') || text.includes('corpse') || text.includes('食料') || text.includes('死体')) return '🍖';
    if (text.includes('gold') || text.includes('金貨')) return '💰';
    return '📦';
  }

  renderGklInventory(inventory, slotBadges = {}) {
    if (!this.elGklInventoryGrid || !inventory) return;
    const isEn = this.currentLanguage === 'en';
    const items = inventory.items || [];
    if (this.elGklInvCount) {
      this.elGklInvCount.textContent = items.length;
    }

    const newHtml = items.length === 0
      ? `<div class="gkl-empty-hint">${isEn ? 'Inventory Empty' : 'インベントリ空'}</div>`
      : items.map(item => {
          const equipClasses = [];
          if (item.isWielded) equipClasses.push('is-wielded');
          if (item.isOffhand) equipClasses.push('is-offhand');
          if (item.isQuivered) equipClasses.push('is-quivered');
          if (item.isWorn) equipClasses.push('is-worn');

          // Level 1: Nano Badge & 金枠ハイライト判定
          const slotBadge = slotBadges ? (slotBadges[item.letter] || slotBadges[item.invlet]) : null;
          let nanoBadgeHtml = '';
          if (slotBadge) {
            const badgeType = slotBadge.type || 'info';
            const badgeLabel = isEn ? (slotBadge.labelEn || slotBadge.labelJa) : (slotBadge.labelJa || slotBadge.labelEn);
            nanoBadgeHtml = `<span class="slot-nano-badge ${badgeType}">${badgeLabel}</span>`;
            if (slotBadge.highlightBorder || badgeType === 'danger') {
              equipClasses.push(badgeType === 'danger' ? 'slot-highlight-danger' : 'slot-highlight-gold');
            }
          }

          const equipClassStr = equipClasses.join(' ');

          let badgeHtml = '';
          if (item.isWielded) badgeHtml = `<span class="gkl-slot-equip-badge badge-wielded" title="${isEn ? 'Main weapon' : 'メイン武器'}">${isEn ? 'Main' : '手'}</span>`;
          else if (item.isOffhand) badgeHtml = `<span class="gkl-slot-equip-badge badge-offhand" title="${isEn ? 'Off-hand weapon' : '副武器'}">${isEn ? 'Off' : '副'}</span>`;
          else if (item.isQuivered) badgeHtml = `<span class="gkl-slot-equip-badge badge-quivered" title="${isEn ? 'Quiver' : '矢筒'}">${isEn ? 'Quiv' : '筒'}</span>`;
          else if (item.isWorn) badgeHtml = `<span class="gkl-slot-equip-badge badge-worn" title="${isEn ? 'Worn' : '着用中'}">${isEn ? 'Worn' : '着'}</span>`;

          let skillBadgeHtml = '';
          if (item.skillBadge?.isProficient || item.isRecommendedWeapon) {
            skillBadgeHtml = `<span class="gkl-slot-equip-badge" style="background:#22c55e; color:#000; font-weight:bold; right:auto; left:2px;" title="${isEn ? 'Proficient weapon' : '得意武器'} (${item.skillBadge?.label || '+'})">+</span>`;
          }

          const id = item.identification || (item.knowledge && item.knowledge.identification) || {};
          const isUnidentified = !!id.isUnidentified;
          const rawLower = (item.rawText || '').toLowerCase();
          const bucStatus = id.bucStatus || (rawLower.includes('blessed') ? 'BLESSED' : rawLower.includes('cursed') ? 'CURSED' : rawLower.includes('uncursed') ? 'UNCURSED' : 'UNKNOWN');

          let bucBadgeHtml = '';
          if (isUnidentified) {
            bucBadgeHtml = `<span class="gkl-slot-buc-badge badge-buc-unid" title="${isEn ? 'Unidentified' : '未識別'}">?</span>`;
          } else if (bucStatus === 'CURSED') {
            bucBadgeHtml = `<span class="gkl-slot-buc-badge badge-buc-cursed" title="${isEn ? 'Cursed' : '呪い'}">-</span>`;
          } else if (bucStatus === 'BLESSED') {
            bucBadgeHtml = `<span class="gkl-slot-buc-badge badge-buc-blessed" title="${isEn ? 'Blessed' : '祝福'}">+</span>`;
          }

          return `
            <div class="gkl-item-slot ${equipClassStr}" data-letter="${item.letter}" data-rawtext="${encodeURIComponent(item.rawText)}">
              <span class="gkl-slot-letter">${item.letter}</span>
              <div class="gkl-slot-icon" id="slot-icon-${item.letter}"></div>
              ${nanoBadgeHtml}
              ${badgeHtml}
              ${skillBadgeHtml}
              ${bucBadgeHtml}
            </div>
          `;
        }).join('');

    if (this._lastInvHtml !== `${this.currentLanguage}_${newHtml}`) {
      this._lastInvHtml = `${this.currentLanguage}_${newHtml}`;
      this.elGklInventoryGrid.innerHTML = newHtml;

      const core = this.getCore();

      // アイテムスタイルとツールチップイベント
      items.forEach(item => {
        const slot = this.elGklInventoryGrid.querySelector(`[data-letter="${item.letter}"]`);
        const iconEl = this.elGklInventoryGrid.querySelector(`#slot-icon-${item.letter}`);
        const tileImgPath = this.getLoadedTileImagePath();

        if (iconEl && item.glyphId >= 0 && core) {
          const styleObj = core.getGlyphStyle(item.glyphId, { tileImage: tileImgPath, tileSize: 32, displaySize: 28 });
          if (styleObj && styleObj.backgroundImage) {
            Object.assign(iconEl.style, styleObj);
          } else {
            iconEl.textContent = this.getItemSymbol(item);
          }
        } else if (iconEl) {
          iconEl.textContent = this.getItemSymbol(item);
        }

        if (slot) {
          slot.onmouseenter = () => {
            this.onInspectItem(item);
            if (this.elGklTtName) this.elGklTtName.textContent = item.rawText;
            if (this.elGklTtTags) {
              this.elGklTtTags.innerHTML = '';

              if (item.isWielded) this.elGklTtTags.innerHTML += `<span class="tag" style="background:#e9c46a;color:#1a1a2e;font-weight:bold;">${isEn ? 'Main weapon' : '手持ち武器'}</span>`;
              if (item.isOffhand) this.elGklTtTags.innerHTML += `<span class="tag" style="background:#4ea8de;color:#0f172a;font-weight:bold;">${isEn ? 'Off-hand weapon' : '副武器'}</span>`;
              if (item.isQuivered) this.elGklTtTags.innerHTML += `<span class="tag" style="background:#2a9d8f;color:#fff;font-weight:bold;">${isEn ? 'Quiver' : '矢筒'}</span>`;
              if (item.isWorn) this.elGklTtTags.innerHTML += `<span class="tag" style="background:#9d4edd;color:#fff;font-weight:bold;">${isEn ? 'Worn' : '着用中'}</span>`;

              const tapAction = item.knowledge?.actionLabel || item.defaultActionLabel;
              if (tapAction && item.defaultVerb) {
                this.elGklTtTags.innerHTML += `<span class="tag" style="background:#2a9d8f;color:#ffffff;font-weight:bold;">${isEn ? 'One-Tap:' : 'ワンタップ:'} ${tapAction}</span>`;
              }

              if (item.isPickAxe) this.elGklTtTags.innerHTML += `<span class="tag">${isEn ? 'Dig(a)' : '掘削(a)'}</span>`;
              if (item.isDigWand) this.elGklTtTags.innerHTML += `<span class="tag">${isEn ? 'Wand of Digging(z)' : '採掘の杖(z)'}</span>`;
              if (item.isKey) this.elGklTtTags.innerHTML += `<span class="tag">${isEn ? 'Key/Lockpick' : '鍵・ピック'}</span>`;
              if (item.isAxe) this.elGklTtTags.innerHTML += `<span class="tag">${isEn ? 'Axe' : '斧'}</span>`;
              if (item.isFrostWand) this.elGklTtTags.innerHTML += `<span class="tag">${isEn ? 'Wand of Cold' : '氷の杖'}</span>`;
            }

            if (this.elGklTooltip) this.elGklTooltip.classList.remove('hidden');
          };

          slot.onmouseleave = () => {
            if (this.elGklTooltip) this.elGklTooltip.classList.add('hidden');
          };

          // 2段目アクションメニュー起動関数 (長押し / 右クリック)
          const triggerActionMenu = async () => {
            const currentCore = this.getCore();
            if (!currentCore || !currentCore.driver) return;
            if (this.elGklTooltip) this.elGklTooltip.classList.add('hidden');
            // 1段目インベントリをサイレント通過して2段目アクションメニューを表示
            await currentCore.driver.queueSequence(['i', item.letter], { isSilentSync: true });
          };

          // 通常クリック処理 (短タップ)
          const triggerNormalClick = async () => {
            const currentCore = this.getCore();
            if (!currentCore) return;
            const seq = (item.defaultSequence && Array.isArray(item.defaultSequence) && item.defaultSequence.length > 0)
              ? item.defaultSequence
              : [item.letter];

            if (typeof currentCore.executeSequence === 'function') {
              await currentCore.executeSequence(seq);
            } else if (currentCore.requestController && typeof currentCore.requestController.executeSequence === 'function') {
              await currentCore.requestController.executeSequence(seq);
            } else {
              seq.forEach(ch => currentCore.sendKey(ch, false, false, false, ch, true));
            }
          };

          // 長押し (Pointer Events) & 通常クリック分離ハンドラ
          let pressTimer = null;
          let isLongPress = false;
          const LONG_PRESS_MS = 400;

          slot.onpointerdown = (e) => {
            if (e.button !== 0) return; // 左クリック / タッチのみ
            isLongPress = false;
            slot.classList.add('pressing');

            pressTimer = setTimeout(() => {
              isLongPress = true;
              slot.classList.remove('pressing');
              if (navigator.vibrate) navigator.vibrate(25);
              triggerActionMenu();
            }, LONG_PRESS_MS);
          };

          slot.onpointerup = (e) => {
            if (pressTimer) {
              clearTimeout(pressTimer);
              pressTimer = null;
            }
            slot.classList.remove('pressing');

            if (!isLongPress && e.button === 0) {
              triggerNormalClick();
            }
          };

          const cancelPress = () => {
            if (pressTimer) {
              clearTimeout(pressTimer);
              pressTimer = null;
            }
            slot.classList.remove('pressing');
          };

          slot.onpointercancel = cancelPress;
          slot.onpointerleave = cancelPress;

          // PC向け: 右クリックでも即座に2段目アクションメニューを起動
          slot.oncontextmenu = (e) => {
            e.preventDefault();
            cancelPress();
            triggerActionMenu();
          };
        }
      });
    }
  }
}
