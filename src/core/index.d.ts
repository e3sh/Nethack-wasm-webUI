/**
 * TypeScript Type Definitions for @nethack/webuicore (src/core)
 * 高精度・any型排除版
 */

export type CoreStateType = 
  | 'UNINITIALIZED'
  | 'INITIALIZING'
  | 'READY'
  | 'RUNNING'
  | 'WAITING_INPUT'
  | 'GAME_OVER'
  | 'EXITED'
  | 'DESTROYED';

export const CoreState: Record<CoreStateType, CoreStateType>;

export const KEYS: {
    ESC: number;
    ENTER: number;
    SPACE: number;
    BACKSPACE: number;
    TAB: number;
};

// --- Wasm Driver / Renderer 抽象インターフェース (any型排除) ---
export interface DriverLike {
    start(): Promise<number>;
    init?(targetInitParam: any, options: { args?: string[]; extraOptions?: string }): void;
    on(event: string, fn: (...args: any[]) => void): void;
    once(event: string, fn: (...args: any[]) => void): void;
    state?: string;
    fsManager?: any;
    options?: any;
    deleteAllSaveFiles?(): Promise<void>;
}

export interface RendererLike {
    init?(): void;
    clearMap?(): void;
    drawGlyph?(x: number, y: number, glyphData: any): void;
    appendMessage?(messageText: string): void;
    showPrompt?(payload: GUIInputRequiredPayload): void;
}

export interface InputResolverLike {
    respond(value: any): void;
    inputType?: string;
    cancelled?: boolean;
}

// --- 入力・設定オプション型 ---
export interface GamepadOptions {
    threshold?: number;
    keyAssign?: Record<string, any>;
}

export interface TouchOptions {
    resoX?: number;
    resoY?: number;
    dw?: number;
    dh?: number;
    touchConfig?: Record<string, any>;
}

export interface KeyMapperOptions {
    keyMode?: 'normal' | 'numpad';
}

export interface GlyphRenderOptions {
    tileImage?: string;
    tileSize?: number;
    displaySize?: number;
    tilesPerRow?: number;
}

export const KEYMAP: Record<string, Array<number | null>>;
export const GPAD_DEFAULT: Record<string, any>;
export const TOUCH_DEFAULT: Record<string, any>;

export class GamepadManager {
    constructor(options?: GamepadOptions);
    threshold: number;
    keyAssign: Record<string, any>;
    initKeyAssign(customAssign?: any): void;
    getGamepadState(): Gamepad | null;
    pollInput(context?: string, choices?: string): string[];
    getButtonOverlay(context?: string, choices?: string): { A: string; B: string; X: string; Y: string; context: string };
}

export class TouchCalculator {
    constructor(options?: TouchOptions);
    ResoX: number;
    ResoY: number;
    DW: number;
    DH: number;
    currentPage: string;
    currentContext: string;
    pointToGridId(pageX: number, pageY: number, targetRect: DOMRect, scrollX?: number, scrollY?: number): number;
    setContext(context: string): void;
    gridIdToKey(gridId: number): string | string[] | null;
}

export class KeyMapper {
    constructor(options?: KeyMapperOptions);
    eventToKeyInfo(event: KeyboardEvent): { code: string; key: string; shift: boolean; ctrl: boolean; alt: boolean };
}

// --- プロンプト ＆ ウィンドウバッファモジュール ---
export interface GUIInputOption {
    key: string;
    label: string;
    btnClass?: string;
    charStr?: string;
    accelerator?: string | number;
    identifier?: string | number;
    isSelectable?: boolean;
    direction?: string;
}

export interface GUIInputRequiredPayload {
    inputType: 'CHOICE_BUTTONS' | 'LINE_TEXT' | 'MENU' | 'DIRECTION' | 'CONFIRM';
    title: string;
    rawTitle: string;
    promptText: string;
    rawPromptText: string;
    choicesHint?: string;
    options: GUIInputOption[];
    items?: GUIInputOption[];
}

export class PromptPayloadBuilder {
    constructor(options?: { translator?: TranslationEngine });
    setTranslator(translator: TranslationEngine): void;
    build(payload: any): GUIInputRequiredPayload;
}

export interface TextWindowModalPayload {
    windowId: number;
    title: string;
    rawTitle: string;
    lines: string[];
    text: string;
}

export class TextWindowManager {
    constructor(options?: { translator?: TranslationEngine });
    setTranslator(translator: TranslationEngine): void;
    resetAll(): void;
    clearWindow(windowId: number): void;
    appendLine(windowId: number, rawText: string): void;
    hasBuffer(windowId: number): boolean;
    flushBuffer(windowId: number): TextWindowModalPayload | null;
}

