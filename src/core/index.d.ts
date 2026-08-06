/**
 * TypeScript Type Definitions for @nethack/webuicore (src/core)
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
    allFields?: Record<number, any>;
}

export interface WebUICoreOptions {
    driver: any;
    renderer?: any;
    gamepadOptions?: any;
    touchOptions?: any;
    soundMode?: 'mute' | 'se' | 'all';
    translateEnabled?: boolean;
}

export class GameOverResolver {
    static resolveGameOver(driver: any, sessionInfo?: { playerName?: string; startTime?: number; birthdate?: string; version?: string }): Promise<GameOverResult>;
    static parseXlogText(rawXlogText: string, sessionInfo?: any): ScoreboardEntry | null;
    static parseRecordText(rawRecordText: string, rawXlogText?: string, sessionInfo?: any, options?: { currentVerOnly?: boolean; targetVer?: string }): ScoreboardEntry[];
    static getScoreboard(driver: any, sessionInfo?: any, options?: any): ScoreboardEntry[];
}

export class StatusAccessor {
    updateField(field: number, value: any): void;
    getStatus(): StructuredStatus;
}

export class SoundEngine {
    constructor(options?: { soundMode?: 'mute' | 'se' | 'all' });
    setSoundMode(mode: 'mute' | 'se' | 'all'): void;
    processLogMessage(messageText: string): void;
    playSound(soundKey: string): void;
}

export class TranslationEngine {
    constructor(options?: { enabled?: boolean });
    setEnabled(enabled: boolean): void;
    translate(text: string): string;
    lookupWord(word: string, pos?: string): string;
    resolveFileText(filename: string, fileText: string, FS?: any): Promise<string>;
}

export class WebUICore {
    constructor(options: WebUICoreOptions);

    driver: any;
    renderer: any;
    gamepad: any;
    touch: any;
    sound: SoundEngine;
    translator: TranslationEngine;
    statusAccessor: StatusAccessor;
    state: CoreStateType;
    currentPromptCategory: string;
    currentPromptChoices: string;
    activeResolver: any;
    activeMenuItems: any[];

    start(wasmJsUrl?: string): Promise<number>;
    restart(): Promise<number>;
    destroy(): void;
    getState(): CoreStateType;
    hasSaveData(): boolean;
    getHighScores(): ScoreboardEntry[];
    getHighScoresAsync(): Promise<ScoreboardEntry[]>;
    getStatus(): StructuredStatus;
    translate(text: string): string;
    lookupWord(word: string, pos?: string): string;
    getGlyphStyle(glyph: number, options?: any): Record<string, string>;
    getGlyphHtml(glyph: number, options?: any): string;
    on(event: string, fn: (...args: any[]) => void): void;
    emit(event: string, data?: any): void;
    setRenderer(newRenderer: any): void;
    respond(inputVal: any): void;
    sendKey(inputVal: string | number, shift?: boolean, ctrl?: boolean, alt?: boolean, rawKey?: string): void;
    handleTouchPoint(pageX: number, pageY: number, targetRect: DOMRect, scrollX?: number, scrollY?: number): void;
    resolveGameOver(): Promise<GameOverResult>;
    clearAllStorage(): Promise<boolean>;
}
