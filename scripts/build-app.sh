#!/usr/bin/env bash
set -e

# Project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "==> 1. Building React frontend..."
pnpm run build:frontend

echo "==> 2. Compiling native macOS App bundle..."
pnpm tauri build --bundles app

echo "==> 3. Generating DMG installer..."
mkdir -p dist-installer

DMG_STAGING="src-tauri/target/dmg_staging"
rm -rf "$DMG_STAGING"
mkdir -p "$DMG_STAGING"

# Copy .app and create Applications shortcut for drag and drop
cp -R "src-tauri/target/release/bundle/macos/HomeBrew Manager.app" "$DMG_STAGING/"
ln -s /Applications "$DMG_STAGING/Applications"

# Clear any extended attributes and ad-hoc sign the app inside staging
xattr -cr "$DMG_STAGING/HomeBrew Manager.app" 2>/dev/null || true
codesign --force --deep --sign - "$DMG_STAGING/HomeBrew Manager.app"

# Generate compressed DMG (both space and dot filenames for GitHub Release compatibility)
hdiutil create -volname "HomeBrew Manager" \
  -srcfolder "$DMG_STAGING" \
  -ov -format UDZO \
  "dist-installer/HomeBrew Manager.dmg"

cp -f "dist-installer/HomeBrew Manager.dmg" "dist-installer/HomeBrew.Manager.dmg"

# Clean temporary staging directory
rm -rf "$DMG_STAGING"

echo ""
echo "========================================================"
echo " BUILD COMPLETE!"
echo ""
echo " DMG Installer (Standard) : $ROOT_DIR/dist-installer/HomeBrew Manager.dmg"
echo " DMG Installer (GitHub)   : $ROOT_DIR/dist-installer/HomeBrew.Manager.dmg"
echo " App Bundle               : $ROOT_DIR/src-tauri/target/release/bundle/macos/HomeBrew Manager.app"
echo "========================================================"
