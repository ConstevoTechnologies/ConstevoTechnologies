/**
 * Azure FinOps Dashboard — Chart Initialization
 */

let costTimeChart = null;
let costServiceChart = null;

function initCharts() {
  initTimeChart();
  initServiceChart();
}

function initTimeChart() {
  const ctx = document.getElementById('costTimeChart');
  if (!ctx) return;

  const { labels, values } = AZURE_DATA.costTimeSeries;

  // Build gradient
  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, 'rgba(0,120,212,0.20)');
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
            maxTicksLimit: 8,
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

  // Populate legend
  document.getElementById('timeChartLegend').innerHTML = `
    <div class="legend-item">
      <div class="legend-dot" style="background:#0078D4"></div>Daily Spend
    </div>`;
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
