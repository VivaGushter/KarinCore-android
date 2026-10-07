# Security and reliability audit — 2026-10-07

## Scope

The review covered the TypeScript renderer, Tauri/Rust command boundary, Android VPN plugin and service, Linux packaging and privilege escalation, dependency metadata, and GitHub Actions workflows.

## Remediated findings

### Critical

- Removed sudo rules that copied attacker-replaceable `/tmp` files as root or accepted wildcard route, firewall, and destination arguments.
- Added a fixed `/usr/libexec/karincore-helper` privilege boundary with bounded stdin, atomic root-owned writes, an operation allowlist, IP parsing, and strict Xray/OpenVPN/WireGuard validation.
- Blocked OpenVPN command hooks, plugins, nested configs, management interfaces, external key/certificate files, and credential-file directives before root execution.

### High

- Moved Android proxy profiles, subscription URLs, selected-profile state, and always-on reconnect configuration into AES-256-GCM storage backed by Android Keystore.
- Added safe one-time migration from WebView storage without deleting the legacy copy if protected persistence fails.
- Escaped renderer-controlled HTML and attributes, removed inline event handlers, and enabled a restrictive Tauri CSP.
- Restricted subscriptions to HTTPS without URL credentials, local names, or private/non-routable literal addresses.
- Added redirect-by-redirect validation, bounded 8 MiB streaming reads, DNS-address validation on Android, and DNS pinning on desktop to prevent rebinding between validation and connection.
- Replaced timestamp-derived proxy credentials with a 256-bit operating-system CSPRNG token and expanded diagnostic redaction.

### Medium

- Disabled Android application backup and kept the VPN service non-exported behind `BIND_VPN_SERVICE`.
- Corrected Android TUN MTU propagation, excluded VPN transports from upstream selection, and cleared invalid upstream networks on capability changes.
- Serialized protected-state writes to prevent stale asynchronous saves from winning.
- Restricted external browser opening to HTTPS links on the project GitHub host.
- Hardened the Linux systemd service and moved resolver backup/restore into the validated helper.
- Pinned third-party CI actions to commits, reduced default workflow permissions, separated release publication, and gated debug prereleases behind an explicit repository variable.

## Verification

- Full arm64 Android debug APK build: passed.
- TypeScript type-check and Vite production build: passed.
- Vitest renderer security tests: passed.
- Privileged-helper regression tests: passed.
- Rust Android-target unit-test compilation (`--no-run`): passed.
- Rust Clippy for the Android target with warnings denied (excluding expected cross-platform dead-code warnings): passed.
- `cargo fmt --check`, version consistency, JSON validation, shell syntax, and `git diff --check`: passed.
- `npm audit`: 0 vulnerabilities.
- `cargo audit`: 0 vulnerabilities; two upstream warnings remain (`proc-macro-error` unmaintained and a `glib` advisory inherited through the Linux Tauri/GTK stack).

## Environment limitation

The managed audit host does not contain Linux GTK/WebKit development packages, so the desktop-host Rust test binary could not be linked locally. Repository checks now install those packages and run the locked host tests, formatting, Clippy, and RustSec audit in CI. Android Rust/Kotlin linking and APK packaging were completed locally.
