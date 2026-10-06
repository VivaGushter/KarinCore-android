# Phase 3 status

Current version: `0.1.0-alpha.3`

## Completed

1. Android network-change monitoring.
2. Debounced Wi-Fi/cellular handover detection.
3. In-place Xray restart without recreating the Android TUN.
4. CI-validated arm64 debug APK build.

## Planned

1. Per-app split tunneling UI based on `addAllowedApplication` / `addDisallowedApplication`.
2. IPv6 routing and leak validation across Wi-Fi and cellular networks.
3. Android-native log integration for the KarinCore Logs tab.
4. Mobile-specific replacement for desktop titlebar and window controls.
5. Android document-picker export.
6. WireGuard transport/chaining.
7. OpenVPN transport/chaining.

The order may change when real-device testing exposes platform-specific blockers.
