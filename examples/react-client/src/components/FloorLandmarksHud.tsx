import React from 'react';
import { useGameStore } from '../stores/gameStore';

export const FloorLandmarksHud: React.FC = () => {
  const floorLandmarks = useGameStore((state) => state.floorLandmarks);
  const gklSituation = useGameStore((state) => state.gklSituation);
  const currentLanguage = useGameStore((state) => state.currentLanguage);

  const isEn = currentLanguage === 'en';
  const landmarks = floorLandmarks || gklSituation?.landmarks || null;
  const summaryItems = landmarks?.summary || [];
  const hasLandmarks = summaryItems.length > 0;
  const floorTag = landmarks?.floorKey || 'Dlvl:1';

  if (!hasLandmarks) return null;

  return (
    <div className="floor-landmarks-hud">
      <span className="landmarks-floor-tag">🗺️ {floorTag}</span>
      <div className="landmarks-badges-container">
        {summaryItems.map((item: any, idx: number) => (
          <span
            key={idx}
            className="landmark-badge-item"
            title={isEn ? item.tooltipEn : item.tooltipJa}
          >
            {item.icon} {isEn ? item.nameEn : item.nameJa}
            {item.count > 1 && <small className="landmark-count">x{item.count}</small>}
          </span>
        ))}
      </div>
    </div>
  );
};
