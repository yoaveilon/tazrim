import { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface Props {
  children: ReactNode;
  currentMonth: string;
  onMonthChange: (month: string) => void;
}

export default function AppShell({ children, currentMonth, onMonthChange }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-surface">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentMonth={currentMonth}
          onMonthChange={onMonthChange}
          onMenuToggle={() => setSidebarOpen(true)}
        />
        <main className="flex-1 px-4 sm:px-8 py-4 sm:py-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
