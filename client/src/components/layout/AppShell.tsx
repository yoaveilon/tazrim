import type { ReactNode } from 'react';
import Header from './Header';

interface Props {
  children: ReactNode;
  currentMonth: string;
  onMonthChange: (month: string) => void;
}

export default function AppShell({ children, currentMonth, onMonthChange }: Props) {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header currentMonth={currentMonth} onMonthChange={onMonthChange} />
      <main className="flex-1 px-4 sm:px-8 py-4 sm:py-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
