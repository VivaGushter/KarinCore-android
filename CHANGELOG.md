# Changelog

All notable Android-port changes are tracked here.

## [0.1.0-alpha.2] - 2026-10-06

First CI-validated Android APK build.

### Added
- GitHub Actions arm64 debug APK build pipeline.
- Automatic Android SDK/NDK, Rust target, Xray AAR and Tauri Android bootstrap in CI.
- APK workflow artifact upload for successful builds.

### Fixed
- Corrected the Tauri VPN plugin error serializer return type so the Rust Android target compiles.
- Added the AndroidX AppCompat dependency required by Tauri ActivityResult callbacks.
- Replaced the failing Android setup action path with the runner's preinstalled Android command-line tools.

### Verified
- Tauri Android project initialization succeeds in CI.
- Rust compiles for `aarch64-linux-android`.
- Kotlin/Gradle compilation succeeds.
- AndroidLibXrayLite `v26.9.30` is downloaded and SHA-256 verified.
- A complete arm64 debug APK is produced and uploaded as a workflow artifact.

### Remaining validation
- Real-device installation and VPN runtime connection testing are still pending.


## [0.1.0-alpha.1] - 2026-10-06

First Android development snapshot.

### Added
- Android port repository based on KarinCore 1.3.7.
- Tauri 2 Android mobile entry point while retaining the desktop wrapper.
- Native Tauri Android plugin `karin-vpn`.
- Android `VpnService` with foreground-service lifecycle.
- IPv4 and IPv6 full-tunnel routes.
- Xray TUN integration using `AndroidLibXrayLite v26.9.30`.
- Pinned Xray AAR downloader with SHA-256 verification.
- VPN prepare/start/stop/status bridge.
- Android-specific Xray config generation using KarinCore routing and DNS data.
- Version consistency checker.
- Android build and architecture documentation.

### Changed
- Application identifier for this port is `com.vivagushter.karincore`.
- Android `reqwest` backend uses Rustls.
- Real KarinCore code moved into the library entry point so Tauri mobile can call it.
- The browser/activity unload event no longer automatically stops the VPN.

### Known limitations
- Full APK compilation and real-device runtime validation are still pending.
- OpenVPN and WireGuard chaining are not implemented on Android yet.
- Per-app split tunneling UI is not implemented yet.
- Network handover/reconnect handling is not implemented yet.
- Export still needs Android document-picker support.
- UI is still primarily the desktop KarinCore layout.
