import { classifyGlyph, ENTITY_TYPES } from "../engines/glyphClassifier.js";
import { MONSTER_KNOWLEDGE_MAP } from "../data/MONSTER_KNOWLEDGE_FULL.js";
import { LORE_MASTER } from "../lore/data/LoreMasterData.js";

/**
 * GKLEventRouter
 * WebUICore から送出される全イベントを購読・解除し、
 * 各 StateManager、Service、Coordinator へ適切にディスパッチする。
 */
export class GKLEventRouter {
    /**
     * @param {import('../GKLPlugin.js').GKLPlugin} plugin
     */
    constructor(plugin) {
        this.plugin = plugin;
        this._listeners = [];
        this.lastReceivedMessage = '';
    }

    /**
     * WebUICore へイベントリスナーをバインド
     * @param {Object} core
     */
    attach(core) {
        this._listeners = [];
        const p = this.plugin;
        const addCoreListener = (event, handler) => {
            core.on(event, handler);
            this._listeners.push({ event, handler });
        };

        // 言語変更イベントのリスン
        addCoreListener('languageChanged', ({ language }) => {
            p.setLanguage(language);
        });

        // 状況シグナル (situationSignal) 受信時のコンテキスト更新と実施シグナル (actionSignal) の導出
        addCoreListener('situationSignal', (signal) => {
            if (p.interactionContext && typeof p.interactionContext.handleSituationSignal === 'function') {
                p.interactionContext.handleSituationSignal(signal);
            }
            if (p.actionSignalResolver && typeof p.actionSignalResolver.resolve === 'function') {
                const actionSig = p.actionSignalResolver.resolve(p.interactionContext);
                if (actionSig) {
                    core.emit('actionSignal', actionSig);
                }
            }

            // 🛡️ Stage 5.4B: 耐性マネージャのメッセージマスタ駆動 O(1) 確定更新
            if (signal && signal.type === 'MESSAGE' && signal.context && p.attributeStateManager) {
                if (typeof p.attributeStateManager.processMessageContext === 'function') {
                    const updated = p.attributeStateManager.processMessageContext(signal.context);
                    if (updated) {
                        core.emit('attributesStateUpdated', p.attributeStateManager);
                    }
                }
            }

            // 🔍 Stage 5.4C: 道具識別マネージャの効果メッセージによる真名自動昇格
            if (signal && signal.type === 'MESSAGE' && signal.context && p.discoveryStateManager) {
                if (typeof p.discoveryStateManager.processDiscoveryMessage === 'function') {
                    const discovered = p.discoveryStateManager.processDiscoveryMessage(signal.context);
                    if (discovered) {
                        core.emit('discoveriesStateUpdated', p.discoveryStateManager);
                        if (p.inventoryStateManager) {
                            if (typeof p.inventoryStateManager.invalidate === 'function') {
                                p.inventoryStateManager.invalidate();
                            }
                            core.emit('inventoryStateUpdated', p.inventoryStateManager);
                        }
                    }
                }
            }
        });

        // 入力要求 (inputRequired) 受信時の即時プロンプト文脈更新と実施シグナル導出
        addCoreListener('inputRequired', async (payload) => {
            // 🎯 Phase 3 (SETTLED & SHIM SYNC) & Phase 4 (COMMIT):
            // トップレベルターン確定時（--More-- やモーダル待機中を除外）に足元情報・全フロア地形・所持品・発見状態・周辺モンスター・スキルを同期 (Stage 8.2-A, 8.3-A, 8.3-B)
            const isPoskeyContext = Boolean(payload && (payload.context === 'poskey' || payload.type === 'poskey' || payload.category === 'POSKEY' || payload.promptCategory === 'POSKEY'));
            const isSubPrompt = Boolean(
                payload && (
                    payload.isDirectionPrompt ||
                    payload.category === 'DIRECTION' ||
                    payload.inputType === 'DIRECTION' ||
                    payload.category === 'YN' ||
                    payload.category === 'MENU' ||
                    payload.category === 'TEXT' ||
                    payload.category === 'LINE'
                )
            );
            const isTopLevelSettled = Boolean(
                payload &&
                (isPoskeyContext || payload.isTopLevelTurn) &&
                !isSubPrompt &&
                !payload.isMorePrompt &&
                !(core && core.isMorePromptActive) &&
                !(core && core.isTextWindowOpen) &&
                !(core && core.isMenuOpen)
            );
            if (isTopLevelSettled) {
                const isDirectAvailable = Boolean(
                    p.wasmDirectBindingService &&
                    typeof p.wasmDirectBindingService.isAvailable === 'function' &&
                    p.wasmDirectBindingService.isAvailable()
                );

                if (isDirectAvailable) {
                    const px = p.areaStateManager ? p.areaStateManager.playerX : -1;
                    const py = p.areaStateManager ? p.areaStateManager.playerY : -1;
                    const needTerrainDump = Boolean(
                        p.areaStateManager && (
                            p.areaStateManager._needsFullTerrainDump ||
                            p.areaStateManager.justTransitionedFloor ||
                            p.areaStateManager.isFloorTransitioning
                        )
                    );

                    if (p.wasmDirectBindingService.bridge && !p.wasmDirectBindingService.hasLiveMemory) {
                        const surroundingMonsters = [];
                        if (p.areaStateManager && p.areaStateManager.grid && px >= 0 && py >= 0) {
                            for (let dy = -1; dy <= 1; dy++) {
                                for (let dx = -1; dx <= 1; dx++) {
                                    if (dx === 0 && dy === 0) continue;
                                    const tx = px + dx;
                                    const ty = py + dy;
                                    const cell = p.areaStateManager.grid[ty]?.[tx];
                                    if (cell?.top && (cell.top.type === 'MONSTER' || cell.top.type === 'PET')) {
                                        surroundingMonsters.push({ x: tx, y: ty });
                                    }
                                }
                            }
                        }

                        const isInitialSync = Boolean(
                            !p.inventoryStateManager?.isSynced ||
                            !p.inventoryStateManager?.hasCompletedInitialSync ||
                            core?.isResumingSave
                        );
                        const syncOk = await p.wasmDirectBindingService.syncFromWorkerBridge({
                            playerX: px >= 0 ? px : undefined,
                            playerY: py >= 0 ? py : undefined,
                            syncInventory: true,
                            syncPlayerProps: isInitialSync,
                            syncProfile: isInitialSync || !p.attributeStateManager?.isProfileDirectBound,
                            syncDiscoveries: true,
                            syncSkills: isInitialSync,
                            syncSpells: isInitialSync || !p.spellStateManager?.isSynced,
                            syncFloorObjects: true,
                            syncLevelTerrain: needTerrainDump,
                            surroundingMonsters,
                            protected: isInitialSync
                        });

                        // 待機中に次ターンの入力が送出され世代が無効化された場合はコミットを中断 (Sync Barrier)
                        if (!syncOk) {
                            return;
                        }
                    }

                    // 🎯 1. プレイヤーサマリー（dnumブランチ・dlevel実階層、祈り、怒り等）の最優先同期 (Stage 8.4 / SSOT)
                    // dumpLevelMap や syncPlayerFeetFloor の前に真の floorKey を確定させ、仮フロアキーへの階段誤登録を根絶する
                    let syncedSummary = null;
                    let syncedAreaInfo = null;
                    if (p.wasmDirectBindingService && typeof p.wasmDirectBindingService.getPlayerSummary === 'function') {
                        syncedSummary = p.wasmDirectBindingService.getPlayerSummary();
                        if (syncedSummary && p.areaStateManager && typeof p.areaStateManager.syncPlayerSummary === 'function') {
                            syncedAreaInfo = p.areaStateManager.syncPlayerSummary(syncedSummary);
                            if (syncedAreaInfo && syncedAreaInfo.isNewFloor && p.monsterTracker && typeof p.monsterTracker.handleDlevelChange === 'function') {
                                p.monsterTracker.handleDlevelChange(syncedAreaInfo.floorKey);
                                p.monsterVitalsTracker?.reset();
                            }
                            if (typeof p.syncDungeonOverviewOnDemand === 'function') {
                                p.syncDungeonOverviewOnDemand();
                            }
                        }
                    }
                    // GET_PLAYER_SUMMARY 未実装モック等でまだ isFloorPending が残っている場合のフォールバック確定
                    if (p.areaStateManager && p.areaStateManager.isFloorPending && typeof p.areaStateManager.setCurrentFloor === 'function') {
                        const fallbackKey = p.areaStateManager._pendingStatusFloorKey || p.areaStateManager.currentFloor;
                        p.areaStateManager.setCurrentFloor(fallbackKey, { preserveGrid: true });
                    }

                    // 🎯 2. フロア遷移・初回ターン確定時の全フロア地形・グリフ (80x21) 自動ロード (Stage 8.3-B / Hybrid)
                    if (needTerrainDump && p.areaStateManager) {
                        if (typeof p.areaStateManager.dumpLevelMap === 'function') {
                            p.areaStateManager.dumpLevelMap();
                        } else if (typeof p.areaStateManager.dumpLevelTerrain === 'function') {
                            p.areaStateManager.dumpLevelTerrain();
                        }
                    }

                    // 🎯 3. 発見・識別状態 (objects[i].oc_name_known) の同期
                    if (p.discoveryStateManager && typeof p.discoveryStateManager.syncWithLiveMemory === 'function') {
                        const discChanged = p.discoveryStateManager.syncWithLiveMemory(p.wasmDirectBindingService);
                        if (discChanged) {
                            core.emit('discoveriesStateUpdated', p.discoveryStateManager);
                        }
                    }

                    // 🎯 4. 周辺セルの真値同期 (真の床・真のモンスター平和状態を注入) (Stage 8.3-A)
                    if (p.areaStateManager && typeof p.areaStateManager.syncFromDirectBinding === 'function') {
                        p.areaStateManager.syncFromDirectBinding(1);
                    }

                    // 🎯 5. 足元の到着階段シード＆真の床を AreaStateManager へ即時反映 (Stage 8.2-B)
                    if (p.areaStateManager) {
                        if (typeof p.areaStateManager.seedArrivalStair === 'function' &&
                            p.areaStateManager.playerX > 0 && p.areaStateManager.playerY > 0) {
                            p.areaStateManager.seedArrivalStair(p.areaStateManager.playerX, p.areaStateManager.playerY);
                        }
                        if (typeof p.areaStateManager.syncPlayerFeetFloor === 'function') {
                            p.areaStateManager.syncPlayerFeetFloor();
                        }
                    }

                    // 🎯 6. モンスター足元の床アイテム同期 (Hybrid二重管理)
                    if (p.areaStateManager && typeof p.areaStateManager.syncMonstersFeetObjects === 'function') {
                        p.areaStateManager.syncMonstersFeetObjects();
                    }

                    if (p.inventoryStateManager && p.inventoryStateManager.isDirectBindingAvailable) {
                        const changed = p.inventoryStateManager.syncFromDirectBinding();
                        if (changed) {
                            core.emit('inventoryStateUpdated', p.inventoryStateManager);
                        }
                    }

                    // 🎯 7. プレイヤー真の属性・耐性 (u.uprops) の同期
                    if (p.attributeStateManager && typeof p.attributeStateManager.syncFromDirectBinding === 'function') {
                        const attrChanged = p.attributeStateManager.syncFromDirectBinding(p.wasmDirectBindingService);
                        if (attrChanged) {
                            core.emit('attributesStateUpdated', p.attributeStateManager);
                        }
                    }

                    // 🎯 8. スキル熟練度 (DUMP_SKILLS) の同期
                    if (p.skillStateManager && typeof p.skillStateManager.syncFromDirectBinding === 'function') {
                        const skillChanged = p.skillStateManager.syncFromDirectBinding(p.wasmDirectBindingService);
                        if (skillChanged) {
                            core.emit('skillsStateUpdated', p.skillStateManager);
                        }
                    }

                    // 🎯 9. 呪文リスト (DUMP_SPELL_BOOK) の同期
                    if (p.spellStateManager && typeof p.spellStateManager.syncFromDirectBinding === 'function') {
                        const spellChanged = p.spellStateManager.syncFromDirectBinding(p.wasmDirectBindingService);
                        if (spellChanged) {
                            core.emit('spellsStateUpdated', p.spellStateManager);
                        }
                    }

                    // 🎯 10. プレイヤーサマリー通知イベントの発火 (Stage 8.4)
                    if (syncedSummary) {
                        if (syncedAreaInfo && syncedAreaInfo.isNewBranch) {
                            core.emit('areaEntered', syncedAreaInfo);
                            if (p.fxCoordinator && typeof p.fxCoordinator.emitFxTrigger === 'function') {
                                p.fxCoordinator.emitFxTrigger({
                                    type: 'AREA_ENTERED',
                                    branchId: syncedAreaInfo.branchId,
                                    title: syncedAreaInfo.branchName,
                                    titleJa: syncedAreaInfo.branchNameJa,
                                    subtitle: `Level ${syncedAreaInfo.dlevel}`,
                                    theme: syncedAreaInfo.theme || 'dungeon',
                                    bannerDurationMs: 4000
                                });
                            }
                        }
                        core.emit('playerSummaryUpdated', syncedSummary);
                    }

                    // 🎯 11. モンスター HP 差分 (DAMAGE_DEALT) の導出 — C 真値スナップショット比較
                    if (p.monsterVitalsTracker) {
                        const dbs = p.wasmDirectBindingService;
                        const snapshot = dbs.dumpVisibleMonsters();
                        const events = p.monsterVitalsTracker.reconcile(snapshot, {
                            getDied: (mnum) => dbs.getMvitalsDied(mnum)
                        });
                        p.fxCoordinator.emitDamageEvents(events);
                    }
                }

                // 🎯 Phase 4 (COMMIT): 状態確定コミットと areaStateCommitted シグナルの発火 (Stage 8.3-B)
                if (p.areaStateManager) {
                    if (typeof p.areaStateManager.commitTurnState === 'function') {
                        p.areaStateManager.commitTurnState();
                    }
                    const committedArea = p.areaStateManager.getAreaState();
                    if (p.interactionContext && typeof p.interactionContext.updateFromAreaState === 'function') {
                        p.interactionContext.updateFromAreaState(committedArea);
                    }
                    core.emit('areaStateCommitted', {
                        area: committedArea,
                        turn: p.statusAccessor?.turns ?? 0,
                        currentFloor: p.areaStateManager.currentFloor
                    });
                }
            }

            if (p.interactionContext && typeof p.interactionContext.setImmediatePrompt === 'function') {
                p.interactionContext.setImmediatePrompt({
                    type: payload.type || payload.promptCategory || 'PROMPT',
                    prompt: payload.rawPrompt || payload.prompt || payload.question || ''
                });
            }
            if (p.actionSignalResolver && typeof p.actionSignalResolver.resolve === 'function') {
                const actionSig = p.actionSignalResolver.resolve(p.interactionContext);
                if (actionSig) {
                    core.emit('actionSignal', actionSig);
                }
            }
        });

        // 1. Phase 1 (ACTION): ユーザーアクション送出時の Sync Barrier 世代更新・インベントリ/魔法 dirty 化・内部ターン進行
        addCoreListener('userActionSent', ({ sequence } = {}) => {
            if (p.wasmDirectBindingService && typeof p.wasmDirectBindingService.notifyActionSent === 'function') {
                p.wasmDirectBindingService.notifyActionSent();
            }
            if (p.areaStateManager && typeof p.areaStateManager.beginTurnTransition === 'function') {
                p.areaStateManager.beginTurnTransition();
            }

            if (sequence) {
                if (p.interactionContext && typeof p.interactionContext.recordAction === 'function') {
                    p.interactionContext.recordAction(sequence[0]);
                }
                if (!p.isNonItemSequence(sequence)) {
                    if (typeof p.inventoryStateManager.invalidate === 'function') {
                        p.inventoryStateManager.invalidate();
                    } else {
                        p.inventoryStateManager.isSynced = false;
                    }
                }

                if (p.isSpellAffectingSequence(sequence)) {
                    if (p.spellStateManager && typeof p.spellStateManager.invalidate === 'function') {
                        p.spellStateManager.invalidate();
                    }
                }

                if (p.monsterTracker && p.isTurnConsumingSequence(sequence)) {
                    p.monsterTracker.advanceTurn();
                }

                // ⚔️ 近接攻撃アクション (ATTACK_HIT) の検知
                if (sequence.length === 1 && p.areaStateManager && !p._isPlayerDead) {
                    p.fxCoordinator.checkMeleeAttackFromKey(sequence[0]);
                }
            }
        });

        // 2. テキストメッセージ受信時の更新
        addCoreListener('messageText', ({ text }) => {
            if (text) {
                this.lastReceivedMessage = text;
                const px = p.areaStateManager ? p.areaStateManager.playerX : (p.statusAccessor?.x ?? 0);
                const py = p.areaStateManager ? p.areaStateManager.playerY : (p.statusAccessor?.y ?? 0);

                p.fxCoordinator.checkMessageDeathOrResurrection(text, px, py);

                if (typeof text === 'string' && text.includes('You remember this level as')) {
                    if (typeof p.syncDungeonOverviewOnDemand === 'function') {
                        p.syncDungeonOverviewOnDemand();
                    }
                }

                let killedInfo = null;
                if (p.monsterTracker && typeof p.monsterTracker.handleMessage === 'function') {
                    killedInfo = p.monsterTracker.handleMessage(text);
                }
                if (killedInfo) {
                    p.fxCoordinator.onMonsterKilled(killedInfo);
                    if (p.monsterVitalsTracker) {
                        const pos = killedInfo.lastKnownPos ?? p._lastAttackTarget ?? null;
                        p.monsterVitalsTracker.noteKillMessage({
                            x: pos?.x,
                            y: pos?.y,
                            byPlayer: /\byou (kill|destroy|defeated)\b/i.test(text)
                        });
                    }
                }
                if (typeof p.inventoryStateManager.updateFromMessage === 'function') {
                    const updated = p.inventoryStateManager.updateFromMessage(text);
                    if (updated) {
                        core.emit('inventoryStateUpdated', p.inventoryStateManager);
                    }
                }
                if (p.spellStateManager && typeof p.spellStateManager.updateFromMessage === 'function') {
                    const updated = p.spellStateManager.updateFromMessage(text);
                    if (updated) {
                        core.emit('spellsStateUpdated', p.spellStateManager);
                    }
                }
                if (p.skillStateManager && typeof p.skillStateManager.updateFromMessage === 'function') {
                    const updated = p.skillStateManager.updateFromMessage(text);
                    if (updated) {
                        core.emit('skillsStateUpdated', p.skillStateManager);
                    }
                }
                if (p.attributeStateManager && typeof p.attributeStateManager.updateFromMessage === 'function') {
                    const updated = p.attributeStateManager.updateFromMessage(text);
                    if (updated) {
                        core.emit('attributesStateUpdated', p.attributeStateManager);
                    }
                }

                // 📡 Layer 4: LORE シグナル検知 & 発行 (Pub/Sub)
                if (p.loreDetector) {
                    let anchorCandidate = null;
                    const asm = p.areaStateManager;
                    const playerX = asm ? asm.playerX : (p.statusAccessor?.x ?? -1);
                    const playerY = asm ? asm.playerY : (p.statusAccessor?.y ?? -1);
                    if (asm && playerX >= 0 && playerY >= 0) {
                        anchorCandidate = asm.getEngravingAt(playerX, playerY);
                    }

                    const loreSignal = p.loreDetector.processMessage(text, { anchorCandidate });
                    if (loreSignal && loreSignal.matched) {
                        if (!loreSignal.rawPrompt) {
                            loreSignal.rawPrompt = text;
                        }
                        core.emit('situationSignal', { type: 'LORE', signal: loreSignal });
                        core.emit('signal', loreSignal);
                        core.emit(`signal:${loreSignal.signalId}`, loreSignal);
                        core.emit('loreSignal', loreSignal);

                        if (loreSignal.signalId === 'SIGNAL_LORE_RUMOR' && loreSignal.rumorId && p.adventureLogManager) {
                            const isNew = p.adventureLogManager.unlockRumor(loreSignal.rumorId);
                            if (isNew) {
                                p._emitAdventureLogUnlocked({
                                    category: 'rumor',
                                    id: loreSignal.rumorId,
                                    text: loreSignal.text,
                                    textJa: loreSignal.translatedText,
                                    isTrue: loreSignal.isTrue
                                });
                            }
                        }

                        if (loreSignal.signalId === 'SIGNAL_LORE_ORACLE' && p.adventureLogManager) {
                            p._handleOracleUnlock(loreSignal);
                        }
                    }
                }
            }
        });

        // 2.2 テキストウィンドウ受信時の LORE (神託/噂) 検知 ＆ 冒険手帳アンロック
        const handleTextWindowContent = ({ lines, rawLines, rawText }) => {
            if (!p.loreDetector) return;
            const textToProcess = rawText || (rawLines ? rawLines.join('\n') : (lines ? lines.join('\n') : ''));
            if (!textToProcess || !textToProcess.trim()) return;

            const loreSignal = p.loreDetector.processMessage(textToProcess);
            if (loreSignal && loreSignal.matched) {
                if (!loreSignal.rawPrompt) {
                    loreSignal.rawPrompt = textToProcess;
                }
                core.emit('situationSignal', { type: 'LORE', signal: loreSignal });
                core.emit('signal', loreSignal);
                core.emit(`signal:${loreSignal.signalId}`, loreSignal);
                core.emit('loreSignal', loreSignal);

                if (loreSignal.signalId === 'SIGNAL_LORE_ORACLE' && p.adventureLogManager) {
                    p._handleOracleUnlock(loreSignal);
                }

                if (loreSignal.signalId === 'SIGNAL_LORE_RUMOR' && loreSignal.rumorId && p.adventureLogManager) {
                    const isNew = p.adventureLogManager.unlockRumor(loreSignal.rumorId);
                    if (isNew) {
                        p._emitAdventureLogUnlocked({
                            category: 'rumor',
                            id: loreSignal.rumorId,
                            text: loreSignal.text,
                            textJa: loreSignal.translatedText,
                            isTrue: loreSignal.isTrue
                        });
                    }
                }
            }
        };

        addCoreListener('textWindowContent', handleTextWindowContent);

        // 3.1. インベントリ更新時の外因性耐性 (Extrinsics) 自動再計算
        addCoreListener('inventoryStateUpdated', (invMgr) => {
            const items = invMgr ? (invMgr.items || []) : (p.inventoryStateManager ? p.inventoryStateManager.items : []);
            if (p.attributeStateManager && typeof p.attributeStateManager.updateExtrinsicsFromInventory === 'function') {
                p.attributeStateManager.updateExtrinsicsFromInventory(items);
            }
        });

        // 3.2. ゲーム開始・再開（Restore）時の Discovery バックグラウンド同期 ＆ キャッシュ管理 (DirectBinding Native)
        const triggerDiscoverySync = () => {
            const isDirect = Boolean(p.wasmDirectBindingService?.isAvailable());
            if (isDirect) {
                // Direct Binding の場合は inputRequired または DirectBinding 経由で取得されるため、マクロ送信を抑止
                if (p.discoveryStateManager && typeof p.discoveryStateManager.syncWithLiveMemory === 'function' && p.wasmDirectBindingService) {
                    const discChanged = p.discoveryStateManager.syncWithLiveMemory(p.wasmDirectBindingService);
                    if (discChanged) {
                        core.emit('discoveriesStateUpdated', p.discoveryStateManager);
                    }
                }
                return;
            }
            p.syncDiscoveriesSilent();
        };
        addCoreListener('game_ready', triggerDiscoverySync);
        addCoreListener('game_started', triggerDiscoverySync);
        addCoreListener('restore', triggerDiscoverySync);
        addCoreListener('game_restored', triggerDiscoverySync);

        const triggerDungeonOverviewSync = () => {
            if (typeof p.syncDungeonOverviewOnDemand === 'function') {
                p.syncDungeonOverviewOnDemand();
            }
        };
        addCoreListener('restore', triggerDungeonOverviewSync);
        addCoreListener('game_restored', triggerDungeonOverviewSync);

        // 新規ゲーム開始・リスタート時のキャッシュ初期化
        const handleGameReset = () => {
            p.reset();
        };
        addCoreListener('restarted', handleGameReset);

        const handlePlayerPosUpdate = (data) => {
            if (data && data.x !== undefined && data.y !== undefined) {
                if (data.x >= 0 && data.x < 80 && data.y >= 0 && data.y < 21) {
                    if (p.areaStateManager && typeof p.areaStateManager.seedInitialStair === 'function') {
                        p.areaStateManager.seedInitialStair(data.x, data.y);
                    }
                    if (p.areaStateManager && typeof p.areaStateManager.seedArrivalStair === 'function') {
                        p.areaStateManager.seedArrivalStair(data.x, data.y);
                    }
                    p.areaStateManager.updatePlayerPosition(data.x, data.y);
                    if (p.interactionContext && typeof p.interactionContext.updatePlayerPosition === 'function') {
                        p.interactionContext.updatePlayerPosition(data.x, data.y);
                    }
                }
            }
        };
        addCoreListener('curs', handlePlayerPosUpdate);
        addCoreListener('cursor', handlePlayerPosUpdate);

        // 5. ウィンドウ消去・マップリセットの同期
        addCoreListener('clear_nhwindow', (data) => {
            p._lastAttackTarget = null;
            if (data && (data.windowId === 3 || data.windowId === 2 || data.windowId === 0)) {
                if (p.areaStateManager && typeof p.areaStateManager.prepareFloorTransition === 'function') {
                    p.areaStateManager.prepareFloorTransition();
                } else if (p.areaStateManager && typeof p.areaStateManager.resetGrid === 'function') {
                    p.areaStateManager.resetGrid();
                }
                if (p.situationCache && typeof p.situationCache.invalidate === 'function') {
                    p.situationCache.invalidate();
                }
            }
        });

        addCoreListener('map_cleared', () => {
            p._lastAttackTarget = null;
            if (p.areaStateManager && typeof p.areaStateManager.prepareFloorTransition === 'function') {
                p.areaStateManager.prepareFloorTransition();
            } else if (p.areaStateManager && typeof p.areaStateManager.resetGrid === 'function') {
                p.areaStateManager.resetGrid();
            }
            if (p.situationCache && typeof p.situationCache.invalidate === 'function') {
                p.situationCache.invalidate();
            }
        });

        // 6. マップグリフ更新の同期
        addCoreListener('print_glyph', (data) => {
            if (data) {
                const gi = data.glyphInfo || data;
                const glyphId = data.glyph !== undefined ? data.glyph : -1;
                p.areaStateManager.updateGlyph(data.x, data.y, glyphId, gi, data.bkglyphInfo || null);

                // 📖 冒険手帳: モンスターLOS遭遇検知
                if (glyphId >= 0 && p.adventureLogManager) {
                    const classified = classifyGlyph(glyphId);
                    if ((classified.type === ENTITY_TYPES.MONSTER || classified.type === ENTITY_TYPES.PET) &&
                        classified.subType !== undefined && classified.subType >= 0 && classified.subType < 383 &&
                        !classified.isInvisible && !classified.isWarning) {
                        const isNew = p.adventureLogManager.unlockMonster(classified.subType);
                        if (isNew) {
                            const monData = MONSTER_KNOWLEDGE_MAP ? MONSTER_KNOWLEDGE_MAP.get(classified.subType) : null;
                            p._emitAdventureLogUnlocked({
                                category: 'monster',
                                monOffset: classified.subType,
                                id: monData?.id || `mon_${classified.subType}`,
                                name: monData?.name || `Monster #${classified.subType}`,
                                nameJa: monData?.nameJa || monData?.japaneseName || `モンスター #${classified.subType}`
                            });
                        }
                    }
                }
            }
        });

        // 7. ステータスフィールド更新の同期 (HP変動・DAMAGE_TAKEN / RECOVER_HEAL検知含む)
        addCoreListener('status_update', (data) => {
            if (data && data.field !== undefined && p.statusAccessor) {
                p.statusAccessor.updateField(data.field, data.value);

                // HP 変動検知 (BL_HP = 18, 'hp')
                if (data.field === 18 || data.field === 'hp') {
                    p.fxCoordinator.checkHpTransition(data.value);
                }

                // ターン数 (BL_TIME = 16) の同期
                if (data.field === 16 || data.field === 'time' || data.field === 'turns') {
                    const parsedTurn = typeof data.value === 'number' ? data.value : parseInt(data.value, 10);
                    if (!isNaN(parsedTurn)) {
                        if (p.monsterTracker) {
                            p.monsterTracker.advanceTurn(parsedTurn);
                        }
                        if (p.interactionContext && typeof p.interactionContext.advanceTurn === 'function') {
                            p.interactionContext.advanceTurn(parsedTurn);
                        }
                    }
                }

                // タイトル (BL_TITLE = 0), 属性 (BL_ALIGN = 7), レベル (BL_XP = 13), 経験値 (BL_EXP = 21) によるプロファイル同期
                if (data.field === 0 || data.field === 'title' || data.field === 7 || data.field === 'align' ||
                    data.field === 13 || data.field === 'xp' || data.field === 'level' || data.field === 21 || data.field === 'exp') {
                    if (p.attributeStateManager && typeof p.attributeStateManager.updateFromStatus === 'function') {
                        const st = p.statusAccessor && typeof p.statusAccessor.getStatus === 'function'
                            ? p.statusAccessor.getStatus()
                            : (data.status || { [data.field]: data.value });
                        const changed = p.attributeStateManager.updateFromStatus(st);
                        if (changed && p.core && typeof p.core.emit === 'function') {
                            p.core.emit('attributesStateUpdated', p.attributeStateManager);
                        }
                    }
                }

                // 階層 (BL_DLEVEL = 20) の同期
                if (data.field === 20 || data.field === 'dlevel') {
                    let floorKey = data.value;
                    const hasExplicitBranchData = Boolean(data.dlevelData && data.dlevelData.branch && data.dlevelData.dlevelNum);
                    if (hasExplicitBranchData) {
                        floorKey = `${data.dlevelData.branch}:${data.dlevelData.dlevelNum}`;
                    } else if (p.statusAccessor && typeof p.statusAccessor.getStatus === 'function') {
                        const st = p.statusAccessor.getStatus();
                        if (st && st.dlevel && st.dlevel.branch && st.dlevel.level) {
                            floorKey = `${st.dlevel.branch}:${st.dlevel.level}`;
                        }
                    }

                    const asm = p.areaStateManager;
                    const hasDirectConnection = Boolean(
                        p.wasmDirectBindingService &&
                        (p.wasmDirectBindingService.bridge || p.wasmDirectBindingService.hasLiveMemory)
                    );

                    if (asm && typeof asm.setCurrentFloor === 'function') {
                        if (hasDirectConnection && !hasExplicitBranchData) {
                            // DirectBinding 接続時は Cコア u.uz (dnum, dlevel) が階層の絶対真値 (SSOT)。
                            // BL_DLEVEL 文字列 ("Dlvl:N") はノームの鉱山等の分岐でも "Dlvl:N" を送出するため、
                            // フロア遷移中は pending 状態を維持して退避し、サマリー同期済みの通常ターンでも上書きしない。
                            asm._pendingStatusFloorKey = floorKey;
                            if (!asm.isFloorPending && !asm.isFloorTransitioning && !asm.playerSummary) {
                                asm.setCurrentFloor(floorKey, { preserveGrid: true });
                            }
                        } else {
                            asm.setCurrentFloor(floorKey);
                        }
                    }
                    if (p.monsterTracker && (!hasDirectConnection || hasExplicitBranchData)) {
                        p.monsterTracker.handleDlevelChange(floorKey);
                    }
                }

                // 経験レベル (level / exp: BL_XP = 13) の変動時
                if (data.field === 13 || data.field === 'level' || data.field === 'exp_level') {
                    const parsedLvl = typeof data.value === 'number' ? data.value : parseInt(data.value, 10);
                    if (!isNaN(parsedLvl) && p.attributeStateManager && typeof p.attributeStateManager.updateCharacter === 'function') {
                        p.attributeStateManager.updateCharacter({ level: parsedLvl });
                        if (p.core && typeof p.core.emit === 'function') {
                            p.core.emit('attributesStateUpdated', p.attributeStateManager);
                        }
                    }
                    if (p.spellStateManager && typeof p.spellStateManager.invalidate === 'function') {
                        p.spellStateManager.invalidate();
                    }
                    if (p.skillStateManager && typeof p.skillStateManager.invalidate === 'function') {
                        p.skillStateManager.invalidate();
                    }
                }

                // AC (アーマークラス: BL_AC = 14) の変動検知
                if (data.field === 14 || data.field === 'ac') {
                    if (p.fxCoordinator.checkAcTransition(data.value)) {
                        if (p.inventoryStateManager && typeof p.inventoryStateManager.invalidate === 'function') {
                            p.inventoryStateManager.invalidate();
                        }
                    }
                }
            }
        });

        // 📡 LORE シグナル購読 & Codex 自動同期
        addCoreListener('signal:SIGNAL_LORE_RUMOR', (sig) => {
            if (p.loreCodex && typeof p.loreCodex.addRumor === 'function' && sig) {
                p.loreCodex.addRumor({
                    id: sig.rumorId || sig.id,
                    text: sig.text,
                    translatedText: sig.translatedText,
                    isTrue: sig.isTrue,
                    source: sig.source
                });
            }
        });

        addCoreListener('signal:SIGNAL_LORE_ORACLE', (sig) => {
            if (p.loreCodex && sig) {
                const oracles = Array.isArray(sig.detectedOracles) && sig.detectedOracles.length > 0
                    ? sig.detectedOracles
                    : (sig.oracleId ? [sig] : []);

                if (typeof p.loreCodex.addOracles === 'function' && oracles.length > 1) {
                    p.loreCodex.addOracles(oracles);
                } else if (typeof p.loreCodex.addOracle === 'function') {
                    for (const orc of oracles) {
                        p.loreCodex.addOracle({
                            id: orc.id || orc.oracleId,
                            title: orc.title,
                            text: orc.text,
                            translatedText: orc.translatedText,
                            isSpecial: orc.isSpecial || sig.isSpecial
                        });
                    }
                }
            }
        });

        addCoreListener('signal:SIGNAL_LORE_ENGRAVE', (sig) => {
            p._handleEngraveSignal(sig);
        });
    }

