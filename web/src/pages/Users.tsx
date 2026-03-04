import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlassIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getUsers, getSubscriptions, getAssignments } from '../services/api';
import { extractRoleName } from '../utils/azure';
import type { AzureUser, Subscription } from '../types';

export default function Users() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSub, setSelectedSub] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Debounce search to avoid spamming the Graph API on every keystroke
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data: subscriptions = [] } = useQuery<Subscription[]>({
    queryKey: ['subscriptions'],
    queryFn: getSubscriptions,
  });

  const { data: users = [], isLoading } = useQuery<AzureUser[]>({
    queryKey: ['users', debouncedSearch],
    queryFn: () => getUsers(debouncedSearch || undefined),
    staleTime: 60_000, // users don't change that often
  });

  const { data: userAssignments = [] } = useQuery({
    queryKey: ['assignments-for-user', expandedUserId, selectedSub],
    queryFn: () => getAssignments(selectedSub, undefined, expandedUserId!),
    enabled: !!expandedUserId && !!selectedSub,
    staleTime: 30_000,
  });

  const toggle = (userId: string) =>
    setExpandedUserId((prev) => (prev === userId ? null : userId));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Users</h2>
        <p className="text-gray-500 mt-1">Azure AD users and their role assignments</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={selectedSub}
          onChange={(e) => setSelectedSub(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select subscription to see roles…</option>
          {subscriptions.map((s) => (
            <option key={s.id} value={s.id}>{s.displayName}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-gray-400 text-sm">Loading users…</div>
        ) : users.length === 0 ? (
          <div className="p-16 text-center text-gray-400 text-sm">No users found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-6"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Job Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <React.Fragment key={user.id}>
                  <tr onClick={() => toggle(user.id)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 text-gray-400">
                      {expandedUserId === user.id
                        ? <ChevronDownIcon className="h-4 w-4" />
                        : <ChevronRightIcon className="h-4 w-4" />
                      }
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{user.displayName}</td>
                    <td className="px-4 py-3 text-gray-500">{user.userPrincipalName}</td>
                    <td className="px-4 py-3 text-gray-500">{user.jobTitle ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{user.department ?? '—'}</td>
                  </tr>

                  {expandedUserId === user.id && (
                    <tr>
                      <td colSpan={5} className="bg-blue-50 px-8 py-4 border-b border-blue-100">
                        {!selectedSub ? (
                          <p className="text-xs text-blue-600">
                            Select a subscription above to view this user&apos;s role assignments.
                          </p>
                        ) : userAssignments.length === 0 ? (
                          <p className="text-xs text-gray-400">No role assignments found in this subscription.</p>
                        ) : (
                          <>
                            <p className="text-xs font-semibold text-blue-700 mb-2">
                              {userAssignments.length} role assignment{userAssignments.length !== 1 ? 's' : ''}
                            </p>
                            <ul className="space-y-1">
                              {userAssignments.map((a) => (
                                <li key={a.id} className="text-xs font-mono text-gray-700 flex gap-2">
                                  <span className="text-blue-600">{extractRoleName(a.roleDefinitionId)}</span>
                                  <span className="text-gray-400">→</span>
                                  <span className="text-gray-600 truncate">{a.scope}</span>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
