import { EncumbrancePresenter } from "../../../../src/core/knowledge/presenters/EncumbrancePresenter.js";
import { EquipmentActionPlanner } from "../../../../src/core/knowledge/equipment/EquipmentActionPlanner.js";
import { resolveEligibleSlots, isTwoHandedWeapon, isCockatriceCorpse } from "../../../../src/core/knowledge/equipment/EquipmentRules.js";

/**
 * InventoryView - アイコン型インベントリグリッド & ツールチップ & BUCバッジ & 長押し/右クリックアクションマネージャー
 */
export class InventoryView {
  constructor({
    elGklInventoryGrid,
    elGklInvCount,
    elGklEncumbrance,
    elGklTooltip,
    elGklTtName,
    elGklTtTags,
    getCore,
    getLoadedTileImagePath,
    onInspectItem
  }) {
    this.elGklInventoryGrid = elGklInventoryGrid;
    this.elGklInvCount = elGklInvCount;
    this.elGklEncumbrance = elGklEncumbrance || null;
    this.elGklTooltip = elGklTooltip;
    this.elGklTtName = elGklTtName;
    this.elGklTtTags = elGklTtTags;

    this.getCore = getCore || (() => null);
    this.getLoadedTileImagePath = getLoadedTileImagePath || (() => '../../pict/nethack_default_32.png');
    this.onInspectItem = onInspectItem || (() => {});

    this.currentLanguage = 'ja';
    this.presenter = new EncumbrancePresenter({ language: this.currentLanguage });
    this._lastInvHtml = null;

    if (this.elGklInventoryGrid && typeof this.elGklInventoryGrid.addEventListener === 'function') {
      this.elGklInventoryGrid.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
    }
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
    if (this.presenter) {
      this.presenter.setLanguage(lang);
    }
    this._lastInvHtml = null;
  }

  getItemSymbol(item) {
    if (!item) return '📦';
    if (item.isPickAxe) return '⛏️';
    if (item.isDigWand) return '🪄';
    if (item.isKey) return '🗝️';
    if (item.isAxe) return '🪓';
    if (item.isFrostWand) return '❄️';
    if (item.isWielded) return '⚔️';
    if (item.isOffhand) return '🗡️';
    if (item.isQuivered) return '🏹';
    if (item.isWorn) return '🛡️';

    const cat = String(item.category || '').toUpperCase();
    if (cat === 'POTION') return '🧪';
    if (cat === 'SCROLL') return '📜';
    if (cat === 'WAND') return '🪄';
    if (cat === 'RING') return '💍';
    if (cat === 'AMULET') return '🧿';
    if (cat === 'SPELLBOOK') return '📖';
    if (cat === 'FOOD') return '🍖';
    if (cat === 'GOLD') return '💰';
    if (cat === 'WEAPON') return '⚔️';
    if (cat === 'ARMOR') return '🛡️';
    if (cat === 'TOOL') return '🔧';

    return '📦';
  }

  _ensureEncumbranceContainer() {
    if (this.elGklEncumbrance) return this.elGklEncumbrance;
    if (this.elGklInventoryGrid && this.elGklInventoryGrid.parentElement) {
      let footer = this.elGklInventoryGrid.parentElement.querySelector('.gkl-inventory-footer');
      if (!footer) {
        footer = document.createElement('div');
        footer.className = 'gkl-inventory-footer';
        footer.style.cssText = 'padding: 6px 10px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2);';
        this.elGklInventoryGrid.parentElement.appendChild(footer);
      }
      this.elGklEncumbrance = footer;
      return this.elGklEncumbrance;
    }
    return null;
  }

  renderEncumbrance(encumbrance) {
    const el = this._ensureEncumbranceContainer();
    if (!el || !encumbrance) return;
    this.presenter.setLanguage(this.currentLanguage);
    el.innerHTML = this.presenter.renderMiniGaugeHtml(encumbrance, { language: this.currentLanguage });
  }

