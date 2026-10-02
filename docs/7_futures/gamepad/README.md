# 🎮 ゲームパッド操作・コンソールモード仕様・構想群

NetHack WebUI におけるゲームパッド・コンソールモード操作に関する仕様書および検討・実験記録です。

---

## 📌 ドキュメント一覧と位置付け

| ドキュメント | ステータス | 役割・概要 |
| :--- | :---: | :--- |
| **[gamepad_console_mode_architecture.ja.md](./gamepad_console_mode_architecture.ja.md)** | `💡 proposed` | **【現行・代表仕様書】Nehww GamePad オンデマンド統合設計書**<br>デスクトップ画面を崩さず、パッド操作時のみ出現するゼロフットプリント（Zero-Footprint）設計 |
| **[gamepad_console_client_architecture.ja.md](./gamepad_console_client_architecture.ja.md)** | `📦 archived` | **シレン風 GamePad 専用クライアント設計書**<br>（※PoC・実験完了に伴いクローズ。コア知見は共通 Web Components へ資産化済） |
| **[gamepad_console_client_and_gkl_gateway_vision.ja.md](./gamepad_console_client_and_gkl_gateway_vision.ja.md)** | `📦 archived` | **シレン風 GamePad 連携ゲートウェイ初期ビジョン構想**<br>（※Rogue移植版での操作体系とNetHackでの技術的変遷の記録） |
| **[gamepad_radial_button_set_switching_concept.ja.md](./gamepad_radial_button_set_switching_concept.ja.md)** | `💡 proposed` | **右ホイール・ボタンセット（スタンス）切替構想メモ**<br>（※単発コマンド選択からスタンス切替へのUX拡張アイデア） |

---

## 🧭 設計の変遷と結論

1. **初期構想 (Vision & Dedicated Client)**:
   - 当初は「風来のシレン」のように専用画面を持った独立クライアント (`examples/console-client/`) の開発を検討・実験しました。
   - この過程で、`<nh-radial-palette-hud>`、`<nh-shiren-drawer>`、`<nh-gamepad-guide-bar>` などの優れた UI コンポーネント群が生み出され、共通資産化されました。
2. **方針転換と最新設計 (On-Demand Mode)**:
   - 独立クライアントを別個にメンテナンスするコストと画面分断を避けるため、**旗艦クライアント（Nehww）におまけ機能としてシームレスに組み込む「オンデマンド統合（Zero-Footprint）」** へ昇華しました。
   - 現在の正式な設計書は **[gamepad_console_mode_architecture.ja.md](./gamepad_console_mode_architecture.ja.md)** です。
