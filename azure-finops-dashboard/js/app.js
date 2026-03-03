/**
 * Azure FinOps Dashboard — Main Application Controller
 */

/* ─── State ─────────────────────────────────────────────────────────────── */
const state = {
  currentPage: 'dashboard',
  dateRange: 30,
  subscription: 'prod',
  search: '',
  filterType: '',
  filterRegion: '',
  filterStatus: '',
  recFilter: 'all',
  tablePage: 1,
  tablePageSize: 7,
  sortCol: 'monthlyCost',
  sortDir: 'desc',
  recommendations: [],
  acknowledged: new Set()
};

/* ─── Init ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  state.recommendations = buildRecommendations();
  renderAll();
  bindEvents();
});

function renderAll() {
  renderSummaryCards();
  renderAlerts();
  renderQuickWins();
  renderResourceTable();
  renderRecommendations();
  renderAnomalies();
  renderBudgets();
  updateNavBadges();
  initCharts(state.dateRange);
}

/* ─── Summary Cards ──────────────────────────────────────────────────────── */
function renderSummaryCards() {
  const s = AZURE_DATA.summary;

  // Scale costs by date range multiplier (proportional to 30-day baseline)
  const scale = state.dateRange / 30;
  const scaledTotal = s.totalCost * scale;
  const scaledPrev  = s.prevPeriodCost * scale;

  const costEl       = document.getElementById('totalCost');
  const costLabelEl  = document.getElementById('totalCostLabel');
  const deltaEl      = document.getElementById('costDelta');
  const savingsEl    = document.getElementById('potentialSavings');
  const savingsPctEl = document.getElementById('savingsPct');
  const badConfigsEl = document.getElementById('badConfigs');
  const activeEl     = document.getElementById('activeResources');

  if (costLabelEl) costLabelEl.textContent = `Total Cost (${state.dateRange}d)`;
  if (costEl) animateCount(costEl, 0, scaledTotal, v => fmt(v));
  if (deltaEl) {
    const diffPct = (((scaledTotal - scaledPrev) / scaledPrev) * 100).toFixed(1);
    const sign = diffPct > 0 ? '+' : '';
    deltaEl.textContent = `${sign}${diffPct}% vs last period`;
    deltaEl.className = 'card-delta ' + (diffPct > 0 ? 'negative' : 'positive');
  }
  if (savingsEl) animateCount(savingsEl, 0, s.potentialSavings, v => fmt(v));
  if (savingsPctEl) {
    const savingPct = ((s.potentialSavings / scaledTotal) * 100).toFixed(0);
    savingsPctEl.textContent = `~${savingPct}% of current spend`;
  }
  if (badConfigsEl) animateCount(badConfigsEl, 0, s.badConfigs, v => Math.round(v));
  if (activeEl) animateCount(activeEl, 0, s.activeResources, v => Math.round(v));
}

function animateCount(el, from, to, format) {
  // Cancel any existing animation on this element
  if (el._animFrame) cancelAnimationFrame(el._animFrame);
  const duration = 700;
  const start = performance.now();
  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = format(from + (to - from) * ease);
    if (t < 1) el._animFrame = requestAnimationFrame(frame);
  }
  el._animFrame = requestAnimationFrame(frame);
}

