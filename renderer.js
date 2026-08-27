let gpuInstances = {};
let currentInterval = 1000;
let isPaused = false;
let pollTimeout = null;
let currentIsMock = false;

// Determine standard junction thermal limit for AMD cards
function getJunctionLimit(cardSeries, gfxVersion) {
  if (gfxVersion) {
    const v = gfxVersion.toLowerCase();
    if (v.includes('gfx900') || v.includes('gfx906')) return 105;
    if (v.includes('gfx10') || v.includes('gfx11')) return 110;
  }
  if (cardSeries) {
    const s = cardSeries.toLowerCase();
    if (s.includes('vega') || s.includes('vii') || s.includes('instinct') || s.includes('mi')) return 105;
  }
  return 105; // safe default
}

// Initialize charts for a specific GPU card
function initCharts(cardKey) {
  // 1. GPU Use Gauge
  const useCtx = document.getElementById(`${cardKey}-use-canvas`).getContext('2d');
  const useChart = new Chart(useCtx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [0, 100],
        backgroundColor: ['#00f2fe', 'rgba(255, 255, 255, 0.05)'],
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      circumference: 180,
      rotation: 270,
      cutout: '80%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      events: [],
      responsive: true,
      maintainAspectRatio: false
    }
  });

  // 2. VRAM Use Gauge
  const vramCtx = document.getElementById(`${cardKey}-vram-canvas`).getContext('2d');
  const vramChart = new Chart(vramCtx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [0, 100],
        backgroundColor: ['#e100ff', 'rgba(255, 255, 255, 0.05)'],
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      circumference: 180,
      rotation: 270,
      cutout: '80%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      events: [],
      responsive: true,
      maintainAspectRatio: false
    }
  });

  // 3. Temp Gauge
  const tempCtx = document.getElementById(`${cardKey}-temp-canvas`).getContext('2d');
  const tempChart = new Chart(tempCtx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [0, 100],
        backgroundColor: ['#ff0844', 'rgba(255, 255, 255, 0.05)'],
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      circumference: 180,
      rotation: 270,
      cutout: '80%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      events: [],
      responsive: true,
      maintainAspectRatio: false
    }
  });

  // 4. History Line Chart
  const historyCtx = document.getElementById(`${cardKey}-history-canvas`).getContext('2d');
  const maxSamples = 30;
  const labels = Array(maxSamples).fill('');
  const useHistoryData = Array(maxSamples).fill(null);
  const tempHistoryData = Array(maxSamples).fill(null);
  const powerHistoryData = Array(maxSamples).fill(null);

  const historyChart = new Chart(historyCtx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'GPU Use (%)',
          data: useHistoryData,
          borderColor: '#00f2fe',
          backgroundColor: 'rgba(0, 242, 254, 0.03)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'Temp (°C)',
          data: tempHistoryData,
          borderColor: '#e100ff',
          backgroundColor: 'rgba(225, 0, 255, 0.03)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'Power (W)',
          data: powerHistoryData,
          borderColor: '#ff9100',
          backgroundColor: 'rgba(255, 145, 0, 0.03)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#8c9ba5',
            font: { family: 'Outfit', size: 10, weight: 600 },
            boxWidth: 10,
            usePointStyle: true
          }
        },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { display: false }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: {
            color: '#4e5a65',
            font: { family: 'Outfit', size: 9 }
          },
          min: 0,
          suggestedMax: 100
        }
      }
    }
  });

  // Store references for easy updating
  gpuInstances[cardKey] = {
    useChart,
    vramChart,
    tempChart,
    historyChart,
    useHistoryData,
    tempHistoryData,
    powerHistoryData,
    maxSamples,
    elements: {
      model: document.getElementById(`${cardKey}-model`),
      powerVal: document.getElementById(`${cardKey}-power-val`),
      useVal: document.getElementById(`${cardKey}-use-val`),
      vramVal: document.getElementById(`${cardKey}-vram-val`),
      tempVal: document.getElementById(`${cardKey}-temp-val`),
      tempJunction: document.getElementById(`${cardKey}-temp-junction`),
      tempMemory: document.getElementById(`${cardKey}-temp-memory`),
      statusJunction: document.getElementById(`${cardKey}-status-junction`),
      statusLimit: document.getElementById(`${cardKey}-status-limit`),
      statusMargin: document.getElementById(`${cardKey}-status-margin`)
    }
  };
}

