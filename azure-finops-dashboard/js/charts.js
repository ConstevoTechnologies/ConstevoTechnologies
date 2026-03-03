/**
 * Azure FinOps Dashboard — Chart Initialization
 */

let costTimeChart = null;
let costServiceChart = null;

function initCharts(range) {
  if (typeof Chart === 'undefined') {
    showChartFallback('costTimeChart', 'Chart library unavailable — check your internet connection.');
    showChartFallback('costServiceChart', 'Chart library unavailable.');
    return;
  }
  initTimeChart(range || 30);
  initServiceChart();
}

function showChartFallback(canvasId, msg) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const wrap = canvas.parentElement;
  canvas.style.display = 'none';
  if (!wrap.querySelector('.chart-fallback')) {
    const div = document.createElement('div');
    div.className = 'chart-fallback';
    div.textContent = msg;
    wrap.appendChild(div);
  }
}

function initTimeChart(range) {
  const ctx = document.getElementById('costTimeChart');
  if (!ctx) return;

  const { labels: allLabels, values: allValues } = AZURE_DATA.costTimeSeries;

  // Slice to requested range from the end
  const days = Math.min(range, allValues.length);
  const labels = allLabels.slice(-days);
  const values = allValues.slice(-days);

  // Build gradient
  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, 'rgba(0,120,212,0.22)');
  gradient.addColorStop(1, 'rgba(0,120,212,0.00)');

  if (costTimeChart) costTimeChart.destroy();
  costTimeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Daily Cost',
        data: values,
        borderColor: '#0078D4',
        backgroundColor: gradient,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#0078D4',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1B1B1B',
          titleColor: '#C8C6C4',
          bodyColor: '#ffffff',
          padding: 10,
          callbacks: {
            label: ctx => ' ' + fmt(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#A19F9D',
            font: { size: 11 },
            maxTicksLimit: days > 60 ? 10 : 8,
            maxRotation: 0
          },
          border: { display: false }
        },
        y: {
          grid: { color: '#EDEBE9' },
          ticks: {
            color: '#A19F9D',
            font: { size: 11 },
            callback: v => fmtShort(v)
          },
          border: { display: false }
        }
      }
    }
  });

  // Legend
  const legendEl = document.getElementById('timeChartLegend');
  if (legendEl) {
    const total = values.reduce((s, v) => s + v, 0);
    legendEl.innerHTML = `
      <div class="legend-item">
        <div class="legend-dot" style="background:#0078D4"></div>Daily Spend
      </div>
      <span style="font-size:12px;color:var(--text-muted);margin-left:8px">Total: <strong>${fmt(total)}</strong></span>`;
  }
}

function initServiceChart() {
  const ctx = document.getElementById('costServiceChart');
  if (!ctx) return;

  const data = AZURE_DATA.costByService;
  const total = data.reduce((s, d) => s + d.cost, 0);

  if (costServiceChart) costServiceChart.destroy();
  costServiceChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.service),
      datasets: [{
        data: data.map(d => d.cost),
        backgroundColor: data.map(d => d.color),
        borderWidth: 2,
        borderColor: '#fff',
        hoverBorderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1B1B1B',
          titleColor: '#C8C6C4',
          bodyColor: '#ffffff',
          padding: 10,
          callbacks: {
            label: ctx => ` ${fmt(ctx.parsed)} (${data[ctx.dataIndex].pct}%)`
          }
        }
      }
    }
  });

  // Center label
  const center = document.getElementById('donutCenter');
  if (center) {
    center.innerHTML = `
      <span class="donut-total">${fmtShort(total)}</span>
      <span class="donut-label">Total</span>`;
  }

  // Legend
  const legend = document.getElementById('donutLegend');
  if (legend) {
    legend.innerHTML = data.slice(0, 5).map(d => `
      <div class="donut-legend-item">
        <div class="donut-legend-dot" style="background:${d.color}"></div>
        ${d.service} <strong style="margin-left:4px">${d.pct}%</strong>
      </div>`).join('');
  }
}
