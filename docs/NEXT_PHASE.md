# Phase 3 status

Current version: `0.1.0-alpha.8`

## Completed

1. Android network-change monitoring.
2. Debounced Wi-Fi/cellular handover detection and break-before-make recovery.
3. In-place Xray restart without recreating the Android TUN.
4. Per-app split tunneling with allowlist and bypass modes.
5. Native installed-application discovery and searchable selection UI.
6. Android-native VPN/Xray event logs in the existing Logs tab.
7. Android document-picker export.
8. Mobile-specific layout, safe-area support and Android titlebar removal.
9. Runtime version/update metadata.
10. UI state restoration from the foreground VPN service after Activity/WebView recreation.
11. CI-validated arm64 debug APK pipeline.

## Planned

1. IPv6 leak validation across Wi-Fi and cellular networks on a real device.
2. WireGuard transport/chaining.
3. OpenVPN transport/chaining.
4. Further mobile UI polish from real-device testing.

Real-device testing now provides more value than adding additional transport features blindly.
