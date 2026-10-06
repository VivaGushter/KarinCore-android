# KarinCore Android: technical handoff

## 1. Project identity

KarinCore Android is an Android port of KarinCore built on Tauri 2, TypeScript/Vite, Rust, Android VpnService and Xray-core.

Project repository:
https://github.com/VivaGushter/KarinCore-android

Upstream repository:
https://github.com/detestern/KarinCore

Upstream base used for the port:
KarinCore 1.3.7, commit b7fea2e2ff5e1492fd863381985fdebb4da7a57e

Current Android version at handoff:
0.1.0-alpha.20

Release commit:
755d0f10ce506f5a18fcc684d0dc275b0c026772

Android application identifier:
com.vivagushter.karincore

Tauri Android plugin identifier:
com.vivagushter.karincore.vpn

Minimum Android SDK:
24

Compile SDK:
36

Current Android versionCode:
20

Current release artifact:
KarinCore-Android-v0.1.0-alpha.20-arm64-debug.apk

Current APK size:
approximately 73.7 MB

The alpha.20 release commit passes both repository checks and the full arm64 Android build workflow.

## 2. Licensing and third-party components

The original KarinCore project is MIT licensed. The upstream copyright and license are preserved in LICENSE.

Android Xray integration uses 2dust/AndroidLibXrayLite under LGPL-3.0.

Pinned AndroidLibXrayLite release:
v26.9.30

Pinned libv2ray.aar SHA-256:
cf71680b776b9ca583747ba652f816b047a655eab875d8951e6141636d88bbd6

The AAR is not committed to Git. It is downloaded by scripts/fetch-libv2ray.sh and verified before use.

OpenVPN must not be embedded until its selected implementation and license obligations are reviewed.

## 3. Technology stack

Frontend:
- TypeScript 5.6
- Vite 6
- HTML/CSS
- Tauri JavaScript API

Shared/native application layer:
- Rust 2021
- Tauri 2
- serde / serde_json
- url
- base64
- tokio
- reqwest

Android integration:
- Kotlin
- Android VpnService
- AndroidX Core
- AndroidX AppCompat
- Tauri Android plugin bridge
- AndroidLibXrayLite / Xray-core

Build/release:
- Node 22 in CI
- Java 17
- Android SDK 36
- Build Tools 36.0.0
- NDK 27.0.12077973
- Rust target aarch64-linux-android
- GitHub Actions
- automatic prerelease publishing for release commits

## 4. Repository structure

Important files and directories:

- VERSION
  Canonical Android project version.

- CHANGELOG.md
  Complete Android-port change history.

- VERSIONING.md
  Versioning rules.

- README.md / README-ru.md
  Public project documentation.

- docs/ANDROID_PORT_PHASE2.md
  Historical Android architecture notes.

- docs/NEXT_PHASE.md
  Short current phase status.

- docs/TECHNICAL_HANDOFF.md
  Detailed engineering handoff.

- docs/ROADMAP.md
  Current implementation and validation plan.

- docs/CODEX_HANDOFF_PROMPT.md
  Ready-to-use Codex continuation prompt.

- src/main.ts
  Main frontend logic, state, profiles, subscriptions, update checker, Android per-app routing UI, self-test and native-state synchronization.

- src/i18n.ts
  UI translations.

- src/styles.css
  Shared and Android-specific layout.

- index.html
  Main UI structure.

- src-tauri/src/lib.rs
  Shared Rust core plus platform-specific Tauri commands. Contains protocol parsing, subscription parsing, routing/DNS conversion, Linux backend and Android Xray configuration generation.

- src-tauri/src/main.rs
  Thin desktop wrapper calling karin_proxy_lib::run().

- src-tauri/tauri.conf.json
  Tauri application metadata and Android versionCode/minSdk.

- src-tauri/Cargo.toml
  Rust dependencies and target-specific TLS setup.

- src-tauri/tauri-plugin-karin-vpn/
  Custom Tauri mobile plugin bridging Rust to Android Kotlin.

- src-tauri/tauri-plugin-karin-vpn/android/src/main/java/KarinVpnPlugin.kt
  Android plugin commands: VPN permission, start/stop/status, installed-app discovery, document picker, native subscription HTTP transport, device info, logs and VPN settings.

- src-tauri/tauri-plugin-karin-vpn/android/src/main/java/KarinVpnService.kt
  Android foreground VpnService, TUN lifecycle, Xray lifecycle, Always-on support, network handover recovery, per-app routing, logs and notification actions.

- scripts/fetch-libv2ray.sh
  Downloads the pinned Xray Android AAR and verifies SHA-256.

