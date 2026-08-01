<template>
  <div class="status-bar">
    <div class="status-main">
      <span class="st-item title">{{ status.title || 'Hero' }}</span>
      <!-- ダンジョン・ブランチ名含む階層表示 (Dlvl:1, Tut:1, Mines:1 等) -->
      <span class="st-item dlvl">{{ status.dlvl }}</span>
      <span class="st-item hp">HP:{{ status.hp }}({{ status.hpMax }})</span>
      <span class="st-item pw">Pw:{{ status.pw }}({{ status.pwMax }})</span>
      <span class="st-item ac">AC:{{ status.ac }}</span>
      <span class="st-item gold">💰 {{ status.gold }}</span>
    </div>

    <!-- 動的バッジエリア (Hunger & Condition) -->
    <div class="status-badges">
      <span v-if="status.hunger" class="badge hunger-badge">
        {{ status.hunger }}
      </span>
      <span
        v-for="(cond, idx) in status.condition"
        :key="idx"
        class="badge cond-badge"
      >
        {{ cond }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/gameStore';
import { storeToRefs } from 'pinia';

const gameStore = useGameStore();
const { status } = storeToRefs(gameStore);
</script>

<style scoped>
.status-bar {
  background: #1a1a2e;
  border: 1px solid #16213e;
  border-radius: 4px;
  padding: 8px 12px;
  color: #e0e0e0;
  font-family: monospace;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.status-main {
  display: flex;
  gap: 15px;
  font-size: 15px;
  font-weight: bold;
}

.title { color: #4ecca3; }
.dlvl { color: #f39c12; }
.hp { color: #e74c3c; }
.pw { color: #3498db; }
.ac { color: #9b59b6; }
.gold { color: #f1c40f; }

.status-badges {
  display: flex;
  gap: 6px;
}

.badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.hunger-badge {
  background-color: #e67e22;
  color: #ffffff;
}

.cond-badge {
  background-color: #c0392b;
  color: #ffffff;
}
</style>
