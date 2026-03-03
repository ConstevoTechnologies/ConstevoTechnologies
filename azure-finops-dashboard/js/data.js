/**
 * Azure FinOps Dashboard — Mock Data & Data Layer
 * In production, replace these with real Azure Cost Management API calls.
 */

const AZURE_DATA = {

  // ── Summary KPIs ──────────────────────────────────────────────────────────
  summary: {
    totalCost: 48_720.54,
    prevPeriodCost: 43_350.00,
    potentialSavings: 12_840.00,
    activeResources: 147,
    badConfigs: 23,
    regions: ['East US', 'West Europe', 'East Asia', 'West US 2']
  },

  // ── Cost Over Time (last 90 days — slice to 30/60/90 based on UI) ─────────
  costTimeSeries: (() => {
    const all90 = [
      780, 820, 760, 900, 850, 920, 1_010, 870, 940, 1_080,
      990, 1_100, 1_050, 1_180, 1_020, 1_250, 1_130, 1_090, 1_200, 1_310,
      1_180, 1_090, 1_250, 1_380, 1_200, 1_450, 1_320, 1_290, 1_410, 1_530,
      // — 60 days ago ↓
      1_120, 1_340, 980, 1_450, 1_680, 1_230, 1_890, 2_100, 1_560, 1_780,
      1_920, 2_340, 1_800, 2_560, 2_100, 1_750, 2_890, 2_450, 3_100, 2_780,
      2_340, 2_900, 3_200, 2_680, 3_450, 3_100, 2_890, 3_560, 3_200, 2_980,
      // — 30 days ago ↓
      2_840, 3_120, 2_760, 3_380, 3_050, 2_920, 3_510, 3_200, 2_980, 3_640,
      3_290, 3_560, 3_100, 3_780, 3_430, 3_200, 3_890, 3_550, 4_100, 3_780,
      3_540, 3_900, 4_200, 3_880, 4_350, 4_100, 3_890, 4_460, 4_200, 3_980
    ];
    const refDate = new Date(2026, 2, 3); // Mar 3 2026
    const labels = Array.from({ length: 90 }, (_, i) => {
      const d = new Date(refDate);
      d.setDate(refDate.getDate() - (89 - i));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    return { labels, values: all90 };
  })(),

  // ── Cost by Service ───────────────────────────────────────────────────────
  costByService: [
    { service: 'Virtual Machines', cost: 18_450, color: '#0078D4', pct: 37.9 },
    { service: 'SQL Databases',    cost:  9_200, color: '#50E6FF', pct: 18.9 },
    { service: 'Storage',          cost:  6_100, color: '#FFB900', pct: 12.5 },
    { service: 'Kubernetes (AKS)', cost:  5_800, color: '#107C10', pct: 11.9 },
    { service: 'App Services',     cost:  4_320, color: '#8764B8', pct:  8.9 },
    { service: 'Networking',       cost:  3_150, color: '#CA5010', pct:  6.5 },
    { service: 'Other',            cost:  1_700, color: '#A19F9D', pct:  3.4 }
  ],

  // ── Resources ─────────────────────────────────────────────────────────────
  resources: [
    {
      id: 'r001', name: 'prod-api-vm-01', rg: 'rg-production',
      type: 'vm', typeLabel: 'Virtual Machine', region: 'eastus',
      monthlyCost: 1_842.00, usage: 12, status: 'critical',
      sku: 'Standard_D16s_v3', os: 'Windows Server 2022',
      uptime: '99.9%', disk: 'Premium SSD 512 GB',
      issues: ['Oversized VM: avg CPU 12%, memory 18%', 'No auto-shutdown schedule', 'No Reserved Instance'],
      fixSteps: [
        { text: 'Resize to Standard_D4s_v3 — saves ~68%', cmd: 'az vm resize --resource-group rg-production --name prod-api-vm-01 --size Standard_D4s_v3' },
        { text: 'Enable auto-shutdown at 7 PM to cut off-hours cost', cmd: 'az vm auto-shutdown -g rg-production -n prod-api-vm-01 --time 1900' },
        { text: 'Purchase 1-year Reserved Instance for predictable savings (~40%)', cmd: null }
      ],
      potentialSaving: 1_248.00
    },
    {
      id: 'r002', name: 'stg-logs-account', rg: 'rg-monitoring',
      type: 'storage', typeLabel: 'Storage Account', region: 'westeurope',
      monthlyCost: 680.00, usage: 91, status: 'warning',
      sku: 'StorageV2 LRS', tier: 'Hot',
      issues: ['85% of data not accessed in 90+ days', 'Hot tier used for cold data'],
      fixSteps: [
        { text: 'Move infrequent data to Cool tier — saves ~40%', cmd: 'az storage account update --name stglogsaccount --resource-group rg-monitoring --access-tier Cool' },
        { text: 'Enable lifecycle management policy to auto-tier old blobs', cmd: null }
      ],
      potentialSaving: 272.00
    },
    {
      id: 'r003', name: 'prod-sql-main', rg: 'rg-databases',
      type: 'sql', typeLabel: 'SQL Database', region: 'eastus',
      monthlyCost: 2_100.00, usage: 28, status: 'critical',
      sku: 'Business Critical — 16 vCores', edition: 'Business Critical',
      issues: ['28% avg CPU, 20% memory — severely over-provisioned', 'No elastic pool', 'PITR retention: 35 days (max, costly)'],
      fixSteps: [
        { text: 'Downgrade to General Purpose 8 vCores — saves ~55%', cmd: 'az sql db update -g rg-databases -s prod-sql-server -n prod-sql-main --edition GeneralPurpose --capacity 8 --family Gen5 --compute-model Provisioned' },
        { text: 'Reduce PITR retention to 14 days', cmd: 'az sql db update -g rg-databases -s prod-sql-server -n prod-sql-main --backup-storage-redundancy Local' },
        { text: 'Move to Elastic Pool to share capacity with dev databases', cmd: null }
      ],
      potentialSaving: 1_155.00
    },
    {
      id: 'r004', name: 'dev-aks-cluster', rg: 'rg-development',
      type: 'aks', typeLabel: 'Kubernetes', region: 'westeurope',
      monthlyCost: 1_560.00, usage: 8, status: 'critical',
      sku: 'Standard_D8s_v3 ×6 nodes', version: '1.27',
      issues: ['Running 24/7 in dev — not needed off-hours', 'No cluster autoscaler', 'No spot node pools'],
      fixSteps: [
        { text: 'Schedule cluster to stop at 8 PM and start at 8 AM (saves ~58%)', cmd: 'az aks stop --resource-group rg-development --name dev-aks-cluster' },
        { text: 'Enable cluster autoscaler to scale down idle nodes', cmd: 'az aks update -g rg-development -n dev-aks-cluster --enable-cluster-autoscaler --min-count 1 --max-count 6' },
        { text: 'Use spot node pools for non-critical dev workloads', cmd: 'az aks nodepool add -g rg-development --cluster-name dev-aks-cluster --name spotpool --priority Spot --eviction-policy Delete --spot-max-price -1' }
      ],
      potentialSaving: 905.00
    },
    {
      id: 'r005', name: 'prod-app-svc-01', rg: 'rg-production',
      type: 'appservice', typeLabel: 'App Service', region: 'eastus',
      monthlyCost: 480.00, usage: 22, status: 'warning',
      sku: 'P3v3 (8 core, 32 GB)', runtime: 'Node.js 18',
      issues: ['P3v3 for app using 22% CPU — P1v3 would suffice', 'Scale-out not configured'],
      fixSteps: [
        { text: 'Downsize to P1v3 App Service Plan', cmd: 'az appservice plan update --name prod-asp-01 --resource-group rg-production --sku P1V3' },
        { text: 'Enable auto-scale rules to handle traffic spikes dynamically', cmd: null }
      ],
      potentialSaving: 320.00
    },
    {
      id: 'r006', name: 'orphan-disk-01', rg: 'rg-legacy',
      type: 'storage', typeLabel: 'Managed Disk', region: 'eastus',
      monthlyCost: 92.00, usage: 0, status: 'critical',
      sku: 'Premium SSD P30 (1 TB)', state: 'Unattached',
      issues: ['Disk is unattached — not used by any VM since 45 days', 'Wasting $92/month'],
      fixSteps: [
        { text: 'Snapshot and delete the orphaned disk', cmd: 'az snapshot create -g rg-legacy -n orphan-disk-01-snapshot --source orphan-disk-01' },
        { text: 'Delete orphaned disk after snapshot', cmd: 'az disk delete -g rg-legacy -n orphan-disk-01 --yes --no-wait' }
      ],
      potentialSaving: 92.00
    },
    {
      id: 'r007', name: 'prod-lb-external', rg: 'rg-production',
      type: 'network', typeLabel: 'Load Balancer', region: 'eastus',
      monthlyCost: 156.00, usage: 5, status: 'warning',
      sku: 'Standard', rules: 12,
      issues: ['Low traffic (5% utilization)', 'Several unused LB rules', 'Static public IP not associated'],
      fixSteps: [
        { text: 'Remove unused load balancing rules', cmd: null },
        { text: 'Release unassociated static public IP to stop charges', cmd: 'az network public-ip delete -g rg-production -n unused-pip-01' }
      ],
      potentialSaving: 48.00
    },
    {
      id: 'r008', name: 'dev-sql-01', rg: 'rg-development',
      type: 'sql', typeLabel: 'SQL Database', region: 'westeurope',
      monthlyCost: 380.00, usage: 4, status: 'warning',
      sku: 'General Purpose — 8 vCores', edition: 'General Purpose',
      issues: ['Dev database running 24/7 — not needed nights/weekends', 'Can use serverless tier'],
      fixSteps: [
        { text: 'Switch to Serverless compute tier — auto-pause after 1hr idle', cmd: 'az sql db update -g rg-development -s dev-sql-server -n dev-sql-01 --compute-model Serverless --auto-pause-delay 60' }
      ],
      potentialSaving: 228.00
    },
    {
      id: 'r009', name: 'stg-backups-eu', rg: 'rg-backup',
      type: 'storage', typeLabel: 'Storage Account', region: 'westeurope',
      monthlyCost: 430.00, usage: 100, status: 'warning',
      sku: 'StorageV2 GRS', tier: 'Hot',
      issues: ['GRS redundancy for archive backups is overkill', 'Hot tier for infrequently accessed backups'],
      fixSteps: [
        { text: 'Switch redundancy to LRS for non-critical archive backups', cmd: 'az storage account update -n stgbackupseu -g rg-backup --sku Standard_LRS' },
        { text: 'Change access tier to Archive for data older than 30 days', cmd: null }
      ],
      potentialSaving: 215.00
    },
    {
      id: 'r010', name: 'prod-redis-cache', rg: 'rg-production',
      type: 'network', typeLabel: 'Azure Cache (Redis)', region: 'eastus',
      monthlyCost: 720.00, usage: 45, status: 'ok',
      sku: 'C3 Standard (6 GB)', version: '6.0',
      issues: [],
      fixSteps: [],
      potentialSaving: 0
    },
    {
      id: 'r011', name: 'prod-api-vm-02', rg: 'rg-production',
      type: 'vm', typeLabel: 'Virtual Machine', region: 'eastus',
      monthlyCost: 920.00, usage: 65, status: 'ok',
      sku: 'Standard_D8s_v3', os: 'Ubuntu 22.04',
      uptime: '99.9%', disk: 'Premium SSD 256 GB',
      issues: [],
      fixSteps: [],
      potentialSaving: 0
    },
    {
      id: 'r012', name: 'stg-cdn-assets', rg: 'rg-frontend',
      type: 'storage', typeLabel: 'Storage Account', region: 'eastus',
      monthlyCost: 145.00, usage: 78, status: 'ok',
      sku: 'StorageV2 LRS', tier: 'Hot',
      issues: [],
      fixSteps: [],
      potentialSaving: 0
    }
  ],

  // ── Anomalies ─────────────────────────────────────────────────────────────
  anomalies: [
    {
      id: 'a001', type: 'spike', title: 'Cost spike on prod-sql-main',
      desc: 'Database cost increased 340% on Feb 28 due to unplanned full scans triggered by a missing index.',
      metrics: { 'Spike Amount': '+$1,420', 'Date Detected': 'Mar 1, 2026', 'Duration': '18 hours', 'Root Cause': 'Missing index' }
    },
    {
      id: 'a002', type: 'idle', title: 'Idle VMs detected (6 machines)',
      desc: '6 virtual machines have had <2% CPU utilization for 30+ days and are likely forgotten dev/test instances.',
      metrics: { 'Idle Since': 'Jan 28, 2026', 'Monthly Waste': '$1,104', 'Resources': '6 VMs', 'Action': 'Review & terminate' }
    },
    {
      id: 'a003', type: 'orphaned', title: '12 orphaned resources found',
      desc: 'Unattached disks, unused public IPs, and stale load balancer rules are accumulating idle costs.',
      metrics: { 'Orphaned Disks': '7', 'Unused Public IPs': '3', 'Stale LB Rules': '14', 'Monthly Waste': '$340' }
    },
    {
      id: 'a004', type: 'spike', title: 'Network egress spike — East Asia',
      desc: 'Outbound data transfer to East Asia jumped 5x on Mar 1. Possible misconfigured replication.',
      metrics: { 'Data Transferred': '2.4 TB', 'Extra Cost': '+$288', 'Date': 'Mar 1, 2026', 'Region': 'East Asia' }
    },
    {
      id: 'a005', type: 'idle', title: 'AKS dev cluster idle weekends',
      desc: 'The dev-aks-cluster runs at 3% utilization every weekend, costing ~$180/weekend unnecessarily.',
      metrics: { 'Weekend Waste': '$180/wk', 'Monthly Impact': '$720', 'Avg Utilization': '3%', 'Solution': 'Auto-stop schedule' }
    }
  ],

  // ── Budgets ───────────────────────────────────────────────────────────────
  budgets: [
    {
      id: 'b001', name: 'Production Environment', scope: 'Resource Group: rg-production',
      amount: 20_000, spent: 18_420, forecast: 22_100,
      period: 'Monthly', alertThreshold: 90
    },
    {
      id: 'b002', name: 'Development & Testing', scope: 'Resource Group: rg-development',
      amount: 5_000, spent: 3_120, forecast: 4_200,
      period: 'Monthly', alertThreshold: 80
    },
    {
      id: 'b003', name: 'Data & Storage', scope: 'Service: Storage + SQL',
      amount: 8_000, spent: 8_450, forecast: 9_100,
      period: 'Monthly', alertThreshold: 100
    },
    {
      id: 'b004', name: 'Networking', scope: 'Service: VNet, LB, CDN',
      amount: 4_000, spent: 1_840, forecast: 2_200,
      period: 'Monthly', alertThreshold: 80
    }
  ]
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n, decimals = 0) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtShort(n) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'k';
  return fmt(n);
}
function usageColor(pct) {
  if (pct <= 15) return '#A4262C';
  if (pct <= 35) return '#CA5010';
  if (pct <= 75) return '#107C10';
  return '#0078D4';
}
function statusLabel(s) {
  return { critical: 'Critical', warning: 'Warning', ok: 'Healthy' }[s] || s;
}
function pct(spent, budget) { return Math.min(100, Math.round((spent / budget) * 100)); }
