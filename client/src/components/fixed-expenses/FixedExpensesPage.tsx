import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getFixedExpenses, createFixedExpense, updateFixedExpense, deleteFixedExpense, getCategories,
  getFixedExpensePayments, markFixedExpensePaid, unmarkFixedExpensePaid,
  autoDetectFixedExpensePayments,
} from '../../services/api';
import { formatNIS } from '../../utils/currency';
import { formatMonthHebrew } from '../../utils/date';
import type { FixedExpense, Category } from 'shared/src/types';

interface Props {
  month: string;
}

export default function FixedExpensesPage({ month }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [billingDay, setBillingDay] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const queryClient = useQueryClient();

  const { data: expenses } = useQuery({
    queryKey: ['fixed-expenses'],
    queryFn: getFixedExpenses,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: payments } = useQuery({
    queryKey: ['fixed-expense-payments', month],
    queryFn: () => getFixedExpensePayments(month),
  });

  // Auto-detect fixed expense payments from credit card transactions
  const autoDetectedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!expenses || !payments) return; // Wait for data to load
    // Only run once per month (don't re-run if already detected for this month)
    if (autoDetectedRef.current.has(month)) return;
    autoDetectedRef.current.add(month);

    autoDetectFixedExpensePayments(month).then((result) => {
      if (result.count > 0) {
        queryClient.invalidateQueries({ queryKey: ['fixed-expense-payments'] });
        queryClient.invalidateQueries({ queryKey: ['cashflow'] });
        const names = result.matched.map((m: any) => m.fixedExpenseName).join(', ');
        toast.success(`זוהו ${result.count} תשלומים אוטומטית: ${names}`, { duration: 5000 });
      }
    }).catch(() => {
      // Silently fail - auto-detect is a convenience feature
    });
  }, [month, expenses, payments]); // eslint-disable-line react-hooks/exhaustive-deps

  const createMutation = useMutation({
    mutationFn: createFixedExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
      setShowForm(false);
      setName('');
      setAmount('');
      setBillingDay('1');
      setCategoryId('');
      toast.success('הוצאה קבועה נוספה');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFixedExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['fixed-expense-payments'] });
      toast.success('הוצאה קבועה נמחקה');
    },
  });

  const payMutation = useMutation({
    mutationFn: ({ id, amountPaid }: { id: number; amountPaid?: number }) =>
      markFixedExpensePaid(id, month, amountPaid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-expense-payments'] });
      queryClient.invalidateQueries({ queryKey: ['cashflow'] });
      toast.success('סומן כשולם');
    },
  });

  const unpayMutation = useMutation({
    mutationFn: (id: number) => unmarkFixedExpensePaid(id, month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-expense-payments'] });
      queryClient.invalidateQueries({ queryKey: ['cashflow'] });
      toast.success('סימון התשלום בוטל');
    },
  });

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');

  const updateMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: number; amount?: number; category_id?: number }) =>
      updateFixedExpense(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['cashflow'] });
      setEditingId(null);
      toast.success('הוצאה קבועה עודכנה');
    },
  });

  function startEdit(e: FixedExpense) {
    setEditingId(e.id);
    setEditAmount(String(e.amount));
    setEditCategoryId(e.category_id ? String(e.category_id) : '');
  }

  function saveEdit(id: number) {
    const val = parseFloat(editAmount);
    if (isNaN(val) || val <= 0) return;
    updateMutation.mutate({
      id,
      amount: val,
      category_id: editCategoryId ? parseInt(editCategoryId) : undefined,
    });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      amount: parseFloat(amount),
      billing_day: parseInt(billingDay),
      category_id: categoryId ? parseInt(categoryId) : undefined,
    });
  };

  const expenseCategories = categories?.filter((c: Category) => c.is_expense) || [];
  const activeExpenses = expenses?.filter((e: FixedExpense) => e.is_active) || [];
  const totalMonthly = activeExpenses.reduce((sum: number, e: FixedExpense) => sum + e.amount, 0);

  // Build a set of paid expense IDs for current month
  const paidSet = new Set<number>();
  const paidAmountMap = new Map<number, number>();
  if (payments) {
    for (const p of payments) {
      paidSet.add(p.fixed_expense_id);
      paidAmountMap.set(p.fixed_expense_id, p.amount_paid);
    }
  }

  const paidTotal = activeExpenses
    .filter((e: FixedExpense) => paidSet.has(e.id))
    .reduce((sum: number, e: FixedExpense) => sum + (paidAmountMap.get(e.id) || e.amount), 0);

  const unpaidTotal = totalMonthly - paidTotal;

  function togglePaid(expense: FixedExpense) {
    if (paidSet.has(expense.id)) {
      unpayMutation.mutate(expense.id);
    } else {
      payMutation.mutate({ id: expense.id });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">הוצאות קבועות</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'ביטול' : '+ הוסף הוצאה'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6">
          <h3 className="font-semibold mb-4">הוצאה קבועה חדשה</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">שם</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: שכר דירה"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">סכום</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">יום חיוב</label>
              <input
                type="number"
                min="1"
                max="31"
                value={billingDay}
                onChange={(e) => setBillingDay(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">קטגוריה</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input"
              >
                <option value="">ללא</option>
                {expenseCategories.map((c: Category) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary mt-4" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'שומר...' : 'שמור'}
          </button>
        </form>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">סה"כ חודשי</p>
          <p className="text-xl font-bold text-red-600">{formatNIS(totalMonthly)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">שולם ב{formatMonthHebrew(month)}</p>
          <p className="text-xl font-bold text-green-600">{formatNIS(paidTotal)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">טרם שולם</p>
          <p className="text-xl font-bold text-orange-500">{formatNIS(unpaidTotal)}</p>
        </div>
      </div>

      {/* Month label */}
      <div className="text-sm text-gray-500 mb-3">
        סטטוס תשלום עבור: <strong>{formatMonthHebrew(month)}</strong>
      </div>

      {/* List */}
      <div className="card">
        {!activeExpenses.length ? (
          <p className="text-gray-500 text-center py-6">אין הוצאות קבועות. הוסף הוצאות כמו שכ"ד, משכנתא, מנויים.</p>
        ) : (
          <div className="space-y-2">
            {activeExpenses.map((e: FixedExpense) => {
              const isPaid = paidSet.has(e.id);
              const paidAmount = paidAmountMap.get(e.id);
              const isEditing = editingId === e.id;

              return (
                <div
                  key={e.id}
                  className={`group flex items-center justify-between py-3 px-3 rounded-lg border transition-colors ${
                    isPaid
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Payment toggle */}
                    <button
                      onClick={() => togglePaid(e)}
                      disabled={payMutation.isPending || unpayMutation.isPending}
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 text-sm ${
                        isPaid
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-400 text-transparent hover:text-green-300'
                      }`}
                      title={isPaid ? 'בטל סימון תשלום' : 'סמן כשולם'}
                    >
                      ✓
                    </button>
                    <div>
                      <p className={`font-medium ${isPaid ? 'line-through text-gray-400' : ''}`}>
                        {e.name}
                      </p>
                      {isEditing ? (
                        <select
                          value={editCategoryId}
                          onChange={(ev) => setEditCategoryId(ev.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 mt-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          <option value="">ללא קטגוריה</option>
                          {expenseCategories.map((c: Category) => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-gray-500">
                          יום {e.billing_day} בחודש
                          {e.category_name && ` · ${e.category_name}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5" onClick={(ev) => ev.stopPropagation()}>
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(ev) => setEditAmount(ev.target.value)}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter') saveEdit(e.id);
                            if (ev.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="w-24 px-2 py-1 border border-blue-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 text-left"
                        />
                        <button onClick={() => saveEdit(e.id)} className="text-green-600 hover:text-green-800">✓</button>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                    ) : (
                      <div className="text-left">
                        <span className={`font-mono font-medium ${isPaid ? 'text-green-600' : 'text-red-600'}`}>
                          {formatNIS(paidAmount || e.amount)}
                        </span>
                        {isPaid && (
                          <span className="block text-xs text-green-600">שולם ✓</span>
                        )}
                      </div>
                    )}
                    {!isEditing && (
                      <>
                        <button
                          onClick={() => startEdit(e)}
                          className="text-gray-400 hover:text-blue-600 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          title="ערוך"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`למחוק את "${e.name}"?`)) {
                              deleteMutation.mutate(e.id);
                            }
                          }}
                          className="text-red-400 hover:text-red-600 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          title="מחק"
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
