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

  $: zoomTiles = ($cursorPosStore, $mapGridStore, driverController.getZoomAreaTiles(3)); // 7x7 (リアクティブトリガー付き)

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

  $: activeKnowledge = (hoveredItem && hoveredItem.knowledge)
    ? hoveredItem.knowledge
    : (hoveredAreaTile && hoveredAreaTile.knowledge)
      ? hoveredAreaTile.knowledge
      : (selectedAreaTile && selectedAreaTile.knowledge)
        ? selectedAreaTile.knowledge
        : ($hoveredTileKnowledgeStore && $hoveredTileKnowledgeStore.knowledge)
          ? $hoveredTileKnowledgeStore.knowledge
          : null;

  $: activeCoord = (hoveredAreaTile && hoveredAreaTile.x !== undefined && hoveredAreaTile.x >= 0)
    ? { x: hoveredAreaTile.x, y: hoveredAreaTile.y }
    : (selectedAreaTile && selectedAreaTile.x !== undefined && selectedAreaTile.x >= 0)
      ? { x: selectedAreaTile.x, y: selectedAreaTile.y }
      : ($hoveredTileKnowledgeStore && $hoveredTileKnowledgeStore.x !== undefined)
        ? { x: $hoveredTileKnowledgeStore.x, y: $hoveredTileKnowledgeStore.y }
        : null;

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

  function getGlyphStyleCss(glyphId: number): string {
    const styleObj = driverController.getGlyphStyle(glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 22 });
    if (!styleObj) return '';
    return Object.entries(styleObj).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`).join('; ');
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

  function getActionClass(act: any) {
    if (act.risk === 'danger' || act.category === 'ATTACK' || act.isDanger) return 'btn-danger';
    if (act.category === 'UNCOMMITTED' || act.category === 'ITEM') return 'btn-info';
    return 'btn-primary';
  }
</script>

<div class="gkl-panel">
  <!-- 1. ヘッダー ＆ ステータス -->
  <div class="gkl-header">
    <div class="gkl-title-box">
      <span class="gkl-badge">🧠 GKL 状況推論 ＆ ナレッジアシスト</span>
      <button on:click={handleSyncInventory} class="btn-sync" disabled={isSyncing}>
        {isSyncing ? '...同期中' : '🔄 インベントリ同期'}
      </button>
    </div>
  </div>

  <!-- 2. 所持品インベントリ（アイコン即時実行 ＋ フローティング解説ポップアップ） -->
  {#if inventoryItems.length > 0}
    <div class="gkl-section">
      <div class="section-title">
        <span>🎒 所持品ナレッジ・ガイド ({inventoryItems.length}個)</span>
        <span class="sub-hint">※ アイコンタップで即時使用・装備</span>
      </div>

      <div class="gkl-inventory-grid">
        {#each inventoryItems as item}
          <div
            class="inv-item-card {getEquipBorderClass(item)}"
            on:click|stopPropagation={() => handleOneTapItem(item)}
            on:mouseenter={() => hoveredItem = item}
            on:mouseleave={() => hoveredItem = null}
          >
            <!-- 普段の表示: レター + スプライト画像 + 装備文字バッジ -->
            <div class="inv-item-compact">
              <span class="inv-letter">[{item.letter}]</span>
              {#if item.glyphId !== undefined && item.glyphId >= 0}
                <div class="inv-glyph-icon" style={getGlyphStyleCss(item.glyphId)}></div>
              {/if}
              {#if item.isWielded}
                <span class="equip-badge badge-wielded" title="メイン武器">手</span>
              {:else if item.isOffhand}
                <span class="equip-badge badge-offhand" title="副武器">副</span>
              {:else if item.isQuivered}
                <span class="equip-badge badge-quivered" title="矢筒">筒</span>
              {:else if item.isWorn}
                <span class="equip-badge badge-worn" title="着用中">着</span>
              {/if}
            </div>

            <!-- 💡 フローティング解説ポップアップ -->
            {#if hoveredItem?.letter === item.letter}
              <div class="inv-floating-popover">
                <div class="popover-title">{safeText(item.knowledge?.nameJa || item.name || item.rawText)}</div>
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

  <!-- 3. 🧠 🎯 方向フィルター ＆ 🔍 7x7 高精細ズームカメラ -->
  <div class="gkl-section">
    <div class="section-title-row">
      <span class="section-title">🎯 アクションフィルター ＆ 🔍 7x7 ダンジョンズームカメラ</span>
      <span class="filter-status-text">表示: {currentFilterLabel}</span>
    </div>

    <div class="gkl-controls-row">
      <!-- 左側: 🎯 D-Pad 8方向操作フィルター -->
      <div class="control-box dpad-box">
        <div class="box-title">🎯 方向フィルター</div>
        <div class="dpad-grid">
          {#each dpadButtons as dp}
            {@const count = dirCounts[dp.id] || 0}
            <button
              on:click={() => selectedDir = dp.id}
              class="btn-dpad"
              class:active={selectedDir === dp.id}
              class:has-action={count > 0}
            >
              <span class="dpad-icon">{dp.icon}</span>
              <span class="dpad-label">{dp.label}</span>
              {#if count > 0}
                <span class="dpad-count-badge">{count}</span>
              {/if}
            </button>
          {/each}
        </div>
        <button
          on:click={() => selectedDir = 'ALL'}
          class="btn-dpad-all"
          class:active={selectedDir === 'ALL'}
        >
          全表示 (ALL)
        </button>
      </div>

      <!-- 右側: 🔍 7x7 洗練ズームミニマップビューア -->
      <div class="control-box zoom-box">
        <div class="box-title">🔍 7x7 ダンジョンズームカメラ</div>

        <div class="zoom-grid">
          {#each zoomTiles as tile}
            <div
              class="zoom-cell"
              class:player-cell={tile.isPlayer}
              class:selected-cell={selectedAreaTile?.x === tile.x && selectedAreaTile?.y === tile.y}
              on:click={() => handleSelectZoomTile(tile)}
              on:mouseenter={() => hoveredAreaTile = tile}
              on:mouseleave={() => hoveredAreaTile = null}
              title="{tile.nameJa} ({tile.x}, {tile.y})"
            >
              {#if tile.glyphId >= 0}
                <div class="zoom-sprite" style={getGlyphStyleCss(tile.glyphId)}></div>
              {:else}
                <span class="zoom-symbol">{tile.symbol}</span>
              {/if}
            </div>
          {/each}
        </div>

        <div class="zoom-status-bar">
          <span>{activeTileInfo}</span>
        </div>
      </div>
    </div>

    <!-- アクションボタンリスト -->
    {#if filteredActions.length > 0}
      <div class="gkl-actions">
        {#each filteredActions as act}
          {@const dirCode = driverController.extractDirectionCode(act)}
          <button
            on:click={() => handleExecuteAction(act)}
            class="gkl-btn {getActionClass(act)}"
            title={safeText(act.description || act.label)}
          >
            {#if act.key || act.verbKey || act.charStr}
              <span class="gkl-key">[{safeText(act.key || act.verbKey || act.charStr)}]</span>
            {/if}
            <span>{safeText(act.labelJa || act.label || act.actionLabelJa)}</span>
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
    <div class="gkl-knowledge-detail">
      <div class="detail-header">
        <span class="detail-name">
          {safeText(activeKnowledge.nameJa)}
          {#if activeKnowledge.nameEn || activeKnowledge.name}
            <span class="detail-subname">({safeText(activeKnowledge.nameEn || activeKnowledge.name)})</span>
          {/if}
        </span>
        <span class="detail-cat">{safeText(activeKnowledge.category || activeKnowledge.type || 'Knowledge')}</span>
      </div>
      <div class="detail-body">
        {#if activeKnowledge.effectSummary}
          <p class="detail-text">💡 {safeText(activeKnowledge.effectSummary)}</p>
        {/if}
        {#if activeKnowledge.description}
          <p class="detail-text">📖 {safeText(activeKnowledge.description)}</p>
        {/if}
        {#if activeCoord}
          <p class="detail-coord">📍 マップセル座標: ({activeCoord.x}, {activeCoord.y})</p>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .gkl-panel {
    background: #181b24;
    border: 1px solid #3b4252;
    border-radius: 6px;
    padding: 12px 16px;
    color: #e5e9f0;
    font-family: system-ui, -apple-system, sans-serif;
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .gkl-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #2e3440;
    padding-bottom: 8px;
  }
  .gkl-title-box {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .gkl-badge {
    background: linear-gradient(135deg, #00e676, #00b0ff);
    color: #090d16;
    font-weight: bold;
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 4px;
  }
  .btn-sync {
    background: #3b4252;
    color: #88c0d0;
    border: 1px solid #4c566a;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }
  .gkl-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .section-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .section-title {
    font-size: 12px;
    font-weight: bold;
    color: #ebcb8b;
  }
  .sub-hint {
    font-size: 10px;
    color: #88c0d0;
    font-weight: normal;
  }
  .filter-status-text {
    font-size: 11px;
    color: #88c0d0;
  }

  .gkl-controls-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .control-box {
    background: #232834;
    border: 1px solid #2e3440;
    border-radius: 6px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .box-title {
    font-size: 11px;
    font-weight: bold;
    color: #88c0d0;
    border-bottom: 1px solid #2e3440;
    padding-bottom: 4px;
    width: 100%;
  }

  .dpad-box {
    min-width: 170px;
  }

  .zoom-box {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .dpad-grid {
    display: grid;
    grid-template-columns: repeat(3, 46px);
    gap: 4px;
    justify-content: center;
  }

  .btn-dpad {
    background: #2e3440;
    color: #d8dee9;
    border: 1px solid #4c566a;
    border-radius: 4px;
    height: 36px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    font-size: 10px;
    padding: 2px;
  }
  .btn-dpad.active {
    background: #88c0d0;
    color: #2e3440;
    font-weight: bold;
    border-color: #88c0d0;
  }
  .btn-dpad.has-action {
    border-color: #ebcb8b;
  }
  .dpad-icon { font-size: 11px; line-height: 1; }
  .dpad-label { font-size: 8px; opacity: 0.8; }

  .dpad-count-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #bf616a;
    color: #fff;
    font-size: 9px;
    border-radius: 50%;
    width: 15px;
    height: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }

  .btn-dpad-all {
    background: #2e3440;
    color: #d8dee9;
    border: 1px solid #4c566a;
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 11px;
    cursor: pointer;
    margin-top: 4px;
  }
  .btn-dpad-all.active {
    background: #88c0d0;
    color: #2e3440;
    font-weight: bold;
  }

  .zoom-grid {
    display: grid;
    grid-template-columns: repeat(7, 24px);
    grid-template-rows: repeat(7, 24px);
    gap: 2px;
    background: #141720;
    padding: 4px;
    border-radius: 4px;
    border: 1px solid #3b4252;
  }

  .zoom-cell {
    width: 24px;
    height: 24px;
    background: #1e222d;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.1s ease-in-out;
    border: 1px solid transparent;
  }

  .zoom-cell:hover {
    border-color: #88c0d0;
    background: #2e3440;
    transform: scale(1.1);
    z-index: 10;
  }

  .zoom-cell.player-cell {
    box-shadow: 0 0 8px #ebcb8b;
    border: 1px solid #ebcb8b;
    background: #3b3626;
  }

  .zoom-cell.selected-cell {
    border-color: #a3be8c;
    background: #2e3b38;
  }

  .zoom-sprite {
    width: 22px;
    height: 22px;
    border-radius: 2px;
  }

  .zoom-symbol {
    font-family: monospace;
    font-size: 14px;
    color: #d8dee9;
  }

  .zoom-status-bar {
    font-size: 9px;
    color: #a3be8c;
    margin-top: 4px;
    height: 14px;
    text-align: center;
  }

  .gkl-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .gkl-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .btn-primary { background: #88c0d0; color: #2e3440; }
  .btn-info { background: #81a1c1; color: #2e3440; }
  .btn-danger { background: #bf616a; color: #eceff4; }
  .gkl-key { font-weight: bold; font-family: monospace; }
  .gkl-dir-badge { font-size: 10px; opacity: 0.8; }
  .gkl-empty {
    font-size: 11px;
    color: #4c566a;
    padding: 4px 0;
  }

  .gkl-inventory-grid {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .inv-item-card {
    background: #232834;
    border: 1px solid #3b4252;
    border-radius: 6px;
    padding: 6px 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
    position: relative;
  }

  .inv-item-card:hover {
    background: #2e3440;
  }

  .equip-border-wielded {
    border: 2px solid #e9c46a !important;
    box-shadow: 0 0 6px rgba(233, 196, 106, 0.5);
  }
  .equip-border-offhand {
    border: 2px solid #4ea8de !important;
    box-shadow: 0 0 6px rgba(78, 168, 222, 0.5);
  }
  .equip-border-quivered {
    border: 2px solid #2a9d8f !important;
    box-shadow: 0 0 6px rgba(42, 157, 143, 0.5);
  }
  .equip-border-worn {
    border: 2px solid #9d4edd !important;
    box-shadow: 0 0 6px rgba(157, 78, 221, 0.5);
  }

  .inv-item-compact {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .inv-letter {
    font-weight: bold;
    color: #88c0d0;
    font-family: monospace;
    font-size: 12px;
  }

  .inv-glyph-icon {
    width: 24px;
    height: 24px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .equip-badge {
    font-size: 9px;
    font-weight: bold;
    padding: 1px 4px;
    border-radius: 3px;
    color: #1a1a2e;
  }
  .badge-wielded { background: #e9c46a; }
  .badge-offhand { background: #4ea8de; }
  .badge-quivered { background: #2a9d8f; color: #fff; }
  .badge-worn { background: #9d4edd; color: #fff; }

  .inv-floating-popover {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 6px;
    background: #2e3440;
    border: 1px solid #88c0d0;
    border-radius: 6px;
    padding: 8px 12px;
    z-index: 100;
    width: max-content;
    max-width: 260px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .popover-title {
    font-weight: bold;
    color: #ebcb8b;
    font-size: 11px;
  }
  .popover-action {
    font-size: 10px;
    color: #a3be8c;
    font-weight: bold;
  }
  .popover-desc {
    font-size: 10px;
    color: #e5e9f0;
    opacity: 0.9;
  }

  .gkl-knowledge-detail {
    background: #2e3440;
    border: 1px solid #88c0d0;
    border-radius: 4px;
    padding: 10px 14px;
    margin-top: 4px;
  }
  .detail-header { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; color: #a3be8c; }
  .detail-subname { font-size: 11px; opacity: 0.8; }
  .detail-cat { font-size: 10px; color: #88c0d0; }
  .detail-body { font-size: 11px; color: #e5e9f0; margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
  .detail-text { margin: 0; }
  .detail-coord { font-size: 10px; color: #d8dee9; margin: 0; opacity: 0.8; }
</style>
