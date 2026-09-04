import React from 'react';
import { useGameStore } from '../stores/gameStore';
import { GameCanvas } from './GameCanvas';
import { FocusCamera } from './FocusCamera';
import { FloorLandmarksHud } from './FloorLandmarksHud';

const asciiColors = [
  '#000000', '#b21818', '#18b218', '#b26818',
  '#1818b2', '#b218b2', '#18b2b2', '#b2b2b2',
  '#686868', '#ff5454', '#54ff54', '#ffff54',
  '#5454ff', '#ff54ff', '#54ffff', '#ffffff'
];

function getAsciiColor(colorNum: number = 7): string {
  return asciiColors[colorNum] || '#ffffff';
}

export const GameViewport: React.FC = () => {
  const viewMode = useGameStore((state) => state.viewMode);
  const mapGrid = useGameStore((state) => state.mapGrid);
  const cursorPos = useGameStore((state) => state.cursorPos);

  return (
    <section className="game-viewport">
      {/* メイン 80x21 描画 Canvas */}
      <div className="game-viewport-graphic" style={{ display: viewMode === 'GRAPHIC' ? 'block' : 'none', width: '100%' }}>
        <GameCanvas />
      </div>

      {/* ASCII Grid (ビュー切替時) */}
      {viewMode === 'ASCII' && (
        <div className="ascii-grid">
          {mapGrid.map((row, y) => (
            <div key={y} className="ascii-row">
              {row.map((tile, x) => {
                const isCursor = cursorPos && cursorPos.x === x && cursorPos.y === y;
                return (
                  <span
                    key={x}
                    className={`ascii-cell ${isCursor ? 'cursor-focus' : ''}`}
                    style={{ color: getAsciiColor(tile.color) }}
                  >
                    {tile.symbol || ' '}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* 🎯 自キャラ周辺 拡大ズームカメラ窓 (オーバーレイ中央固定) */}
      <FocusCamera />

      {/* 🧭 フロア設備案内フローティング HUD (Landmarks Bar) */}
      <FloorLandmarksHud />
    </section>
  );
};
