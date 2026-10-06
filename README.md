<div align="center">
  <img src="public/karincore-icon-main.png" alt="KarinCore" width="160"/>
  <h1>KarinCore Android</h1>
  <p>Android port of KarinCore powered by Tauri 2, Rust, Android VpnService and Xray-core.</p>
  <p><strong>Current version: 0.1.0-alpha.1</strong></p>
  <p><a href="README-ru.md">Русская версия</a></p>
</div>

## Status

This repository is an experimental Android port of [detestern/KarinCore](https://github.com/detestern/KarinCore), based on upstream KarinCore 1.3.7 at commit `b7fea2e2ff5e1492fd863381985fdebb4da7a57e`.

The shared KarinCore TypeScript UI and Rust parsing/routing logic are retained. Linux-specific tunnel setup is replaced on Android by a native `VpnService` bridge and Xray TUN integration.

The source tree has been prepared for Android, but `0.1.0-alpha.1` has **not yet been validated by a complete APK build on a real Android toolchain/device**. The first device build is the next verification step.

## Implemented in 0.1.0-alpha.1

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
- Android uses Rustls for `reqwest`; the desktop path keeps the upstream native TLS setup.

Not implemented yet on Android: OpenVPN/WireGuard chaining, per-app routing UI, Android-native log viewer, network handover/reconnect, mobile-specific layout polish and Android document-picker export.

## Build prerequisites

Install the normal Tauri Android prerequisites: Rust, Node.js, Android Studio, Android SDK/Platform Tools, Build Tools, NDK and Command-line Tools. Add the Android Rust targets:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Set `JAVA_HOME`, `ANDROID_HOME` and `NDK_HOME` for your machine.

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
