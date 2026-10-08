# Phase 3 status

Current version: `0.1.0-alpha.29`

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
12. CI-validated split debug APK pipeline for all four Android ABIs.
13. Built-in VPN self-test for native service/Xray/TUN/proxy-path/external-IP validation.
14. V2RayTun subscription routing import for both object and top-level array payloads, with an in-app active-route indicator.
15. Read-only visualization of the effective subscription route, connection state and ordered Xray rules.
16. Offline installation of bundled Xray `geoip.dat` and `geosite.dat` before Android core startup.
17. Application-wide Android Back navigation with main-screen exit confirmation and repository-backed release history in About.
18. Android home-screen VPN widget backed by the encrypted last successful connection.
19. Split APK publication for `arm64-v8a`, `armeabi-v7a`, `x86` and `x86_64` with per-ABI native-library checks.

## Planned

1. Real-device validation: connect/disconnect, VLESS/Reality traffic, DNS, IPv4/IPv6, per-app modes and Wi-Fi/cellular handovers.
2. Real-device validation of Always-on VPN and Block connections without VPN across reboot.
3. Real-device validation of embedded WireGuard profiles.
4. OpenVPN transport/chaining.
5. Further mobile UI polish from device testing.

At this stage real-device testing has higher value than adding more transports without runtime evidence.
