#!/bin/bash

# Exit on any error
set -e

echo "=== Cleaning previous builds ==="
rm -rf dist

echo "=== Creating build directory structure ==="
mkdir -p dist/rocm-monitor-linux-x64

echo "=== Copying Electron prebuilt binary templates ==="
cp -r node_modules/electron/dist/* dist/rocm-monitor-linux-x64/

echo "=== Customizing application binary name ==="
mv dist/rocm-monitor-linux-x64/electron dist/rocm-monitor-linux-x64/rocm-monitor

echo "=== Removing default Electron screen ==="
rm -f dist/rocm-monitor-linux-x64/resources/default_app.asar

echo "=== Embedding application source code ==="
mkdir -p dist/rocm-monitor-linux-x64/resources/app
cp package.json main.js preload.js index.html renderer.js styles.css dist/rocm-monitor-linux-x64/resources/app/

echo "=== Bundling dependencies ==="
mkdir -p dist/rocm-monitor-linux-x64/resources/app/node_modules/chart.js
cp -r node_modules/chart.js/dist dist/rocm-monitor-linux-x64/resources/app/node_modules/chart.js/
cp node_modules/chart.js/package.json dist/rocm-monitor-linux-x64/resources/app/node_modules/chart.js/

echo "=== Packaging successfully completed! ==="
