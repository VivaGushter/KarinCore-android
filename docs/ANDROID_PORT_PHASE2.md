# Android port notes: Phase 2

Version: `0.1.0-alpha.1`

## Data path

The existing frontend continues to call KarinCore Tauri commands such as `start_proxy`. On Android that command builds an Xray JSON configuration and forwards it to the native `karin-vpn` plugin.

```text
UI
 -> Rust start_proxy
 -> tauri-plugin-karin-vpn
 -> Kotlin KarinVpnPlugin
 -> KarinVpnService
 -> VpnService.Builder.establish()
 -> ParcelFileDescriptor.fd
 -> AndroidLibXrayLite CoreController.startLoop(config, fd)
 -> Xray TUN inbound
```

## Important Android differences

The Linux daemon, sudoers rules, iptables, `route.sh`, systemd and system Xray binary are not used by the Android connection path.

The Android service excludes KarinCore's own package from the VPN. Without that exclusion, Xray's outbound sockets can be captured by the same TUN they are trying to service, creating a routing loop.

Both IPv4 and IPv6 default routes are created. This is deliberate so IPv6-capable applications do not silently bypass an IPv4-only tunnel.

The foreground service is declared as `specialUse` for modern Android versions.

## Xray binary dependency

The repository does not commit the approximately 60 MB AAR. Run:

```bash
npm run android:core
```

The script downloads AndroidLibXrayLite `v26.9.30` and verifies:

```text
cf71680b776b9ca583747ba652f816b047a655eab875d8951e6141636d88bbd6
```

## Current verification boundary

Static integration has been prepared against the inspected KarinCore upstream source and current AndroidLibXrayLite API. A complete Gradle/Rust/NDK build has not yet been executed in the assistant environment, so compile-time and device-runtime fixes may still be required.
