# Android port notes: Phase 2

Version: `0.1.0-alpha.2`

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

The Android service keeps KarinCore's own package outside the VPN. In All apps and Bypass selected modes it is explicitly excluded. In Only selected mode it is never added to the allowlist. This prevents Xray's outbound sockets from being captured by the TUN they are trying to service.

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

Static integration is based on KarinCore upstream 1.3.7 and the pinned AndroidLibXrayLite API. The full arm64 debug APK build completes successfully in GitHub Actions. Per-app routing, both network handover modes, native VPN/Xray event logs, Android document export, mobile layout, UI state restoration and Always-on VPN restart support are compile-validated. Real-device installation, tunnel establishment and traffic validation remain pending.
