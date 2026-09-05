<script lang="ts">
  import {
    statusStore,
    gklSituationStore,
    isPlayerDeadStore,
    engineStateStore,
  } from '../stores/gameStore';
  import { currentLanguageStore, driverController } from '../services/useNetHackDriver';

  let showDetails = true;

  $: isEn = $currentLanguageStore === 'en';

  $: hpPercent = (() => {
    if (!$statusStore.hpMax || $statusStore.hpMax <= 0) return 0;
    return Math.min(100, Math.max(0, ($statusStore.hp / $statusStore.hpMax) * 100));
  })();

  $: pwPercent = (() => {
    if (!$statusStore.pwMax || $statusStore.pwMax <= 0) return 0;
    return Math.min(100, Math.max(0, ($statusStore.pw / $statusStore.pwMax) * 100));
  })();

  $: hpColor = (() => {
    if (hpPercent <= 25) return '#ef4444';
    if (hpPercent <= 50) return '#f59e0b';
    return '#10b981';
  })();

  $: hasCriticalAdvice = (() => {
    if ($isPlayerDeadStore || $engineStateStore !== 'RUNNING' || $statusStore.hpMax <= 0) {
      return false;
    }
    const sit = $gklSituationStore;
    const advices = sit?.advices || sit?.tacticalAdvices || [];
    return advices.some((adv: any) => adv.isCritical || adv.severity === 'CRITICAL');
  })();

  $: characterTag = (() => {
    const sit = $gklSituationStore;
    const summary = sit?.attributes?.characterSummary || sit?.playerState?.attributes?.characterSummary;
    if (summary?.displayTag) {
      return isEn ? (summary.displayTagEn || summary.displayTag) : (summary.displayTagJa || summary.displayTag);
    }
    const charInfo = sit?.attributes?.characterInfo || sit?.playerState?.attributes?.characterInfo;
    if (charInfo && (charInfo.race || charInfo.role)) {
      return `👤 ${charInfo.race || '??'} / ${charInfo.role || '??'}${charInfo.level ? ` Lv.${charInfo.level}` : ''}`;
    }
    return '';
  })();

  $: activeResistances = (() => {
    const sit = $gklSituationStore;
    const attrState = sit?.attributes || sit?.playerState?.attributes || {};
    return attrState.activeResistances || [];
  })();

  $: spellsList = (() => {
    const sit = $gklSituationStore;
    return sit?.spells?.items || sit?.spells?.spells || sit?.playerState?.spells?.spells || [];
  })();

  $: skillsList = (() => {
    const sit = $gklSituationStore;
    return sit?.skills?.activeItems || sit?.skills?.items || sit?.skills?.skills || sit?.playerState?.skills?.skills || [];
  })();

  const handleCastSpell = (letter: string) => {
    driverController.castSpell(letter);
  };

  const handleEnhanceSkill = (skill?: any) => {
    driverController.enhanceSkill(skill);
  };
</script>

