/**
 * TypeScript Type Definitions for @nethack/wasm-driver
 */

export interface PromptCategory {
    category: 'YN' | 'MENU' | 'TEXT' | 'POSKEY' | 'KEY' | 'FILE' | 'OTHER';
}

export interface InputResolverResponse<T = any> {
    (value: T): boolean;
    respond(value: T): boolean;
    cancel(): boolean;
    isResolved(): boolean;
}

export interface MenuItem {
    windowId: number;
    glyphInfo: any | null;
    glyph: number;
    identifier: number;
    accelerator: number;
    ch: number;
    gch: number;
    attr: number;
    clr: number;
    str: string;
    itemflags: number;
}

export interface DLevelData {
    raw: string;
    dlevelStr: string;
    dlevelNum: number;
    branch: string;
}

export interface GoldData {
    glyphId: number;
    amount: number;
    raw: any;
}

export interface StatusUpdateEvent {
    fld: number;
    field: number;
    value: any;
    glyphId: number | null;
    rawVal: any;
    parsedVal: any;
    goldData: GoldData | null;
    dlevelData: DLevelData | null;
    chg: number;
    clr: number;
}

export interface InputRequiredEvent {
    context: string;
    type: string;
    promptCategory: 'YN' | 'MENU' | 'TEXT' | 'POSKEY' | 'KEY' | 'FILE' | 'OTHER';
    windowId?: number;
    how?: number;
    menuItems?: MenuItem[];
    items?: MenuItem[];
    prompt?: string;
    query?: string;
    choices?: string;
    defaultChoice?: string;
    def?: string;
    resolver: InputResolverResponse;
}

export interface DriverOptions {
    autoRespondEmptyMenu?: boolean;
    deduplicateMessages?: boolean;
    filterSysconfLogs?: boolean;
    inputContextGuard?: boolean;
    unwrapPayload?: boolean;
    normalizeMenuResponse?: boolean;
    inputTimeoutMs?: number;
    module?: any;
    debug?: boolean;
}

export class InputResolver {
    constructor(options?: { timeoutMs?: number; onTimeout?: (context: string) => void; unwrapPayload?: boolean });
    createPending(context: string, extra?: Record<string, any>): { promise: Promise<any>; safeResolver: InputResolverResponse };
    respond(value: any): boolean;
    cancel(): boolean;
    stale(): boolean;
    isWaiting(): boolean;
    getContext(): Record<string, any> | null;
    static unwrapPayload<T>(value: T): T;
}

export class NetHackMemory {
    constructor(moduleRef?: any);
    setModule(moduleRef: any): void;
    parseStatusUpdate(fld: number, ptr: number, chg: number, clr: number): StatusUpdateEvent;
    parseGlyphInfo(glyph: number): any;
    buildMenuItemBuffer(items: MenuItem[]): number;
}

export class NetHackFSManager {
    constructor(options?: { debug?: boolean });
    deleteSaveFile(filename?: string): Promise<boolean>;
    listSaveFiles(): Promise<any[]>;
    hasSaveData(): boolean;
    hasSaveDataAsync(): Promise<boolean>;
    autoDetectSavePlayerName(): string | null;
    readXlogText(): string;
    readRecordText(): string;
    readXlogTextAsync(): Promise<string>;
    readRecordTextAsync(): Promise<string>;
    syncToPersistent(): Promise<boolean>;
    clearAllStorage(): Promise<boolean>;
    static readTextFromIndexedDB(targetFileName: string): Promise<string>;
    static autoDetectSavePlayerNameFromIndexedDB(): Promise<string>;
}

export class NetHackWasmDriver {
    static DriverState: {
        IDLE: 'IDLE';
        RUNNING: 'RUNNING';
        WAITING_INPUT: 'WAITING_INPUT';
        STOPPED: 'STOPPED';
    };
    static DEFAULT_EXTCMDS: string[];

    constructor(options?: DriverOptions);

    state: string;
    options: DriverOptions;
    memory: NetHackMemory;
    fsManager: NetHackFSManager;
    inputResolver: InputResolver;

    init(moduleRef?: any): void;
    on(event: string, fn: (...args: any[]) => void): this;
    once(event: string, fn: (...args: any[]) => void): this;
    off(event: string, fn: (...args: any[]) => void): this;
    emit(event: string, payload?: any): boolean;
    setState(state: string): void;
    getCurrentContext(): Record<string, any> | null;
    getPromptCategory(context: string, type: string): 'YN' | 'MENU' | 'TEXT' | 'POSKEY' | 'KEY' | 'FILE' | 'OTHER';
    listSaveFiles(): Promise<any[]>;
    deleteSaveFile(targetFilename: string): Promise<boolean>;
}

export class NetHackWasmWorkerBridge {
    static DriverState: {
        IDLE: 'IDLE';
        RUNNING: 'RUNNING';
        WAITING_INPUT: 'WAITING_INPUT';
        STOPPED: 'STOPPED';
    };

    constructor(workerUrl?: string, options?: DriverOptions);

    state: string;
    options: DriverOptions;

    on(event: string, fn: (...args: any[]) => void): this;
    once(event: string, fn: (...args: any[]) => void): this;
    off(event: string, fn: (...args: any[]) => void): this;
    emit(event: string, payload?: any): boolean;
    terminate(): void;
}

export function getTileMapping(tileId: number): { x: number; y: number; width: number; height: number };