/* ─── Alerts (Dashboard) ─────────────────────────────────────────────────── */
function renderAlerts() {
  const list = document.getElementById('alertsList');
  if (!list) return;

  const critical = state.recommendations
    .filter(r => r.severity === 'high' || r.severity === 'critical')
    .slice(0, 4);

  list.innerHTML = critical.map(r => `
    <div class="alert-item ${r.severity === 'critical' ? 'critical' : 'warning'}"
         onclick="openRecDetail('${r.id}')" style="cursor:pointer">
      <div class="alert-icon">
        ${r.severity === 'critical'
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`}
      </div>
      <div class="alert-content">
        <div class="alert-title">${r.title}</div>
        <div class="alert-desc">${r.resource} · ${r.resourceType}</div>
      </div>
      ${r.saving > 0 ? `<span class="alert-saving">Save ${fmt(r.saving)}/mo</span>` : ''}
    </div>`).join('') || '<div class="empty-state">No critical issues found</div>';
}

/* ─── Quick Wins ────────────────────────────────────────────────────────── */
function renderQuickWins() {
  const list = document.getElementById('quickWinsList');
  if (!list) return;

  const wins = state.recommendations
    .filter(r => r.saving > 0)
    .sort((a, b) => b.saving - a.saving)
    .slice(0, 5);

  list.innerHTML = wins.map((r, i) => `
    <div class="quick-win-item fade-in" style="animation-delay:${i * 60}ms; cursor:pointer"
         onclick="openRecModal('${r.id}')">
      <div class="quick-win-rank">${i + 1}</div>
      <div>
        <div class="quick-win-name">${r.resource}</div>
        <div class="quick-win-type">${r.category} · ${r.resourceType}</div>
      </div>
      <span class="quick-win-saving">${fmt(r.saving)}/mo</span>
    </div>`).join('');
}

/* ─── Resource Table ─────────────────────────────────────────────────────── */
function renderResourceTable() {
  const resources = getFilteredResources();
  const total = resources.length;
  const pages = Math.ceil(total / state.tablePageSize);
  if (state.tablePage > pages) state.tablePage = Math.max(1, pages);
  const start = (state.tablePage - 1) * state.tablePageSize;
  const slice = resources.slice(start, start + state.tablePageSize);

  const tbody = document.getElementById('resourceTableBody');
  if (!tbody) return;

  tbody.innerHTML = slice.map(r => `
    <tr onclick="openResourceModal('${r.id}')" class="fade-in">
      <td>
        <div class="resource-name">${r.name}</div>
        <div class="resource-rg">${r.rg}</div>
      </td>
      <td><span class="resource-type-badge">${r.typeLabel}</span></td>
      <td>${formatRegion(r.region)}</td>
      <td>
        <span class="cost-cell" style="color:${r.monthlyCost > 1000 ? 'var(--danger)' : r.monthlyCost > 500 ? 'var(--warning)' : 'var(--text-primary)'}">${fmt(r.monthlyCost)}</span>
        <div class="resource-rg">per month</div>
      </td>
      <td>
        <div class="usage-bar">
          <div class="usage-fill" style="width:${r.usage}%; background:${usageColor(r.usage)}"></div>
        </div>
        <div class="usage-text">${r.usage}% avg</div>
      </td>
      <td><span class="status-badge status-${r.status}">${statusLabel(r.status)}</span></td>
      <td><button class="action-btn" onclick="event.stopPropagation(); openResourceModal('${r.id}')">View Details</button></td>
    </tr>`).join('')
    || `<tr><td colspan="7" class="empty-state">No resources match the filters</td></tr>`;

  const countEl = document.getElementById('tableCount');
  if (countEl) countEl.textContent = `Showing ${Math.min(start + 1, total)}–${Math.min(start + state.tablePageSize, total)} of ${total} resources`;

  updateSortHeaders();
  renderPagination(pages);
}

function getFilteredResources() {
  let list = [...AZURE_DATA.resources];
  const q = state.search.toLowerCase();
  if (q) list = list.filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.rg.toLowerCase().includes(q) ||
    r.typeLabel.toLowerCase().includes(q));
  if (state.filterType)   list = list.filter(r => r.type === state.filterType);
  if (state.filterRegion) list = list.filter(r => r.region === state.filterRegion);
  if (state.filterStatus) list = list.filter(r => r.status === state.filterStatus);

  // Sort
  const STATUS_ORDER = { critical: 0, warning: 1, ok: 2 };
  list.sort((a, b) => {
    let va = a[state.sortCol];
    let vb = b[state.sortCol];
    if (state.sortCol === 'status') { va = STATUS_ORDER[va] ?? 3; vb = STATUS_ORDER[vb] ?? 3; }
    if (state.sortCol === 'name') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
    if (va > vb) return state.sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return list;
}

function updateSortHeaders() {
  document.querySelectorAll('.sortable').forEach(th => {
    th.classList.remove('asc', 'desc');
    if (th.dataset.col === state.sortCol) th.classList.add(state.sortDir);
  });
}

function renderPagination(pages) {
  const pg = document.getElementById('pagination');
  if (!pg) return;
  if (pages <= 1) { pg.innerHTML = ''; return; }
  pg.innerHTML = Array.from({ length: pages }, (_, i) => `
    <button class="page-btn ${i + 1 === state.tablePage ? 'active' : ''}" onclick="goPage(${i + 1})">${i + 1}</button>`).join('');
}

function goPage(n) { state.tablePage = n; renderResourceTable(); }

function formatRegion(r) {
  const map = { eastus: 'East US', westus: 'West US', westeurope: 'West Europe', eastasia: 'East Asia', westus2: 'West US 2' };
  return map[r] || r;
}

/* ─── Recommendations Page ───────────────────────────────────────────────── */
function renderRecommendations() {
  renderRecSummary();
  renderRecCards();
}

function renderRecSummary() {
  const el = document.getElementById('recSummary');
  if (!el) return;
  const recs = state.recommendations;
  const totalSaving = recs.reduce((s, r) => s + r.saving, 0);
  const critCount = recs.filter(r => r.severity === 'critical').length;
  const highCount = recs.filter(r => r.severity === 'high').length;

  el.innerHTML = `
    <div class="rec-stat green">
      <span class="rec-stat-value">${fmt(totalSaving)}/mo</span>
      <span class="rec-stat-label">Total Potential Savings</span>
    </div>
    <div class="rec-stat red">
      <span class="rec-stat-value">${critCount}</span>
      <span class="rec-stat-label">Critical Issues</span>
    </div>
    <div class="rec-stat orange">
      <span class="rec-stat-value">${highCount}</span>
      <span class="rec-stat-label">High Impact Issues</span>
    </div>
    <div class="rec-stat">
      <span class="rec-stat-value">${recs.length}</span>
      <span class="rec-stat-label">Total Recommendations</span>
    </div>`;
}

function renderRecCards() {
  const el = document.getElementById('recList');
  if (!el) return;

  let recs = state.recommendations;
  if (state.recFilter !== 'all') recs = recs.filter(r => r.severity === state.recFilter);

  el.innerHTML = recs.map(r => `
    <div class="rec-card ${r.severity} fade-in" onclick="openRecModal('${r.id}')">
      <div class="rec-icon-wrap">${ICON_SVGS[r.icon] || ICON_SVGS.optimize}</div>
      <div class="rec-body">
        <div class="rec-title">${r.title}</div>
        <div class="rec-resource">${r.resource} · ${r.rg}</div>
        <div class="rec-desc">${r.description}</div>
        <div class="rec-tags">${r.tags.map(t => `<span class="rec-tag">${t}</span>`).join('')}</div>
      </div>
      <div class="rec-actions">
        ${r.saving > 0 ? `
          <div>
            <div class="rec-saving">${fmt(r.saving)}</div>
            <div class="rec-saving-label">savings/mo</div>
          </div>` : ''}
        <span class="impact-badge impact-${r.severity}">${capitalize(r.severity)}</span>
        ${r.fixSteps.length > 0
          ? `<button class="rec-apply-btn" onclick="event.stopPropagation(); openRecModal('${r.id}')">View Fix →</button>`
          : ''}
      </div>
    </div>`).join('')
    || '<div class="empty-state">No recommendations in this category</div>';
}

/* ─── Anomalies ──────────────────────────────────────────────────────────── */
function renderAnomalies() {
  const banner = document.getElementById('anomalyBanner');
  const activeAnomalies = AZURE_DATA.anomalies.filter(a => !state.acknowledged.has(a.id));
  if (banner) {
    if (activeAnomalies.length === 0) {
      banner.innerHTML = '';
      banner.style.background = 'var(--success-bg)';
      banner.style.border = '1px solid var(--success)';
      banner.style.color = 'var(--success)';
      banner.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
        <span><strong>All anomalies acknowledged.</strong> No active issues detected.</span>`;
    } else {
      banner.style.background = '';
      banner.style.border = '';
      banner.style.color = '';
      banner.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
        <span><strong>${activeAnomalies.length} anomal${activeAnomalies.length === 1 ? 'y' : 'ies'} detected</strong> in the last ${state.dateRange} days — review and take action to prevent further cost overruns.</span>`;
    }
  }

  const grid = document.getElementById('anomalyGrid');
  if (!grid) return;

  grid.innerHTML = AZURE_DATA.anomalies.map(a => {
    const acked = state.acknowledged.has(a.id);
    return `
    <div class="anomaly-card ${a.type} fade-in ${acked ? 'acknowledged' : ''}" id="anomaly-${a.id}">
      <div class="anomaly-header">
        <span class="anomaly-type">${formatAnomalyType(a.type)}</span>
        ${acked ? `<span style="font-size:11px;font-weight:600;color:var(--success)">✓ Acknowledged</span>` : ''}
      </div>
      <div class="anomaly-title">${a.title}</div>
      <div class="anomaly-desc">${a.desc}</div>
      ${Object.entries(a.metrics).map(([k, v]) => `
        <div class="anomaly-metric">
          <span class="anomaly-metric-label">${k}</span>
          <span class="anomaly-metric-value">${v}</span>
        </div>`).join('')}
      <div class="anomaly-actions">
        <button class="anomaly-btn primary" onclick="acknowledgeAnomaly('${a.id}')">
          ${acked ? '✓ Acknowledged' : 'Acknowledge'}
        </button>
        <button class="anomaly-btn" onclick="investigateAnomaly('${a.id}')">Investigate →</button>
      </div>
    </div>`;
  }).join('');

  updateNavBadges();
}

function acknowledgeAnomaly(id) {
  if (state.acknowledged.has(id)) {
    state.acknowledged.delete(id);
    showToast('Anomaly re-opened');
  } else {
    state.acknowledged.add(id);
    showToast('Anomaly acknowledged');
  }
  renderAnomalies();
}

function investigateAnomaly(id) {
  const a = AZURE_DATA.anomalies.find(x => x.id === id);
  if (!a) return;

  document.getElementById('modalTitle').textContent = a.title;
  document.getElementById('modalSubtitle').textContent = `Anomaly · ${formatAnomalyType(a.type)}`;
  document.getElementById('modalBody').innerHTML = `
    <div class="modal-section">
      <h4>Anomaly Details</h4>
      <p style="font-size:13.5px;line-height:1.6;color:var(--text-secondary);margin-bottom:12px">${a.desc}</p>
      <div class="modal-kv-grid">
        ${Object.entries(a.metrics).map(([k, v]) => `
          <div class="modal-kv">
            <span class="modal-kv-label">${k}</span>
            <span class="modal-kv-value">${v}</span>
          </div>`).join('')}
      </div>
    </div>
    <div class="modal-section">
      <h4>Recommended Actions</h4>
      <div class="fix-steps">
        <div class="fix-step">
          <div class="step-num">1</div>
          <div class="step-text">Review Azure Cost Analysis for this resource to identify the root cause of the spike or waste.</div>
        </div>
        <div class="fix-step">
          <div class="step-num">2</div>
          <div class="step-text">Set up budget alerts at 80% and 100% thresholds to be notified proactively.</div>
        </div>
        <div class="fix-step">
          <div class="step-num">3</div>
          <div class="step-text">Apply the relevant optimization from the Recommendations page to prevent recurrence.</div>
        </div>
      </div>
    </div>`;
  openModal();
}

function formatAnomalyType(t) {
  return { spike: '⚡ Cost Spike', idle: '😴 Idle Resource', orphaned: '👻 Orphaned' }[t] || t;
}

/* ─── Budgets ────────────────────────────────────────────────────────────── */
function renderBudgets() {
  const grid = document.getElementById('budgetsGrid');
  if (!grid) return;

  grid.innerHTML = AZURE_DATA.budgets.map(b => {
    const p = pct(b.spent, b.amount);
    const level = p >= 100 ? 'danger' : p >= 80 ? 'warning' : 'ok';
    const forecastPct = pct(b.forecast, b.amount);
    const forecastLevel = forecastPct >= 100 ? 'danger' : forecastPct >= 90 ? 'warning' : 'ok';
    const alertTriggered = p >= b.alertThreshold;

    return `
      <div class="budget-card fade-in">
        <div class="budget-header">
          <div>
            <div class="budget-name">${b.name}</div>
            <div class="budget-scope">${b.scope}</div>
          </div>
          <span class="budget-amount-badge">${fmt(b.amount)}</span>
        </div>
        <div class="budget-progress-wrap">
          <div class="budget-progress-bar">
            <div class="budget-progress-fill ${level}" style="width:${Math.min(p, 100)}%"></div>
          </div>
          <div class="budget-progress-labels">
            <span>Spent: <strong class="budget-spent">${fmt(b.spent)}</strong></span>
            <span class="budget-pct ${level}">${p}%</span>
          </div>
        </div>
        <div class="budget-forecast ${forecastLevel}">
          <span>Forecast this month:</span>
          <strong>${fmt(b.forecast)} (${forecastPct}%)</strong>
        </div>
        ${alertTriggered ? `
        <div class="budget-alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          Alert triggered — ${b.alertThreshold}% threshold exceeded
        </div>` : ''}
      </div>`;
  }).join('');
}

/* ─── Nav Badges ─────────────────────────────────────────────────────────── */
function updateNavBadges() {
  const recBadge = document.getElementById('recBadge');
  const anomBadge = document.getElementById('anomBadge');
  if (recBadge) {
    const n = state.recommendations.filter(r => r.severity === 'critical' || r.severity === 'high').length;
    recBadge.textContent = n || '';
  }
  if (anomBadge) {
    const n = AZURE_DATA.anomalies.filter(a => !state.acknowledged.has(a.id)).length;
    anomBadge.textContent = n || '';
  }
}

/* ─── Modals ─────────────────────────────────────────────────────────────── */
function buildFixStepsHTML(fixSteps) {
  if (!fixSteps.length) return '';
  return `
    <div class="modal-section">
      <h4>How to Fix — Step by Step</h4>
      <div class="fix-steps">
        ${fixSteps.map((step, i) => `
          <div class="fix-step">
            <div class="step-num">${i + 1}</div>
            <div style="flex:1">
              <div class="step-text">${step.text}</div>
              ${step.cmd ? `
                <div class="step-code-wrap">
                  <div class="step-code" id="cmd-${i}">${escHtml(step.cmd)}</div>
                  <button class="copy-btn" onclick="copyCmd(this, '${escAttr(step.cmd)}')">Copy</button>
                </div>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function openResourceModal(id) {
  const r = AZURE_DATA.resources.find(x => x.id === id);
  if (!r) return;

  document.getElementById('modalTitle').textContent = r.name;
  document.getElementById('modalSubtitle').textContent = `${r.typeLabel} · ${r.rg} · ${formatRegion(r.region)}`;

  const recForResource = state.recommendations.filter(rec => rec.resource === r.name);
  const allFixSteps = recForResource.flatMap(rec => rec.fixSteps);

  document.getElementById('modalBody').innerHTML = `
    <div class="modal-section">
      <h4>Resource Details</h4>
      <div class="modal-kv-grid">
        <div class="modal-kv"><span class="modal-kv-label">SKU / Tier</span>
          <span class="modal-kv-value">${r.sku || r.edition || '—'}</span></div>
        <div class="modal-kv"><span class="modal-kv-label">Monthly Cost</span>
          <span class="modal-kv-value" style="color:var(--danger);font-weight:700">${fmt(r.monthlyCost)}</span></div>
        <div class="modal-kv"><span class="modal-kv-label">Avg Utilization</span>
          <span class="modal-kv-value" style="color:${usageColor(r.usage)}">${r.usage}%</span></div>
        <div class="modal-kv"><span class="modal-kv-label">Status</span>
          <span class="modal-kv-value"><span class="status-badge status-${r.status}">${statusLabel(r.status)}</span></span></div>
        <div class="modal-kv"><span class="modal-kv-label">Region</span>
          <span class="modal-kv-value">${formatRegion(r.region)}</span></div>
        <div class="modal-kv"><span class="modal-kv-label">Potential Saving</span>
          <span class="modal-kv-value" style="color:var(--success);font-weight:700">${r.potentialSaving > 0 ? fmt(r.potentialSaving) + '/mo' : '—'}</span></div>
      </div>
    </div>

    ${r.issues.length > 0 ? `
    <div class="modal-section">
      <h4>Configuration Issues (${r.issues.length})</h4>
      ${r.issues.map(issue => `
        <div class="alert-item warning" style="margin-bottom:8px">
          <div class="alert-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </div>
          <div class="alert-content">
            <div class="alert-title">${issue}</div>
          </div>
        </div>`).join('')}
    </div>` : ''}

    ${buildFixStepsHTML(allFixSteps)}`;

  openModal();
}

function openRecModal(id) {
  const r = state.recommendations.find(x => x.id === id);
  if (!r) return;

  document.getElementById('modalTitle').textContent = r.title;
  document.getElementById('modalSubtitle').textContent = `${r.resource} · ${r.rg} · ${r.resourceType}`;

  document.getElementById('modalBody').innerHTML = `
    <div class="modal-section">
      <h4>Details</h4>
      <div class="modal-kv-grid">
        <div class="modal-kv"><span class="modal-kv-label">Severity</span>
          <span class="modal-kv-value"><span class="impact-badge impact-${r.severity}">${capitalize(r.severity)}</span></span></div>
        <div class="modal-kv"><span class="modal-kv-label">Category</span>
          <span class="modal-kv-value">${r.category}</span></div>
        <div class="modal-kv"><span class="modal-kv-label">Estimated Saving</span>
          <span class="modal-kv-value" style="color:var(--success);font-weight:700">${r.saving > 0 ? fmt(r.saving) + '/month' : 'N/A'}</span></div>
        <div class="modal-kv"><span class="modal-kv-label">Annualized Saving</span>
          <span class="modal-kv-value" style="color:var(--success);font-weight:700">${r.saving > 0 ? fmt(r.saving * 12) + '/year' : 'N/A'}</span></div>
      </div>
    </div>
    <div class="modal-section">
      <h4>Why This Matters</h4>
      <p style="font-size:13.5px;line-height:1.6;color:var(--text-secondary)">${r.description}</p>
    </div>
    ${buildFixStepsHTML(r.fixSteps)}`;

  openModal();
}

function openRecDetail(id) { openRecModal(id); }

function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

/* ─── Copy CLI Command ───────────────────────────────────────────────────── */
function copyCmd(btn, cmd) {
  navigator.clipboard.writeText(cmd).then(() => {
    btn.textContent = '✓ Copied';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  }).catch(() => showToast('Could not copy — please copy manually'));
}

/* ─── Navigation ─────────────────────────────────────────────────────────── */
function navigateTo(page) {
  state.currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pg = document.getElementById(`page-${page}`);
  if (pg) pg.classList.add('active');
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  const titles = {
    dashboard: 'Dashboard', resources: 'Resources',
    recommendations: 'Recommendations', anomalies: 'Anomalies', budgets: 'Budgets'
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[page] || page;
}

/* ─── Events ─────────────────────────────────────────────────────────────── */
function bindEvents() {
  // Sidebar nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  // Link buttons (dashboard "View all")
  document.querySelectorAll('.link-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Sidebar toggle
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
  }

  // Date range — update chart, card label, and summary cost
  document.querySelectorAll('.date-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.dateRange = parseInt(btn.dataset.range);
      renderSummaryCards();
      initTimeChart(state.dateRange);
    });
  });

  // Subscription selector
  const subSelect = document.getElementById('subscriptionSelect');
  if (subSelect) {
    subSelect.addEventListener('change', () => {
      state.subscription = subSelect.value;
      showToast(`Switched to ${subSelect.options[subSelect.selectedIndex].text}`);
      // In production: re-fetch data for the selected subscription
      renderSummaryCards();
      initCharts(state.dateRange);
    });
  }

  // Sortable table headers
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.sortCol === col) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortCol = col;
        state.sortDir = col === 'monthlyCost' ? 'desc' : 'asc';
      }
      state.tablePage = 1;
      renderResourceTable();
    });
  });

  // Search
  const searchInput = document.getElementById('resourceSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.search = searchInput.value;
      state.tablePage = 1;
      renderResourceTable();
    });
  }

  // Filters
  ['filterType', 'filterRegion', 'filterStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
      state[id] = el.value;
      state.tablePage = 1;
      renderResourceTable();
    });
  });

  // Rec filters
  document.querySelectorAll('.rec-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rec-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.recFilter = btn.dataset.filter;
      renderRecCards();
    });
  });

  // Modal close
  const modalClose = document.getElementById('modalClose');
  if (modalClose) modalClose.addEventListener('click', closeModal);
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Refresh button with spinner
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const icon = refreshBtn.querySelector('svg');
      if (icon) icon.classList.add('spinning');
      showToast('Refreshing data...');
      setTimeout(() => {
        renderAll();
        if (icon) icon.classList.remove('spinning');
        showToast('Data refreshed successfully');
      }, 800);
    });
  }

  // Export CSV
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportCSV);

  // Add Budget btn (mock)
  const addBudget = document.getElementById('addBudgetBtn');
  if (addBudget) addBudget.addEventListener('click', () => showToast('Budget creation — connect to Azure Cost Management API to enable'));
}

/* ─── Export CSV ─────────────────────────────────────────────────────────── */
function exportCSV() {
  const headers = ['Name', 'Type', 'Region', 'Resource Group', 'Monthly Cost ($)', 'Usage (%)', 'Status', 'Issues', 'Potential Saving ($)'];
  const rows = AZURE_DATA.resources.map(r => [
    r.name, r.typeLabel, formatRegion(r.region), r.rg,
    r.monthlyCost.toFixed(2), r.usage, statusLabel(r.status),
    r.issues.length, r.potentialSaving.toFixed(2)
  ]);
  const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `azure-finops-resources-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported successfully');
}

/* ─── Toast ──────────────────────────────────────────────────────────────── */
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escAttr(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}
