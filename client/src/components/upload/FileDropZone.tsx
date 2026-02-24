import { useDropzone } from 'react-dropzone';
import clsx from 'clsx';
import { FileText, Loader } from 'lucide-react';

interface Props {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
}

export default function FileDropZone({ onFileSelected, isLoading }: Props) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    onDrop: (files) => {
      if (files.length > 0) onFileSelected(files[0]);
    },
  });

  return (
    <div
      {...getRootProps()}
      className={clsx(
        'card cursor-pointer border-2 border-dashed text-center py-16 transition-colors',
        isDragActive
          ? 'border-primary-400 bg-primary-50'
          : 'border-gray-300 hover:border-primary-300 hover:bg-gray-50',
        isLoading && 'opacity-50 pointer-events-none'
      )}
    >
      <input {...getInputProps()} />
      <div className="text-gray-300 mb-4"><FileText className="w-12 h-12 mx-auto" strokeWidth={1.5} /></div>
      {isLoading ? (
        <div>
          <div className="text-primary-500 mb-2"><Loader className="w-8 h-8 mx-auto animate-spin" strokeWidth={1.5} /></div>
          <p className="text-gray-600">מפענח את הקובץ...</p>
        </div>
      ) : isDragActive ? (
        <p className="text-primary-600 text-lg font-medium">שחרר כאן</p>
      ) : (
        <>
          <p className="text-gray-700 text-lg font-medium mb-2">
            גרור קובץ לכאן או לחץ לבחירה
          </p>
          <p className="text-gray-500 text-sm">
            CSV, Excel (.xlsx, .xls) — כאל, מקס, ויזה/לאומי קארד
          </p>
        </>
      )}
    </div>
  );
}
