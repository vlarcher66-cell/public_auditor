'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Upload, Clock, CheckCircle2, XCircle, RefreshCw, Trash2, X, FileText } from 'lucide-react';
import { SearchSelect } from '@/components/SearchSelect';
import TopBar from '@/components/dashboard/TopBar';
import FileDropzone from '@/components/import/FileDropzone';
import ImportProgressCard from '@/components/import/ImportProgressCard';
import { apiUpload, apiRequest } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ImportJob } from '@public-auditor/shared';

const statusIcon = {
  QUEUED: <Clock size={14} className="text-gray-400" />,
  EXTRACTING: <RefreshCw size={14} className="text-blue-400 animate-spin" />,
  TRANSFORMING: <RefreshCw size={14} className="text-amber-400 animate-spin" />,
  LOADING: <RefreshCw size={14} className="text-purple-400 animate-spin" />,
  DONE: <CheckCircle2 size={14} className="text-emerald-500" />,
  ERROR: <XCircle size={14} className="text-red-500" />,
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function TipoRelatorioModal({
  filename,
  token,
  onConfirm,
  onCancel,
}: {
  filename: string;
  token: string;
  onConfirm: (tipo: 'OR' | 'RP', entidadeId: number, sistemaOrigem: string) => void;
  onCancel: () => void;
}) {
  const [tipo, setTipo] = useState<'OR' | 'RP'>('OR');
  const [municipioId, setMunicipioId] = useState<string>('');
  const [entidadeId, setEntidadeId] = useState<string>('');

  const { data: municipios = [], isLoading: loadingMunicipios } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ['municipios-list'],
    queryFn: () => apiRequest('/municipios', { token, params: { limit: 200 } }).then((d: any) => d.rows ?? d),
    enabled: !!token,
  });

  const { data: entidades = [], isLoading: loadingEntidades } = useQuery<{ id: number; nome: string; sigla?: string; sistema_contabil?: string | null }[]>({
    queryKey: ['entidades-list', municipioId],
    queryFn: () => apiRequest('/entidades', { token, params: { limit: 200, ...(municipioId ? { municipioId } : {}) } }).then((d: any) => d.rows ?? d),
    enabled: !!token,
  });

  // Sistema herdado automaticamente da entidade selecionada
  const entidadeSelecionada = entidades.find(e => String(e.id) === entidadeId);
  const sistemaOrigem = entidadeSelecionada?.sistema_contabil ?? 'FATOR';

  const canConfirm = !!municipioId && !!entidadeId;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            Tipo de Relatório
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Selecione o tipo do relatório <span className="font-medium text-gray-700">&quot;{filename}&quot;</span>
          </p>

          {/* Município */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Município <span className="text-red-500">*</span>
            </label>
            {loadingMunicipios ? (
              <div className="w-full border rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50">Carregando...</div>
            ) : (
              <SearchSelect
                value={municipioId}
                onChange={(val) => { setMunicipioId(String(val)); setEntidadeId(''); }}
                options={municipios}
                placeholder="Selecione o município"
                required
              />
            )}
          </div>

          {/* Entidade */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Entidade <span className="text-red-500">*</span>
            </label>
            {loadingEntidades ? (
              <div className="w-full border rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50">Carregando...</div>
            ) : !municipioId ? (
              <div className="w-full border rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50 cursor-not-allowed">
                Selecione um município primeiro
              </div>
            ) : (
              <SearchSelect
                value={entidadeId}
                onChange={(val) => setEntidadeId(String(val))}
                options={entidades}
                placeholder="Selecione a entidade pagadora"
                required
              />
            )}
            <p className="text-xs text-gray-400 mt-1">Entidade responsável pelos pagamentos deste relatório.</p>
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

          {/* Tipo */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de Relatório</label>
            <label
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                tipo === 'OR' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
              )}
            >
              <input type="radio" name="tipo" value="OR" checked={tipo === 'OR'} onChange={() => setTipo('OR')} className="accent-blue-600" />
              <div>
                <p className="font-medium text-gray-800">OR — Orçamentário</p>
                <p className="text-xs text-gray-500">Relatório de pagamentos do orçamento vigente</p>
              </div>
            </label>
            <label
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                tipo === 'RP' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
              )}
            >
              <input type="radio" name="tipo" value="RP" checked={tipo === 'RP'} onChange={() => setTipo('RP')} className="accent-blue-600" />
              <div>
                <p className="font-medium text-gray-800">RP — Restos a Pagar</p>
                <p className="text-xs text-gray-500">Relatório de restos a pagar de exercícios anteriores</p>
              </div>
            </label>
          </div>
          <p className="text-xs text-gray-400">
            Pagamentos com elemento de despesa 3.3.90.92.00 serão automaticamente classificados como DEA (Despesa do Exercício Anterior).
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => canConfirm && onConfirm(tipo, parseInt(entidadeId), sistemaOrigem)}
            disabled={!canConfirm}
            className={cn(
              'px-4 py-2 text-sm rounded-lg text-white transition-colors',
              canConfirm ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed',
            )}
          >
            Confirmar e Importar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ImportacaoPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeJobUuid, setActiveJobUuid] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [deletingUuid, setDeletingUuid] = useState<string | null>(null);
  const [showTipoModal, setShowTipoModal] = useState(false);

  const { data: jobsData, refetch: refetchJobs } = useQuery({
    queryKey: ['import-jobs'],
    queryFn: async () => {
      try {
        return await apiRequest<{ jobs: ImportJob[]; total: number }>('/import/jobs', { token, params: { limit: 20, tipo: 'DESPESA' } });
      } catch { /* API offline */ }
    },
    enabled: !!token,
    refetchInterval: activeJobUuid ? 3000 : 30000,
  });

  const handleDelete = async (job: ImportJob) => {
    const label = job.filename.length > 40 ? job.filename.slice(0, 40) + '...' : job.filename;
    const rows = job.rows_loaded > 0 ? ` e ${job.rows_loaded} registro(s) do banco` : '';
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

  const handleUploadClick = () => {
    if (!selectedFile || !token) return;
    setShowTipoModal(true);
  };

  const handleConfirmUpload = async (tipoRelatorio: 'OR' | 'RP', entidadeId: number, sistemaOrigem: string) => {
    if (!selectedFile || !token) return;
    setShowTipoModal(false);
    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('tipo_relatorio', tipoRelatorio);
      formData.append('entidade_id', String(entidadeId));
      formData.append('sistema_origem', sistemaOrigem);

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
      <TopBar title="Importação de Dados" subtitle="Importe relatórios PDF ou Excel do SIAFIC" />
      <div className="p-4 md:p-8 space-y-8">

        {/* Upload area */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
          <h2 className="text-base font-semibold text-navy-800 flex items-center gap-2">
            <Upload size={18} className="text-navy-600" />
            Novo Relatório
          </h2>

          <FileDropzone onFileSelect={setSelectedFile} disabled={uploading} />

          {uploadError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {uploadError}
            </div>
          )}

          <button
            onClick={handleUploadClick}
            disabled={!selectedFile || uploading}
            className={cn(
              'w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200',
              'flex items-center justify-center gap-2',
              selectedFile && !uploading
                ? 'bg-navy-800 hover:bg-navy-700 shadow-md hover:shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            )}
          >
            {uploading ? (
              <><RefreshCw size={16} className="animate-spin" /> Enviando...</>
            ) : (
              <><Upload size={16} /> Importar Relatório</>
            )}
          </button>
        </div>

        {/* Active job progress */}
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

        {/* Job history */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="text-base font-semibold text-navy-800">Histórico de Importações</h2>
          </div>

          {!jobsData?.jobs?.length ? (
            <div className="p-12 text-center text-gray-400">
              <Upload size={36} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma importação realizada ainda.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {jobsData.jobs.map((job) => (
                <div key={job.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <span className="flex-shrink-0">{statusIcon[job.status] || statusIcon.QUEUED}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{job.filename}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(job.criado_em).toLocaleString('pt-BR')}
                      {job.rows_loaded > 0 && ` • ${job.rows_loaded} registros`}
                      {job.valor_bruto_total > 0 && (
                        <> • <span className="text-emerald-600 font-medium">{formatCurrency(job.valor_bruto_total)}</span></>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(job as any).sistema_origem && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {(job as any).sistema_origem}
                      </span>
                    )}
                    {(job as any).tipo_relatorio && (
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        (job as any).tipo_relatorio === 'RP'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-blue-50 text-blue-700',
                      )}>
                        {(job as any).tipo_relatorio}
                      </span>
                    )}
                    <span className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded-full',
                      job.status === 'DONE' ? 'bg-emerald-50 text-emerald-700' :
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

      {/* Modal tipo relatório */}
      {showTipoModal && selectedFile && (
        <TipoRelatorioModal
          filename={selectedFile.name}
          token={token}
          onConfirm={handleConfirmUpload}
          onCancel={() => setShowTipoModal(false)}
        />
      )}
    </div>
  );
}
