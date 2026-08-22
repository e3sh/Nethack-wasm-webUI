import { createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';

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

export type EngineState = 'IDLE' | 'RUNNING' | 'SAVED' | 'GAMEOVER';

const createInitialMapGrid = (): MapTile[][] =>
  Array.from({ length: 21 }, () =>
    Array.from({ length: 80 }, () => ({ tileId: 0, symbol: ' ', color: 7 }))
  );

// SolidJS Signals & Stores
export const [messages, setMessages] = createSignal<string[]>([]);
export const [status, setStatus] = createStore<StatusState>({
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
export const [mapGrid, setMapGrid] = createStore<MapTile[][]>(createInitialMapGrid());
export const [cursorPos, setCursorPos] = createSignal<{ x: number; y: number } | null>(null);
export const [activePrompt, setActivePrompt] = createSignal<ActivePrompt | null>(null);
export const [activeMenu, setActiveMenu] = createSignal<ActiveMenu | null>(null);
export const [activeTextModal, setActiveTextModal] = createSignal<ActiveTextModal | null>(null);
export const [engineState, setEngineState] = createSignal<EngineState>('IDLE');
export const [detectedSaveName, setDetectedSaveName] = createSignal<string | null>(null);
export const [pendingSaveInfo, setPendingSaveInfo] = createSignal<{ hasSave: boolean; savePlayerName?: string } | null>(null);
export const [gameOverResult, setGameOverResult] = createSignal<any | null>(null);
export const [gklSituation, setGklSituation] = createSignal<any | null>(null);
export const [hoveredTileKnowledge, setHoveredTileKnowledge] = createSignal<any | null>(null);
export const [currentLanguage, setCurrentLanguage] = createSignal<'ja' | 'en'>('ja');

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

  setMessages((prev) => {
    if (prev.length > 0 && prev[prev.length - 1] === trimmed) {
      return prev;
    }
    const newMsgs = [...prev, trimmed];
    if (newMsgs.length > 200) {
      newMsgs.shift();
    }
    return newMsgs;
  });
};

export const updateStatus = (field: number, value: any, rawPayload?: any) => {
  let clearMapNeeded = false;

  switch (field) {
    case 0:
      setStatus('title', String(value || ''));
      break;
    case 10: { // Gold
      let g = 0;
      if (rawPayload?.goldData && typeof rawPayload.goldData.amount === 'number') {
        g = rawPayload.goldData.amount;
      } else if (typeof value === 'number') {
        g = value;
      } else if (typeof value === 'string') {
        const parts = value.split(':');
        g = parseInt(parts[parts.length - 1], 10) || 0;
      }
      setStatus('gold', g);
      break;
    }
    case 11:
      setStatus('pw', Number(value) || 0);
      break;
    case 12:
      setStatus('pwMax', Number(value) || 0);
      break;
    case 13:
      setStatus('xp', Number(value) || 1);
      break;
    case 14:
      setStatus('ac', Number(value) || 10);
      break;
    case 17:
      setStatus('hunger', String(value || ''));
      break;
    case 18:
      setStatus('hp', Number(value) || 0);
      break;
    case 19:
      setStatus('hpMax', Number(value) || 0);
      break;
    case 20: {
      const newDlvlStr = String(value || 'Dlvl:1').trim();
      if (status.dlvl !== newDlvlStr) {
        setStatus('dlvl', newDlvlStr);
        clearMapNeeded = true;
      }
      break;
    }
    case 22:
      if (Array.isArray(value)) {
        setStatus('condition', value);
      } else if (typeof value === 'string') {
        setStatus('condition', value ? [value] : []);
      }
      break;
  }

  if (clearMapNeeded) {
    clearMapGrid();
  }
};

export const updateTile = (x: number, y: number, tileId: number, symbol: string, color: number) => {
  if (y >= 0 && y < 21 && x >= 0 && x < 80) {
    setMapGrid(y, x, { tileId, symbol, color });
  }
};

export const clearMapGrid = () => {
  setMapGrid(reconcile(createInitialMapGrid()));
};

export const resetAllState = () => {
  setMessages([]);
  setStatus({
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
  setCursorPos(null);
  setActivePrompt(null);
  setActiveMenu(null);
  setActiveTextModal(null);
  setEngineState('RUNNING');
  setPendingSaveInfo(null);
  setGameOverResult(null);
  setGklSituation(null);
  setHoveredTileKnowledge(null);
  clearMapGrid();
};
