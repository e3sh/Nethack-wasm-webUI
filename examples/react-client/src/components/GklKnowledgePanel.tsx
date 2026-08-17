import React, { useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';

export const GklKnowledgePanel: React.FC = () => {
  const gklSituation = useGameStore((state) => state.gklSituation);
  const hoveredTileKnowledge = useGameStore((state) => state.hoveredTileKnowledge);
  const { executeAction, executeSequence, getGlyphStyle, extractDirectionCode, getZoomAreaTiles, syncInventorySilent } = useNetHackDriver();

  const [selectedDir, setSelectedDir] = useState('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<any | null>(null);
  const [selectedAreaTile, setSelectedAreaTile] = useState<any | null>(null);
  const [hoveredAreaTile, setHoveredAreaTile] = useState<any | null>(null);

  const dpadButtons = [
    { id: 'NW', label: '北西', icon: '↖' },
    { id: 'N', label: '北', icon: '↑' },
    { id: 'NE', label: '北東', icon: '↗' },
    { id: 'W', label: '西', icon: '←' },
    { id: 'SELF', label: '足元', icon: '・' },
    { id: 'E', label: '東', icon: '→' },
    { id: 'SW', label: '南西', icon: '↙' },
    { id: 'S', label: '南', icon: '↓' },
    { id: 'SE', label: '南東', icon: '↘' },
  ];

  const zoomTiles = getZoomAreaTiles(3); // 7x7

  const safeText = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string' || typeof val === 'number') return String(val);
    if (typeof val === 'object') {
      return val.code || val.labelJa || val.label || val.name || val.key || '';
    }
    return String(val);
  };

  const allActions = gklSituation?.actions || gklSituation?.recommendedActions || [];

  const filteredActions = selectedDir === 'ALL'
    ? allActions
    : allActions.filter((act: any) => extractDirectionCode(act) === selectedDir);

  const inventoryItems = gklSituation?.inventory?.items || [];

  const activeKnowledge = (hoveredItem && hoveredItem.knowledge)
    ? hoveredItem.knowledge
    : (hoveredAreaTile && hoveredAreaTile.knowledge)
      ? hoveredAreaTile.knowledge
      : (selectedAreaTile && selectedAreaTile.knowledge)
        ? selectedAreaTile.knowledge
        : (hoveredTileKnowledge && hoveredTileKnowledge.knowledge)
          ? hoveredTileKnowledge.knowledge
          : null;

  const activeCoord = (hoveredAreaTile && hoveredAreaTile.x !== undefined && hoveredAreaTile.x >= 0)
    ? { x: hoveredAreaTile.x, y: hoveredAreaTile.y }
    : (selectedAreaTile && selectedAreaTile.x !== undefined && selectedAreaTile.x >= 0)
      ? { x: selectedAreaTile.x, y: selectedAreaTile.y }
      : (hoveredTileKnowledge && hoveredTileKnowledge.x !== undefined)
        ? { x: hoveredTileKnowledge.x, y: hoveredTileKnowledge.y }
        : null;

  const activeTileInfo = (() => {
    const tile = hoveredAreaTile || selectedAreaTile;
    if (!tile || tile.x < 0) return '🔍 マスにホバー/タップで解説';
    return `📍 (${tile.x}, ${tile.y}): ${tile.nameJa}`;
  })();

  const currentFilterLabel = (() => {
    if (selectedDir === 'ALL') return '全方向';
    const found = dpadButtons.find(b => b.id === selectedDir);
    return found ? `${found.label} (${found.icon})` : selectedDir;
  })();

  const getActionCountForDir = (dirId: string): number => {
    return allActions.filter((act: any) => extractDirectionCode(act) === dirId).length;
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

  const handleExecuteAction = (act: any) => {
    if (act.risk === 'danger' || act.isDanger) {
      const label = safeText(act.labelJa || act.label || '操作');
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

  return (
    <div className="gkl-panel" style={{ background: '#181b24', border: '1px solid #3b4252', borderRadius: '6px', padding: '12px 16px', color: '#e5e9f0', fontFamily: 'system-ui, sans-serif', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* 1. ヘッダー ＆ ステータス */}
      <div className="gkl-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2e3440', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="gkl-badge" style={{ background: 'linear-gradient(135deg, #00e676, #00b0ff)', color: '#090d16', fontWeight: 'bold', fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}>
            🧠 GKL 状況推論 ＆ ナレッジアシスト
          </span>
          <button onClick={handleSyncInventory} disabled={isSyncing} style={{ background: '#3b4252', color: '#88c0d0', border: '1px solid #4c566a', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
            {isSyncing ? '...同期中' : '🔄 インベントリ同期'}
          </button>
        </div>
      </div>

      {/* 2. 所持品インベントリ（アイコン即時実行 ＋ フローティング解説ポップアップ） */}
      {inventoryItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ebcb8b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🎒 所持品ナレッジ・ガイド ({inventoryItems.length}個)</span>
            <span style={{ fontSize: '10px', color: '#88c0d0', fontWeight: 'normal' }}>※ アイコンタップで即時使用・装備</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {inventoryItems.map((item: any) => {
              const styleObj = item.glyphId !== undefined && item.glyphId >= 0
                ? getGlyphStyle(item.glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 24 })
                : null;
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
                    ...equipStyle,
                  }}
                  onClick={(e) => { e.stopPropagation(); handleOneTapItem(item); }}
                  onMouseEnter={() => setHoveredItem(item)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 'bold', color: '#88c0d0', fontFamily: 'monospace', fontSize: '12px' }}>[{item.letter}]</span>
                    {styleObj && <div style={{ width: '24px', height: '24px', borderRadius: '3px', flexShrink: 0, ...styleObj }} />}
                    {item.isWielded && <span style={{ fontSize: '9px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '3px', color: '#1a1a2e', background: '#e9c46a' }} title="メイン武器">手</span>}
                    {item.isOffhand && <span style={{ fontSize: '9px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '3px', color: '#1a1a2e', background: '#4ea8de' }} title="副武器">副</span>}
                    {item.isQuivered && <span style={{ fontSize: '9px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '3px', color: '#fff', background: '#2a9d8f' }} title="矢筒">筒</span>}
                    {item.isWorn && <span style={{ fontSize: '9px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '3px', color: '#fff', background: '#9d4edd' }} title="着用中">着</span>}
                  </div>

                  {/* 💡 フローティング解説ポップアップ */}
                  {isHovered && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: '6px',
                      background: '#2e3440',
                      border: '1px solid #88c0d0',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      zIndex: 100,
                      width: 'max-content',
                      maxWidth: '260px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      pointerEvents: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#ebcb8b', fontSize: '11px' }}>
                        {safeText(item.knowledge?.nameJa || item.name || item.rawText)}
                      </div>
                      {(item.defaultActionLabelJa || item.knowledge?.actionLabelJa) && (
                        <div style={{ fontSize: '10px', color: '#a3be8c', fontWeight: 'bold' }}>
                          💡 ワンタップ: {safeText(item.defaultActionLabelJa || item.knowledge?.actionLabelJa)} [{item.letter}]
                        </div>
                      )}
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

      {/* 3. 🧠 🎯 方向フィルター ＆ 🔍 7x7 高精細ズームカメラ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#ebcb8b' }}>
            🎯 アクションフィルター ＆ 🔍 7x7 ダンジョンズームカメラ
          </span>
          <span style={{ fontSize: '11px', color: '#88c0d0' }}>表示: {currentFilterLabel}</span>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* 左側: 🎯 D-Pad 8方向操作フィルター */}
          <div style={{ minWidth: '170px', background: '#232834', border: '1px solid #2e3440', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#88c0d0', borderBottom: '1px solid #2e3440', paddingBottom: '4px' }}>
              🎯 方向フィルター
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
                      borderRadius: '4px',
                      height: '36px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                      padding: '2px',
                      fontWeight: isActive ? 'bold' : 'normal',
                    }}
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
                background: selectedDir === 'ALL' ? '#88c0d0' : '#2e3440',
                color: selectedDir === 'ALL' ? '#2e3440' : '#d8dee9',
                border: '1px solid #4c566a',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: selectedDir === 'ALL' ? 'bold' : 'normal',
                cursor: 'pointer',
                marginTop: '4px',
              }}
            >
              全表示 (ALL)
            </button>
          </div>

          {/* 右側: 🔍 7x7 洗練ズームミニマップビューア */}
          <div style={{ background: '#232834', border: '1px solid #2e3440', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#88c0d0', borderBottom: '1px solid #2e3440', paddingBottom: '4px', width: '100%' }}>
              🔍 7x7 ダンジョンズームカメラ
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 24px)',
              gridTemplateRows: 'repeat(7, 24px)',
              gap: '2px',
              background: '#141720',
              padding: '4px',
              borderRadius: '4px',
              border: '1px solid #3b4252'
            }}>
              {zoomTiles.map((tile: any, idx: number) => {
                const spriteStyle = tile.glyphId >= 0
                  ? getGlyphStyle(tile.glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 22 })
                  : null;
                const isSelected = selectedAreaTile?.x === tile.x && selectedAreaTile?.y === tile.y;

                return (
                  <div
                    key={idx}
                    style={{
                      width: '24px',
                      height: '24px',
                      background: tile.isPlayer ? '#3b3626' : isSelected ? '#2e3b38' : '#1e222d',
                      border: `1px solid ${tile.isPlayer ? '#ebcb8b' : isSelected ? '#a3be8c' : 'transparent'}`,
                      boxShadow: tile.isPlayer ? '0 0 8px #ebcb8b' : 'none',
                      borderRadius: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.1s ease-in-out',
                    }}
                    onClick={() => handleSelectZoomTile(tile)}
                    onMouseEnter={() => setHoveredAreaTile(tile)}
                    onMouseLeave={() => setHoveredAreaTile(null)}
                    title={`${tile.nameJa} (${tile.x}, ${tile.y})`}
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
              const labelText = safeText(act.labelJa || act.label || act.actionLabelJa);
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
            {selectedDir === 'ALL' ? '待機中 (周りに特殊対象なし / 移動可能)' : `${currentFilterLabel} 方向に推奨アクションはありません`}
          </div>
        )}
      </div>

      {/* 4. 💡 構造化ナレッジカード */}
      {activeKnowledge && (
        <div style={{ background: '#2e3440', border: '1px solid #88c0d0', borderRadius: '4px', padding: '10px 14px', marginTop: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', color: '#a3be8c' }}>
            <span>
              {safeText(activeKnowledge.nameJa)}
              {(activeKnowledge.nameEn || activeKnowledge.name) && (
                <span style={{ fontSize: '11px', opacity: 0.8, marginLeft: '4px' }}>
                  ({safeText(activeKnowledge.nameEn || activeKnowledge.name)})
                </span>
              )}
            </span>
            <span style={{ fontSize: '10px', color: '#88c0d0' }}>{safeText(activeKnowledge.category || activeKnowledge.type || 'Knowledge')}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#e5e9f0', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {activeKnowledge.effectSummary && <p style={{ margin: 0 }}>💡 {safeText(activeKnowledge.effectSummary)}</p>}
            {activeKnowledge.description && <p style={{ margin: 0 }}>📖 {safeText(activeKnowledge.description)}</p>}
            {activeCoord && (
              <p style={{ fontSize: '10px', color: '#d8dee9', opacity: 0.8, margin: 0 }}>
                📍 マップセル座標: ({activeCoord.x}, {activeCoord.y})
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
