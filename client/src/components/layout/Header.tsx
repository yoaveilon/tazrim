import { formatMonthHebrew, getPrevMonth, getNextMonth } from '../../utils/date';

interface Props {
  currentMonth: string;
  onMonthChange: (month: string) => void;
  onMenuToggle: () => void;
}

export default function Header({ currentMonth, onMonthChange, onMenuToggle }: Props) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => onMonthChange(getNextMonth(currentMonth))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="חודש הבא"
        >
          ←
        </button>
        <span className="text-base sm:text-lg font-semibold min-w-[120px] sm:min-w-[140px] text-center">
          {formatMonthHebrew(currentMonth)}
        </span>
        <button
          onClick={() => onMonthChange(getPrevMonth(currentMonth))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="חודש קודם"
        >
          →
        </button>
      </div>

      {/* Hamburger menu button - mobile only */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
        title="תפריט"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </header>
  );
}
