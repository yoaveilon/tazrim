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
        {/* Action buttons - left side */}
        <div className="flex items-center gap-2 order-first">
          <button className="btn-primary text-sm flex items-center gap-1.5">
            <span className="text-lg leading-none">+</span>
            <span className="hidden sm:inline">פעולה חדשה</span>
          </button>
          <button className="btn-secondary text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">ייצוא דוח</span>
          </button>
        </div>

        {/* Title - right */}
        <div className="text-center sm:text-right flex-1">
          <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-3">
            <button
              onClick={() => onMonthChange(getNextMonth(currentMonth))}
              className="p-1.5 hover:bg-white/80 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
              title="חודש הבא"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              תזרים חודשי — {formatMonthHebrew(currentMonth)}
            </h1>
            <button
              onClick={() => onMonthChange(getPrevMonth(currentMonth))}
              className="p-1.5 hover:bg-white/80 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
              title="חודש קודם"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-0.5 hidden sm:block">ניהול פיננסי מקצועי וניתוח תזרים מזומנים</p>
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
