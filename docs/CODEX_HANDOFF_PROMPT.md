# Codex handoff prompt: KarinCore Android

Work directly in this repository:

https://github.com/VivaGushter/KarinCore-android

The project is an Android port of upstream KarinCore. Continue the existing project; do not restart it, scaffold a replacement application, or redesign the architecture from scratch.

## Mandatory first steps

Before changing code:

1. Read VERSION.
2. Read README.md and README-ru.md.
3. Read CHANGELOG.md.
4. Read docs/TECHNICAL_HANDOFF.md.
5. Read docs/ROADMAP.md.
6. Read VERSIONING.md.
7. Inspect the latest commits on main.
8. Inspect .github/workflows/android-build.yml and repository-checks.yml.
9. Inspect src-tauri/src/lib.rs.
10. Inspect the complete custom plugin under src-tauri/tauri-plugin-karin-vpn/.
11. Inspect src/main.ts, index.html, src/styles.css and src/i18n.ts.

Treat the repository as the source of truth if this prompt and the current code ever differ.

Baseline when this handoff was prepared:
- version 0.1.0-alpha.20
- release code commit 755d0f10ce506f5a18fcc684d0dc275b0c026772
- both repository checks and full arm64 Android build were green
- GitHub prerelease v0.1.0-alpha.20 existed with an arm64 debug APK

The current main may contain later documentation-only commits. Always check VERSION and git history before working.

## Project objective

Maintain and mature KarinCore Android as a real Android VPN/proxy client while preserving the useful KarinCore UI and shared routing/subscription logic.

The Android architecture is:

TypeScript/Vite UI
-> Tauri commands
-> shared Rust logic
-> custom Tauri Android plugin
-> Kotlin VpnService
-> Android TUN
-> AndroidLibXrayLite
-> Xray-core

Do not replace this with a completely different application unless explicitly instructed.

## Current protocol support

Shared parsing:
- VLESS
- VLESS + Reality
- VMess
- Trojan
- Shadowsocks

Android:
- all of the above through Xray
- embedded WireGuard using Xray's userspace wireguard outbound
- wg://?payload=<base64-wg-quick-config>

Linux:
- preserve existing upstream Linux behavior

Android OpenVPN:
- not implemented
- do not implement it as a second VpnService
- do not start implementation until a design and license review are completed

## Android VPN constraints

There must be one system VpnService/TUN.

Current Android TUN:
- 172.19.0.2/30
- IPv4 default route
- fc00::172:19:0:2/126
- IPv6 default route
- DNS 1.1.1.1
- MTU 1500 normally
- MTU 1420 for WireGuard

AndroidLibXrayLite is pinned to v26.9.30 and receives the TUN fd through CoreController.startLoop(config, fd).

Never create a VPN loop. KarinCore/Xray upstream traffic must remain outside the TUN unless a new design explicitly protects sockets correctly.

Never disable TLS certificate verification to make subscription endpoints work.

## Existing Android features that must be preserved

- VPN permission prepare/start/stop/status
- foreground VpnService
- Activity/WebView does not stop VPN
- native-state restoration after UI recreation
- live native-state polling while UI is visible
- Wi-Fi/cellular handover recovery
- break-before-make recovery
- per-app All / Only selected / Bypass selected
- Android Always-on VPN support
- lockdown state/UI
- last-successful config persistence for Always-on restart
- foreground notification actions
- native Android subscription HTTP transport
- 25 second subscription UI watchdog
- subscription group refresh
- native VPN/Xray Logs
- diagnostics export
- built-in VPN self-test
- separate IPv4/IPv6 probes
- Android document picker
- Android-specific mobile layout
- project-specific update checker
- automatic GitHub prerelease publishing
- WireGuard Xray outbound
- APK symbol stripping that reduced debug APK size to about 74 MB

## Subscription rules

Android subscription fetching must continue through the Kotlin bridge.

Current limits:
- connect timeout about 8 seconds
- read/request timeout about 20 seconds
- 5 redirects
- 8 MiB max response
- gzip support
- TLS validation on
- frontend watchdog 25 seconds

Rust owns parsing after download.

Supported plain/Base64 links:
- vless://
- vmess://
- trojan://
- ss://
- wg://

Subscription group refresh must preserve IDs and pin state for unchanged URLs.

Do not log or export subscription URLs.

## Security and privacy requirements

Do not expose in logs, diagnostics, errors committed to files, or analytics:
- subscription URLs
- VLESS UUIDs
- Trojan passwords
- Shadowsocks credentials
- WireGuard private keys
- raw generated Xray configs containing secrets

Diagnostics may contain:
- app version
- device model
- Android version
- Xray version
- boolean/status state
- per-app mode/count
- redacted native logs

Keep proxy-URI redaction in diagnostics.

Do not add telemetry unless explicitly requested.

## Cross-platform rule

