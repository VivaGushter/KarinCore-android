# KarinCore Android roadmap after 0.1.0-alpha.20

## Current baseline

Version:
0.1.0-alpha.20

Code release commit:
755d0f10ce506f5a18fcc684d0dc275b0c026772

The baseline has:
- green Repository checks
- green full arm64 Android APK build
- automatic GitHub prerelease
- VLESS/Reality, VMess, Trojan, Shadowsocks
- embedded Android WireGuard through Xray
- per-app routing
- subscription import and refresh
- Android native subscription HTTP transport
- Always-on/lockdown integration
- handover recovery
- native logs
- diagnostics export
- VPN self-test including IPv4/IPv6
- live UI/native-state synchronization
- APK reduced to approximately 74 MB

## Phase A: real-device validation

Priority: highest.

### A1. Basic VLESS/Reality tunnel

Test:
- clean install
- add subscription
- select known-good VLESS/Reality profile
- grant VPN permission
- connect
- open HTTPS websites
- run self-test
- verify external IP
- disconnect

Pass criteria:
- no app hang
- VpnService running
- Xray running
- TUN present
- forced proxy HTTPS passes
- IPv4 probe passes
- browsing works
- disconnect removes system VPN state when Always-on is disabled

Artifacts on failure:
- exported diagnostics
- screenshot
- Android version/device model
- exact test step
- whether Wi-Fi or cellular was active

### A2. DNS

Test:
- domestic/remote DNS defaults
- imported subscription DNS
- routing profile DNS
- domain rules that require DNS resolution

Pass criteria:
- no DNS leak caused by bypassing Xray DNS handling
- domain routing matches configured zone
- DNS continues after Wi-Fi/cellular transition

### A3. IPv4 and IPv6

Test on:
- IPv4-only network if available
- dual-stack Wi-Fi
- mobile network with IPv6 if available

Pass criteria:
- IPv4 proxy-path probe passes
- IPv6 probe passes when upstream/proxy supports IPv6
- IPv6 absence is reported cleanly, not treated as app failure
- no direct IPv6 leak when traffic is expected through VPN

### A4. Per-app routing

Test all three modes:
- All apps
- Only selected
- Bypass selected

Pass criteria:
- selected apps follow the configured mode
- KarinCore/Xray does not loop into its own VPN
- removed/uninstalled packages are ignored safely
- mode survives app restart

### A5. Network handover

Scenarios:
- Wi-Fi -> LTE/5G
- LTE/5G -> Wi-Fi
- Wi-Fi disappears before cellular becomes available
- airplane mode on/off

Pass criteria:
- Android TUN remains coherent
- Xray recovers without a direct-traffic fallback
- UI shows reconnecting
- connectivity returns without manually reopening the app

### A6. Always-on and lockdown

Test:
- enable Always-on VPN
- reboot
- verify automatic restoration
- enable Block connections without VPN
- force-stop/restart scenarios allowed by Android
- open notification action

Pass criteria:
- previously successful profile restores
- stale failed profile is never resurrected
- manual disconnect behavior is understandable
- lockdown does not create an unrecoverable UI loop
- Android VPN Settings action works

### A7. WireGuard

Use a known-good wg-quick config.

Test:
- manual wg:// payload
- subscription-provided wg:// profile
- DNS
- IPv4/IPv6
- handover
- per-app routing

Pass criteria:
- Xray userspace WireGuard outbound works through the single Android VpnService
- no second system TUN is created
- noKernelTun behavior remains intact

### A8. Subscription refresh

Test:
- add subscription
- pin profile
- refresh unchanged subscription
- refresh with one added profile
- refresh with one removed profile
- refresh while removed profile is active

Pass criteria:
- stable URL keeps profile ID and pin state
- server additions/removals are reflected
- active removed profile is not force-disconnected
- inactive removed selected profile is cleared
- routing/DNS imports merge as expected

## Phase B: runtime fixes and automated tests

