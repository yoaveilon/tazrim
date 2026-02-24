import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getCashFlow, setForecastOverride, getIncomeRecords, updateIncomeRecord, getVariableIncome, getCategories, updateTransaction } from '../../services/api';
import { formatNIS } from '../../utils/currency';
import { formatMonthHebrew } from '../../utils/date';
import type { CategoryForecast, IncomeRecord, Category } from 'shared/src/types';
import { ChevronDown, MoreVertical, Check, X, ArrowLeftRight } from 'lucide-react';

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

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const expenseCategories = categories?.filter((c: Category) => c.is_expense) || [];

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
  const remainingColor = remaining >= 0 ? 'text-success-500' : 'text-danger-400';

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
            <span className="text-xs font-semibold text-danger-400 tracking-wide">נותר להוציא</span>
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
            <span className="text-xs font-semibold text-success-500 tracking-wide">הוצאות צפויות</span>
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
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${incomeOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
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
                  stroke={spentPercent > 90 ? '#FF6B6B' : spentPercent > 70 ? '#FF6B35' : '#6C5CE7'}
                  strokeDasharray={`${spentPercent * 2.64} ${264 - spentPercent * 2.64}`}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg sm:text-xl font-bold ${spentPercent > 90 ? 'text-danger-400' : spentPercent > 70 ? 'text-warning-500' : 'text-accent-blue'}`}>
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
                          className="w-24 px-2 py-1 border border-success-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-1 focus:ring-success-400 text-left"
                        />
                        <button
                          onClick={() => {
                            const val = parseFloat(editingIncomeValue);
                            if (!isNaN(val) && val > 0) {
                              incomeMutation.mutate({ id: r.id, expected_amount: val });
                            }
                          }}
                          className="text-success-500 hover:text-success-700"
                        ><Check className="w-4 h-4" strokeWidth={1.5} /></button>
                        <button onClick={() => setEditingIncomeId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" strokeWidth={1.5} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingIncomeId(r.id);
                          setEditingIncomeValue(String(r.expected_amount));
                        }}
                        className="font-mono text-sm text-success-500 font-medium hover:text-success-700 hover:underline cursor-pointer"
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
                        className="text-xs bg-success-100 text-success-700 hover:bg-danger-50 hover:text-danger-600 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
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
                        className="text-xs bg-gray-100 text-gray-600 hover:bg-success-50 hover:text-success-700 px-2.5 py-1 rounded-full transition-colors"
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
                <h4 className="font-semibold text-sm text-success-700">הכנסות משתנות (זיכויים)</h4>
                <span className="font-mono text-sm text-success-600 font-medium">
                  +{formatNIS(variableIncome.total)}
                </span>
              </div>
              <div className="space-y-1.5">
                {variableIncome.refunds.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-gray-600 truncate flex-1 min-w-0">{item.description}</span>
                    <span className="font-mono text-success-600 mr-2">+{formatNIS(item.amount)}</span>
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
            {[...cashflow.categoryForecasts].sort((a: CategoryForecast, b: CategoryForecast) => {
              const aOver = a.difference <= 5 ? 1 : 0;
              const bOver = b.difference <= 5 ? 1 : 0;
              return aOver - bOver;
            }).map((cat: CategoryForecast) => (
              <CategoryCard
                key={cat.category_id}
                cat={cat}
                onUpdateForecast={(budget) => overrideMutation.mutate({ categoryId: cat.category_id, budget })}
                expenseCategories={expenseCategories}
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
function CategoryCard({ cat, onUpdateForecast, expenseCategories }: { cat: CategoryForecast; onUpdateForecast: (budget: number | null) => void; expenseCategories: Category[] }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editingTxnId, setEditingTxnId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const reclassifyMutation = useMutation({
    mutationFn: ({ id, category_id }: { id: number; category_id: number }) =>
      updateTransaction(id, { category_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setEditingTxnId(null);
      toast.success('הקטגוריה עודכנה');
    },
    onError: () => toast.error('שגיאה בעדכון'),
  });

  const percent = cat.forecast > 0 ? Math.min(100, Math.round((cat.actual / cat.forecast) * 100)) : (cat.actual > 0 ? 100 : 0);
  const isAtOrOverBudget = cat.difference <= 5; // within ₪5 or over
  const noForecast = cat.monthsOfData === 0;

  // Determine current week
  const today = new Date();
  const currentDay = today.getDate();

  function toggleWeek(idx: number) {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

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

  // Progress bar color: purple under budget, orange when at/over budget (within ₪5)
  const barColor = isAtOrOverBudget
    ? '#FF6B35'
    : noForecast
      ? '#D1D5DB'
      : '#6C5CE7';

  return (
    <div className="bg-white rounded-3xl border border-gray-100/80 shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden">
      {/* Header: category name + 3 dots menu */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between">
        <h4 className="font-bold text-xl text-gray-900">{cat.name}</h4>
        <button
          onClick={startEditing}
          className="text-gray-400 hover:text-gray-600 p-1 -mt-0.5"
          title="ערוך צפי"
        >
          <MoreVertical className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Editing inline */}
      {isEditing && (
        <div className="px-5 pb-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-gray-500">צפי:</span>
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            autoFocus
            className="w-24 px-2 py-1 border border-primary-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary-400"
            placeholder="אוטו"
          />
          <button onClick={handleSave} className="text-success-500 hover:text-success-700"><Check className="w-4 h-4" strokeWidth={1.5} /></button>
          <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" strokeWidth={1.5} /></button>
        </div>
      )}

      {/* Amounts row: יצא (right) + מומלץ להוציא עד (left) */}
      <div className="px-5 pb-2">
        <div className="flex items-baseline justify-between">
          <div className="text-left">
            <p className="text-xs text-gray-400 mb-0.5">מומלץ להוציא עד</p>
            <p className="text-sm text-gray-500">
              {noForecast ? '—' : formatNIS(cat.forecast)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-0.5">יצא</p>
            <p className={`text-xl font-bold ${isAtOrOverBudget ? 'text-warning-500' : 'text-gray-900'}`}>
              {formatNIS(cat.actual)}
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-4">
        <div className="w-full rounded-full h-2.5 overflow-hidden bg-gray-100">
          <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{
              width: noForecast ? '100%' : `${Math.min(percent, 100)}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
      </div>

      {/* Weekly breakdown toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500 hover:bg-gray-50/80 transition-colors"
      >
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} strokeWidth={1.5} />
        <span className="font-semibold">פירוט שבועי</span>
      </button>

      {/* Weekly breakdown content */}
      {expanded && cat.weeklyBreakdown && (
        <div className="border-t border-gray-100">
          {/* Column headers */}
          <div className="px-5 py-2 flex items-center text-xs text-gray-400 border-b border-gray-50">
            <span className="flex-1 text-right"></span>
            <span className="w-24 text-center">יצא</span>
            <span className="w-24 text-center">נשאר להוציא</span>
            <span className="w-6"></span>
          </div>

          {cat.weeklyBreakdown.map((week, idx) => {
            const isCurrentWeek = currentDay >= week.startDay && currentDay <= week.endDay;
            const isWeekExpanded = expandedWeeks.has(idx);
            const hasTransactions = week.transactions && week.transactions.length > 0;
            return (
              <div key={idx}>
                <button
                  onClick={() => hasTransactions && toggleWeek(idx)}
                  className={`w-full px-5 py-3 flex items-center border-b border-gray-50 ${isCurrentWeek ? 'bg-gray-50/50' : ''} ${hasTransactions ? 'cursor-pointer hover:bg-gray-50/30' : 'cursor-default'}`}
                >
                  <div className="flex-1 text-right">
                    {isCurrentWeek ? (
                      <span className="inline-block bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1 rounded-full">
                        {week.label}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-700 font-medium">{week.label}</span>
                    )}
                  </div>
                  <span className="w-24 text-center font-mono text-sm font-bold text-gray-900">
                    {formatNIS(week.actual)}
                  </span>
                  <span className="w-24 text-center font-mono text-sm text-gray-400">
                    {formatNIS(week.remaining)}
                  </span>
                  <span className="w-6 flex justify-center">
                    {hasTransactions && (
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform duration-200 ${isWeekExpanded ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                    )}
                  </span>
                </button>

                {/* Transactions list for this week */}
                {isWeekExpanded && week.transactions && (
                  <div className="bg-gray-50/40 border-b border-gray-50">
                    {week.transactions.map((txn) => (
                      <div key={txn.id} className="px-7 py-2 flex items-center justify-between text-sm border-b border-gray-50/80 last:border-0">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs text-gray-400 font-mono shrink-0">
                            {new Date(txn.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
                          </span>
                          {editingTxnId === txn.id ? (
                            <select
                              autoFocus
                              className="input py-1 text-xs max-w-[160px]"
                              defaultValue={cat.category_id}
                              onChange={(e) => {
                                if (e.target.value) {
                                  reclassifyMutation.mutate({
                                    id: txn.id,
                                    category_id: parseInt(e.target.value),
                                  });
                                }
                              }}
                              onBlur={() => setEditingTxnId(null)}
                            >
                              {expenseCategories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-gray-700 truncate">{txn.description}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 mr-2">
                          <span className="font-mono text-sm text-gray-900 font-medium">
                            {formatNIS(txn.charged_amount)}
                          </span>
                          {editingTxnId !== txn.id && (
                            <button
                              onClick={() => setEditingTxnId(txn.id)}
                              className="text-gray-300 hover:text-primary-500 transition-colors"
                              title="שנה קטגוריה"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
