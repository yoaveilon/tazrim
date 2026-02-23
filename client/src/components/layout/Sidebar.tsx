import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../utils/constants';
import { useAuth } from '../auth/AuthContext';
import clsx from 'clsx';

const ICONS: Record<string, string> = {
  LayoutDashboard: '📊',
  PieChart: '🥧',
  Receipt: '🧾',
  Upload: '📤',
  TrendingUp: '💰',
  Calendar: '📅',
  FolderOpen: '📂',
  Tags: '🏷️',
  Settings: '⚙️',
};

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-56 bg-white border-l border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-gray-100">
        <h1 className="text-xl font-bold text-primary-600">Tazrim</h1>
        <p className="text-xs text-gray-500 mt-0.5">ניהול תזרים חודשי</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            <span className="text-base">{ICONS[item.icon]}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-2 px-3 py-2">
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="w-7 h-7 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600">
              {user?.name?.charAt(0) || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">{user?.name}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors text-right"
        >
          התנתק
        </button>
      </div>
    </aside>
  );
}
