import { useNavigate } from 'react-router-dom';
import type { ImportResult } from 'shared/src/types';

interface Props {
  result: ImportResult;
  onReset: () => void;
}

export default function ImportSummary({ result, onReset }: Props) {
  const navigate = useNavigate();

  return (
    <div className="card text-center py-12">
      <div className="text-5xl mb-4">✅</div>
      <h3 className="text-xl font-bold mb-6">הייבוא הושלם</h3>

      <div className="flex justify-center gap-8 mb-8">
        <div>
          <p className="text-3xl font-bold text-success-500">{result.imported}</p>
          <p className="text-sm text-gray-500">יובאו</p>
        </div>
        {result.autoClassified > 0 && (
          <div>
            <p className="text-3xl font-bold text-info-500">{result.autoClassified}</p>
            <p className="text-sm text-gray-500">סווגו אוטומטית</p>
          </div>
        )}
        {result.skipped > 0 && (
          <div>
            <p className="text-3xl font-bold text-gold-500">{result.skipped}</p>
            <p className="text-sm text-gray-500">דולגו (כפילויות)</p>
          </div>
        )}
        {result.failed > 0 && (
          <div>
            <p className="text-3xl font-bold text-danger-400">{result.failed}</p>
            <p className="text-sm text-gray-500">נכשלו</p>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-3">
        <button onClick={() => navigate('/transactions')} className="btn-primary">
          צפה בעסקאות
        </button>
        <button onClick={onReset} className="btn-secondary">
          העלה קובץ נוסף
        </button>
      </div>
    </div>
  );
}
