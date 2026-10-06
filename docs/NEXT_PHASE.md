# Phase 3 status

Current version: `0.1.0-alpha.6`

## Completed

1. Android network-change monitoring.
2. Debounced Wi-Fi/cellular handover detection.
3. In-place Xray restart without recreating the Android TUN.
4. Per-app split tunneling with allowlist and bypass modes.
5. Native installed-application discovery and searchable selection UI.
6. Android-native VPN/Xray event logs in the existing Logs tab.
7. Android system document picker for routing-profile export.
8. Android-specific responsive layout and safe-area handling.
9. Runtime-driven version/update metadata.
10. CI-validated arm64 debug APK build.

## Planned

1. IPv6 routing and leak validation across Wi-Fi and cellular networks.
2. Real-device VPN permission, connection and traffic validation.
3. WireGuard transport/chaining.
4. OpenVPN transport/chaining.
5. Additional Android UI/runtime fixes discovered during device testing.

The order may change when real-device testing exposes platform-specific blockers.
