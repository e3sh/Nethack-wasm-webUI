import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';

export interface MapTile {
  tileId: number;
  symbol: string;
  color: number;
}

export interface MenuItem {
  accelerator: number;
  groupAcc?: number;
  glyph?: number;
  glyphInfo?: any;
  identifier: number;
  attr: number;
  str: string;
  presel: boolean;
  isHeader?: boolean;
  ch?: any;
}

export interface ActiveMenu {
  windowId: number;
  prompt: string;
  items: MenuItem[];
  resolver: any;
  how?: number;
}

export interface ActivePrompt {
  context?: string;
  prompt?: string;
  choices?: string;
  resolver: any;
  category?: string;
  inputType?: 'CHOICE_BUTTONS' | 'LINE_TEXT' | 'MENU' | 'DIRECTION' | 'CONFIRM' | string;
  promptText?: string;
  rawPromptText?: string;
  choicesHint?: string;
  options?: Array<{ key: string; label: string; btnClass?: string; [key: string]: any }>;
  [key: string]: any;
}

export interface ActiveTextModal {
  title?: string;
  lines: string[];
  resolver: any;
}

export const useGameStore = defineStore('game', () => {
  // 1. メッセージログ
  const messages = ref<string[]>([]);
  
  // 2. ステータス情報
  const status = reactive({
    title: '',
    gold: 0,
    pw: 0,
    pwMax: 0,
    xp: 1,
    ac: 10,
    hunger: '',
    hp: 0,
    hpMax: 0,
    dlvl: 'Dlvl:1',
    condition: [] as string[],
    stats: {
      str: '--',
      dex: 0,
      con: 0,
      int: 0,
      wis: 0,
      cha: 0,
    },
    align: 'Neutral',
    score: 0,
    turns: 0,
    exp: 0,
    level: 1,
  });

  // 3. マップバッファ (80 x 21 セル)
  const mapGrid = reactive<MapTile[][]>(
    Array.from({ length: 21 }, () =>
      Array.from({ length: 80 }, () => ({ tileId: 0, symbol: ' ', color: 7 }))
    )
  );

  // 4. マップカーソル位置 (curs イベント)
  const cursorPos = ref<{ x: number; y: number } | null>(null);

  // 5. プロンプト / 入力待ち状態
  const activePrompt = ref<ActivePrompt | null>(null);

  // 6. メニュー / インベントリ表示状態
  const activeMenu = ref<ActiveMenu | null>(null);

  // 7. テキスト・ヘルプウィンドウ表示状態
  const activeTextModal = ref<ActiveTextModal | null>(null);

  // 8. エンジン状態
  const engineState = ref<'IDLE' | 'RUNNING' | 'SAVED' | 'GAMEOVER'>('IDLE');
  const detectedSaveName = ref<string | null>(null);
  const pendingSaveInfo = ref<{ hasSave: boolean; savePlayerName?: string } | null>(null);
  const isPlayerDead = ref(false);

  // 9. ゲームオーバー・スコアボード情報
  const gameOverResult = ref<any | null>(null);

  // 10. GKL (Game Knowledge Layer) 統合状況＆推奨アクション状態
  const gklSituation = ref<any | null>(null);
  const hoveredTileKnowledge = ref<any | null>(null);

  // 11. ビュー設定 & ズームカメラ & Landmarks
  const viewMode = ref<'GRAPHIC' | 'ASCII'>('GRAPHIC');
  const isZoomEnabled = ref(true);
  const floorLandmarks = ref<any | null>(null);

  // 12. 願い（Wish）モーダル状態
  const activeWishData = ref<any | null>(null);

  // 13. Visual FX / 画面シェイク通知トリガー
  const activeFxEvent = ref<any | null>(null);
  const screenShakeEvent = ref<{ intensity: number; durationMs: number } | null>(null);

  // --- アクション ---
  function addMessage(text: string) {
    if (!text || text.trim() === '') return;
    const trimmed = text.trim();

    // C コア起動時の sysconf / システム初期化ノイズログの自動フィルタリング
    if (
      trimmed.includes('MAXPLAYERS') ||
      trimmed.includes('sysconf file') ||
      trimmed.includes('WIZARDS are set') ||
      trimmed.includes('EXPLORERS are set') ||
      trimmed.includes('DEBUGGER is set')
    ) {
      return;
    }

    if (messages.value.length > 0 && messages.value[messages.value.length - 1] === trimmed) {
      return;
    }
    messages.value.push(trimmed);
    if (messages.value.length > 200) {
      messages.value.shift();
    }
  }

  function updateStatus(field: number, value: any, rawPayload?: any) {
    // rawPayload に構造化 status オブジェクトが含まれている場合は一括マージ
    if (rawPayload?.status && typeof rawPayload.status === 'object') {
      const st = rawPayload.status;
      if (st.title) status.title = st.title;
      if (st.hp) {
        status.hp = st.hp.current !== undefined ? st.hp.current : status.hp;
        status.hpMax = st.hp.max !== undefined ? st.hp.max : status.hpMax;
      }
      if (st.pw) {
        status.pw = st.pw.current !== undefined ? st.pw.current : status.pw;
        status.pwMax = st.pw.max !== undefined ? st.pw.max : status.pwMax;
      }
      if (st.gold) {
        status.gold = typeof st.gold === 'object' ? (st.gold.amount ?? status.gold) : Number(st.gold);
      }
      if (st.ac !== undefined) status.ac = Number(st.ac);
      if (st.dlevel) status.dlvl = st.dlevel.text || `Dlvl:${st.dlevel.level || 1}`;
      if (st.hunger !== undefined) status.hunger = String(st.hunger);
      if (Array.isArray(st.conditions)) status.condition = st.conditions;
      if (st.align) status.align = String(st.align);
      if (st.score !== undefined) status.score = Number(st.score);
      if (st.turns !== undefined) status.turns = Number(st.turns);
      if (st.level !== undefined) {
        status.level = Number(st.level);
        status.xp = Number(st.level);
      }
      if (st.exp !== undefined) status.exp = Number(st.exp);
      if (st.stats) {
        status.stats.str = String(st.stats.str ?? status.stats.str);
        status.stats.dex = Number(st.stats.dex ?? status.stats.dex);
        status.stats.con = Number(st.stats.con ?? status.stats.con);
        status.stats.int = Number(st.stats.int ?? status.stats.int);
        status.stats.wis = Number(st.stats.wis ?? status.stats.wis);
        status.stats.cha = Number(st.stats.cha ?? status.stats.cha);
      }
      return;
    }

    // 個別フィールド更新
    switch (field) {
      case 0: status.title = String(value || ''); break;
      case 1: status.stats.str = String(value ?? '--'); break;
      case 2: status.stats.dex = Number(value) || 0; break;
      case 3: status.stats.con = Number(value) || 0; break;
      case 4: status.stats.int = Number(value) || 0; break;
      case 5: status.stats.wis = Number(value) || 0; break;
      case 6: status.stats.cha = Number(value) || 0; break;
      case 7: status.align = String(value || 'Neutral'); break;
      case 8: status.score = Number(value) || 0; break;
      case 9:
      case 13: {
        status.level = Number(value) || 1;
        status.xp = status.level;
        break;
      }
      case 10: { // Gold (所持金)
        if (rawPayload?.goldData && typeof rawPayload.goldData.amount === 'number') {
          status.gold = rawPayload.goldData.amount;
        } else if (typeof value === 'number') {
          status.gold = value;
        } else if (typeof value === 'string') {
          const parts = value.split(':');
          status.gold = parseInt(parts[parts.length - 1], 10) || 0;
        }
        break;
      }
      case 11: status.pw = Number(value) || 0; break;
      case 12: status.pwMax = Number(value) || 0; break;
      case 14: status.ac = Number(value) || 10; break;
      case 16: status.turns = Number(value) || 0; break;
      case 17: status.hunger = String(value || ''); break;
      case 18: status.hp = Number(value) || 0; break;
      case 19: status.hpMax = Number(value) || 0; break;
      case 20: {
        const newDlvlStr = String(value || 'Dlvl:1').trim();
        if (status.dlvl !== newDlvlStr) {
          status.dlvl = newDlvlStr;
          clearMapGrid();
        }
        break;
      }
      case 21: status.exp = Number(value) || 0; break;
      case 22:
        if (Array.isArray(value)) {
          status.condition = value;
        } else if (typeof value === 'string') {
          status.condition = value ? [value] : [];
        }
        break;
    }
  }

  function updateTile(x: number, y: number, tileId: number, symbol: string, color: number) {
    if (y >= 0 && y < 21 && x >= 0 && x < 80) {
      mapGrid[y][x] = { tileId, symbol, color };
    }
  }

  function setCursorPos(x: number, y: number) {
    if (x >= 0 && x < 80 && y >= 0 && y < 21) {
      cursorPos.value = { x, y };
    }
  }

  function clearMapGrid() {
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 80; x++) {
        mapGrid[y][x] = { tileId: 0, symbol: ' ', color: 7 };
      }
    }
  }

  function setPrompt(promptData: ActivePrompt | null) {
    activePrompt.value = promptData;
  }

  function setMenu(menuData: ActiveMenu | null) {
    activeMenu.value = menuData;
  }

  function setTextModal(textData: ActiveTextModal | null) {
    activeTextModal.value = textData;
  }

  function setEngineState(state: 'IDLE' | 'RUNNING' | 'SAVED' | 'GAMEOVER') {
    engineState.value = state;
  }

  function setDetectedSaveName(name: string | null) {
    detectedSaveName.value = name;
  }

  function setGameOverResult(result: any) {
    gameOverResult.value = result;
  }

  function setGklSituation(situation: any) {
    gklSituation.value = situation;
    if (situation?.landmarks) {
      floorLandmarks.value = situation.landmarks;
    }
    // GKL status も Pinia status にマージ
    if (situation?.status) {
      updateStatus(-1, null, { status: situation.status });
    }
  }

  function setHoveredTileKnowledge(knowledge: any) {
    hoveredTileKnowledge.value = knowledge;
  }

  function setPendingSaveInfo(info: { hasSave: boolean; savePlayerName?: string } | null) {
    pendingSaveInfo.value = info;
  }

  function setViewMode(mode: 'GRAPHIC' | 'ASCII') {
    viewMode.value = mode;
  }

  function toggleViewMode() {
    viewMode.value = viewMode.value === 'GRAPHIC' ? 'ASCII' : 'GRAPHIC';
  }

  function setIsZoomEnabled(enabled: boolean) {
    isZoomEnabled.value = enabled;
  }

  function toggleZoom() {
    isZoomEnabled.value = !isZoomEnabled.value;
  }

  function setFloorLandmarks(landmarks: any) {
    floorLandmarks.value = landmarks;
  }

  function setWishData(data: any | null) {
    activeWishData.value = data;
  }

  function triggerFx(fx: any) {
    activeFxEvent.value = { ...fx, triggerTime: performance.now() };
  }

  function triggerScreenShake(intensity = 3, durationMs = 100) {
    screenShakeEvent.value = { intensity, durationMs };
  }

  function setIsPlayerDead(dead: boolean) {
    isPlayerDead.value = dead;
  }

  function resetAllState() {
    messages.value = [];
    status.title = '';
    status.gold = 0;
    status.pw = 0;
    status.pwMax = 0;
    status.xp = 1;
    status.ac = 10;
    status.hunger = '';
    status.hp = 0;
    status.hpMax = 0;
    status.dlvl = 'Dlvl:1';
    status.condition = [];
    status.stats = { str: '--', dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    status.align = 'Neutral';
    status.score = 0;
    status.turns = 0;
    status.exp = 0;
    status.level = 1;
    cursorPos.value = null;
    activePrompt.value = null;
    activeMenu.value = null;
    activeTextModal.value = null;
    activeWishData.value = null;
    gameOverResult.value = null;
    pendingSaveInfo.value = null;
    gklSituation.value = null;
    hoveredTileKnowledge.value = null;
    floorLandmarks.value = null;
    isPlayerDead.value = false;
    engineState.value = 'RUNNING';
    clearMapGrid();
  }

  return {
    messages,
    status,
    mapGrid,
    cursorPos,
    activePrompt,
    activeMenu,
    activeTextModal,
    engineState,
    detectedSaveName,
    pendingSaveInfo,
    gameOverResult,
    gklSituation,
    hoveredTileKnowledge,
    viewMode,
    isZoomEnabled,
    floorLandmarks,
    activeWishData,
    activeFxEvent,
    screenShakeEvent,
    isPlayerDead,
    addMessage,
    updateStatus,
    updateTile,
    setCursorPos,
    clearMapGrid,
    setPrompt,
    setMenu,
    setTextModal,
    setEngineState,
    setDetectedSaveName,
    setPendingSaveInfo,
    setGameOverResult,
    setGklSituation,
    setHoveredTileKnowledge,
    setViewMode,
    toggleViewMode,
    setIsZoomEnabled,
    toggleZoom,
    setFloorLandmarks,
    setWishData,
    triggerFx,
    triggerScreenShake,
    setIsPlayerDead,
    resetAllState,
  };
});
