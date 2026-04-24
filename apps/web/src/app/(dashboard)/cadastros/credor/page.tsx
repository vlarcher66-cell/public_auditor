'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Users, Search, ExternalLink, Check, Loader2, FileText, X, AlertTriangle, Trash2, Layers, CheckCircle, ChevronLeft, ChevronRight, AlertCircle, Lock, Unlock } from 'lucide-react';
import Link from 'next/link';
import { SearchSelect } from '@/components/SearchSelect';

type Aba = 'classificados' | 'pendentes' | 'por_pagamento';

const API = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface Grupo {
  id: number;
  nome: string;
}

interface Subgrupo {
  id: number;
  nome: string;
  fk_grupo: number;
}

interface Credor {
  id: number;
  nome: string;
  cnpj_cpf: string;
  tipo_doc: string;
  fk_grupo: number | null;
  grupo_nome: string | null;
  fk_subgrupo: number | null;
  subgrupo_nome: string | null;
  historico: string | null;
  precisa_reclassificacao: boolean;
  detalhar_no_pagamento: boolean;
  origem: 'PAGO' | 'A_PAGAR' | null;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ─── Modal de Histórico ───────────────────────────────────────────────────────

function HistoricoModal({
  credor,
  grupos,
  subgrupos,
  token,
  onClose,
  onSaved,
}: {
  credor: Credor;
  grupos: Grupo[];
  subgrupos: Subgrupo[];
  token: string;
  onClose: () => void;
  onSaved: (novoHistorico: string, grupoId: number | null, subgrupoId: number | null, grupoNome: string | null, subgrupoNome: string | null) => void;
}) {
  const [texto, setTexto] = useState(credor.historico ?? '');
  const [grupoId, setGrupoId] = useState<string>(credor.fk_grupo ? String(credor.fk_grupo) : '');
  const [subgrupoId, setSubgrupoId] = useState<string>(credor.fk_subgrupo ? String(credor.fk_subgrupo) : '');
  const [saving, setSaving] = useState(false);
  const [classificacao, setClassificacao] = useState<{
    elemento: string; fonte: string; tipo_empenho: string; entidade: string;
    ano: number; qtd: number; total: number; ultimo_pagamento: string;
  }[]>([]);
  const [loadingClass, setLoadingClass] = useState(false);

  useEffect(() => {
    async function fetchClass() {
      setLoadingClass(true);
      try {
        const res = await fetch(`${API}/credores/${credor.id}/classificacao`, { headers: authHeader(token) });
        if (res.ok) setClassificacao(await res.json());
      } catch { /* offline */ }
      setLoadingClass(false);
    }
    fetchClass();
  }, [credor.id, token]);

  const subgruposFiltrados = subgrupos.filter(s => String(s.fk_grupo) === grupoId);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`${API}/credores/${credor.id}`, {
        method: 'PUT',
        headers: authHeader(token),
        body: JSON.stringify({
          fk_grupo: grupoId ? Number(grupoId) : null,
          fk_subgrupo: subgrupoId ? Number(subgrupoId) : null,
          historico: texto.trim() || null,
        }),
      });
      const gNome = grupos.find(g => String(g.id) === grupoId)?.nome ?? null;
      const sNome = subgruposFiltrados.find(s => String(s.id) === subgrupoId)?.nome ?? null;
      onSaved(texto.trim(), grupoId ? Number(grupoId) : null, subgrupoId ? Number(subgrupoId) : null, gNome, sNome);
      onClose();
    } catch { /* API offline */ }
    setSaving(false);
  }

  const charCount = texto.length;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-xl overflow-hidden">

        {/* Header com gradiente */}
        <div style={{ background: 'linear-gradient(135deg, #0F2A4E 0%, #1a3a6b 60%, #0F2A4E 100%)' }} className="px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.4)' }}>
                <FileText size={18} color="#C9A84C" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base leading-tight">{credor.nome}</h2>
                <p className="text-xs mt-0.5" style={{ color: '#93c5fd' }}>Histórico / Anotações do Credor</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors mt-0.5"><X size={18} /></button>
          </div>

          {/* Chips de info */}
          <div className="flex flex-wrap gap-2 mt-4">
            {credor.cnpj_cpf && (
              <span className="text-xs px-2.5 py-1 rounded-full font-mono" style={{ background: 'rgba(255,255,255,0.1)', color: '#e2e8f0' }}>
                {credor.tipo_doc === 'CPF' ? 'CPF' : 'CNPJ'}: {credor.cnpj_cpf}
              </span>
            )}
            {credor.grupo_nome ? (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(30,77,149,0.4)', color: '#93c5fd' }}>
                {credor.grupo_nome}
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(234,88,12,0.3)', color: '#fdba74' }}>
                Sem grupo
              </span>
            )}
            {credor.subgrupo_nome && (
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(201,168,76,0.2)', color: '#fde68a' }}>
                {credor.subgrupo_nome}
              </span>
            )}
            {credor.precisa_reclassificacao && (
              <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: 'rgba(234,88,12,0.3)', color: '#fdba74' }}>
                <AlertTriangle size={10} /> Reclassificação pendente
              </span>
            )}
          </div>
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-4">

          {/* Classificação */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Classificação</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Grupo</label>
                <select
                  value={grupoId}
                  onChange={e => { setGrupoId(e.target.value); setSubgrupoId(''); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white text-gray-700"
                  style={{ '--tw-ring-color': '#1e4d95' } as React.CSSProperties}
                >
                  <option value="">— Sem grupo —</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Subgrupo</label>
                <select
                  value={subgrupoId}
                  onChange={e => setSubgrupoId(e.target.value)}
                  disabled={!grupoId || subgruposFiltrados.length === 0}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white text-gray-700 disabled:bg-gray-50 disabled:text-gray-400"
                  style={{ '--tw-ring-color': '#1e4d95' } as React.CSSProperties}
                >
                  <option value="">— Sem subgrupo —</option>
                  {subgruposFiltrados.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-100" />

          <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Anotações &amp; Observações
          </label>
          <textarea
            autoFocus
            rows={7}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none leading-relaxed text-gray-700"
            style={{ '--tw-ring-color': '#1e4d95' } as React.CSSProperties}
            placeholder="Ex: Fornecedor habitual de medicamentos. Contrato vigente até 12/2025. Pagamentos sempre no 5º dia útil..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-gray-400">Este campo é usado na classificação automática por histórico.</p>
            <span className={`text-xs font-mono ${charCount > 400 ? 'text-orange-500' : 'text-gray-400'}`}>{charCount} car.</span>
          </div>
          </div>

        </div>

        {/* Classificação Contábil */}
        <div className="px-6 pb-4">
          <div className="border-t border-dashed border-gray-100 mb-4" />
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Classificação Contábil</label>
            {loadingClass && <Loader2 size={12} className="animate-spin text-gray-400" />}
          </div>
          {!loadingClass && classificacao.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Nenhum pagamento encontrado para este credor.</p>
          ) : (
            <div style={{ maxHeight: '200px', overflowY: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: '#0F2A4E' }}>
                    {['Ano','Elemento','Fonte','Tipo','Entidade','Qtd','Total'].map(h => (
                      <th key={h} style={{ padding: '7px 8px', color: '#e2e8f0', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: h === 'Total' ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classificacao.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbff' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0F2A4E', whiteSpace: 'nowrap' }}>{r.ano}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#1e4d95', whiteSpace: 'nowrap' }}>{r.elemento}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#64748b', whiteSpace: 'nowrap' }}>{r.fonte}</td>
                      <td style={{ padding: '6px 8px', color: '#475569', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.tipo_empenho}>{r.tipo_empenho}</td>
                      <td style={{ padding: '6px 8px', color: '#475569', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.entidade}>{r.entidade}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b' }}>{r.qtd}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {Number(r.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Check size={11} className="text-green-500" /> Salvo automaticamente no próximo login
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 font-medium transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm rounded-lg text-white font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
              style={{ background: saving ? '#94a3b8' : '#0F2A4E' }}
            >
              {saving ? <><Loader2 size={13} className="animate-spin" /> Salvando...</> : <><Check size={13} /> Salvar</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Modal Confirmação Limpar Credores ────────────────────────────────────────

function LimparCredoresModal({
  token,
  onClose,
  onDone,
}: {
  token: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const CONFIRM_WORD = 'LIMPAR';

  async function handleDelete() {
    if (confirmText !== CONFIRM_WORD) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`${API}/credores`, {
        method: 'DELETE',
        headers: authHeader(token),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Erro ao excluir');
        setDeleting(false);
        return;
      }
      onDone();
      onClose();
    } catch {
      setError('API indisponível');
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <Trash2 size={18} className="text-red-600" />
            </div>
            <h2 className="font-semibold text-gray-800">Limpar todos os credores</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-1">
            <p className="font-semibold">⚠️ Atenção: esta ação é irreversível!</p>
            <p>Todos os credores serão permanentemente excluídos. Os pagamentos importados serão mantidos.</p>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Digite <span className="font-bold text-red-600">{CONFIRM_WORD}</span> para confirmar:
            </label>
            <input
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 font-mono tracking-widest"
              placeholder={CONFIRM_WORD}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancelar</button>
          <button
            onClick={handleDelete}
            disabled={confirmText !== CONFIRM_WORD || deleting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 size={14} />
            {deleting ? 'Excluindo...' : 'Limpar tudo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Converter para Classificação Padrão ────────────────────────────────

function ConverterParaPadraoModal({
  credor,
  token,
  onClose,
  onConverted,
}: {
  credor: Credor;
  token: string;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [converting, setConverting] = useState(false);

  async function handleConverter() {
    setConverting(true);
    try {
      await fetch(`${API}/credores/${credor.id}`, {
        method: 'PUT',
        headers: authHeader(token),
        body: JSON.stringify({ detalhar_no_pagamento: false }),
      });
      onConverted();
      onClose();
    } catch { /* API offline */ }
    setConverting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Unlock size={18} className="text-indigo-600" />
            </div>
            <h2 className="font-semibold text-gray-800">Converter para classificação padrão</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">
            O credor <span className="font-semibold">{credor.nome}</span> está configurado para classificação individual por pagamento.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 space-y-1">
            <p className="font-semibold">Ao converter para classificação padrão:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs mt-1">
              <li>O credor passará a ter um único Grupo e Subgrupo fixos</li>
              <li>A classificação individual por pagamento será desativada</li>
              <li>Você precisará definir o Grupo e Subgrupo manualmente</li>
            </ul>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancelar</button>
          <button
            onClick={handleConverter}
            disabled={converting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white font-semibold transition-colors disabled:opacity-60"
            style={{ background: converting ? '#94a3b8' : '#4f46e5' }}
          >
            {converting ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
            {converting ? 'Convertendo...' : 'Converter para padrão'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Linha com dropdowns inline ───────────────────────────────────────────────

function CredorRow({
  credor,
  grupos,
  subgrupos,
  token,
  aba,
  onSaved,
  onOpenHistorico,
  onRequestConvert,
}: {
  credor: Credor;
  grupos: Grupo[];
  subgrupos: Subgrupo[];
  token: string;
  aba: Aba;
  onSaved: () => void;
  onOpenHistorico: (c: Credor) => void;
  onRequestConvert?: (c: Credor) => void;
}) {
  const [fkGrupo, setFkGrupo] = useState<number | ''>(credor.fk_grupo ?? '');
  const [fkSubgrupo, setFkSubgrupo] = useState<number | ''>(credor.fk_subgrupo ?? '');
  const [detalhar, setDetalhar] = useState(!!credor.detalhar_no_pagamento);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const bloqueado = aba === 'por_pagamento';
  const subgruposFiltrados = subgrupos.filter((s) => s.fk_grupo === Number(fkGrupo));

  async function save(grupoVal: number | '', subgrupoVal: number | '', detalharVal?: boolean) {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`${API}/credores/${credor.id}`, {
        method: 'PUT',
        headers: authHeader(token),
        body: JSON.stringify({
          fk_grupo: grupoVal || null,
          fk_subgrupo: subgrupoVal || null,
          ...(detalharVal !== undefined && { detalhar_no_pagamento: detalharVal }),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onSaved();
    } catch { /* API offline */ }
    setSaving(false);
  }

  function handleGrupoChange(val: number | '') {
    setFkGrupo(val);
    setFkSubgrupo('');
    save(val, '');
  }

  function handleSubgrupoChange(val: number | '') {
    setFkSubgrupo(val);
    save(fkGrupo, val);
  }

  function handleDetalharToggle() {
    const next = !detalhar;
    setDetalhar(next);
    save(fkGrupo, fkSubgrupo, next);
  }

  return (
    <tr className={`border-b transition-colors ${!!credor.precisa_reclassificacao ? 'bg-orange-50 hover:bg-orange-100' : bloqueado ? 'bg-indigo-50/40 hover:bg-indigo-50' : 'hover:bg-gray-50'}`}>
      <td className="px-3 py-2 font-medium text-gray-900 max-w-[220px]">
        <div className="truncate" title={credor.nome}>{credor.nome}</div>
        {!!credor.precisa_reclassificacao && (
          <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-orange-200 text-orange-800">
            <AlertTriangle size={10} /> Nova classif. necessária
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        {bloqueado ? (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 border border-dashed border-gray-300 text-xs text-gray-400 select-none">
            <Lock size={11} className="text-indigo-400 shrink-0" />
            <span className="truncate">{credor.grupo_nome ?? 'bloqueado'}</span>
          </div>
        ) : (
          <SearchSelect
            value={fkGrupo}
            onChange={(val) => handleGrupoChange(val === '' ? '' : Number(val))}
            options={grupos}
            placeholder="sem grupo"
          />
        )}
      </td>
      <td className="px-3 py-2">
        {bloqueado ? (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 border border-dashed border-gray-300 text-xs text-gray-400 select-none">
            <Lock size={11} className="text-indigo-400 shrink-0" />
            <span className="truncate">{credor.subgrupo_nome ?? 'bloqueado'}</span>
          </div>
        ) : (
          <SearchSelect
            value={fkSubgrupo}
            onChange={(val) => handleSubgrupoChange(val === '' ? '' : Number(val))}
            options={subgruposFiltrados}
            placeholder="sem subgrupo"
            disabled={!fkGrupo || subgruposFiltrados.length === 0}
          />
        )}
      </td>
      {/* Histórico preview */}
      <td className="px-3 py-2 max-w-[220px]">
        <button
          onClick={() => onOpenHistorico(credor)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors group w-full text-left"
          title={credor.historico ?? 'Adicionar histórico'}
        >
          <FileText size={13} className={credor.historico ? 'text-blue-500' : 'text-gray-300 group-hover:text-blue-400'} />
          <span className="truncate">
            {credor.historico
              ? <span className="text-gray-600">{credor.historico}</span>
              : <span className="text-gray-300 italic">adicionar...</span>
            }
          </span>
        </button>
      </td>
      {/* Origem */}
      <td className="px-3 py-2">
        {credor.origem === 'PAGO' && (
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">Pago</span>
        )}
        {credor.origem === 'A_PAGAR' && (
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">A Pagar</span>
        )}
        {!credor.origem && (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>
      {/* Toggle / botão converter */}
      <td className="px-3 py-2 text-center">
        {bloqueado ? (
          <button
            onClick={() => onRequestConvert?.(credor)}
            title="Converter para classificação padrão"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
          >
            <Unlock size={12} />
            Converter
          </button>
        ) : (
          <button
            onClick={handleDetalharToggle}
            title={detalhar ? 'Classificando por pagamento — clique para desativar' : 'Ativar classificação por pagamento'}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              detalhar
                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            <Layers size={12} />
            {detalhar ? 'Por pag.' : 'Padrão'}
          </button>
        )}
      </td>
      <td className="px-3 py-2 text-center w-8">
        {saving && <Loader2 size={14} className="animate-spin text-blue-400 mx-auto" />}
        {saved && !saving && <Check size={14} className="text-emerald-500 mx-auto" />}
      </td>
    </tr>
  );
}

// ─── Modal Confirmação Diárias ─────────────────────────────────────────────────

interface SugestaoClassificacao {
  fk_grupo: number | null;
  fk_subgrupo: number | null;
  grupo_nome: string | null;
  subgrupo_nome: string | null;
  confianca: 'alta' | 'media' | 'baixa' | 'nenhuma';
  motivo: string;
  palavrasEncontradas: string[];
}

interface CredorParaConfirmar {
  id: number;
  nome: string;
  historico: string | null;
  fk_grupo: number;
  grupo_nome: string;
  sugestao: SugestaoClassificacao;
  subgrupoSelecionado?: number | '';
}

function ConfDiariasModal({
  token, subgrupos, onClose, onSaved, tipo = 'diarias',
}: {
  token: string;
  subgrupos: Subgrupo[];
  onClose: () => void;
  onSaved: () => void;
  tipo?: 'diarias' | 'pessoal';
}) {
  const [credores, setCredores] = useState<CredorParaConfirmar[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [historicoExpandido, setHistoricoExpandido] = useState<number | null>(null);
  const LIMIT = 10;

  useEffect(() => { carregar(); }, [page]);

  const endpoint = tipo === 'pessoal' ? 'confirmar-pessoal' : 'confirmar-diarias';
  const confirmarEndpoint = tipo === 'pessoal' ? 'confirmar-classificacao-pessoal' : 'confirmar-classificacao-diaria';
  const titulo = tipo === 'pessoal' ? 'Confirmação de Pessoal' : 'Confirmação de Diárias';

  async function carregar() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/credores/${endpoint}/listar?page=${page}&limit=${LIMIT}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCredores((data.rows || []).map((c: CredorParaConfirmar) => ({
          ...c,
          subgrupoSelecionado: c.sugestao?.fk_subgrupo ?? '',
        })));
        setTotal(data.total || 0);
      }
    } catch { /* offline */ }
    setLoading(false);
  }

  async function confirmar(credorId: number, fk_subgrupo: number | '') {
    if (!fk_subgrupo) return;
    setConfirmando(credorId);
    try {
      const res = await fetch(`${API}/credores/${credorId}/${confirmarEndpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fk_subgrupo }),
      });
      if (res.ok) {
        setCredores((prev) => prev.filter((c) => c.id !== credorId));
        setTotal((prev) => prev - 1);
        onSaved();
      }
    } catch { /* offline */ }
    setConfirmando(null);
  }

  function confiancaBadge(c: string) {
    if (c === 'alta')  return { emoji: '🟢', label: 'Alta confiança' };
    if (c === 'media') return { emoji: '🟡', label: 'Média confiança' };
    if (c === 'baixa') return { emoji: '🔴', label: 'Baixa confiança' };
    return { emoji: '⚫', label: 'Não identificado' };
  }

  const totalPaginas = Math.ceil(total / LIMIT);
  const subgruposDiarias = subgrupos.filter(s => {
    return credores.length > 0 && s.fk_grupo === credores[0]?.fk_grupo;
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
              <CheckCircle size={18} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{titulo}</h2>
              <p className="text-xs text-gray-500">{total} credores aguardando classificação de subgrupo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={24} className="animate-spin mr-2" /> Carregando sugestões...
            </div>
          ) : credores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Check size={40} className="text-green-500 mb-3" />
              <p className="text-lg font-semibold text-gray-700">Tudo classificado!</p>
              <p className="text-sm text-gray-500">Todos os credores de diárias já têm subgrupo definido.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {credores.map((credor) => {
                const subgruposDoGrupo = subgrupos.filter(s => s.fk_grupo === credor.fk_grupo);
                return (
                  <div key={credor.id} className="border rounded-xl p-4 bg-gray-50 hover:bg-white transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Nome + confiança */}
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900 truncate">{credor.nome}</p>
                          {(() => {
                            const badge = confiancaBadge(credor.sugestao?.confianca ?? 'nenhuma');
                            return (
                              <span className="flex items-center gap-1 text-xs text-gray-500" title={badge.label}>
                                <span className="text-base">{badge.emoji}</span>
                                <span>{badge.label}</span>
                              </span>
                            );
                          })()}
                        </div>
                        {/* Histórico */}
                        {credor.historico && (
                          <div className="mb-2">
                            <p className={`text-xs text-gray-500 italic ${historicoExpandido === credor.id ? '' : 'line-clamp-2'}`}>
                              {credor.historico}
                            </p>
                            {credor.historico.length > 120 && (
                              <button
                                onClick={() => setHistoricoExpandido(historicoExpandido === credor.id ? null : credor.id)}
                                className="text-[10px] text-blue-500 hover:underline mt-0.5"
                              >
                                {historicoExpandido === credor.id ? 'ver menos' : 'ver completo'}
                              </button>
                            )}
                          </div>
                        )}
                        {/* Palavras encontradas */}
                        {(credor.sugestao?.palavrasEncontradas?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {credor.sugestao.palavrasEncontradas.map((p) => (
                              <span key={p} className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">{p}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Seleção + Confirmar */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-56">
                          <SearchSelect
                            value={credor.subgrupoSelecionado ?? ''}
                            onChange={(v) => setCredores(prev => prev.map(c =>
                              c.id === credor.id ? { ...c, subgrupoSelecionado: v as number | '' } : c
                            ))}
                            options={subgruposDoGrupo.map(s => ({ id: s.id, nome: s.nome }))}
                            placeholder="— escolha subgrupo —"
                          />
                        </div>
                        <button
                          onClick={() => confirmar(credor.id, credor.subgrupoSelecionado ?? '')}
                          disabled={!credor.subgrupoSelecionado || confirmando === credor.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors font-medium whitespace-nowrap"
                        >
                          {confirmando === credor.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Check size={14} />}
                          Confirmar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50 rounded-b-2xl">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm text-gray-600 hover:bg-white disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <span className="text-sm text-gray-500">Página {page} de {totalPaginas}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPaginas, p + 1))}
              disabled={page === totalPaginas}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm text-gray-600 hover:bg-white disabled:opacity-40"
            >
              Próxima <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CredorPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken ?? '';

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [subgrupos, setSubgrupos] = useState<Subgrupo[]>([]);
  const [credores, setCredores] = useState<Credor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterGrupo, setFilterGrupo] = useState('');
  const [filterOrigem, setFilterOrigem] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, semGrupo: 0, semSubgrupo: 0, aPagar: 0, porPagamento: 0 });
  const [cardFilter, setCardFilter] = useState<'semGrupo' | 'semSubgrupo' | 'aPagar' | null>(null);
  const [historicoModal, setHistoricoModal] = useState<Credor | null>(null);
  const [showLimparModal, setShowLimparModal] = useState(false);
  const [convertModal, setConvertModal] = useState<Credor | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<Aba>('classificados');
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showConfDiarias, setShowConfDiarias] = useState(false);
  const [showConfPessoal, setShowConfPessoal] = useState(false);

  useEffect(() => {
    const conf = searchParams.get('conf');
    if (conf === 'diarias') {
      setShowConfDiarias(true);
      router.replace('/cadastros/credor', { scroll: false });
    } else if (conf === 'pessoal') {
      setShowConfPessoal(true);
      router.replace('/cadastros/credor', { scroll: false });
    }
  }, [searchParams]);

  const LIMIT = 50;

  const loadGrupos = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/credores/grupos`, { headers: authHeader(token) });
      if (res.ok) setGrupos(await res.json());
    } catch { /* API offline */ }
  }, [token]);

  const loadSubgrupos = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/credores/subgrupos`, { headers: authHeader(token) });
      if (res.ok) setSubgrupos(await res.json());
    } catch { /* API offline */ }
  }, [token]);

  const loadCredores = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set('search', search);
      if (filterGrupo) params.set('grupoId', filterGrupo);

      if (abaAtiva === 'por_pagamento') {
        params.set('detalharNoPagamento', '1');
      } else if (abaAtiva === 'pendentes') {
        params.set('semGrupo', '1');
      } else {
        // classificados: tem grupo, não é por pagamento
        params.set('comGrupo', '1');
        if (cardFilter === 'semSubgrupo') params.set('semSubgrupo', '1');
        if (cardFilter === 'aPagar')      params.set('origem', 'A_PAGAR');
        else if (filterOrigem)            params.set('origem', filterOrigem);
      }

      const res = await fetch(`${API}/credores?${params}`, { headers: authHeader(token) });
      if (res.ok) {
        const data = await res.json();
        setCredores(data.rows);
        setTotal(data.total);
      }
    } catch { /* API offline */ }
    setLoading(false);
  }, [token, page, search, filterGrupo, filterOrigem, cardFilter, abaAtiva]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/credores/stats`, { headers: authHeader(token) });
      if (res.ok) setStats(await res.json());
    } catch { /* API offline */ }
  }, [token]);

  useEffect(() => { loadGrupos(); loadSubgrupos(); loadStats(); }, [loadGrupos, loadSubgrupos, loadStats]);
  useEffect(() => { loadCredores(); }, [loadCredores]);
  useEffect(() => { setPage(1); setCardFilter(null); }, [abaAtiva]);

  const totalPages = Math.ceil(total / LIMIT);

  const abas: { id: Aba; label: string; count: number; cor: string; descricao: string }[] = [
    {
      id: 'classificados',
      label: 'Classificados',
      count: stats.total - stats.semGrupo - stats.porPagamento,
      cor: '#059669',
      descricao: 'Com grupo e subgrupo definidos',
    },
    {
      id: 'pendentes',
      label: 'Pendentes',
      count: stats.semGrupo,
      cor: '#ea580c',
      descricao: 'Aguardando classificação',
    },
    {
      id: 'por_pagamento',
      label: 'Por Pagamento',
      count: stats.porPagamento,
      cor: '#4f46e5',
      descricao: 'Classificação individual por pagamento',
    },
  ];


  function handleHistoricoSaved(credorId: number, novoHistorico: string, grupoId: number | null, subgrupoId: number | null, grupoNome: string | null, subgrupoNome: string | null) {
    const saeDaLista =
      (cardFilter === 'semGrupo' && grupoId !== null) ||
      (cardFilter === 'semSubgrupo' && subgrupoId !== null);

    if (saeDaLista) {
      setCredores(prev => prev.filter(c => c.id !== credorId));
    } else {
      setCredores(prev => prev.map(c => c.id === credorId ? {
        ...c,
        historico: novoHistorico || null,
        fk_grupo: grupoId,
        grupo_nome: grupoNome,
        fk_subgrupo: subgrupoId,
        subgrupo_nome: subgrupoNome,
      } : c));
    }
    loadStats();
  }

  return (
    <div className="p-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Users size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Credores</h1>
            <p className="text-sm text-gray-500">Cadastrados automaticamente na importação</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/cadastros/grupo" className="flex items-center gap-1.5 px-3 py-2 text-xs border rounded-xl hover:bg-gray-50 text-gray-600">
            <ExternalLink size={13} /> Cad. Despesa
          </Link>
          <Link href="/cadastros/subgrupo" className="flex items-center gap-1.5 px-3 py-2 text-xs border rounded-xl hover:bg-gray-50 text-gray-600">
            <ExternalLink size={13} /> Cad. Subgrupo
          </Link>
          <button
            onClick={() => setShowLimparModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs border border-red-200 rounded-xl hover:bg-red-50 text-red-600 transition-colors"
          >
            <Trash2 size={13} /> Limpar credores
          </button>
        </div>
      </div>

      {/* Stats resumo */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Total de Credores</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-1">Cadastrados via importação</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <p className="text-xs text-emerald-700 font-medium">Classificados</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{Math.max(0, stats.total - stats.semGrupo - stats.porPagamento)}</p>
          <p className="text-xs text-emerald-500 mt-1">Com grupo definido</p>
        </div>
        <div className={`rounded-xl border p-4 ${stats.semGrupo > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
          <p className="text-xs text-gray-500 font-medium">Pendentes</p>
          <p className={`text-2xl font-bold mt-1 ${stats.semGrupo > 0 ? 'text-orange-500' : 'text-gray-400'}`}>{stats.semGrupo}</p>
          <p className="text-xs text-gray-400 mt-1">Aguardando classificação</p>
        </div>
        <div className={`rounded-xl border p-4 ${stats.porPagamento > 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-white'}`}>
          <p className="text-xs text-indigo-600 font-medium flex items-center gap-1"><Layers size={11} /> Por Pagamento</p>
          <p className={`text-2xl font-bold mt-1 ${stats.porPagamento > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>{stats.porPagamento}</p>
          <p className="text-xs text-gray-400 mt-1">Classificação individual</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Grupos Cadastrados</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{grupos.length}</p>
          <p className="text-xs text-gray-400 mt-1">Disponíveis para uso</p>
        </div>
      </div>

      {/* Abas */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        {/* Navegação de abas */}
        <div className="flex border-b">
          {abas.map((aba) => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all relative ${
                abaAtiva === aba.id
                  ? 'text-gray-900 bg-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {aba.label}
              {aba.count > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                  style={{ background: abaAtiva === aba.id ? aba.cor : '#94a3b8' }}
                >
                  {aba.count}
                </span>
              )}
              {abaAtiva === aba.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: aba.cor }} />
              )}
            </button>
          ))}

          {/* Descrição da aba ativa */}
          <div className="flex-1 flex items-center justify-end px-4">
            {abaAtiva === 'por_pagamento' && (
              <span className="text-xs text-indigo-500 flex items-center gap-1">
                <Lock size={11} /> Grupo e Subgrupo bloqueados — use "Converter" para liberar
              </span>
            )}
            {abaAtiva === 'pendentes' && stats.semGrupo > 0 && (
              <span className="text-xs text-orange-500 flex items-center gap-1">
                <AlertCircle size={11} /> {stats.semGrupo} credor{stats.semGrupo !== 1 ? 'es' : ''} aguardando classificação
              </span>
            )}
          </div>
        </div>

        {/* Busca + filtros */}
        <div className="p-4 border-b flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Buscar por nome ou CNPJ/CPF..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-56 shrink-0">
            <SearchSelect
              value={filterGrupo}
              onChange={(val) => { setFilterGrupo(val === '' ? '' : String(val)); setPage(1); }}
              options={grupos}
              placeholder="Todos os grupos"
            />
          </div>
          {abaAtiva === 'classificados' && (
            <>
              <button
                onClick={() => { setCardFilter(cardFilter === 'semSubgrupo' ? null : 'semSubgrupo'); setPage(1); }}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors ${
                  cardFilter === 'semSubgrupo'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'border-gray-200 text-gray-600 hover:border-purple-400 hover:text-purple-600'
                }`}
              >
                <Layers size={12} /> Sem subgrupo {stats.semSubgrupo > 0 && `(${stats.semSubgrupo})`}
              </button>
              <select
                className="shrink-0 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600"
                value={cardFilter === 'aPagar' ? 'A_PAGAR' : filterOrigem}
                onChange={(e) => { setFilterOrigem(e.target.value); setCardFilter(null); setPage(1); }}
              >
                <option value="">Todas as origens</option>
                <option value="PAGO">Pago</option>
                <option value="A_PAGAR">A Pagar</option>
                <option value="SEM">Sem origem</option>
              </select>
            </>
          )}
        </div>

        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Credor</th>
                <th className="px-3 py-2 text-left w-48">Grupo</th>
                <th className="px-3 py-2 text-left w-52">Subgrupo</th>
                <th className="px-3 py-2 text-left">Histórico</th>
                <th className="px-3 py-2 text-left w-24">Origem</th>
                <th className="px-3 py-2 text-center w-28">
                  {abaAtiva === 'por_pagamento'
                    ? <span className="text-indigo-500 flex items-center justify-center gap-1"><Lock size={11} /> Ação</span>
                    : <span title="Classificação por pagamento"><Layers size={13} className="mx-auto text-indigo-400" /></span>
                  }
                </th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Carregando...</td></tr>
              ) : credores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <Users size={32} className="mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-400 text-sm">
                      {abaAtiva === 'classificados' && 'Nenhum credor classificado ainda'}
                      {abaAtiva === 'pendentes' && 'Nenhum credor pendente — tudo classificado!'}
                      {abaAtiva === 'por_pagamento' && 'Nenhum credor com classificação por pagamento'}
                    </p>
                  </td>
                </tr>
              ) : credores.map((c) => (
                <CredorRow
                  key={c.id}
                  credor={c}
                  grupos={grupos}
                  subgrupos={subgrupos}
                  token={token}
                  aba={abaAtiva}
                  onSaved={() => { loadStats(); loadCredores(); }}
                  onOpenHistorico={setHistoricoModal}
                  onRequestConvert={setConvertModal}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t text-sm text-gray-500">
            <span>{total} credores no total</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50">Anterior</button>
              <span className="text-xs">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50">Próximo</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de histórico */}
      {historicoModal && (
        <HistoricoModal
          credor={historicoModal}
          grupos={grupos}
          subgrupos={subgrupos}
          token={token}
          onClose={() => setHistoricoModal(null)}
          onSaved={(novo, gId, sId, gNome, sNome) => handleHistoricoSaved(historicoModal.id, novo, gId, sId, gNome, sNome)}
        />
      )}

      {/* Modal limpar credores */}
      {showLimparModal && (
        <LimparCredoresModal
          token={token}
          onClose={() => setShowLimparModal(false)}
          onDone={() => { loadCredores(); loadStats(); }}
        />
      )}

      {/* Modal Confirmação Diárias */}
      {showConfDiarias && (
        <ConfDiariasModal
          token={token}
          subgrupos={subgrupos}
          tipo="diarias"
          onClose={() => setShowConfDiarias(false)}
          onSaved={() => { loadCredores(); loadStats(); }}
        />
      )}

      {/* Modal Confirmação Pessoal */}
      {showConfPessoal && (
        <ConfDiariasModal
          token={token}
          subgrupos={subgrupos}
          tipo="pessoal"
          onClose={() => setShowConfPessoal(false)}
          onSaved={() => { loadCredores(); loadStats(); }}
        />
      )}

      {/* Modal converter para classificação padrão */}
      {convertModal && (
        <ConverterParaPadraoModal
          credor={convertModal}
          token={token}
          onClose={() => setConvertModal(null)}
          onConverted={() => { setConvertModal(null); loadCredores(); loadStats(); }}
        />
      )}
    </div>
  );
}