// Dynamically create HTML layout for a new GPU card
function createGpuCard(cardKey) {
  const gpuNum = cardKey.replace('card', '');
  const gpuGrid = document.getElementById('gpu-grid');
  
  const cardHtml = `
    <div class="gpu-card" id="card-el-${cardKey}">
      <div class="gpu-header">
        <div class="gpu-title">
          <div class="gpu-id">GPU ${gpuNum}</div>
          <div class="gpu-model" id="${cardKey}-model">Detecting Device...</div>
        </div>
        <div class="power-badge" id="${cardKey}-power-badge">
          <span id="${cardKey}-power-val">0.0</span><span>W</span>
        </div>
      </div>

      <div class="gauges-container">
        <!-- GPU Use -->
        <div class="gauge-item">
          <div class="chart-wrapper">
            <canvas id="${cardKey}-use-canvas"></canvas>
            <div class="gauge-value" id="${cardKey}-use-val">0<span class="gauge-unit">%</span></div>
          </div>
          <div class="gauge-label">GPU Use</div>
        </div>

        <!-- VRAM Use -->
        <div class="gauge-item">
          <div class="chart-wrapper">
            <canvas id="${cardKey}-vram-canvas"></canvas>
            <div class="gauge-value" id="${cardKey}-vram-val">0<span class="gauge-unit">%</span></div>
          </div>
          <div class="gauge-label">VRAM</div>
        </div>

        <!-- Temperature -->
        <div class="gauge-item">
          <div class="chart-wrapper">
            <canvas id="${cardKey}-temp-canvas"></canvas>
            <div class="gauge-value" id="${cardKey}-temp-val">0<span class="gauge-unit">°C</span></div>
          </div>
          <div class="gauge-label">Temp</div>
        </div>
      </div>

      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">Junction Temp</span>
          <span class="detail-value" id="${cardKey}-temp-junction">-- °C</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Memory Temp</span>
          <span class="detail-value" id="${cardKey}-temp-memory">-- °C</span>
        </div>
      </div>

      <div class="thermal-status" style="background: rgba(0, 0, 0, 0.2); border-radius: var(--border-radius-md); padding: 12px 16px; border: 1px solid rgba(255, 255, 255, 0.03); font-family: var(--font-mono); font-size: 0.85rem; display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary); white-space: pre;">Junction:</span>
          <span id="${cardKey}-status-junction" style="color: var(--text-primary); font-weight: 700;">--°C</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary); white-space: pre;">Limit:   </span>
          <span id="${cardKey}-status-limit" style="color: var(--warning); font-weight: 700;">--°C</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary); white-space: pre;">Margin:  </span>
          <span id="${cardKey}-status-margin" style="color: var(--success); font-weight: 700;">--°C</span>
        </div>
      </div>

      <div class="history-container">
        <div class="history-header">
          <span>Real-time Trends</span>
          <span>Last 30 samples</span>
        </div>
        <div class="history-chart-wrapper">
          <canvas id="${cardKey}-history-canvas"></canvas>
        </div>
      </div>
    </div>
  `;
  
  gpuGrid.insertAdjacentHTML('beforeend', cardHtml);
  initCharts(cardKey);
}

