import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getIncomeSources, createIncome, deleteIncome,
  getIncomeRecords, updateIncomeRecord, getVariableIncome,
} from '../../services/api';
import { formatNIS } from '../../utils/currency';
import type { IncomeSource, IncomeRecord, VariableIncomeItem } from 'shared/src/types';

interface Props {
  month: string;
}

export default function IncomePage({ month }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [expectedDay, setExpectedDay] = useState('1');
  const queryClient = useQueryClient();

  const { data: sources } = useQuery({
    queryKey: ['income-sources'],
    queryFn: getIncomeSources,
  });

  const { data: records } = useQuery({
    queryKey: ['income-records', month],
    queryFn: () => getIncomeRecords(month),
  });

  const { data: variableIncome } = useQuery({
    queryKey: ['variable-income', month],
    queryFn: () => getVariableIncome(month),
  });

  const createMutation = useMutation({
    mutationFn: createIncome,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-sources'] });
      queryClient.invalidateQueries({ queryKey: ['income-records'] });
      setShowForm(false);
      setName('');
      setAmount('');
      setExpectedDay('1');
      toast.success('מקור הכנסה נוסף');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteIncome,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-sources'] });
      queryClient.invalidateQueries({ queryKey: ['income-records'] });
      toast.success('מקור הכנסה נמחק');
    },
  });

  const updateRecordMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: number; actual_amount: number; status: 'expected' | 'received' | 'partial' }) =>
      updateIncomeRecord(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-records'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('רשומה עודכנה');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      amount: parseFloat(amount),
      expected_day: parseInt(expectedDay),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">הכנסות</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'ביטול' : '+ הוסף הכנסה'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6">
          <h3 className="font-semibold mb-4">מקור הכנסה חדש</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">שם</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: משכורת"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">סכום חודשי</label>
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
              <label className="label">יום צפוי בחודש</label>
              <input
                type="number"
                min="1"
                max="31"
                value={expectedDay}
                onChange={(e) => setExpectedDay(e.target.value)}
                className="input"
                required
              />
            </div>
          </div>
          <button type="submit" className="btn-primary mt-4" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'שומר...' : 'שמור'}
          </button>
        </form>
      )}

      {/* Income sources list */}
      <div className="card mb-6">
        <h3 className="font-semibold mb-4">מקורות הכנסה</h3>
        {!sources?.length ? (
          <p className="text-gray-500 text-center py-6">אין מקורות הכנסה. הוסף את ההכנסות החודשיות שלך.</p>
        ) : (
          <div className="space-y-3">
            {sources.map((s: IncomeSource) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-gray-500">יום {s.expected_day} בחודש</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-green-600 font-medium">{formatNIS(s.amount)}</span>
                  <button
                    onClick={() => {
                      if (confirm(`למחוק את "${s.name}"?`)) {
                        deleteMutation.mutate(s.id);
                      }
                    }}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    מחק
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly records */}
      {records && records.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-4">סטטוס חודשי</h3>
          <div className="space-y-3">
            {records.map((r: IncomeRecord) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium">{r.source_name}</p>
                  <p className="text-sm text-gray-500">
                    צפוי: {formatNIS(r.expected_amount)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {r.status === 'received' ? (
                    <span className="text-green-600 font-medium">
                      {formatNIS(r.actual_amount || r.expected_amount)} ✓
                    </span>
                  ) : (
                    <button
                      onClick={() => updateRecordMutation.mutate({
                        id: r.id,
                        actual_amount: r.expected_amount,
                        status: 'received',
                      })}
                      className="text-sm btn-secondary"
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

      {/* Variable Income - Credit Card Refunds */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">הכנסות משתנות</h3>
          {variableIncome && variableIncome.total > 0 && (
            <span className="text-sm font-mono text-emerald-600 font-medium">
              סה״כ: {formatNIS(variableIncome.total)}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">זיכויים והחזרים בכרטיסי אשראי (עסקאות בסכום שלילי)</p>
        {!variableIncome?.refunds?.length ? (
          <p className="text-gray-500 text-center py-4">אין זיכויים או החזרים בחודש זה</p>
        ) : (
          <div className="space-y-2">
            {variableIncome.refunds.map((item: VariableIncomeItem) => (
              <div key={item.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString('he-IL')}</span>
                    {item.category_name && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {item.category_icon && <span className="ml-1">{item.category_icon}</span>}
                        {item.category_name}
                      </span>
                    )}
                    {item.card_last_four && (
                      <span className="text-xs text-gray-400">••{item.card_last_four}</span>
                    )}
                  </div>
                </div>
                <span className="font-mono text-emerald-600 font-medium text-sm mr-3">
                  +{formatNIS(item.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
