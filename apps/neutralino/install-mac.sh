#!/bin/bash
# 一键构建并安装「微信Markdown编辑器」到 /Applications/
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
APP_NAME="微信Markdown编辑器"
APP_PATH="/Applications/${APP_NAME}.app"
DIST_DIR="$SCRIPT_DIR/dist/md-editor"

echo "→ 构建 Web 应用..."
cd "$REPO_ROOT"
pnpm --filter @md/web build:neutralino

echo "→ 构建 Neutralino 发行包..."
cd "$SCRIPT_DIR"
neu build --release

echo "→ 创建 .app 包结构..."
rm -rf "$APP_PATH"
mkdir -p "$APP_PATH/Contents/MacOS"
mkdir -p "$APP_PATH/Contents/Resources"

# 根据当前架构选择二进制
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  BINARY="$DIST_DIR/md-editor-mac_arm64"
else
  BINARY="$DIST_DIR/md-editor-mac_x64"
fi

cp "$BINARY" "$APP_PATH/Contents/MacOS/$APP_NAME"
chmod +x "$APP_PATH/Contents/MacOS/$APP_NAME"

# resources.neu 必须与二进制文件放在同一目录
cp "$DIST_DIR/resources.neu" "$APP_PATH/Contents/MacOS/resources.neu"

# 生成图标
ICON_SRC="$REPO_ROOT/apps/web/public/mpmd/icon-256.png"
if [ -f "$ICON_SRC" ]; then
  ICONSET=$(mktemp -d)/AppIcon.iconset
  mkdir -p "$ICONSET"
  sips -z 16 16   "$ICON_SRC" --out "$ICONSET/icon_16x16.png" 2>/dev/null
  sips -z 32 32   "$ICON_SRC" --out "$ICONSET/icon_16x16@2x.png" 2>/dev/null
  sips -z 32 32   "$ICON_SRC" --out "$ICONSET/icon_32x32.png" 2>/dev/null
  sips -z 64 64   "$ICON_SRC" --out "$ICONSET/icon_32x32@2x.png" 2>/dev/null
  sips -z 128 128 "$ICON_SRC" --out "$ICONSET/icon_128x128.png" 2>/dev/null
  sips -z 256 256 "$ICON_SRC" --out "$ICONSET/icon_128x128@2x.png" 2>/dev/null
  sips -z 256 256 "$ICON_SRC" --out "$ICONSET/icon_256x256.png" 2>/dev/null
  iconutil -c icns "$ICONSET" -o "$APP_PATH/Contents/Resources/AppIcon.icns" 2>/dev/null || true
fi

cat > "$APP_PATH/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>org.doocs.md-editor</string>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
</dict>
</plist>
EOF

# 移除隔离标志，注册到 Launch Services
xattr -cr "$APP_PATH" 2>/dev/null || true
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP_PATH" 2>/dev/null || true

echo ""
echo "✓ 安装完成：$APP_PATH"
echo "  可通过 Spotlight (⌘Space) 搜索「微信Markdown」打开"
