<script lang="ts">
  import { gklSituationStore } from '../stores/gameStore';
  import { currentLanguageStore, driverController } from '../services/useNetHackDriver';
  import DirectionPad from './DirectionPad.svelte';

  let selectedDir: string = 'ALL';

  $: isEn = $currentLanguageStore === 'en';

  $: rawActions = $gklSituationStore?.actions || $gklSituationStore?.contextActions || [];

  $: actionCounts = (() => {
    const counts: Record<string, number> = {};
    for (const act of rawActions) {
      const dir = driverController.extractDirectionCode(act);
      if (dir && dir !== 'NONE') {
        counts[dir] = (counts[dir] || 0) + 1;
      }
    }
    return counts;
  })();

  $: filteredActions = (() => {
    if (selectedDir === 'ALL') {
      return rawActions;
    }
    return rawActions.filter((act: any) => {
      const d = driverController.extractDirectionCode(act);
      return d === selectedDir;
    });
  })();

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

  const onDirChange = (e: CustomEvent<string>) => {
    selectedDir = e.detail;
  };
</script>

<div class="gkl-card actions-card">
  <div class="gkl-card-header">
    <span>🧠 {isEn ? 'Context Actions' : '推奨アクション (ContextActions)'}</span>
    <span class="gkl-badge">{filteredActions.length}</span>
  </div>

  <!-- 🎯 方向フィルターインジケーター (「囲」型 3x3 キーパッド) -->
  <DirectionPad
    value={selectedDir}
    actionCounts={actionCounts}
    on:change={onDirChange}
  />

  <!-- 推奨アクションリスト -->
  <div class="gkl-action-list">
    {#if filteredActions.length > 0}
      {#each filteredActions as act}
        <div
          class="gkl-action-item {getActionItemClass(act)}"
          on:click={() => handleActionClick(act)}
        >
          <div class="act-main">
            <span class="act-icon">{act.icon || '⚡'}</span>
            <div class="act-info">
              <div class="act-label">
                {isEn ? (act.labelEn || act.label || act.name) : (act.labelJa || act.label || act.name)}
              </div>
              {#if act.description || act.desc}
                <div class="act-desc">{act.description || act.desc}</div>
              {/if}
            </div>
          </div>

          <div class="act-keys">
            {#each getKeys(act) as key}
              <span class="act-key-badge">{key}</span>
            {/each}
          </div>
        </div>
      {/each}
    {:else}
      <div class="gkl-empty-hint">
        {isEn ? 'No contextual actions available' : '周辺環境に応じたアクションが自動表示されます'}
      </div>
    {/if}
  </div>
</div>
