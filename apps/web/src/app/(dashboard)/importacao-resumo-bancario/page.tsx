'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Upload, Clock, CheckCircle2, XCircle, RefreshCw, Trash2, X, FileText, Info, Landmark } from 'lucide-react';
import { SearchSelect } from '@/components/SearchSelect';
import TopBar from '@/components/dashboard/TopBar';
import FileDropzone from '@/components/import/FileDropzone';
import ImportProgressCard from '@/components/import/ImportProgressCard';
import { apiUpload, apiRequest } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ImportJob } from '@public-auditor/shared';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const statusIcon: Record<string, React.ReactNode> = {
  QUEUED:      <Clock size={14} className="text-gray-400" />,
  EXTRACTING:  <RefreshCw size={14} className="text-blue-400 animate-spin" />,
  TRANSFORMING:<RefreshCw size={14} className="text-amber-400 animate-spin" />,
  LOADING:     <RefreshCw size={14} className="text-purple-400 animate-spin" />,
  DONE:        <CheckCircle2 size={14} className="text-emerald-500" />,
  ERROR:       <XCircle size={14} className="text-red-500" />,
};

const PERIODOS = [
  { label: 'Janeiro/2026',   value: '2026-01' },
  { label: 'Fevereiro/2026', value: '2026-02' },
  { label: 'Março/2026',     value: '2026-03' },
  { label: 'Abril/2026',     value: '2026-04' },
  { label: 'Maio/2026',      value: '2026-05' },
  { label: 'Junho/2026',     value: '2026-06' },
  { label: 'Julho/2026',     value: '2026-07' },
  { label: 'Agosto/2026',    value: '2026-08' },
  { label: 'Setembro/2026',  value: '2026-09' },
  { label: 'Outubro/2026',   value: '2026-10' },
  { label: 'Novembro/2026',  value: '2026-11' },
  { label: 'Dezembro/2026',  value: '2026-12' },
  { label: 'Janeiro/2025',   value: '2025-01' },
  { label: 'Fevereiro/2025', value: '2025-02' },
  { label: 'Março/2025',     value: '2025-03' },
  { label: 'Dezembro/2025',  value: '2025-12' },
];

