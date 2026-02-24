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
          <div className="flex items-center">
            {/* flow. logo */}
            <svg width="140" height="32" viewBox="20 100 330 170" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <path d="M49.608 220.024C47.048 220.024 45.0427 219.341 43.592 217.976C42.2267 216.525 41.544 214.477 41.544 211.832V168.44H35.656C33.608 168.44 32.0293 167.928 30.92 166.904C29.8107 165.795 29.256 164.301 29.256 162.424C29.256 160.461 29.8107 158.968 30.92 157.944C32.0293 156.92 33.608 156.408 35.656 156.408H46.152L41.544 160.632V156.28C41.544 147.491 43.7627 140.92 48.2 136.568C52.6373 132.131 59.0373 129.528 67.4 128.76L71.752 128.376C73.4587 128.205 74.824 128.504 75.848 129.272C76.872 129.955 77.5547 130.893 77.896 132.088C78.2373 133.197 78.28 134.349 78.024 135.544C77.768 136.739 77.2133 137.805 76.36 138.744C75.592 139.597 74.568 140.067 73.288 140.152L71.496 140.28C66.632 140.621 63.0907 141.859 60.872 143.992C58.6533 146.125 57.544 149.368 57.544 153.72V158.456L55.496 156.408H68.424C70.472 156.408 72.0507 156.92 73.16 157.944C74.2693 158.968 74.824 160.461 74.824 162.424C74.824 164.301 74.2693 165.795 73.16 166.904C72.0507 167.928 70.472 168.44 68.424 168.44H57.544V211.832C57.544 217.293 54.8987 220.024 49.608 220.024ZM105.288 220.28C98.2053 220.28 92.872 218.275 89.288 214.264C85.704 210.168 83.912 204.195 83.912 196.344V135.8C83.912 133.155 84.5947 131.149 85.96 129.784C87.3253 128.419 89.288 127.736 91.848 127.736C94.408 127.736 96.3707 128.419 97.736 129.784C99.1867 131.149 99.912 133.155 99.912 135.8V195.576C99.912 199.501 100.723 202.403 102.344 204.28C104.051 206.157 106.44 207.096 109.512 207.096C110.195 207.096 110.835 207.096 111.432 207.096C112.029 207.011 112.627 206.925 113.224 206.84C114.419 206.669 115.229 207.011 115.656 207.864C116.083 208.632 116.296 210.253 116.296 212.728C116.296 214.861 115.869 216.525 115.016 217.72C114.163 218.915 112.755 219.64 110.792 219.896C109.939 219.981 109.043 220.067 108.104 220.152C107.165 220.237 106.227 220.28 105.288 220.28ZM152.614 220.28C146.129 220.28 140.497 218.957 135.718 216.312C130.939 213.667 127.227 209.912 124.582 205.048C121.937 200.099 120.614 194.296 120.614 187.64C120.614 182.605 121.339 178.125 122.79 174.2C124.326 170.189 126.502 166.776 129.318 163.96C132.134 161.059 135.505 158.883 139.43 157.432C143.355 155.896 147.75 155.128 152.614 155.128C159.099 155.128 164.731 156.451 169.51 159.096C174.289 161.741 178.001 165.496 180.646 170.36C183.291 175.224 184.614 180.984 184.614 187.64C184.614 192.675 183.846 197.197 182.31 201.208C180.859 205.219 178.726 208.675 175.91 211.576C173.094 214.392 169.723 216.568 165.798 218.104C161.873 219.555 157.478 220.28 152.614 220.28ZM152.614 208.12C155.771 208.12 158.545 207.352 160.934 205.816C163.323 204.28 165.158 202.019 166.438 199.032C167.803 195.96 168.486 192.163 168.486 187.64C168.486 180.813 167.035 175.736 164.134 172.408C161.233 168.995 157.393 167.288 152.614 167.288C149.457 167.288 146.683 168.056 144.294 169.592C141.905 171.043 140.027 173.304 138.662 176.376C137.382 179.363 136.742 183.117 136.742 187.64C136.742 194.381 138.193 199.501 141.094 203C143.995 206.413 147.835 208.12 152.614 208.12ZM220.762 220.024C218.629 220.024 216.794 219.512 215.258 218.488C213.722 217.379 212.485 215.672 211.546 213.368L192.986 166.008C192.218 163.96 191.962 162.168 192.218 160.632C192.559 159.011 193.37 157.731 194.65 156.792C195.93 155.853 197.637 155.384 199.77 155.384C201.647 155.384 203.183 155.853 204.378 156.792C205.573 157.645 206.597 159.309 207.45 161.784L222.938 204.408H219.994L235.994 160.76C236.677 158.883 237.573 157.517 238.682 156.664C239.877 155.811 241.413 155.384 243.29 155.384C245.167 155.384 246.703 155.853 247.898 156.792C249.093 157.645 249.989 158.968 250.586 160.76L266.33 204.408H263.642L279.258 161.4C280.111 159.096 281.178 157.517 282.458 156.664C283.823 155.811 285.317 155.384 286.938 155.384C288.986 155.384 290.565 155.896 291.674 156.92C292.783 157.944 293.423 159.267 293.594 160.888C293.765 162.424 293.466 164.131 292.698 166.008L274.266 213.368C273.413 215.587 272.175 217.251 270.554 218.36C269.018 219.469 267.183 220.024 265.05 220.024C262.917 220.024 261.039 219.469 259.418 218.36C257.882 217.251 256.687 215.587 255.834 213.368L239.066 168.952H246.362L229.978 213.24C229.125 215.544 227.93 217.251 226.394 218.36C224.858 219.469 222.981 220.024 220.762 220.024Z" fill="#111111"/>
              <ellipse cx="305.5" cy="205.5" rx="13.5" ry="13.5" transform="rotate(-90 305.5 205.5)" fill="#614EEE"/>
              <circle cx="92" cy="111" r="9" transform="rotate(-90 92 111)" fill="#614EEE"/>
              <path d="M326.5 219C330.08 219 333.514 217.578 336.046 215.046C338.578 212.514 340 209.08 340 205.5C340 201.92 338.578 198.486 336.046 195.954C333.514 193.422 330.08 192 326.5 192L326.5 205.5L326.5 219Z" fill="#614EEE"/>
            </svg>
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
              className="w-full mt-2 text-xs text-gray-400 hover:text-danger-400 py-1.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
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
