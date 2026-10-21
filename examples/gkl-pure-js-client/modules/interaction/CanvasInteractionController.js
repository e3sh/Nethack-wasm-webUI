/**
 * @file CanvasInteractionController.js
 * @description GKL Pure JS Client の盤面インタラクション（2D/3D/ASCII/Zoomキャンバスのホバー・クリック・スマートコンテキスト・調査）コントローラー
 */

/**
 * 相対座標 (dx, dy) から向くべき8方向コード (N, S, E, W, NE, NW, SE, SW) を導出
 * 直近マスだけでなく、長距離クリック時も現在地からのベクトル角度を8方向に量子化
 * @param {number} dx - targetX - playerX
 * @param {number} dy - targetY - playerY
 * @returns {string|null}
 */
export function getDirectionCodeFromDelta(dx, dy) {
  if (dx === 0 && dy === 0) return null;

  // ラジアン角 (-π ~ +π) を 0 ~ 360 度に変換 (東=0°, 南=90°, 西=180°, 北=270°)
  let deg = Math.atan2(dy, dx) * (180 / Math.PI);
  if (deg < 0) deg += 360;

  // 8方向量子化 (各 45 度、境界は ±22.5 度)
  if (deg >= 337.5 || deg < 22.5) return 'E';
  if (deg >= 22.5 && deg < 67.5) return 'SE';
  if (deg >= 67.5 && deg < 112.5) return 'S';
  if (deg >= 112.5 && deg < 157.5) return 'SW';
  if (deg >= 157.5 && deg < 202.5) return 'W';
  if (deg >= 202.5 && deg < 247.5) return 'NW';
  if (deg >= 247.5 && deg < 292.5) return 'N';
  if (deg >= 292.5 && deg < 337.5) return 'NE';

  return null;
}

// 互換性用エイリアス
export const getAdjacentDirectionCode = getDirectionCodeFromDelta;

export class CanvasInteractionController {
  /**
   * @param {Object} client - GklPureJSClient インスタンス参照
   */
  constructor(client) {
    this.client = client;
    this.lastHoverTileX = -1;
    this.lastHoverTileY = -1;
  }

