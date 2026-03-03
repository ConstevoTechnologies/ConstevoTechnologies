import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getUsers, getRoles, getResourceGroups, createAssignment } from '../services/api';
import type { AzureUser, RoleDefinition, ResourceGroup } from '../types';

interface Props {
  subscriptionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AssignRoleModal({ subscriptionId, onClose, onSuccess }: Props) {
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AzureUser | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedRg, setSelectedRg] = useState('');

  const { data: users = [] } = useQuery<AzureUser[]>({
    queryKey: ['users', search],
    queryFn: () => getUsers(search),
    enabled: search.length >= 2,
  });

  const { data: roles = [] } = useQuery<RoleDefinition[]>({
    queryKey: ['roles', subscriptionId],
    queryFn: () => getRoles(subscriptionId),
  });

  const { data: resourceGroups = [] } = useQuery<ResourceGroup[]>({
    queryKey: ['resource-groups', subscriptionId],
    queryFn: () => getResourceGroups(subscriptionId),
  });

  const mutation = useMutation({
    mutationFn: createAssignment,
    onSuccess,
  });

  const scope = selectedRg
    ? `/subscriptions/${subscriptionId}/resourceGroups/${selectedRg}`
    : `/subscriptions/${subscriptionId}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedRole) return;
    mutation.mutate({ subscriptionId, principalId: selectedUser.id, roleDefinitionId: selectedRole, scope });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Assign Role</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* User search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              User <span className="text-red-500">*</span>
            </label>
            {selectedUser ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedUser.displayName}</p>
                  <p className="text-xs text-gray-500">{selectedUser.userPrincipalName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type at least 2 characters to search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {users.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {users.map((u) => (
                      <li
                        key={u.id}
                        onClick={() => { setSelectedUser(u); setSearch(''); }}
                        className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer"
                      >
                        <p className="text-sm font-medium text-gray-900">{u.displayName}</p>
                        <p className="text-xs text-gray-500">{u.userPrincipalName}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roleName}
                </option>
              ))}
            </select>
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Scope</label>
            <select
              value={selectedRg}
              onChange={(e) => setSelectedRg(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Subscription (full access)</option>
              {resourceGroups.map((rg) => (
                <option key={rg.name} value={rg.name}>
                  {rg.name} (resource group)
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-gray-400 font-mono break-all">{scope}</p>
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {(mutation.error as Error).message}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedUser || !selectedRole || mutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Assigning…' : 'Assign Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