- scripts/check-version.py
  Checks release version consistency.

- .github/workflows/android-build.yml
  Full arm64 APK build and automatic GitHub prerelease publishing.

- .github/workflows/repository-checks.yml
  Version consistency and JSON validation.

## 5. High-level architecture

Data flow:

TypeScript / Vite UI
  -> Tauri commands
  -> shared Rust parsing/routing/config generation
  -> custom Tauri Android plugin
  -> Kotlin VpnService
  -> Android TUN file descriptor
  -> AndroidLibXrayLite
  -> Xray-core

Linux and Android share the frontend and a substantial part of the Rust parsing/routing logic, but the tunnel lifecycle is platform-specific.

Linux retains the upstream systemd, route.sh, system Xray, OpenVPN and wg-quick architecture.

Android uses one Android VpnService and one Android-managed TUN. Linux-specific sudo/systemd/iptables/tun management must not be reused on Android.

## 6. Android VPN architecture

Android VpnService creates the only system VPN interface.

Current TUN parameters:
- session: KarinCore
- IPv4 address: 172.19.0.2/30
- IPv4 default route: 0.0.0.0/0
- IPv6 address: fc00::172:19:0:2/126
- IPv6 default route: ::/0
- Android DNS server entry: 1.1.1.1
- setMetered(false) on Android Q+
- default MTU: 1500
- WireGuard profile MTU: 1420

AndroidLibXrayLite receives the TUN file descriptor through CoreController.startLoop(configJson, fd). AndroidLibXrayLite internally sets xray.tun.fd.

Xray Android configuration contains:
- tun-in inbound using protocol tun
- ping-in mixed inbound on 127.0.0.1:2082
- random per-session authentication token for ping-in
- proxy outbound generated from the selected profile
- direct freedom outbound
- block blackhole outbound
- dns-out DNS outbound

Important routing rules:
1. TUN port 53 -> dns-out
2. ping-in -> proxy
3. loopback and optionally LAN/private ranges -> direct
4. user Direct/Proxy/Block rules
5. final tcp,udp fallback -> selected default outbound

Xray routing domain strategy:
IPIfNonMatch

TUN sniffing:
http, tls, quic

The KarinCore Android package must remain outside its own VPN unless a future architecture explicitly protects Xray upstream sockets another way. Capturing the package itself would create a VPN -> Xray -> VPN loop.

## 7. Supported proxy/profile protocols

Shared URI parsing currently supports:
- VLESS
- VLESS + Reality
- VMess
- Trojan
- Shadowsocks

Android additionally supports embedded WireGuard using Xray's built-in userspace WireGuard outbound.

WireGuard input form:
wg://?payload=<base64-wg-quick-config>

WireGuard Android fields currently parsed:
Interface:
- PrivateKey
- Address
- DNS
- MTU
- Reserved

Peer:
- PublicKey
- PresharedKey
- Endpoint
- AllowedIPs
- PersistentKeepalive
- Reserved

Android WireGuard behavior:
- Xray outbound protocol is wireguard
- noKernelTun is true
- the Android VpnService remains the only system TUN
- default WireGuard MTU is 1420
- remote DNS defaults to 1.1.1.1 and 1.0.0.1 if absent
- missing Peer AllowedIPs defaults to IPv4 and IPv6 full route

Linux WireGuard behavior remains the upstream wg-quick path.

OpenVPN:
- supported by the Linux code path
- explicitly rejected by Android start_proxy
- not implemented on Android
- must not be implemented as a second VpnService

## 8. Subscription system

Supported subscription response forms:
- plain URI list
- Base64 encoded URI list
- JSON configuration
- Base64 encoded JSON configuration

Plain/Base64 URI parser accepts:
- vless://
- vmess://
- trojan://
- ss://
- wg://

The JSON converter currently extracts VLESS outbounds and can import routing and DNS metadata from compatible Xray-style JSON.

Subscription imports can merge:
- routing zones
- DNS settings

Android transport is native Kotlin, not Rust reqwest.

Android subscription fetch properties:
- HttpURLConnection / HttpsURLConnection
- background executor
- TLS validation stays enabled
- connect timeout approximately 8 seconds
- read/request timeout approximately 20 seconds
- maximum 5 redirects
- maximum response size 8 MiB
- gzip decoding
- explicit timeout/connect/TLS errors
- frontend has a separate 25 second watchdog

Do not disable TLS certificate validation as a workaround.

Subscription groups store their source URL in frontend local storage.

