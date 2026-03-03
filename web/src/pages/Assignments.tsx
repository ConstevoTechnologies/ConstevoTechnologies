import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  getSubscriptions,
  getResourceGroups,
  getAssignments,
  deleteAssignment,
} from '../services/api';
import AssignRoleModal from '../components/AssignRoleModal';
import { buildScope, extractRoleName, shortId } from '../utils/azure';
import type { Subscription, ResourceGroup, RoleAssignment } from '../types';

export default function Assignments() {
  const [selectedSub, setSelectedSub] = useState('');
  const [selectedRg, setSelectedRg] = useState('');
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: subscriptions = [] } = useQuery<Subscription[]>({
    queryKey: ['subscriptions'],
    queryFn: getSubscriptions,
  });

  const { data: resourceGroups = [] } = useQuery<ResourceGroup[]>({
    queryKey: ['resource-groups', selectedSub],
    queryFn: () => getResourceGroups(selectedSub),
    enabled: !!selectedSub,
  });

  const scope = selectedSub ? buildScope(selectedSub, selectedRg || undefined) : undefined;

  const { data: assignments = [], isLoading } = useQuery<RoleAssignment[]>({
    queryKey: ['assignments', scope],
    queryFn: () => getAssignments(selectedSub, scope),
    enabled: !!selectedSub,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['assignments', scope] });
    queryClient.invalidateQueries({ queryKey: ['audit'] });
  };

  const deleteMutation = useMutation({
    mutationFn: ({ name, assignmentScope }: { name: string; assignmentScope: string }) =>
      deleteAssignment(name, selectedSub, assignmentScope),
    onSuccess: invalidate,
  });

  const handleDelete = (a: RoleAssignment) => {
    if (!confirm(`Remove this role assignment?\n\nPrincipal: ${a.principalId}\nScope: ${a.scope}`)) return;
    deleteMutation.mutate({ name: a.name, assignmentScope: a.scope });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Role Assignments</h2>
          <p className="text-gray-500 mt-1">Manage who has access to which Azure resources</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={!selectedSub}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PlusIcon className="h-4 w-4" />
          Assign Role
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select
          value={selectedSub}
          onChange={(e) => { setSelectedSub(e.target.value); setSelectedRg(''); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select subscription…</option>
          {subscriptions.map((s) => (
            <option key={s.id} value={s.id}>{s.displayName}</option>
          ))}
        </select>

        <select
          value={selectedRg}
          onChange={(e) => setSelectedRg(e.target.value)}
          disabled={!selectedSub}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All resource groups</option>
          {resourceGroups.map((rg) => (
            <option key={rg.name} value={rg.name}>{rg.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!selectedSub ? (
          <div className="p-16 text-center text-gray-400 text-sm">Select a subscription to view role assignments</div>
        ) : isLoading ? (
          <div className="p-16 text-center text-gray-400 text-sm">Loading assignments…</div>
        ) : assignments.length === 0 ? (
          <div className="p-16 text-center text-gray-400 text-sm">No role assignments found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Principal ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Scope</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{shortId(a.principalId)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                        {a.principalType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{extractRoleName(a.roleDefinitionId)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{a.scope}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(a)}
                        disabled={deleteMutation.isPending}
                        className="text-red-400 hover:text-red-600 disabled:opacity-40"
                        title="Remove assignment"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && selectedSub && (
        <AssignRoleModal
          subscriptionId={selectedSub}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); invalidate(); }}
        />
      )}
    </div>
  );
}
