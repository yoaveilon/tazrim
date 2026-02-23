import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getCashFlow, setForecastOverride, getIncomeRecords, updateIncomeRecord, getVariableIncome } from '../../services/api';
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

  const { data: variableIncome } = useQuery({
    queryKey: ['variable-income', month],
    queryFn: () => getVariableIncome(month),
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
      {/* Top summary: 4 cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5 mb-6">
        {/* Balance card */}
        <div className="card !p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-1">
            <span className="text-xs font-semibold text-red-500 tracking-wide">נותר להוציא</span>
          </div>
          <div className="px-5 pb-5">
            <p className={`text-2xl sm:text-3xl font-bold ${remainingColor}`}>
              {formatNIS(remaining)}
            </p>
          </div>
        </div>

        {/* Expenses card */}
        <div className="card !p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-1">
            <span className="text-xs font-semibold text-green-500 tracking-wide">הוצאות צפויות</span>
          </div>
          <div className="px-5 pb-5">
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              {formatNIS(cashflow?.totalForecastExpenses || 0)}
            </p>
          </div>
        </div>

        {/* Income card */}
        <div
          className="card !p-0 overflow-hidden cursor-pointer"
          onClick={() => setIncomeOpen(!incomeOpen)}
        >
          <div className="px-5 pt-5 pb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-accent-blue tracking-wide">הכנסה צפויה</span>
            <span className={`text-xs text-gray-400 transition-transform duration-200 ${incomeOpen ? 'rotate-180' : ''}`}>▾</span>
          </div>
          <div className="px-5 pb-5">
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              {formatNIS(cashflow?.expectedIncome || 0)}
            </p>
          </div>
        </div>

        {/* Donut chart card - budget usage */}
        <div className="card !p-0 overflow-hidden flex items-center justify-center">
          <div className="py-4 flex flex-col items-center">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  stroke={spentPercent > 90 ? '#EF4444' : spentPercent > 70 ? '#F97316' : '#4361EE'}
                  strokeDasharray={`${spentPercent * 2.64} ${264 - spentPercent * 2.64}`}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg sm:text-xl font-bold ${spentPercent > 90 ? 'text-red-500' : spentPercent > 70 ? 'text-orange-500' : 'text-accent-blue'}`}>
                  {spentPercent}%
                </span>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">ניצול תקציב</p>
          </div>
        </div>
      </div>

      {/* Income details panel */}
      {incomeOpen && (
        <div className="card mb-6">
          {/* Fixed income section */}
          <h3 className="font-semibold mb-3">הכנסות קבועות — {formatMonthHebrew(month)}</h3>
          {incomeRecords && incomeRecords.length > 0 ? (
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
                          className="w-24 px-2 py-1 border border-green-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-1 focus:ring-green-400 text-left"
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
                        className="text-xs bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
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
                        className="text-xs bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700 px-2.5 py-1 rounded-full transition-colors"
                      >
                        סמן כהתקבל
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2">אין הכנסות קבועות מוגדרות</p>
          )}

          {/* Variable income section */}
          {variableIncome && variableIncome.total > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-emerald-700">הכנסות משתנות (זיכויים)</h4>
                <span className="font-mono text-sm text-emerald-600 font-medium">
                  +{formatNIS(variableIncome.total)}
                </span>
              </div>
              <div className="space-y-1.5">
                {variableIncome.refunds.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-gray-600 truncate flex-1 min-w-0">{item.description}</span>
                    <span className="font-mono text-emerald-600 mr-2">+{formatNIS(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category forecasts */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">פירוט הוצאות לפי קטגוריות</h3>
          <button className="text-sm text-accent-blue hover:text-primary-700 font-medium transition-colors">
            הצג הכל
          </button>
        </div>
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
            <p className="text-gray-400 text-center py-8">אין נתוני תזרים עדיין. העלה קבצי אשראי כדי לראות תחזיות.</p>
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

  // Badge label
  const badgeLabel = isOver ? 'חריגה קלה' : 'עומד ביעד';
  const badgeColor = isOver ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600';

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
    <div className="bg-white rounded-3xl border border-gray-100/80 shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden">
      {/* Header: badge */}
      <div className="px-5 pt-5 pb-2">
        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${badgeColor}`}>
          {badgeLabel}
        </span>
      </div>

      {/* Category name */}
      <div className="px-5 pb-1">
        <h4 className="font-bold text-base text-gray-900">{cat.name}</h4>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {isManualOverride ? 'ידני' : noForecast ? 'הוצאה משתנה' : `הוצאה ${cat.monthsOfData > 0 ? 'משתנה' : 'קבועה'} • ${cat.monthsOfData > 0 ? 'אשראי' : 'מזומן'}`}
        </p>
      </div>

      {/* Amount */}
      <div className="px-5 pt-2 pb-4">
        {isEditing ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              autoFocus
              className="w-28 px-3 py-1.5 border border-blue-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="אוטו"
            />
            <button onClick={handleSave} className="text-green-600 hover:text-green-800" title="שמור">✓</button>
            <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600" title="ביטול">✕</button>
          </div>
        ) : (
          <p className="text-2xl font-bold text-gray-900">
            {formatNIS(cat.actual)}
          </p>
        )}
      </div>

      {/* Expand button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 border-t border-gray-50 flex items-center justify-between text-sm text-gray-400 hover:bg-gray-50/80 transition-colors"
      >
        <svg className={`w-5 h-5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-gray-50 bg-gray-50/30 space-y-2.5 text-sm">
          <div className="flex justify-between pt-3">
            <span className="text-gray-500">צפי חודשי</span>
            <button onClick={startEditing} className="font-mono font-medium text-accent-blue hover:underline cursor-pointer">
              {noForecast ? '—' : formatNIS(cat.forecast)}
            </button>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">ניצול</span>
            <span className={`font-mono font-medium ${isOver ? 'text-red-500' : 'text-green-600'}`}>
              {noForecast ? '—' : `${percent}%`}
            </span>
          </div>
          {!noForecast && (
            <div className="flex justify-between">
              <span className="text-gray-500">{isOver ? 'חריגה' : 'נותר'}</span>
              <span className={`font-mono font-medium ${isOver ? 'text-red-500' : 'text-green-600'}`}>
                {formatNIS(Math.abs(cat.difference))}
              </span>
            </div>
          )}

          {/* Progress bar */}
          <div className="w-full rounded-full h-2 overflow-hidden bg-gray-200 mt-1">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: noForecast ? '100%' : `${Math.min(percent, 100)}%`,
                background: isOver
                  ? '#EF4444'
                  : noForecast
                    ? '#D1D5DB'
                    : 'linear-gradient(to left, #818CF8, #4361EE)',
              }}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={startEditing}
              className="flex-1 text-xs bg-primary-50 text-accent-blue hover:bg-primary-100 rounded-xl py-2 transition-colors font-medium"
            >
              ערוך צפי
            </button>
            {isManualOverride && (
              <button
                onClick={(e) => { e.stopPropagation(); onUpdateForecast(null); }}
                className="flex-1 text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-xl py-2 transition-colors font-medium"
              >
                חזור לאוטומטי
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
