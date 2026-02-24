import { formatMonthHebrew, getPrevMonth, getNextMonth } from '../../utils/date';
import { ChevronRight, ChevronLeft, Menu } from 'lucide-react';

interface Props {
  currentMonth: string;
  onMonthChange: (month: string) => void;
  onMenuToggle: () => void;
}

export default function Header({ currentMonth, onMonthChange, onMenuToggle }: Props) {
  return (
    <header className="px-4 sm:px-8 pt-6 pb-2">
      <div className="flex items-center justify-between">
        {/* Spacer for balance on desktop */}
        <div className="hidden lg:block" />

        {/* Month navigation - right aligned */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onMonthChange(getPrevMonth(currentMonth))}
            className="p-1 hover:bg-white/80 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
            title="חודש קודם"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[100px] text-center">
            {formatMonthHebrew(currentMonth)}
          </span>
          <button
            onClick={() => onMonthChange(getNextMonth(currentMonth))}
            className="p-1 hover:bg-white/80 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
            title="חודש הבא"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Hamburger menu button - mobile only */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 hover:bg-white rounded-xl transition-colors text-gray-500"
          title="תפריט"
        >
          <Menu className="w-6 h-6" strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