  renderGklInventory(inventory, slotBadges = {}, encumbrance = null) {
    if (!this.elGklInventoryGrid || !inventory) return;
    const isEn = this.currentLanguage === 'en';
    const items = inventory.items || [];
    if (this.elGklInvCount) {
      this.elGklInvCount.textContent = items.length;
    }

    if (encumbrance) {
      this.renderEncumbrance(encumbrance);
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
          const bucStatus = id.bucStatus || item.bucStatus || 'UNKNOWN';

          let bucBadgeHtml = '';
          if (isUnidentified) {
            bucBadgeHtml = `<span class="gkl-slot-buc-badge badge-buc-unid" title="${isEn ? 'Unidentified' : '未識別'}">?</span>`;
          } else if (bucStatus === 'CURSED') {
            bucBadgeHtml = `<span class="gkl-slot-buc-badge badge-buc-cursed" title="${isEn ? 'Cursed' : '呪い'}">-</span>`;
          } else if (bucStatus === 'BLESSED') {
            bucBadgeHtml = `<span class="gkl-slot-buc-badge badge-buc-blessed" title="${isEn ? 'Blessed' : '祝福'}">+</span>`;
          }

          return `
            <div class="gkl-item-slot ${equipClassStr}" draggable="true" data-letter="${item.letter}" data-rawtext="${encodeURIComponent(item.rawText)}">
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
          slot.ondragstart = (e) => {
            if (e.dataTransfer) {
              e.dataTransfer.setData('text/plain', item.letter);
            }
          };

          slot.onmouseenter = () => {
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

              this.elGklTtTags.innerHTML += `<span class="tag" style="background:rgba(255,255,255,0.08);color:#cbd5e1;">${isEn ? 'Right-click / Hold: Submenu' : '右クリック / 左長押し: サブメニュー'}</span>`;
              this.elGklTtTags.innerHTML += `<span class="tag" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.4);">${isEn ? '🔍 Right-click hold: Knowledge' : '🔍 右長押し: ナレッジ詳細'}</span>`;
            }

