import { create } from 'zustand';

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

export interface StatusStats {
  str: string;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface StatusState {
  title: string;
  gold: number;
  pw: number;
  pwMax: number;
  xp: number;
  ac: number;
  hunger: string;
  hp: number;
  hpMax: number;
  dlvl: string;
  condition: string[];
  stats: StatusStats;
  align: string;
  score: number;
  turns: number;
  exp: number;
  level: number;
}

export interface VisualFxItem {
  type: 'SLASH' | 'DAMAGE_FLASH' | 'KILL_BURST' | 'HEAL_RING' | 'DEATH_BURST' | string;
  followPlayer?: boolean;
  gx?: number;
  gy?: number;
  amount?: number;
  startTime?: number;
  triggerTime?: number;
  durationMs?: number;
}

export interface ScreenShakeEvent {
  intensity: number;
  durationMs: number;
}

export interface GameStore {
  // 1. メッセージログ
  messages: string[];

  // 2. ステータス情報
  status: StatusState;

  // 3. マップバッファ (80 x 21 セル)
  mapGrid: MapTile[][];

  // 4. マップカーソル位置
  cursorPos: { x: number; y: number } | null;

  // 5. プロンプト / 入力待ち状態
  activePrompt: ActivePrompt | null;

  // 6. メニュー / インベントリ表示状態
  activeMenu: ActiveMenu | null;

  // 7. テキスト・ヘルプウィンドウ表示状態
  activeTextModal: ActiveTextModal | null;

  // 8. エンジン状態
  engineState: 'IDLE' | 'RUNNING' | 'SAVED' | 'GAMEOVER';
  detectedSaveName: string | null;
  pendingSaveInfo: { hasSave: boolean; savePlayerName?: string } | null;
  isPlayerDead: boolean;

  // 9. ゲームオーバー・スコアボード情報
  gameOverResult: any | null;

  // 10. GKL 状況推論 & ナレッジ
  gklSituation: any | null;
  hoveredTileKnowledge: any | null;

  // 11. ビュー設定 & ズームカメラ & Landmarks
  viewMode: 'GRAPHIC' | 'ASCII';
  isZoomEnabled: boolean;
  floorLandmarks: any | null;

  // 12. 願い（Wish）モーダル状態
  activeWishData: any | null;

  // 13. Visual FX / 画面シェイク通知トリガー
  activeFxEvent: VisualFxItem | null;
  screenShakeEvent: ScreenShakeEvent | null;

  // 14. 言語設定
  currentLanguage: 'ja' | 'en';

