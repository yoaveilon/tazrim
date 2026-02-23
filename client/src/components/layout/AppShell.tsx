import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface Props {
  children: ReactNode;
  currentMonth: string;
  onMonthChange: (month: string) => void;
}

export default function AppShell({ children, currentMonth, onMonthChange }: Props) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header currentMonth={currentMonth} onMonthChange={onMonthChange} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
