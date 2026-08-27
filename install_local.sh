#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================="
echo " Packaging ROCm GPU Monitor Application..."
echo "=========================================="

# Build and package the electron application
npm run package

echo "=========================================="
echo " Installing locally to user applications..."
echo "=========================================="

INSTALL_DIR="$HOME/.local/share/rocm-monitor"
DESKTOP_DIR="$HOME/.local/share/applications"

# Ensure directories exist
mkdir -p "$INSTALL_DIR"
mkdir -p "$DESKTOP_DIR"

echo "Copying binaries and assets to: $INSTALL_DIR"
# Clean previous installation if any
rm -rf "$INSTALL_DIR"/*
# Copy packaged distribution contents
cp -r dist/rocm-monitor-linux-x64/* "$INSTALL_DIR"/

echo "Creating Linux Desktop shortcut..."
cat <<EOF > "$DESKTOP_DIR/rocm-monitor.desktop"
[Desktop Entry]
Name=ROCm GPU Monitor
Comment=Monitor AMD GPU temperature, power, and usage in real-time
Exec=$INSTALL_DIR/rocm-monitor --no-sandbox
Icon=utilities-system-monitor
Terminal=false
Type=Application
Categories=System;Monitor;Development;
StartupNotify=true
EOF

# Mark desktop shortcut executable
chmod +x "$DESKTOP_DIR/rocm-monitor.desktop"

echo "=========================================="
echo " 🎉 Local Installation Completed successfully!"
echo "=========================================="
echo "You can now find and launch 'ROCm GPU Monitor' in your Linux applications dashboard."
echo "=========================================="
