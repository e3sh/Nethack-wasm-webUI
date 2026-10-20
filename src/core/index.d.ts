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

// --- 演出トリガーイベント (Visual FX) ---
export type FxTriggerType = 
    | 'ATTACK_HIT' 
    | 'DAMAGE_TAKEN' 
    | 'KILL_CONFIRMED' 
    | 'RECOVER_HEAL'
    | 'PLAYER_DIED'
    | 'PLAYER_RESURRECTED';

export interface FxTriggerPayload {
    type: FxTriggerType;
    targetX?: number;
    targetY?: number;
    isPlayer?: boolean;
    amount?: number;
    currentHp?: number;
    maxHp?: number;
    text?: string;
    reason?: string;
    timestamp: number;
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
    getItems(): CanonicalItem[];
}

export class ItemNormalizer {
    static normalize(rawItem: any, options?: { source?: ItemSourceType; defaultSource?: ItemSourceType }): CanonicalItem;
    static assertCanonicalItem(item: any): boolean;
    static withCalledName(canonicalItem: CanonicalItem, newCalledName: string | null): CanonicalItem;
    static normalizeCategory(rawCategory: any, oclass?: number): ItemCategory;
    static normalizeLetter(rawItem: any): string | null;
    static normalizeBuc(rawBuc: any, flags?: any): BucStatusType;
}

export class SituationCache {
    constructor(statusAccessor: StatusAccessor, inventoryStateManager: InventoryStateManager, areaStateManager: AreaStateManager, contextActionEngine?: any);
    getSituation(): any;
    queryAction(query: any): any;
}

/**
 * 正規化アイテムカテゴリ（全レイヤー共通・大文字固定）
 */
export type ItemCategory =
  | 'WEAPON'
  | 'ARMOR'
  | 'RING'
  | 'AMULET'
  | 'TOOL'
  | 'FOOD'
  | 'POTION'
  | 'SCROLL'
  | 'SPELLBOOK'
  | 'WAND'
  | 'GOLD'
  | 'GEM'
  | 'ROCK'
  | 'BALL'
  | 'CHAIN'
  | 'VENOM'
  | 'CORPSE'
  | 'STATUE'
  | 'OTHER';

/**
 * アイテムデータの発生源（コンテキスト）
 */
export type ItemSourceType =
  | 'INVENTORY'   // プレイヤー所持品
  | 'FLOOR'       // 足元・マップ上の床落ちアイテム
  | 'CONTAINER'   // 箱・袋の中身
  | 'CODEX'       // ディスカバリー図鑑・知識カタログ
  | 'VIRTUAL';    // 検索・静的辞書参照

/**
 * BUC（祝福・呪い）ステータス
 */
export type BucStatusType = 'BLESSED' | 'UNCURSED' | 'CURSED' | 'UNKNOWN';

/**
 * 識別段階レベル
 */
export type IdentificationLevelType =
  | 'UNIDENTIFIED'      // Lv.0: 完全未識別
  | 'BUC_KNOWN'         // Lv.1: BUCのみ判明
  | 'NAMED'             // Lv.2: プレイヤー仮名付与済み
  | 'TYPE_IDENTIFIED'   // Lv.3: 種別（真名）識別済み
  | 'FULLY_IDENTIFIED'; // Lv.4: 強化値・チャージ含め完全識別済み

/**
 * 単一正規化アイテムデータモデル (Canonical Item Schema)
 */
export interface CanonicalItem {
  // --- 1. 識別子・出所 ---
  readonly _canonical: true;          // 正規化済みマーカー
  source: ItemSourceType;             // 発生源 ('INVENTORY' | 'FLOOR' | 'CONTAINER' | 'CODEX' | 'VIRTUAL')
  letter: string | null;              // インベントリレター ('a'〜'z', 'A'〜'Z', '$' 等。非所持時は null)
  identifier?: number;                // メニュー同定・Cコア項目ID用ポインタ (0 または未定義時は非同定)
  onum: number;                       // Cコアオブジェクト番号 (0〜480, 不明時は -1)
  glyphId: number;                    // 描画グリフID (不明時は -1)
  rawObjPtr: number;                  // Cコア struct obj* ポインタ (非実体時は 0)
  o_id: number;                       // Cコア固有オブジェクトID (非実体時は 0)
  corpsenm: number;                   // 死体・像・缶詰のモンスター番号 (非該当時は -1)

