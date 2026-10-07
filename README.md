<div align="center">
  <img src="src-tauri/icons/icon.png" alt="KarinCore" width="160"/>
  <h1>KarinCore Android</h1>
  <p>Android port of KarinCore powered by Tauri 2, Rust, Android VpnService and Xray-core.</p>
  <p><strong>Current version: 0.1.0-alpha.21</strong></p>
  <p><a href="README-ru.md">Русская версия</a></p>
</div>

## Status

This repository is an experimental Android port of [detestern/KarinCore](https://github.com/detestern/KarinCore), based on upstream KarinCore 1.3.7 at commit `b7fea2e2ff5e1492fd863381985fdebb4da7a57e`.

The shared KarinCore TypeScript UI and Rust parsing/routing logic are retained. Linux-specific tunnel setup is replaced on Android by a native `VpnService` bridge and Xray TUN integration.

Version `0.1.0-alpha.21` is validated by a complete arm64 debug APK build in GitHub Actions. Real-device runtime validation is the next verification step.

## Implemented through 0.1.0-alpha.21

- Tauri 2 mobile entry point.
- Native Android `VpnService`.
- Foreground VPN service for modern Android.
- Android TUN interface with IPv4 and IPv6 routes.
- Xray-core integration through pinned `2dust/AndroidLibXrayLite v26.9.30`.
- TUN file descriptor passed directly to `CoreController.startLoop(...)`.
- Existing KarinCore VLESS/Reality, VMess, Trojan and Shadowsocks parsing reused.
- Existing Direct / Proxy / Block routing model reused.
- DNS packets from the TUN routed to the Xray DNS outbound.
- KarinCore's own package excluded from the VPN to prevent an Xray routing loop.
- VPN permission preparation, start, stop and status bridge.
- VPN service survives WebView/activity closure.
- Underlying network changes are monitored on Android P+; Wi-Fi/cellular handovers trigger an in-place Xray restart while keeping the TUN interface active.
- Per-app split tunneling with All apps, Only selected and Bypass selected modes.
- Installed launchable Android applications are discovered natively and can be searched and selected in Settings.
- Android-native VPN/Xray event log buffer is exposed through the existing Logs tab, including startup, errors, app-routing state, handovers and Xray status callbacks.
- Android document picker export for routing profiles.
- Android-specific mobile layout with desktop titlebar removed, safe-area handling and narrow-screen routing layout.
- The mobile interface keeps the configuration drawer control above the system navigation area, adapts forms, profile cards, logs and the About page to narrow or short screens, and shows an explicit idle core state instead of a technical `null` value.
- Runtime version/update metadata comes from the Rust package version instead of frontend hardcoded values.
- Android package-visibility query explicitly exposes launcher applications to the per-app selector on Android 11+.
- Network recovery handles both make-before-break and break-before-make transitions.
- UI connection state is restored from the native VPN service after Activity/WebView recreation; stale frontend state is discarded when the service is no longer active.
- Android Always-on VPN is supported with persisted last-successful native connection state for system restarts and reboot recovery.
- Android Settings integration exposes the system VPN screen for Always-on VPN and Block connections without VPN (lockdown) configuration.
- Android reports Always-on/lockdown state in Settings and prevents misleading manual disconnect attempts while Always-on mode is active.
- Subscription loading on Android uses a native Kotlin HTTP path instead of Rust reqwest, with bounded connect/read timeouts, redirect limits and explicit TLS/network errors.
- V2RayTun subscription routing is supported: a Base64 profile from the HTTP or body `routing` header is validated, stored with its subscription group and automatically applied to that group's servers with its original rule order, `domainStrategy` and `domainMatcher`; subscription refreshes update the route as well.
- Rust CI installs system dependencies without restarting GitHub runner services, preventing the checks from being interrupted after `apt` completes.
- The frontend has an independent 25 second subscription watchdog, so the UI cannot remain stuck in Loading even if the native bridge fails to return.
- Android uses Rustls for `reqwest`; the desktop path keeps the upstream native TLS setup.
- Logs page includes a VPN self-test that checks native service state, Xray state, TUN presence, forced proxy-path HTTPS/DNS and external IP through the active proxy.

Not implemented yet on Android: OpenVPN chaining and additional real-device runtime validation. Always-on/lockdown, IPv6 and OEM-specific behavior still require real-device validation.

## Release documentation

- [Privacy policy](PRIVACY.md)
- [Compatibility and known limitations](docs/COMPATIBILITY.md)
- [Upgrade and signing transition](docs/UPGRADING.md)
- [Production release checklist](docs/RELEASE_CHECKLIST.md)

The privacy description in the application and repository distinguishes zero developer-operated telemetry from the third-party network services used for subscriptions, DNS, update checks and connectivity diagnostics.

## Build prerequisites

Install the normal Tauri Android prerequisites: Rust, Node.js, Android Studio, Android SDK/Platform Tools, Build Tools, NDK and Command-line Tools. Add the Android Rust targets:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Set `JAVA_HOME`, `ANDROID_HOME` and `NDK_HOME` in the build environment.

## First build

```bash
git clone https://github.com/VivaGushter/KarinCore-android.git
cd KarinCore-android

npm install
npm run android:core
npm run android:init
npm run android:dev
```

`npm run android:core` downloads the pinned `libv2ray.aar` and verifies its SHA-256 digest. The AAR is intentionally not committed to Git.

After `tauri android init`, Tauri generates `src-tauri/gen/android`. Commit-worthy generated Android project files can be added after the first successful build, while machine-specific `local.properties` remains ignored.

## Versioning

The Android port uses its own SemVer sequence, independent of the upstream Linux version. Run:

```bash
npm run version:check
```

before committing a release. The same version must exist in `VERSION`, `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`. Android `versionCode` increases monotonically for distributable builds.

See [CHANGELOG.md](CHANGELOG.md).

## Architecture

```text
TypeScript / Vite UI
        |
        v
Tauri commands + shared Rust KarinCore logic
        |
        +---------------- Linux ----------------+
        | systemd / route.sh / system Xray      |
        +----------------------------------------+
        |
        +--------------- Android ---------------+
          Tauri Android plugin
                 |
          Kotlin VpnService
                 |
             Android TUN
                 |
         AndroidLibXrayLite
                 |
              Xray-core
```

## Third-party code

The original KarinCore MIT license and copyright notice are preserved in [LICENSE](LICENSE).

Android Xray integration uses `2dust/AndroidLibXrayLite`, currently pinned to `v26.9.30`. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

MIT, following the upstream KarinCore project. See [LICENSE](LICENSE).
