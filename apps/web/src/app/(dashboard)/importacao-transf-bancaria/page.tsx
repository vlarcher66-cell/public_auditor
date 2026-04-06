'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import {
  Upload, Clock, CheckCircle2, XCircle, RefreshCw,
  Trash2, X, ArrowLeftRight, Info, FileText,
} from 'lucide-react';
import { SearchSelect } from '@/components/SearchSelect';
import TopBar from '@/components/dashboard/TopBar';
import FileDropzone from '@/components/import/FileDropzone';
import ImportProgressCard from '@/components/import/ImportProgressCard';
import { apiUpload, apiRequest } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ImportJob } from '@public-auditor/shared';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
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
  'Janeiro/2026','Fevereiro/2026','Março/2026','Abril/2026',
  'Maio/2026','Junho/2026','Julho/2026','Agosto/2026',
  'Setembro/2026','Outubro/2026','Novembro/2026','Dezembro/2026',
  'Janeiro/2025','Fevereiro/2025','Março/2025','Abril/2025',
  'Maio/2025','Junho/2025','Julho/2025','Agosto/2025',
  'Setembro/2025','Outubro/2025','Novembro/2025','Dezembro/2025',
];

// ─── Modal de configuração ────────────────────────────────────────────────────

function ConfigModal({
  filename, token, onConfirm, onCancel,
}: {
  filename: string;
  token: string;
  onConfirm: (entidadeId: number, periodo: string) => void;
  onCancel: () => void;
}) {
  const [municipioId, setMunicipioId] = useState('');
  const [entidadeId, setEntidadeId]   = useState('');
  const [periodo, setPeriodo]         = useState('Janeiro/2026');

  const { data: municipios = [], isLoading: loadingMun } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ['municipios-list'],
    queryFn: () => apiRequest('/municipios', { token, params: { limit: 200 } }).then((d: any) => d.rows ?? d),
    enabled: !!token,
  });

  const { data: entidades = [], isLoading: loadingEnt } = useQuery<{ id: number; nome: string; sistema_contabil?: string | null }[]>({
    queryKey: ['entidades-list', municipioId],
    queryFn: () => apiRequest('/entidades', { token, params: { limit: 200, ...(municipioId ? { municipioId } : {}) } }).then((d: any) => d.rows ?? d),
    enabled: !!token,
  });

  const entidadeSelecionada = entidades.find(e => String(e.id) === entidadeId);

  const canConfirm = !!municipioId && !!entidadeId && !!periodo;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500/15 rounded-xl flex items-center justify-center">
              <ArrowLeftRight size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#0F2A4E]">Configurar Importação</h3>
              <p className="text-xs text-gray-400 truncate max-w-[220px]">{filename}</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Info */}
          <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-3">
            <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Importe a <strong>Listagem de Transferência Bancária / Transferência Financeira</strong> exportada
              pelo sistema <strong>FATOR</strong> em PDF. O sistema extrai automaticamente data, contas,
              fontes de recurso, documento e valor.
            </p>
          </div>

          {/* Município */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Município <span className="text-red-400">*</span>
            </label>
            {loadingMun ? (
              <div className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-400 bg-gray-50">Carregando...</div>
            ) : (
              <SearchSelect
                value={municipioId}
                onChange={val => { setMunicipioId(String(val)); setEntidadeId(''); }}
                options={municipios}
                placeholder="Selecione o município"
                required
              />
            )}
          </div>

          {/* Entidade */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Entidade (Fundo) <span className="text-red-400">*</span>
            </label>
            {!municipioId ? (
              <div className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-300 bg-gray-50 cursor-not-allowed">
                Selecione um município primeiro
              </div>
            ) : loadingEnt ? (
              <div className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-400 bg-gray-50">Carregando...</div>
            ) : (
              <SearchSelect
                value={entidadeId}
                onChange={val => setEntidadeId(String(val))}
                options={entidades}
                placeholder="Selecione a entidade"
                required
              />
            )}
            <p className="text-xs text-gray-400 mt-1">Ex: Fundo Municipal de Saúde.</p>
          </div>

          {/* Período */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Período de Referência <span className="text-red-400">*</span>
            </label>
            <select
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PERIODOS.map(p => <option key={p}>{p}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Mês/ano de competência da listagem.</p>
          </div>

          {/* Sistema herdado da entidade */}
          {entidadeSelecionada && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100">
              <span className="text-xs text-indigo-500 font-medium">Sistema contábil:</span>
              <span className="text-xs font-bold text-indigo-700">
                {entidadeSelecionada.sistema_contabil ?? 'Não definido'}
              </span>
              {!entidadeSelecionada.sistema_contabil && (
                <span className="text-xs text-amber-600 ml-1">— configure em Cadastros → Entidades</span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => canConfirm && onConfirm(parseInt(entidadeId), periodo)}
            disabled={!canConfirm}
            className={cn(
              'px-4 py-2 text-sm rounded-xl text-white font-semibold transition-colors',
              canConfirm
                ? 'bg-[#0F2A4E] hover:bg-[#183E7A]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            )}
          >
            Confirmar e Importar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ImportacaoTransfBancariaPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string;

  const [selectedFile, setSelectedFile]       = useState<File | null>(null);
  const [uploading, setUploading]             = useState(false);
  const [activeJobUuid, setActiveJobUuid]     = useState<string | null>(null);
  const [uploadError, setUploadError]         = useState('');
  const [deletingUuid, setDeletingUuid]       = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const { data: jobsData, refetch: refetchJobs } = useQuery({
    queryKey: ['import-transf-bancaria-jobs'],
    queryFn: async () => {
      try {
        return await apiRequest<{ jobs: ImportJob[]; total: number }>(
          '/import/jobs',
          { token, params: { limit: 20, tipo: 'TRANSF_BANCARIA' } },
        );
      } catch { /* API offline */ }
    },
    enabled: !!token,
    refetchInterval: activeJobUuid ? 3000 : 30000,
  });

  const handleDelete = async (job: ImportJob) => {
    const label = job.filename.length > 40 ? job.filename.slice(0, 40) + '...' : job.filename;
    const rows  = job.rows_loaded > 0 ? ` e ${job.rows_loaded} registro(s) do banco` : '';
    if (!confirm(`Excluir "${label}"${rows}?\n\nEsta ação não pode ser desfeita.`)) return;

    setDeletingUuid(job.uuid);
    try {
      await apiRequest(`/import/jobs/${job.uuid}`, { method: 'DELETE', token });
      refetchJobs();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir importação');
    } finally {
      setDeletingUuid(null);
    }
  };

  const handleConfirmUpload = async (entidadeId: number, periodo: string) => {
    if (!selectedFile || !token) return;
    setShowConfigModal(false);
    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('tipo_relatorio', 'TRANSF_BANCARIA');
      formData.append('entidade_id', String(entidadeId));
      formData.append('periodo', periodo);
      formData.append('sistema_origem', 'FATOR');

      const result = await apiUpload('/import/upload', formData, token) as any;
      setActiveJobUuid(result.uuid);
      setSelectedFile(null);
      refetchJobs();
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao enviar arquivo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <TopBar
        title="Importação — Transferência Bancária"
        subtitle="Importe a Listagem de Transferência Bancária / Financeira do sistema FATOR"
      />

      <div className="p-4 md:p-8 space-y-8">

        {/* ── Upload area ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
          <h2 className="text-base font-semibold text-navy-800 flex items-center gap-2">
            <ArrowLeftRight size={18} className="text-blue-500" />
            Nova Listagem de Transferência Bancária
          </h2>

          {/* Instrução */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <FileText size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-800 space-y-0.5">
              <p className="font-semibold">Formato esperado: Listagem Transferência Bancária / Financeira (FATOR)</p>
              <p className="text-blue-700">
                Exporte o relatório em PDF pelo sistema FATOR e faça o upload abaixo.
                O sistema extrai automaticamente data, conta origem/destino, fonte de recurso, nº documento e valor.
              </p>
            </div>
          </div>

          <FileDropzone onFileSelect={setSelectedFile} disabled={uploading} />

          {uploadError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {uploadError}
            </div>
          )}

          <button
            onClick={() => selectedFile && !uploading && setShowConfigModal(true)}
            disabled={!selectedFile || uploading}
            className={cn(
              'w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200',
              'flex items-center justify-center gap-2',
              selectedFile && !uploading
                ? 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            )}
          >
            {uploading ? (
              <><RefreshCw size={16} className="animate-spin" /> Enviando...</>
            ) : (
              <><Upload size={16} /> Importar Transferência Bancária</>
            )}
          </button>
        </div>

        {/* ── Progresso do job ativo ────────────────────────────────────────── */}
        {activeJobUuid && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-600">Processamento em andamento</h3>
            <ImportProgressCard
              jobUuid={activeJobUuid}
              token={token}
              onDone={() => {
                refetchJobs();
                setTimeout(() => setActiveJobUuid(null), 8000);
              }}
            />
          </div>
        )}

        {/* ── Histórico de importações ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-base font-semibold text-navy-800">
              Histórico de Importações — Transferência Bancária
            </h2>
            {jobsData?.total != null && (
              <span className="text-xs text-gray-400 font-mono">{jobsData.total} importação(ões)</span>
            )}
          </div>

          {!jobsData?.jobs?.length ? (
            <div className="p-12 text-center text-gray-400">
              <ArrowLeftRight size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhuma importação de transferência bancária realizada ainda.</p>
              <p className="text-xs mt-1 text-gray-300">
                Faça o upload da Listagem de Transferência Bancária exportada pelo FATOR.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {jobsData.jobs.map((job) => (
                <div
                  key={job.id}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors"
                >
                  <span className="flex-shrink-0">
                    {statusIcon[job.status] ?? statusIcon.QUEUED}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{job.filename}</p>
                    <p className="text-xs text-gray-400">
                      {new Date((job as any).criado_em).toLocaleString('pt-BR')}
                      {job.rows_loaded > 0 && ` · ${job.rows_loaded} registros`}
                      {(job as any).periodo && (
                        <> · <span className="text-blue-600 font-medium">{(job as any).periodo}</span></>
                      )}
                      {job.valor_bruto_total > 0 && (
                        <> · <span className="text-emerald-600 font-medium">{formatCurrency(job.valor_bruto_total)}</span></>
                      )}
                    </p>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      FATOR
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      TRANSF. BANCÁRIA
                    </span>
                    <span className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded-full',
                      job.status === 'DONE'  ? 'bg-emerald-50 text-emerald-700' :
                      job.status === 'ERROR' ? 'bg-red-50 text-red-700' :
                      'bg-gray-100 text-gray-500',
                    )}>
                      {job.file_type}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDelete(job)}
                    disabled={deletingUuid === job.uuid}
                    title="Excluir importação e registros do banco"
                    className="ml-1 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    {deletingUuid === job.uuid
                      ? <RefreshCw size={14} className="animate-spin" />
                      : <Trash2 size={14} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showConfigModal && selectedFile && (
        <ConfigModal
          filename={selectedFile.name}
          token={token}
          onConfirm={handleConfirmUpload}
          onCancel={() => setShowConfigModal(false)}
        />
      )}
    </div>
  );
}
