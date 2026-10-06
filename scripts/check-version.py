#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

expected = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
package_version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
tauri = json.loads((ROOT / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8"))
tauri_version = tauri["version"]

cargo = (ROOT / "src-tauri" / "Cargo.toml").read_text(encoding="utf-8")
match = re.search(r'(?ms)^\[package\].*?^version\s*=\s*"([^"]+)"', cargo)
if not match:
    raise SystemExit("Could not read [package] version from src-tauri/Cargo.toml")
cargo_version = match.group(1)

versions = {
    "VERSION": expected,
    "package.json": package_version,
    "src-tauri/Cargo.toml": cargo_version,
    "src-tauri/tauri.conf.json": tauri_version,
}

bad = {path: version for path, version in versions.items() if version != expected}
if bad:
    print(f"Expected version: {expected}", file=sys.stderr)
    for path, version in versions.items():
        print(f"{path}: {version}", file=sys.stderr)
    raise SystemExit(1)

code = tauri.get("bundle", {}).get("android", {}).get("versionCode")
if not isinstance(code, int) or code < 1:
    raise SystemExit("bundle.android.versionCode must be a positive integer")

print(f"Version OK: {expected} (Android versionCode {code})")