            if (this.elGklTooltip) this.elGklTooltip.classList.remove('hidden');
          };

          slot.onmouseleave = () => {
            if (this.elGklTooltip) this.elGklTooltip.classList.add('hidden');
          };

          // ナレッジ詳細閲覧関数 (右長押し)
          const triggerInspect = () => {
            if (this.elGklTooltip) this.elGklTooltip.classList.add('hidden');

            // モーダルが前面に出た後にユーザーが右ボタンを離した際の
            // contextmenu イベントを window レベルで確実に捕捉・抑止
            if (typeof window !== 'undefined') {
              const suppressHandler = (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                window.removeEventListener('contextmenu', suppressHandler, true);
              };
              window.addEventListener('contextmenu', suppressHandler, true);
              setTimeout(() => {
                window.removeEventListener('contextmenu', suppressHandler, true);
              }, 600);
            }

            if (typeof this.onInspectItem === 'function') {
              this.onInspectItem(item);
            }
          };

          // 2段目アクションメニュー起動関数 (左長押し / 右クリック短押し)
          const triggerActionMenu = async () => {
            const currentCore = this.getCore();
            if (!currentCore || !currentCore.driver) return;
            if (this.elGklTooltip) this.elGklTooltip.classList.add('hidden');
            // 1段目インベントリをサイレント通過して2段目アクションメニューを表示
            await currentCore.driver.queueSequence(['i', item.letter], { isSilentSync: true });
          };

          // 通常クリック処理 (左短タップ)
          const triggerNormalClick = async () => {
            const currentCore = this.getCore();
            if (!currentCore) return;

            // 装備品かつ換装依存関係解決対象であるか判定
            if (this._isEquippableItem(item)) {
              const currentInv = (currentCore.gkl && typeof currentCore.gkl.getInventory === 'function')
                ? currentCore.gkl.getInventory()
                : (inventory || (currentCore.inventory?.items || currentCore.inventory || []));

              const recipe = EquipmentActionPlanner.planForTarget(currentInv, item);
              if (recipe) {
                // 実行不能（呪詛ブロッカーや石化リスク等）の場合は安全にブロック
                if (!recipe.canExecute) {
                  this._showSafetyAlert(recipe.blockingReason);
                  return;
                }

                // 依存関係（複数ステップ）または複数ターン消費の場合
                if (recipe.steps.length > 1 || recipe.isMultiTurn) {
                  const hasHostileNearby = this._checkNearbyHostile(currentCore);
                  const needsConfirmation = hasHostileNearby || recipe.isMultiTurn || (recipe.risks?.targetBucStatus === 'unknown');

                  if (needsConfirmation) {
                    const confirmed = this._showConfirmationDialog(recipe, hasHostileNearby, item);
                    if (!confirmed) return; // ユーザーがキャンセル
                  }

                  await this._executeSequence(currentCore, recipe.sequence);
                  return;
                }
              }
            }

            // 依存関係のない通常の単一アクション
            const seq = (item.defaultSequence && Array.isArray(item.defaultSequence) && item.defaultSequence.length > 0)
              ? item.defaultSequence
              : [item.letter];

            await this._executeSequence(currentCore, seq);
          };

          // 長押し (Pointer Events) & クリック分離ハンドラ
          let leftPressTimer = null;
          let rightPressTimer = null;
          let isLeftLongPress = false;
          let isRightLongPress = false;
          const LONG_PRESS_MS = 400;

          slot.onpointerdown = (e) => {
            if (e.button === 0) {
              // 左クリック / タッチ
              isLeftLongPress = false;
              slot.classList.add('pressing');

              leftPressTimer = setTimeout(() => {
                isLeftLongPress = true;
                slot.classList.remove('pressing');
                if (navigator.vibrate) navigator.vibrate(25);
                triggerActionMenu(); // 左長押し ➔ サブメニュー
              }, LONG_PRESS_MS);
            } else if (e.button === 2) {
              // 右クリック
              if (typeof e.preventDefault === 'function') e.preventDefault();
              isRightLongPress = false;
              slot.classList.add('pressing');

              rightPressTimer = setTimeout(() => {
                isRightLongPress = true;
                slot.classList.remove('pressing');
                if (navigator.vibrate) navigator.vibrate(25);
                triggerInspect(); // 右長押し ➔ ナレッジ詳細
              }, LONG_PRESS_MS);
            }
          };

          slot.onpointerup = (e) => {
            if (e.button === 0) {
              if (leftPressTimer) {
                clearTimeout(leftPressTimer);
                leftPressTimer = null;
              }
              slot.classList.remove('pressing');

              if (!isLeftLongPress) {
                triggerNormalClick(); // 左短押し ➔ 通常アクション (装備/使用)
              }
            } else if (e.button === 2) {
              if (rightPressTimer) {
                clearTimeout(rightPressTimer);
                rightPressTimer = null;
              }
              slot.classList.remove('pressing');
              // 右クリック短押しは oncontextmenu で実行
            }
          };

          const cancelPress = () => {
            if (leftPressTimer) {
              clearTimeout(leftPressTimer);
              leftPressTimer = null;
            }
            if (rightPressTimer) {
              clearTimeout(rightPressTimer);
              rightPressTimer = null;
            }
            slot.classList.remove('pressing');
          };

          slot.onpointercancel = cancelPress;
          slot.onpointerleave = cancelPress;

          // 右クリックイベントハンドラ (PC向け短押しでサブメニュー、長押し完了時は抑止)
          slot.oncontextmenu = (e) => {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            if (rightPressTimer) {
              clearTimeout(rightPressTimer);
              rightPressTimer = null;
            }
            slot.classList.remove('pressing');

            if (isRightLongPress) {
              // 右長押しでナレッジ詳細モーダル表示済み
              isRightLongPress = false;
            } else if (isLeftLongPress) {
              // タッチ長押し等でサブメニュー表示済み
              isLeftLongPress = false;
            } else {
              // 右クリック短押し ➔ サブメニュー
              triggerActionMenu();
            }
          };
        }
      });
    }
  }

  /**
   * アイテムが自動換装プランナーの対象となる装備品か判定
   * @private
   */
  _isEquippableItem(item) {
    if (!item) return false;
    if (item.isWorn) return false; // 既に着用中の脱衣は通常アクションへ
    const cat = String(item.category || item.knowledge?.category || '').toUpperCase();
    if (cat === 'ARMOR' || cat === 'RING' || cat === 'AMULET') return true;
    if (item.armorSlot || item.knowledge?.armorSlot) return true;
    if (item.isBlindfoldOrTowel) return true;
    const slots = resolveEligibleSlots(item);
    if (slots.some(s => s !== 'main_hand' && s !== 'quiver')) return true;
    if (isTwoHandedWeapon(item) || isCockatriceCorpse(item)) return true;
    return false;
  }

  /**
   * プレイヤー周囲に敵対モンスターが存在するか確認
   * @private
   */
  _checkNearbyHostile(core) {
    if (!core) return false;
    try {
      // 1. GKLPlugin の公開メソッド getPerceivedMonstersSummary を利用
      if (core.gkl && typeof core.gkl.getPerceivedMonstersSummary === 'function') {
        const summaries = core.gkl.getPerceivedMonstersSummary();
        if (Array.isArray(summaries) && summaries.length > 0) {
          const hasCloseHostile = summaries.some(m => {
            if (m.isPet || m.isPeaceful) return false;
            const dist = typeof m.distance === 'number' ? m.distance : (typeof m.dist === 'number' ? m.dist : 999);
            return dist <= 5;
          });
          if (hasCloseHostile) return true;
        }
      }

      // 2. core.areaState が直接公開されている場合のフォールバック
      const areaState = (core.gkl && typeof core.gkl.getAreaState === 'function')
        ? core.gkl.getAreaState()
        : core.areaState;

      if (areaState && areaState.grid) {
        const playerX = areaState.playerLocation?.x ?? areaState.center?.x ?? 0;
        const playerY = areaState.playerLocation?.y ?? areaState.center?.y ?? 0;

        for (const cell of Object.values(areaState.grid)) {
          if (!cell || !cell.monster) continue;
          const mon = cell.monster;
          if (mon.type === 'PET' || mon.isPet || mon.isTame || mon.isPeaceful || mon.attitude === 'PEACEFUL' || mon.flags?.isPet) {
            continue;
          }
          const dx = (cell.x ?? 0) - playerX;
          const dy = (cell.y ?? 0) - playerY;
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          if (dist <= 5) {
            return true;
          }
        }
      }
    } catch (e) {
      console.warn('[InventoryView] Failed to check nearby hostiles:', e);
    }
    return false;
  }

  /**
   * セーフティ確認ダイアログの表示
   * @private
   */
  _showConfirmationDialog(recipe, hasHostileNearby, item) {
    const isEn = this.currentLanguage === 'en';
    const itemName = item ? (item.rawText || item.name) : (recipe.targetItem?.name || 'Item');
    const stepLines = recipe.steps.map((s, idx) => `  ${idx + 1}. ${isEn ? s.descriptionEn : s.descriptionJa}`).join('\n');

    let msg = '';
    if (isEn) {
      msg = `[Equipment Change Confirmation]\nChanging equipment for "${itemName}".\n\nSteps:\n${stepLines}\n\nEstimated time: ~${recipe.totalEstimatedTurns} turn(s).\n`;
      if (hasHostileNearby) {
        msg += `⚠️ WARNING: Hostile monster(s) nearby!\n`;
      }
      if (recipe.risks?.targetBucStatus === 'unknown') {
        msg += `⚠️ Note: Item BUC status is unconfirmed (may be cursed).\n`;
      }
      msg += `\nProceed with equipment change?`;
    } else {
      msg = `【装備換装の確認】\n「${itemName}」を装備するため、自動換装を行います。\n\n手順:\n${stepLines}\n\n所要ターン数: 約 ${recipe.totalEstimatedTurns} ターン\n`;
      if (hasHostileNearby) {
        msg += `⚠️ 警告: 近くに敵対モンスターがいます！\n`;
      }
      if (recipe.risks?.targetBucStatus === 'unknown') {
        msg += `⚠️ 注意: アイテムの呪詛状態(BUC)が未確定です。\n`;
      }
      msg += `\n換装を実行しますか？`;
    }

    return window.confirm(msg);
  }

  /**
   * 致命的セーフティアラートの表示
   * @private
   */
  _showSafetyAlert(message) {
    const isEn = this.currentLanguage === 'en';
    const title = isEn ? '[Equipment Safety Guard]' : '【装備セーフティガード】';
    window.alert(`${title}\n${message}`);
  }

  /**
   * キーストローク列の実行
   * @private
   */
  async _executeSequence(core, seq) {
    if (!core || !seq || seq.length === 0) return;
    if (typeof core.executeSequence === 'function') {
      await core.executeSequence(seq);
    } else if (core.requestController && typeof core.requestController.executeSequence === 'function') {
      await core.requestController.executeSequence(seq);
    } else {
      seq.forEach(ch => core.sendKey(ch, false, false, false, ch, true));
    }
  }
}
