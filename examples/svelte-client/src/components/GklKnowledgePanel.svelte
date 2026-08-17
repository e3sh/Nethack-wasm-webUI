<script lang="ts">
  import { gklSituationStore, hoveredTileKnowledgeStore, cursorPosStore, mapGridStore } from '../stores/gameStore';
  import { driverController } from '../services/useNetHackDriver';

  let selectedDir = 'ALL';
  let isSyncing = false;
  let hoveredItem: any = null;
  let selectedAreaTile: any = null;
  let hoveredAreaTile: any = null;

  const dpadButtons = [
    { id: 'NW', label: '北西', icon: '↖' },
    { id: 'N', label: '北', icon: '↑' },
    { id: 'NE', label: '北東', icon: '↗' },
    { id: 'W', label: '西', icon: '←' },
    { id: 'SELF', label: '足元', icon: '・' },
    { id: 'E', label: '東', icon: '→' },
    { id: 'SW', label: '南西', icon: '↙' },
    { id: 'S', label: '南', icon: '↓' },
    { id: 'SE', label: '南東', icon: '↘' },
  ];

  function safeText(val: any): string {
    if (!val) return '';
    if (typeof val === 'string' || typeof val === 'number') return String(val);
    if (typeof val === 'object') {
      return val.code || val.labelJa || val.label || val.name || val.key || '';
    }
    return String(val);
  }

  $: zoomTiles = ($cursorPosStore, $mapGridStore, driverController.getZoomAreaTiles(3)); // 7x7

  $: allActions = $gklSituationStore?.actions || $gklSituationStore?.recommendedActions || [];
  $: filteredActions = selectedDir === 'ALL'
    ? allActions
    : allActions.filter((act: any) => driverController.extractDirectionCode(act) === selectedDir);

  $: dirCounts = (() => {
    const counts: Record<string, number> = {};
    allActions.forEach((act: any) => {
      const code = driverController.extractDirectionCode(act);
      if (code && code !== 'NONE') {
        counts[code] = (counts[code] || 0) + 1;
      }
    });
    return counts;
  })();

  $: inventoryItems = $gklSituationStore?.inventory?.items || [];

  $: activeKnowledge = (() => {
    if (hoveredItem && hoveredItem.knowledge) return hoveredItem.knowledge;
    if (hoveredAreaTile && hoveredAreaTile.knowledge) return hoveredAreaTile.knowledge;
    if (selectedAreaTile && selectedAreaTile.knowledge) return selectedAreaTile.knowledge;
    if ($hoveredTileKnowledgeStore && $hoveredTileKnowledgeStore.knowledge) return $hoveredTileKnowledgeStore.knowledge;
    return null;
  })();

  $: activeCoord = (() => {
    if (hoveredAreaTile && hoveredAreaTile.x !== undefined && hoveredAreaTile.x >= 0) {
      return { x: hoveredAreaTile.x, y: hoveredAreaTile.y };
    }
    if (selectedAreaTile && selectedAreaTile.x !== undefined && selectedAreaTile.x >= 0) {
      return { x: selectedAreaTile.x, y: selectedAreaTile.y };
    }
    if ($hoveredTileKnowledgeStore && $hoveredTileKnowledgeStore.x !== undefined) {
      return { x: $hoveredTileKnowledgeStore.x, y: $hoveredTileKnowledgeStore.y };
    }
    return null;
  })();

  $: activeTileInfo = (() => {
    const tile = hoveredAreaTile || selectedAreaTile;
    if (!tile || tile.x < 0) return '🔍 マスにホバー/タップで解説';
    return `📍 (${tile.x}, ${tile.y}): ${tile.nameJa}`;
  })();

  $: currentFilterLabel = (() => {
    if (selectedDir === 'ALL') return '全方向';
    const found = dpadButtons.find(b => b.id === selectedDir);
    return found ? `${found.label} (${found.icon})` : selectedDir;
  })();

  function getActionCountForDir(dirId: string): number {
    return allActions.filter((act: any) => driverController.extractDirectionCode(act) === dirId).length;
  }

  function getItemCategoryLabel(cat: string | undefined): string {
    if (!cat) return 'Knowledge';
    const map: Record<string, string> = {
      WEAPON: '⚔️ 武器', ARMOR: '🛡️ 防具', RING: '💍 指輪', AMULET: '📿 魔除け',
      WAND: '🪄 杖', SCROLL: '📜 巻物', POTION: '🧪 薬', SPELLBOOK: '📖 呪文書',
      FOOD: '🍖 食料', TOOL: '🧰 道具', GEM: '💎 宝石', COIN: '🪙 金貨',
      CONTAINER: '🧰 容器', TERRAIN: '🗺️ 地形', MONSTER: '👾 モンスター', PET: '🐶 ペット'
    };
    return map[cat.toUpperCase()] || cat;
  }

  function getDangerBadgeInfo(level: string | undefined) {
    if (!level) return null;
    const l = String(level).toUpperCase();
    if (l === 'LETHAL' || l === 'EXTREME' || l === 'VERY_HIGH') {
      return { label: `☠️ 致命的 (${l})`, color: '#ff0055', bg: 'rgba(255, 0, 85, 0.2)', border: '#ff0055' };
    }
    if (l === 'HIGH') {
      return { label: `⚠️ 危険 (HIGH)`, color: '#ff9f1c', bg: 'rgba(255, 159, 28, 0.2)', border: '#ff9f1c' };
    }
    if (l === 'MEDIUM') {
      return { label: `⚡ 注意 (MEDIUM)`, color: '#ffe600', bg: 'rgba(255, 230, 0, 0.2)', border: '#ffe600' };
    }
    return { label: `🟢 低脅威 (${l})`, color: '#2ec4b6', bg: 'rgba(46, 196, 182, 0.2)', border: '#2ec4b6' };
  }

  function formatResistances(res: any): string {
    if (!res || !Array.isArray(res) || res.length === 0) return '';
    const map: Record<string, string> = {
      fire: '火炎', cold: '冷気', sleep: '睡眠', poison: '毒', electricity: '電撃',
      acid: '酸', shock: '電撃', petrify: '石化', drain: 'ドレイン', magic: '魔法'
    };
    return res.map((r: string) => map[r.toLowerCase()] || r).join(', ');
  }

  function formatAttacks(attacks: any): string {
    if (!attacks || !Array.isArray(attacks) || attacks.length === 0) return '';
    return attacks.map((a: any) => {
      if (typeof a === 'string') return a;
      const type = a.type || a.name || '攻撃';
      const dmg = a.damage ? `(${a.damage})` : '';
      const eff = a.effect ? ` [${a.effect}]` : '';
      return `${type}${dmg}${eff}`;
    }).join(', ');
  }

  function getEquipBorderClass(item: any): string {
    if (item.isWielded) return 'equip-border-wielded';
    if (item.isOffhand) return 'equip-border-offhand';
    if (item.isQuivered) return 'equip-border-quivered';
    if (item.isWorn) return 'equip-border-worn';
    return '';
  }

  function handleSelectZoomTile(tile: any) {
    selectedAreaTile = tile;
    const dirMap: Record<string, string> = {
      '-1,-1': 'NW', '0,-1': 'N', '1,-1': 'NE',
      '-1,0': 'W',   '0,0': 'SELF', '1,0': 'E',
      '-1,1': 'SW',  '0,1': 'S',  '1,1': 'SE',
    };
    const key = `${tile.dx},${tile.dy}`;
    if (dirMap[key]) {
      selectedDir = dirMap[key];
    }
  }

  async function handleSyncInventory() {
    isSyncing = true;
    await driverController.syncInventorySilent();
    isSyncing = false;
  }

  function handleExecuteAction(act: any) {
    if (act.risk === 'danger' || act.isDanger) {
      const label = safeText(act.labelJa || act.label || '操作');
      if (!confirm(`【⚠️ 危険な行動】\n"${label}" を実行しますか？`)) return;
    }
    selectedDir = 'ALL';
    driverController.executeAction(act);
  }

  function handleOneTapItem(item: any) {
    const seq = (item.defaultSequence && Array.isArray(item.defaultSequence) && item.defaultSequence.length > 0)
      ? item.defaultSequence
      : [item.letter];
    driverController.executeSequence(seq);
  }

  function getStyleStr(glyphId: number, options: any = {}): string {
    if (typeof driverController.getGlyphStyleString === 'function') {
      return driverController.getGlyphStyleString(glyphId, options);
    }
    const styleObj = driverController.getGlyphStyle(glyphId, options);
    if (!styleObj) return '';
    return Object.entries(styleObj).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';');
  }

  function getActionClass(act: any) {
    if (act.risk === 'danger' || act.category === 'ATTACK' || act.isDanger) return 'btn-danger';
    if (act.category === 'UNCOMMITTED' || act.category === 'ITEM') return 'btn-info';
    return 'btn-primary';
  }
