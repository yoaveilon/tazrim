import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu as HeadlessMenu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import { formatMonthHebrew, getPrevMonth, getNextMonth } from '../../utils/date';
import { PRIMARY_NAV, MENU_NAV, NAV_ITEMS } from '../../utils/constants';
import { useAuth } from '../auth/AuthContext';
import clsx from 'clsx';
import {
  LayoutDashboard, PieChart, Receipt, TrendingUp, CalendarDays,
  Upload, FolderOpen, Tags, Settings, LogOut, Users,
  ChevronRight, ChevronLeft, Menu, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, PieChart, Receipt, TrendingUp,
  Calendar: CalendarDays, Upload, FolderOpen, Tags, Settings,
};

interface Props {
  currentMonth: string;
  onMonthChange: (month: string) => void;
}

export default function Header({ currentMonth, onMonthChange }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const isMenuRouteActive = MENU_NAV.some((item) => location.pathname === item.path) || location.pathname === '/admin';

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100">
        {/* Desktop */}
        <div className="hidden md:flex items-center justify-between px-6 h-14">
          {/* Right: Nav tabs (RTL) */}
          <nav className="flex items-center gap-0.5">
            {PRIMARY_NAV.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-all duration-200',
                      isActive
                        ? 'bg-primary-50 text-accent-blue font-semibold'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                    )
                  }
                >
                  {Icon && <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />}
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Left: Month nav + Settings dropdown + Avatar */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onMonthChange(getPrevMonth(currentMonth))}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                title="חודש קודם"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <span className="text-sm font-semibold text-gray-700 min-w-[100px] text-center">
                {formatMonthHebrew(currentMonth)}
              </span>
              <button
                onClick={() => onMonthChange(getNextMonth(currentMonth))}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                title="חודש הבא"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="w-px h-6 bg-gray-200" />
            <HeadlessMenu as="div" className="relative">
              <MenuButton
                className={clsx(
                  'p-2 rounded-xl transition-colors',
                  isMenuRouteActive
                    ? 'text-accent-blue bg-primary-50'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                )}
              >
                <Settings className="w-5 h-5" strokeWidth={1.5} />
              </MenuButton>

              <MenuItems className="absolute left-0 mt-2 w-52 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-50 focus:outline-none">
                {MENU_NAV.map((item) => {
                  const Icon = ICONS[item.icon];
                  return (
                    <MenuItem key={item.path}>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) =>
                          clsx(
                            'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                            isActive
                              ? 'bg-primary-50 text-accent-blue font-semibold'
                              : 'text-gray-600 hover:bg-gray-50'
                          )
                        }
                      >
                        {Icon && <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />}
                        <span>{item.label}</span>
                      </NavLink>
                    </MenuItem>
                  );
                })}
                {user?.is_admin && (
                  <>
                    <div className="border-t border-gray-100 my-1.5" />
                    <MenuItem>
                      <NavLink
                        to="/admin"
                        className={({ isActive }) =>
                          clsx(
                            'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                            isActive
                              ? 'bg-primary-50 text-accent-blue font-semibold'
                              : 'text-gray-600 hover:bg-gray-50'
                          )
                        }
                      >
                        <Users className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        <span>ניהול משתמשים</span>
                      </NavLink>
                    </MenuItem>
                  </>
                )}
                <div className="border-t border-gray-100 my-1.5" />
                <MenuItem>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 hover:text-danger-400 hover:bg-gray-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                    <span>התנתק</span>
                  </button>
                </MenuItem>
              </MenuItems>
            </HeadlessMenu>

            {/* User avatar */}
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-8 h-8 rounded-xl object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center text-xs font-bold text-accent-blue">
                {user?.name?.charAt(0) || '?'}
              </div>
            )}
          </div>
        </div>

        {/* Mobile */}
        <div className="md:hidden flex items-center justify-between px-4 h-12">
          {/* Month navigation */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onMonthChange(getPrevMonth(currentMonth))}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[100px] text-center">
              {formatMonthHebrew(currentMonth)}
            </span>
            <button
              onClick={() => onMonthChange(getNextMonth(currentMonth))}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-500"
          >
            <Menu className="w-6 h-6" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Mobile nav sheet */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed top-0 right-0 left-0 bg-white z-50 rounded-b-3xl shadow-lg animate-slideDown max-h-[85vh] overflow-y-auto">
            {/* Header row */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
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
                <div>
                  <p className="text-sm font-medium text-gray-800">{user?.name}</p>
                  <p className="text-[11px] text-gray-400">חשבון אישי</p>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Nav items */}
            <nav className="px-3 pb-4 space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm transition-all duration-200',
                        isActive
                          ? 'bg-primary-50 text-accent-blue font-semibold'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                      )
                    }
                  >
                    {Icon && <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />}
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}

              {/* Admin */}
              {user?.is_admin && (
                <NavLink
                  to="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm transition-all duration-200',
                      isActive
                        ? 'bg-primary-50 text-accent-blue font-semibold'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                    )
                  }
                >
                  <Users className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                  <span>ניהול משתמשים</span>
                </NavLink>
              )}

              {/* Logout */}
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm text-gray-500 hover:text-danger-400 hover:bg-gray-50 transition-colors"
              >
                <LogOut className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                <span>התנתק</span>
              </button>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
