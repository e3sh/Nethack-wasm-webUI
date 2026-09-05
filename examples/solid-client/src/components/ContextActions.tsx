import { Component, createSignal, createMemo, Show, For } from 'solid-js';
import { gklSituation, currentLanguage } from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';
import { DirectionPad } from './DirectionPad';

export const ContextActions: Component = () => {
  const [selectedDir, setSelectedDir] = createSignal<string>('ALL');

  const isEn = () => currentLanguage() === 'en';

  const rawActions = createMemo(() => {
    return gklSituation()?.actions || gklSituation()?.contextActions || [];
  });

  const actionCounts = createMemo(() => {
    const counts: Record<string, number> = {};
    for (const act of rawActions()) {
      const dir = driverController.extractDirectionCode(act);
      if (dir && dir !== 'NONE') {
        counts[dir] = (counts[dir] || 0) + 1;
      }
    }
    return counts;
  });

  const filteredActions = createMemo(() => {
    const dir = selectedDir();
    if (dir === 'ALL') {
      return rawActions();
    }
    return rawActions().filter((act: any) => {
      const d = driverController.extractDirectionCode(act);
      return d === dir;
    });
  });

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

  const handleActionClick = (act: any) => {
    if (act.keySequence && Array.isArray(act.keySequence) && act.keySequence.length > 0) {
      driverController.executeSequence(act.keySequence);
    } else {
      driverController.executeAction(act);
    }
  };

  return (
    <div class="gkl-card actions-card">
      <div class="gkl-card-header">
        <span>🧠 {isEn() ? 'Context Actions' : '推奨アクション (ContextActions)'}</span>
        <span class="gkl-badge">{filteredActions().length}</span>
      </div>

      {/* 🎯 方向フィルターインジケーター (「囲」型 3x3 キーパッド) */}
      <DirectionPad
        value={selectedDir()}
        onChange={setSelectedDir}
        actionCounts={actionCounts()}
      />

      {/* 推奨アクションリスト */}
      <div class="gkl-action-list">
        <Show
          when={filteredActions().length > 0}
          fallback={
            <div class="gkl-empty-hint">
              {isEn() ? 'No contextual actions available' : '周辺環境に応じたアクションが自動表示されます'}
            </div>
          }
        >
          <For each={filteredActions()}>
            {(act: any, idx) => (
              <div
                class={`gkl-action-item ${getActionItemClass(act)}`}
                onClick={() => handleActionClick(act)}
              >
                <div class="act-main">
                  <span class="act-icon">{act.icon || '⚡'}</span>
                  <div class="act-info">
                    <div class="act-label">
                      {isEn() ? (act.labelEn || act.label || act.name) : (act.labelJa || act.label || act.name)}
                    </div>
                    <Show when={act.description || act.desc}>
                      <div class="act-desc">{act.description || act.desc}</div>
                    </Show>
                  </div>
                </div>

                <div class="act-keys">
                  <For each={getKeys(act)}>
                    {(key) => (
                      <span class="act-key-badge">{key}</span>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};