Starting with alpha.20, existing subscription groups can be refreshed:
- refresh reuses native Android subscription transport
- matching profiles are matched by URL
- stable IDs and pin state are kept when the URL is unchanged
- new server profiles are added
- removed server profiles disappear from the group
- routing/DNS imports are merged again
- an active removed profile is not force-disconnected
- an inactive selected profile that disappears is cleared from selection

Older groups without a stored source URL continue to work but do not expose Refresh until re-added.

## 9. Routing and DNS

UI routing zones:
- direct
- proxy
- block

The frontend stores:
- routing rules per zone
- zone priority
- default outbound
- LAN proxy toggle
- DNS configuration
- reusable route profiles

Rust converts UI routing state into Xray routing rules.

When Proxy LAN is disabled, these ranges are forced direct on Android:
- 10.0.0.0/8
- 172.16.0.0/12
- 192.168.0.0/16
- fc00::/7
- fe80::/10
- 127.0.0.0/8 is always direct

DNS packets entering the TUN on port 53 are sent to Xray dns-out.

Default frontend DNS profile values include:
- domestic DoH: https://dns.yandex.ru/dns-query, bootstrap 77.88.8.8
- remote DoH: https://1.1.1.1/dns-query, bootstrap 1.1.1.1

## 10. Per-app split tunneling

Android exposes three modes:
- all
- allowlist: Only selected
- denylist: Bypass selected

Installed launchable apps are discovered natively from Android package manager.

Android 11+ package visibility is handled through a MAIN/LAUNCHER queries entry in the plugin manifest.

VpnService.Builder applies:
- addAllowedApplication for allowlist
- addDisallowedApplication for denylist
- KarinCore itself remains outside the VPN

Missing/uninstalled package names are filtered before TUN establishment.

Allowlist mode requires at least one valid installed package.

Frontend stores:
- karin_app_routing_mode
- karin_app_packages

## 11. Network handover and recovery

Android P+ underlying networks are monitored through ConnectivityManager.

The service handles:
- make-before-break transitions
- break-before-make transitions
- Wi-Fi to cellular
- cellular to Wi-Fi

On upstream change:
- Android TUN stays established
- Xray core is restarted in place using the existing TUN fd
- reload is debounced
- up to three restart attempts are made
- reconnecting state is exposed to the frontend
- failures are logged and surfaced through lastError

The frontend also polls native VPN status every 2.5 seconds while visible.

The monitor:
- pauses while the app is hidden
- resumes when visible
- suppresses overlapping polls
- rerenders only when native state changes
- clears stale frontend active-connection markers if the service is no longer active

## 12. Activity/WebView lifecycle

Closing/recreating the Tauri WebView must not stop the VPN.

The old desktop beforeunload stop_proxy behavior was removed for Android.

On app reopen:
- frontend asks native VpnService for runtime state
- running/starting/coreRunning/reconnecting are restored
- active profile hint is restored from persisted frontend state
- stale frontend active markers are removed if native VPN is inactive

Native VpnService is authoritative for Android connection state.

## 13. Always-on VPN and Android system Kill Switch

KarinCore declares support for Android Always-on VPN.

The last successfully started native connection state is stored in app-private SharedPreferences:
- generated Xray config JSON
- MTU
- per-app routing mode
- selected app packages

If Android starts VpnService itself for Always-on, including after reboot, KarinCore can restore this persisted connection.

Only a configuration that successfully reached running Xray state is persisted.

A user-requested profile change clears the old persisted config before trying the new one, preventing an old profile from unexpectedly returning after reboot.

VPN permission revocation clears persisted restart state.

Android system states exposed to UI:
- Always-on
- lockdown / Block connections without VPN

KarinCore does not attempt to enable lockdown programmatically. User/device policy remains authoritative.

When Always-on is enabled:
- manual service stop is rejected
- UI directs the user to Android VPN Settings
- foreground notification shows VPN Settings instead of Disconnect

Desktop iptables Kill Switch is not used as Android's system Kill Switch.

## 14. Foreground notification

KarinCore runs as a modern Android foreground service with specialUse subtype.

Notification:
- uses KarinCore monochrome notification resource
- is ongoing and private
- opens the app when tapped
- Disconnect action when Always-on is disabled
- VPN Settings action when Always-on is enabled
- localized connection/reconnect/error states

Service-level stop requests are ignored while Always-on is active.

## 15. Logging, diagnostics and self-test

Android service maintains a bounded in-memory VPN/Xray log buffer.

Maximum:
500 lines

Logged events include:
- VPN start/stop
- Xray initialization
- Xray status callbacks
- per-app routing state
- network handover
- reconnect attempts
- errors

Logs are displayed in the existing Logs page.

