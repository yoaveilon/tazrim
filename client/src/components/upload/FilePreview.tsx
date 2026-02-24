import type { ParseResult } from 'shared/src/types';
import { formatNIS } from '../../utils/currency';
import { formatDateHebrew } from '../../utils/date';

const COMPANY_NAMES: Record<string, string> = {
  isracard: 'ישראכרט',
  cal: 'כאל',
  max: 'מקס',
  visa_leumi: 'ויזה / לאומי קארד',
  unknown: 'לא זוהה',
};

interface Props {
  result: ParseResult;
  onConfirm: () => void;
  onCancel: () => void;
  isImporting: boolean;
}

export default function FilePreview({ result, onConfirm, onCancel, isImporting }: Props) {
  return (
    <div>
      {/* Summary */}
      <div className="card mb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-gray-500">קובץ</p>
            <p className="font-medium">{result.filename}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">חברת אשראי</p>
            <p className="font-medium">{COMPANY_NAMES[result.detectedCompany]}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">עסקאות שפוענחו</p>
            <p className="font-medium">{result.parsedRows} מתוך {result.totalRows}</p>
          </div>
        </div>
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="bg-gold-50 border border-gold-200 rounded-lg p-4 mb-4">
          <p className="font-medium text-gold-800 mb-2">שגיאות פענוח ({result.errors.length})</p>
          <ul className="text-sm text-gold-700 space-y-1 max-h-32 overflow-y-auto">
            {result.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview table */}
      <div className="card mb-4 overflow-x-auto">
        <h3 className="font-semibold mb-3">תצוגה מקדימה (50 ראשונות)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-600">
              <th className="text-right py-2 pe-4">תאריך</th>
              <th className="text-right py-2 pe-4">בית עסק</th>
              <th className="text-left py-2 pe-4">סכום</th>
              <th className="text-right py-2">סוג</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.slice(0, 50).map((txn, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 pe-4">{formatDateHebrew(txn.date)}</td>
                <td className="py-2 pe-4">{txn.description}</td>
                <td className="py-2 pe-4 text-left font-mono">
                  {formatNIS(txn.charged_amount)}
                </td>
                <td className="py-2">
                  {txn.type === 'installments'
                    ? `תשלום ${txn.installment_number}/${txn.installment_total}`
                    : 'רגיל'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.rows.length > 50 && (
          <p className="text-sm text-gray-500 mt-2">
            ועוד {result.rows.length - 50} עסקאות...
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          disabled={isImporting || result.rows.length === 0}
          className="btn-primary"
        >
          {isImporting ? 'מייבא...' : `ייבוא ${result.rows.length} עסקאות`}
        </button>
        <button onClick={onCancel} disabled={isImporting} className="btn-secondary">
          ביטול
        </button>
      </div>
    </div>
  );
}
