# Changelog

All notable Android-port changes are tracked here.

## [0.1.0-alpha.5] - 2026-10-06

Android-native VPN and Xray event logs.

### Added
- In-memory Android VPN/Xray event log buffer capped at 500 lines.
- Existing Logs tab now reads native Android service logs instead of Linux file paths.
- Native clear-log bridge for Android.
- Log entries for VPN startup, Xray initialization, per-app routing state, network handovers, reconnect attempts, errors and Xray status callbacks.
- Timestamped log entries while retaining matching Logcat output.

### Behavior
- Logs stay scoped to KarinCore VPN events instead of exposing unrelated system Logcat output.
- The bounded buffer prevents unbounded log growth during long-running VPN sessions.

### Verified
- Complete arm64 debug APK build succeeds in GitHub Actions with native Android logging enabled.


## [0.1.0-alpha.4] - 2026-10-06

Per-app split tunneling.

### Added
- Native discovery of launchable Android applications with labels and package names.
- Searchable application selector in Settings.
- Three VPN application-routing modes: All apps, Only selected and Bypass selected.
- Persistent per-app routing configuration in local storage.
- Android `VpnService.Builder.addAllowedApplication` and `addDisallowedApplication` integration.
- Validation that Only selected mode contains at least one installed application.

### Safety
- KarinCore's own package is never added to the VPN allowlist.
- Missing or uninstalled package names are ignored before the VPN interface is established.
- Xray outbound traffic remains outside the TUN to prevent routing loops.

### Verified
- Complete arm64 debug APK build succeeds in GitHub Actions with per-app routing enabled.


## [0.1.0-alpha.3] - 2026-10-06

Network handover recovery.

### Added
- Android underlying-network monitoring on Android P and newer.
- Debounced detection of Wi-Fi/cellular handovers.
- In-place Xray core restart using the existing TUN file descriptor.
- Up to three Xray restart attempts after an upstream network change.
- `reconnecting` state exposed through the native VPN status bridge.
- `ACCESS_NETWORK_STATE` and `CHANGE_NETWORK_STATE` permissions required for underlying-network monitoring.

### Behavior
- The TUN interface stays established during an Xray handover restart.
- A failed handover restart keeps the VPN interface active instead of silently falling back to direct traffic.
- The foreground notification reflects reconnecting and reconnect-failure states.

### Verified
- Complete arm64 debug APK build succeeds in GitHub Actions after the handover implementation.


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