// Update DOM elements and Charts with new stats
function updateUI(stats) {
  currentIsMock = !!stats._isMock;
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  
  if (!isPaused) {
    if (currentIsMock) {
      statusDot.className = 'status-dot mock';
      statusText.textContent = 'DEMO (Mocked)';
    } else {
      statusDot.className = 'status-dot live';
      statusText.textContent = 'LIVE (ROCm)';
    }
  }

  // Update last refresh timestamp
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  document.getElementById('refresh-time').textContent = `Last update: ${timeStr}`;

  // Filter keys starting with 'card' (e.g. card0, card1)
  const cards = Object.keys(stats).filter(key => key.startsWith('card'));
  const gpuGrid = document.getElementById('gpu-grid');
  
  // Rebuild grid if the number of GPUs changes dynamically
  const currentGpuKeys = Object.keys(gpuInstances);
  const needsRebuild = currentGpuKeys.length !== cards.length || !cards.every(k => currentGpuKeys.includes(k));

  if (needsRebuild) {
    // Destroy existing Chart objects to free memory
    for (const key in gpuInstances) {
      gpuInstances[key].useChart.destroy();
      gpuInstances[key].vramChart.destroy();
      gpuInstances[key].tempChart.destroy();
      gpuInstances[key].historyChart.destroy();
    }
    gpuInstances = {};
    gpuGrid.innerHTML = '';

    if (cards.length > 1) {
      gpuGrid.classList.add('multi-gpu');
    } else {
      gpuGrid.classList.remove('multi-gpu');
    }

    cards.forEach(cardKey => {
      createGpuCard(cardKey);
    });
  }

  // Update stats for each GPU
  cards.forEach(cardKey => {
    const cardData = stats[cardKey];
    const gpu = gpuInstances[cardKey];
    if (!gpu) return;

    // Safety parse
    const use = Math.min(100, Math.max(0, parseInt(cardData["GPU use (%)"]) || 0));
    const vram = Math.min(100, Math.max(0, parseInt(cardData["GPU Memory Allocated (VRAM%)"]) || 0));
    const tempEdge = parseFloat(cardData["Temperature (Sensor edge) (C)"]) || 0;
    const tempJunc = parseFloat(cardData["Temperature (Sensor junction) (C)"]) || 0;
    const tempMem = parseFloat(cardData["Temperature (Sensor memory) (C)"]) || 0;
    const power = parseFloat(cardData["Current Socket Graphics Package Power (W)"]) || 0;

    // Update text content
    gpu.elements.powerVal.textContent = power.toFixed(1);
    gpu.elements.useVal.innerHTML = `${use}<span class="gauge-unit">%</span>`;
    gpu.elements.vramVal.innerHTML = `${vram}<span class="gauge-unit">%</span>`;
    gpu.elements.tempVal.innerHTML = `${Math.round(tempEdge)}<span class="gauge-unit">°C</span>`;

    gpu.elements.tempJunction.textContent = `${tempJunc.toFixed(1)} °C`;
    gpu.elements.tempMemory.textContent = isNaN(tempMem) || tempMem === 0 ? 'N/A' : `${tempMem.toFixed(1)} °C`;

    const cardSeries = cardData["Card Series"] || "";
    const cardModel = cardData["Card Model"] || "";
    const gfxVersion = cardData["GFX Version"] || "";

    // Dynamic model label name with marketing name
    if (cardSeries) {
      gpu.elements.model.textContent = `${cardSeries} (${cardModel || cardKey.toUpperCase()})`;
    } else if (currentIsMock) {
      if (cardKey === 'card0') {
        gpu.elements.model.textContent = 'AMD Radeon RX Vega (0x687f)';
      } else if (cardKey === 'card1') {
        gpu.elements.model.textContent = 'AMD Radeon VII (0x66af)';
      }
    } else {
      gpu.elements.model.textContent = `AMD ROCm Device (${cardKey.toUpperCase()})`;
    }

    // Calculate junction temperature limit and margin
    const limit = getJunctionLimit(cardSeries, gfxVersion);
    const margin = limit - tempJunc;

    gpu.elements.statusJunction.textContent = `${tempJunc.toFixed(1)}°C`;
    gpu.elements.statusLimit.textContent = `${limit}°C`;
    gpu.elements.statusMargin.textContent = `${margin.toFixed(1)}°C`;

    if (margin > 20) {
      gpu.elements.statusMargin.style.color = 'var(--success)';
    } else if (margin >= 10) {
      gpu.elements.statusMargin.style.color = 'var(--warning)';
    } else {
      gpu.elements.statusMargin.style.color = 'var(--error)';
    }

    // Update half-doughnut gauge dataset arrays
    gpu.useChart.data.datasets[0].data = [use, Math.max(0, 100 - use)];
    gpu.useChart.update('none'); // Update immediately with 'none' to skip heavy animations

    gpu.vramChart.data.datasets[0].data = [vram, Math.max(0, 100 - vram)];
    gpu.vramChart.update('none');

    const tempPct = Math.min(100, Math.max(0, tempEdge));
    gpu.tempChart.data.datasets[0].data = [tempPct, Math.max(0, 100 - tempPct)];
    gpu.tempChart.update('none');

    // Update History Chart scrolling buffer
    gpu.useHistoryData.shift();
    gpu.useHistoryData.push(use);

    gpu.tempHistoryData.shift();
    gpu.tempHistoryData.push(tempEdge);

    gpu.powerHistoryData.shift();
    gpu.powerHistoryData.push(power);

    // Auto-scale historical Y-axis based on power limits
    const validPowerVals = gpu.powerHistoryData.filter(p => p !== null);
    const maxPowerSeen = validPowerVals.length > 0 ? Math.max(...validPowerVals) : 0;
    gpu.historyChart.options.scales.y.suggestedMax = Math.max(100, maxPowerSeen + 10);

    gpu.historyChart.update('none');
  });
}

// Primary polling loop
async function pollData() {
  if (isPaused) return;

  try {
    const stats = await window.electronAPI.getGpuStats();
    updateUI(stats);
  } catch (error) {
    console.error('Failed to get GPU stats:', error);
  }

  pollTimeout = setTimeout(pollData, currentInterval);
}

// Alter the polling rates
function changeInterval(newInterval) {
  currentInterval = newInterval;
  
  document.querySelectorAll('.btn-group .btn').forEach(btn => {
    btn.classList.remove('active');
    if (parseInt(btn.getAttribute('data-interval')) === newInterval) {
      btn.classList.add('active');
    }
  });

  if (!isPaused) {
    clearTimeout(pollTimeout);
    pollData();
  }
}

// Toggle status of polling loop
function togglePlayPause() {
  isPaused = !isPaused;
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const playPauseText = document.getElementById('play-pause-text');
  const playPauseIcon = document.getElementById('play-pause-icon');

  if (isPaused) {
    clearTimeout(pollTimeout);
    statusDot.className = 'status-dot paused';
    statusText.textContent = 'PAUSED';
    playPauseText.textContent = 'Resume';
    // Play Icon SVG path
    playPauseIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
  } else {
    statusDot.className = currentIsMock ? 'status-dot mock' : 'status-dot live';
    statusText.textContent = currentIsMock ? 'DEMO (Mocked)' : 'LIVE (ROCm)';
    playPauseText.textContent = 'Pause';
    // Pause Icon SVG path
    playPauseIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    pollData();
  }
}

// Start once DOM has loaded
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-500').addEventListener('click', () => changeInterval(500));
  document.getElementById('btn-750').addEventListener('click', () => changeInterval(750));
  document.getElementById('btn-1000').addEventListener('click', () => changeInterval(1000));

  document.getElementById('btn-play-pause').addEventListener('click', togglePlayPause);

  pollData();
});
