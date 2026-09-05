import { Component, Show, For } from 'solid-js';
import { viewMode, mapGrid, cursorPos } from '../stores/gameStore';
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

export const GameViewport: Component = () => {
  return (
    <section class="game-viewport">
      {/* メイン 80x21 描画 Canvas */}
      <div class="game-viewport-graphic" style={{ display: viewMode() === 'GRAPHIC' ? 'block' : 'none', width: '100%' }}>
        <GameCanvas />
      </div>

      {/* ASCII Grid (ビュー切替時) */}
      <Show when={viewMode() === 'ASCII'}>
        <div class="ascii-grid">
          <For each={mapGrid}>
            {(row, y) => (
              <div class="ascii-row">
                <For each={row}>
                  {(tile, x) => {
                    const isCursor = () => cursorPos() && cursorPos()!.x === x() && cursorPos()!.y === y();
                    return (
                      <span
                        class={`ascii-cell ${isCursor() ? 'cursor-focus' : ''}`}
                        style={{ color: getAsciiColor(tile.color) }}
                      >
                        {tile.symbol || ' '}
                      </span>
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* 🎯 自キャラ周辺 拡大ズームカメラ窓 (オーバーレイ中央固定) */}
      <FocusCamera />

      {/* 🧭 フロア設備案内フローティング HUD (Landmarks Bar) */}
      <FloorLandmarksHud />
    </section>
  );
};