Diagnostics export:
- uses Android document picker
- includes app version
- CPU architecture
- manufacturer/brand/model/device
- Android release and SDK
- Xray core version
- VPN lifecycle state
- Always-on/lockdown
- TUN presence
- per-app routing mode and package count
- last native error
- bounded native logs

Privacy behavior:
- subscription URLs are not exported
- generated Xray configuration is not exported
- proxy URI-bearing log lines are redacted
- selected package names are not exported

Built-in VPN self-test checks:
- native VpnService state
- Xray core state
- TUN presence
- reconnect state
- Always-on/lockdown
- per-app mode/count
- native lastError
- forced proxy-path HTTPS connectivity
- external IP
- separate IPv4 proxy path
- separate IPv6 proxy path

IPv4 probe:
https://api4.ipify.org

IPv6 probe:
https://api6.ipify.org

Latency/connectivity probe:
Cloudflare HTTPS 204 endpoint

IPv6 unavailability is informational; IPv4 and forced proxy path are required for the main passing result.

## 16. Frontend persistent state

Important localStorage/sessionStorage state includes:
- karin_theme
- karin_lang
- karin_selected_profile
- karin_active_link
- karin_allow_server_proxy
- karin_allow_proxy_lan
- karin_app_routing_mode
- karin_app_packages
- karin_zone_priority
- karin_default_outbound
- karin_groups
- karin_links
- karin_routing
- karin_route_profiles
- DNS state keys used by the UI
- desktop kill-switch setting

Subscription group records can contain sourceUrl.

Do not casually rename/remove storage keys. Add explicit migration logic when storage structures change.

## 17. Update system

The Android fork has its own update channel.

Project update repository:
VivaGushter/KarinCore-android

The frontend does not use upstream detestern/KarinCore as an update source.

Update check reads:
https://raw.githubusercontent.com/VivaGushter/KarinCore-android/main/VERSION

The frontend contains prerelease-aware version comparison, so alpha and beta versions can be detected.

Update link targets the exact tag:
https://github.com/VivaGushter/KarinCore-android/releases/tag/v<version>

Upstream KarinCore remains attribution/source material only.

## 18. Versioning and release workflow

Android port versions are independent from upstream.

Current stream:
0.1.0-alpha.N

Required synchronized version fields:
1. VERSION
2. package.json
3. src-tauri/Cargo.toml
4. src-tauri/tauri-plugin-karin-vpn/Cargo.toml
5. src-tauri/tauri.conf.json
6. bundle.android.versionCode
7. CHANGELOG.md

Run:
npm run version:check

Normal development pattern:
1. feature/fix commit
2. wait for Repository checks and Android build to pass
3. bump version and changelog
4. create a commit whose subject starts with release:
5. CI builds the APK
6. CI creates/updates GitHub tag and prerelease
7. APK is attached to the release

The Android workflow publishes prereleases automatically when the release commit succeeds.

Do not manually publish an unrelated APK with a mismatched VERSION.

## 19. CI configuration

Repository checks:
- version consistency
- package.json validation
- tauri.conf.json validation
- capabilities JSON validation

Android build:
- Ubuntu GitHub runner
- Java 17
- Gradle cache
- Android SDK 36
- Build Tools 36.0.0
- NDK 27.0.12077973
- SDK/NDK install retry logic
- stable Rust with aarch64-linux-android
- Rust cache
- Node 22
- npm ci
- download and SHA verify AndroidLibXrayLite
- version consistency check
- Tauri Android init
- arm64 debug APK build
- workflow artifact upload
- GitHub prerelease publishing for release commits

Concurrency cancels older in-progress builds on the same branch. Do not push a new commit while a release commit is still building unless canceling that release is intentional.

## 20. Build commands

First checkout:

~~~bash
git clone https://github.com/VivaGushter/KarinCore-android.git
cd KarinCore-android
npm install
npm run android:core
npm run android:init
npm run android:dev
~~~

Build APK:

~~~bash
npm run android:core
npm run version:check
npm run tauri -- android build --apk --target aarch64 --debug --ci
~~~

Android Rust targets for local development:

~~~bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
~~~

The current CI/release artifact is arm64 only.

## 21. APK size work

Earlier debug APKs were approximately 230 MB because Rust native debug/symbol information was packaged.

Current Cargo dev profile:
- debug = 0
- strip = symbols

This reduced the APK to approximately 73.7 MB.

Approximate major native library sizes after stripping:
- libkarin_proxy_lib.so about 20.7 MB
- Xray libgojni.so about 34.3 MB

The package remains debug-signed/installable for alpha testing.

