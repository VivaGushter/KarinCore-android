# Changelog

All notable Android-port changes are tracked here.

## [0.1.0-alpha.12] - 2026-10-06

Android fork update channel and automated releases.

### Fixed
- The in-app update checker no longer falls back to the upstream `detestern/KarinCore` repository.
- Update checks now read the Android fork's `VERSION` file directly, so alpha/beta prereleases are detected correctly.
- Update links target the exact version tag in `VivaGushter/KarinCore-android`.
- The About page identifies the Android fork and keeps upstream attribution separate.

### Added
- Semantic prerelease-aware version comparison in the frontend.
- GitHub Actions release publishing for `release:` commits.
- Automatic version tag creation, prerelease creation, changelog release notes and APK attachment.
- Retry logic for transient Android SDK/NDK download corruption in CI.

### Verified
- The updater/release-channel feature commit completes the full arm64 debug APK build.
- This release commit is intended to validate automatic GitHub Release publication end-to-end.


## [0.1.0-alpha.11] - 2026-10-06

Native Android subscription transport.

### Fixed
- Android subscription downloads no longer depend on Rust reqwest transport.
- Added a native Android `HttpURLConnection` / `HttpsURLConnection` fetch bridge running on a background executor.
- Native fetch applies an 8 second connect timeout, 20 second read timeout, five-redirect limit and 8 MiB response cap.
- Gzip subscription responses are decoded natively.
- TLS validation remains enabled and TLS failures are surfaced explicitly.
- Added a frontend 25 second watchdog around the Tauri subscription command so the Add button always leaves Loading state even if the bridge does not answer.

### Architecture
- Rust still owns subscription parsing, Base64 decoding, routing import and DNS import.
- Android only owns the HTTP transport layer.

### Verified
- Native-fetch feature commit completes the full arm64 debug APK build in GitHub Actions.
- Release commit is validated by the same Android build workflow.


## [0.1.0-alpha.10] - 2026-10-06

Subscription loading reliability.

### Fixed
- Subscription HTTP requests no longer wait indefinitely.
- Added an 8 second connection timeout and 20 second total request timeout.
- Redirect chains are limited to five hops.
- Oversized subscription responses above 8 MiB are rejected.
- Timeout, connection and TLS-related failures are surfaced to the UI with useful messages.
- The subscription button always leaves Loading state once the backend returns an error.

### Changed
- Subscription requests now identify as KarinCore Android instead of using the old v2rayNG user-agent string.

### Verified
- Feature commit completes the full arm64 debug APK build in GitHub Actions.
- Release commit is validated by the same Android build workflow.


## [0.1.0-alpha.9] - 2026-10-06

Android Always-on VPN and system lockdown integration.

### Added
- Explicit Android Always-on VPN support for KarinCore's `VpnService`.
- App-private persistence of the last successfully started generated Xray configuration, MTU and per-app routing state.
- Restoration of the persisted VPN connection when Android starts the service for Always-on VPN, including after reboot.
- Android VPN Settings shortcut from KarinCore Settings.
- Native Always-on and lockdown status fields exposed to the frontend.
- Android-specific system Kill Switch section replacing the desktop iptables toggle.

### Changed
- User-requested profile changes clear the previously persisted native connection before attempting the new profile, preventing stale Always-on restoration.
- VPN permission revocation clears persisted restart state.
- Manual disconnect is rejected while Android reports Always-on VPN active; the UI directs the user to system VPN Settings instead.
- Desktop Kill Switch behavior remains unchanged on Linux.
- Android sends `killSwitch: false` to the shared Rust command because system lockdown, not iptables, is the authoritative Android mechanism.

### Safety
- KarinCore does not attempt to enable lockdown programmatically.
- System Always-on/lockdown configuration remains under Android user/device-policy control.
- Only a configuration that previously reached a running Xray state is persisted for system restart.

### Verified
- Feature commit completes the full arm64 debug APK build in GitHub Actions.
- Release commit is validated by the same Android build workflow.


## [0.1.0-alpha.8] - 2026-10-06

Native VPN state restoration and version metadata recovery.

### Added
- Native VPN runtime-status command exposed to the frontend.
- Android UI restores running, starting and reconnecting VPN state after Activity/WebView recreation.
- Active profile hint is persisted while the native VPN is running so the reopened UI can display the correct profile.

### Changed
- Native `VpnService` state is authoritative when the Android UI starts.
- Stale session/local active-connection markers are removed when the native VPN service is no longer active.
- Reconnecting/starting state is reflected as Connecting instead of incorrectly showing Disconnected.
- Ping and VPN IP controls remain hidden until the native Xray core is running.
- Version metadata is advanced monotonically after the interrupted alpha.6/alpha.7 documentation update.

### Verified
- Previous alpha.7 runtime-hardening build completed successfully in GitHub Actions.
- Full alpha.8 arm64 debug APK validation is required by the release CI workflow.

## [0.1.0-alpha.7] - 2026-10-06

Android runtime hardening.

### Added
- Android package-visibility query for launcher applications used by the per-app selector.
- Recovery after break-before-make network transitions where the old upstream disappears before the new one is available.
- VPN permission revocation event logging.

### Changed
- Underlying-network recovery now differentiates direct handovers from recovery after complete network loss.
- GitHub Actions Android workflow uses current checkout/setup Java/setup Node major versions.

### Verified
- Xray-core Android documentation confirms the TUN descriptor is supplied through `xray.tun.fd`.
- Pinned AndroidLibXrayLite `v26.9.30` sets `xray.tun.fd` inside `CoreController.startLoop(config, tunFd)`.
- Complete arm64 debug APK build succeeds in GitHub Actions after runtime hardening.


## [0.1.0-alpha.6] - 2026-10-06

Mobile UI and Android document export.

### Added
- Android system document picker for routing-profile JSON export.
- Native document-writing bridge through the KarinCore Tauri Android plugin.
- Android-specific responsive layout with safe-area handling.
- Narrow-screen routing layout that stacks Direct / Proxy / Block columns vertically.
- Runtime metadata command exposing platform, package version and update repository to the frontend.

### Changed
- Desktop frameless titlebar and minimize/maximize/close controls are hidden on Android.
- Splash screen, sidebar, dialogs and profile drawer now use Android viewport/safe-area dimensions.
- Hero connection control scales to phone width and short screens.
- Update checker uses the Android-port repository on Android.
- Visible application version is derived from Cargo package metadata instead of a hardcoded frontend string.

### Verified
- Complete arm64 debug APK build succeeds in GitHub Actions with mobile layout and Android document export enabled.


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