// --- リザルト ＆ スコアボード ---
export interface ScoreboardEntry {
    version: string;
    points: number;
    score: number;
    deathLev: number;
    maxLvl: number;
    hp: number;
    maxHp: number;
    role: string;
    race: string;
    gender: string;
    align: string;
    name: string;
    death: string;
}

export interface GameOverResult {
    isGameOver: boolean;
    reason: 'save_and_exit' | 'died' | 'ascended' | 'escaped' | 'quit' | 'starved' | 'petrified' | 'drowned' | 'killed' | 'error' | 'unknown';
    death?: string;
    deathMessage?: string;
    translatedDeath?: string;
    translatedDeathMessage?: string;
    playerName?: string;
    savePlayerName?: string;
    role?: string;
    finalScore?: number;
    lastRecord?: ScoreboardEntry | null;
    scoreboard: ScoreboardEntry[];
    error?: string;
}

// --- ステータス ＆ ナレッジ層 (GKL) ---
export interface StructuredStatus {
    dlevel?: { text: string; num: number; branch?: string };
    hp?: { current: number; max: number };
    mana?: { current: number; max: number };
    ac?: number;
    gold?: number;
    level?: number;
    exp?: number;
    str?: number;
    dex?: number;
    con?: number;
    int?: number;
    wis?: number;
    cha?: number;
    align?: string;
    score?: number;
    time?: number;
    allFields?: Record<number, string | number | boolean>;
}

export class StatusAccessor {
    updateField(field: number, value: string | number | boolean): void;
    getStatus(): StructuredStatus;
}

export class AreaStateManager {
    constructor();
    updatePlayerPosition(x: number, y: number): void;
    updateGlyph(x: number, y: number, glyphId: number, glyphInfo?: any): void;
    resetGrid(): void;
    setKeyMode(mode: 'normal' | 'numpad'): void;
    getAreaState(): any;
}

export class InventoryStateManager {
    constructor();
    updateFromMessage(messageText: string): void;
    updateFromLines(lines: string[]): void;
    getItems(): any[];
}

export class SituationCache {
    constructor(statusAccessor: StatusAccessor, inventoryStateManager: InventoryStateManager, areaStateManager: AreaStateManager, contextActionEngine?: any);
    getSituation(): any;
    queryAction(query: any): any;
}

export class RequestController {
    constructor(driver: DriverLike);
    requestInventory(): Promise<any>;
}

export interface MonsterKnowledge {
    id: string;
    monOffset?: number;
    name: string;
    dangerLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' | 'LETHAL';
    stats: { hd: number; ac: number; speed: number; mr: number };
    attacks: Array<{ type: string; damage?: string; effect?: string }>;
    resistances: string[];
    corpseInfo?: { edible?: boolean; poisonous?: boolean; grantResist?: string; warningNote?: string };
    tacticalAdvice?: string[];
}

export interface ItemKnowledge {
    id: string;
    onum?: number;
    name: string;
    category: 'WEAPON' | 'ARMOR' | 'POTION' | 'SCROLL' | 'WAND' | 'RING' | 'AMULET' | 'TOOL' | 'FOOD' | 'GEM' | 'OTHER';
    stats?: { damageSmall?: string; damageLarge?: string; acBonus?: number; mcLevel?: number; weight?: number };
    effectSummary?: string;
    bucEffects?: { blessed?: string; uncursed?: string; cursed?: string };
    unidentifiedTips?: string[];
    usageAdvice?: string[];
}

export class StructuredKnowledgeEngine {
    constructor(options?: { translationEngine?: TranslationEngine });
    setTranslationEngine(translationEngine: TranslationEngine): void;
    getMonsterKnowledge(identifier: number | string, options?: { translate?: boolean }): MonsterKnowledge | null;
    getItemKnowledge(identifier: number | string, options?: { translate?: boolean }): ItemKnowledge | null;
}

export class GKLPlugin {
    constructor(options?: { inventoryStateManager?: InventoryStateManager; keyMode?: 'vi' | 'numpad'; structuredKnowledgeEngine?: StructuredKnowledgeEngine });
    attach(core: any): void;
    statusAccessor: StatusAccessor;
    areaStateManager: AreaStateManager;
    inventoryStateManager: InventoryStateManager;
    situationCache: SituationCache;
    structuredKnowledge: StructuredKnowledgeEngine;
}

