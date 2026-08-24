import { Component, For, Show, createSignal } from 'solid-js';
import { gklSituation, hoveredTileKnowledge, currentLanguage } from '../stores/gameStore';
import { driverController, ATTRIBUTE_DEFINITIONS } from '../services/useNetHackDriver';

export const GklKnowledgePanel: Component = () => {
  const isEn = () => currentLanguage() === 'en';
  const [selectedDir, setSelectedDir] = createSignal('ALL');
  const [isSyncing, setIsSyncing] = createSignal(false);
  const [hoveredItem, setHoveredItem] = createSignal<any | null>(null);
  const [selectedAreaTile, setSelectedAreaTile] = createSignal<any | null>(null);
  const [hoveredAreaTile, setHoveredAreaTile] = createSignal<any | null>(null);

  // 長押しタイマー管理
  const pressTimers: Record<string, any> = {};
  const isLongPress: Record<string, boolean> = {};

  const handleItemPointerDown = (item: any, e: PointerEvent) => {
    if (e.button !== 0) return;
    isLongPress[item.letter] = false;
    pressTimers[item.letter] = setTimeout(() => {
      isLongPress[item.letter] = true;
      if (navigator.vibrate) navigator.vibrate(25);
      driverController.openItemActionMenu(item.letter);
    }, 400);
  };

  const handleItemPointerUp = (item: any, e: PointerEvent) => {
    if (pressTimers[item.letter]) {
      clearTimeout(pressTimers[item.letter]);
      delete pressTimers[item.letter];
    }
    if (!isLongPress[item.letter] && e.button === 0) {
      handleOneTapItem(item);
    }
  };

  const handleItemPointerLeave = (item: any) => {
    handleItemPointerCancel(item);
    setHoveredItem(null);
  };

  const handleItemPointerCancel = (item: any) => {
    if (pressTimers[item.letter]) {
      clearTimeout(pressTimers[item.letter]);
      delete pressTimers[item.letter];
    }
  };

  const handleItemContextMenu = (item: any, e: MouseEvent) => {
    e.preventDefault();
    handleItemPointerCancel(item);
    driverController.openItemActionMenu(item.letter);
  };

  const activeAttributes = () => {
    const res = gklSituation()?.attributes?.effectiveResistances || {};
    return ATTRIBUTE_DEFINITIONS.filter((item: any) => Boolean(res[item.key]));
  };

  const isSkillsSynced = () => Boolean(gklSituation()?.skills?.isSynced);
  const activeSkills = () => gklSituation()?.skills?.activeItems || [];
  const activeSpells = () => gklSituation()?.spells?.items || [];
  const tacticalAdvices = () => gklSituation()?.advices || [];
  const hasCriticalAdvice = () => {
    return tacticalAdvices().some((adv: any) => adv.isCritical || adv.severity === 'CRITICAL' || adv.level === 'CRITICAL' || adv.dangerLevel === 'LETHAL');
  };

  const handleSyncSkills = async () => {
    await driverController.syncSkillsSilent();
  };

  const handleSyncSpells = async () => {
    await driverController.syncSpellsSilent();
  };

  const handleCastSpell = (letter: string) => {
    driverController.castSpell(letter);
  };

  const handleEnhanceSkill = (skill?: any) => {
    driverController.enhanceSkill(skill);
  };

  const dpadButtons = () => [
    { id: 'NW', label: isEn() ? 'NW' : '北西', icon: '↖' },
    { id: 'N', label: isEn() ? 'N' : '北', icon: '↑' },
    { id: 'NE', label: isEn() ? 'NE' : '北東', icon: '↗' },
    { id: 'W', label: isEn() ? 'W' : '西', icon: '←' },
    { id: 'SELF', label: isEn() ? 'Self' : '足元', icon: '・' },
    { id: 'E', label: isEn() ? 'E' : '東', icon: '→' },
    { id: 'SW', label: isEn() ? 'SW' : '南西', icon: '↙' },
    { id: 'S', label: isEn() ? 'S' : '南', icon: '↓' },
    { id: 'SE', label: isEn() ? 'SE' : '南東', icon: '↘' },
  ];

  const safeText = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string' || typeof val === 'number') return String(val);
    if (typeof val === 'object') {
      return val.code || val.label || val.name || val.key || '';
    }
    return String(val);
  };

  const zoomTiles = () => driverController.getZoomAreaTiles(3); // 7x7

  const allActions = () => gklSituation()?.actions || gklSituation()?.recommendedActions || [];

  const filteredActions = () => {
    const dir = selectedDir();
    const acts = allActions();
    if (dir === 'ALL') return acts;
    return acts.filter((act: any) => driverController.extractDirectionCode(act) === dir);
  };

  const inventoryItems = () => gklSituation()?.inventory?.items || [];

  const activeKnowledge = () => {
    const item = hoveredItem();
    if (item && item.knowledge) return item.knowledge;
    const haTile = hoveredAreaTile();
    if (haTile && haTile.knowledge) return haTile.knowledge;
    const saTile = selectedAreaTile();
    if (saTile && saTile.knowledge) return saTile.knowledge;
    const tile = hoveredTileKnowledge();
    if (tile && tile.knowledge) return tile.knowledge;
    return null;
  };

  const activeCoord = () => {
    const haTile = hoveredAreaTile();
    if (haTile && haTile.x !== undefined && haTile.x >= 0) return { x: haTile.x, y: haTile.y };
    const saTile = selectedAreaTile();
    if (saTile && saTile.x !== undefined && saTile.x >= 0) return { x: saTile.x, y: saTile.y };
    const tile = hoveredTileKnowledge();
    if (tile && tile.x !== undefined) return { x: tile.x, y: tile.y };
    return null;
  };

  const activeTileInfo = () => {
    const tile = hoveredAreaTile() || selectedAreaTile();
    if (!tile || tile.x < 0) return isEn() ? '🔍 Hover/Tap tile to inspect' : '🔍 マスにホバー/タップで解説';
    return `📍 (${tile.x}, ${tile.y}): ${tile.name || tile.nameJa}`;
  };

  const currentFilterLabel = () => {
    const dir = selectedDir();
    if (dir === 'ALL') return isEn() ? 'All' : '全方向';
    const found = dpadButtons().find(b => b.id === dir);
    return found ? `${found.label} (${found.icon})` : dir;
  };

  const getActionCountForDir = (dirId: string): number => {
    return allActions().filter((act: any) => driverController.extractDirectionCode(act) === dirId).length;
  };

  const getItemCategoryLabel = (cat: string | undefined): string => {
    if (!cat) return isEn() ? 'Knowledge' : '解説';
    const enMap: Record<string, string> = {
      WEAPON: '⚔️ Weapon', ARMOR: '🛡️ Armor', RING: '💍 Ring', AMULET: '📿 Amulet',
      WAND: '🪄 Wand', SCROLL: '📜 Scroll', POTION: '🧪 Potion', SPELLBOOK: '📖 Spellbook',
      FOOD: '🍖 Food', TOOL: '🧰 Tool', GEM: '💎 Gem', COIN: '🪙 Gold',
      CONTAINER: '🧰 Container', TERRAIN: '🗺️ Terrain', MONSTER: '👾 Monster', PET: '🐶 Pet',
      CORPSE: '🍖 Corpse', STATUE: '🗿 Statue'
    };
    const jaMap: Record<string, string> = {
      WEAPON: '⚔️ 武器', ARMOR: '🛡️ 防具', RING: '💍 指輪', AMULET: '📿 魔除け',
      WAND: '🪄 杖', SCROLL: '📜 巻物', POTION: '🧪 薬', SPELLBOOK: '📖 呪文書',
      FOOD: '🍖 食料', TOOL: '🧰 道具', GEM: '💎 宝石', COIN: '🪙 金貨',
      CONTAINER: '🧰 容器', TERRAIN: '🗺️ 地形', MONSTER: '👾 モンスター', PET: '🐶 ペット',
      CORPSE: '🍖 死体', STATUE: '🗿 石像'
    };
    const map = isEn() ? enMap : jaMap;
    return map[cat.toUpperCase()] || cat;
  };

  const getDangerBadgeInfo = (level: string | undefined) => {
    if (!level) return null;
    const l = String(level).toUpperCase();
    if (l === 'LETHAL' || l === 'EXTREME' || l === 'VERY_HIGH') {
      return { label: isEn() ? `☠️ Lethal (${l})` : `☠️ 致命的 (${l})`, color: '#ff0055', bg: 'rgba(255, 0, 85, 0.2)', border: '#ff0055' };
    }
    if (l === 'HIGH') {
      return { label: isEn() ? `⚠️ Danger (HIGH)` : `⚠️ 危険 (HIGH)`, color: '#ff9f1c', bg: 'rgba(255, 159, 28, 0.2)', border: '#ff9f1c' };
    }
    if (l === 'MEDIUM') {
      return { label: isEn() ? `⚡ Warning (MEDIUM)` : `⚡ 注意 (MEDIUM)`, color: '#ffe600', bg: 'rgba(255, 230, 0, 0.2)', border: '#ffe600' };
    }
    return { label: isEn() ? `🟢 Safe (${l})` : `🟢 低脅威 (${l})`, color: '#2ec4b6', bg: 'rgba(46, 196, 182, 0.2)', border: '#2ec4b6' };
  };

  const formatResistances = (res: any): string => {
    if (!res || !Array.isArray(res) || res.length === 0) return '';
    if (isEn()) return res.join(', ');
    const map: Record<string, string> = {
      fire: '火炎', cold: '冷気', sleep: '睡眠', poison: '毒', electricity: '電撃',
      acid: '酸', shock: '電撃', petrify: '石化', drain: 'ドレイン', magic: '魔法'
    };
    return res.map((r: string) => map[r.toLowerCase()] || r).join(', ');
  };

  const formatAttacks = (attacks: any): string => {
    if (!attacks || !Array.isArray(attacks) || attacks.length === 0) return '';
    return attacks.map((a: any) => {
      if (typeof a === 'string') return a;
      const type = a.type || a.name || (isEn() ? 'Attack' : '攻撃');
      const dmg = a.damage ? `(${a.damage})` : '';
      const eff = a.effect ? ` [${a.effect}]` : '';
      return `${type}${dmg}${eff}`;
    }).join(', ');
  };

  const getSolidGlyphStyle = (glyphId: number) => {
    const rawStyle = driverController.getGlyphStyle(glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 22 });
    if (!rawStyle) return {};
    return {
      'background-image': rawStyle.backgroundImage || 'none',
      'background-position': rawStyle.backgroundPosition || '0px 0px',
      'background-size': rawStyle.backgroundSize || 'auto',
      'background-repeat': 'no-repeat',
      width: rawStyle.width || '22px',
      height: rawStyle.height || '22px',
      display: 'inline-block',
    };
  };

  const getEquipBorderStyle = (item: any) => {
    if (item.isWielded) return { border: '2px solid #e9c46a', 'box-shadow': '0 0 6px rgba(233, 196, 106, 0.5)' };
    if (item.isOffhand) return { border: '2px solid #4ea8de', 'box-shadow': '0 0 6px rgba(78, 168, 222, 0.5)' };
    if (item.isQuivered) return { border: '2px solid #2a9d8f', 'box-shadow': '0 0 6px rgba(42, 157, 143, 0.5)' };
    if (item.isWorn) return { border: '2px solid #9d4edd', 'box-shadow': '0 0 6px rgba(157, 78, 221, 0.5)' };
    return { border: '1px solid #3b4252' };
  };

  const handleSelectZoomTile = (tile: any) => {
    setSelectedAreaTile(tile);
    const dirMap: Record<string, string> = {
      '-1,-1': 'NW', '0,-1': 'N', '1,-1': 'NE',
      '-1,0': 'W',   '0,0': 'SELF', '1,0': 'E',
      '-1,1': 'SW',  '0,1': 'S',  '1,1': 'SE',
    };
    const key = `${tile.dx},${tile.dy}`;
    if (dirMap[key]) {
      setSelectedDir(dirMap[key]);
    }
  };

  const handleSyncInventory = async () => {
    setIsSyncing(true);
    await driverController.syncInventorySilent();
    setIsSyncing(false);
  };

  const handleExecuteAction = (act: any) => {
    if (act.risk === 'danger' || act.isDanger) {
      const label = safeText(act.label || '操作');
      if (!window.confirm(`【⚠️ 危険な行動】\n"${label}" を実行しますか？`)) return;
    }
    setSelectedDir('ALL');
    driverController.executeAction(act);
  };

  const handleOneTapItem = (item: any) => {
    const seq = (item.defaultSequence && Array.isArray(item.defaultSequence) && item.defaultSequence.length > 0)
      ? item.defaultSequence
      : [item.letter];
    driverController.executeSequence(seq);
  };

  const getActionClass = (act: any) => {
    if (act.risk === 'danger' || act.category === 'ATTACK' || act.isDanger) return 'btn-danger';
    if (act.category === 'UNCOMMITTED' || act.category === 'ITEM') return 'btn-info';
    return 'btn-primary';
  };

  return (
    <div class="gkl-panel" style={{ background: '#181b24', border: '1px solid #3b4252', 'border-radius': '6px', padding: '12px 16px', color: '#e5e9f0', 'font-family': 'system-ui, sans-serif', 'margin-top': '8px', display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
      {/* 1. ヘッダー ＆ ステータス ＆ 🚨 危機点滅バッジ */}
      <div class="gkl-header" style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'border-bottom': '1px solid #2e3440', 'padding-bottom': '8px' }}>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '10px', 'flex-wrap': 'wrap' }}>
          <span class="gkl-badge" style={{ background: 'linear-gradient(135deg, #00e676, #00b0ff)', color: '#090d16', 'font-weight': 'bold', 'font-size': '11px', padding: '4px 8px', 'border-radius': '4px' }}>
            {isEn() ? '🧠 GKL Situation Reasoning & Knowledge Assist' : '🧠 GKL 状況推論 ＆ ナレッジアシスト'}
          </span>
          <Show when={hasCriticalAdvice()}>
            <span style={{ background: '#e74c3c', color: '#ffffff', 'font-weight': 'bold', 'font-size': '11px', padding: '3px 8px', 'border-radius': '4px', animation: 'pulse 1s infinite' }}>
              🚨 {isEn() ? 'CRITICAL CRISIS' : '危機警告'}
            </span>
          </Show>
          <button onClick={handleSyncInventory} disabled={isSyncing()} style={{ background: '#3b4252', color: '#88c0d0', border: '1px solid #4c566a', padding: '3px 8px', 'border-radius': '4px', 'font-size': '11px', cursor: 'pointer' }}>
            {isSyncing() ? (isEn() ? '...Syncing' : '...同期中') : (isEn() ? '🔄 Sync Inventory' : '🔄 インベントリ同期')}
          </button>
          <button onClick={handleSyncSkills} style={{ background: '#3b4252', color: '#88c0d0', border: '1px solid #4c566a', padding: '3px 8px', 'border-radius': '4px', 'font-size': '11px', cursor: 'pointer' }}>
            {isEn() ? '🥋 Sync Skills' : '🥋 スキル同期'}
          </button>
          <button onClick={handleSyncSpells} style={{ background: '#3b4252', color: '#88c0d0', border: '1px solid #4c566a', padding: '3px 8px', 'border-radius': '4px', 'font-size': '11px', cursor: 'pointer' }}>
            {isEn() ? '📖 Sync Spells' : '📖 魔法同期'}
          </button>
        </div>
      </div>

      {/* 🛡️ TacticalAdvisor 戦術アドバイス一覧 */}
      <Show when={tacticalAdvices().length > 0}>
        <div style={{ background: '#1c212d', 'border-left': '4px solid #00e676', 'border-radius': '4px', padding: '8px 12px', display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <div style={{ 'font-size': '11px', 'font-weight': 'bold', color: '#00e676', display: 'flex', 'align-items': 'center', gap: '6px' }}>
            <span>🛡️ {isEn() ? 'Tactical Advisor Recommendations' : '戦術アドバイザー推奨'}</span>
          </div>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px', 'font-size': '11px', color: '#e5e9f0' }}>
            <For each={tacticalAdvices()}>
              {(adv: any) => {
                const advText = typeof adv === 'string' ? adv : (adv.text || adv.message || adv.advice || adv.label || '');
                const isCrit = adv.isCritical || adv.severity === 'CRITICAL';
                return (
                  <div style={{ color: isCrit ? '#ff6b6b' : '#e5e9f0', 'font-weight': isCrit ? 'bold' : 'normal' }}>
                    {isCrit ? '⚠️ ' : '💡 '}{advText}
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* 1.5 🥋 スキル・📖 魔法・🛡️ 属性耐性 総合ステータスバー */}
      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px', background: '#232834', border: '1px solid #3b4252', 'border-radius': '6px', padding: '8px 12px' }}>
        {/* 🛡️ 属性・耐性 */}
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'flex-wrap': 'wrap' }}>
          <strong style={{ 'font-size': '11px', color: '#94a3b8', 'white-space': 'nowrap' }}>{isEn() ? '🛡️ Resistances:' : '🛡️ 属性耐性:'}</strong>
          <Show when={activeAttributes().length > 0} fallback={<span style={{ 'font-size': '11px', color: '#64748b' }}>{isEn() ? 'None' : 'なし'}</span>}>
            <div style={{ display: 'flex', gap: '6px', 'flex-wrap': 'wrap' }}>
              <For each={activeAttributes()}>
                {(attr: any) => (
                  <span style={{ background: 'rgba(14, 165, 233, 0.15)', border: '1px solid #38bdf8', color: '#7dd3fc', padding: '2px 7px', 'border-radius': '4px', 'font-size': '11px', 'font-weight': 'bold' }} title={`${attr.label} / ${attr.en} (有効)`}>
                    {isEn() ? (attr.en || attr.label) : attr.label}
                  </span>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* 🥋 スキル */}
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'flex-wrap': 'wrap' }}>
          <strong style={{ 'font-size': '11px', color: '#94a3b8', 'white-space': 'nowrap' }}>{isEn() ? '🥋 Skills:' : '🥋 スキル:'}</strong>
          <Show when={activeSkills().length > 0} fallback={<span style={{ 'font-size': '11px', color: '#64748b' }}>{isSkillsSynced() ? (isEn() ? 'None (Unskilled)' : 'なし (未熟)') : (isEn() ? 'Not Synced' : '未同期')}</span>}>
            <div style={{ display: 'flex', gap: '6px', 'flex-wrap': 'wrap' }}>
              <For each={activeSkills()}>
                {(skill: any) => {
                  const isEnhanceable = skill.canEnhance;
                  return (
                    <button
                      type="button"
                      style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: isEnhanceable ? '1px solid #f59e0b' : '1px solid #3b82f6',
                        color: '#93c5fd',
                        padding: '2px 7px',
                        'border-radius': '4px',
                        'font-size': '11px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        'align-items': 'center',
                        gap: '4px',
                      }}
                      title={skill.rawText || skill.name}
                      onClick={() => handleEnhanceSkill(skill)}
                    >
                      <Show when={isEnhanceable}><span style={{ color: '#f59e0b' }}>⭐</span></Show>
                      <strong>{skill.name}</strong> [{(isEn() ? (skill.rank?.en || skill.rank?.label) : (skill.rank?.label || skill.rank?.en)) || (isEn() ? 'Basic' : '入門')}]
                    </button>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>

        {/* 📖 習得魔法 */}
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'flex-wrap': 'wrap' }}>
          <strong style={{ 'font-size': '11px', color: '#94a3b8', 'white-space': 'nowrap' }}>{isEn() ? '📖 Spells:' : '📖 習得魔法:'}</strong>
          <Show when={activeSpells().length > 0} fallback={<span style={{ 'font-size': '11px', color: '#64748b' }}>{isEn() ? 'None' : 'なし'}</span>}>
            <div style={{ display: 'flex', gap: '6px', 'flex-wrap': 'wrap' }}>
              <For each={activeSpells()}>
                {(sp: any) => {
                  return (
                    <button
                      type="button"
                      style={{
                        background: 'rgba(139, 92, 246, 0.15)',
                        border: '1px solid #a78bfa',
                        color: '#ddd6fe',
                        padding: '2px 8px',
                        'border-radius': '4px',
                        'font-size': '11px',
                        cursor: 'pointer',
                      }}
                      title={`Key: ${sp.letter}, Lv.${sp.level} ${sp.category} (Fail: ${sp.failRate})`}
                      onClick={() => handleCastSpell(sp.letter)}
                    >
                      ✨ [{sp.letter}] {sp.name} <small style={{ color: '#94a3b8' }}>(Lv.{sp.level} {sp.failRate})</small>
                    </button>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>
      </div>

      {/* 2. 所持品インベントリ */}
      <Show when={inventoryItems().length > 0}>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
          <div style={{ 'font-size': '12px', 'font-weight': 'bold', color: '#ebcb8b', display: 'flex', 'align-items': 'center', gap: '6px', 'flex-wrap': 'wrap' }}>
            <span>{isEn() ? `🎒 Inventory Guide (${inventoryItems().length} items)` : `🎒 所持品ナレッジ・ガイド (${inventoryItems().length}個)`}</span>
            <span style={{ 'font-size': '10px', color: '#88c0d0', 'font-weight': 'normal' }}>
              {isEn() ? '※ Tap: One-tap use / Long-press or Right-click: Action Menu' : '※ タップ: 即時使用 / 長押し・右クリック: アクションメニュー'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }}>
            <For each={inventoryItems()}>
              {(item: any) => {
                const solidStyle = getSolidGlyphStyle(item.glyphId);
                const equipStyle = getEquipBorderStyle(item);
                const isHovered = () => hoveredItem()?.letter === item.letter;

                return (
                  <div
                    style={{
                      background: isHovered() ? '#2e3440' : '#232834',
                      'border-radius': '6px',
                      padding: '6px 10px',
                      display: 'flex',
                      'align-items': 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.15s ease-in-out',
                      'user-select': 'none',
                      ...equipStyle,
                    }}
                    onPointerDown={(e) => handleItemPointerDown(item, e)}
                    onPointerUp={(e) => handleItemPointerUp(item, e)}
                    onPointerLeave={() => handleItemPointerLeave(item)}
                    onPointerCancel={() => handleItemPointerCancel(item)}
                    onContextMenu={(e) => handleItemContextMenu(item, e)}
                    onMouseEnter={() => setHoveredItem(item)}
                  >
                    <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
                      <span style={{ 'font-weight': 'bold', color: '#88c0d0', 'font-family': 'monospace', 'font-size': '12px' }}>[{item.letter}]</span>
                      <Show when={item.glyphId !== undefined && item.glyphId >= 0}>
                        <div style={{ width: '24px', height: '24px', 'border-radius': '3px', 'flex-shrink': 0, ...solidStyle }} />
                      </Show>
                      <Show when={item.isWielded}><span style={{ 'font-size': '9px', 'font-weight': 'bold', padding: '1px 4px', 'border-radius': '3px', color: '#1a1a2e', background: '#e9c46a' }} title={isEn() ? 'Main weapon' : 'メイン武器'}>{isEn() ? 'Main' : '手'}</span></Show>
                      <Show when={item.isOffhand}><span style={{ 'font-size': '9px', 'font-weight': 'bold', padding: '1px 4px', 'border-radius': '3px', color: '#1a1a2e', background: '#4ea8de' }} title={isEn() ? 'Off-hand weapon' : '副武器'}>{isEn() ? 'Off' : '副'}</span></Show>
                      <Show when={item.isQuivered}><span style={{ 'font-size': '9px', 'font-weight': 'bold', padding: '1px 4px', 'border-radius': '3px', color: '#fff', background: '#2a9d8f' }} title={isEn() ? 'Quiver' : '矢筒'}>{isEn() ? 'Quiv' : '筒'}</span></Show>
                      <Show when={item.isWorn}><span style={{ 'font-size': '9px', 'font-weight': 'bold', padding: '1px 4px', 'border-radius': '3px', color: '#fff', background: '#9d4edd' }} title={isEn() ? 'Worn' : '着用中'}>{isEn() ? 'Worn' : '着'}</span></Show>
                      <Show when={item.skillBadge?.isProficient || item.isRecommendedWeapon}>
                        <span style={{ 'font-size': '9px', 'font-weight': 'bold', padding: '1px 4px', 'border-radius': '3px', color: '#000', background: '#22c55e' }} title={`Proficient (${item.skillBadge?.label || '+'})`}>+</span>
                      </Show>
                    </div>

                    {/* 💡 フローティングポップアップ */}
                    <Show when={isHovered()}>
                      <div style={{
                        position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', 'margin-bottom': '6px',
                        background: '#2e3440', border: '1px solid #88c0d0', 'border-radius': '6px', padding: '8px 12px', 'z-index': 100,
                        width: 'max-content', 'max-width': '260px', 'box-shadow': '0 4px 12px rgba(0,0,0,0.5)', 'pointer-events': 'none',
                        display: 'flex', 'flex-direction': 'column', gap: '4px',
                      }}>
                        <div style={{ 'font-weight': 'bold', color: '#ebcb8b', 'font-size': '11px' }}>
                          {safeText(item.knowledge?.name || item.name || item.rawText)}
                        </div>
                        <Show when={item.knowledge?.actionLabel || item.defaultActionLabel || item.defaultActionLabelJa}>
                          <div style={{ 'font-size': '10px', color: '#a3be8c', 'font-weight': 'bold' }}>
                            💡 {isEn() ? 'One-Tap:' : 'ワンタップ:'} {safeText(item.knowledge?.actionLabel || item.defaultActionLabel || item.defaultActionLabelJa)} [{item.letter}]
                          </div>
                        </Show>
                        <div style={{ 'font-size': '9px', color: '#88c0d0', opacity: 0.8 }}>
                          🖱️ {isEn() ? 'Long-press / Right-click: Menu' : '長押し / 右クリック: メニュー'}
                        </div>
                        <Show when={item.knowledge?.effectSummary || item.knowledge?.description}>
                          <div style={{ 'font-size': '10px', color: '#e5e9f0', opacity: 0.9 }}>
                            {safeText(item.knowledge?.effectSummary || item.knowledge?.description)}
                          </div>
                        </Show>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* 3. アクションフィルター ＆ 🔍 7x7 ズームカメラ */}
      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
        <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
          <span style={{ 'font-size': '12px', 'font-weight': 'bold', color: '#ebcb8b' }}>
            {isEn() ? '🎯 Action Filters & 🔍 7x7 Zoom Camera' : '🎯 アクションフィルター ＆ 🔍 7x7 ダンジョンズームカメラ'}
          </span>
          <span style={{ 'font-size': '11px', color: '#88c0d0' }}>{isEn() ? 'Filter:' : '表示:'} {currentFilterLabel()}</span>
        </div>

        <div style={{ display: 'flex', gap: '16px', 'flex-wrap': 'wrap', 'align-items': 'flex-start' }}>
          {/* 左側: 🎯 D-Pad */}
          <div style={{ 'min-width': '170px', background: '#232834', border: '1px solid #2e3440', 'border-radius': '6px', padding: '10px', display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
            <div style={{ 'font-size': '11px', 'font-weight': 'bold', color: '#88c0d0', 'border-bottom': '1px solid #2e3440', 'padding-bottom': '4px' }}>
              {isEn() ? '🎯 Direction Filter' : '🎯 方向フィルター'}
            </div>
            <div style={{ display: 'grid', 'grid-template-columns': 'repeat(3, 46px)', gap: '4px', 'justify-content': 'center' }}>
              <For each={dpadButtons()}>
                {(dp) => {
                  const count = () => getActionCountForDir(dp.id);
                  const isActive = () => selectedDir() === dp.id;
                  return (
                    <button
                      type="button"
                      onClick={() => setSelectedDir(dp.id)}
                      style={{
                        background: isActive() ? '#88c0d0' : '#2e3440',
                        color: isActive() ? '#2e3440' : '#d8dee9',
                        border: `1px solid ${isActive() ? '#88c0d0' : count() > 0 ? '#ebcb8b' : '#4c566a'}`,
                        'border-radius': '4px', height: '36px', display: 'flex', 'flex-direction': 'column', 'align-items': 'center', 'justify-content': 'center',
                        cursor: 'pointer', position: 'relative', padding: '2px', 'font-weight': isActive() ? 'bold' : 'normal',
                      }}
                    >
                      <span style={{ 'font-size': '11px', 'line-height': 1 }}>{dp.icon}</span>
                      <span style={{ 'font-size': '8px', opacity: 0.8 }}>{dp.label}</span>
                      <Show when={count() > 0}>
                        <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#bf616a', color: '#fff', 'font-size': '9px', 'border-radius': '50%', width: '15px', height: '15px', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-weight': 'bold' }}>
                          {count()}
                        </span>
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDir('ALL')}
              style={{
                background: selectedDir() === 'ALL' ? '#88c0d0' : '#2e3440',
                color: selectedDir() === 'ALL' ? '#2e3440' : '#d8dee9',
                border: '1px solid #4c566a', 'border-radius': '4px', padding: '6px 12px', 'font-size': '11px',
                'font-weight': selectedDir() === 'ALL' ? 'bold' : 'normal', cursor: 'pointer', 'margin-top': '4px',
              }}
            >
              {isEn() ? 'Show All (ALL)' : '全表示 (ALL)'}
            </button>
          </div>

          {/* 右側: 🔍 7x7 ズームカメラ */}
          <div style={{ background: '#232834', border: '1px solid #2e3440', 'border-radius': '6px', padding: '10px', display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '8px' }}>
            <div style={{ 'font-size': '11px', 'font-weight': 'bold', color: '#88c0d0', 'border-bottom': '1px solid #2e3440', 'padding-bottom': '4px', width: '100%' }}>
              {isEn() ? '🔍 7x7 Dungeon Zoom Camera' : '🔍 7x7 ダンジョンズームカメラ'}
            </div>

            <div style={{
              display: 'grid', 'grid-template-columns': 'repeat(7, 24px)', 'grid-template-rows': 'repeat(7, 24px)', gap: '2px',
              background: '#141720', padding: '4px', 'border-radius': '4px', border: '1px solid #3b4252'
            }}>
              <For each={zoomTiles()}>
                {(tile: any) => {
                  const isSelected = () => selectedAreaTile()?.x === tile.x && selectedAreaTile()?.y === tile.y;
                  const solidSprite = () => tile.glyphId >= 0 ? getSolidGlyphStyle(tile.glyphId) : null;

                  return (
                    <div
                      style={{
                        width: '24px', height: '24px',
                        background: tile.isPlayer ? '#3b3626' : isSelected() ? '#2e3b38' : '#1e222d',
                        border: `1px solid ${tile.isPlayer ? '#ebcb8b' : isSelected() ? '#a3be8c' : 'transparent'}`,
                        'box-shadow': tile.isPlayer ? '0 0 8px #ebcb8b' : 'none',
                        'border-radius': '2px', display: 'flex', 'align-items': 'center', 'justify-content': 'center', cursor: 'pointer',
                        transition: 'all 0.1s ease-in-out',
                      }}
                      onClick={() => handleSelectZoomTile(tile)}
                      onMouseEnter={() => setHoveredAreaTile(tile)}
                      onMouseLeave={() => setHoveredAreaTile(null)}
                      title={`${tile.name || tile.nameJa} (${tile.x}, ${tile.y})`}
                    >
                      <Show when={solidSprite()} fallback={
                        <span style={{ 'font-family': 'monospace', 'font-size': '14px', color: '#d8dee9' }}>
                          {tile.symbol}
                        </span>
                      }>
                        {(sprite) => <div style={{ width: '22px', height: '22px', 'border-radius': '2px', ...sprite() }} />}
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>

            <div style={{ 'font-size': '9px', color: '#a3be8c', height: '14px', 'text-align': 'center', 'margin-top': '4px' }}>
              {activeTileInfo()}
            </div>
          </div>
        </div>

        {/* アクションボタンリスト */}
        <Show when={filteredActions().length > 0} fallback={
          <div style={{ 'font-size': '11px', color: '#4c566a', padding: '4px 0' }}>
            {selectedDir() === 'ALL' ? (isEn() ? 'Idle (No special targets around / Can move)' : '待機中 (周りに特殊対象なし / 移動可能)') : (isEn() ? `No recommended actions in ${currentFilterLabel()}` : `${currentFilterLabel()} 方向に推奨アクションはありません`)}
          </div>
        }>
          <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }}>
            <For each={filteredActions()}>
              {(act: any) => {
                const labelText = () => safeText(act.label);
                const keyText = () => safeText(act.key || act.verbKey || act.charStr);
                const dirCode = () => driverController.extractDirectionCode(act);
                return (
                  <button
                    onClick={() => handleExecuteAction(act)}
                    class={`btn ${getActionClass(act)}`}
                    style={{ padding: '6px 12px', 'font-size': '12px', 'font-weight': 600, cursor: 'pointer', border: 'none', 'border-radius': '4px', display: 'flex', 'align-items': 'center', gap: '6px' }}
                    title={safeText(act.description || act.label)}
                  >
                    <Show when={keyText()}>
                      <span style={{ 'font-weight': 'bold', 'font-family': 'monospace' }}>[{keyText()}]</span>
                    </Show>
                    <span>{labelText()}</span>
                    <Show when={dirCode() !== 'NONE'}>
                      <span style={{ 'font-size': '10px', opacity: 0.8 }}>({dirCode()})</span>
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* 4. 💡 構造化ナレッジカード */}
      <Show when={activeKnowledge()}>
        {(() => {
          const kn = () => activeKnowledge();
          const dangerBadge = () => getDangerBadgeInfo(kn()?.dangerLevel);
          const adviceList = () => kn()?.tacticalAdvice || kn()?.usageAdvice || [];

          return (
            <div style={{ background: '#2e3440', border: '1px solid #88c0d0', 'border-radius': '4px', padding: '10px 14px', 'margin-top': '4px' }}>
              <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'font-weight': 'bold', 'font-size': '13px', color: '#a3be8c' }}>
                <span>
                  {safeText(kn().name)}
                  <Show when={kn().nameEn && kn().nameEn !== kn().name}>
                    <span style={{ 'font-size': '11px', opacity: 0.8, 'margin-left': '4px' }}>
                      ({safeText(kn().nameEn)})
                    </span>
                  </Show>
                </span>
                <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
                  <Show when={dangerBadge()}>
                    <span style={{ color: dangerBadge()!.color, background: dangerBadge()!.bg, border: `1px solid ${dangerBadge()!.border}`, 'font-size': '10px', 'font-weight': 'bold', padding: '2px 6px', 'border-radius': '4px' }}>
                      {dangerBadge()!.label}
                    </span>
                  </Show>
                  <span style={{ 'font-size': '10px', color: '#88c0d0' }}>{getItemCategoryLabel(kn().category || kn().type)}</span>
                </div>
              </div>

              <div style={{ 'font-size': '11px', color: '#e5e9f0', 'margin-top': '6px', display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                {/* 👾 モンスター専用ステータス */}
                <Show
                  when={kn().category === 'MONSTER' || kn().type === 'MONSTER'}
                  fallback={
                    (() => {
                      const specs = driverController.getAdaptiveSpecs(kn());
                      if (!specs || specs.length === 0) return null;
                      return (
                        <div style={{ display: 'flex', gap: '6px', 'flex-wrap': 'wrap', 'margin-bottom': '4px' }}>
                          <For each={specs}>
                            {(s: any) => {
                              const isHigh = s.highlight;
                              const borderCol = isHigh ? '#38bdf8' : '#334155';
                              const labelCol = isHigh ? '#38bdf8' : '#94a3b8';
                              const valCol = '#f8fafc';
                              return (
                                <span style={{ background: isHigh ? 'rgba(14, 165, 233, 0.15)' : 'rgba(30, 41, 59, 0.7)', border: `1px solid ${borderCol}`, padding: '2px 7px', 'border-radius': '4px', 'font-size': '11px', display: 'inline-flex', 'align-items': 'center', gap: '4px' }}>
                                  <span style={{ color: labelCol, 'font-size': '10px' }}>{s.label}:</span>
                                  <strong style={{ color: valCol }}>{s.value}</strong>
                                  <Show when={s.skillBadge}>
                                    <span style={{ color: '#22c55e', 'font-weight': 'bold', 'font-size': '10px', 'margin-left': '2px' }}>{s.skillBadge.label}</span>
                                  </Show>
                                </span>
                              );
                            }}
                          </For>
                        </div>
                      );
                    })()
                  }
                >
                  <Show when={kn().stats}>
                    <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'margin-bottom': '4px' }}>
                      <Show when={kn().stats.hd !== undefined}><span style={{ background: '#232834', border: '1px solid #4c566a', padding: '2px 6px', 'border-radius': '3px', 'font-size': '10px', color: '#88c0d0' }}>HD: <strong style={{ color: '#ebcb8b' }}>{kn().stats.hd}</strong></span></Show>
                      <Show when={kn().stats.ac !== undefined}><span style={{ background: '#232834', border: '1px solid #4c566a', padding: '2px 6px', 'border-radius': '3px', 'font-size': '10px', color: '#88c0d0' }}>AC: <strong style={{ color: '#ebcb8b' }}>{kn().stats.ac}</strong></span></Show>
                      <Show when={kn().stats.speed !== undefined}><span style={{ background: '#232834', border: '1px solid #4c566a', padding: '2px 6px', 'border-radius': '3px', 'font-size': '10px', color: '#88c0d0' }}>Speed: <strong style={{ color: '#ebcb8b' }}>{kn().stats.speed}</strong></span></Show>
                      <Show when={kn().stats.mr !== undefined}><span style={{ background: '#232834', border: '1px solid #4c566a', padding: '2px 6px', 'border-radius': '3px', 'font-size': '10px', color: '#88c0d0' }}>MR: <strong style={{ color: '#ebcb8b' }}>{kn().stats.mr}</strong></span></Show>
                    </div>
                  </Show>
                </Show>

                {/* 💡 おすすめワンタップ操作表示 */}
                <Show when={kn().actionLabel}>
                  <p style={{ margin: 0, color: '#a3be8c', 'font-weight': 'bold' }}>
                    💡 <strong>{isEn() ? 'Recommended Action:' : 'おすすめ操作:'}</strong> {safeText(kn().actionLabel)}
                  </p>
                </Show>

                {/* 攻撃方法 ＆ 耐性 */}
                <Show when={formatAttacks(kn().attacks)}>
                  <p style={{ margin: 0, color: '#d8dee9' }}>
                    🗡️ <strong>{isEn() ? 'Attacks:' : '攻撃パターン:'}</strong> {formatAttacks(kn().attacks)}
                  </p>
                </Show>
                <Show when={formatResistances(kn().resistances)}>
                  <p style={{ margin: 0, color: '#d8dee9' }}>
                    🛡️ <strong>{isEn() ? 'Resistances:' : '固有耐性:'}</strong> {formatResistances(kn().resistances)}
                  </p>
                </Show>

                {/* ⚖️ BUC効果 (アイテム) */}
                <Show when={kn().bucEffects}>
                  <div style={{ background: '#232834', 'border-left': '3px solid #60a5fa', padding: '6px 10px', 'border-radius': '0 4px 4px 0', 'margin-top': '4px' }}>
                    <div style={{ 'font-weight': 'bold', color: '#60a5fa', 'font-size': '10px' }}>⚖️ {isEn() ? 'BUC Effects:' : 'BUC効果:'}</div>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0, 'font-size': '10px' }}>
                      <Show when={kn().bucEffects.blessed}><li style={{ color: '#2ecc71' }}><strong>{isEn() ? 'Blessed:' : '祝福:'}</strong> {kn().bucEffects.blessed}</li></Show>
                      <Show when={kn().bucEffects.uncursed}><li style={{ color: '#cbd5e1' }}><strong>{isEn() ? 'Uncursed:' : '通常:'}</strong> {kn().bucEffects.uncursed}</li></Show>
                      <Show when={kn().bucEffects.cursed}><li style={{ color: '#e74c3c' }}><strong>{isEn() ? 'Cursed:' : '呪い:'}</strong> {kn().bucEffects.cursed}</li></Show>
                    </ul>
                  </div>
                </Show>

                {/* 効果解説 ＆ フレーバーテキスト */}
                <Show when={kn().effectSummary}>
                  <p style={{ margin: 0 }}>💡 {safeText(kn().effectSummary)}</p>
                </Show>
                <Show when={kn().description || kn().flavorNote}>
                  <p style={{ margin: 0, opacity: 0.9 }}>📖 {safeText(kn().description || kn().flavorNote)}</p>
                </Show>

                {/* 🔍 未識別識別Tips */}
                <Show when={kn().unidentifiedTips && kn().unidentifiedTips.length > 0}>
                  <div style={{ background: '#232834', 'border-left': '3px solid #a78bfa', padding: '6px 10px', 'border-radius': '0 4px 4px 0', 'margin-top': '4px' }}>
                    <div style={{ 'font-weight': 'bold', color: '#a78bfa', 'font-size': '10px' }}>🔍 {isEn() ? 'Identification Tips:' : '識別Tips:'}</div>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0, 'font-size': '10px', color: '#e5e9f0' }}>
                      <For each={kn().unidentifiedTips}>
                        {(tip: string) => <li>{tip}</li>}
                      </For>
                    </ul>
                  </div>
                </Show>

                <Show when={adviceList().length > 0}>
                  <div style={{ background: '#232834', 'border-left': '3px solid #ebcb8b', padding: '6px 10px', 'border-radius': '0 4px 4px 0', 'margin-top': '4px' }}>
                    <div style={{ 'font-weight': 'bold', color: '#ebcb8b', 'font-size': '10px' }}>🎯 {isEn() ? 'Guide & Advice:' : 'ガイド ＆ 活用アドバイス:'}</div>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0, 'font-size': '10px', color: '#e5e9f0' }}>
                      <For each={adviceList()}>
                        {(adv: string) => <li>{adv}</li>}
                      </For>
                    </ul>
                  </div>
                </Show>

                <Show when={activeCoord()}>
                  {(coord) => (
                    <p style={{ 'font-size': '10px', color: '#d8dee9', opacity: 0.8, margin: 0 }}>
                      📍 {isEn() ? 'Cell Coordinates:' : 'マップセル座標:'} ({coord().x}, {coord().y})
                    </p>
                  )}
                </Show>
              </div>
            </div>
          );
        })()}
      </Show>
    </div>
  );
};
