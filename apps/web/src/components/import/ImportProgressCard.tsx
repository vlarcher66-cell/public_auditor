'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Loader2, Clock, AlertTriangle } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { apiRequest } from '@/lib/api';
import type { ImportJob } from '@public-auditor/shared';

interface ImportProgressCardProps {
  jobUuid: string;
  token: string;
  onDone?: (job: ImportJob) => void;
}

const statusConfig = {
  QUEUED: { label: 'Na fila', icon: <Clock size={16} />, color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' },
  EXTRACTING: { label: 'Extraindo dados', icon: <Loader2 size={16} className="animate-spin" />, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  TRANSFORMING: { label: 'Transformando', icon: <Loader2 size={16} className="animate-spin" />, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  LOADING: { label: 'Carregando no banco', icon: <Loader2 size={16} className="animate-spin" />, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  DONE: { label: 'Concluído', icon: <CheckCircle2 size={16} />, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  ERROR: { label: 'Erro', icon: <XCircle size={16} />, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
};

const isTerminal = (status: string) => ['DONE', 'ERROR'].includes(status);

export default function ImportProgressCard({ jobUuid, token, onDone }: ImportProgressCardProps) {
  const { data: job } = useQuery<ImportJob>({
    queryKey: ['import-job', jobUuid],
    queryFn: () => apiRequest(`/import/jobs/${jobUuid}`, { token }),
    refetchInterval: (data: ImportJob | undefined) => (data && isTerminal(data.status) ? false : 2000),
    onSuccess: (data: ImportJob) => {
      if (isTerminal(data.status)) onDone?.(data);
    },
  } as any);

  if (!job) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center gap-3 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Iniciando processamento...</span>
      </div>
    );
  }

  const config = statusConfig[job.status] || statusConfig.QUEUED;
  const progress = job.total_rows > 0 ? Math.round((job.rows_loaded / job.total_rows) * 100) : 0;

  return (
    <div className={cn('bg-white rounded-2xl border-2 p-6 space-y-4 shadow-sm', config.bg)}>
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <span className={cn('font-semibold text-sm', config.color)}>{config.label}</span>
        </div>
        <span className="text-xs text-gray-400 font-mono">{job.uuid.slice(0, 8)}...</span>
      </div>

      {/* File info */}
      <div className="text-sm text-gray-600">
        Arquivo: <span className="font-medium">{job.filename}</span>
      </div>

      {/* Progress bar */}
      {!isTerminal(job.status) && (
        <div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-navy-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(10, progress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      {job.status === 'DONE' && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Importados', value: job.rows_loaded, color: 'text-emerald-600' },
            { label: 'Ignorados', value: job.rows_skipped, color: 'text-amber-600' },
            { label: 'Com erro', value: job.rows_errored, color: 'text-red-500' },
          ].map((s) => (
            <div key={s.label} className="text-center bg-white rounded-xl p-3 border border-gray-100">
              <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Errors */}
      {job.rows_errored > 0 && Array.isArray(job.error_log) && job.error_log.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
            <AlertTriangle size={13} />
            Erros encontrados ({job.error_log.length})
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {job.error_log.slice(0, 10).map((err: any, i: number) => (
              <div key={i} className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">
                Linha {err.row_index + 1} • {err.field}: {err.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
