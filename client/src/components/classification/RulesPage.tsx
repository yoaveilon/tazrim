import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getClassificationRules, createRule, deleteRule,
  reclassifyTransactions, getCategories, getUnclassifiedTransactions,
  updateTransaction,
} from '../../services/api';
import type { ClassificationRule, Category, Transaction } from 'shared/src/types';

export default function RulesPage() {
  const [showForm, setShowForm] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const queryClient = useQueryClient();

  const { data: rules } = useQuery({
    queryKey: ['classification-rules'],
    queryFn: getClassificationRules,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: unclassified } = useQuery({
    queryKey: ['unclassified-transactions'],
    queryFn: () => getUnclassifiedTransactions({ limit: 20 }),
  });

  const createMutation = useMutation({
    mutationFn: createRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classification-rules'] });
      setShowForm(false);
      setKeyword('');
      setCategoryId('');
      toast.success('כלל סיווג נוסף');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classification-rules'] });
      toast.success('כלל נמחק');
    },
  });

  const reclassifyMutation = useMutation({
    mutationFn: () => reclassifyTransactions(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['unclassified-transactions'] });
      toast.success(`${result.updated} עסקאות סווגו מחדש`);
    },
  });

  const updateTxnMutation = useMutation({
    mutationFn: ({ id, category_id }: { id: number; category_id: number }) =>
      updateTransaction(id, { category_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unclassified-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      keyword,
      category_id: parseInt(categoryId),
    });
  };

  const expenseCategories = categories?.filter((c: Category) => c.is_expense) || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">כללי סיווג</h2>
        <div className="flex gap-2">
          <button
            onClick={() => reclassifyMutation.mutate()}
            disabled={reclassifyMutation.isPending}
            className="btn-secondary"
          >
            {reclassifyMutation.isPending ? 'מסווג...' : 'סווג מחדש הכל'}
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? 'ביטול' : '+ כלל חדש'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6">
          <h3 className="font-semibold mb-4">כלל סיווג חדש</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">מילת מפתח</label>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="לדוגמה: שופרסל"
                className="input"
                required
              />
              <p className="text-xs text-gray-500 mt-1">יחפש את המילה בשם בית העסק</p>
            </div>
            <div>
              <label className="label">קטגוריה</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input"
                required
              >
                <option value="">בחר קטגוריה</option>
                {expenseCategories.map((c: Category) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary mt-4" disabled={createMutation.isPending}>
            שמור
          </button>
        </form>
      )}

      {/* Unclassified transactions */}
      {unclassified?.data && unclassified.data.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-3 text-amber-700">
            עסקאות לא מסווגות ({unclassified.total})
          </h3>
          <div className="space-y-2">
            {unclassified.data.map((txn: Transaction) => (
              <div key={txn.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm">{txn.description}</span>
                <select
                  className="input py-1 text-sm max-w-[180px]"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      updateTxnMutation.mutate({
                        id: txn.id,
                        category_id: parseInt(e.target.value),
                      });
                    }
                  }}
                >
                  <option value="">סווג...</option>
                  {expenseCategories.map((c: Category) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules list */}
      <div className="card">
        <h3 className="font-semibold mb-4">כללים קיימים ({rules?.length || 0})</h3>
        {!rules?.length ? (
          <p className="text-gray-500 text-center py-6">אין כללי סיווג</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th className="text-right py-2 pe-4">מילת מפתח</th>
                <th className="text-right py-2 pe-4">קטגוריה</th>
                <th className="text-right py-2 pe-4">עדיפות</th>
                <th className="text-right py-2">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule: ClassificationRule) => (
                <tr key={rule.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pe-4 font-mono">{rule.keyword}</td>
                  <td className="py-2 pe-4">{rule.category_name}</td>
                  <td className="py-2 pe-4">{rule.priority}</td>
                  <td className="py-2">
                    <button
                      onClick={() => deleteMutation.mutate(rule.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      מחק
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