<div class="status-bar">
  <div class="status-main">
    <span class="st-item title">{$statusStore.title || 'Hero'}</span>
    <span class="st-item dlvl">{$statusStore.dlvl}</span>

    <!-- HP ゲージバー -->
    <div class="gauge-box">
      <span class="st-item hp">HP:{$statusStore.hp}({$statusStore.hpMax})</span>
      <div class="gauge-bg">
        <div
          class="gauge-fill hp-fill"
          style="width: {hpPercent}%; background: {hpColor};"
        />
      </div>
    </div>

    <!-- MP ゲージバー -->
    <div class="gauge-box">
      <span class="st-item pw">Pw:{$statusStore.pw}({$statusStore.pwMax})</span>
      <div class="gauge-bg">
        <div
          class="gauge-fill mp-fill"
          style="width: {pwPercent}%;"
        />
      </div>
    </div>

    <span class="st-item ac">AC:{$statusStore.ac}</span>
    <span class="st-item gold">${$statusStore.gold}</span>

    <!-- トグル展開ボタン -->
    <button
      class="btn-status-toggle"
      on:click={() => (showDetails = !showDetails)}
      title={isEn ? 'Toggle detailed status & GKL knowledge' : '詳細ステータス・属性・呪文の表示/非表示'}
    >
      {showDetails ? '▲' : '▼'}
    </button>
  </div>

  <!-- バッジライン (種族・職業タグ / 状態異常 / 飢え / 危機警告) -->
  <div class="status-badges">
    {#if characterTag}
      <span class="badge char-badge" title={isEn ? 'Detected Race & Role' : '認識された種族・職業'}>
        {characterTag}
      </span>
    {/if}

    {#if $statusStore.hunger}
      <span class="badge hunger-badge">{$statusStore.hunger}</span>
    {/if}

    {#each $statusStore.condition as cond}
      <span class="badge cond-badge">{cond}</span>
    {/each}

    {#if hasCriticalAdvice}
      <span class="badge cond-badge critical-crisis">
        🚨 {isEn ? 'CRITICAL CRISIS' : '危機警告'}
      </span>
    {/if}
  </div>

  <!-- 詳細展開セクション -->
  {#if showDetails}
    <div class="status-details">
      <!-- 能力値グリッド (Str, Dex, Con, Int, Wis, Cha) -->
      <div class="status-stats-grid">
        <span class="stat"><span class="stat-label">Str:</span>{$statusStore.stats.str}</span>
        <span class="stat"><span class="stat-label">Dex:</span>{$statusStore.stats.dex}</span>
        <span class="stat"><span class="stat-label">Con:</span>{$statusStore.stats.con}</span>
        <span class="stat"><span class="stat-label">Int:</span>{$statusStore.stats.int}</span>
        <span class="stat"><span class="stat-label">Wis:</span>{$statusStore.stats.wis}</span>
        <span class="stat"><span class="stat-label">Cha:</span>{$statusStore.stats.cha}</span>
        <span class="stat"><span class="stat-label">Align:</span>{$statusStore.align}</span>
        <span class="stat"><span class="stat-label">Exp:</span>{$statusStore.level}/{$statusStore.exp}</span>
        <span class="stat"><span class="stat-label">T:</span>{$statusStore.turns}</span>
        <span class="stat"><span class="stat-label">Score:</span>{$statusStore.score}</span>
      </div>

      <!-- GKL 統合耐性 ＆ 習得魔法 ＆ スキル -->
      <div class="status-gkl-extra">
        <!-- 🛡️ 属性耐性 -->
        <div class="gkl-detail-row">
          <span class="detail-label">{isEn ? '🛡️ Resistances:' : '🛡️ 属性耐性:'}</span>
          <div class="detail-badges-list">
            {#if activeResistances.length > 0}
              {#each activeResistances as attr}
                <span class="attr-badge" title={`${attr.label} / ${attr.en} (有効)`}>
                  {isEn ? (attr.en || attr.label) : attr.label}
                </span>
              {/each}
            {:else}
              <span class="detail-empty">{isEn ? 'None' : 'なし'}</span>
            {/if}
          </div>
        </div>

        <!-- 📖 習得呪文 -->
        <div class="gkl-detail-row">
          <span class="detail-label">{isEn ? '📖 Spells:' : '📖 習得魔法:'}</span>
          <div class="detail-badges-list">
            {#if spellsList.length > 0}
              {#each spellsList as spell}
                <button
                  type="button"
                  class="spell-tag-btn"
                  on:click={() => handleCastSpell(spell.letter || spell.invlet)}
                  title={isEn ? `Cast ${spell.name} [${spell.letter || '?'}] (Fail: ${spell.failRate ?? spell.retrying ?? 0}%)` : `詠唱: ${spell.nameJa || spell.name} [${spell.letter || '?'}] (失敗率: ${spell.failRate ?? 0}%)`}
                >
                  ⚡ {isEn ? spell.name : (spell.nameJa || spell.name)} [{spell.letter || '?'}]
                </button>
              {/each}
            {:else}
              <span class="detail-empty">{isEn ? 'No spells learned' : 'なし'}</span>
            {/if}
          </div>
        </div>

        <!-- 🥋 スキル (Skills) -->
        <div class="gkl-detail-row">
          <span class="detail-label">{isEn ? '🥋 Skills:' : '🥋 スキル:'}</span>
          <div class="detail-badges-list">
            {#if skillsList.length > 0}
              {#each skillsList as skill}
                {@const isEnhanceable = skill.canEnhance}
                <button
                  type="button"
                  class="skill-tag {isEnhanceable ? 'can-enhance' : ''}"
                  on:click={() => handleEnhanceSkill(skill)}
                  title={skill.rawText || skill.name}
                >
                  {#if isEnhanceable}<span>⭐</span>{/if}
                  <strong>{skill.name}</strong> [{(isEn ? (skill.rank?.en || skill.rank?.label) : (skill.rank?.label || skill.rank?.en)) || (isEn ? 'Basic' : '入門')}]
                </button>
              {/each}
            {:else}
              <span class="detail-empty">{isEn ? 'None' : 'なし'}</span>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
