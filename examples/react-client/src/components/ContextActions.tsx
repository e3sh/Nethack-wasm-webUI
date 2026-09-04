import React, { useState, useMemo, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';
import { DirectionPad } from './DirectionPad';

export const ContextActions: React.FC = () => {
  const [selectedDir, setSelectedDir] = useState<string>('ALL');

  const gklSituation = useGameStore((state) => state.gklSituation);
  const currentLanguage = useGameStore((state) => state.currentLanguage);

  const { extractDirectionCode, executeSequence, executeAction } = useNetHackDriver();

  const isEn = currentLanguage === 'en';

  const rawActions = useMemo(() => {
    return gklSituation?.actions || gklSituation?.contextActions || [];
  }, [gklSituation]);

  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const act of rawActions) {
      const dir = extractDirectionCode(act);
      if (dir && dir !== 'NONE') {
        counts[dir] = (counts[dir] || 0) + 1;
      }
    }
    return counts;
  }, [rawActions, extractDirectionCode]);

  const filteredActions = useMemo(() => {
    if (selectedDir === 'ALL') {
      return rawActions;
    }
    return rawActions.filter((act: any) => {
      const dir = extractDirectionCode(act);
      return dir === selectedDir;
    });
  }, [rawActions, selectedDir, extractDirectionCode]);

  const getActionItemClass = (act: any): string => {
    if (act.category === 'SURVIVAL' || act.isEmergency || act.severity === 'CRITICAL') {
      return 'danger';
    }
    if (act.category === 'TACTICAL_COMBAT' || act.type === 'ATTACK') {
      return 'combat';
    }
    return '';
  };

  const getKeys = (act: any): string[] => {
    if (Array.isArray(act.keySequence) && act.keySequence.length > 0) {
      return act.keySequence;
    }
    if (act.key) return [act.key];
    if (act.keys) return Array.isArray(act.keys) ? act.keys : [act.keys];
    return [];
  };

  const handleActionClick = useCallback(async (act: any) => {
    if (act.keySequence && Array.isArray(act.keySequence) && act.keySequence.length > 0) {
      await executeSequence(act.keySequence);
    } else {
      executeAction(act);
    }
  }, [executeSequence, executeAction]);

  return (
    <div className="gkl-card actions-card">
      <div className="gkl-card-header">
        <span>🧠 {isEn ? 'Context Actions' : '推奨アクション (ContextActions)'}</span>
        <span className="gkl-badge">{filteredActions.length}</span>
      </div>

      {/* 🎯 方向フィルターインジケーター (「囲」型 3x3 キーパッド) */}
      <DirectionPad
        value={selectedDir}
        onChange={setSelectedDir}
        actionCounts={actionCounts}
      />

      {/* 推奨アクションリスト */}
      <div className="gkl-action-list">
        {filteredActions.length === 0 ? (
          <div className="gkl-empty-hint">
            {isEn ? 'No contextual actions available' : '周辺環境に応じたアクションが自動表示されます'}
          </div>
        ) : (
          filteredActions.map((act: any, idx: number) => (
            <div
              key={act.id || idx}
              className={`gkl-action-item ${getActionItemClass(act)}`}
              onClick={() => handleActionClick(act)}
            >
              <div className="act-main">
                <span className="act-icon">{act.icon || '⚡'}</span>
                <div className="act-info">
                  <div className="act-label">
                    {isEn ? (act.labelEn || act.label || act.name) : (act.labelJa || act.label || act.name)}
                  </div>
                  {(act.description || act.desc || act.descriptionEn || act.descriptionJa) && (
                    <div className="act-desc">
                      {isEn
                        ? (act.descriptionEn || act.descEn || act.description || act.desc)
                        : (act.descriptionJa || act.descJa || act.description || act.desc)}
                    </div>
                  )}
                </div>
              </div>

              <div className="act-keys">
                {getKeys(act).map((k, kIdx) => (
                  <span key={kIdx} className="act-key-badge">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
