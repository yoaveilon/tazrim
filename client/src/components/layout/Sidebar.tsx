import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../utils/constants';
import { useAuth } from '../auth/AuthContext';
import clsx from 'clsx';
import {
  LayoutDashboard, PieChart, Receipt, Upload, TrendingUp,
  CalendarDays, FolderOpen, Tags, Settings, X, LogOut,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  PieChart,
  Receipt,
  Upload,
  TrendingUp,
  Calendar: CalendarDays,
  FolderOpen,
  Tags,
  Settings,
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: Props) {
  const { user, logout } = useAuth();

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 right-0 h-screen w-[220px] bg-white flex flex-col z-50 transition-transform duration-300 shadow-sidebar',
          'lg:sticky lg:translate-x-0 lg:z-0',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent-blue flex items-center justify-center text-white font-bold text-lg shadow-sm">
              ת
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">Tazrim</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 hover:bg-gray-100 rounded-xl text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm transition-all duration-200',
                  isActive
                    ? 'bg-primary-50 text-accent-blue font-semibold'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                )
              }
            >
              {(() => { const Icon = ICONS[item.icon]; return Icon ? <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} /> : null; })()}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="p-3 mt-auto">
          <div className="bg-gray-50 rounded-2xl p-3">
            <div className="flex items-center gap-2.5">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-9 h-9 rounded-xl object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center text-sm font-bold text-accent-blue">
                  {user?.name?.charAt(0) || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
                <p className="text-[11px] text-gray-400">חשבון אישי</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full mt-2 text-xs text-gray-400 hover:text-red-500 py-1.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
              התנתק
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
