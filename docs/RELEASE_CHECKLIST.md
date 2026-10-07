# Release checklist

This checklist defines the remaining work for the first production release. The current alpha workflow produces a debug-signed arm64 test APK and must not be treated as the stable release pipeline.

## 1. Release scope

- [ ] Decide whether OpenVPN is deferred and record the decision in release notes.
- [ ] Confirm that the first release is arm64-only or add and test the required ABIs.
- [ ] Choose GitHub Releases, Google Play, or both as distribution channels.
- [ ] Freeze the supported Android range and known limitations in [COMPATIBILITY.md](COMPATIBILITY.md).
- [ ] Close or explicitly defer every P0/P1 crash, connection, DNS or traffic-leak issue.

## 2. Real-device regression

Record device model, OEM, Android version, profile type, network type and result for every run.

- [ ] VLESS/Reality connects and passes IPv4, DNS and HTTPS traffic.
- [ ] VMess connects and passes the VPN self-test.
- [ ] Trojan connects and passes the VPN self-test.
- [ ] Shadowsocks connects and passes the VPN self-test.
- [ ] WireGuard `wg://` connects through the Xray userspace outbound.
- [ ] Subscription add, refresh, removal and error handling work.
- [ ] V2RayTun provider routing is imported, updated and applied only to its group.
- [ ] Wi-Fi to mobile and mobile to Wi-Fi handover recover without recreating TUN.
- [ ] Break-before-make network loss recovers after connectivity returns.
- [ ] Per-app allowlist and bypass modes route the intended applications.
- [ ] Always-on VPN starts after reboot.
- [ ] Lockdown does not silently bypass traffic during startup or failure.
- [ ] IPv4 and IPv6 behavior matches the selected route and does not expose an unintended path.
- [ ] Activity recreation, backgrounding and foreground notification actions work.
- [ ] Exported diagnostics contain useful state and no known secrets.

Minimum recommended coverage: one AOSP/Pixel device, one Samsung device and one device with an aggressive OEM background policy such as Xiaomi/HyperOS.

## 3. Production signing

- [ ] Generate a permanent upload/release keystore offline.
- [ ] Create an encrypted offline backup and document key custody and recovery.
- [ ] Store only encrypted/base64 keystore material and passwords in GitHub Secrets.
- [ ] Add a dedicated non-debug Gradle/Tauri release build.
- [ ] Ensure secrets are available only to the protected release job and never to pull requests.
- [ ] Produce a signed arm64 release APK and, if needed, an AAB.
- [ ] Verify the artifact with `apksigner verify --verbose --print-certs`.
- [ ] Record the signing certificate SHA-256 fingerprint in release notes.
- [ ] Test clean installation and an in-place upgrade signed by the same key.
- [ ] Confirm `android:debuggable=false` and review release optimization/R8 behavior.

## 4. Privacy and store material

- [x] Publish the project privacy policy: [PRIVACY.md](../PRIVACY.md).
- [x] Document supported platforms and known limitations.
- [x] Document the alpha-to-production signing transition.
- [ ] Review all user-facing translations against the final feature set.
- [ ] If publishing to Google Play, prepare Data safety answers, VPN-service declaration, screenshots, store description, contact details and a publicly accessible privacy-policy URL.
- [ ] Verify third-party notices and licenses against the exact shipped dependency versions.

## 5. Version and changelog

- [ ] Move relevant entries from `Unreleased` into the new version section in `CHANGELOG.md`.
- [ ] Update `VERSION`, `package.json`, `package-lock.json`, both Cargo manifests, `tauri.conf.json`, Android `versionCode`, README version references and generated metadata where applicable.
- [ ] Run `npm run version:check`.
- [ ] Use a beta SemVer while device validation is incomplete; reserve stable SemVer for the completed stable checklist.
- [ ] Make the release commit the final push until its workflow finishes because Android workflow concurrency cancels older runs.

## 6. Automated verification

- [ ] `npm ci`
- [ ] `npm audit`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run version:check`
- [ ] `cargo test --locked --manifest-path src-tauri/Cargo.toml --lib`
- [ ] `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- [ ] `cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
- [ ] `cargo audit`
- [ ] Complete signed Android release build in GitHub Actions.

## 7. Publication and post-release validation

- [ ] Create the version tag from the verified release commit.
- [ ] Publish release notes, signed APK/AAB, checksums and certificate fingerprint.
- [ ] Download the public artifact instead of using a local build and verify its signature and checksum.
- [ ] Install the downloaded artifact on a clean device.
- [ ] Test update detection and the release link from the installed application.
- [ ] Run one connection and VPN self-test using the published artifact.
- [ ] Preserve the build logs, source commit, dependency lockfiles and signing fingerprint.
- [ ] Monitor incoming crash, connection and update reports before starting the next release cycle.
