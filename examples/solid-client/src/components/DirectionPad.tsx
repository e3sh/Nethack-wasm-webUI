import { Component, For, createMemo } from 'solid-js';
import { currentLanguage } from '../stores/gameStore';

interface DirectionPadProps {
  value: string;
  onChange: (val: string) => void;
  actionCounts?: Record<string, number>;
}

export const DirectionPad: Component<DirectionPadProps> = (props) => {
  const isEn = () => currentLanguage() === 'en';

  const dirButtons = createMemo(() => [
    { id: 'NW', label: '↖', title: isEn() ? 'Northwest (7 / y / ↖)' : '北西 (7 / y / ↖)' },
    { id: 'N', label: '↑', title: isEn() ? 'North (8 / k / ↑)' : '北 (8 / k / ↑)' },
    { id: 'NE', label: '↗', title: isEn() ? 'Northeast (9 / u / ↗)' : '北東 (9 / u / ↗)' },
    { id: 'W', label: '←', title: isEn() ? 'West (4 / h / ←)' : '西 (4 / h / ←)' },
    { id: 'SELF', label: isEn() ? 'Feet' : '足元', title: isEn() ? 'Feet / Self (5 / . / ·)' : '足元 (5 / . / ・)' },
    { id: 'E', label: '→', title: isEn() ? 'East (6 / l / →)' : '東 (6 / l / →)' },
    { id: 'SW', label: '↙', title: isEn() ? 'Southwest (1 / b / ↙)' : '南西 (1 / b / ↙)' },
    { id: 'S', label: '↓', title: isEn() ? 'South (2 / j / ↓)' : '南 (2 / j / ↓)' },
    { id: 'SE', label: '↘', title: isEn() ? 'Southeast (3 / n / ↘)' : '南東 (3 / n / ↘)' },
  ]);

  const filterLabel = createMemo(() => {
    const val = props.value;
    if (val === 'ALL') return isEn() ? 'All Directions' : '全て';
    if (val === 'SELF') return isEn() ? 'Feet (Self)' : '足元';
    return val;
  });

  const getActionCount = (dir: string) => (props.actionCounts && props.actionCounts[dir]) || 0;

  return (
    <div class="gkl-dir-filter-container">
      <div class="gkl-dir-filter-bar">
        <span class="gkl-filter-label">{isEn() ? 'Filter:' : '表示:'} {filterLabel()}</span>
        <button
          class={`gkl-dir-reset-btn ${props.value === 'ALL' ? 'active' : ''}`}
          title={isEn() ? 'Reset filter (Show all)' : 'フィルター解除 (すべて表示)'}
          onClick={() => props.onChange('ALL')}
        >
          {isEn() ? 'Show All' : '全表示'}
        </button>
      </div>

      <div class="gkl-direction-pad">
        <For each={dirButtons()}>
          {(btn) => {
            const count = () => getActionCount(btn.id);
            return (
              <button
                class={`gkl-dir-btn ${props.value === btn.id ? 'active' : ''} ${count() > 0 ? 'has-action' : ''}`}
                title={btn.title}
                onClick={() => props.onChange(btn.id)}
              >
                {btn.label}
                {count() > 0 && <span class="gkl-dir-badge">{count()}</span>}
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
};
