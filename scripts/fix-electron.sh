#!/bin/bash
# Some npm/Node versions skip or break Electron's download step
# ("Electron failed to install correctly"). This installs it by hand (macOS).
set -e
cd "$(dirname "$0")/../widget"
V=$(node -p "require('./node_modules/electron/package.json').version")
ARCH=$(uname -m); [ "$ARCH" = "x86_64" ] && ARCH=x64
echo "Installing Electron $V ($ARCH)…"
curl -L -o /tmp/electron.zip "https://github.com/electron/electron/releases/download/v$V/electron-v$V-darwin-$ARCH.zip"
rm -rf node_modules/electron/dist && mkdir node_modules/electron/dist
ditto -x -k /tmp/electron.zip node_modules/electron/dist
printf "Electron.app/Contents/MacOS/Electron" > node_modules/electron/path.txt
ls node_modules/electron/dist
