# Versioning

KarinCore Android uses an independent SemVer stream.

- `0.x.y-alpha.n`: development snapshots. APIs and storage may change.
- `0.x.y-beta.n`: feature-complete test builds intended for broader device testing.
- `0.x.y`: stable release.
- `1.0.0`: first stable Android release with the core target feature set.

Every release bump must update:

1. `VERSION`
2. `package.json`
3. `src-tauri/Cargo.toml`
4. `src-tauri/tauri.conf.json`
5. Android `bundle.android.versionCode` for distributable builds
6. `CHANGELOG.md`

Run `python scripts/check-version.py` or `npm run version:check` before a release commit.