    /**
     * WebUICore からリスナーを解除
     * @param {Object} core
     */
    detach(core) {
        const targetCore = core || this.plugin?.core;
        if (targetCore && Array.isArray(this._listeners) && typeof targetCore.off === 'function') {
            for (const { event, handler } of this._listeners) {
                targetCore.off(event, handler);
            }
        }
        this._listeners = [];
    }

    /**
     * 神託（Oracle）アンロックの一括/安全ハンドリング
     * @param {Object} loreSignal
     */
    handleOracleUnlock(loreSignal) {
        const p = this.plugin;
        if (!loreSignal || !p.adventureLogManager) return;

        const isBulk = Boolean(loreSignal.isBulk || loreSignal.isMajorConsultation || (Array.isArray(loreSignal.detectedOracles) && loreSignal.detectedOracles.length > 1));

        if (isBulk) {
            const res = typeof p.adventureLogManager.unlockAllOracles === 'function'
                ? p.adventureLogManager.unlockAllOracles(null)
                : { count: 0, isNew: false };

            if (p.loreCodex && typeof p.loreCodex.addOracles === 'function' && LORE_MASTER?.oracles) {
                p.loreCodex.addOracles(LORE_MASTER.oracles);
            }

            if (res.isNew) {
                p._emitAdventureLogUnlocked({
                    category: 'oracle',
                    isBulk: true,
                    count: res.count,
                    id: 'oracle_all',
                    title: 'The Great Oracle',
                    titleJa: '神託所の大預言',
                    text: 'The Oracle has revealed prophecies of the dungeon.',
                    textJa: 'オラクルはダンジョンの大予言を告げた。'
                });
            }
        } else {
            const oracleId = loreSignal.oracleId || (loreSignal.detectedOracles?.[0]?.id);
            if (oracleId) {
                const isNew = p.adventureLogManager.unlockOracle(oracleId);
                if (isNew) {
                    const orc = loreSignal.detectedOracles?.[0] || loreSignal;
                    p._emitAdventureLogUnlocked({
                        category: 'oracle',
                        id: oracleId,
                        title: orc.title || 'Oracle Prophecy',
                        text: orc.text || '',
                        textJa: orc.translatedText || orc.textJa || ''
                    });
                }
            }
        }
    }

