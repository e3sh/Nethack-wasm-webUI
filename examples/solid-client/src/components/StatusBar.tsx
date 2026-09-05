import { Component, createSignal, createMemo, Show, For } from 'solid-js';
import {
  status,
  gklSituation,
  isPlayerDead,
  engineState,
  currentLanguage,
} from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';

export const StatusBar: Component = () => {
  const [showDetails, setShowDetails] = createSignal(true);

  const isEn = () => currentLanguage() === 'en';

  const hpPercent = createMemo(() => {
    if (!status.hpMax || status.hpMax <= 0) return 0;
    return Math.min(100, Math.max(0, (status.hp / status.hpMax) * 100));
  });

  const pwPercent = createMemo(() => {
    if (!status.pwMax || status.pwMax <= 0) return 0;
    return Math.min(100, Math.max(0, (status.pw / status.pwMax) * 100));
  });

  const hpColor = createMemo(() => {
    const pct = hpPercent();
    if (pct <= 25) return '#ef4444';
    if (pct <= 50) return '#f59e0b';
    return '#10b981';
  });

  const hasCriticalAdvice = createMemo(() => {
    if (isPlayerDead() || engineState() !== 'RUNNING' || status.hpMax <= 0) {
      return false;
    }
    const sit = gklSituation();
    const advices = sit?.advices || sit?.tacticalAdvices || [];
    return advices.some((adv: any) => adv.isCritical || adv.severity === 'CRITICAL');
  });

  const characterTag = createMemo(() => {
    const sit = gklSituation();
    const summary = sit?.attributes?.characterSummary || sit?.playerState?.attributes?.characterSummary;
    if (summary?.displayTag) {
      return isEn() ? (summary.displayTagEn || summary.displayTag) : (summary.displayTagJa || summary.displayTag);
    }
    const charInfo = sit?.attributes?.characterInfo || sit?.playerState?.attributes?.characterInfo;
    if (charInfo && (charInfo.race || charInfo.role)) {
      return `👤 ${charInfo.race || '??'} / ${charInfo.role || '??'}${charInfo.level ? ` Lv.${charInfo.level}` : ''}`;
    }
    return '';
  });

  const activeResistances = createMemo(() => {
    const sit = gklSituation();
    const attrState = sit?.attributes || sit?.playerState?.attributes || {};
    return attrState.activeResistances || [];
  });

  const spellsList = createMemo(() => {
    const sit = gklSituation();
    return sit?.spells?.items || sit?.spells?.spells || sit?.playerState?.spells?.spells || [];
  });

  const skillsList = createMemo(() => {
    const sit = gklSituation();
    return sit?.skills?.activeItems || sit?.skills?.items || sit?.skills?.skills || sit?.playerState?.skills?.skills || [];
  });

  const handleCastSpell = (letter: string) => {
    driverController.castSpell(letter);
  };

  const handleEnhanceSkill = (skill?: any) => {
    driverController.enhanceSkill(skill);
  };

  return (
    <div class="status-bar">
      <div class="status-main">
        <span class="st-item title">{status.title || 'Hero'}</span>
        <span class="st-item dlvl">{status.dlvl}</span>

        {/* HP ゲージバー */}
        <div class="gauge-box">
          <span class="st-item hp">HP:{status.hp}({status.hpMax})</span>
          <div class="gauge-bg">
            <div
              class="gauge-fill hp-fill"
              style={{ width: `${hpPercent()}%`, background: hpColor() }}
            />
          </div>
        </div>

        {/* MP ゲージバー */}
        <div class="gauge-box">
          <span class="st-item pw">Pw:{status.pw}({status.pwMax})</span>
          <div class="gauge-bg">
            <div
              class="gauge-fill mp-fill"
              style={{ width: `${pwPercent()}%` }}
            />
          </div>
        </div>

        <span class="st-item ac">AC:{status.ac}</span>
        <span class="st-item gold">${status.gold}</span>

        {/* トグル展開ボタン */}
        <button
          class="btn-status-toggle"
          onClick={() => setShowDetails(!showDetails())}
          title={isEn() ? 'Toggle detailed status & GKL knowledge' : '詳細ステータス・属性・呪文の表示/非表示'}
        >
          {showDetails() ? '▲' : '▼'}
        </button>
      </div>

      {/* バッジライン (種族・職業タグ / 状態異常 / 飢え / 危機警告) */}
      <div class="status-badges">
        <Show when={characterTag()}>
          <span class="badge char-badge" title={isEn() ? 'Detected Race & Role' : '認識された種族・職業'}>
            {characterTag()}
          </span>
        </Show>

        <Show when={status.hunger}>
          <span class="badge hunger-badge">{status.hunger}</span>
        </Show>

        <For each={status.condition}>
          {(cond) => (
            <span class="badge cond-badge">{cond}</span>
          )}
        </For>

        <Show when={hasCriticalAdvice()}>
          <span class="badge cond-badge critical-crisis">
            🚨 {isEn() ? 'CRITICAL CRISIS' : '危機警告'}
          </span>
        </Show>
      </div>

      {/* 詳細展開セクション */}
      <Show when={showDetails()}>
        <div class="status-details">
          {/* 能力値グリッド (Str, Dex, Con, Int, Wis, Cha) */}
          <div class="status-stats-grid">
            <span class="stat"><label>Str:</label>{status.stats.str}</span>
            <span class="stat"><label>Dex:</label>{status.stats.dex}</span>
            <span class="stat"><label>Con:</label>{status.stats.con}</span>
            <span class="stat"><label>Int:</label>{status.stats.int}</span>
            <span class="stat"><label>Wis:</label>{status.stats.wis}</span>
            <span class="stat"><label>Cha:</label>{status.stats.cha}</span>
            <span class="stat"><label>Align:</label>{status.align}</span>
            <span class="stat"><label>Exp:</label>{status.level}/{status.exp}</span>
            <span class="stat"><label>T:</label>{status.turns}</span>
            <span class="stat"><label>Score:</label>{status.score}</span>
          </div>

          {/* GKL 統合耐性 ＆ 習得魔法 ＆ スキル */}
          <div class="status-gkl-extra">
            {/* 🛡️ 属性耐性 */}
            <div class="gkl-detail-row">
              <span class="detail-label">{isEn() ? '🛡️ Resistances:' : '🛡️ 属性耐性:'}</span>
              <div class="detail-badges-list">
                <Show
                  when={activeResistances().length > 0}
                  fallback={<span class="detail-empty">{isEn() ? 'None' : 'なし'}</span>}
                >
                  <For each={activeResistances()}>
                    {(attr: any) => (
                      <span class="attr-badge" title={`${attr.label} / ${attr.en} (有効)`}>
                        {isEn() ? (attr.en || attr.label) : attr.label}
                      </span>
                    )}
                  </For>
                </Show>
              </div>
            </div>

            {/* 📖 習得呪文 */}
            <div class="gkl-detail-row">
              <span class="detail-label">{isEn() ? '📖 Spells:' : '📖 習得魔法:'}</span>
              <div class="detail-badges-list">
                <Show
                  when={spellsList().length > 0}
                  fallback={<span class="detail-empty">{isEn() ? 'No spells learned' : 'なし'}</span>}
                >
                  <For each={spellsList()}>
                    {(spell: any) => (
                      <button
                        type="button"
                        class="spell-tag-btn"
                        onClick={() => handleCastSpell(spell.letter || spell.invlet)}
                        title={isEn() ? `Cast ${spell.name} [${spell.letter || '?'}] (Fail: ${spell.failRate ?? spell.retrying ?? 0}%)` : `詠唱: ${spell.nameJa || spell.name} [${spell.letter || '?'}] (失敗率: ${spell.failRate ?? 0}%)`}
                      >
                        ⚡ {isEn() ? spell.name : (spell.nameJa || spell.name)} [{spell.letter || '?'}]
                      </button>
                    )}
                  </For>
                </Show>
              </div>
            </div>

            {/* 🥋 スキル (Skills) */}
            <div class="gkl-detail-row">
              <span class="detail-label">{isEn() ? '🥋 Skills:' : '🥋 スキル:'}</span>
              <div class="detail-badges-list">
                <Show
                  when={skillsList().length > 0}
                  fallback={<span class="detail-empty">{isEn() ? 'None' : 'なし'}</span>}
                >
                  <For each={skillsList()}>
                    {(skill: any) => {
                      const isEnhanceable = skill.canEnhance;
                      return (
                        <button
                          type="button"
                          class={`skill-tag ${isEnhanceable ? 'can-enhance' : ''}`}
                          onClick={() => handleEnhanceSkill(skill)}
                          title={skill.rawText || skill.name}
                        >
                          <Show when={isEnhanceable}><span>⭐</span></Show>
                          <strong>{skill.name}</strong> [{(isEn() ? (skill.rank?.en || skill.rank?.label) : (skill.rank?.label || skill.rank?.en)) || (isEn() ? 'Basic' : '入門')}]
                        </button>
                      );
                    }}
                  </For>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};
