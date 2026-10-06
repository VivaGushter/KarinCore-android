# Phase 3 status

Current version: `0.1.0-alpha.15`

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
11. Android Always-on VPN restart persistence and system lockdown settings integration.
12. CI-validated arm64 debug APK pipeline.
13. Built-in VPN self-test for native service/Xray/TUN/proxy-path/external-IP validation.

## Planned

1. Real-device validation: connect/disconnect, VLESS/Reality traffic, DNS, IPv4/IPv6, per-app modes and Wi-Fi/cellular handovers.
2. Real-device validation of Always-on VPN and Block connections without VPN across reboot.
3. WireGuard transport/chaining.
4. OpenVPN transport/chaining.
5. Further mobile UI polish from device testing.

At this stage real-device testing has higher value than adding more transports without runtime evidence.
