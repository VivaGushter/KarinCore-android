#!/usr/bin/env bash
set -euo pipefail

VERSION="v26.9.30"
SHA256="cf71680b776b9ca583747ba652f816b047a655eab875d8951e6141636d88bbd6"
URL="https://github.com/2dust/AndroidLibXrayLite/releases/download/${VERSION}/libv2ray.aar"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -d "$ROOT/src-tauri/tauri-plugin-karin-vpn" ]]; then
    PLUGIN="$ROOT/src-tauri/tauri-plugin-karin-vpn"
else
    PLUGIN="$ROOT/tauri-plugin-karin-vpn"
fi
DEST="$PLUGIN/android/libs/libv2ray.aar"
mkdir -p "$(dirname "$DEST")"

echo "Downloading AndroidLibXrayLite ${VERSION}..."
curl -fL --retry 3 --retry-delay 2 "$URL" -o "$DEST.tmp"
echo "${SHA256}  $DEST.tmp" | sha256sum -c -
mv "$DEST.tmp" "$DEST"
echo "OK: $DEST"
