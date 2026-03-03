import { useQuery } from '@tanstack/react-query';
import {
  HomeIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline';
import { getSubscriptions, getAuditLog } from '../services/api';
import type { AuditLogEntry } from '../types';

function StatCard({
  label,
  value,
  Icon,
  color,
}: {
  label: string;
  value: number | string;
  Icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function actionBadge(action: AuditLogEntry['action']) {
  return action === 'ASSIGN'
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700';
}

export default function Dashboard() {
  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: getSubscriptions,
  });

  const { data: audit } = useQuery({
    queryKey: ['audit', 0],
    queryFn: () => getAuditLog(5, 0),
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Overview of your Azure RBAC configuration</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          label="Subscriptions"
          value={subscriptions.length}
          Icon={ServerStackIcon}
          color="bg-blue-500"
        />
        <StatCard
          label="Total Audit Events"
          value={audit?.total ?? '—'}
          Icon={ShieldCheckIcon}
          color="bg-emerald-500"
        />
        <StatCard
          label="Recent Changes"
          value={audit?.data.length ?? '—'}
          Icon={ClipboardDocumentListIcon}
          color="bg-violet-500"
        />
      </div>

      {/* Subscriptions list */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <HomeIcon className="h-4 w-4" />
          Subscriptions
        </h3>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-gray-400">No subscriptions found. Check your Azure credentials.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {subscriptions.map((s) => (
              <li key={s.id} className="py-2.5 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{s.displayName}</span>
                <span className="text-xs text-gray-400 font-mono">{s.id}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h3>
        {!audit?.data.length ? (
          <p className="text-sm text-gray-400">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {audit.data.map((log) => (
              <li key={log.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`shrink-0 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${actionBadge(log.action)}`}
                  >
                    {log.action}
                  </span>
                  <span className="text-sm text-gray-700 font-mono truncate">
                    {log.principalId.slice(0, 8)}…
                  </span>
                  <span className="text-xs text-gray-400 truncate hidden sm:block">{log.scope}</span>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
