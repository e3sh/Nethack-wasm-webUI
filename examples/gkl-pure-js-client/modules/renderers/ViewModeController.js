/**
 * @file ViewModeController.js
 * @description GKL Pure JS Client のビューモード（2D Graphic / ASCII / HD-2D Diorama）切り替えコントローラー
 */

export class ViewModeController {
  /**
   * @param {Object} client - GklPureJSClient インスタンス参照
   */
  constructor(client) {
    this.client = client;
    this.currentViewMode = client._currentViewMode || client.currentViewMode || 'graphic';
  }

  /**
   * 特定のビューモードを明示指定
   * @param {'graphic' | 'ascii' | 'hd2d'} mode
   */
  setViewMode(mode) {
    const webgpu = this.client.webgpuRenderer;
    const isWebGpuAvailable = webgpu && webgpu.isSupported;
    let targetMode = mode;
    if (targetMode === 'hd2d' && !isWebGpuAvailable) {
      targetMode = 'graphic';
    }
    if (['hd2d', 'graphic', 'ascii'].includes(targetMode)) {
      this.currentViewMode = targetMode;
      this.client.currentViewMode = targetMode;
      this.updateViewModeUI();
    }
  }

  /**
   * ビューモードを循環切替 (2D ➔ ASCII ➔ HD-2D ➔ 2D)
   */
  cycleViewMode() {
    const webgpu = this.client.webgpuRenderer;
    const isWebGpuAvailable = webgpu && webgpu.isSupported;

    if (this.currentViewMode === 'hd2d') {
      this.currentViewMode = 'graphic';
    } else if (this.currentViewMode === 'graphic') {
      this.currentViewMode = 'ascii';
    } else { // 'ascii'
      if (isWebGpuAvailable) {
        this.currentViewMode = 'hd2d';
      } else {
        this.currentViewMode = 'graphic';
      }
    }
    this.client.currentViewMode = this.currentViewMode;
    this.updateViewModeUI();
  }

  /**
   * ビューモード切替時のDOM要素・ボタン表示の同期
   */
  updateViewModeUI() {
    const client = this.client;
    const isEn = client.currentLanguage === 'en';
    const webgpu = client.webgpuRenderer;
    const isWebGpuAvailable = webgpu && webgpu.isSupported;

    // 次のビューモードの判定
    let nextViewMode = 'graphic';
    if (this.currentViewMode === 'hd2d') {
      nextViewMode = 'graphic';
    } else if (this.currentViewMode === 'graphic') {
      nextViewMode = 'ascii';
    } else { // 'ascii'
      nextViewMode = isWebGpuAvailable ? 'hd2d' : 'graphic';
    }

    const viewModeLabels = {
      graphic: isEn ? '🎨 2D Graphic' : '🎨 2Dグラフィック',
      ascii: isEn ? '🔤 ASCII' : '🔤 ASCII',
      hd2d: isEn ? '✨ HD-2D' : '✨ HD-2D'
    };

    const toggleViewPrefix = isEn ? 'Toggle View: ' : 'ビュー切替: ';
    const toggleViewText = `${toggleViewPrefix}${viewModeLabels[this.currentViewMode]} ➜ ${viewModeLabels[nextViewMode]}`;

    if (this.currentViewMode === 'hd2d') {
      client.canvas?.classList.add('hidden');
      client.asciiGrid?.classList.add('hidden');
      client.webgpuCanvas?.classList.remove('hidden');
      webgpu?.setActive(true);
      if (client.btnToggleCameraMode) {
        client.btnToggleCameraMode.style.display = 'block';
        const camMode = webgpu?.cameraMode || 'diorama';
        const nextCamMode = camMode === 'topdown' ? 'diorama' : 'topdown';
        const camModeLabels = {
          diorama: isEn ? 'Diorama' : 'ジオラマ',
          topdown: isEn ? 'Top-Down' : 'トップビュー'
        };
        const camPrefix = isEn ? '📷 Camera: ' : '📷 カメラ: ';
        client.btnToggleCameraMode.textContent = `${camPrefix}${camModeLabels[camMode]} ➜ ${camModeLabels[nextCamMode]}`;
      }
    } else if (this.currentViewMode === 'graphic') {
      webgpu?.setActive(false);
      client.asciiGrid?.classList.add('hidden');
      client.webgpuCanvas?.classList.add('hidden');
      client.canvas?.classList.remove('hidden');
      client.mainViewportRenderer?.switchViewMode(true, false);
      if (client.btnToggleCameraMode) {
        client.btnToggleCameraMode.style.display = 'none';
      }
    } else { // 'ascii'
      webgpu?.setActive(false);
      client.canvas?.classList.add('hidden');
      client.webgpuCanvas?.classList.add('hidden');
      client.asciiGrid?.classList.remove('hidden');
      client.mainViewportRenderer?.switchViewMode(false, false);
      if (client.btnToggleCameraMode) {
        client.btnToggleCameraMode.style.display = 'none';
      }
    }

    // ビュー切替ボタンのテキスト設定
    if (client.btnToggleView) {
      client.btnToggleView.textContent = toggleViewText;
    }
  }

  /**
   * HD-2D カメラアングル (ジオラマ / トップビュー) 切替
   */
  toggleCameraMode() {
    const webgpu = this.client.webgpuRenderer;
    if (webgpu && this.currentViewMode === 'hd2d') {
      webgpu.toggleCameraMode();
      this.updateViewModeUI();
    }
  }
}