function ConfigModal({ filename, token, onConfirm, onCancel }: {
  filename: string; token: string;
  onConfirm: (entidadeId: number, periodoRef: string) => void;
  onCancel: () => void;
}) {
  const [municipioId, setMunicipioId] = useState('');
  const [entidadeId, setEntidadeId]   = useState('');
  const [periodoRef, setPeriodoRef]   = useState('2026-01');

  const { data: municipios = [], isLoading: loadingMun } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ['municipios-list'],
    queryFn: () => apiRequest('/municipios', { token, params: { limit: 200 } }).then((d: any) => d.rows ?? d),
    enabled: !!token,
  });

  const { data: entidades = [], isLoading: loadingEnt } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ['entidades-list', municipioId],
    queryFn: () => apiRequest('/entidades', { token, params: { limit: 200, ...(municipioId ? { municipioId } : {}) } }).then((d: any) => d.rows ?? d),
    enabled: !!token,
  });

  const canConfirm = !!municipioId && !!entidadeId && !!periodoRef;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-cyan-100 rounded-xl flex items-center justify-center">
              <Landmark size={18} className="text-cyan-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#0F2A4E]">Configurar Importação</h3>
              <p className="text-xs text-gray-400 truncate max-w-[220px]">{filename}</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-2 bg-cyan-50 rounded-xl p-3">
            <Info size={14} className="text-cyan-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-cyan-700">
              Importe o <strong>Resumo Bancário</strong> exportado pelo FATOR.
              O sistema registra o saldo de cada conta ao fim do período para acompanhar a evolução do caixa mês a mês.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Município <span className="text-red-400">*</span></label>
            {loadingMun ? (
              <div className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-400 bg-gray-50">Carregando...</div>
            ) : (
              <SearchSelect value={municipioId} onChange={val => { setMunicipioId(String(val)); setEntidadeId(''); }} options={municipios} placeholder="Selecione o município" required />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Entidade <span className="text-red-400">*</span></label>
            {!municipioId ? (
              <div className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-300 bg-gray-50 cursor-not-allowed">Selecione um município primeiro</div>
            ) : loadingEnt ? (
              <div className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-400 bg-gray-50">Carregando...</div>
            ) : (
              <SearchSelect value={entidadeId} onChange={val => setEntidadeId(String(val))} options={entidades} placeholder="Selecione a entidade" required />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Período de Referência <span className="text-red-400">*</span></label>
            <select
              value={periodoRef}
              onChange={e => setPeriodoRef(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Mês/ano de fechamento do saldo bancário.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500">Cancelar</button>
          <button
            onClick={() => canConfirm && onConfirm(parseInt(entidadeId), periodoRef)}
            disabled={!canConfirm}
            className={cn('px-4 py-2 text-sm rounded-xl text-white font-semibold transition-colors',
              canConfirm ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed')}
          >
            Confirmar e Importar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ImportacaoResumoBancarioPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string;

  const [selectedFile, setSelectedFile]       = useState<File | null>(null);
  const [uploading, setUploading]             = useState(false);
  const [activeJobUuid, setActiveJobUuid]     = useState<string | null>(null);
  const [uploadError, setUploadError]         = useState('');
  const [deletingUuid, setDeletingUuid]       = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const { data: jobsData, refetch: refetchJobs } = useQuery({
    queryKey: ['import-resumo-bancario-jobs'],
    queryFn: async () => {
      try {
        return await apiRequest<{ jobs: ImportJob[]; total: number }>(
          '/import/jobs', { token, params: { limit: 20, tipo: 'RESUMO_BANCARIO' } },
        );
      } catch { return undefined; }
    },
    enabled: !!token,
    refetchInterval: activeJobUuid ? 3000 : 30000,
  });

  const handleDelete = async (job: ImportJob) => {
    const label = job.filename.length > 40 ? job.filename.slice(0, 40) + '...' : job.filename;
    if (!confirm(`Excluir "${label}"?`)) return;
    setDeletingUuid(job.uuid);
    try {
      await apiRequest(`/import/jobs/${job.uuid}`, { method: 'DELETE', token });
      refetchJobs();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir');
    } finally { setDeletingUuid(null); }
  };

  const handleConfirmUpload = async (entidadeId: number, periodoRef: string) => {
    if (!selectedFile || !token) return;
    setShowConfigModal(false);
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('tipo_relatorio', 'RESUMO_BANCARIO');
      formData.append('entidade_id', String(entidadeId));
      formData.append('periodo', periodoRef);
      const result = await apiUpload('/import/upload', formData, token) as any;
      setActiveJobUuid(result.uuid);
      setSelectedFile(null);
      refetchJobs();
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao enviar arquivo');
    } finally { setUploading(false); }
  };

  return (
    <div>
      <TopBar title="Importação — Resumo Bancário" subtitle="Registre o saldo bancário de cada entidade ao fim do mês" />

      <div className="p-4 md:p-8 space-y-8">

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
          <h2 className="text-base font-semibold text-navy-800 flex items-center gap-2">
            <Landmark size={18} className="text-cyan-500" />
            Novo Resumo Bancário
          </h2>

          <div className="flex items-start gap-3 bg-cyan-50 border border-cyan-100 rounded-xl px-4 py-3">
            <FileText size={16} className="text-cyan-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-cyan-800 space-y-0.5">
              <p className="font-semibold">Formato esperado: Resumo Bancário (FATOR)</p>
              <p className="text-cyan-700">
                Exporte o relatório em Excel pelo FATOR. O sistema registra o saldo de cada conta
                ao fim do período para acompanhar a evolução do caixa mês a mês.
              </p>
            </div>
          </div>

          <FileDropzone onFileSelect={setSelectedFile} disabled={uploading} />

          {uploadError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{uploadError}</div>
          )}

          <button
            onClick={() => selectedFile && !uploading && setShowConfigModal(true)}
            disabled={!selectedFile || uploading}
            className={cn(
              'w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2',
              selectedFile && !uploading ? 'bg-cyan-600 hover:bg-cyan-700 shadow-md' : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            )}
          >
            {uploading ? <><RefreshCw size={16} className="animate-spin" /> Enviando...</> : <><Upload size={16} /> Importar Resumo Bancário</>}
          </button>
        </div>

        {activeJobUuid && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-600">Processamento em andamento</h3>
            <ImportProgressCard jobUuid={activeJobUuid} token={token} onDone={() => { refetchJobs(); setTimeout(() => setActiveJobUuid(null), 8000); }} />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-base font-semibold text-navy-800">Histórico de Importações — Resumo Bancário</h2>
            {jobsData?.total != null && <span className="text-xs text-gray-400 font-mono">{jobsData.total} importação(ões)</span>}
          </div>

          {!jobsData?.jobs?.length ? (
            <div className="p-12 text-center text-gray-400">
              <Landmark size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhuma importação realizada ainda.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {jobsData.jobs.map((job) => (
                <div key={job.uuid} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex-shrink-0">{statusIcon[job.status] ?? statusIcon.QUEUED}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{job.filename}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {job.rows_loaded > 0 && `${job.rows_loaded} contas carregadas`}
                      {job.valor_bruto_total > 0 && ` · saldo total ${formatCurrency(job.valor_bruto_total)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                      job.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' :
                      job.status === 'ERROR' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                    )}>{job.status}</span>
                    <button
                      onClick={() => handleDelete(job)}
                      disabled={deletingUuid === job.uuid}
                      className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-gray-300 transition-colors"
                    >
                      {deletingUuid === job.uuid ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showConfigModal && selectedFile && (
        <ConfigModal
          filename={selectedFile.name}
          token={token}
          onConfirm={handleConfirmUpload}
          onCancel={() => { setShowConfigModal(false); setSelectedFile(null); }}
        />
      )}
    </div>
  );
}