  // --- 2. カテゴリ・分類 ---
  category: ItemCategory;             // 正規化カテゴリ（必ず大文字。例: 'POTION', 'WEAPON'）
  oclass: number;                     // Cコア oclass 数値 (不明時は 0)

  // --- 3. 識別・命名状態（トップレベル保証） ---
  isUnidentified: boolean;            // 未鑑定かどうか（真名未判明なら必ず true）
  isDiscovered: boolean;              // 種別識別済みかどうか（!isUnidentified と一致）
  idLevel: IdentificationLevelType;   // 5段階識別レベル
  bucStatus: BucStatusType;           // 'BLESSED' | 'UNCURSED' | 'CURSED' | 'UNKNOWN'
  calledName: string | null;          // プレイヤー種別仮名 (oc_uname / called "...")
  namedInstance: string | null;       // 個別銘・アーティファクト名 (ONAME / named "...")

  // --- 4. 名称・テキスト（ASCII真値と多言語表示の分離） ---
  rawText: string;                    // 100% 英語 ASCII インベントリ表記
  name: string;                       // 現在の基準英語名（未識別時は外見名、識別済時は真名）
  nameJa: string;                     // 現在の基準日本語名
  appearanceName: string | null;      // 英語外見名 (例: "smoky potion")
  appearanceNameJa: string | null;    // 日本語外見名 (例: "煙った薬")
  trueName: string | null;            // 英語真名 (未識別かつ非透視時は null でネタバレ保護)
  trueNameJa: string | null;          // 日本語真名 (未識別かつ非透視時は null)
  displayName: string;                // 安全な表示用英語フルテキスト
  displayNameJa: string;              // 安全な表示用日本語フルテキスト

  // --- 5. 数量・スペック・装備状態 ---
  quan: number;                       // 個数 (デフォルト 1)
  count?: number;                     // 互換用個数エイリアス (quan と同値)
  spe: number | null;                 // 強化値またはチャージ数 (不明時は null)
  weight: number;                     // 重量 (不明時は 0)
  equipSlot: string | null;           // 装備中スロット ('weapon', 'suit', 'ring_left' 等。非装備時は null)
  isEquipped: boolean;                // いずれかのスロットに装備中か
  isWielded: boolean;                 // メイン武器装備中か
  isOffhand: boolean;                 // 副武器装備中か
  isQuivered: boolean;                // 矢筒セット中か
  isWorn: boolean;                    // 防具・装身具着用中か

  // --- 6. アクション・詳細構造（既存互換＆拡張） ---
  defaultVerb: string | null;         // 推奨主アクションキー ('q', 'r', 'w' 等)
  defaultSequence: string[];          // 推奨実行シーケンス (['q', 'a'] 等)
  defaultActionLabel: string | null;  // 英語アクションラベル
  defaultActionLabelJa: string | null;// 日本語アクションラベル
  alternativeActions: Array<{
    verb: string;
    sequence: string[];
    labelJa: string;
    isDefault?: boolean;
  }>;
  identification: Record<string, any>;// 詳細識別オブジェクト（トップレベル属性と完全同期）
  knowledge: Record<string, any> | null; // 静的・動的マスタ知識
  skillBadge: Record<string, any> | null;// 武器熟練度バッジ情報

