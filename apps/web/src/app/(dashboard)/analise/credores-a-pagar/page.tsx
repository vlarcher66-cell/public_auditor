'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Search, Layers, ChevronUp, ChevronDown, Loader2,
  CheckCircle2, AlertTriangle, Tag, FileText, X, Check, Trash2,
  ShieldCheck,
} from 'lucide-react';
import TopBar from '@/components/dashboard/TopBar';
import { SearchSelect } from '@/components/SearchSelect';
import { cn } from '@/lib/utils';
import { useMunicipioEntidade } from '@/contexts/MunicipioEntidadeContext';
import { apiRequest } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Aba = 'classificados' | 'sem_classificacao' | 'revisao';

interface Grupo    { id: number; nome: string; }
interface Subgrupo { id: number; nome: string; fk_grupo: number; }
interface CredorAPagar {
  id: number;
  nome: string;
  historico: string | null;
  fk_grupo: number | null;
  fk_subgrupo: number | null;
  grupo_nome: string | null;
  subgrupo_nome: string | null;
  detalhar_no_pagamento: boolean;
  criado_em: string;
  classificado_por: number | null;
  classificado_por_nome: string | null;
}

interface ListagemResponse {
  rows: CredorAPagar[];
  total: number;
  sem_grupo: number;
  com_grupo: number;
  page: number;
  limit: number;
}

