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

  // --- アクション ---
  function addMessage(text: string) {
    if (!text || text.trim() === '') return;
    const trimmed = text.trim();
    if (messages.value.length > 0 && messages.value[messages.value.length - 1] === trimmed) {
      return;
    }
    messages.value.push(trimmed);
    if (messages.value.length > 200) {
      messages.value.shift();
    }
  }

  function updateStatus(field: number, value: any) {
    switch (field) {
      case 0: status.title = String(value || ''); break;
      case 10:
        if (typeof value === 'object' && value !== null) {
          status.gold = value.amount ?? 0;
        } else {
          status.gold = Number(value) || 0;
        }
        break;
      case 11: status.pw = Number(value) || 0; break;
      case 12: status.pwMax = Number(value) || 0; break;
      case 13: status.xp = Number(value) || 1; break;
      case 14: status.ac = Number(value) || 10; break;
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
  };
});
