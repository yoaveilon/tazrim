import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getTransactions, updateTransaction, deleteTransaction, getCategories,
  createFixedExpense, getSimilarTransactions, batchClassifyTransactions,
} from '../../services/api';
import { formatNIS } from '../../utils/currency';
import { formatDateHebrew } from '../../utils/date';
import type { Transaction, Category } from 'shared/src/types';
import { Pin, Receipt, RefreshCw, Trash2 } from 'lucide-react';
import CategoryIcon from '../ui/CategoryIcon';

interface Props {
  month: string;
}

interface FixedExpenseModal {
  name: string;
  amount: number;
  billingDay: number;
  categoryId: number | null;
}

interface SimilarSuggestion {
  transactions: Transaction[];
  categoryId: number;
  categoryName: string;
  categoryIcon?: string | null;
  description: string;
}

export default function TransactionsPage({ month }: Props) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fixedModal, setFixedModal] = useState<FixedExpenseModal | null>(null);
  const [similarSuggestion, setSimilarSuggestion] = useState<SimilarSuggestion | null>(null);
  const [selectedSimilarIds, setSelectedSimilarIds] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  const { data: txnData, isLoading } = useQuery({
    queryKey: ['transactions', month, search, selectedCategory],
    queryFn: () => getTransactions({
      month,
      search: search || undefined,
      category_id: selectedCategory ? parseInt(selectedCategory) : undefined,
      limit: 100,
    }),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, category_id }: { id: number; category_id: number }) =>
      updateTransaction(id, { category_id }),
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setEditingId(null);
      toast.success('הקטגוריה עודכנה');

      // Find the transaction that was just classified
      const txn = txnData?.data?.find((t: Transaction) => t.id === variables.id);
      if (!txn) return;

      // Look for similar transactions across all months
      try {
        const similar = await getSimilarTransactions(
          txn.description,
          variables.category_id,
          variables.id,
        );
        if (similar.length > 0) {
          const cat = categories?.find((c: Category) => c.id === variables.category_id);
          setSimilarSuggestion({
            transactions: similar,
            categoryId: variables.category_id,
            categoryName: cat?.name || 'לא ידוע',
            categoryIcon: cat?.icon,
            description: txn.description,
          });
          // Select all by default
          setSelectedSimilarIds(new Set(similar.map((t: Transaction) => t.id)));
        }
      } catch {
        // Silently fail - this is a suggestion, not critical
      }
    },
  });

  const batchMutation = useMutation({
    mutationFn: ({ ids, category_id }: { ids: number[]; category_id: number }) =>
      batchClassifyTransactions(ids, category_id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cashflow'] });
      setSimilarSuggestion(null);
      setSelectedSimilarIds(new Set());
      toast.success(`${result.updated} עסקאות עודכנו בהצלחה`);
    },
    onError: () => {
      toast.error('שגיאה בעדכון העסקאות');
    },
  });

  const fixedMutation = useMutation({
    mutationFn: (input: { name: string; amount: number; billing_day: number; category_id?: number }) =>
      createFixedExpense(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['cashflow'] });
      setFixedModal(null);
      toast.success('ההוצאה הקבועה נוספה בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה ביצירת הוצאה קבועה');
    },
  });

  const deleteTxnMutation = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cashflow'] });
      toast.success('העסקה נמחקה');
    },
  });

  const expenseCategories = categories?.filter((c: Category) => c.is_expense) || [];

  function openFixedModal(txn: Transaction) {
    const day = new Date(txn.date).getDate();
    setFixedModal({
      name: txn.description,
      amount: txn.charged_amount,
      billingDay: day,
      categoryId: txn.category_id,
    });
  }

  function submitFixed() {
    if (!fixedModal) return;
    fixedMutation.mutate({
      name: fixedModal.name,
      amount: fixedModal.amount,
      billing_day: fixedModal.billingDay,
      ...(fixedModal.categoryId ? { category_id: fixedModal.categoryId } : {}),
    });
  }

  function toggleSimilarId(id: number) {
    setSelectedSimilarIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAllSimilar() {
    if (!similarSuggestion) return;
    if (selectedSimilarIds.size === similarSuggestion.transactions.length) {
      setSelectedSimilarIds(new Set());
    } else {
      setSelectedSimilarIds(new Set(similarSuggestion.transactions.map((t) => t.id)));
    }
  }

  function applySimilarClassification() {
    if (!similarSuggestion || selectedSimilarIds.size === 0) return;
    batchMutation.mutate({
      ids: Array.from(selectedSimilarIds),
      category_id: similarSuggestion.categoryId,
    });
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">עסקאות</h2>

      {/* Filters */}
      <div className="card mb-4 flex gap-3 flex-col sm:flex-row">
        <input
          type="text"
          placeholder="חיפוש בית עסק..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input sm:max-w-xs"
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="input sm:max-w-[200px]"
        >
          <option value="">כל הקטגוריות</option>
          {expenseCategories.map((c: Category) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Desktop Table */}
      <div className="card hidden sm:block overflow-x-auto">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">טוען...</div>
        ) : !txnData?.data?.length ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-gray-300 mb-3"><Receipt className="w-10 h-10 mx-auto" strokeWidth={1.5} /></div>
            <p>אין עסקאות להצגה</p>
            <p className="text-sm mt-1">יש להעלות קובץ תנועות אשראי</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th className="text-right py-3 pe-4">תאריך</th>
                <th className="text-right py-3 pe-4">בית עסק</th>
                <th className="text-right py-3 pe-4">קטגוריה</th>
                <th className="text-left py-3 pe-4">סכום</th>
                <th className="text-right py-3 pe-4">סוג</th>
                <th className="w-10 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {txnData.data.map((txn: Transaction) => (
                <tr key={txn.id} className="group border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 pe-4 whitespace-nowrap">
                    {formatDateHebrew(txn.date)}
                  </td>
                  <td className="py-3 pe-4">{txn.description}</td>
                  <td className="py-3 pe-4">
                    {editingId === txn.id ? (
                      <select
                        autoFocus
                        className="input py-1 text-sm"
                        defaultValue={txn.category_id || ''}
                        onChange={(e) => {
                          updateMutation.mutate({
                            id: txn.id,
                            category_id: parseInt(e.target.value),
                          });
                        }}
                        onBlur={() => setEditingId(null)}
                      >
                        <option value="">ללא קטגוריה</option>
                        {expenseCategories.map((c: Category) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingId(txn.id)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
                        style={{
                          backgroundColor: txn.category_color ? `${txn.category_color}20` : '#f3f4f6',
                          color: txn.category_color || '#6b7280',
                        }}
                      >
                        {txn.category_icon && <CategoryIcon icon={txn.category_icon} className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        {txn.category_name || 'לא מסווג'}
                      </button>
                    )}
                  </td>
                  <td className="py-3 pe-4 text-left font-mono whitespace-nowrap">
                    {formatNIS(txn.charged_amount)}
                  </td>
                  <td className="py-3 pe-4 text-xs text-gray-500">
                    {txn.type === 'installments'
                      ? `${txn.installment_number}/${txn.installment_total}`
                      : ''}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openFixedModal(txn)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-primary-500"
                        title="סמן כהוצאה קבועה"
                      >
                        <Pin className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`למחוק את "${txn.description}"?`)) {
                            deleteTxnMutation.mutate(txn.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-danger-300 hover:text-danger-500"
                        title="מחק עסקה"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {txnData && txnData.total > 0 && (
          <div className="text-sm text-gray-500 mt-3 pt-3 border-t">
            מציג {txnData.data.length} מתוך {txnData.total} עסקאות
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {isLoading ? (
          <div className="card text-center py-12 text-gray-500">טוען...</div>
        ) : !txnData?.data?.length ? (
          <div className="card text-center py-12 text-gray-500">
            <div className="text-gray-300 mb-3"><Receipt className="w-10 h-10 mx-auto" strokeWidth={1.5} /></div>
            <p>אין עסקאות להצגה</p>
          </div>
        ) : (
          <>
            {txnData.data.map((txn: Transaction) => (
              <div key={txn.id} className="card !p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{txn.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDateHebrew(txn.date)}</p>
                  </div>
                  <p className="font-mono font-bold text-sm mr-3">{formatNIS(txn.charged_amount)}</p>
                </div>
                <div className="flex items-center justify-between">
                  {editingId === txn.id ? (
                    <select
                      autoFocus
                      className="input py-1 text-sm flex-1"
                      defaultValue={txn.category_id || ''}
                      onChange={(e) => {
                        updateMutation.mutate({
                          id: txn.id,
                          category_id: parseInt(e.target.value),
                        });
                      }}
                      onBlur={() => setEditingId(null)}
                    >
                      <option value="">ללא קטגוריה</option>
                      {expenseCategories.map((c: Category) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingId(txn.id)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: txn.category_color ? `${txn.category_color}20` : '#f3f4f6',
                        color: txn.category_color || '#6b7280',
                      }}
                    >
                      {txn.category_icon && <CategoryIcon icon={txn.category_icon} className="w-3.5 h-3.5" strokeWidth={1.5} />}
                      {txn.category_name || 'לא מסווג'}
                    </button>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openFixedModal(txn)}
                      className="text-gray-400 hover:text-primary-500 p-1"
                      title="סמן כהוצאה קבועה"
                    >
                      <Pin className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`למחוק את "${txn.description}"?`)) {
                          deleteTxnMutation.mutate(txn.id);
                        }
                      }}
                      className="text-danger-300 hover:text-danger-500 p-1"
                      title="מחק עסקה"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {txnData.total > 0 && (
              <p className="text-sm text-gray-500 text-center">
                מציג {txnData.data.length} מתוך {txnData.total} עסקאות
              </p>
            )}
          </>
        )}
      </div>

      {/* Similar Transactions Suggestion Modal */}
      {similarSuggestion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><RefreshCw className="w-5 h-5" strokeWidth={1.5} /> נמצאו עסקאות דומות</h3>
            <p className="text-sm text-gray-600 mb-1">
              נמצאו <strong>{similarSuggestion.transactions.length}</strong> עסקאות נוספות עם השם <strong>"{similarSuggestion.description}"</strong>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              לסווג גם אותן ל{similarSuggestion.categoryIcon && <CategoryIcon icon={similarSuggestion.categoryIcon} className="w-4 h-4 inline-block mx-0.5" strokeWidth={1.5} />}
              <strong>{similarSuggestion.categoryName}</strong>?
            </p>

            {/* Select all checkbox */}
            <label className="flex items-center gap-2 mb-2 cursor-pointer text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={selectedSimilarIds.size === similarSuggestion.transactions.length}
                onChange={toggleAllSimilar}
                className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              בחר הכל ({similarSuggestion.transactions.length})
            </label>

            {/* Transaction list with checkboxes */}
            <div className="overflow-y-auto flex-1 border rounded-lg divide-y divide-gray-100 mb-4">
              {similarSuggestion.transactions.map((txn) => (
                <label
                  key={txn.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedSimilarIds.has(txn.id)}
                    onChange={() => toggleSimilarId(txn.id)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{txn.description}</div>
                    <div className="text-xs text-gray-500 flex gap-3">
                      <span>{formatDateHebrew(txn.date)}</span>
                      <span className="font-mono">{formatNIS(txn.charged_amount)}</span>
                      {txn.category_name ? (
                        <span className="text-warning-500 inline-flex items-center gap-1">
                          {txn.category_icon && <CategoryIcon icon={txn.category_icon} className="w-3 h-3" strokeWidth={1.5} />}
                          {txn.category_name}
                        </span>
                      ) : (
                        <span className="text-gray-400">לא מסווג</span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={applySimilarClassification}
                disabled={batchMutation.isPending || selectedSimilarIds.size === 0}
                className="btn btn-primary flex-1"
              >
                {batchMutation.isPending
                  ? 'מעדכן...'
                  : `סווג ${selectedSimilarIds.size} עסקאות`}
              </button>
              <button
                onClick={() => {
                  setSimilarSuggestion(null);
                  setSelectedSimilarIds(new Set());
                }}
                className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 flex-1"
              >
                דלג
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Expense Modal */}
      {fixedModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Pin className="w-5 h-5" strokeWidth={1.5} /> הוספת הוצאה קבועה</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם</label>
                <input
                  type="text"
                  className="input w-full"
                  value={fixedModal.name}
                  onChange={(e) => setFixedModal({ ...fixedModal, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סכום חודשי</label>
                <input
                  type="number"
                  className="input w-full"
                  value={fixedModal.amount}
                  onChange={(e) => setFixedModal({ ...fixedModal, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">יום חיוב בחודש</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="input w-full"
                  value={fixedModal.billingDay}
                  onChange={(e) => setFixedModal({ ...fixedModal, billingDay: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">קטגוריה</label>
                <select
                  className="input w-full"
                  value={fixedModal.categoryId || ''}
                  onChange={(e) => setFixedModal({ ...fixedModal, categoryId: e.target.value ? parseInt(e.target.value) : null })}
                >
                  <option value="">ללא קטגוריה</option>
                  {expenseCategories.map((c: Category) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={submitFixed}
                disabled={fixedMutation.isPending || !fixedModal.name || fixedModal.amount <= 0}
                className="btn btn-primary flex-1"
              >
                {fixedMutation.isPending ? 'שומר...' : 'הוסף הוצאה קבועה'}
              </button>
              <button
                onClick={() => setFixedModal(null)}
                className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 flex-1"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