    /**
     * 床文字 (SIGNAL_LORE_ENGRAVE) シグナル処理
     * @param {Object} loreSignal
     */
    handleEngraveSignal(loreSignal) {
        const p = this.plugin;
        if (!loreSignal) return;

        if (p.loreCodex && typeof p.loreCodex.updateWard === 'function') {
            p.loreCodex.updateWard(loreSignal);
        }

        const asm = p.areaStateManager;
        const playerX = asm?.playerX ?? -1;
        const playerY = asm?.playerY ?? -1;

        if (asm && playerX >= 0 && playerY >= 0 && !loreSignal.isHeadstone) {
            asm.setEngravingAt(playerX, playerY, loreSignal.restored || {
                pristineText: loreSignal.pristineText,
                actualText: loreSignal.actualText,
                translation: loreSignal.restored?.translation || '',
                source: loreSignal.restored?.source || '',
                category: loreSignal.restored?.category || (loreSignal.isElbereth ? 'ELBERETH' : 'ENGRAVING'),
                subCategory: loreSignal.restored?.subCategory || '',
                isTrue: loreSignal.restored?.isTrue ?? null
            });
        }

        if (loreSignal.restored?.category === 'RUMOR' && loreSignal.restored?.pristineText) {
            const rumorData = {
                id: loreSignal.restored.id || undefined,
                text: loreSignal.restored.pristineText,
                translatedText: loreSignal.restored.translation,
                isTrue: loreSignal.restored.isTrue,
                source: 'engraving'
            };
            if (p.loreCodex && typeof p.loreCodex.addRumor === 'function') {
                p.loreCodex.addRumor(rumorData);
            }
            if (p.core && typeof p.core.emit === 'function') {
                const rumorSignal = {
                    signalId: 'SIGNAL_LORE_RUMOR',
                    subCategory: 'RUMOR',
                    matched: true,
                    rumorId: rumorData.id,
                    text: rumorData.text,
                    translatedText: rumorData.translatedText,
                    isTrue: rumorData.isTrue,
                    source: 'engraving',
                    confidence: loreSignal.confidence || 1.0,
                    rawPrompt: loreSignal.rawPrompt || ''
                };
                p.core.emit('signal:SIGNAL_LORE_RUMOR', rumorSignal);
                p.core.emit('loreSignal', rumorSignal);
            }
        }

        if (p.loreCodex && typeof p.loreCodex.addEngraving === 'function') {
            const translator = p.core?.translator;
            const translated = loreSignal.restored?.translation
                || (loreSignal.isElbereth ? 'エルベレス' : '')
                || (translator ? translator.translate(loreSignal.pristineText || loreSignal.actualText) : '');

            p.loreCodex.addEngraving({
                text: loreSignal.pristineText || loreSignal.actualText,
                actualText: loreSignal.actualText,
                translatedText: (translated !== (loreSignal.pristineText || loreSignal.actualText)) ? translated : '',
                source: loreSignal.restored?.source || (loreSignal.isHeadstone ? '墓碑銘 (Headstone)' : (loreSignal.isElbereth ? 'Elbereth (魔除けの結界文字)' : '床の落書き')),
                category: loreSignal.isHeadstone ? 'HEADSTONE' : (loreSignal.isElbereth ? 'ELBERETH' : 'ENGRAVING'),
                subCategory: loreSignal.restored?.category || '',
                isHeadstone: loreSignal.isHeadstone || false
            });
        }
    }
}
