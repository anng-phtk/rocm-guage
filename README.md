# AMD ROCm GPU Monitor

A lightweight, beautiful, and interactive Electron application to monitor AMD GPU metrics (`rocm-smi`) in real-time. It is designed to run on Linux alongside your inference containers, training loops, or Stable Diffusion workloads, displaying crucial hardware metrics with rich, responsive visualizations.

## Features

- **Dynamic Multi-GPU Support**: Automatically detects all available GPUs (`card0`, `card1`, etc.) and scales the layout in a responsive grid.
- **Real-Time Chart.js Gauges**: Visualizes GPU Usage (%), VRAM Usage (%), and Edge Temperature (°C) using half-doughnut gauge charts.
- **Historical Sparklines**: Scrolling trend lines plotting GPU usage, temperature, and power consumption over the last 30 samples.
- **Custom Polling Intervals**: Toggle updates instantly between **0.5s**, **0.75s**, and **1.0s**.
- **Play/Pause Control**: Freeze the polling loop to examine spikes or inspect specific snapshots.
- **Smart Mock Fallback**: Automatically displays interactive mock metrics if `rocm-smi` is not installed or available, allowing you to test the interface on developer machines without AMD cards.

## Requirements

- **Linux OS**
- **Node.js** (v16+ recommended)
- **AMD ROCm Drivers** (with `rocm-smi` utility on your path for live monitoring)

## Installation & Launch (Development)

1. **Clone & Navigate** to the workspace directory.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Run Application**:
   ```bash
   npm start
   ```

## Packaging for Distribution

You can package the application into a standalone portable folder using `electron-packager`:

```bash
npm run package
```
This generates the packaged bundle at `dist/rocm-monitor-linux-x64/`.

## Installing Locally on Linux

To install the packaged application locally for your current user (so it shows up in your application launcher menu):

1. **Run the local installation script**:
   ```bash
   chmod +x install_local.sh
   ./install_local.sh
   ```
2. You can now launch **ROCm GPU Monitor** directly from your GNOME, KDE, or Ubuntu application list/dash!

## License

ISC License.
