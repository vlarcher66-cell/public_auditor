'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export default function FileDropzone({ onFileSelect, disabled }: FileDropzoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setSelectedFile(accepted[0]);
      onFileSelect(accepted[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled,
  });

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200',
        isDragActive
          ? 'border-navy-500 bg-navy-50 scale-[1.01]'
          : 'border-gray-200 hover:border-navy-300 hover:bg-slate-50 bg-white',
        disabled && 'opacity-50 cursor-not-allowed',
        selectedFile && 'border-emerald-300 bg-emerald-50',
      )}
    >
      <input {...getInputProps()} />

      {selectedFile ? (
        <div className="space-y-3">
          <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
          <div className="flex items-center justify-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-emerald-200 max-w-xs mx-auto">
            <FileText size={18} className="text-navy-600 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-700 truncate">{selectedFile.name}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(selectedFile.size)}</span>
            {!disabled && (
              <button onClick={clearFile} className="text-gray-400 hover:text-red-500 flex-shrink-0 ml-1">
                <X size={14} />
              </button>
            )}
          </div>
          <p className="text-sm text-emerald-600 font-medium">Arquivo pronto para importação</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="w-16 h-16 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto">
            <Upload size={28} className={isDragActive ? 'text-navy-600 animate-bounce' : 'text-navy-400'} />
          </div>
          <div>
            <p className="text-base font-semibold text-navy-800 mb-1">
              {isDragActive ? 'Solte o arquivo aqui' : 'Arraste o arquivo ou clique para selecionar'}
            </p>
            <p className="text-sm text-gray-500">
              Suporta PDF, XLSX e CSV • Máximo 50 MB
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><FileText size={12} /> PDF</span>
            <span>•</span>
            <span className="flex items-center gap-1"><FileText size={12} /> XLSX</span>
            <span>•</span>
            <span className="flex items-center gap-1"><FileText size={12} /> CSV</span>
          </div>
        </div>
      )}
    </div>
  );
}