  /**
   * キャンバス操作共有関数 (メインキャンバス・ズームカメラ共通のホバー/クリック制御 + GKLスマート ContextActions / 自動移動)
   * @param {number} gx - グリッドX座標
   * @param {number} gy - グリッドY座標
   * @param {boolean} isHover - ホバー操作かどうか
   * @param {Object|null} clientPos - { clientX, clientY, shiftKey? }
   * @param {boolean} isForceContextMenu - 右クリック等による強制メニュー展開
   * @param {boolean} isShiftClick - Shiftキー押下による移動抑止（向き変更のみ）
   */
  async handleCanvasInspect(gx, gy, isHover, clientPos = null, isForceContextMenu = false, isShiftClick = false) {
    if (gx < 0 || gx >= 80 || gy < 0 || gy >= 24) return;
    if (isHover && gx === this.lastHoverTileX && gy === this.lastHoverTileY) {
      return;
    }
    if (isHover) {
      this.lastHoverTileX = gx;
      this.lastHoverTileY = gy;
    } else {
      this.lastHoverTileX = -1;
      this.lastHoverTileY = -1;
    }

    const client = this.client;
    let cardData = null;
    if (client.core?.gkl?.inspectCellOnDemand) {
      cardData = await client.core.gkl.inspectCellOnDemand({ x: gx, y: gy }, { isHover });
      if (cardData) {
        client.lastKnowledgeTarget = cardData;
        if (client.knowledgeView) {
          client.knowledgeView.lastKnowledgeTarget = cardData;
        }
      }
    }

    if (!isHover) {
      // 自キャラ座標の取得
      const situation = client.core?.gkl?.getSituation ? client.core.gkl.getSituation() : null;
      const px = situation?.area?.playerX ?? client.mainViewportRenderer?.targetCursorX ?? 0;
      const py = situation?.area?.playerY ?? client.mainViewportRenderer?.targetCursorY ?? 0;
      const data = cardData || client.lastKnowledgeTarget;
      const isPlayerTile = (gx === px && gy === py) || Boolean(data?.category === 'PLAYER' || data?.isPlayer);

      const isMonster = Boolean(data?.category === 'MONSTER' || data?.hasMonster);
      const isGimmick = Boolean(
        data?.category === 'DOOR' || data?.isDoor ||
        data?.category === 'ALTAR' || data?.isAltar ||
        data?.category === 'FOUNTAIN' || data?.isFountain ||
        data?.category === 'SINK' || data?.isSink ||
        data?.category === 'THRONE' || data?.isThrone ||
        data?.category === 'GRAVE' || data?.isGrave ||
        data?.category === 'STAIRS' || data?.isStairs ||
        data?.category === 'TRAP' || data?.isTrap ||
        data?.category === 'CONTAINER' || data?.category === 'CHEST' || data?.isChest ||
        data?.id?.includes('door') || data?.id?.includes('stairs')
      );
      const diffX = gx - px;
      const diffY = gy - py;
      const dx = Math.abs(diffX);
      const dy = Math.abs(diffY);
      const isAdjacent = (dx <= 1 && dy <= 1 && !isPlayerTile);

      // 🧭 マウスクリック時: 目標位置への方向 (Facing) へ更新 (直近・長距離問わずクリック先を向く)
      if (!isPlayerTile) {
        const dirCode = getDirectionCodeFromDelta(diffX, diffY);
        if (dirCode && typeof client.setFacingDirection === 'function') {
          client.setFacingDirection(dirCode);
        }
      }

      // 🛡️ Shift + クリック: 移動およびメニュー展開を抑止し、ターン消費ゼロでその場の向き変更のみを行う
      const isShift = Boolean(isShiftClick || clientPos?.shiftKey);
      if (isShift) {
        client.floatingActions?.hide();
        return;
      }

      // GKL 推奨アクション一覧の取得
      const allActions = client.core?.gkl?.getRecommendedActions ? client.core.gkl.getRecommendedActions() : [];
      const applicableActions = client.floatingActions ? client.floatingActions.resolveApplicableActions({
        targetGx: gx,
        targetGy: gy,
        playerX: px,
        playerY: py,
        cardData: data,
        allActions
      }) : [];

      // 該当マスに固有のコンテキストアクション（デフォルト移動・待機以外）があるか判定
      const hasSpecificAction = applicableActions.some(a => !a.isDefault && a.category !== 'DEFAULT');

      // 🎯 スマートコンテキスト判定:
      // 1. 右クリック時 (isForceContextMenu): どのマスでも強制的にメニュー展開
      // 2. 左クリック時:
      //    - 自キャラ足元 (isPlayerTile): 自分・足元メニューを展開
      //    - 隣接マス (isAdjacent): GKL推奨アクションが存在するマスのみメニュー展開
      //    - 遠隔モンスター (!isAdjacent && isMonster): 不用意な突進事故防止・射撃メニュー展開
      //    - 通常アイテムマスや安全な床: メニューを出さず直接 travelTo で歩いて乗る
      const shouldShowContextMenu = isForceContextMenu || isPlayerTile || (isAdjacent && (hasSpecificAction || isMonster || isGimmick)) || (!isAdjacent && isMonster);

      if (shouldShowContextMenu && client.floatingActions) {
        // スクリーン表示座標（クリックイベントの clientX/Y、または3D/2D投影）
        let clientX = clientPos?.clientX;
        let clientY = clientPos?.clientY;

        if ((clientX === undefined || clientY === undefined) && client.currentViewMode === 'hd2d' && client.webgpuRenderer) {
          const proj = client.webgpuRenderer.worldToScreen(gx, 0.45, gy);
          if (proj && client.webgpuCanvas) {
            const rect = client.webgpuCanvas.getBoundingClientRect();
            clientX = rect.left + proj.screenX * (rect.width / client.webgpuCanvas.width);
            clientY = rect.top + proj.screenY * (rect.height / client.webgpuCanvas.height);
          }
        } else if ((clientX === undefined || clientY === undefined) && client.currentViewMode === 'graphic' && client.mainViewportRenderer) {
          const screen = client.mainViewportRenderer.gridToScreen(gx, gy);
          if (screen) {
            clientX = screen.clientX;
            clientY = screen.clientY;
          }
        }

        client.floatingActions.show({
          gx,
          gy,
          playerX: px,
          playerY: py,
          clientX,
          clientY,
          cardData: data,
          actions: allActions,
          canTravel: !isMonster && !isPlayerTile
        });
      } else if (client.core?.gkl?.travelTo) {
        // 安全な床・通路等の地形 ➔ 自動移動
        client.floatingActions?.hide();
        client.floatingMessageHud?.notifyUserAction();
        await client.core.gkl.travelTo({ x: gx, y: gy });
      }
    }
  }

