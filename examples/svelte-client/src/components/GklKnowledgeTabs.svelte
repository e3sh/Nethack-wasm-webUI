<script lang="ts">
  import {
    gklSituationStore,
    hoveredTileKnowledgeStore,
    isPlayerDeadStore,
    engineStateStore,
    statusStore,
  } from '../stores/gameStore';
  import { currentLanguageStore } from '../services/useNetHackDriver';

  let activeTab: 'advices' | 'knowledge' = 'advices';

  $: isEn = $currentLanguageStore === 'en';

  $: tacticalAdvices = ($isPlayerDeadStore || $engineStateStore !== 'RUNNING' || $statusStore.hpMax <= 0)
    ? []
    : ($gklSituationStore?.advices || $gklSituationStore?.tacticalAdvices || []);

  // ナレッジがホバーまたはクリックされたら自動でナレッジタブに切り替え
  $: if ($hoveredTileKnowledgeStore) {
    activeTab = 'knowledge';
  }

  $: currentKnowledge = (() => {
    const tile = $hoveredTileKnowledgeStore;
    if (tile?.knowledge) {
      return tile.knowledge;
    }
    return tile || null;
  })();

  $: knowledgeName = (() => {
    if (!currentKnowledge) return '';
    return isEn ? (currentKnowledge.nameEn || currentKnowledge.name || currentKnowledge.title) : (currentKnowledge.nameJa || currentKnowledge.name || currentKnowledge.title);
  })();

  $: dispositionBadgeInfo = (() => {
    if (!currentKnowledge) return null;
    const disp = currentKnowledge.dispositionStatus;
    const isPet = currentKnowledge.type === 'PET' || currentKnowledge.isPet;
    const isPlayer = currentKnowledge.type === 'PLAYER' || currentKnowledge.isPlayer;

    if (disp === 'PEACEFUL') {
      return { label: isEn ? '☮️ Peaceful (SAFE)' : '☮️ 平和的 (SAFE)', badgeClass: 'kn-status-peaceful' };
    } else if (disp === 'DEFAULT_PEACEFUL') {
      return { label: isEn ? '☮️ Normally Peaceful' : '☮️ 通常平和 (SAFE)', badgeClass: 'kn-status-peaceful' };
    } else if (disp === 'TAMED' || isPet) {
      return { label: isEn ? '🐾 Pet (TAMED)' : '🐾 ペット (TAMED)', badgeClass: 'kn-status-tamed' };
    } else if (disp === 'PLAYER' || isPlayer) {
      return { label: isEn ? '👤 Player' : '👤 プレイヤー', badgeClass: 'kn-status-player' };
    } else if (disp === 'HOSTILE' || currentKnowledge.dangerLevel) {
      return { label: isEn ? `⚔️ Hostile (${currentKnowledge.dangerLevel || 'LETHAL'})` : `⚔️ 敵対的 (${currentKnowledge.dangerLevel || 'LETHAL'})`, badgeClass: 'kn-status-hostile' };
    }
    return null;
  })();

  $: monsterStats = currentKnowledge?.stats || null;

  $: knowledgeTags = (() => {
    if (!currentKnowledge) return [];
    const tags: Array<{ label: string; type: string }> = [];

    if (currentKnowledge.resistances && Array.isArray(currentKnowledge.resistances)) {
      currentKnowledge.resistances.forEach((r: string) => tags.push({ label: `耐: ${r}`, type: 'res' }));
    }
    if (currentKnowledge.weaknesses && Array.isArray(currentKnowledge.weaknesses)) {
      currentKnowledge.weaknesses.forEach((w: string) => tags.push({ label: `弱: ${w}`, type: 'weak' }));
    }
    if (currentKnowledge.traits && Array.isArray(currentKnowledge.traits)) {
      currentKnowledge.traits.forEach((t: string) => tags.push({ label: t, type: 'trait' }));
    }
    return tags;
  })();
</script>

