import { writable, get } from 'svelte/store';

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

export type EngineState = 'IDLE' | 'RUNNING' | 'SAVED' | 'GAMEOVER';

const createInitialMapGrid = (): MapTile[][] =>
  Array.from({ length: 21 }, () =>
    Array.from({ length: 80 }, () => ({ tileId: 0, symbol: ' ', color: 7 }))
  );

export const initialStatus: StatusState = {
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

// Svelte Stores
export const messagesStore = writable<string[]>([]);
export const statusStore = writable<StatusState>(initialStatus);
export const mapGridStore = writable<MapTile[][]>(createInitialMapGrid());
export const cursorPosStore = writable<{ x: number; y: number } | null>(null);
export const activePromptStore = writable<ActivePrompt | null>(null);
export const activeMenuStore = writable<ActiveMenu | null>(null);
export const activeTextModalStore = writable<ActiveTextModal | null>(null);
export const engineStateStore = writable<EngineState>('IDLE');
export const detectedSaveNameStore = writable<string | null>(null);
export const pendingSaveInfoStore = writable<{ hasSave: boolean; savePlayerName?: string } | null>(null);
export const isPlayerDeadStore = writable<boolean>(false);
export const gameOverResultStore = writable<any | null>(null);
export const gklSituationStore = writable<any | null>(null);
export const hoveredTileKnowledgeStore = writable<any | null>(null);
export const viewModeStore = writable<'GRAPHIC' | 'ASCII'>('GRAPHIC');
export const isZoomEnabledStore = writable<boolean>(true);
export const floorLandmarksStore = writable<any | null>(null);
export const activeWishDataStore = writable<any | null>(null);
export const activeFxEventStore = writable<VisualFxItem | null>(null);
export const screenShakeEventStore = writable<ScreenShakeEvent | null>(null);

// Actions / Helpers
export const addMessage = (text: string) => {
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

  messagesStore.update((msgs) => {
    if (msgs.length > 0 && msgs[msgs.length - 1] === trimmed) {
      return msgs;
    }
    const newMsgs = [...msgs, trimmed];
    if (newMsgs.length > 200) {
      newMsgs.shift();
    }
    return newMsgs;
  });
};

export const updateStatus = (field: number, value: any, rawPayload?: any) => {
  let clearMapNeeded = false;

  statusStore.update((st) => {
    const newStatus = { ...st };

    switch (field) {
      case 0:
        newStatus.title = String(value || '');
        break;
      case 1: // STR
        newStatus.stats = { ...newStatus.stats, str: String(value ?? '--') };
        break;
      case 2: // DEX
        newStatus.stats = { ...newStatus.stats, dex: Number(value) || 0 };
        break;
      case 3: // CON
        newStatus.stats = { ...newStatus.stats, con: Number(value) || 0 };
        break;
      case 4: // INT
        newStatus.stats = { ...newStatus.stats, int: Number(value) || 0 };
        break;
      case 5: // WIS
        newStatus.stats = { ...newStatus.stats, wis: Number(value) || 0 };
        break;
      case 6: // CHA
        newStatus.stats = { ...newStatus.stats, cha: Number(value) || 0 };
        break;
      case 7: // Align
        newStatus.align = String(value || 'Neutral');
        break;
      case 8: // Score
        newStatus.score = Number(value) || 0;
        break;
      case 10: { // Gold
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
      case 21: // Turns
        newStatus.turns = Number(value) || 0;
        break;
      case 22:
        if (Array.isArray(value)) {
          newStatus.condition = value;
        } else if (typeof value === 'string') {
          newStatus.condition = value ? [value] : [];
        }
        break;
      case 23: // Exp points
        newStatus.exp = Number(value) || 0;
        break;
      case 24: // Level
        newStatus.level = Number(value) || 1;
        break;
    }

    return newStatus;
  });

  if (clearMapNeeded) {
    clearMapGrid();
  }
};

export const triggerFx = (fx: VisualFxItem) => {
  activeFxEventStore.set({
    ...fx,
    triggerTime: performance.now(),
  });
};

export const triggerScreenShake = (intensity = 5, durationMs = 250) => {
  screenShakeEventStore.set({ intensity, durationMs });
};

export const updateTile = (x: number, y: number, tileId: number, symbol: string, color: number) => {
  if (y >= 0 && y < 21 && x >= 0 && x < 80) {
    mapGridStore.update((grid) => {
      const newRow = [...grid[y]];
      newRow[x] = { tileId, symbol, color };
      const newGrid = [...grid];
      newGrid[y] = newRow;
      return newGrid;
    });
  }
};

export const setCursorPos = (x: number, y: number) => {
  if (x >= 0 && x < 80 && y >= 0 && y < 21) {
    cursorPosStore.set({ x, y });
  }
};

export const clearMapGrid = () => {
  mapGridStore.set(createInitialMapGrid());
};

export const resetAllState = () => {
  messagesStore.set([]);
  statusStore.set({ ...initialStatus });
  cursorPosStore.set(null);
  activePromptStore.set(null);
  activeMenuStore.set(null);
  activeTextModalStore.set(null);
  engineStateStore.set('RUNNING');
  isPlayerDeadStore.set(false);
  pendingSaveInfoStore.set(null);
  gameOverResultStore.set(null);
  gklSituationStore.set(null);
  hoveredTileKnowledgeStore.set(null);
  floorLandmarksStore.set(null);
  activeWishDataStore.set(null);
  activeFxEventStore.set(null);
  screenShakeEventStore.set(null);
  clearMapGrid();
};