// --- サウンド ＆ 翻訳 ---
export class SoundEngine {
    constructor(options?: { soundMode?: 'mute' | 'se' | 'all' | 'beep'; volume?: number; soundDir?: string });
    setSoundMode(mode: 'mute' | 'se' | 'all' | 'beep'): void;
    processLogMessage(messageText: string): any;
    playSound(soundKey: string): void;
}

export class TranslationEngine {
    constructor(options?: { enabled?: boolean; lookupDict?: Record<string, string>; patternDict?: any[] });
    setEnabled(enabled: boolean): void;
    translate(text: string): string;
    lookupWord(word: string, pos?: string): string;
    resolveFileText(filename: string, fileText: string, FS?: any): Promise<string>;
}

// --- デバッグ ＆ 監視インスペクター ---
export class DebugInspector {
    constructor(core: any, options?: { channelName?: string; maxLogCount?: number; autoStart?: boolean });
    startBroadcast(): void;
    stopBroadcast(): void;
    openConsoleWindow(consoleUrl?: string): Window | null;
    broadcastLog(category: string, data: any): any;
    broadcastState(): any;
}

// --- Core 本体 ---
export interface WebUICoreOptions {
    driver: DriverLike;
    renderer?: RendererLike;
    gamepadOptions?: GamepadOptions;
    touchOptions?: TouchOptions;
    keyMapperOptions?: KeyMapperOptions;
    soundMode?: 'mute' | 'se' | 'all' | 'beep';
    translateEnabled?: boolean;
    numpad?: boolean;
    number_pad?: boolean;
    forceNewGame?: boolean;
    inventoryStateManager?: InventoryStateManager;
    enableInspector?: boolean;
    inspectorOptions?: any;
}

export class WebUICore {
    constructor(options: WebUICoreOptions);

    driver: DriverLike;
    renderer: RendererLike;
    gamepad: GamepadManager;
    touch: TouchCalculator;
    keyMapper: KeyMapper;
    sound: SoundEngine;
    translator: TranslationEngine;
    gkl: GKLPlugin;
    statusAccessor: StatusAccessor;
    areaStateManager: AreaStateManager;
    inventoryStateManager: InventoryStateManager;
    situationCache: SituationCache;
    requestController: RequestController | null;
    promptPayloadBuilder: PromptPayloadBuilder;
    textWindowManager: TextWindowManager;
    inspector: DebugInspector | null;
    state: CoreStateType;
    currentPromptCategory: string;
    currentPromptChoices: string;
    activeResolver: InputResolverLike | null;
    activeMenuItems: GUIInputOption[];

    start(wasmJsUrl?: string, startOptions?: { numpad?: boolean; number_pad?: boolean; keyMode?: string; forceNewGame?: boolean }): Promise<number>;
    restart(options?: { clearStorage?: boolean; autoStart?: boolean; wasmJsUrl?: string; startOptions?: { numpad?: boolean; number_pad?: boolean; keyMode?: string; forceNewGame?: boolean } }): Promise<boolean>;
    destroy(): void;
    getState(): CoreStateType;
    hasSaveData(): boolean;
    detectSavedGameInfo(): Promise<{ hasSave: boolean; savePlayerName: string }>;
    getHighScores(): ScoreboardEntry[];
    getHighScoresAsync(): Promise<ScoreboardEntry[]>;
    getStatus(): StructuredStatus;
    translate(text: string): string;
    lookupWord(word: string, pos?: string): string;
    getGlyphStyle(glyph: number | object, options?: GlyphRenderOptions): Record<string, string> | null;
    getGlyphHtml(glyph: number | object, options?: GlyphRenderOptions): string;
    on(event: string, fn: (...args: any[]) => void): void;
    emit(event: string, data?: any): void;
    setRenderer(newRenderer: RendererLike): void;
    respond(inputVal: string | number): void;
    sendKey(inputVal: string | number, shift?: boolean, ctrl?: boolean, alt?: boolean, rawKey?: string): void;
    sendKeyEvent(event: KeyboardEvent): boolean;
    sendAction(actionName: string): boolean;
    cancelPrompt(): void;
    handleTouchPoint(pageX: number, pageY: number, targetRect: DOMRect, scrollX?: number, scrollY?: number): void;
    resolveGameOver(): Promise<GameOverResult>;
    deleteSaveData(): Promise<void>;
    deleteSaveFile(targetFilename?: string): Promise<boolean>;
    clearAllStorage(): Promise<boolean>;
}
