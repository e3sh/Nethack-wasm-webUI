import React, { useState, useMemo } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver, ATTRIBUTE_DEFINITIONS } from '../hooks/useNetHackDriver';
import { getAdaptiveItemSpecs } from '../../../../src/core/knowledge/ItemSpecPresenter.js';

export const GklKnowledgePanel: React.FC = () => {
  const gklSituation = useGameStore((state) => state.gklSituation);
  const hoveredTileKnowledge = useGameStore((state) => state.hoveredTileKnowledge);

  const {
    executeAction,
    getGlyphStyle,
    extractDirectionCode,
    getZoomAreaTiles,
    syncInventorySilent,
    syncSkillsSilent,
    syncSpellsSilent,
    executeSequence,
    moveToCell,
    castSpell,
    enhanceSkill,
    travelTo,
    openItemActionMenu,
    getAdaptiveSpecs,
  } = useNetHackDriver();

  const currentLanguage = useGameStore((state) => state.currentLanguage);
  const isEn = currentLanguage === 'en';

  const [selectedDir, setSelectedDir] = useState<string>('ALL');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [hoveredItem, setHoveredItem] = useState<any | null>(null);
  const [selectedAreaTile, setSelectedAreaTile] = useState<any | null>(null);
  const [hoveredAreaTile, setHoveredAreaTile] = useState<any | null>(null);

  // 長押しタイマー管理
  const pressTimerRef = React.useRef<Record<string, any>>({});
  const isLongPressRef = React.useRef<Record<string, boolean>>({});

  const handleItemPointerDown = (item: any, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isLongPressRef.current[item.letter] = false;
    pressTimerRef.current[item.letter] = setTimeout(() => {
      isLongPressRef.current[item.letter] = true;
      if (navigator.vibrate) navigator.vibrate(25);
      openItemActionMenu(item.letter);
    }, 400);
  };

  const handleItemPointerUp = (item: any, e: React.PointerEvent) => {
    if (pressTimerRef.current[item.letter]) {
      clearTimeout(pressTimerRef.current[item.letter]);
      delete pressTimerRef.current[item.letter];
    }
    if (!isLongPressRef.current[item.letter] && e.button === 0) {
      handleOneTapItem(item);
    }
  };

  const handleItemPointerCancel = (item: any) => {
    if (pressTimerRef.current[item.letter]) {
      clearTimeout(pressTimerRef.current[item.letter]);
      delete pressTimerRef.current[item.letter];
    }
  };

  const handleItemContextMenu = (item: any, e: React.MouseEvent) => {
    e.preventDefault();
    handleItemPointerCancel(item);
    openItemActionMenu(item.letter);
  };

  const dpadButtons = useMemo(() => [
    { id: 'NW', label: isEn ? 'NW' : '北西', icon: '↖' },
    { id: 'N', label: isEn ? 'N' : '北', icon: '↑' },
    { id: 'NE', label: isEn ? 'NE' : '北東', icon: '↗' },
    { id: 'W', label: isEn ? 'W' : '西', icon: '←' },
    { id: 'SELF', label: isEn ? 'Self' : '足元', icon: '・' },
    { id: 'E', label: isEn ? 'E' : '東', icon: '→' },
    { id: 'SW', label: isEn ? 'SW' : '南西', icon: '↙' },
    { id: 'S', label: isEn ? 'S' : '南', icon: '↓' },
    { id: 'SE', label: isEn ? 'SE' : '南東', icon: '↘' },
  ], [isEn]);

  const safeText = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string' || typeof val === 'number') return String(val);
    if (typeof val === 'object') {
      return val.code || val.label || val.name || val.key || '';
    }
    return String(val);
  };

  const zoomTiles = useMemo(() => getZoomAreaTiles(3), [getZoomAreaTiles, gklSituation, hoveredTileKnowledge]); // 7x7

  const allActions = useMemo(() => {
    return gklSituation?.actions || gklSituation?.recommendedActions || [];
  }, [gklSituation]);

  const filteredActions = useMemo(() => {
    if (selectedDir === 'ALL') return allActions;
    return allActions.filter((act: any) => extractDirectionCode(act) === selectedDir);
  }, [allActions, selectedDir, extractDirectionCode]);

  const inventoryItems = useMemo(() => {
    return gklSituation?.inventory?.items || [];
  }, [gklSituation]);

  const tacticalAdvices = useMemo(() => {
    return gklSituation?.advices || [];
  }, [gklSituation]);

  const hasCriticalAdvice = useMemo(() => {
    return tacticalAdvices.some((adv: any) => adv.isCritical || adv.severity === 'CRITICAL' || adv.level === 'CRITICAL' || adv.dangerLevel === 'LETHAL');
  }, [tacticalAdvices]);

  const activeKnowledge = useMemo(() => {
    if (hoveredItem?.knowledge) return hoveredItem.knowledge;
    if (hoveredAreaTile?.knowledge) return hoveredAreaTile.knowledge;
    if (selectedAreaTile?.knowledge) return selectedAreaTile.knowledge;
    if (hoveredTileKnowledge?.knowledge) return hoveredTileKnowledge.knowledge;
    return null;
  }, [hoveredItem, hoveredAreaTile, selectedAreaTile, hoveredTileKnowledge]);

  const activeCoord = useMemo(() => {
    if (hoveredAreaTile?.x !== undefined && hoveredAreaTile?.x >= 0) return { x: hoveredAreaTile.x, y: hoveredAreaTile.y };
    if (selectedAreaTile?.x !== undefined && selectedAreaTile?.x >= 0) return { x: selectedAreaTile.x, y: selectedAreaTile.y };
    if (hoveredTileKnowledge?.x !== undefined) return { x: hoveredTileKnowledge.x, y: hoveredTileKnowledge.y };
    return null;
  }, [hoveredAreaTile, selectedAreaTile, hoveredTileKnowledge]);

  const activeTileInfo = useMemo(() => {
    const tile = hoveredAreaTile || selectedAreaTile;
    if (!tile || tile.x < 0) return isEn ? '🔍 Hover/Tap tile to inspect' : '🔍 マスにホバー/タップで解説';
    return `📍 (${tile.x}, ${tile.y}): ${tile.name || tile.nameJa}`;
  }, [hoveredAreaTile, selectedAreaTile, isEn]);

  const currentFilterLabel = useMemo(() => {
    if (selectedDir === 'ALL') return isEn ? 'All' : '全方向';
    const found = dpadButtons.find(b => b.id === selectedDir);
    return found ? `${found.label} (${found.icon})` : selectedDir;
  }, [selectedDir, dpadButtons, isEn]);

  const getActionCountForDir = (dirId: string): number => {
    return allActions.filter((act: any) => extractDirectionCode(act) === dirId).length;
  };

  const getItemCategoryLabel = (cat: string | undefined): string => {
    if (!cat) return isEn ? 'Knowledge' : '解説';
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
    const map = isEn ? enMap : jaMap;
    return map[cat.toUpperCase()] || cat;
  };

  const getDangerBadgeInfo = (level: string | undefined) => {
    if (!level) return null;
    const l = String(level).toUpperCase();
    if (l === 'LETHAL' || l === 'EXTREME' || l === 'VERY_HIGH') {
      return { label: isEn ? `☠️ Lethal (${l})` : `☠️ 致命的 (${l})`, color: '#ff0055', bg: 'rgba(255, 0, 85, 0.2)', border: '#ff0055' };
    }
    if (l === 'HIGH') {
      return { label: isEn ? `⚠️ Danger (HIGH)` : `⚠️ 危険 (HIGH)`, color: '#ff9f1c', bg: 'rgba(255, 159, 28, 0.2)', border: '#ff9f1c' };
    }
    if (l === 'MEDIUM') {
      return { label: isEn ? `⚡ Warning (MEDIUM)` : `⚡ 注意 (MEDIUM)`, color: '#ffe600', bg: 'rgba(255, 230, 0, 0.2)', border: '#ffe600' };
    }
    return { label: isEn ? `🟢 Safe (${l})` : `🟢 低脅威 (${l})`, color: '#2ec4b6', bg: 'rgba(46, 196, 182, 0.2)', border: '#2ec4b6' };
  };

  const formatResistances = (res: any): string => {
    if (!res || !Array.isArray(res) || res.length === 0) return '';
    if (isEn) return res.join(', ');
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
      const type = a.type || a.name || (isEn ? 'Attack' : '攻撃');
      const dmg = a.damage ? `(${a.damage})` : '';
      const eff = a.effect ? ` [${a.effect}]` : '';
      return `${type}${dmg}${eff}`;
    }).join(', ');
  };

  const getEquipBorderStyle = (item: any): React.CSSProperties => {
    if (item.isWielded) return { border: '2px solid #e9c46a', boxShadow: '0 0 6px rgba(233, 196, 106, 0.5)' };
    if (item.isOffhand) return { border: '2px solid #4ea8de', boxShadow: '0 0 6px rgba(78, 168, 222, 0.5)' };
    if (item.isQuivered) return { border: '2px solid #2a9d8f', boxShadow: '0 0 6px rgba(42, 157, 143, 0.5)' };
    if (item.isWorn) return { border: '2px solid #9d4edd', boxShadow: '0 0 6px rgba(157, 78, 221, 0.5)' };
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
    await syncInventorySilent();
    setIsSyncing(false);
  };

  const activeAttributes = useMemo(() => {
    const res = gklSituation?.attributes?.effectiveResistances || {};
    return ATTRIBUTE_DEFINITIONS.filter((item: any) => Boolean(res[item.key]));
  }, [gklSituation]);

  const isSkillsSynced = useMemo(() => Boolean(gklSituation?.skills?.isSynced), [gklSituation]);
  const activeSkills = useMemo(() => gklSituation?.skills?.activeItems || [], [gklSituation]);
  const activeSpells = useMemo(() => gklSituation?.spells?.items || [], [gklSituation]);

  const handleSyncSkills = async () => {
    await syncSkillsSilent();
  };

  const handleSyncSpells = async () => {
    await syncSpellsSilent();
  };

  const handleCastSpell = (letter: string) => {
    castSpell(letter);
  };

  const handleEnhanceSkill = (skill?: any) => {
    enhanceSkill(skill);
  };

  const handleExecuteAction = (act: any) => {
    if (act.risk === 'danger' || act.isDanger) {
      const label = safeText(act.label || '操作');
      if (!window.confirm(`【⚠️ 危険な行動】\n"${label}" を実行しますか？`)) return;
    }
    setSelectedDir('ALL');
    executeAction(act);
  };

  const handleOneTapItem = (item: any) => {
    const seq = (item.defaultSequence && Array.isArray(item.defaultSequence) && item.defaultSequence.length > 0)
      ? item.defaultSequence
      : [item.letter];
    executeSequence(seq);
  };

  const getActionClass = (act: any) => {
    if (act.risk === 'danger' || act.category === 'ATTACK' || act.isDanger) return 'btn-danger';
    if (act.category === 'UNCOMMITTED' || act.category === 'ITEM') return 'btn-info';
    return 'btn-primary';
  };

  const dangerBadge = getDangerBadgeInfo(activeKnowledge?.dangerLevel);
  const adviceList = activeKnowledge?.tacticalAdvice || activeKnowledge?.usageAdvice || [];

  return (
    <div style={{ background: '#181b24', border: '1px solid #3b4252', borderRadius: '6px', padding: '12px 16px', color: '#e5e9f0', fontFamily: 'system-ui, sans-serif', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* 1. ヘッダー ＆ 同期コントロール ＆ 🚨 危機点滅バッジ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2e3440', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ background: 'linear-gradient(135deg, #00e676, #00b0ff)', color: '#090d16', fontWeight: 'bold', fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}>
            {isEn ? '🧠 GKL Situation Reasoning & Knowledge Assist' : '🧠 GKL 状況推論 ＆ ナレッジアシスト'}
          </span>
          {hasCriticalAdvice && (
            <span style={{ background: '#e74c3c', color: '#ffffff', fontWeight: 'bold', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', animation: 'pulse 1s infinite' }}>
              🚨 {isEn ? 'CRITICAL CRISIS' : '危機警告'}
            </span>
          )}
          <button onClick={handleSyncInventory} disabled={isSyncing} style={{ background: '#3b4252', color: '#88c0d0', border: '1px solid #4c566a', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
            {isSyncing ? (isEn ? '...Syncing' : '...同期中') : (isEn ? '🔄 Sync Inventory' : '🔄 インベントリ同期')}
          </button>
          <button onClick={handleSyncSkills} style={{ background: '#3b4252', color: '#88c0d0', border: '1px solid #4c566a', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
            {isEn ? '🥋 Sync Skills' : '🥋 スキル同期'}
          </button>
          <button onClick={handleSyncSpells} style={{ background: '#3b4252', color: '#88c0d0', border: '1px solid #4c566a', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
            {isEn ? '📖 Sync Spells' : '📖 魔法同期'}
          </button>
        </div>
      </div>

      {/* 🛡️ TacticalAdvisor 戦術アドバイス一覧 */}
      {tacticalAdvices.length > 0 && (
        <div style={{ background: '#1c212d', borderLeft: '4px solid #00e676', borderRadius: '4px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#00e676', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🛡️ {isEn ? 'Tactical Advisor Recommendations' : '戦術アドバイザー推奨'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#e5e9f0' }}>
            {tacticalAdvices.map((adv: any, idx: number) => {
              const advText = typeof adv === 'string' ? adv : (adv.text || adv.message || adv.advice || adv.label || '');
              const isCrit = adv.isCritical || adv.severity === 'CRITICAL';
              return (
                <div key={idx} style={{ color: isCrit ? '#ff6b6b' : '#e5e9f0', fontWeight: isCrit ? 'bold' : 'normal' }}>
                  {isCrit ? '⚠️ ' : '💡 '}{advText}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 1.5 🥋 スキル・📖 魔法・🛡️ 属性耐性 総合ステータスバー */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#232834', border: '1px solid #3b4252', borderRadius: '6px', padding: '8px 12px' }}>
        {/* 🛡️ 属性・耐性 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{isEn ? '🛡️ Resistances:' : '🛡️ 属性耐性:'}</strong>
          {activeAttributes.length > 0 ? (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {activeAttributes.map((attr: any) => (
                <span key={attr.key} style={{ background: 'rgba(14, 165, 233, 0.15)', border: '1px solid #38bdf8', color: '#7dd3fc', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }} title={`${attr.label} / ${attr.en} (有効)`}>
                  {isEn ? (attr.en || attr.label) : attr.label}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: '11px', color: '#64748b' }}>{isEn ? 'None' : 'なし'}</span>
          )}
        </div>

        {/* 🥋 スキル */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{isEn ? '🥋 Skills:' : '🥋 スキル:'}</strong>
          {activeSkills.length > 0 ? (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {activeSkills.map((skill: any) => {
                const isEnhanceable = skill.canEnhance;
                return (
                  <span
                    key={skill.name}
                    style={{
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: isEnhanceable ? '1px solid #f59e0b' : '1px solid #3b82f6',
                      color: '#93c5fd',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title={skill.rawText || skill.name}
                    onClick={() => handleEnhanceSkill(skill)}
                  >
                    {isEnhanceable && <span style={{ color: '#f59e0b' }}>⭐</span>}
                    <strong>{skill.name}</strong> [{(isEn ? (skill.rank?.en || skill.rank?.label) : (skill.rank?.label || skill.rank?.en)) || (isEn ? 'Basic' : '入門')}]
                  </span>
                );
              })}
            </div>
          ) : (
            <span style={{ fontSize: '11px', color: '#64748b' }}>{isSkillsSynced ? (isEn ? 'None (Unskilled)' : 'なし (未熟)') : (isEn ? 'Not Synced' : '未同期')}</span>
          )}
        </div>

        {/* 📖 習得魔法 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{isEn ? '📖 Spells:' : '📖 習得魔法:'}</strong>
          {activeSpells.length > 0 ? (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {activeSpells.map((sp: any) => (
                <button
                  key={sp.letter}
                  style={{
                    background: 'rgba(139, 92, 246, 0.15)',
                    border: '1px solid #a78bfa',
                    color: '#ddd6fe',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                  title={`Key: ${sp.letter}, Lv.${sp.level} ${sp.category} (Fail: ${sp.failRate})`}
                  onClick={() => handleCastSpell(sp.letter)}
                >
                  ✨ [{sp.letter}] {sp.name} <small style={{ color: '#94a3b8' }}>(Lv.{sp.level} {sp.failRate})</small>
                </button>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: '11px', color: '#64748b' }}>{isEn ? 'None' : 'なし'}</span>
          )}
        </div>
      </div>

      {/* 2. 所持品インベントリ */}
      {inventoryItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ebcb8b', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span>{isEn ? `🎒 Inventory Guide (${inventoryItems.length} items)` : `🎒 所持品ナレッジ・ガイド (${inventoryItems.length}個)`}</span>
            <span style={{ fontSize: '10px', color: '#88c0d0', fontWeight: 'normal' }}>
              {isEn ? '※ Tap: One-tap use / Long-press or Right-click: Action Menu' : '※ タップ: 即時使用 / 長押し・右クリック: アクションメニュー'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {inventoryItems.map((item: any) => {
              const spriteStyle = getGlyphStyle(item.glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 22 });
              const equipStyle = getEquipBorderStyle(item);
              const isHovered = hoveredItem?.letter === item.letter;

              return (
                <div
                  key={item.letter}
                  style={{
                    background: isHovered ? '#2e3440' : '#232834',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.15s ease-in-out',
                    userSelect: 'none',
                    ...equipStyle,
                  }}
                  onPointerDown={(e) => handleItemPointerDown(item, e)}
                  onPointerUp={(e) => handleItemPointerUp(item, e)}
                  onPointerLeave={() => { handleItemPointerCancel(item); setHoveredItem(null); }}
                  onPointerCancel={() => handleItemPointerCancel(item)}
                  onContextMenu={(e) => handleItemContextMenu(item, e)}
                  onMouseEnter={() => setHoveredItem(item)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 'bold', color: '#88c0d0', fontFamily: 'monospace', fontSize: '12px' }}>[{item.letter}]</span>
                    {item.glyphId !== undefined && item.glyphId >= 0 && (
                      <div style={{ width: '24px', height: '24px', borderRadius: '3px', flexShrink: 0, ...spriteStyle }} />
                    )}
                    {item.isWielded && <span style={{ fontSize: '9px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '3px', color: '#1a1a2e', background: '#e9c46a' }} title={isEn ? 'Main weapon' : 'メイン武器'}>{isEn ? 'Main' : '手'}</span>}
                    {item.isOffhand && <span style={{ fontSize: '9px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '3px', color: '#1a1a2e', background: '#4ea8de' }} title={isEn ? 'Off-hand weapon' : '副武器'}>{isEn ? 'Off' : '副'}</span>}
                    {item.isQuivered && <span style={{ fontSize: '9px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '3px', color: '#fff', background: '#2a9d8f' }} title={isEn ? 'Quiver' : '矢筒'}>{isEn ? 'Quiv' : '筒'}</span>}
                    {item.isWorn && <span style={{ fontSize: '9px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '3px', color: '#fff', background: '#9d4edd' }} title={isEn ? 'Worn' : '着用中'}>{isEn ? 'Worn' : '着'}</span>}
                    {(item.skillBadge?.isProficient || item.isRecommendedWeapon) && (
                      <span style={{ fontSize: '9px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '3px', color: '#000', background: '#22c55e' }} title={`Proficient (${item.skillBadge?.label || '+'})`}>+</span>
                    )}
                  </div>

                  {/* 💡 フローティングポップアップ */}
                  {isHovered && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '6px',
                      background: '#2e3440', border: '1px solid #88c0d0', borderRadius: '6px', padding: '8px 12px', zIndex: 100,
                      width: 'max-content', maxWidth: '260px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', pointerEvents: 'none',
                      display: 'flex', flexDirection: 'column', gap: '4px',
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#ebcb8b', fontSize: '11px' }}>
                        {safeText(item.knowledge?.name || item.name || item.rawText)}
                      </div>
                      {(item.knowledge?.actionLabel || item.defaultActionLabel || item.defaultActionLabelJa) && (
                        <div style={{ fontSize: '10px', color: '#a3be8c', fontWeight: 'bold' }}>
                          💡 {isEn ? 'One-Tap:' : 'ワンタップ:'} {safeText(item.knowledge?.actionLabel || item.defaultActionLabel || item.defaultActionLabelJa)} [{item.letter}]
                        </div>
                      )}
                      <div style={{ fontSize: '9px', color: '#88c0d0', opacity: 0.8 }}>
                        🖱️ {isEn ? 'Long-press / Right-click: Menu' : '長押し / 右クリック: メニュー'}
                      </div>
                      {(item.knowledge?.effectSummary || item.knowledge?.description) && (
                        <div style={{ fontSize: '10px', color: '#e5e9f0', opacity: 0.9 }}>
                          {safeText(item.knowledge?.effectSummary || item.knowledge?.description)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. アクションフィルター ＆ 🔍 7x7 ズームカメラ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#ebcb8b' }}>
            {isEn ? '🎯 Action Filters & 🔍 7x7 Zoom Camera' : '🎯 アクションフィルター ＆ 🔍 7x7 ダンジョンズームカメラ'}
          </span>
          <span style={{ fontSize: '11px', color: '#88c0d0' }}>{isEn ? 'Filter:' : '表示:'} {currentFilterLabel}</span>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* 左側: 🎯 D-Pad */}
          <div style={{ minWidth: '170px', background: '#232834', border: '1px solid #2e3440', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#88c0d0', borderBottom: '1px solid #2e3440', paddingBottom: '4px' }}>
              {isEn ? '🎯 Direction Filter' : '🎯 方向フィルター'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 46px)', gap: '4px', justifyContent: 'center' }}>
              {dpadButtons.map((dp) => {
                const count = getActionCountForDir(dp.id);
                const isActive = selectedDir === dp.id;
                return (
                  <button
                    key={dp.id}
                    onClick={() => setSelectedDir(dp.id)}
                    style={{
                      background: isActive ? '#88c0d0' : '#2e3440',
                      color: isActive ? '#2e3440' : '#d8dee9',
                      border: `1px solid ${isActive ? '#88c0d0' : count > 0 ? '#ebcb8b' : '#4c566a'}`,
                      borderRadius: '4px', height: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', position: 'relative', padding: '2px', fontWeight: isActive ? 'bold' : 'normal',
                    }}
                    title={dp.label}
                  >
                    <span style={{ fontSize: '11px', lineHeight: 1 }}>{dp.icon}</span>
                    <span style={{ fontSize: '8px', opacity: 0.8 }}>{dp.label}</span>
                    {count > 0 && (
                      <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#bf616a', color: '#fff', fontSize: '9px', borderRadius: '50%', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setSelectedDir('ALL')}
              style={{
                width: '100%', padding: '4px', background: selectedDir === 'ALL' ? '#88c0d0' : '#2e3440',
                color: selectedDir === 'ALL' ? '#2e3440' : '#d8dee9', border: '1px solid #4c566a', borderRadius: '4px',
                fontSize: '10px', cursor: 'pointer', fontWeight: selectedDir === 'ALL' ? 'bold' : 'normal',
              }}
            >
              {isEn ? 'Show All (ALL)' : '全表示 (ALL)'}
            </button>
          </div>

          {/* 右側: 🔍 7x7 ズームカメラ */}
          <div style={{ background: '#232834', border: '1px solid #2e3440', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#88c0d0', borderBottom: '1px solid #2e3440', paddingBottom: '4px', width: '100%' }}>
              {isEn ? '🔍 7x7 Dungeon Zoom Camera' : '🔍 7x7 ダンジョンズームカメラ'}
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 24px)', gridTemplateRows: 'repeat(7, 24px)', gap: '2px',
              background: '#141720', padding: '4px', borderRadius: '4px', border: '1px solid #3b4252'
            }}>
              {zoomTiles.map((tile: any, idx: number) => {
                const isSelected = selectedAreaTile?.x === tile.x && selectedAreaTile?.y === tile.y;
                const spriteStyle = tile.glyphId >= 0 ? getGlyphStyle(tile.glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 22 }) : null;

                return (
                  <div
                    key={`${tile.dx},${tile.dy}-${idx}`}
                    style={{
                      width: '24px', height: '24px',
                      background: tile.isPlayer ? '#3b3626' : isSelected ? '#2e3b38' : '#1e222d',
                      border: `1px solid ${tile.isPlayer ? '#ebcb8b' : isSelected ? '#a3be8c' : 'transparent'}`,
                      boxShadow: tile.isPlayer ? '0 0 8px #ebcb8b' : 'none',
                      borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      transition: 'all 0.1s ease-in-out',
                    }}
                    onClick={() => handleSelectZoomTile(tile)}
                    onMouseEnter={() => setHoveredAreaTile(tile)}
                    onMouseLeave={() => setHoveredAreaTile(null)}
                    title={`${tile.name || tile.nameJa} (${tile.x}, ${tile.y})`}
                  >
                    {spriteStyle ? (
                      <div style={{ width: '22px', height: '22px', borderRadius: '2px', ...spriteStyle }} />
                    ) : (
                      <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#d8dee9' }}>
                        {tile.symbol}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: '9px', color: '#a3be8c', height: '14px', textAlign: 'center', marginTop: '4px' }}>
              {activeTileInfo}
            </div>
          </div>
        </div>

        {/* アクションボタンリスト */}
        {filteredActions.length > 0 ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {filteredActions.map((act: any, idx: number) => {
              const labelText = safeText(act.label);
              const keyText = safeText(act.key || act.verbKey || act.charStr);
              const dirCode = extractDirectionCode(act);
              return (
                <button
                  key={idx}
                  onClick={() => handleExecuteAction(act)}
                  className={`btn ${getActionClass(act)}`}
                  style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title={safeText(act.description || act.label)}
                >
                  {keyText && <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>[{keyText}]</span>}
                  <span>{labelText}</span>
                  {dirCode !== 'NONE' && <span style={{ fontSize: '10px', opacity: 0.8 }}>({dirCode})</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: '#4c566a', padding: '4px 0' }}>
            {selectedDir === 'ALL' ? (isEn ? 'Idle (No special targets around / Can move)' : '待機中 (周りに特殊対象なし / 移動可能)') : (isEn ? `No recommended actions in ${currentFilterLabel}` : `${currentFilterLabel} 方向に推奨アクションはありません`)}
          </div>
        )}
      </div>

      {/* 4. 💡 構造化ナレッジカード */}
      {activeKnowledge && (
        <div style={{ background: '#2e3440', border: '1px solid #88c0d0', borderRadius: '4px', padding: '10px 14px', marginTop: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '13px', color: '#a3be8c' }}>
            <span>
              {safeText(activeKnowledge.name)}
              {activeKnowledge.nameEn && activeKnowledge.nameEn !== activeKnowledge.name && (
                <span style={{ fontSize: '11px', opacity: 0.8, marginLeft: '4px' }}>
                  ({safeText(activeKnowledge.nameEn)})
                </span>
              )}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {dangerBadge && (
                <span style={{ color: dangerBadge.color, background: dangerBadge.bg, border: `1px solid ${dangerBadge.border}`, fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px' }}>
                  {dangerBadge.label}
                </span>
              )}
              <span style={{ fontSize: '10px', color: '#88c0d0' }}>{getItemCategoryLabel(activeKnowledge.category || activeKnowledge.type)}</span>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#e5e9f0', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* モンスター/アイテム ステータスグリッド (アダプティブ表示) */}
            {activeKnowledge.category === 'MONSTER' || activeKnowledge.type === 'MONSTER' ? (
              activeKnowledge.stats && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  {activeKnowledge.stats.hd !== undefined && <span style={{ background: '#232834', border: '1px solid #4c566a', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', color: '#88c0d0' }}>HD: <strong style={{ color: '#ebcb8b' }}>{activeKnowledge.stats.hd}</strong></span>}
                  {activeKnowledge.stats.ac !== undefined && <span style={{ background: '#232834', border: '1px solid #4c566a', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', color: '#88c0d0' }}>AC: <strong style={{ color: '#ebcb8b' }}>{activeKnowledge.stats.ac}</strong></span>}
                  {activeKnowledge.stats.speed !== undefined && <span style={{ background: '#232834', border: '1px solid #4c566a', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', color: '#88c0d0' }}>Speed: <strong style={{ color: '#ebcb8b' }}>{activeKnowledge.stats.speed}</strong></span>}
                  {activeKnowledge.stats.mr !== undefined && <span style={{ background: '#232834', border: '1px solid #4c566a', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', color: '#88c0d0' }}>MR: <strong style={{ color: '#ebcb8b' }}>{activeKnowledge.stats.mr}</strong></span>}
                </div>
              )
            ) : (
              (() => {
                const specs = getAdaptiveItemSpecs(activeKnowledge, { language: isEn ? 'en' : 'ja' });
                if (specs.length === 0) return null;
                return (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    {specs.map((s) => {
                      const isHigh = s.highlight;
                      const borderCol = isHigh ? '#88c0d0' : '#4c566a';
                      const labelCol = isHigh ? '#88c0d0' : '#94a3b8';
                      const valCol = isHigh ? '#ebcb8b' : '#d8dee9';
                      return (
                        <span key={s.id} style={{ background: '#232834', border: `1px solid ${borderCol}`, padding: '2px 6px', borderRadius: '3px', fontSize: '10px', color: labelCol }}>
                          {s.label}: <strong style={{ color: valCol }}>{s.value}</strong>
                          {s.skillBadge && <span style={{ marginLeft: '4px', color: '#22c55e', fontWeight: 'bold' }}>{s.skillBadge.label}</span>}
                        </span>
                      );
                    })}
                  </div>
                );
              })()
            )}

            {/* 💡 おすすめワンタップ操作表示 */}
            {activeKnowledge.actionLabel && (
              <p style={{ margin: 0, color: '#a3be8c', fontWeight: 'bold' }}>
                💡 <strong>{isEn ? 'Recommended Action:' : 'おすすめ操作:'}</strong> {safeText(activeKnowledge.actionLabel)}
              </p>
            )}

            {/* 攻撃方法 ＆ 耐性 */}
            {formatAttacks(activeKnowledge.attacks) && (
              <p style={{ margin: 0, color: '#d8dee9' }}>
                🗡️ <strong>{isEn ? 'Attacks:' : '攻撃パターン:'}</strong> {formatAttacks(activeKnowledge.attacks)}
              </p>
            )}
            {formatResistances(activeKnowledge.resistances) && (
              <p style={{ margin: 0, color: '#d8dee9' }}>
                🛡️ <strong>{isEn ? 'Resistances:' : '固有耐性:'}</strong> {formatResistances(activeKnowledge.resistances)}
              </p>
            )}

            {/* ⚖️ BUC効果 (アイテム) */}
            {activeKnowledge.bucEffects && (
              <div style={{ background: '#232834', borderLeft: '3px solid #60a5fa', padding: '6px 10px', borderRadius: '0 4px 4px 0', marginTop: '4px' }}>
                <div style={{ fontWeight: 'bold', color: '#60a5fa', fontSize: '10px' }}>⚖️ {isEn ? 'BUC Effects:' : 'BUC効果:'}</div>
                <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '10px' }}>
                  {activeKnowledge.bucEffects.blessed && <li style={{ color: '#2ecc71' }}><strong>{isEn ? 'Blessed:' : '祝福:'}</strong> {activeKnowledge.bucEffects.blessed}</li>}
                  {activeKnowledge.bucEffects.uncursed && <li style={{ color: '#cbd5e1' }}><strong>{isEn ? 'Uncursed:' : '通常:'}</strong> {activeKnowledge.bucEffects.uncursed}</li>}
                  {activeKnowledge.bucEffects.cursed && <li style={{ color: '#e74c3c' }}><strong>{isEn ? 'Cursed:' : '呪い:'}</strong> {activeKnowledge.bucEffects.cursed}</li>}
                </ul>
              </div>
            )}

            {/* 効果解説 ＆ フレーバーテキスト */}
            {activeKnowledge.effectSummary && <p style={{ margin: 0 }}>💡 {safeText(activeKnowledge.effectSummary)}</p>}
            {(activeKnowledge.description || activeKnowledge.flavorNote) && (
              <p style={{ margin: 0, opacity: 0.9 }}>📖 {safeText(activeKnowledge.description || activeKnowledge.flavorNote)}</p>
            )}

            {/* 🔍 未識別識別Tips */}
            {activeKnowledge.unidentifiedTips && activeKnowledge.unidentifiedTips.length > 0 && (
              <div style={{ background: '#232834', borderLeft: '3px solid #a78bfa', padding: '6px 10px', borderRadius: '0 4px 4px 0', marginTop: '4px' }}>
                <div style={{ fontWeight: 'bold', color: '#a78bfa', fontSize: '10px' }}>🔍 {isEn ? 'Identification Tips:' : '識別Tips:'}</div>
                <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '10px', color: '#e5e9f0' }}>
                  {activeKnowledge.unidentifiedTips.map((tip: string, idx: number) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* アドバイス */}
            {adviceList.length > 0 && (
              <div style={{ background: '#232834', borderLeft: '3px solid #ebcb8b', padding: '6px 10px', borderRadius: '0 4px 4px 0', marginTop: '4px' }}>
                <div style={{ fontWeight: 'bold', color: '#ebcb8b', fontSize: '10px' }}>🎯 {isEn ? 'Guide & Advice:' : 'ガイド ＆ 活用アドバイス:'}</div>
                <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '10px', color: '#e5e9f0' }}>
                  {adviceList.map((adv: string, idx: number) => (
                    <li key={idx}>{adv}</li>
                  ))}
                </ul>
              </div>
            )}

            {activeCoord && (
              <p style={{ fontSize: '10px', color: '#d8dee9', opacity: 0.8, margin: 0 }}>
                📍 {isEn ? 'Cell Coordinates:' : 'マップセル座標:'} ({activeCoord.x}, {activeCoord.y})
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
