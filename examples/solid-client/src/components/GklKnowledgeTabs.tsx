import { Component, createSignal, createMemo, createEffect, Show, For } from 'solid-js';
import {
  gklSituation,
  hoveredTileKnowledge,
  isPlayerDead,
  engineState,
  status,
  currentLanguage,
} from '../stores/gameStore';

export const GklKnowledgeTabs: Component = () => {
  const [activeTab, setActiveTab] = createSignal<'advices' | 'knowledge'>('advices');

  const isEn = () => currentLanguage() === 'en';

  const tacticalAdvices = createMemo(() => {
    if (isPlayerDead() || engineState() !== 'RUNNING' || status.hpMax <= 0) {
      return [];
    }
    return gklSituation()?.advices || gklSituation()?.tacticalAdvices || [];
  });

  // ナレッジがホバーまたはクリックされたら自動でナレッジタブに切り替え
  createEffect(() => {
    if (hoveredTileKnowledge()) {
      setActiveTab('knowledge');
    }
  });

  const currentKnowledge = createMemo(() => {
    const tile = hoveredTileKnowledge();
    if (tile?.knowledge) {
      return tile.knowledge;
    }
    return tile || null;
  });

  const knowledgeName = createMemo(() => {
    const k = currentKnowledge();
    if (!k) return '';
    return isEn() ? (k.nameEn || k.name || k.title) : (k.nameJa || k.name || k.title);
  });

  const dispositionBadgeInfo = createMemo(() => {
    const k = currentKnowledge();
    if (!k) return null;
    const disp = k.dispositionStatus;
    const isPet = k.type === 'PET' || k.isPet;
    const isPlayer = k.type === 'PLAYER' || k.isPlayer;

    if (disp === 'PEACEFUL') {
      return { label: isEn() ? '☮️ Peaceful (SAFE)' : '☮️ 平和的 (SAFE)', badgeClass: 'kn-status-peaceful' };
    } else if (disp === 'DEFAULT_PEACEFUL') {
      return { label: isEn() ? '☮️ Normally Peaceful' : '☮️ 通常平和 (SAFE)', badgeClass: 'kn-status-peaceful' };
    } else if (disp === 'TAMED' || isPet) {
      return { label: isEn() ? '🐾 Pet (TAMED)' : '🐾 ペット (TAMED)', badgeClass: 'kn-status-tamed' };
    } else if (disp === 'PLAYER' || isPlayer) {
      return { label: isEn() ? '👤 Player' : '👤 プレイヤー', badgeClass: 'kn-status-player' };
    } else if (disp === 'HOSTILE' || k.dangerLevel) {
      return { label: isEn() ? `⚔️ Hostile (${k.dangerLevel || 'LETHAL'})` : `⚔️ 敵対的 (${k.dangerLevel || 'LETHAL'})`, badgeClass: 'kn-status-hostile' };
    }
    return null;
  });

  const monsterStats = createMemo(() => {
    const k = currentKnowledge();
    if (!k || !k.stats) return null;
    return k.stats;
  });

  const knowledgeTags = createMemo(() => {
    const k = currentKnowledge();
    if (!k) return [];
    const tags: Array<{ label: string; type: string }> = [];

    if (k.resistances && Array.isArray(k.resistances)) {
      k.resistances.forEach((r: string) => tags.push({ label: `耐: ${r}`, type: 'res' }));
    }
    if (k.weaknesses && Array.isArray(k.weaknesses)) {
      k.weaknesses.forEach((w: string) => tags.push({ label: `弱: ${w}`, type: 'weak' }));
    }
    if (k.traits && Array.isArray(k.traits)) {
      k.traits.forEach((t: string) => tags.push({ label: t, type: 'trait' }));
    }
    return tags;
  });

  return (
    <div class="gkl-card knowledge-tabs-card">
      <div class="gkl-card-header gkl-card-header-tabs">
        <div class="gkl-header-tabs">
          <button
            class={`gkl-tab-btn ${activeTab() === 'advices' ? 'active' : ''}`}
            title={isEn() ? 'Show tactical advices and danger warnings' : '戦術アドバイス ＆ 危険警告を表示'}
            onClick={() => setActiveTab('advices')}
          >
            🛡️ {isEn() ? 'Advice' : 'アドバイス'}
            <Show when={tacticalAdvices().length > 0}>
              <span class="gkl-badge">{tacticalAdvices().length}</span>
            </Show>
          </button>
          <button
            class={`gkl-tab-btn ${activeTab() === 'knowledge' ? 'active' : ''}`}
            title={isEn() ? 'Inspect hovered/selected entity or terrain' : '選択・ホバーされた対象の構造化ナレッジ解説'}
            onClick={() => setActiveTab('knowledge')}
          >
            💡 {isEn() ? 'Knowledge' : '解説 (Inspect)'}
          </button>
        </div>
      </div>

      <div class="gkl-knowledge-content">
        {/* タブ 1: 戦術アドバイス */}
        <Show when={activeTab() === 'advices'}>
          <div class="tab-pane-advices">
            <Show
              when={tacticalAdvices().length > 0}
              fallback={
                <div class="gkl-empty-hint">
                  {isEn() ? 'No critical warnings. Explore safely!' : '特筆すべき危機はありません。安全に探索可能です。'}
                </div>
              }
            >
              <For each={tacticalAdvices()}>
                {(adv: any) => {
                  const isCrit = adv.isCritical || adv.severity === 'CRITICAL' || adv.level === 'CRITICAL';
                  const msg = typeof adv === 'string'
                    ? adv
                    : (isEn() ? (adv.messageEn || adv.message || adv.text || adv.advice) : (adv.messageJa || adv.message || adv.text || adv.advice));
                  return (
                    <div class={`advice-item ${isCrit ? 'is-critical' : ''}`}>
                      <span class="advice-icon">{isCrit ? '🚨' : (adv.icon || '💡')}</span>
                      <span class="advice-text">{msg}</span>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>
        </Show>

        {/* タブ 2: 構造化ナレッジ解説 */}
        <Show when={activeTab() === 'knowledge'}>
          <div class="tab-pane-knowledge">
            <Show
              when={currentKnowledge()}
              fallback={
                <div class="gkl-empty-hint">
                  {isEn() ? 'Hover or click map/inventory to inspect knowledge' : 'マップや所持品にカーソルを合わせると詳細解説が表示されます'}
                </div>
              }
            >
              <div class="knowledge-view-container">
                <div class="knowledge-title-bar">
                  <span class="k-name">{knowledgeName()}</span>
                  <Show when={currentKnowledge()?.category}>
                    <span class="k-cat-badge">{currentKnowledge()?.category}</span>
                  </Show>
                </div>

                {/* ステータス / 態度バッジ */}
                <div class="k-status-bar">
                  <Show when={dispositionBadgeInfo()}>
                    <span class={`kn-status-badge ${dispositionBadgeInfo()?.badgeClass}`}>
                      {dispositionBadgeInfo()?.label}
                    </span>
                  </Show>
                  <Show when={currentKnowledge()?.isDanger && !dispositionBadgeInfo()}>
                    <span class="kn-danger-badge">⚠️ 危険</span>
                  </Show>
                </div>

                {/* モンスター詳細ステータス */}
                <Show when={monsterStats()}>
                  <div class="k-stats-row">
                    <Show when={monsterStats()?.hp}><span class="text-hp">HP: {monsterStats()?.hp}</span></Show>
                    <Show when={monsterStats()?.ac}><span class="text-ac">AC: {monsterStats()?.ac}</span></Show>
                    <Show when={monsterStats()?.mr}><span class="text-mr">MR: {monsterStats()?.mr}</span></Show>
                    <Show when={monsterStats()?.speed}><span class="text-speed">Spd: {monsterStats()?.speed}</span></Show>
                    <Show when={monsterStats()?.level}><span class="text-lvl">Lv: {monsterStats()?.level}</span></Show>
                  </div>
                </Show>

                {/* 致命的危険 / 注意事項 */}
                <Show when={currentKnowledge()?.warnings && currentKnowledge()?.warnings.length > 0}>
                  <div class="k-warning-box">
                    <strong>⚠️ {isEn() ? 'Warnings:' : '危険・注意事項:'}</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      <For each={currentKnowledge()?.warnings}>
                        {(w: string) => <li>{w}</li>}
                      </For>
                    </ul>
                  </div>
                </Show>

                {/* ナレッジ解説テキスト */}
                <Show when={currentKnowledge()?.description || currentKnowledge()?.desc || currentKnowledge()?.effectSummary}>
                  <div class="k-desc">
                    {currentKnowledge()?.description || currentKnowledge()?.desc || currentKnowledge()?.effectSummary}
                  </div>
                </Show>

                {/* 耐性・弱点タグ */}
                <Show when={knowledgeTags().length > 0}>
                  <div class="k-tags-list">
                    <For each={knowledgeTags()}>
                      {(tag) => (
                        <span class={`k-tag ${tag.type}`}>{tag.label}</span>
                      )}
                    </For>
                  </div>
                </Show>

                {/* 推奨対処・ワンタップヒント */}
                <Show when={currentKnowledge()?.actionHint || currentKnowledge()?.actionLabel}>
                  <div class="k-action-hint">
                    💡 <strong>{isEn() ? 'Hint:' : '推奨アクション:'}</strong> {currentKnowledge()?.actionHint || currentKnowledge()?.actionLabel}
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
};