After Phase A results, fix runtime bugs before adding major transports.

Add tests for:
- flexible Base64 decoding
- VLESS parsing
- VMess parsing
- Trojan parsing
- Shadowsocks parsing
- WireGuard wg-quick parser
- WireGuard Xray outbound generation
- subscription plain/Base64 parsing
- JSON subscription conversion
- routing zone conversion
- DNS conversion
- version comparison
- subscription refresh ID preservation logic

Prefer pure unit tests for parsing/config generation.

Do not require Android instrumentation for logic that can be tested in Rust/TypeScript.

## Phase C: storage and migration hardening

Introduce a storage schema version for frontend localStorage state.

Goals:
- deterministic migrations
- no silent data loss
- preserve old profiles/groups/routing
- validate malformed stored data
- migration tests

Do not rename existing karin_* keys without migration.

## Phase D: release engineering

Before beta:
- establish release signing strategy
- never change package signing identity after public distribution without a migration plan
- produce release-signed APK
- consider AAB if store distribution requires it
- decide supported ABIs
- consider arm64 + x86_64 for emulator/testing
- verify minSdk 24 remains intentional
- verify target/compile SDK requirements for intended stores
- verify foreground-service declarations against current Android policies
- produce reproducible release notes
- preserve automatic GitHub release publication

## Phase E: Android OpenVPN design

OpenVPN is not an immediate implementation task.

First produce a design document covering:
- selected OpenVPN engine/library
- license obligations
- how packets integrate with the existing single VpnService
- whether OpenVPN is a direct outbound, transport layer or chained transport
- how Xray routing interacts with it
- DNS ownership
- per-app behavior
- handover behavior
- Always-on behavior
- shutdown/recovery
- APK size impact
- ABI impact

Constraints:
- do not create a second competing VpnService
- do not copy the Linux openvpn process architecture directly
- perform license review before adding a dependency

Implementation starts only after the design is accepted.

## Phase F: UI polish

Use real-device screenshots/issues rather than speculative redesign.

Targets:
- small phones
- gesture navigation
- cutouts/safe areas
- landscape
- long profile names
- large subscription groups
- app selector performance
- Logs page ergonomics
- self-test readability
- About/update presentation
- notification behavior

Keep the visual identity of KarinCore unless a redesign is explicitly requested.

## Phase G: beta criteria

Move from alpha to beta only when:

- VLESS/Reality verified on multiple real devices/networks
- VMess/Trojan/Shadowsocks at least smoke-tested
- WireGuard verified
- DNS verified
- IPv4 leak behavior verified
- IPv6 behavior verified
- per-app routing verified
- handover verified
- Always-on + reboot verified
- lockdown verified
- subscription add/refresh verified
- diagnostics/self-test proven useful
- no known data-loss migration bug
- release signing plan exists
- automated parser/config tests cover critical transformations

Suggested first beta:
0.1.0-beta.1

## Phase H: stable criteria

0.1.0 stable should require:
- beta feedback resolved
- stable signing
- documented supported Android range
- documented supported protocols
- known limitations published
- release APK verified from a clean device
- no critical VPN leak or routing issue

1.0.0 should be reserved for a mature Android product, not merely a build that launches.

## Development workflow

For each feature/fix:

1. inspect current main and VERSION
2. make a focused feature/fix commit
3. run repository checks
4. run full Android arm64 build
5. if CI fails, fix before bumping version
6. when feature is green, bump synchronized version metadata
7. add CHANGELOG entry
8. commit with subject beginning with release:
9. wait for automatic GitHub prerelease and APK attachment
10. verify the release exists and asset name/version match

Avoid multiple release commits without validating the previous release workflow because branch concurrency can cancel the older build.

## Immediate next action

Do not begin OpenVPN first.

The next work item should be driven by real-device alpha.20 testing. If no runtime report is available, prioritize automated parser/config tests and storage migration infrastructure rather than adding another tunnel stack.
