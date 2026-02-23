import { formatMonthHebrew, getPrevMonth, getNextMonth } from '../../utils/date';

interface Props {
  currentMonth: string;
  onMonthChange: (month: string) => void;
}

export default function Header({ currentMonth, onMonthChange }: Props) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onMonthChange(getNextMonth(currentMonth))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="חודש הבא"
        >
          ←
        </button>
        <span className="text-lg font-semibold min-w-[140px] text-center">
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
    </header>
  );
}
