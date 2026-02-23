import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { parseFile, importTransactions } from '../../services/api';
import type { ParseResult, ImportResult } from 'shared/src/types';
import FileDropZone from './FileDropZone';
import FilePreview from './FilePreview';
import ImportSummary from './ImportSummary';

type Step = 'upload' | 'preview' | 'done';

export default function UploadPage() {
  const [step, setStep] = useState<Step>('upload');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const parseMutation = useMutation({
    mutationFn: parseFile,
    onSuccess: (result) => {
      setParseResult(result);
      setStep('preview');
      if (result.errors.length > 0) {
        toast(`${result.errors.length} שורות נכשלו בפענוח`, { icon: '⚠️' });
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'שגיאה בפענוח הקובץ');
    },
  });

  const importMutation = useMutation({
    mutationFn: importTransactions,
    onSuccess: (result) => {
      setImportResult(result);
      setStep('done');
      const msg = result.autoClassified > 0
        ? `יובאו ${result.imported} עסקאות (${result.autoClassified} סווגו אוטומטית)`
        : `יובאו ${result.imported} עסקאות בהצלחה`;
      toast.success(msg);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'שגיאה בייבוא');
    },
  });

  const handleFileSelected = (file: File) => {
    parseMutation.mutate(file);
  };

  const handleConfirmImport = () => {
    if (!parseResult) return;
    importMutation.mutate({
      transactions: parseResult.rows,
      sourceCompany: parseResult.detectedCompany,
      filename: parseResult.filename,
    });
  };

  const handleReset = () => {
    setStep('upload');
    setParseResult(null);
    setImportResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">העלאת קובץ תנועות</h2>

      {step === 'upload' && (
        <FileDropZone
          onFileSelected={handleFileSelected}
          isLoading={parseMutation.isPending}
        />
      )}

      {step === 'preview' && parseResult && (
        <FilePreview
          result={parseResult}
          onConfirm={handleConfirmImport}
          onCancel={handleReset}
          isImporting={importMutation.isPending}
        />
      )}

      {step === 'done' && importResult && (
        <ImportSummary result={importResult} onReset={handleReset} />
      )}
    </div>
  );
}
