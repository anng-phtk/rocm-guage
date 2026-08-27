const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

let mainWindow;
let alwaysMock = false;

// Generate realistic oscillating mock data when rocm-smi is unavailable
function generateMockStats() {
  const time = Date.now() / 1000;
  
  // GPU 0: simulating high workload (e.g. LLM inference/training)
  const gpu0Use = Math.floor(75 + 15 * Math.sin(time / 8) + Math.random() * 5);
  const gpu0Temp = Math.floor(62 + 8 * Math.sin(time / 15) + Math.random() * 1.5);
  const gpu0Vram = Math.floor(82 + 2 * Math.sin(time / 30) + Math.random() * 0.5);
  const gpu0Power = Math.floor(175 + 35 * Math.sin(time / 8) + Math.random() * 8);

  // GPU 1: simulating light background workload (e.g. stable diffusion / idle)
  const gpu1Use = Math.max(0, Math.floor(25 + 20 * Math.cos(time / 10) + Math.random() * 4));
  const gpu1Temp = Math.floor(48 + 6 * Math.cos(time / 18) + Math.random() * 1);
  const gpu1Vram = Math.floor(41 + 4 * Math.cos(time / 40) + Math.random() * 0.5);
  const gpu1Power = Math.floor(75 + 25 * Math.cos(time / 10) + Math.random() * 5);

  return {
    "card0": {
      "Temperature (Sensor edge) (C)": gpu0Temp.toFixed(1),
      "Temperature (Sensor junction) (C)": (gpu0Temp + 6).toFixed(1),
      "Temperature (Sensor memory) (C)": (gpu0Temp + 3).toFixed(1),
      "Current Socket Graphics Package Power (W)": gpu0Power.toFixed(1),
      "GPU use (%)": Math.min(100, Math.max(0, gpu0Use)).toString(),
      "GPU Memory Allocated (VRAM%)": Math.min(100, Math.max(0, gpu0Vram)).toString(),
      "Memory Activity": "N/A",
      "Card Series": "AMD Radeon RX Vega",
      "Card Model": "0x687f",
      "Card Vendor": "Advanced Micro Devices, Inc. [AMD/ATI]",
      "Card SKU": "N/A",
      "Subsystem ID": "0x2387",
      "Device Rev": "0xc1",
      "Node ID": "1",
      "GUID": "11999",
      "GFX Version": "gfx900"
    },
    "card1": {
      "Temperature (Sensor edge) (C)": gpu1Temp.toFixed(1),
      "Temperature (Sensor junction) (C)": (gpu1Temp + 5).toFixed(1),
      "Temperature (Sensor memory) (C)": (gpu1Temp + 2).toFixed(1),
      "Current Socket Graphics Package Power (W)": gpu1Power.toFixed(1),
      "GPU use (%)": Math.min(100, Math.max(0, gpu1Use)).toString(),
      "GPU Memory Allocated (VRAM%)": Math.min(100, Math.max(0, gpu1Vram)).toString(),
      "Memory Activity": "N/A",
      "Card Series": "AMD Radeon VII",
      "Card Model": "0x66af",
      "Card Vendor": "Advanced Micro Devices, Inc. [AMD/ATI]",
      "Card SKU": "D3600200",
      "Subsystem ID": "0x081e",
      "Device Rev": "0xc1",
      "Node ID": "2",
      "GUID": "64665",
      "GFX Version": "gfx906"
    },
    "_isMock": true
  };
}

async function queryGpuStats() {
  if (alwaysMock) {
    return generateMockStats();
  }

  try {
    const { stdout } = await execPromise('rocm-smi --json --showtemp --showuse --showmemuse --showpower --showproductname');
    const startIdx = stdout.indexOf('{');
    const endIdx = stdout.lastIndexOf('}');
    
    if (startIdx !== -1 && endIdx !== -1) {
      const jsonStr = stdout.substring(startIdx, endIdx + 1);
      const data = JSON.parse(jsonStr);
      data._isMock = false;
      return data;
    }
    throw new Error('Invalid JSON output from rocm-smi');
  } catch (error) {
    // If command doesn't exist, fall back to mock data permanently to avoid continuous execution errors
    if (error.code === 'ENOENT' || (error.message && (error.message.includes('not found') || error.message.includes('command not found')))) {
      alwaysMock = true;
      console.warn('rocm-smi command not found. Defaulting to mock GPU data.');
    } else {
      console.warn('rocm-smi query failed:', error.message);
    }
    return generateMockStats();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0b10', // Prevent white flash on load
    title: 'ROCm GPU Monitor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  ipcMain.handle('get-gpu-stats', async () => {
    return await queryGpuStats();
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
