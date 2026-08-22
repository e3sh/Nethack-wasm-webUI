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
}

export interface GameStore {
  messages: string[];
  status: StatusState;
  mapGrid: MapTile[][];
  cursorPos: { x: number; y: number } | null;
  activePrompt: ActivePrompt | null;
  activeMenu: ActiveMenu | null;
  activeTextModal: ActiveTextModal | null;
  engineState: 'IDLE' | 'RUNNING' | 'SAVED' | 'GAMEOVER';
  detectedSaveName: string | null;
  pendingSaveInfo: { hasSave: boolean; savePlayerName?: string } | null;
  gameOverResult: any | null;
  gklSituation: any | null;
  hoveredTileKnowledge: any | null;
  currentLanguage: 'ja' | 'en';

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
  setLanguage: (lang: 'ja' | 'en') => void;
  resetAllState: () => void;
}

const createInitialMapGrid = (): MapTile[][] =>
  Array.from({ length: 21 }, () =>
    Array.from({ length: 80 }, () => ({ tileId: 0, symbol: ' ', color: 7 }))
  );

export const useGameStore = create<GameStore>((set, get) => ({
  messages: [],
  status: {
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
  },
  mapGrid: createInitialMapGrid(),
  cursorPos: null,
  activePrompt: null,
  activeMenu: null,
  activeTextModal: null,
  engineState: 'IDLE',
  detectedSaveName: null,
  gameOverResult: null,
  gklSituation: null,
  hoveredTileKnowledge: null,
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
      const newStatus = { ...state.status };
      let clearMapNeeded = false;

      switch (field) {
        case 0:
          newStatus.title = String(value || '');
          break;
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
        case 11:
          newStatus.pw = Number(value) || 0;
          break;
        case 12:
          newStatus.pwMax = Number(value) || 0;
          break;
        case 13:
          newStatus.xp = Number(value) || 1;
          break;
        case 14:
          newStatus.ac = Number(value) || 10;
          break;
        case 17:
          newStatus.hunger = String(value || '');
          break;
        case 18:
          newStatus.hp = Number(value) || 0;
          break;
        case 19:
          newStatus.hpMax = Number(value) || 0;
          break;
        case 20: {
          const newDlvlStr = String(value || 'Dlvl:1').trim();
          if (newStatus.dlvl !== newDlvlStr) {
            newStatus.dlvl = newDlvlStr;
            clearMapNeeded = true;
          }
          break;
        }
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
        // immutable update for React optimization
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

  pendingSaveInfo: null,
  setPendingSaveInfo: (info: { hasSave: boolean; savePlayerName?: string } | null) => {
    set({ pendingSaveInfo: info });
  },

  setGameOverResult: (result: any | null) => {
    set({ gameOverResult: result });
  },

  setGklSituation: (situation: any) => {
    set({ gklSituation: situation });
  },

  setHoveredTileKnowledge: (knowledge: any) => {
    set({ hoveredTileKnowledge: knowledge });
  },

  resetAllState: () => {
    set({
      messages: [],
      status: {
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
      },
      mapGrid: createInitialMapGrid(),
      cursorPos: null,
      activePrompt: null,
      activeMenu: null,
      activeTextModal: null,
      engineState: 'RUNNING',
      pendingSaveInfo: null,
      gameOverResult: null,
      gklSituation: null,
      hoveredTileKnowledge: null,
    });
  },
}));
