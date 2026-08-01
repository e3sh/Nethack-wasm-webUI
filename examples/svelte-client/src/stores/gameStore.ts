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
  context: string;
  prompt: string;
  choices?: string;
  resolver: any;
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

export type EngineState = 'IDLE' | 'RUNNING' | 'SAVED' | 'GAMEOVER';

const createInitialMapGrid = (): MapTile[][] =>
  Array.from({ length: 21 }, () =>
    Array.from({ length: 80 }, () => ({ tileId: 0, symbol: ' ', color: 7 }))
  );

// Svelte Stores
export const messagesStore = writable<string[]>([]);
export const statusStore = writable<StatusState>({
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
});
export const mapGridStore = writable<MapTile[][]>(createInitialMapGrid());
export const cursorPosStore = writable<{ x: number; y: number } | null>(null);
export const activePromptStore = writable<ActivePrompt | null>(null);
export const activeMenuStore = writable<ActiveMenu | null>(null);
export const activeTextModalStore = writable<ActiveTextModal | null>(null);
export const engineStateStore = writable<EngineState>('IDLE');
export const detectedSaveNameStore = writable<string | null>(null);

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
      case 22:
        if (Array.isArray(value)) {
          newStatus.condition = value;
        } else if (typeof value === 'string') {
          newStatus.condition = value ? [value] : [];
        }
        break;
    }

    return newStatus;
  });

  if (clearMapNeeded) {
    clearMapGrid();
  }
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