Shared Rust code still supports Linux.

Any Android-only behavior must be properly cfg-gated.

Do not regress:
- Linux systemd path
- Linux Xray path
- Linux OpenVPN
- Linux wg-quick WireGuard
- Linux desktop window behavior
- desktop TLS setup

Android reqwest uses Rustls.
Desktop reqwest uses native-tls/system-proxy.

## State/storage rule

The frontend currently uses localStorage/sessionStorage extensively.

Do not rename or delete existing karin_* keys without migration code.

Important state includes:
- groups
- links
- subscription sourceUrl
- selected profile
- active link hint
- routing zones
- routing profile presets
- DNS
- default outbound
- zone priority
- per-app mode/packages
- theme/language

When changing persistence structures, add schema/migration logic and tests.

## Version/release discipline

The Android port uses its own SemVer sequence.

For a release, synchronize:
- VERSION
- package.json
- src-tauri/Cargo.toml
- src-tauri/tauri-plugin-karin-vpn/Cargo.toml
- src-tauri/tauri.conf.json
- bundle.android.versionCode
- CHANGELOG.md
- README current version if applicable

Run:
npm run version:check

Development flow:
1. feature/fix commit
2. wait for Repository checks
3. wait for full Android build
4. fix failures before version bump
5. bump version/changelog only after feature build is green
6. release commit subject must start with: release:
7. let GitHub Actions create the tag/prerelease/APK
8. verify release and APK exist

Do not push a new commit while a release workflow is still building unless canceling it is intentional. The workflow uses branch concurrency and can cancel the previous run.

Do not commit libv2ray.aar.

## Documentation style

Repository documentation must be neutral project documentation.

Do not write phrases such as:
- "I added this for you"
- "you should now"
- "we discussed"
- references to ChatGPT/Codex as the author

README/changelog/docs should read as if maintained by the repository author/project.

A prompt/instruction file may use imperative language because it is intended for an agent.

## CI/build expectations

Before considering a feature complete:
- TypeScript/Vite build must pass
- Rust Android target must compile
- Kotlin/Gradle must compile
- full arm64 debug APK workflow must pass
- repository version checks must pass

The CI environment currently uses:
- Java 17
- Node 22
- SDK 36
- Build Tools 36.0.0
- NDK 27.0.12077973
- Rust aarch64-linux-android
- Gradle cache
- Rust cache

If CI fails because of an external/transient Android SDK download, distinguish infrastructure failure from source failure.

## Current real-device evidence

A real-device bug was found where adding a subscription remained forever on Loading.

The fix was:
- move Android subscription HTTP to native Kotlin
- retain TLS validation
- add bounded timeouts and response size
- add a frontend watchdog

Subscription addition was confirmed working after the fix.

Do not infer that all tunnel functions are therefore runtime-validated. Full VPN testing is still required.

## Immediate work priority

Use docs/ROADMAP.md as the main plan.

Priority order:
1. process real-device bug reports and diagnostics
2. validate VLESS/Reality end to end
3. validate DNS and IPv4/IPv6
4. validate per-app routing
5. validate Wi-Fi/cellular handover
6. validate Always-on/reboot/lockdown
7. validate WireGuard
8. validate subscription refresh
9. add parser/config/storage migration tests
10. only then design OpenVPN for Android

If there is no new real-device report, work on automated tests and storage migration infrastructure instead of adding a major new VPN transport blindly.

## How to handle a user-provided runtime bug

When a screenshot/log/diagnostic is supplied:
1. reproduce the code path from current source
2. identify whether failure is frontend, Tauri bridge, Rust, Kotlin VpnService, Xray or upstream network
3. add bounded failure behavior so UI cannot remain indefinitely stuck
4. avoid insecure workarounds
5. implement the smallest correct fix
6. run CI
7. bump version only after green feature build
8. document exact fix in CHANGELOG
9. publish via release workflow
10. state what must be retested on device

## Coding style

Prefer incremental changes.

Do not rewrite src-tauri/src/lib.rs merely because it is large. Refactor only when the refactor is testable and reduces risk.

Keep secrets out of logs.

Keep errors useful and bounded.

Use explicit platform cfg sections for Android vs desktop.

Preserve existing API names unless migration is implemented.

Avoid speculative architecture changes.

## First task for Codex

After reading the repository and handoff documents:

1. confirm the actual current VERSION and main HEAD
2. inspect the latest GitHub Actions results
3. compare current code against docs/ROADMAP.md
4. produce a short status note listing:
   - confirmed implemented items
   - current CI state
   - real-device validation still missing
   - next single work item
5. do not start OpenVPN
6. if no new runtime report is available, begin adding automated tests for parsing/config generation and a frontend storage schema/migration layer
7. keep all changes small enough to validate through the existing Android CI workflow

Continue from the existing project. Do not create a new repository or a new Android application.
