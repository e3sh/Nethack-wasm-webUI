import { Component, Show, For, createMemo } from 'solid-js';
import { floorLandmarks, gklSituation, currentLanguage } from '../stores/gameStore';

export const FloorLandmarksHud: Component = () => {
  const isEn = () => currentLanguage() === 'en';
  const landmarks = createMemo(() => floorLandmarks() || gklSituation()?.landmarks || null);
  const summaryItems = createMemo(() => landmarks()?.summary || []);
  const hasLandmarks = () => summaryItems().length > 0;
  const floorTag = () => landmarks()?.floorKey || 'Dlvl:1';

  return (
    <Show when={hasLandmarks()}>
      <div class="floor-landmarks-hud">
        <span class="landmarks-floor-tag">🗺️ {floorTag()}</span>
        <div class="landmarks-badges-container">
          <For each={summaryItems()}>
            {(item: any) => (
              <span
                class="landmark-badge-item"
                title={isEn() ? item.tooltipEn : item.tooltipJa}
              >
                {item.icon} {isEn() ? item.nameEn : item.nameJa}
                <Show when={item.count > 1}>
                  <small class="landmark-count">x{item.count}</small>
                </Show>
              </span>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
};