Do not remove application/runtime diagnostics when optimizing binary symbols.

## 22. Current real-device validation status

Confirmed on a real Android device:
- the previous infinite Loading state during subscription addition was reproduced
- alpha.11 native Android subscription transport fixed that problem
- subscription addition works after the fix

Not yet fully confirmed in the handoff conversation:
- VLESS/Reality tunnel end-to-end browsing
- DNS behavior under all routing profiles
- IPv4 and IPv6 leak behavior
- per-app allowlist and bypass behavior
- Wi-Fi/cellular handover on device
- Always-on after reboot
- lockdown behavior
- WireGuard embedded outbound on device
- subscription refresh behavior on device
- notification actions on OEM firmware

Treat compile-green as necessary but not equivalent to real-device runtime validation.

## 23. Key historical milestones

alpha.1:
Initial Android VpnService/Xray architecture.

alpha.2:
First CI-built Android APK.

alpha.3:
Wi-Fi/cellular network handover recovery.

alpha.4:
Per-app split tunneling.

alpha.5:
Native VPN/Xray logs.

alpha.6:
Mobile layout and Android document export.

alpha.7:
Runtime hardening and network-loss recovery.

alpha.8:
UI state restoration from native VpnService.

alpha.9:
Always-on VPN and Android lockdown integration.

alpha.10:
Bounded subscription HTTP loading.

alpha.11:
Native Kotlin subscription transport and frontend watchdog. Real-device subscription loading confirmed fixed.

alpha.12:
Android-fork update channel and automatic GitHub releases.

alpha.13:
Privacy-safe diagnostics export.

alpha.14:
Foreground notification actions.

alpha.15:
Built-in VPN self-test.

alpha.16:
Live native VPN state synchronization in UI.

alpha.17:
Separate IPv4/IPv6 self-test and notification resource polish.

alpha.18:
Embedded Android WireGuard outbound through Xray.

alpha.19:
APK size reduction from roughly 230 MB to roughly 74 MB.

alpha.20:
Refreshable subscription groups with stable profile IDs/pin state.

## 24. Critical engineering invariants

These rules should be treated as architecture constraints unless deliberately redesigned:

1. Android must have one system VpnService/TUN.
2. KarinCore/Xray upstream sockets must not loop into their own TUN.
3. Never disable TLS certificate verification to make subscriptions work.
4. Never expose subscription URLs, private keys, VLESS UUIDs, Trojan passwords, Shadowsocks credentials or WireGuard private keys in diagnostics.
5. Preserve Linux behavior when changing shared Rust code unless the change is explicitly cross-platform.
6. Use cfg(target_os = "android") for Android-specific Rust behavior.
7. The native VpnService is authoritative for Android runtime connection state.
8. Activity/WebView lifecycle must not implicitly stop the VPN.
9. Always-on restoration must use only a previously successful config.
10. Do not run OpenVPN as a second Android VPN service.
11. Keep version metadata synchronized.
12. Do not commit libv2ray.aar.
13. Release commits must not be pushed while a prior release workflow is still building unless cancellation is intended.
14. Documentation in the repository must be project-neutral, not conversational.

## 25. Known risks and technical debt

- Most Android runtime behavior is compile/CI validated but not yet broadly device validated.
- OEM Android power management may affect long-running foreground service behavior.
- Always-on and lockdown differ in UX across OEM firmware.
- IPv6 availability varies by carrier/network.
- The current Android release is arm64 only.
- Debug signing is still used for alpha APKs.
- OpenVPN on Android is unresolved.
- The shared Rust file src-tauri/src/lib.rs remains large and contains both platform implementations. Future refactoring can improve maintainability, but should be incremental to avoid destabilizing the working port.
- Frontend state is mostly localStorage-based and currently has no formal storage schema version/migration framework.
- Subscription JSON conversion is not a universal arbitrary-Xray-config importer; its conversion logic is intentionally limited.
- Current tests are mostly CI compile/build plus runtime self-test. Parser/config-generation unit coverage should be expanded.
- The Xray AAR is pinned and should be upgraded deliberately, with API and runtime regression testing.

## 26. Current priority

The project has reached the point where real-device evidence has higher value than adding large new features blindly.

Immediate priority order:
1. real-device VLESS/Reality end-to-end validation
2. DNS and IPv4/IPv6 leak validation
3. per-app routing validation
4. Wi-Fi/cellular handover validation
5. Always-on + reboot + lockdown validation
6. embedded WireGuard validation
7. subscription refresh validation
8. fix runtime findings
9. increase automated parser/config tests
10. design Android OpenVPN support only after the core VPN path is stable