  // --- 7. 付加メタデータ・フラグ ---
  cobjPtr?: number;
  ptr?: number;
  flags?: Record<string, any>;
  isAmmo?: boolean;
  isLauncher?: boolean;
  isCanOpener?: boolean;
  isTin?: boolean;
  isBox?: boolean;
  isBag?: boolean;
  isTouchstone?: boolean;
  isKey?: boolean;
  isPickAxe?: boolean;
  isAxe?: boolean;
  isDigWand?: boolean;
  isFrostWand?: boolean;
  isDigTool?: boolean;
  isGem?: boolean;
  isGold?: boolean;
  actionRecipe?: any;
  recharged?: number;
  directObject?: any;
  floorObjects?: any[];
  extraPileCount?: number;
  isPile?: boolean;
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

export interface MapseenFloorInfo {
    dnum: number;
    dlevel: number;
    branchId: string;
    branchName: string;
    branchNameJa: string;
    floorKey: string;
    features: {
        fountains: number;
        sinks: number;
        altars: number;
        altarAlign: 'none' | 'lawful' | 'neutral' | 'chaotic';
        altarAlignJa: string;
        shops: number;
        shopType: number;
        shopName: string | null;
        shopNameJa: string | null;
        thrones: number;
        temples: number;
        water: number;
        lava: number;
        ice: number;
        graves: number;
        trees: number;
    };
    flags: {
        sokoSolved: boolean;
        castle: boolean;
        oracle: boolean;
        vibratingSquare: boolean;
        bigRoom: boolean;
        notReachable: boolean;
        forgot: boolean;
        knownBones: boolean;
        castleTune: boolean;
        valley: boolean;
        sanctum: boolean;
        ludios: boolean;
        rogueLevel: boolean;
        questSummons: boolean;
        questing: boolean;
    };
    annotation: string;
}

export class StructuredKnowledgeEngine {
    constructor(options?: { translationEngine?: TranslationEngine });
    setTranslationEngine(translationEngine: TranslationEngine): void;
    getMonsterKnowledge(identifier: number | string, options?: { translate?: boolean }): MonsterKnowledge | null;
    getItemKnowledge(identifier: number | string, options?: { translate?: boolean }): ItemKnowledge | null;
}

export class GKLPlugin {
    constructor(options?: { inventoryStateManager?: InventoryStateManager; keyMode?: 'vi' | 'numpad'; structuredKnowledgeEngine?: StructuredKnowledgeEngine; language?: 'ja' | 'en' });
    attach(core: any): void;
    detach(): void;
    setLanguage(lang?: 'ja' | 'en'): void;
    reset(): void;
    invalidateAllCaches(): void;
    getSituation(): SituationData;
    executeAction(action: any, options?: any): Promise<boolean>;
    executeSequence(sequence: Array<string | number>, options?: any): Promise<boolean>;
    castSpell(letter: string | number, options?: any): Promise<boolean>;
    getMonsterTracker(): MonsterTracker;
    structuredKnowledge: StructuredKnowledgeEngine;
    situationCache: SituationCache;
    statusAccessor: StatusAccessor;
}

// --- サウンド ＆ 翻訳 ---
export class SoundCoordinator {
    constructor(options?: { soundMode?: string; volume?: number; soundDir?: string; staggerIntervalMs?: number; rules?: any[]; onLogCallback?: Function; drivers?: any });
    soundMode: string;
    volume: number;
    soundDir: string;
    staggerIntervalMs: number;
    audioQueue: any[];
    cooldownMap: Map<string, number>;
    setSoundMode(mode: string): void;
    getNormalizedSoundMode(): string;
    setVolume(vol: number): void;
    unlockAudio(): void;
    attachCore(core: any): void;
    handleFxTrigger(fx: any): any;
    processMessageContext(context: any, fallbackText?: string): any;
    processLogMessage(messageText: string): any;
    enqueueSound(ruleOrDef: any, context?: any): any;
    playSynth(synthDef: any): void;
    playBeep(beepDef: any): void;
    playAudioFile(filename: string): Promise<boolean>;
}

export class SoundEngine extends SoundCoordinator {
    constructor(options?: { soundMode?: string; volume?: number; soundDir?: string; staggerIntervalMs?: number; rules?: any[]; onLogCallback?: Function; drivers?: any });
    playSound(soundKey: string): void;
}

export class TranslationEngine {
    constructor(options?: { enabled?: boolean; lookupDict?: Record<string, string>; patternDict?: any[] });
    setEnabled(enabled: boolean): void;
    translate(text: string): string;
    lookupWord(word: string, pos?: string): string;
    resolveFileText(filename: string, fileText?: string, FS?: any): Promise<string>;
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
    interactiveController: any;
    requestController: any;
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
    getSituation(): SituationData | null;
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

export function trapFocus(container: HTMLElement | null | undefined, event: KeyboardEvent): boolean;
export function getFocusableElements(container: HTMLElement | null | undefined): HTMLElement[];