// ─── Modal de Histórico ───────────────────────────────────────────────────────
function HistoricoModal({ credor, grupos, subgrupos, token, onClose, onSaved }: {
  credor: CredorAPagar;
  grupos: Grupo[];
  subgrupos: Subgrupo[];
  token: string;
  onClose: () => void;
  onSaved: (id: number, updates: Partial<CredorAPagar>) => void;
}) {
  const [texto,      setTexto]      = useState(credor.historico ?? '');
  const [grupoId,    setGrupoId]    = useState<number | ''>(credor.fk_grupo ?? '');
  const [subgrupoId, setSubgrupoId] = useState<number | ''>(credor.fk_subgrupo ?? '');
  const [saving,     setSaving]     = useState(false);

  const subsFiltrados = subgrupos.filter(s => s.fk_grupo === Number(grupoId));

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/credores-a-pagar/${credor.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fk_grupo:    grupoId    || null,
          fk_subgrupo: subgrupoId || null,
          historico:   texto.trim() || null,
        }),
      });
      const grupo_nome    = grupos.find(g => g.id === Number(grupoId))?.nome ?? null;
      const subgrupo_nome = subsFiltrados.find(s => s.id === Number(subgrupoId))?.nome ?? null;
      onSaved(credor.id, { fk_grupo: grupoId || null, fk_subgrupo: subgrupoId || null, historico: texto.trim() || null, grupo_nome, subgrupo_nome });
      onClose();
    } catch { /* offline */ }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-xl overflow-hidden">
        <div style={{ background: 'linear-gradient(135deg, #0F2A4E 0%, #1a3a6b 60%, #0F2A4E 100%)' }} className="px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.4)' }}>
                <FileText size={18} color="#C9A84C" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base leading-tight">{credor.nome}</h2>
                <p className="text-xs mt-0.5" style={{ color: '#93c5fd' }}>Histórico / Anotações do Credor</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors mt-0.5"><X size={18} /></button>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {credor.grupo_nome
              ? <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(30,77,149,0.4)', color: '#93c5fd' }}>{credor.grupo_nome}</span>
              : <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(234,88,12,0.3)', color: '#fdba74' }}>Sem grupo</span>
            }
            {credor.subgrupo_nome && (
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(201,168,76,0.2)', color: '#fde68a' }}>{credor.subgrupo_nome}</span>
            )}
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Classificação</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Grupo</label>
                <select value={grupoId} onChange={e => { setGrupoId(e.target.value ? Number(e.target.value) : ''); setSubgrupoId(''); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white text-gray-700">
                  <option value="">— Sem grupo —</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Subgrupo</label>
                <select value={subgrupoId} onChange={e => setSubgrupoId(e.target.value ? Number(e.target.value) : '')}
                  disabled={!grupoId || subsFiltrados.length === 0}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white text-gray-700 disabled:bg-gray-50 disabled:text-gray-400">
                  <option value="">— Sem subgrupo —</option>
                  {subsFiltrados.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="border-t border-dashed border-gray-100" />
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Anotações &amp; Observações</label>
            <textarea autoFocus rows={6}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none leading-relaxed text-gray-700"
              placeholder="Ex: Fornecedor de medicamentos. Empenhado conforme contrato nº..."
              value={texto} onChange={e => setTexto(e.target.value)} />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-gray-400">Usado para auxiliar a classificação automática.</p>
              <span className={`text-xs font-mono ${texto.length > 400 ? 'text-orange-500' : 'text-gray-400'}`}>{texto.length} car.</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <p className="text-xs text-gray-400 flex items-center gap-1"><Check size={11} className="text-green-500" /> Salvo ao clicar em Salvar</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 font-medium transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 text-sm rounded-lg text-white font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
              style={{ background: saving ? '#94a3b8' : '#0F2A4E' }}>
              {saving ? <><Loader2 size={13} className="animate-spin" /> Salvando...</> : <><Check size={13} /> Salvar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Linha da tabela (abas classificados / sem_classificacao) ─────────────────
function CredorRow({ credor, grupos, subgrupos, token, onSaved, onOpenHistorico }: {
  credor: CredorAPagar;
  grupos: Grupo[];
  subgrupos: Subgrupo[];
  token: string;
  onSaved: (id: number, updates: Partial<CredorAPagar>) => void;
  onOpenHistorico: (c: CredorAPagar) => void;
}) {
  const [fkGrupo,    setFkGrupo]    = useState<number | ''>(credor.fk_grupo ?? '');
  const [fkSubgrupo, setFkSubgrupo] = useState<number | ''>(credor.fk_subgrupo ?? '');
  const [detalhar,   setDetalhar]   = useState(!!credor.detalhar_no_pagamento);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);

  const subsFiltrados = subgrupos.filter(s => s.fk_grupo === Number(fkGrupo));

  async function save(g: number | '', s: number | '', det?: boolean) {
    setSaving(true); setSaved(false);
    try {
      await fetch(`${API_URL}/api/credores-a-pagar/${credor.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fk_grupo: g || null, fk_subgrupo: s || null, ...(det !== undefined && { detalhar_no_pagamento: det }) }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      const grupo_nome    = grupos.find(gr => gr.id === Number(g))?.nome ?? null;
      const subgrupo_nome = subgrupos.find(sb => sb.id === Number(s))?.nome ?? null;
      onSaved(credor.id, { fk_grupo: g || null, fk_subgrupo: s || null, grupo_nome, subgrupo_nome });
    } catch { /* offline */ }
    setSaving(false);
  }

  function handleGrupo(val: number | string | '') {
    const v = val === '' ? '' : Number(val);
    setFkGrupo(v); setFkSubgrupo(''); save(v, '');
  }

  function handleSubgrupo(val: number | string | '') {
    const v = val === '' ? '' : Number(val);
    setFkSubgrupo(v); save(fkGrupo, v);
  }

  function handleDetalharToggle() {
    const next = !detalhar; setDetalhar(next); save(fkGrupo, fkSubgrupo, next);
  }

  return (
    <tr className="border-b hover:bg-gray-50 transition-colors">
      <td className="px-3 py-2 font-medium text-gray-900 max-w-[220px]">
        <div className="truncate text-[13px]" title={credor.nome}>{credor.nome}</div>
      </td>
      <td className="px-2 py-1.5">
        <SearchSelect value={fkGrupo} onChange={handleGrupo} options={grupos} placeholder="sem grupo" />
      </td>
      <td className="px-2 py-1.5">
        <SearchSelect value={fkSubgrupo} onChange={handleSubgrupo} options={subsFiltrados} placeholder="sem subgrupo"
          disabled={!fkGrupo || subsFiltrados.length === 0} />
      </td>
      <td className="px-3 py-2 max-w-[240px]">
        <button onClick={() => onOpenHistorico(credor)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors group w-full text-left"
          title={credor.historico ?? 'Adicionar histórico'}>
          <FileText size={13} className={credor.historico ? 'text-blue-500' : 'text-gray-300 group-hover:text-blue-400'} />
          <span className="truncate">
            {credor.historico
              ? <span className="text-gray-600">{credor.historico}</span>
              : <span className="text-gray-300 italic">adicionar...</span>}
          </span>
        </button>
      </td>
      <td className="px-3 py-2 text-center">
        <button onClick={handleDetalharToggle}
          title={detalhar ? 'Classificando por pagamento — clique para desativar' : 'Ativar classificação por pagamento'}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
            detalhar ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}>
          <Layers size={12} />
          {detalhar ? 'Por pag.' : 'Padrão'}
        </button>
      </td>
      <td className="px-3 py-2 text-center w-8">
        {saving && <Loader2 size={14} className="animate-spin text-blue-400 mx-auto" />}
        {saved && !saving && <CheckCircle2 size={14} className="text-emerald-500 mx-auto" />}
      </td>
    </tr>
  );
}

// ─── Linha da aba Revisão (SUPER_ADMIN) ───────────────────────────────────────
function RevisaoRow({ credor, token, onDeleted }: {
  credor: CredorAPagar;
  token: string;
  onDeleted: (id: number) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`${API_URL}/api/credores-a-pagar/${credor.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      onDeleted(credor.id);
    } catch { /* offline */ }
    setDeleting(false);
    setConfirming(false);
  }

  return (
    <tr className="border-b hover:bg-gray-50 transition-colors">
      <td className="px-3 py-2 font-medium text-gray-900 max-w-[220px]">
        <div className="truncate text-[13px]" title={credor.nome}>{credor.nome}</div>
      </td>
      <td className="px-3 py-2 text-[13px] text-gray-600">{credor.grupo_nome ?? <span className="text-gray-300 italic">—</span>}</td>
      <td className="px-3 py-2 text-[13px] text-gray-500">{credor.subgrupo_nome ?? <span className="text-gray-300 italic">—</span>}</td>
      <td className="px-3 py-2 text-[13px] text-indigo-600 font-medium">{credor.classificado_por_nome ?? '—'}</td>
      <td className="px-3 py-2 text-center">
        {confirming ? (
          <div className="flex items-center gap-1 justify-center">
            <button onClick={handleDelete} disabled={deleting}
              className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
              {deleting ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              Confirmar
            </button>
            <button onClick={() => setConfirming(false)} className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-100">
              <X size={11} />
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={12} /> Excluir
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Modal Limpar Credores a Pagar ────────────────────────────────────────────
function LimparCredoresAPagarModal({ token, onClose, onDone }: { token: string; onClose: () => void; onDone: () => void; }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const CONFIRM_WORD = 'LIMPAR';

  async function handleDelete() {
    if (confirmText !== CONFIRM_WORD) return;
    setDeleting(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/credores-a-pagar`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Erro ao excluir'); setDeleting(false); return; }
      onDone(); onClose();
    } catch { setError('API indisponível'); setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center"><Trash2 size={18} className="text-red-600" /></div>
            <h2 className="font-semibold text-gray-800">Limpar credores a pagar</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-1">
            <p className="font-semibold">⚠️ Atenção: esta ação é irreversível!</p>
            <p>Todos os credores a pagar serão permanentemente excluídos.</p>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Digite <span className="font-bold text-red-600">{CONFIRM_WORD}</span> para confirmar:
            </label>
            <input autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 font-mono tracking-widest"
              placeholder={CONFIRM_WORD} value={confirmText}
              onChange={e => setConfirmText(e.target.value.toUpperCase())} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancelar</button>
          <button onClick={handleDelete} disabled={confirmText !== CONFIRM_WORD || deleting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Trash2 size={14} />
            {deleting ? 'Excluindo...' : 'Limpar tudo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function CredoresAPagarPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const role  = (session?.user as any)?.role as string | undefined;
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

  const { entidadeSelecionada, municipioSelecionado } = useMunicipioEntidade();

  const [aba, setAba] = useState<Aba>('sem_classificacao');

  // Quando a session carregar, ajusta a aba inicial para SUPER_ADMIN
  useEffect(() => {
    if (role) setAba(isSuperAdmin ? 'classificados' : 'sem_classificacao');
  }, [role]); // eslint-disable-line
  const [rows,     setRows]     = useState<CredorAPagar[]>([]);
  const [total,    setTotal]    = useState(0);
  const [semGrupo, setSemGrupo] = useState(0);
  const [comGrupo, setComGrupo] = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);

  const [grupos,    setGrupos]    = useState<Grupo[]>([]);
  const [subgrupos, setSubgrupos] = useState<Subgrupo[]>([]);

  const [search,   setSearch]   = useState('');
  const [sortBy,   setSortBy]   = useState('nome');
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc'>('asc');

  const [modalCredor, setModalCredor] = useState<CredorAPagar | null>(null);
  const [showLimpar,  setShowLimpar]  = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LIMIT = 50;

  const ctxParams: Record<string, string> = {};
  if (entidadeSelecionada?.id) ctxParams.entidadeId = String(entidadeSelecionada.id);
  else if (municipioSelecionado?.id) ctxParams.municipioId = String(municipioSelecionado.id);

  const load = useCallback(async (pg = 1, abaAtual: Aba = aba) => {
    if (!token) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(pg), limit: String(LIMIT), aba: abaAtual, ...ctxParams,
      };
      if (search) params.search = search;

      const data = await apiRequest<ListagemResponse>('/credores-a-pagar', { token, params });
      setRows(data.rows);
      setTotal(data.total);
      setSemGrupo(data.sem_grupo);
      setComGrupo(data.com_grupo);
      setPage(pg);
    } finally {
      setLoading(false);
    }
  }, [token, search, aba, entidadeSelecionada, municipioSelecionado]); // eslint-disable-line

  useEffect(() => { load(1, aba); }, [token, aba, entidadeSelecionada, municipioSelecionado]); // eslint-disable-line

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { load(1, aba); }, 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search]); // eslint-disable-line

  useEffect(() => {
    if (!token) return;
    apiRequest<{ grupos: Grupo[]; subgrupos: Subgrupo[] }>('/credores-a-pagar/opcoes', { token })
      .then(d => { setGrupos(d.grupos); setSubgrupos(d.subgrupos); })
      .catch(() => {});
  }, [token]); // eslint-disable-line

  function handleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  }

  function onSaved(id: number, updates: Partial<CredorAPagar>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }

  function onDeleted(id: number) {
    setRows(prev => prev.filter(r => r.id !== id));
    setTotal(t => t - 1);
  }

  function SortTh({ label, col, className = '' }: { label: string; col: string; className?: string }) {
    const active = sortBy === col;
    return (
      <th onClick={() => handleSort(col)} className={cn(
        'px-3 py-3 text-xs font-semibold whitespace-nowrap cursor-pointer select-none transition-colors hover:text-blue-600 text-left',
        active ? 'text-blue-600' : 'text-gray-500', className,
      )}>
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={10} className="opacity-30" />}
        </span>
      </th>
    );
  }

  const totalPages = Math.ceil(total / LIMIT);

  // ── Abas config ──────────────────────────────────────────────────────────────
  const abas: { id: Aba; label: string; count: number; cor: string; icon: React.ReactNode }[] = [
    {
      id: 'classificados',
      label: 'Classificados',
      count: comGrupo,
      cor: 'emerald',
      icon: <CheckCircle2 size={13} />,
    },
    {
      id: 'sem_classificacao',
      label: 'Sem Classificação',
      count: semGrupo,
      cor: 'amber',
      icon: <AlertTriangle size={13} />,
    },
    ...(isSuperAdmin ? [{
      id: 'revisao' as Aba,
      label: 'Revisão',
      count: total,
      cor: 'indigo',
      icon: <ShieldCheck size={13} />,
    }] : []),
  ];

  const corMap: Record<string, { tab: string; badge: string }> = {
    emerald: {
      tab:   'border-emerald-500 text-emerald-600 bg-emerald-50',
      badge: 'bg-emerald-100 text-emerald-700',
    },
    amber: {
      tab:   'border-amber-500 text-amber-600 bg-amber-50',
      badge: 'bg-amber-100 text-amber-700',
    },
    indigo: {
      tab:   'border-indigo-500 text-indigo-600 bg-indigo-50',
      badge: 'bg-indigo-100 text-indigo-700',
    },
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar title="Credores a Pagar" subtitle="Classifique os fornecedores oriundos das importações de empenhos" />

      <div className="px-4 py-5 md:px-8 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Total de credores</p>
            <p className="text-2xl font-bold text-[#0F2A4E]">{comGrupo + semGrupo}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Sem classificação</p>
            <p className="text-2xl font-bold text-amber-500">{semGrupo}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Classificados</p>
            <p className="text-2xl font-bold text-emerald-500">{comGrupo}</p>
          </div>
        </div>

        {/* Abas — só SUPER_ADMIN vê navegação */}
        <div className="flex items-center gap-1 border-b border-gray-200">
          {isSuperAdmin && abas.map(a => {
            const ativo = aba === a.id;
            const cores = corMap[a.cor];
            return (
              <button
                key={a.id}
                onClick={() => { setAba(a.id); setSearch(''); }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                  ativo
                    ? cores.tab + ' border-b-2'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                )}
              >
                {a.icon}
                {a.label}
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                  ativo ? cores.badge : 'bg-gray-100 text-gray-500'
                )}>
                  {a.id === 'revisao' && ativo ? total : a.count}
                </span>
                {a.id === 'revisao' && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-600 text-white font-bold ml-1">Admin</span>
                )}
              </button>
            );
          })}

          {/* Botão limpar — só SUPER_ADMIN */}
          {isSuperAdmin && (
            <button onClick={() => setShowLimpar(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors ml-auto mb-1">
              <Trash2 size={12} /> Limpar credores
            </button>
          )}
        </div>

        {/* Barra de busca */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <span className="text-xs text-gray-400">{total} registro{total !== 1 ? 's' : ''}</span>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-gray-100">
                {aba === 'revisao' ? (
                  <tr>
                    <SortTh label="Nome do Credor" col="nome" className="w-[28%]" />
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-left">Grupo</th>
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-left">Subgrupo</th>
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-left">Classificado por</th>
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-center w-[100px]">Ação</th>
                  </tr>
                ) : (
                  <tr>
                    <SortTh label="Nome do Credor" col="nome" className="w-[25%]" />
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-left w-[160px]">
                      <span className="flex items-center gap-1"><Tag size={11} /> Grupo</span>
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-left w-[160px]">Subgrupo</th>
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-left">Histórico</th>
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-center w-[110px]">Detalhar</th>
                    <th className="w-8" />
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && rows.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-gray-400">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                    <span className="text-sm">Carregando...</span>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-gray-400 text-sm">
                    Nenhum credor encontrado
                  </td></tr>
                ) : aba === 'revisao' ? (
                  rows.map(credor => token && (
                    <RevisaoRow key={credor.id} credor={credor} token={token} onDeleted={onDeleted} />
                  ))
                ) : (
                  rows.map(credor => token && (
                    <CredorRow key={credor.id} credor={credor} grupos={grupos} subgrupos={subgrupos}
                      token={token} onSaved={onSaved} onOpenHistorico={setModalCredor} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">{total} credores · página {page} de {totalPages}</span>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => load(page - 1, aba)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">← Anterior</button>
                <button disabled={page >= totalPages} onClick={() => load(page + 1, aba)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Próxima →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal limpar */}
      {showLimpar && token && (
        <LimparCredoresAPagarModal token={token} onClose={() => setShowLimpar(false)}
          onDone={() => { setRows([]); setTotal(0); setSemGrupo(0); setComGrupo(0); load(1, aba); }} />
      )}

      {/* Modal histórico */}
      {modalCredor && token && (
        <HistoricoModal credor={modalCredor} grupos={grupos} subgrupos={subgrupos} token={token}
          onClose={() => setModalCredor(null)}
          onSaved={(id, updates) => { onSaved(id, updates); setModalCredor(prev => prev ? { ...prev, ...updates } : null); }} />
      )}
    </div>
  );
}
