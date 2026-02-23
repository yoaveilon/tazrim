import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getCashFlow, setForecastOverride, getIncomeRecords, updateIncomeRecord } from '../../services/api';
import { formatNIS } from '../../utils/currency';
import { formatMonthHebrew } from '../../utils/date';
import type { CategoryForecast, IncomeRecord } from 'shared/src/types';

interface Props {
  month: string;
}

export default function DashboardPage({ month }: Props) {
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState<number | null>(null);
  const [editingIncomeValue, setEditingIncomeValue] = useState('');

  const { data: cashflow } = useQuery({
    queryKey: ['cashflow', month],
    queryFn: () => getCashFlow(month),
  });

  const { data: incomeRecords } = useQuery({
    queryKey: ['income-records', month],
    queryFn: () => getIncomeRecords(month),
  });

  const queryClient = useQueryClient();

  const incomeMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: number; expected_amount?: number; actual_amount?: number; status?: 'expected' | 'received' | 'partial' }) =>
      updateIncomeRecord(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-records'] });
      queryClient.invalidateQueries({ queryKey: ['cashflow'] });
      setEditingIncomeId(null);
      toast.success('הכנסה עודכנה');
    },
    onError: () => toast.error('שגיאה בעדכון'),
  });

  const remaining = cashflow?.remainingToSpend || 0;
  const remainingColor = remaining >= 0 ? 'text-green-600' : 'text-red-600';
  const remainingBg = remaining >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';

  // Progress bar: how much of expected income has been spent
  const spentPercent = cashflow?.expectedIncome
    ? Math.min(100, Math.round((cashflow.totalActualExpenses / cashflow.expectedIncome) * 100))
    : 0;

  // Mutation for setting forecast overrides
  const overrideMutation = useMutation({
    mutationFn: ({ categoryId, budget }: { categoryId: number; budget: number | null }) =>
      setForecastOverride(categoryId, budget),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow'] });
      toast.success('הצפי עודכן בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה בעדכון הצפי');
    },
  });

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">תזרים חודשי — {formatMonthHebrew(month)}</h2>

      {/* Top summary: 4 cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="card !p-4 sm:!p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setIncomeOpen(!incomeOpen)}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 mb-1">הכנסות צפויות</p>
            <span className={`text-xs text-gray-400 transition-transform duration-200 ${incomeOpen ? 'rotate-180' : ''}`}>▾</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-green-600">
            {formatNIS(cashflow?.expectedIncome || 0)}
          </p>
          {cashflow && cashflow.actualIncome > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              התקבל: {formatNIS(cashflow.actualIncome)}
            </p>
          )}
        </div>
        <div className="card !p-4 sm:!p-6">
          <p className="text-xs text-gray-500 mb-1">הוצאות צפויות</p>
          <p className="text-lg sm:text-xl font-bold text-orange-500">
            {formatNIS(cashflow?.totalForecastExpenses || 0)}
          </p>
        </div>
        <div className="card !p-4 sm:!p-6">
          <p className="text-xs text-gray-500 mb-1">הוצאות בפועל</p>
          <p className="text-lg sm:text-xl font-bold text-red-600">
            {formatNIS(cashflow?.totalActualExpenses || 0)}
          </p>
        </div>
        <div className={`card !p-4 sm:!p-6 border ${remainingBg}`}>
          <p className="text-xs text-gray-500 mb-1">נותר להוציא</p>
          <p className={`text-lg sm:text-xl font-bold ${remainingColor}`}>
            {formatNIS(remaining)}
          </p>
        </div>
      </div>

      {/* Income details panel */}
      {incomeOpen && incomeRecords && incomeRecords.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-3">פירוט הכנסות — {formatMonthHebrew(month)}</h3>
          <div className="space-y-2">
            {incomeRecords.map((r: IncomeRecord) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{r.source_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  {editingIncomeId === r.id ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        value={editingIncomeValue}
                        onChange={(e) => setEditingIncomeValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseFloat(editingIncomeValue);
                            if (!isNaN(val) && val > 0) {
                              incomeMutation.mutate({ id: r.id, expected_amount: val });
                            }
                          }
                          if (e.key === 'Escape') setEditingIncomeId(null);
                        }}
                        autoFocus
                        className="w-24 px-2 py-1 border border-green-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-green-400 text-left"
                      />
                      <button
                        onClick={() => {
                          const val = parseFloat(editingIncomeValue);
                          if (!isNaN(val) && val > 0) {
                            incomeMutation.mutate({ id: r.id, expected_amount: val });
                          }
                        }}
                        className="text-green-600 hover:text-green-800"
                      >✓</button>
                      <button onClick={() => setEditingIncomeId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingIncomeId(r.id);
                        setEditingIncomeValue(String(r.expected_amount));
                      }}
                      className="font-mono text-sm text-green-600 font-medium hover:text-green-800 hover:underline cursor-pointer"
                      title="לחץ לעריכה"
                    >
                      {formatNIS(r.expected_amount)}
                    </button>
                  )}
                  {r.status === 'received' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        incomeMutation.mutate({ id: r.id, actual_amount: 0, status: 'expected' });
                      }}
                      className="text-xs bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                      title="לחץ לביטול"
                    >
                      התקבל ✓
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        incomeMutation.mutate({ id: r.id, actual_amount: r.expected_amount, status: 'received' });
                      }}
                      className="text-xs bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700 px-2 py-0.5 rounded-full transition-colors"
                    >
                      סמן כהתקבל
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spending progress bar */}
      {cashflow && cashflow.expectedIncome > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">ניצול תקציב</span>
            <span className="text-sm font-mono font-medium">
              {formatNIS(cashflow.totalActualExpenses)} / {formatNIS(cashflow.expectedIncome)}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
            <div
              className={`h-4 rounded-full transition-all duration-500 ${
                spentPercent > 90 ? 'bg-red-500' : spentPercent > 70 ? 'bg-orange-400' : 'bg-green-500'
              }`}
              style={{ width: `${spentPercent}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1 text-left">{spentPercent}%</p>
        </div>
      )}

      {/* Category forecasts */}
      <div className="mb-6">
        <h3 className="font-semibold mb-4">הוצאות לפי קטגוריה</h3>
        {cashflow?.categoryForecasts?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cashflow.categoryForecasts.map((cat: CategoryForecast) => (
              <CategoryCard
                key={cat.category_id}
                cat={cat}
                onUpdateForecast={(budget) => overrideMutation.mutate({ categoryId: cat.category_id, budget })}
              />
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="text-gray-500 text-center py-8">אין נתוני תזרים עדיין. העלה קבצי אשראי כדי לראות תחזיות.</p>
          </div>
        )}
      </div>

    </div>
  );
}

// --- Sub-component: Category card ---
function CategoryCard({ cat, onUpdateForecast }: { cat: CategoryForecast; onUpdateForecast: (budget: number | null) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [expanded, setExpanded] = useState(false);

  const percent = cat.forecast > 0 ? Math.min(100, Math.round((cat.actual / cat.forecast) * 100)) : (cat.actual > 0 ? 100 : 0);
  const isOver = cat.difference < 0;
  const noForecast = cat.monthsOfData === 0;
  const isManualOverride = cat.monthsOfData === -1;

  function startEditing(e: React.MouseEvent) {
    e.stopPropagation();
    setEditValue(cat.forecast > 0 ? String(cat.forecast) : '');
    setIsEditing(true);
  }

  function handleSave() {
    const val = parseFloat(editValue);
    if (editValue.trim() === '' || isNaN(val)) {
      onUpdateForecast(null);
    } else {
      onUpdateForecast(val);
    }
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setIsEditing(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header: category name */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h4 className="font-bold text-lg text-gray-800">
          הוצאות {cat.name}
        </h4>
        {isManualOverride && (
          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">ידני</span>
        )}
      </div>

      {/* Stats row: actual (right) vs forecast (left) */}
      <div className="px-5 pb-3 flex items-end justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">יצא עד עכשיו</p>
          <p className="text-xl font-bold text-[#4361EE]">
            {formatNIS(cat.actual)}
          </p>
        </div>
        <div className="text-left">
          <p className="text-xs text-gray-400 mb-1">סה״כ מומלץ להוציא</p>
          {isEditing ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSave}
                autoFocus
                className="w-24 px-2 py-1 border border-blue-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="אוטו"
              />
              <button onClick={handleSave} className="text-green-600 hover:text-green-800" title="שמור">✓</button>
              <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600" title="ביטול">✕</button>
            </div>
          ) : (
            <button
              onClick={startEditing}
              className="text-xl font-bold text-gray-700 hover:text-[#4361EE] transition-colors cursor-pointer"
              title="לחץ לעריכת הצפי"
            >
              {noForecast ? '—' : formatNIS(cat.forecast)}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar - blue gradient like RiseUp */}
      <div className="px-5 pb-4">
        <div className="w-full rounded-full h-2.5 overflow-hidden bg-[#C7D2FE]">
          <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{
              width: noForecast ? '100%' : `${Math.min(percent, 100)}%`,
              background: isOver
                ? '#EF4444'
                : noForecast
                  ? '#C7D2FE'
                  : 'linear-gradient(to left, #818CF8, #4361EE)',
            }}
          />
        </div>
      </div>

      {/* Footer: expandable details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-2.5 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <span>פירוט חודשי</span>
        <span className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-gray-50 bg-gray-50/50 space-y-2 text-sm">
          <div className="flex justify-between pt-2">
            <span className="text-gray-500">ניצול</span>
            <span className={`font-mono font-medium ${isOver ? 'text-red-600' : 'text-green-600'}`}>
              {noForecast ? '—' : `${percent}%`}
            </span>
          </div>
          {!noForecast && (
            <div className="flex justify-between">
              <span className="text-gray-500">{isOver ? 'חריגה' : 'נותר'}</span>
              <span className={`font-mono font-medium ${isOver ? 'text-red-600' : 'text-green-600'}`}>
                {formatNIS(Math.abs(cat.difference))}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">מקור הצפי</span>
            <span className="text-gray-600">
              {isManualOverride ? 'ידני' : cat.monthsOfData === 0 ? 'אין היסטוריה' : `ממוצע ${cat.monthsOfData} חודשים`}
            </span>
          </div>
          {!noForecast && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={startEditing}
                className="flex-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg py-1.5 transition-colors"
              >
                ערוך צפי
              </button>
              {isManualOverride && (
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdateForecast(null); }}
                  className="flex-1 text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg py-1.5 transition-colors"
                >
                  חזור לאוטומטי
                </button>
              )}
            </div>
          )}
          {noForecast && (
            <button
              onClick={startEditing}
              className="w-full text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg py-1.5 transition-colors"
            >
              הגדר צפי ידנית
            </button>
          )}
        </div>
      )}
    </div>
  );
}
