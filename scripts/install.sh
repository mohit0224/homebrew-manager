#!/usr/bin/env bash
set -e

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==> Installing HomeBrew Manager...${NC}"

# Check macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo -e "${RED}Error: HomeBrew Manager is only supported on macOS.${NC}"
  exit 1
fi

APP_NAME="HomeBrew Manager"
APP_TARGET="/Applications/${APP_NAME}.app"
REPO="mohit0224/homebrew-manager"
DMG_URL="https://github.com/${REPO}/releases/latest/download/HomeBrew.Manager.dmg"

TMP_DIR="$(mktemp -d)"
DMG_PATH="${TMP_DIR}/${APP_NAME}.dmg"
MOUNT_DIR="${TMP_DIR}/mount"

cleanup() {
  if [ -d "$MOUNT_DIR" ]; then
    hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo -e "${BLUE}==> Downloading latest release...${NC}"
curl -fsSL -L "$DMG_URL" -o "$DMG_PATH"

echo -e "${BLUE}==> Mounting DMG...${NC}"
mkdir -p "$MOUNT_DIR"
hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_DIR" -nobrowse -quiet

APP_SRC=$(find "$MOUNT_DIR" -maxdepth 1 -name "*.app" | head -n 1)
if [ -z "$APP_SRC" ]; then
  echo -e "${RED}Error: Could not find .app in the mounted DMG.${NC}"
  exit 1
fi
APP_ACTUAL_NAME="$(basename "$APP_SRC")"
APP_TARGET="/Applications/${APP_ACTUAL_NAME}"

if [ -d "$APP_TARGET" ]; then
  rm -rf "$APP_TARGET"
fi
cp -R "$APP_SRC" /Applications/

echo -e "${BLUE}==> Unmounting DMG...${NC}"
hdiutil detach "$MOUNT_DIR" -quiet

echo -e "${BLUE}==> Removing quarantine flag...${NC}"
xattr -cr "$APP_TARGET"
codesign --force --deep --sign - "$APP_TARGET" 2>/dev/null || true

echo -e "${GREEN}==> Installation complete! Opening HomeBrew Manager...${NC}"
open "$APP_TARGET"
