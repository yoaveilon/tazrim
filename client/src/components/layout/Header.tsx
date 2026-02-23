import { formatMonthHebrew, getPrevMonth, getNextMonth } from '../../utils/date';

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
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[100px] text-center">
            {formatMonthHebrew(currentMonth)}
          </span>
          <button
            onClick={() => onMonthChange(getNextMonth(currentMonth))}
            className="p-1 hover:bg-white/80 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
            title="חודש הבא"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Hamburger menu button - mobile only */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 hover:bg-white rounded-xl transition-colors text-gray-500"
          title="תפריט"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </header>
  );
}
