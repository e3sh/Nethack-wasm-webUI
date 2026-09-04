import React, { useState, useMemo, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';

export const GklKnowledgeTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'advices' | 'knowledge'>('advices');

  const gklSituation = useGameStore((state) => state.gklSituation);
  const hoveredTileKnowledge = useGameStore((state) => state.hoveredTileKnowledge);
  const isPlayerDead = useGameStore((state) => state.isPlayerDead);
  const engineState = useGameStore((state) => state.engineState);
  const hpMax = useGameStore((state) => state.status.hpMax);
  const currentLanguage = useGameStore((state) => state.currentLanguage);

  useNetHackDriver();

  const isEn = currentLanguage === 'en';

  const tacticalAdvices = useMemo(() => {
    if (isPlayerDead || engineState !== 'RUNNING' || hpMax <= 0) {
      return [];
    }
    return gklSituation?.advices || gklSituation?.tacticalAdvices || [];
  }, [isPlayerDead, engineState, hpMax, gklSituation]);

  // ナレッジがホバーまたはクリックされたら自動でナレッジタブに切り替え
  useEffect(() => {
    if (hoveredTileKnowledge) {
      setActiveTab('knowledge');
    }
  }, [hoveredTileKnowledge]);

  const currentKnowledge = useMemo(() => {
    if (hoveredTileKnowledge?.knowledge) {
      return hoveredTileKnowledge.knowledge;
    }
    return hoveredTileKnowledge || null;
  }, [hoveredTileKnowledge]);

  const knowledgeName = useMemo(() => {
    const k = currentKnowledge;
    if (!k) return '';
    return isEn ? (k.nameEn || k.name || k.title) : (k.nameJa || k.name || k.title);
  }, [currentKnowledge, isEn]);

  const dispositionBadgeInfo = useMemo(() => {
    const k = currentKnowledge;
    if (!k) return null;
    const disp = k.dispositionStatus;
    const isPet = k.type === 'PET' || k.isPet;
    const isPlayer = k.type === 'PLAYER' || k.isPlayer;

    if (disp === 'PEACEFUL') {
      return { label: isEn ? '☮️ Peaceful (SAFE)' : '☮️ 平和的 (SAFE)', badgeClass: 'kn-status-peaceful' };
    } else if (disp === 'DEFAULT_PEACEFUL') {
      return { label: isEn ? '☮️ Normally Peaceful' : '☮️ 通常平和 (SAFE)', badgeClass: 'kn-status-peaceful' };
    } else if (disp === 'TAMED' || isPet) {
      return { label: isEn ? '🐾 Pet (TAMED)' : '🐾 ペット (TAMED)', badgeClass: 'kn-status-tamed' };
    } else if (disp === 'PLAYER' || isPlayer) {
      return { label: isEn ? '👤 Player' : '👤 プレイヤー', badgeClass: 'kn-status-player' };
    } else if (disp === 'HOSTILE' || k.dangerLevel) {
      return { label: isEn ? `⚔️ Hostile (${k.dangerLevel || 'LETHAL'})` : `⚔️ 敵対的 (${k.dangerLevel || 'LETHAL'})`, badgeClass: 'kn-status-hostile' };
    }
    return null;
  }, [currentKnowledge, isEn]);

  const monsterStats = useMemo(() => {
    const k = currentKnowledge;
    if (!k || !k.stats) return null;
    return k.stats;
  }, [currentKnowledge]);

  const knowledgeTags = useMemo(() => {
    const k = currentKnowledge;
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
  }, [currentKnowledge]);

  return (
    <div className="gkl-card knowledge-tabs-card">
      <div className="gkl-card-header gkl-card-header-tabs">
        <div className="gkl-header-tabs">
          <button
            className={`gkl-tab-btn ${activeTab === 'advices' ? 'active' : ''}`}
            title={isEn ? 'Show tactical advices and danger warnings' : '戦術アドバイス ＆ 危険警告を表示'}
            onClick={() => setActiveTab('advices')}
          >
            🛡️ {isEn ? 'Advice' : 'アドバイス'}
            {tacticalAdvices.length > 0 && <span className="gkl-badge">{tacticalAdvices.length}</span>}
          </button>

          <button
            className={`gkl-tab-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
            title={isEn ? 'Show structured knowledge for inspected tile/item' : '直前に調査した構造化ナレッジを表示'}
            onClick={() => setActiveTab('knowledge')}
          >
            💡 {isEn ? 'Knowledge' : 'ナレッジ'}
          </button>
        </div>
      </div>

      <div className="gkl-knowledge-content">
        {/* 1. 🛡️ アドバイスタブ */}
        {activeTab === 'advices' && (
          <div className="tab-pane-advices">
            {tacticalAdvices.length === 0 ? (
              <div className="gkl-empty-hint">
                {isEn ? 'No urgent tactical advices' : '現在、特に緊急の戦術アドバイスはありません'}
              </div>
            ) : (
              tacticalAdvices.map((adv: any, idx: number) => {
                const isCritical = adv.isCritical || adv.severity === 'CRITICAL';
                const text = typeof adv === 'string'
                  ? adv
                  : (isEn ? (adv.textEn || adv.messageEn || adv.text || adv.message || adv.advice) : (adv.textJa || adv.messageJa || adv.text || adv.message || adv.advice));
                return (
                  <div
                    key={idx}
                    className={`advice-item ${isCritical ? 'is-critical' : ''}`}
                  >
                    <span className="advice-icon">{isCritical ? '⚠️' : '💡'}</span>
                    <div className="advice-text">{text}</div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 2. 💡 ナレッジタブ */}
        {activeTab === 'knowledge' && (
          <div className="tab-pane-knowledge">
            {!currentKnowledge ? (
              <div className="gkl-empty-hint">
                {isEn ? 'Hover on zoom camera or inventory item to inspect knowledge' : 'ズームカメラホバーまたは所持品選択でナレッジ表示'}
              </div>
            ) : (
              <div className="knowledge-view-container">
                <div className="knowledge-title-bar">
                  <span className="k-name">{knowledgeName}</span>
                  {currentKnowledge.category && <span className="k-cat-badge">{currentKnowledge.category}</span>}
                </div>

                {/* 危険度・ステータスインジケーター */}
                <div className="k-status-bar">
                  {/* 態度・ディスポジションバッジ */}
                  {dispositionBadgeInfo && (
                    <span className={`kn-status-badge ${dispositionBadgeInfo.badgeClass}`}>
                      {dispositionBadgeInfo.label}
                    </span>
                  )}

                  {/* 危険度バッジ */}
                  {currentKnowledge.dangerLevel && currentKnowledge.dangerLevel !== 'NONE' && (
                    <span className={`kn-danger-badge danger-${currentKnowledge.dangerLevel.toLowerCase()}`}>
                      {currentKnowledge.dangerLevel} DANGER
                    </span>
                  )}

                  {/* Look 確定確認済みバッジ */}
                  {(currentKnowledge.isClickConfirmed || hoveredTileKnowledge?.isClickConfirmed) && (
                    <span className="kn-status-badge kn-status-confirmed">
                      {isEn ? '🔍 Look Inspected' : '🔍 Look確認済み'}
                    </span>
                  )}
                </div>

                {/* 通常平和モンスターの注釈 */}
                {currentKnowledge.dispositionStatus === 'DEFAULT_PEACEFUL' && (
                  <div className="k-peaceful-note">
                    {isEn ? '※ Normally peaceful; becomes hostile (LETHAL) if attacked or stolen from.' : '※ 通常は平和的ですが、攻撃・泥棒を行うと敵対化 (LETHAL) します'}
                  </div>
                )}

                {/* モンスター / プレイヤー 構造化ステータス行 (HD/Lv, AC, HP, Pw, Gold, Dlvl, 所持品数) */}
                {monsterStats && (
                  <div className="k-stats-row">
                    <span>HD/Lv:{monsterStats.hd ?? '-'}</span>
                    <span>AC:{monsterStats.ac ?? '-'}</span>
                    {monsterStats.hp && <span className="text-hp">HP:{monsterStats.hp}</span>}
                    {monsterStats.pw && <span className="text-pw">Pw:{monsterStats.pw}</span>}
                    {monsterStats.gold && <span className="text-gold">{isEn ? 'Gold:' : '金:'}{monsterStats.gold}</span>}
                    {monsterStats.dlvl && <span>{monsterStats.dlvl}</span>}
                    {currentKnowledge.inventoryCount !== undefined && (
                      <span className="text-inv">🎒{isEn ? 'Items:' : '所持品:'}{currentKnowledge.inventoryCount}</span>
                    )}
                  </div>
                )}

                {/* 死体警告ボックス */}
                {currentKnowledge.corpseInfo?.warningNote && (
                  <div className="k-warning-box">
                    ⚠️ {currentKnowledge.corpseInfo.warningNote}
                  </div>
                )}

                {/* 説明・効果要約 */}
                {(currentKnowledge.effectSummary || currentKnowledge.summary || currentKnowledge.description) && (
                  <div className="k-desc">
                    {currentKnowledge.effectSummary || currentKnowledge.summary || currentKnowledge.description}
                  </div>
                )}

                {/* 実戦戦術アドバイス (Tactical Advice) */}
                {currentKnowledge.tacticalAdvice && currentKnowledge.tacticalAdvice.length > 0 && (
                  <div className="k-advice-section">
                    <div className="k-section-label">💡 {isEn ? 'Tactical Advice' : '実戦戦術アドバイス'}</div>
                    <ul className="k-advice-list">
                      {currentKnowledge.tacticalAdvice.map((adv: string, advIdx: number) => (
                        <li key={advIdx}>• {adv}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 用途・活用アドバイス (Usage Advice) */}
                {currentKnowledge.usageAdvice && currentKnowledge.usageAdvice.length > 0 && (
                  <div className="k-advice-section">
                    <div className="k-section-label">💡 {isEn ? 'Usage & Strategy Advice' : '用途・活用アドバイス'}</div>
                    <ul className="k-advice-list">
                      {currentKnowledge.usageAdvice.map((uAdv: string, uIdx: number) => (
                        <li key={uIdx}>• {uAdv}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 識別戦術テクニック (Unidentified Tips) */}
                {currentKnowledge.unidentifiedTips && currentKnowledge.unidentifiedTips.length > 0 && (
                  <div className="k-advice-section">
                    <div className="k-section-label">🔍 {isEn ? 'Identification Tips' : '識別戦術テクニック'}</div>
                    <ul className="k-advice-list">
                      {currentKnowledge.unidentifiedTips.map((tip: string, tIdx: number) => (
                        <li key={tIdx}>• {tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 耐性・弱点・特効タグ */}
                {knowledgeTags.length > 0 && (
                  <div className="k-tags-list">
                    {knowledgeTags.map((t, tIdx) => (
                      <span key={tIdx} className={`k-tag ${t.type}`}>
                        {t.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* 推奨アクションヒント */}
                {currentKnowledge.actionLabel && (
                  <div className="k-action-hint">
                    💡 {isEn ? 'Recommended Move:' : '推奨アクション:'} <strong>{currentKnowledge.actionLabel}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
