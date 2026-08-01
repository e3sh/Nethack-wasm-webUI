import React from 'react';
import { useGameStore } from '../stores/gameStore';

export const StatusBar: React.FC = () => {
  const status = useGameStore((state) => state.status);

  return (
    <div className="status-bar">
      <div className="status-main">
        <span className="st-item title">{status.title || 'Hero'}</span>
        {/* ダンジョン・ブランチ名含む階層表示 (Dlvl:1, Tut:1, Mines:1 等) */}
        <span className="st-item dlvl">{status.dlvl}</span>
        <span className="st-item hp">HP:{status.hp}({status.hpMax})</span>
        <span className="st-item pw">Pw:{status.pw}({status.pwMax})</span>
        <span className="st-item ac">AC:{status.ac}</span>
        <span className="st-item gold">💰 {status.gold}</span>
      </div>

      {/* 動的バッジエリア (Hunger & Condition) */}
      <div className="status-badges">
        {status.hunger ? (
          <span className="badge hunger-badge">{status.hunger}</span>
        ) : null}
        {status.condition.map((cond, idx) => (
          <span key={idx} className="badge cond-badge">
            {cond}
          </span>
        ))}
      </div>
    </div>
  );
};