  // --- アクション ---
  addMessage: (text: string) => void;
  updateStatus: (field: number, value: any, rawPayload?: any) => void;
  updateTile: (x: number, y: number, tileId: number, symbol: string, color: number) => void;
  setCursorPos: (x: number, y: number) => void;
  clearMapGrid: () => void;
  setPrompt: (promptData: ActivePrompt | null) => void;
  setMenu: (menuData: ActiveMenu | null) => void;
  setTextModal: (textData: ActiveTextModal | null) => void;
  setEngineState: (state: 'IDLE' | 'RUNNING' | 'SAVED' | 'GAMEOVER') => void;
  setDetectedSaveName: (name: string | null) => void;
  setPendingSaveInfo: (info: { hasSave: boolean; savePlayerName?: string } | null) => void;
  setGameOverResult: (result: any | null) => void;
  setGklSituation: (situation: any) => void;
  setHoveredTileKnowledge: (knowledge: any) => void;
  setViewMode: (mode: 'GRAPHIC' | 'ASCII') => void;
  toggleViewMode: () => void;
  setIsZoomEnabled: (enabled: boolean) => void;
  toggleZoom: () => void;
  setFloorLandmarks: (landmarks: any) => void;
  setWishData: (data: any | null) => void;
  triggerFx: (fx: VisualFxItem) => void;
  triggerScreenShake: (intensity?: number, durationMs?: number) => void;
  setIsPlayerDead: (dead: boolean) => void;
  setLanguage: (lang: 'ja' | 'en') => void;
  resetAllState: () => void;
}

const createInitialMapGrid = (): MapTile[][] =>
  Array.from({ length: 21 }, () =>
    Array.from({ length: 80 }, () => ({ tileId: 0, symbol: ' ', color: 7 }))
  );

const initialStatus: StatusState = {
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
  condition: [],
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
};

export const useGameStore = create<GameStore>((set, get) => ({
  messages: [],
  status: { ...initialStatus, stats: { ...initialStatus.stats }, condition: [] },
  mapGrid: createInitialMapGrid(),
  cursorPos: null,
  activePrompt: null,
  activeMenu: null,
  activeTextModal: null,
  engineState: 'IDLE',
  detectedSaveName: null,
  pendingSaveInfo: null,
  isPlayerDead: false,
  gameOverResult: null,
  gklSituation: null,
  hoveredTileKnowledge: null,
  viewMode: 'GRAPHIC',
  isZoomEnabled: true,
  floorLandmarks: null,
  activeWishData: null,
  activeFxEvent: null,
  screenShakeEvent: null,
  currentLanguage: 'ja',

  setLanguage: (currentLanguage: 'ja' | 'en') => set({ currentLanguage }),

  addMessage: (text: string) => {
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

    set((state) => {
      if (state.messages.length > 0 && state.messages[state.messages.length - 1] === trimmed) {
        return state;
      }
      const newMessages = [...state.messages, trimmed];
      if (newMessages.length > 200) {
        newMessages.shift();
      }
      return { messages: newMessages };
    });
  },

  updateStatus: (field: number, value: any, rawPayload?: any) => {
    set((state) => {
      const newStatus = { ...state.status, stats: { ...state.status.stats } };
      let clearMapNeeded = false;

      // rawPayload に構造化 status オブジェクトが含まれている場合は一括マージ
      if (rawPayload?.status && typeof rawPayload.status === 'object') {
        const st = rawPayload.status;
        if (st.title) newStatus.title = st.title;
        if (st.hp) {
          newStatus.hp = st.hp.current !== undefined ? st.hp.current : newStatus.hp;
          newStatus.hpMax = st.hp.max !== undefined ? st.hp.max : newStatus.hpMax;
        }
        if (st.pw) {
          newStatus.pw = st.pw.current !== undefined ? st.pw.current : newStatus.pw;
          newStatus.pwMax = st.pw.max !== undefined ? st.pw.max : newStatus.pwMax;
        }
        if (st.gold) {
          newStatus.gold = typeof st.gold === 'object' ? (st.gold.amount ?? newStatus.gold) : Number(st.gold);
        }
        if (st.ac !== undefined) newStatus.ac = Number(st.ac);
        if (st.dlevel) newStatus.dlvl = st.dlevel.text || `Dlvl:${st.dlevel.level || 1}`;
        if (st.hunger !== undefined) newStatus.hunger = String(st.hunger);
        if (Array.isArray(st.conditions)) newStatus.condition = st.conditions;
        if (st.align) newStatus.align = String(st.align);
        if (st.score !== undefined) newStatus.score = Number(st.score);
        if (st.turns !== undefined) newStatus.turns = Number(st.turns);
        if (st.level !== undefined) {
          newStatus.level = Number(st.level);
          newStatus.xp = Number(st.level);
        }
        if (st.exp !== undefined) newStatus.exp = Number(st.exp);
        if (st.stats) {
          newStatus.stats.str = String(st.stats.str ?? newStatus.stats.str);
          newStatus.stats.dex = Number(st.stats.dex ?? newStatus.stats.dex);
          newStatus.stats.con = Number(st.stats.con ?? newStatus.stats.con);
          newStatus.stats.int = Number(st.stats.int ?? newStatus.stats.int);
          newStatus.stats.wis = Number(st.stats.wis ?? newStatus.stats.wis);
          newStatus.stats.cha = Number(st.stats.cha ?? newStatus.stats.cha);
        }
        return { status: newStatus };
      }

      // 個別フィールド更新
      switch (field) {
        case 0: newStatus.title = String(value || ''); break;
        case 1: newStatus.stats.str = String(value ?? '--'); break;
        case 2: newStatus.stats.dex = Number(value) || 0; break;
        case 3: newStatus.stats.con = Number(value) || 0; break;
        case 4: newStatus.stats.int = Number(value) || 0; break;
        case 5: newStatus.stats.wis = Number(value) || 0; break;
        case 6: newStatus.stats.cha = Number(value) || 0; break;
        case 7: newStatus.align = String(value || 'Neutral'); break;
        case 8: newStatus.score = Number(value) || 0; break;
        case 9:
        case 13: {
          newStatus.level = Number(value) || 1;
          newStatus.xp = newStatus.level;
          break;
        }
        case 10: { // Gold (所持金)
          if (rawPayload?.goldData && typeof rawPayload.goldData.amount === 'number') {
            newStatus.gold = rawPayload.goldData.amount;
          } else if (typeof value === 'number') {
            newStatus.gold = value;
          } else if (typeof value === 'string') {
            const parts = value.split(':');
            newStatus.gold = parseInt(parts[parts.length - 1], 10) || 0;
          }
          break;
        }
        case 11: newStatus.pw = Number(value) || 0; break;
        case 12: newStatus.pwMax = Number(value) || 0; break;
        case 14: newStatus.ac = Number(value) || 10; break;
        case 16: newStatus.turns = Number(value) || 0; break;
        case 17: newStatus.hunger = String(value || ''); break;
        case 18: newStatus.hp = Number(value) || 0; break;
        case 19: newStatus.hpMax = Number(value) || 0; break;
        case 20: {
          const newDlvlStr = String(value || 'Dlvl:1').trim();
          if (newStatus.dlvl !== newDlvlStr) {
            newStatus.dlvl = newDlvlStr;
            clearMapNeeded = true;
          }
          break;
        }
        case 21: newStatus.exp = Number(value) || 0; break;
        case 22:
          if (Array.isArray(value)) {
            newStatus.condition = value;
          } else if (typeof value === 'string') {
            newStatus.condition = value ? [value] : [];
          }
          break;
      }

      if (clearMapNeeded) {
        return {
          status: newStatus,
          mapGrid: createInitialMapGrid(),
        };
      }

      return { status: newStatus };
    });
  },

  updateTile: (x: number, y: number, tileId: number, symbol: string, color: number) => {
    if (y >= 0 && y < 21 && x >= 0 && x < 80) {
      set((state) => {
        const newMapGrid = state.mapGrid.map((row, rIdx) => {
          if (rIdx !== y) return row;
          const newRow = [...row];
          newRow[x] = { tileId, symbol, color };
          return newRow;
        });
        return { mapGrid: newMapGrid };
      });
    }
  },

  setCursorPos: (x: number, y: number) => {
    if (x >= 0 && x < 80 && y >= 0 && y < 21) {
      set({ cursorPos: { x, y } });
    }
  },

  clearMapGrid: () => {
    set({ mapGrid: createInitialMapGrid() });
  },

  setPrompt: (promptData: ActivePrompt | null) => {
    set({ activePrompt: promptData });
  },

  setMenu: (menuData: ActiveMenu | null) => {
    set({ activeMenu: menuData });
  },

  setTextModal: (textData: ActiveTextModal | null) => {
    set({ activeTextModal: textData });
  },

  setEngineState: (state: 'IDLE' | 'RUNNING' | 'SAVED' | 'GAMEOVER') => {
    set({ engineState: state });
  },

  setDetectedSaveName: (name: string | null) => {
    set({ detectedSaveName: name });
  },

  setPendingSaveInfo: (info: { hasSave: boolean; savePlayerName?: string } | null) => {
    set({ pendingSaveInfo: info });
  },

  setGameOverResult: (result: any | null) => {
    set({ gameOverResult: result });
  },

  setGklSituation: (situation: any) => {
    set((state) => {
      const updates: Partial<GameStore> = { gklSituation: situation };
      if (situation?.landmarks) {
        updates.floorLandmarks = situation.landmarks;
      }
      return updates;
    });
    // GKL status も status にマージ
    if (situation?.status) {
      get().updateStatus(-1, null, { status: situation.status });
    }
  },

  setHoveredTileKnowledge: (knowledge: any) => {
    set({ hoveredTileKnowledge: knowledge });
  },

  setViewMode: (viewMode: 'GRAPHIC' | 'ASCII') => {
    set({ viewMode });
  },

  toggleViewMode: () => {
    set((state) => ({ viewMode: state.viewMode === 'GRAPHIC' ? 'ASCII' : 'GRAPHIC' }));
  },

  setIsZoomEnabled: (isZoomEnabled: boolean) => {
    set({ isZoomEnabled });
  },

  toggleZoom: () => {
    set((state) => ({ isZoomEnabled: !state.isZoomEnabled }));
  },

  setFloorLandmarks: (floorLandmarks: any) => {
    set({ floorLandmarks });
  },

  setWishData: (activeWishData: any | null) => {
    set({ activeWishData });
  },

  triggerFx: (fx: VisualFxItem) => {
    set({ activeFxEvent: { ...fx, triggerTime: performance.now() } });
  },

  triggerScreenShake: (intensity = 3, durationMs = 100) => {
    set({ screenShakeEvent: { intensity, durationMs } });
  },

  setIsPlayerDead: (isPlayerDead: boolean) => {
    set({ isPlayerDead });
  },

  resetAllState: () => {
    set({
      messages: [],
      status: { ...initialStatus, stats: { ...initialStatus.stats }, condition: [] },
      mapGrid: createInitialMapGrid(),
      cursorPos: null,
      activePrompt: null,
      activeMenu: null,
      activeTextModal: null,
      activeWishData: null,
      gameOverResult: null,
      pendingSaveInfo: null,
      gklSituation: null,
      hoveredTileKnowledge: null,
      floorLandmarks: null,
      isPlayerDead: false,
      engineState: 'RUNNING',
    });
  },
}));
