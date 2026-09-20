import React, { useMemo, useRef, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';

interface DirectionPadProps {
  value: string;
  onChange: (val: string) => void;
  actionCounts?: Record<string, number>;
}

export const DirectionPad: React.FC<DirectionPadProps> = ({
  value,
  onChange,
  actionCounts = {},
}) => {
  const currentLanguage = useGameStore((state) => state.currentLanguage);
  const isEn = currentLanguage === 'en';
  const { getDefaultAction, getDashAction, executeAction, executeSequence } = useNetHackDriver();

  const longPressTimerRef = useRef<any>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressTriggeredRef = useRef<boolean>(false);
  const lastTapRef = useRef<{ time: number; dir: string }>({ time: 0, dir: '' });

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const handlePointerDown = useCallback((dirId: string, e: React.PointerEvent) => {
    clearLongPress();
    isLongPressTriggeredRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      const defaultAct = getDefaultAction(dirId);
      if (defaultAct) {
        if (defaultAct.actionRecipe) {
          executeSequence(defaultAct.actionRecipe);
        } else if (defaultAct.keySequence) {
          executeSequence(defaultAct.keySequence);
        } else {
          executeAction(defaultAct);
        }
      }
    }, 450);
  }, [clearLongPress, getDefaultAction, executeAction, executeSequence]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (startPosRef.current) {
      const dx = Math.abs(e.clientX - startPosRef.current.x);
      const dy = Math.abs(e.clientY - startPosRef.current.y);
      if (dx > 10 || dy > 10) {
        clearLongPress();
      }
    }
  }, [clearLongPress]);

  const handlePointerUp = useCallback((dirId: string) => {
    clearLongPress();
    if (isLongPressTriggeredRef.current) {
      return;
    }

    const now = Date.now();
    const prev = lastTapRef.current;
    if (now - prev.time < 300 && prev.dir === dirId) {
      // 🏃 ダブルタップ成立: ダッシュ移動（走り）を即時実行
      lastTapRef.current = { time: 0, dir: '' };
      const dashAct = getDashAction(dirId);
      if (dashAct) {
        if (dashAct.actionRecipe) {
          executeSequence(dashAct.actionRecipe);
        } else if (dashAct.keySequence) {
          executeSequence(dashAct.keySequence);
        } else {
          executeAction(dashAct);
        }
        return;
      }
    }

    lastTapRef.current = { time: now, dir: dirId };
    onChange(dirId);
  }, [clearLongPress, getDashAction, executeAction, executeSequence, onChange]);

  const dirButtons = useMemo(() => {
    const hint = isEn
      ? ' (Double-tap: Dash / Long press: 1-step)'
      : ' (ダブルタップ: ダッシュ / 長押し: 1歩移動・待機)';
    return [
      { id: 'NW', label: '↖', title: (isEn ? 'Northwest (7 / y / ↖)' : '北西 (7 / y / ↖)') + hint },
      { id: 'N', label: '↑', title: (isEn ? 'North (8 / k / ↑)' : '北 (8 / k / ↑)') + hint },
      { id: 'NE', label: '↗', title: (isEn ? 'Northeast (9 / u / ↗)' : '北東 (9 / u / ↗)') + hint },
      { id: 'W', label: '←', title: (isEn ? 'West (4 / h / ←)' : '西 (4 / h / ←)') + hint },
      { id: 'SELF', label: isEn ? 'Feet' : '足元', title: (isEn ? 'Feet / Self (5 / . / ·)' : '足元 (5 / . / ・)') + hint },
      { id: 'E', label: '→', title: (isEn ? 'East (6 / l / →)' : '東 (6 / l / →)') + hint },
      { id: 'SW', label: '↙', title: (isEn ? 'Southwest (1 / b / ↙)' : '南西 (1 / b / ↙)') + hint },
      { id: 'S', label: '↓', title: (isEn ? 'South (2 / j / ↓)' : '南 (2 / j / ↓)') + hint },
      { id: 'SE', label: '↘', title: (isEn ? 'Southeast (3 / n / ↘)' : '南東 (3 / n / ↘)') + hint },
    ];
  }, [isEn]);

  const filterLabel = useMemo(() => {
    if (value === 'ALL') return isEn ? 'All Directions' : '全て';
    if (value === 'SELF') return isEn ? 'Feet (Self)' : '足元';
    return value;
  }, [value, isEn]);

  const getActionCount = (dir: string) => actionCounts[dir] || 0;

  return (
    <div className="gkl-dir-filter-container">
      <div className="gkl-dir-filter-bar">
        <span className="gkl-filter-label">{isEn ? 'Filter:' : '表示:'} {filterLabel}</span>
        <button
          className={`gkl-dir-reset-btn ${value === 'ALL' ? 'active' : ''}`}
          title={isEn ? 'Reset filter (Show all)' : 'フィルター解除 (すべて表示)'}
          onClick={() => onChange('ALL')}
        >
          {isEn ? 'Show All' : '全表示'}
        </button>
      </div>

      <div className="gkl-direction-pad">
        {dirButtons.map((btn) => {
          const count = getActionCount(btn.id);
          return (
            <button
              key={btn.id}
              className={`gkl-dir-btn ${value === btn.id ? 'active' : ''} ${count > 0 ? 'has-action' : ''}`}
              title={btn.title}
              onPointerDown={(e) => handlePointerDown(btn.id, e)}
              onPointerMove={handlePointerMove}
              onPointerUp={() => handlePointerUp(btn.id)}
              onPointerCancel={clearLongPress}
              onPointerLeave={clearLongPress}
            >
              {btn.label}
              {count > 0 && <span className="gkl-dir-badge">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

