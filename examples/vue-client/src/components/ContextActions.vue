<template>
  <div class="gkl-card actions-card">
    <div class="gkl-card-header">
      <span>🧠 {{ isEn ? 'Context Actions' : '推奨アクション (ContextActions)' }}</span>
      <span class="gkl-badge">{{ filteredActions.length }}</span>
    </div>

    <!-- 🎯 方向フィルターインジケーター (「囲」型 3x3 キーパッド) -->
    <DirectionPad
      v-model="selectedDir"
      :action-counts="actionCounts"
    />

    <!-- 推奨アクションリスト -->
    <div class="gkl-action-list">
      <div v-if="filteredActions.length === 0" class="gkl-empty-hint">
        {{ isEn ? 'No contextual actions available' : '周辺環境に応じたアクションが自動表示されます' }}
      </div>

      <div
        v-for="(act, idx) in filteredActions"
        :key="act.id || idx"
        class="gkl-action-item"
        :class="getActionItemClass(act)"
        @click="handleActionClick(act)"
      >
        <div class="act-main">
          <span class="act-icon">{{ act.icon || '⚡' }}</span>
          <div class="act-info">
            <div class="act-label">{{ isEn ? (act.labelEn || act.label || act.name) : (act.labelJa || act.label || act.name) }}</div>
            <div v-if="act.description || act.desc || act.descriptionEn || act.descriptionJa" class="act-desc">
              {{ isEn ? (act.descriptionEn || act.descEn || act.description || act.desc) : (act.descriptionJa || act.descJa || act.description || act.desc) }}
            </div>
          </div>
        </div>

        <div class="act-keys">
          <span
            v-for="(k, kIdx) in getKeys(act)"
            :key="kIdx"
            class="act-key-badge"
          >
            {{ k }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../composables/useNetHackDriver';
import { storeToRefs } from 'pinia';
import DirectionPad from './DirectionPad.vue';

const gameStore = useGameStore();
const { gklSituation } = storeToRefs(gameStore);
const { currentLanguage, extractDirectionCode, executeSequence, executeAction } = useNetHackDriver();

const selectedDir = ref<string>('ALL');

const isEn = computed(() => currentLanguage.value === 'en');

const rawActions = computed(() => {
  const sit = gklSituation.value;
  return sit?.actions || sit?.contextActions || [];
});

const actionCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const act of rawActions.value) {
    const dir = extractDirectionCode(act);
    if (dir && dir !== 'NONE') {
      counts[dir] = (counts[dir] || 0) + 1;
    }
  }
  return counts;
});

const filteredActions = computed(() => {
  if (selectedDir.value === 'ALL') {
    return rawActions.value;
  }
  return rawActions.value.filter((act: any) => {
    const dir = extractDirectionCode(act);
    return dir === selectedDir.value;
  });
});

function getActionItemClass(act: any): string {
  if (act.category === 'SURVIVAL' || act.isEmergency || act.severity === 'CRITICAL') {
    return 'danger';
  }
  if (act.category === 'TACTICAL_COMBAT' || act.type === 'ATTACK') {
    return 'combat';
  }
  return '';
}

function getKeys(act: any): string[] {
  if (Array.isArray(act.keySequence) && act.keySequence.length > 0) {
    return act.keySequence;
  }
  if (act.key) return [act.key];
  if (act.keys) return Array.isArray(act.keys) ? act.keys : [act.keys];
  return [];
}

async function handleActionClick(act: any) {
  if (act.keySequence && Array.isArray(act.keySequence) && act.keySequence.length > 0) {
    await executeSequence(act.keySequence);
  } else {
    executeAction(act);
  }
}
</script>

<style scoped>
.gkl-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.gkl-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #0f172a;
  border-bottom: 1px solid #334155;
  font-size: 13px;
  font-weight: 700;
  color: #f8fafc;
}

.gkl-badge {
  background: #38bdf8;
  color: #0f172a;
  font-size: 11px;
  font-weight: bold;
  padding: 1px 6px;
  border-radius: 10px;
}

.gkl-action-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.gkl-empty-hint {
  text-align: center;
  color: #64748b;
  font-size: 12px;
  padding: 16px 0;
}

.gkl-action-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.gkl-action-item:hover {
  background: #1e293b;
  border-color: #38bdf8;
  transform: translateX(2px);
}

.gkl-action-item.danger {
  border-left: 3px solid #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.gkl-action-item.combat {
  border-left: 3px solid #f59e0b;
}

.act-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.act-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.act-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.act-label {
  font-size: 12px;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.act-desc {
  font-size: 10px;
  color: #94a3b8;
}

.act-keys {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}

.act-key-badge {
  background: #334155;
  color: #38bdf8;
  border: 1px solid #475569;
  font-size: 10px;
  font-family: monospace;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 3px;
}
</style>