</script>

<div class="gkl-panel">
  <!-- 1. ヘッダー ＆ ステータス -->
  <div class="gkl-header">
    <div class="gkl-header-left">
      <span class="gkl-badge">
        🧠 GKL 状況推論 ＆ ナレッジアシスト
      </span>
      <button on:click={handleSyncInventory} disabled={isSyncing} class="btn-sync">
        {isSyncing ? '...同期中' : '🔄 インベントリ同期'}
      </button>
    </div>
  </div>

  <!-- 2. 所持品インベントリ -->
  {#if inventoryItems.length > 0}
    <div class="gkl-inventory-section">
      <div class="gkl-section-title">
        <span>🎒 所持品ナレッジ・ガイド ({inventoryItems.length}個)</span>
        <span class="gkl-subtext">※ アイコンタップで即時使用・装備</span>
      </div>

      <div class="gkl-inventory-grid">
        {#each inventoryItems as item}
          <div
            class="inv-item-card {getEquipBorderClass(item)}"
            on:click|stopPropagation={() => handleOneTapItem(item)}
            on:mouseenter={() => (hoveredItem = item)}
            on:mouseleave={() => (hoveredItem = null)}
          >
            <div class="inv-item-compact">
              <span class="inv-letter">[{item.letter}]</span>
              {#if item.glyphId !== undefined && item.glyphId >= 0}
                <div class="inv-glyph-icon" style={getStyleStr(item.glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 22 })} />
              {/if}
              {#if item.isWielded}
                <span class="equip-badge badge-wielded" title="メイン武器">手</span>
              {/if}
              {#if item.isOffhand}
                <span class="equip-badge badge-offhand" title="副武器">副</span>
              {/if}
              {#if item.isQuivered}
                <span class="equip-badge badge-quivered" title="矢筒">筒</span>
              {/if}
              {#if item.isWorn}
                <span class="equip-badge badge-worn" title="着用中">着</span>
              {/if}
            </div>

            <!-- 💡 フローティングポップアップ -->
            {#if hoveredItem?.letter === item.letter}
              <div class="inv-floating-popover">
                <div class="popover-title">
                  {safeText(item.knowledge?.nameJa || item.name || item.rawText)}
                </div>
                {#if item.defaultActionLabelJa || item.knowledge?.actionLabelJa}
                  <div class="popover-action">
                    💡 ワンタップ: {safeText(item.defaultActionLabelJa || item.knowledge?.actionLabelJa)} [{item.letter}]
                  </div>
                {/if}
                {#if item.knowledge?.effectSummary || item.knowledge?.description}
                  <div class="popover-desc">
                    {safeText(item.knowledge?.effectSummary || item.knowledge?.description)}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- 3. アクションフィルター ＆ 🔍 7x7 ズームカメラ -->
  <div class="gkl-main-section">
    <div class="gkl-section-header">
      <span class="gkl-section-title">
        🎯 アクションフィルター ＆ 🔍 7x7 ダンジョンズームカメラ
      </span>
      <span class="gkl-filter-status">表示: {currentFilterLabel}</span>
    </div>

    <div class="gkl-split-container">
      <!-- 左側: 🎯 D-Pad -->
      <div class="dpad-card">
        <div class="card-subtitle">🎯 方向フィルター</div>
        <div class="dpad-grid">
          {#each dpadButtons as dp}
            {@const count = allActions.filter((act) => driverController.extractDirectionCode(act) === dp.id).length}
            {@const isActive = selectedDir === dp.id}
            <button
              on:click={() => (selectedDir = dp.id)}
              class="dpad-btn"
              class:active={isActive}
              class:has-count={count > 0}
            >
              <span class="dpad-icon">{dp.icon}</span>
              <span class="dpad-label">{dp.label}</span>
              {#if count > 0}
                <span class="dpad-badge">{count}</span>
              {/if}
            </button>
          {/each}
        </div>
        <button
          on:click={() => (selectedDir = 'ALL')}
          class="btn-all-filter"
          class:active={selectedDir === 'ALL'}
        >
          全表示 (ALL)
        </button>
      </div>

      <!-- 右側: 🔍 7x7 ズームカメラ -->
      <div class="zoom-camera-card">
        <div class="card-subtitle">🔍 7x7 ダンジョンズームカメラ</div>

        <div class="zoom-grid">
          {#each zoomTiles as tile}
            {@const isSelected = selectedAreaTile?.x === tile.x && selectedAreaTile?.y === tile.y}
            {@const spriteStyleStr = tile.glyphId >= 0 ? getStyleStr(tile.glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 22 }) : ''}

            <div
              class="zoom-cell"
              class:player-cell={tile.isPlayer}
              class:selected-cell={isSelected}
              on:click={() => handleSelectZoomTile(tile)}
              on:mouseenter={() => (hoveredAreaTile = tile)}
              on:mouseleave={() => (hoveredAreaTile = null)}
              title="{tile.nameJa} ({tile.x}, {tile.y})"
            >
              {#if tile.glyphId >= 0}
                <div class="zoom-sprite" style={spriteStyleStr} />
              {:else}
                <span class="zoom-symbol">{tile.symbol}</span>
              {/if}
            </div>
          {/each}
        </div>

        <div class="zoom-info-text">
          {activeTileInfo}
        </div>
      </div>
    </div>

    <!-- アクションボタンリスト -->
    {#if filteredActions.length > 0}
      <div class="gkl-actions-grid">
        {#each filteredActions as act}
          {@const labelText = safeText(act.labelJa || act.label || act.actionLabelJa)}
          {@const keyText = safeText(act.key || act.verbKey || act.charStr)}
          {@const dirCode = driverController.extractDirectionCode(act)}
          <button
            on:click={() => handleExecuteAction(act)}
            class="btn {getActionClass(act)}"
            title={safeText(act.description || act.label)}
          >
            {#if keyText}
              <span class="gkl-key">[{keyText}]</span>
            {/if}
            <span>{labelText}</span>
            {#if dirCode !== 'NONE'}
              <span class="gkl-dir-badge">({dirCode})</span>
            {/if}
          </button>
        {/each}
      </div>
    {:else}
      <div class="gkl-empty">
        <span>{selectedDir === 'ALL' ? '待機中 (周りに特殊対象なし / 移動可能)' : `${currentFilterLabel} 方向に推奨アクションはありません`}</span>
      </div>
    {/if}
  </div>

  <!-- 4. 💡 構造化ナレッジカード -->
  {#if activeKnowledge}
    {@const dangerBadge = getDangerBadgeInfo(activeKnowledge.dangerLevel)}
    {@const adviceList = activeKnowledge.tacticalAdvice || activeKnowledge.usageAdvice || []}
    <div class="gkl-knowledge-detail">
      <div class="detail-header">
        <span class="detail-name">
          {safeText(activeKnowledge.nameJa)}
          {#if activeKnowledge.nameEn || activeKnowledge.name}
            <span class="detail-subname">
              ({safeText(activeKnowledge.nameEn || activeKnowledge.name)})
            </span>
          {/if}
        </span>
        <div class="detail-header-right">
          {#if dangerBadge}
            <span class="danger-level-badge" style="color: {dangerBadge.color}; background: {dangerBadge.bg}; border: 1px solid {dangerBadge.border}">
              {dangerBadge.label}
            </span>
          {/if}
          <span class="detail-cat">{getItemCategoryLabel(activeKnowledge.category || activeKnowledge.type)}</span>
        </div>
      </div>

      <div class="detail-body">
        <!-- 武器・防具・モンスター・アイテムステータスグリッド -->
        {#if activeKnowledge.stats}
          <div class="monster-stats-grid">
            <!-- モンスター用 -->
            {#if activeKnowledge.stats.hd !== undefined}<span class="stat-pill">HD: <strong>{activeKnowledge.stats.hd}</strong></span>{/if}
            {#if activeKnowledge.stats.ac !== undefined && (activeKnowledge.category === 'MONSTER' || activeKnowledge.type === 'MONSTER')}<span class="stat-pill">AC: <strong>{activeKnowledge.stats.ac}</strong></span>{/if}
            {#if activeKnowledge.stats.speed !== undefined}<span class="stat-pill">Speed: <strong>{activeKnowledge.stats.speed}</strong></span>{/if}
            {#if activeKnowledge.stats.mr !== undefined}<span class="stat-pill">MR: <strong>{activeKnowledge.stats.mr}</strong></span>{/if}

            <!-- 武器用 -->
            {#if activeKnowledge.stats.sdam}<span class="stat-pill">対小型ダメ: <strong>{activeKnowledge.stats.sdam}</strong></span>{/if}
            {#if activeKnowledge.stats.ldam}<span class="stat-pill">対大型ダメ: <strong>{activeKnowledge.stats.ldam}</strong></span>{/if}
            {#if activeKnowledge.stats.skill}<span class="stat-pill">スキル: <strong>{activeKnowledge.stats.skill}</strong></span>{/if}
            {#if activeKnowledge.stats.hands}<span class="stat-pill">持ち手: <strong>{activeKnowledge.stats.hands}手</strong></span>{/if}

            <!-- 防具用 -->
            {#if activeKnowledge.stats.ac !== undefined && activeKnowledge.category === 'ARMOR'}<span class="stat-pill">Base AC: <strong>+{activeKnowledge.stats.ac}</strong></span>{/if}
            {#if activeKnowledge.stats.mc !== undefined}<span class="stat-pill">MC: <strong>{activeKnowledge.stats.mc}</strong></span>{/if}
            {#if activeKnowledge.stats.reflection}<span class="stat-pill stat-gold">✨ 反射 (Reflection)</span>{/if}
            {#if activeKnowledge.stats.magicResistance}<span class="stat-pill stat-cyan">🛡️ 魔耐 (MR)</span>{/if}

            <!-- 共通物理特性 -->
            {#if activeKnowledge.stats.material}<span class="stat-pill">材質: <strong>{activeKnowledge.stats.material}</strong></span>{/if}
            {#if activeKnowledge.stats.weight}<span class="stat-pill">重量: <strong>{activeKnowledge.stats.weight}</strong></span>{/if}
          </div>
        {/if}

        <!-- 💡 おすすめワンタップ操作表示 -->
        {#if activeKnowledge.actionLabelJa || activeKnowledge.defaultActionLabelJa}
          <p class="detail-text monster-detail-row" style="color: #a3be8c !important;">
            💡 <strong>おすすめ操作:</strong> {safeText(activeKnowledge.actionLabelJa || activeKnowledge.defaultActionLabelJa)}
          </p>
        {/if}

        <!-- 攻撃方法 ＆ 耐性 -->
        {#if formatAttacks(activeKnowledge.attacks)}
          <p class="detail-text monster-detail-row">
            🗡️ <strong>攻撃パターン:</strong> {formatAttacks(activeKnowledge.attacks)}
          </p>
        {/if}
        {#if formatResistances(activeKnowledge.resistances)}
          <p class="detail-text monster-detail-row">
            🛡️ <strong>固有耐性:</strong> {formatResistances(activeKnowledge.resistances)}
          </p>
        {/if}

        <!-- 効果解説 ＆ フレーバーテキスト -->
        {#if activeKnowledge.effectSummary}
          <p class="detail-text">💡 {safeText(activeKnowledge.effectSummary)}</p>
        {/if}
        {#if activeKnowledge.description || activeKnowledge.flavorNote}
          <p class="detail-text" style="opacity: 0.9;">📖 {safeText(activeKnowledge.description || activeKnowledge.flavorNote)}</p>
        {/if}

        {#if adviceList.length > 0}
          <div class="tactical-advice-box">
            <div class="advice-title">🎯 ガイド ＆ 活用アドバイス:</div>
            <ul class="advice-list">
              {#each adviceList as adv}
                <li>{adv}</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if activeCoord}
          <p class="detail-coord">
            📍 マップセル座標: ({activeCoord.x}, {activeCoord.y})
          </p>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .gkl-panel { background: #181b24; border: 1px solid #3b4252; border-radius: 6px; padding: 12px 16px; color: #e5e9f0; font-family: system-ui, sans-serif; margin-top: 8px; display: flex; flex-direction: column; gap: 12px; }
  .gkl-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2e3440; padding-bottom: 8px; }
  .gkl-header-left { display: flex; align-items: center; gap: 10px; }
  .gkl-badge { background: linear-gradient(135deg, #00e676, #00b0ff); color: #090d16; font-weight: bold; font-size: 11px; padding: 4px 8px; border-radius: 4px; }
  .btn-sync { background: #3b4252; color: #88c0d0; border: 1px solid #4c566a; padding: 3px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; }

  .gkl-inventory-section { display: flex; flex-direction: column; gap: 8px; }
  .gkl-section-title { font-size: 12px; font-weight: bold; color: #ebcb8b; display: flex; align-items: center; gap: 6px; }
  .gkl-subtext { font-size: 10px; color: #88c0d0; font-weight: normal; }
  .gkl-inventory-grid { display: flex; gap: 8px; flex-wrap: wrap; }

  .inv-item-card { background: #232834; border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; gap: 8px; cursor: pointer; position: relative; transition: all 0.15s ease-in-out; border: 1px solid #3b4252; }
  .inv-item-card:hover { background: #2e3440; }
  .equip-border-wielded { border: 2px solid #e9c46a !important; box-shadow: 0 0 6px rgba(233, 196, 106, 0.5); }
  .equip-border-offhand { border: 2px solid #4ea8de !important; box-shadow: 0 0 6px rgba(78, 168, 222, 0.5); }
  .equip-border-quivered { border: 2px solid #2a9d8f !important; box-shadow: 0 0 6px rgba(42, 157, 143, 0.5); }
  .equip-border-worn { border: 2px solid #9d4edd !important; box-shadow: 0 0 6px rgba(157, 78, 221, 0.5); }

  .inv-item-compact { display: flex; align-items: center; gap: 6px; }
  .inv-letter { font-weight: bold; color: #88c0d0; font-family: monospace; font-size: 12px; }
  .inv-glyph-icon { width: 24px; height: 24px; border-radius: 3px; flex-shrink: 0; }
  .equip-badge { font-size: 9px; font-weight: bold; padding: 1px 4px; border-radius: 3px; color: #1a1a2e; }
  .badge-wielded { background: #e9c46a; }
  .badge-offhand { background: #4ea8de; }
  .badge-quivered { background: #2a9d8f; color: #fff; }
  .badge-worn { background: #9d4edd; color: #fff; }

  .inv-floating-popover { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 6px; background: #2e3440; border: 1px solid #88c0d0; border-radius: 6px; padding: 8px 12px; z-index: 100; width: max-content; max-width: 260px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); pointer-events: none; display: flex; flex-direction: column; gap: 4px; }
  .popover-title { font-weight: bold; color: #ebcb8b; font-size: 11px; }
  .popover-action { font-size: 10px; color: #a3be8c; font-weight: bold; }
  .popover-desc { font-size: 10px; color: #e5e9f0; opacity: 0.9; }

  .gkl-main-section { display: flex; flex-direction: column; gap: 8px; }
  .gkl-section-header { display: flex; justify-content: space-between; align-items: center; }
  .gkl-filter-status { font-size: 11px; color: #88c0d0; }
  .gkl-split-container { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-start; }

  .dpad-card { min-width: 170px; background: #232834; border: 1px solid #2e3440; border-radius: 6px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
  .card-subtitle { font-size: 11px; font-weight: bold; color: #88c0d0; border-bottom: 1px solid #2e3440; padding-bottom: 4px; width: 100%; }
  .dpad-grid { display: grid; grid-template-columns: repeat(3, 46px); gap: 4px; justify-content: center; }
  .dpad-btn { background: #2e3440; color: #d8dee9; border: 1px solid #4c566a; border-radius: 4px; height: 36px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; position: relative; padding: 2px; }
  .dpad-btn.active { background: #88c0d0; color: #2e3440; border-color: #88c0d0; font-weight: bold; }
  .dpad-btn.has-count { border-color: #ebcb8b; }
  .dpad-icon { font-size: 11px; line-height: 1; }
  .dpad-label { font-size: 8px; opacity: 0.8; }
  .dpad-badge { position: absolute; top: -4px; right: -4px; background: #bf616a; color: #fff; font-size: 9px; border-radius: 50%; width: 15px; height: 15px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
  .btn-all-filter { background: #2e3440; color: #d8dee9; border: 1px solid #4c566a; border-radius: 4px; padding: 6px 12px; font-size: 11px; cursor: pointer; margin-top: 4px; }
  .btn-all-filter.active { background: #88c0d0; color: #2e3440; font-weight: bold; }

  .zoom-camera-card { background: #232834; border: 1px solid #2e3440; border-radius: 6px; padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .zoom-grid { display: grid; grid-template-columns: repeat(7, 24px); grid-template-rows: repeat(7, 24px); gap: 2px; background: #141720; padding: 4px; border-radius: 4px; border: 1px solid #3b4252; }
  .zoom-cell { width: 24px; height: 24px; background: #1e222d; border: 1px solid transparent; border-radius: 2px; display: flex; items-center: center; justify-content: center; cursor: pointer; transition: all 0.1s ease-in-out; }
  .zoom-cell.player-cell { background: #3b3626; border-color: #ebcb8b; box-shadow: 0 0 8px #ebcb8b; }
  .zoom-cell.selected-cell { background: #2e3b38; border-color: #a3be8c; }
  .zoom-sprite { width: 22px; height: 22px; border-radius: 2px; }
  .zoom-symbol { font-family: monospace; font-size: 14px; color: #d8dee9; }
  .zoom-info-text { font-size: 9px; color: #a3be8c; height: 14px; text-align: center; margin-top: 4px; }

  .gkl-actions-grid { display: flex; gap: 8px; flex-wrap: wrap; }
  .gkl-key { font-weight: bold; font-family: monospace; }
  .gkl-dir-badge { font-size: 10px; opacity: 0.8; }
  .gkl-empty { font-size: 11px; color: #4c566a; padding: 4px 0; }

  .gkl-knowledge-detail { background: #2e3440; border: 1px solid #88c0d0; border-radius: 4px; padding: 10px 14px; margin-top: 4px; }
  .detail-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 13px; color: #a3be8c; }
  .detail-subname { font-size: 11px; opacity: 0.8; }
  .detail-header-right { display: flex; align-items: center; gap: 6px; }
  .detail-cat { font-size: 10px; color: #88c0d0; }
  .detail-body { font-size: 11px; color: #e5e9f0; margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
  .detail-text { margin: 0; }
  .detail-coord { font-size: 10px; color: #d8dee9; margin: 0; opacity: 0.8; }

  .danger-level-badge { font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
  .monster-stats-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
  .stat-pill { background: #232834; border: 1px solid #4c566a; padding: 2px 6px; border-radius: 3px; font-size: 10px; color: #88c0d0; }
  .stat-pill strong { color: #ebcb8b; }
  .stat-gold { border-color: #e9c46a !important; color: #e9c46a !important; }
  .stat-cyan { border-color: #88c0d0 !important; color: #88c0d0 !important; }

  .monster-detail-row { color: #d8dee9 !important; font-size: 11px; }
  .tactical-advice-box { background: #232834; border-left: 3px solid #ebcb8b; padding: 6px 10px; border-radius: 0 4px 4px 0; margin-top: 4px; }
  .advice-title { font-weight: bold; color: #ebcb8b; font-size: 10px; }
  .advice-list { margin: 4px 0 0 16px; padding: 0; font-size: 10px; color: #e5e9f0; }
</style>