  /**
   * 2D / 3D / ASCII / Zoom キャンバスのマウス・ホバー・クリックイベントを登録
   */
  bindInteractionEvents() {
    const client = this.client;

    // ツールチップ追従
    document.addEventListener('mousemove', (e) => {
      if (client.elGklTooltip && !client.elGklTooltip.classList.contains('hidden')) {
        client.elGklTooltip.style.left = (e.clientX + 14) + 'px';
        client.elGklTooltip.style.top = (e.clientY + 14) + 'px';
      }
    });

    // WebGPU HD2D レンダラーのクリック＆ホバーイベント接続
    if (client.webgpuRenderer) {
      client.webgpuRenderer.onCellClick = (gx, gy, clickInfo, isRightClick = false) => {
        this.handleCanvasInspect(gx, gy, false, clickInfo, isRightClick);
      };
      client.webgpuRenderer.onCellContextMenu = (gx, gy, clickInfo) => {
        this.handleCanvasInspect(gx, gy, false, clickInfo, true);
      };
      client.webgpuRenderer.onCellHover = (gx, gy) => this.handleCanvasInspect(gx, gy, true);
    }

    // メインキャンバス (2D Viewport) のクリック＆ホバーイベント
    if (client.canvas) {
      client.canvas.addEventListener('mousemove', async (e) => {
        const grid = client.mainViewportRenderer?.screenToGrid(e.clientX, e.clientY);
        if (grid) {
          await this.handleCanvasInspect(grid.gx, grid.gy, true);
        }
      });

      client.canvas.addEventListener('click', async (e) => {
        e.stopPropagation();
        const grid = client.mainViewportRenderer?.screenToGrid(e.clientX, e.clientY);
        if (grid) {
          await this.handleCanvasInspect(grid.gx, grid.gy, false, { clientX: e.clientX, clientY: e.clientY, shiftKey: Boolean(e.shiftKey) }, false);
        }
      });

      // 右クリック（詳細コンテキストメニュー展開）
      client.canvas.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const grid = client.mainViewportRenderer?.screenToGrid(e.clientX, e.clientY);
        if (grid) {
          await this.handleCanvasInspect(grid.gx, grid.gy, false, { clientX: e.clientX, clientY: e.clientY, shiftKey: Boolean(e.shiftKey) }, true);
        }
      });
    }

    // ASCII Grid のクリック＆ホバーイベント (Event Delegation)
    if (client.asciiGrid) {
      const getAsciiCellCoords = (e) => {
        const target = e.target;
        if (target && target.id && target.id.startsWith('ascii-cell-')) {
          const parts = target.id.split('-');
          return { gx: parseInt(parts[2], 10), gy: parseInt(parts[3], 10) };
        }
        return null;
      };

      client.asciiGrid.addEventListener('mousemove', async (e) => {
        const coords = getAsciiCellCoords(e);
        if (coords) {
          await this.handleCanvasInspect(coords.gx, coords.gy, true);
        }
      });

      client.asciiGrid.addEventListener('click', async (e) => {
        e.stopPropagation();
        const coords = getAsciiCellCoords(e);
        if (coords) {
          await this.handleCanvasInspect(coords.gx, coords.gy, false, { clientX: e.clientX, clientY: e.clientY, shiftKey: Boolean(e.shiftKey) });
        }
      });

      client.asciiGrid.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const coords = getAsciiCellCoords(e);
        if (coords) {
          await this.handleCanvasInspect(coords.gx, coords.gy, false, { clientX: e.clientX, clientY: e.clientY, shiftKey: Boolean(e.shiftKey) }, true);
        }
      });
    }

    // ズームカメラ (zoom-canvas) のクリック＆ホバーイベント
    const zoomCanvas = document.getElementById('zoom-canvas');
    if (zoomCanvas) {
      const getZoomCellCoords = (e) => {
        const rect = zoomCanvas.getBoundingClientRect();
        const tileX = Math.floor(((e.clientX - rect.left) * (zoomCanvas.width / rect.width)) / 32);
        const tileY = Math.floor(((e.clientY - rect.top) * (zoomCanvas.height / rect.height)) / 32);

        const px = client.mapRenderer?.targetCursorX >= 0 ? client.mapRenderer.targetCursorX : 0;
        const py = client.mapRenderer?.targetCursorY >= 0 ? client.mapRenderer.targetCursorY : 0;

        return {
          gx: px + (tileX - 10),
          gy: py + (tileY - 4)
        };
      };

      zoomCanvas.addEventListener('mousemove', async (e) => {
        const { gx, gy } = getZoomCellCoords(e);
        await this.handleCanvasInspect(gx, gy, true);
      });

      zoomCanvas.addEventListener('click', async (e) => {
        e.stopPropagation();
        const { gx, gy } = getZoomCellCoords(e);
        await this.handleCanvasInspect(gx, gy, false, { clientX: e.clientX, clientY: e.clientY, shiftKey: Boolean(e.shiftKey) });
      });

      zoomCanvas.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const { gx, gy } = getZoomCellCoords(e);
        await this.handleCanvasInspect(gx, gy, false, { clientX: e.clientX, clientY: e.clientY, shiftKey: Boolean(e.shiftKey) }, true);
      });
    }
  }

  /**
   * 📚 '/' コマンドプログレッシブ拡張: 統合ナレッジインスペクターを開く
   */
  openKnowledgeInspector() {
    const client = this.client;
    let target = client.lastKnowledgeTarget;

    // 直前ターゲットがなければ足元のアイテム/モンスターを探す
    if (!target) {
      const area = client.core?.gkl?.areaStateManager;
      const playerPos = area?.playerPos;
      if (playerPos && typeof area.getEntityAt === 'function') {
        const underfoot = area.getEntityAt(playerPos.x, playerPos.y);
        if (underfoot) {
          target = underfoot;
        }
      }
    }

    // それでもなければ自キャラ
    if (!target) {
      const isEn = client.currentLanguage === 'en';
      target = {
        isPlayer: true,
        category: 'PLAYER',
        name: isEn ? 'You (Player)' : '自キャラ (Player)',
        dangerLevel: 'NONE',
        dispositionStatus: 'PLAYER',
        stats: { hd: 'Player', ac: 'Self', speed: 'Self', mr: 0 },
        effectSummary: isEn ? 'The adventurer exploring the Mazes of Menace.' : 'ダンジョンを探索中のプレイヤー自身です。'
      };
    }

    if (client.knowledgeDetailModal) {
      client.knowledgeDetailModal.open(target);
      // '/' 押下時は直ちにキーワード入力できるよう検索バーへフォーカス
      setTimeout(() => {
        const input = document.getElementById('kn-search-input');
        if (input) {
          input.focus();
          input.select();
        }
      }, 50);
    }
  }

  /**
   * 📜 '\' または '¥' コマンドプログレッシブ拡張: ディスカバリー図鑑を開く
   */
  openDiscoveryCodex() {
    const client = this.client;
    let container = document.getElementById('discovery-codex-modal-container');
    if (!container && typeof document !== 'undefined') {
      container = document.createElement('div');
      container.id = 'discovery-codex-modal-container';
      container.className = 'knowledge-modal-backdrop hidden';
      container.style.cssText = 'position: fixed; inset: 0; z-index: 1050; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px);';

      const codexEl = document.createElement('nh-discovery-codex');
      codexEl.id = 'active-discovery-codex';
      codexEl.addEventListener('nh-close', () => {
        container.classList.add('hidden');
      });
      codexEl.addEventListener('nh-item-select', (e) => {
        container.classList.add('hidden');
        if (client.knowledgeDetailModal && e.detail?.item) {
          client.knowledgeDetailModal.open(e.detail.item);
        }
      });
      container.appendChild(codexEl);

      container.onclick = (e) => {
        if (e.target === container) {
          container.classList.add('hidden');
        }
      };
      container.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };
      document.body.appendChild(container);
    }

    if (container) {
      const codexEl = container.querySelector('nh-discovery-codex');
      if (codexEl) {
        codexEl.setLanguage(client.currentLanguage);
        if (client.core?.gkl?.discoveryStateManager) {
          codexEl.setDiscoveryManager(client.core.gkl.discoveryStateManager);
        }
      }
      container.classList.remove('hidden');

      // Cコアとの動的バックグラウンド同期
      if (client.core?.gkl && typeof client.core.gkl.syncDiscoveriesSilent === 'function') {
        client.core.gkl.syncDiscoveriesSilent().then(() => {
          if (codexEl && client.core?.gkl?.discoveryStateManager) {
            codexEl.setDiscoveryManager(client.core.gkl.discoveryStateManager);
          }
        });
      }
    }
  }
}
