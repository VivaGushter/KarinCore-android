# Upgrading KarinCore Android

## Current alpha builds

GitHub prereleases currently contain debug-signed arm64 APKs. Debug signing is not a stable update channel: APKs built on different machines may have different certificates. If Android reports that the package conflicts with an installed application or that the update is incompatible, the old build must be removed before installing the new APK.

Uninstalling the application removes its private profiles, subscription URLs, routing settings and Android Keystore entries. Export any routing profiles and retain original subscription URLs and credentials before uninstalling. There is currently no complete encrypted backup/restore format for all application state.

## Compatible in-place update

When the installed APK and new APK use the same signing certificate and package ID, Android can install the new build over the old one. The application keeps its private storage and performs supported internal migrations at startup.

After an update:

1. Open KarinCore and confirm that subscription groups and profiles are present.
2. Refresh each subscription that supplies a V2RayTun `routing` header so the group stores the latest provider route.
3. Connect one profile and run the VPN self-test from Logs.
4. If Always-on VPN is enabled, open Android VPN settings and confirm that KarinCore is still selected.

## Transition to production signing

The first production-signed build will establish the permanent Android update identity. A debug-signed installation cannot be upgraded in place to a production-signed APK with the same package ID. The debug build must be uninstalled first unless a separately signed migration build is deliberately prepared.

After the production signing certificate is published, its SHA-256 fingerprint should be recorded in release notes and verified for every release. Losing or changing the production key can break future in-place updates.

## Downgrades

Downgrades are unsupported. Android normally blocks installation of a lower `versionCode`. Restoring an older build by uninstalling the current version removes application-private data.
