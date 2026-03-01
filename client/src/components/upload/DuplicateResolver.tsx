import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { SoftDuplicate } from 'shared/src/types';
import { resolveDuplicate } from '../../services/api';
import { formatNIS } from '../../utils/currency';
import { formatDateHebrew } from '../../utils/date';

interface Props {
  duplicates: SoftDuplicate[];
  onDone: () => void;
}

export default function DuplicateResolver({ duplicates, onDone }: Props) {
  const [remaining, setRemaining] = useState<SoftDuplicate[]>(duplicates);
  const [resolving, setResolving] = useState<number | null>(null);

  const resolveMutation = useMutation({
    mutationFn: ({ keepId, removeId }: { keepId: number; removeId: number }) =>
      resolveDuplicate(keepId, removeId),
    onSuccess: () => {
      toast.success('העסקה הכפולה הוסרה');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'שגיאה בהסרת העסקה');
    },
  });

  const handleSameTransaction = async (dup: SoftDuplicate) => {
    setResolving(dup.existingTransaction.id);
    try {
      // Keep the new (processed) transaction, remove the old (pending) one
      await resolveMutation.mutateAsync({
        keepId: dup.newTransaction.id,
        removeId: dup.existingTransaction.id,
      });
      setRemaining(prev => prev.filter(d => d.existingTransaction.id !== dup.existingTransaction.id));
    } finally {
      setResolving(null);
    }
  };

  const handleDifferentTransactions = (dup: SoftDuplicate) => {
    setRemaining(prev => prev.filter(d => d.existingTransaction.id !== dup.existingTransaction.id));
  };

  if (remaining.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="text-5xl mb-4">👍</div>
        <h3 className="text-xl font-bold mb-4">כל הכפילויות טופלו</h3>
        <button onClick={onDone} className="btn-primary">
          סיום
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="card mb-4">
        <h3 className="text-lg font-bold mb-1">נמצאו עסקאות דומות</h3>
        <p className="text-sm text-gray-500">
          נמצאו {duplicates.length} עסקאות במטבע זר עם אותו תאריך ובית עסק אך סכום חיוב שונה.
          ייתכן שמדובר באותה עסקה שהופיעה בעסקאות ממתינות ולאחר מכן בעסקאות מעובדות.
        </p>
      </div>

      {remaining.map((dup) => (
        <div key={dup.existingTransaction.id} className="card mb-4 border-2 border-gold-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-gold-500 text-xl">⚠</span>
            <h4 className="font-semibold">האם זו אותה עסקה?</h4>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            <span className="font-medium">{dup.newTransaction.description}</span>
            {' · '}
            {formatDateHebrew(dup.newTransaction.date)}
            {dup.newTransaction.card_last_four && (
              <>
                {' · '}
                כרטיס {dup.newTransaction.card_last_four}
              </>
            )}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">עסקה קיימת (ישנה)</p>
              <p className="text-lg font-bold">{formatNIS(dup.existingTransaction.charged_amount)}</p>
              {dup.existingTransaction.original_currency !== 'ILS' && (
                <p className="text-xs text-gray-500">
                  {dup.existingTransaction.original_amount} {dup.existingTransaction.original_currency}
                </p>
              )}
            </div>
            <div className="bg-primary-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">עסקה חדשה (מעובדת)</p>
              <p className="text-lg font-bold">{formatNIS(dup.newTransaction.charged_amount)}</p>
              {dup.newTransaction.original_currency !== 'ILS' && (
                <p className="text-xs text-gray-500">
                  {dup.newTransaction.original_amount} {dup.newTransaction.original_currency}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleSameTransaction(dup)}
              disabled={resolving === dup.existingTransaction.id}
              className="btn-primary text-sm flex-1"
            >
              {resolving === dup.existingTransaction.id
                ? 'מסיר...'
                : 'אותה עסקה – מחק את הישנה'}
            </button>
            <button
              onClick={() => handleDifferentTransactions(dup)}
              disabled={resolving === dup.existingTransaction.id}
              className="btn-secondary text-sm flex-1"
            >
              עסקאות שונות – השאר שתיהן
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