<div class="gkl-card knowledge-tabs-card">
  <div class="gkl-card-header gkl-card-header-tabs">
    <div class="gkl-header-tabs">
      <button
        class="gkl-tab-btn {activeTab === 'advices' ? 'active' : ''}"
        title={isEn ? 'Show tactical advices and danger warnings' : '戦術アドバイス ＆ 危険警告を表示'}
        on:click={() => (activeTab = 'advices')}
      >
        🛡️ {isEn ? 'Advice' : 'アドバイス'}
        {#if tacticalAdvices.length > 0}
          <span class="gkl-badge">{tacticalAdvices.length}</span>
        {/if}
      </button>
      <button
        class="gkl-tab-btn {activeTab === 'knowledge' ? 'active' : ''}"
        title={isEn ? 'Inspect hovered/selected entity or terrain' : '選択・ホバーされた対象の構造化ナレッジ解説'}
        on:click={() => (activeTab = 'knowledge')}
      >
        💡 {isEn ? 'Knowledge' : '解説 (Inspect)'}
      </button>
    </div>
  </div>

  <div class="gkl-knowledge-content">
    <!-- タブ 1: 戦術アドバイス -->
    {#if activeTab === 'advices'}
      <div class="tab-pane-advices">
        {#if tacticalAdvices.length > 0}
          {#each tacticalAdvices as adv}
            {@const isCrit = adv.isCritical || adv.severity === 'CRITICAL' || adv.level === 'CRITICAL'}
            {@const msg = typeof adv === 'string'
              ? adv
              : (isEn ? (adv.messageEn || adv.message || adv.text || adv.advice) : (adv.messageJa || adv.message || adv.text || adv.advice))}
            <div class="advice-item {isCrit ? 'is-critical' : ''}">
              <span class="advice-icon">{isCrit ? '🚨' : (adv.icon || '💡')}</span>
              <span class="advice-text">{msg}</span>
            </div>
          {/each}
        {:else}
          <div class="gkl-empty-hint">
            {isEn ? 'No critical warnings. Explore safely!' : '特筆すべき危機はありません。安全に探索可能です。'}
          </div>
        {/if}
      </div>
    {/if}

    <!-- タブ 2: 構造化ナレッジ解説 -->
    {#if activeTab === 'knowledge'}
      <div class="tab-pane-knowledge">
        {#if currentKnowledge}
          <div class="knowledge-view-container">
            <div class="knowledge-title-bar">
              <span class="k-name">{knowledgeName}</span>
              {#if currentKnowledge.category}
                <span class="k-cat-badge">{currentKnowledge.category}</span>
              {/if}
            </div>

            <!-- ステータス / 態度バッジ -->
            <div class="k-status-bar">
              {#if dispositionBadgeInfo}
                <span class="kn-status-badge {dispositionBadgeInfo.badgeClass}">
                  {dispositionBadgeInfo.label}
                </span>
              {/if}
              {#if currentKnowledge.isDanger && !dispositionBadgeInfo}
                <span class="kn-danger-badge">⚠️ 危険</span>
              {/if}
            </div>

            <!-- モンスター詳細ステータス -->
            {#if monsterStats}
              <div class="k-stats-row">
                {#if monsterStats.hp}<span class="text-hp">HP: {monsterStats.hp}</span>{/if}
                {#if monsterStats.ac}<span class="text-ac">AC: {monsterStats.ac}</span>{/if}
                {#if monsterStats.mr}<span class="text-mr">MR: {monsterStats.mr}</span>{/if}
                {#if monsterStats.speed}<span class="text-speed">Spd: {monsterStats.speed}</span>{/if}
                {#if monsterStats.level}<span class="text-lvl">Lv: {monsterStats.level}</span>{/if}
              </div>
            {/if}

            <!-- 致命的危険 / 注意事項 -->
            {#if currentKnowledge.warnings && currentKnowledge.warnings.length > 0}
              <div class="k-warning-box">
                <strong>⚠️ {isEn ? 'Warnings:' : '危険・注意事項:'}</strong>
                <ul style="margin: 4px 0 0 16px; padding: 0;">
                  {#each currentKnowledge.warnings as w}
                    <li>{w}</li>
                  {/each}
                </ul>
              </div>
            {/if}

            <!-- ナレッジ解説テキスト -->
            {#if currentKnowledge.description || currentKnowledge.desc || currentKnowledge.effectSummary}
              <div class="k-desc">
                {currentKnowledge.description || currentKnowledge.desc || currentKnowledge.effectSummary}
              </div>
            {/if}

            <!-- 耐性・弱点タグ -->
            {#if knowledgeTags.length > 0}
              <div class="k-tags-list">
                {#each knowledgeTags as tag}
                  <span class="k-tag {tag.type}">{tag.label}</span>
                {/each}
              </div>
            {/if}

            <!-- 推奨対処・ワンタップヒント -->
            {#if currentKnowledge.actionHint || currentKnowledge.actionLabel}
              <div class="k-action-hint">
                💡 <strong>{isEn ? 'Hint:' : '推奨アクション:'}</strong> {currentKnowledge.actionHint || currentKnowledge.actionLabel}
              </div>
            {/if}
          </div>
        {:else}
          <div class="gkl-empty-hint">
            {isEn ? 'Hover or click map/inventory to inspect knowledge' : 'マップや所持品にカーソルを合わせると詳細解説が表示されます'}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
