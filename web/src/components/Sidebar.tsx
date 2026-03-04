import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  ShieldCheckIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

const links = [
  { to: '/dashboard', label: 'Dashboard', Icon: HomeIcon },
  { to: '/assignments', label: 'Assignments', Icon: ShieldCheckIcon },
  { to: '/users', label: 'Users', Icon: UsersIcon },
  { to: '/audit', label: 'Audit Log', Icon: ClipboardDocumentListIcon },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col shrink-0">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-base font-bold tracking-tight">Azure RBAC</h1>
        <p className="text-slate-400 text-xs mt-0.5">Role Manager</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <p className="text-slate-500 text-xs">ConstevoTechnologies</p>
      </div>
    </aside>
  );
}
