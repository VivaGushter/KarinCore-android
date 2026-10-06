# Phase 3 status

Current version: `0.1.0-alpha.6`

## Completed

1. Android network-change monitoring.
2. Debounced Wi-Fi/cellular handover detection.
3. In-place Xray restart without recreating the Android TUN.
4. Per-app split tunneling with allowlist and bypass modes.
5. Native installed-application discovery and searchable selection UI.
6. Android-native VPN/Xray event logs in the existing Logs tab.
7. Android document-picker export.
8. Mobile-specific layout, safe-area support and Android titlebar removal.
9. Runtime version/update metadata.
10. CI-validated arm64 debug APK build.

## Planned

1. Restore UI connection state after Activity/WebView recreation while the foreground VPN remains active.
2. IPv6 routing and leak validation across Wi-Fi and cellular networks.
3. WireGuard transport/chaining.
4. OpenVPN transport/chaining.
5. Further mobile UI polish from real-device testing.

The order may change when real-device testing exposes platform-specific blockers.
