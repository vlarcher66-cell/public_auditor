'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Search, Layers, ChevronUp, ChevronDown, Loader2,
  RefreshCw, CheckCircle2, AlertTriangle, Tag,
} from 'lucide-react';
import TopBar from '@/components/dashboard/TopBar';
import { SearchSelect } from '@/components/SearchSelect';
import { cn } from '@/lib/utils';
import { useMunicipioEntidade } from '@/contexts/MunicipioEntidadeContext';
import { apiRequest } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
  criado_em: string;
}

interface ListagemResponse {
  rows: CredorAPagar[];
  total: number;
  sem_grupo: number;
  page: number;
  limit: number;
}

// ─── Célula de Classificação ──────────────────────────────────────────────────
function ClassifCell({ credor, grupos, subgrupos, token, onSaved }: {
  credor: CredorAPagar;
  grupos: Grupo[];
  subgrupos: Subgrupo[];
  token: string;
  onSaved: (id: number, fkGrupo: number | null, fkSubgrupo: number | null, grupoNome: string | null, subgrupoNome: string | null) => void;
}) {
  const [fkGrupo,    setFkGrupo]    = useState<number | ''>(credor.fk_grupo ?? '');
  const [fkSubgrupo, setFkSubgrupo] = useState<number | ''>(credor.fk_subgrupo ?? '');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const subsFiltrados = subgrupos.filter(s => s.fk_grupo === Number(fkGrupo));

  async function save(g: number | '', s: number | '') {
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/credores-a-pagar/${credor.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fk_grupo: g || null, fk_subgrupo: s || null }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      const grupoNome    = grupos.find(gr => gr.id === Number(g))?.nome ?? null;
      const subgrupoNome = subgrupos.find(sb => sb.id === Number(s))?.nome ?? null;
      onSaved(credor.id, g ? Number(g) : null, s ? Number(s) : null, grupoNome, subgrupoNome);
    } catch { /* offline */ }
    setSaving(false);
  }

  function handleGrupo(val: number | string | '') {
    const v = val === '' ? '' : Number(val);
    setFkGrupo(v);
    setFkSubgrupo('');
    save(v, '');
  }

  function handleSubgrupo(val: number | string | '') {
    const v = val === '' ? '' : Number(val);
    setFkSubgrupo(v);
    save(fkGrupo, v);
  }

  return (
    <>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          {saving ? <Loader2 size={11} className="animate-spin text-blue-400 shrink-0" />
            : saved  ? <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
            : <Layers size={11} className="text-indigo-400 shrink-0" />}
          <SearchSelect value={fkGrupo} onChange={handleGrupo} options={grupos} placeholder="sem grupo" />
        </div>
      </td>
      <td className="px-2 py-1.5">
        <SearchSelect value={fkSubgrupo} onChange={handleSubgrupo} options={subsFiltrados} placeholder="sem subgrupo" />
      </td>
    </>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function CredoresAPagarPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const { entidadeSelecionada, municipioSelecionado } = useMunicipioEntidade();

  const [rows,     setRows]     = useState<CredorAPagar[]>([]);
  const [total,    setTotal]    = useState(0);
  const [semGrupo, setSemGrupo] = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);

  const [grupos,    setGrupos]    = useState<Grupo[]>([]);
  const [subgrupos, setSubgrupos] = useState<Subgrupo[]>([]);

  const [search,       setSearch]       = useState('');
  const [filtroSemGrupo, setFiltroSemGrupo] = useState(false);
  const [sortBy,  setSortBy]  = useState('nome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const LIMIT = 50;

  const ctxParams: Record<string, string> = {};
  if (entidadeSelecionada?.id) ctxParams.entidadeId = String(entidadeSelecionada.id);
  else if (municipioSelecionado?.id) ctxParams.municipioId = String(municipioSelecionado.id);

  const load = useCallback(async (pg = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(pg), limit: String(LIMIT), ...ctxParams,
      };
      if (search) params.search = search;
      if (filtroSemGrupo) params.semGrupo = '1';

      const data = await apiRequest<ListagemResponse>('/credores-a-pagar', { token, params });
      setRows(data.rows);
      setTotal(data.total);
      setSemGrupo(data.sem_grupo);
      setPage(pg);
    } finally {
      setLoading(false);
    }
  }, [token, search, filtroSemGrupo, entidadeSelecionada, municipioSelecionado]); // eslint-disable-line

  useEffect(() => { load(1); }, [token, entidadeSelecionada, municipioSelecionado]); // eslint-disable-line

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

  function SortTh({ label, col, align = 'left', className = '' }: {
    label: string; col: string; align?: 'left' | 'center' | 'right'; className?: string;
  }) {
    const active = sortBy === col;
    return (
      <th onClick={() => handleSort(col)} className={cn(
        'px-3 py-3 text-xs font-semibold whitespace-nowrap cursor-pointer select-none transition-colors hover:text-blue-600',
        active ? 'text-blue-600' : 'text-gray-500',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}>
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={10} className="opacity-30" />}
        </span>
      </th>
    );
  }

  function onSaved(id: number, fkGrupo: number | null, fkSubgrupo: number | null, grupoNome: string | null, subgrupoNome: string | null) {
    setRows(prev => prev.map(r => r.id === id
      ? { ...r, fk_grupo: fkGrupo, fk_subgrupo: fkSubgrupo, grupo_nome: grupoNome, subgrupo_nome: subgrupoNome }
      : r
    ));
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar title="Credores a Pagar" subtitle="Classifique os fornecedores oriundos das importações de empenhos" />

      <div className="px-4 py-5 md:px-8 space-y-4">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Total de credores</p>
            <p className="text-2xl font-bold text-[#0F2A4E]">{total}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Sem classificação</p>
            <p className="text-2xl font-bold text-amber-500">{semGrupo}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Classificados</p>
            <p className="text-2xl font-bold text-emerald-500">{total - semGrupo}</p>
          </div>
        </div>

        {/* ── Filtros ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load(1)}
              placeholder="Buscar por nome..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            onClick={() => { setFiltroSemGrupo(f => !f); }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
              filtroSemGrupo
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            )}
          >
            <AlertTriangle size={12} />
            Sem grupo ({semGrupo})
          </button>
          <button
            onClick={() => load(1)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#0F2A4E] text-white hover:bg-[#1e4d95] transition-colors"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Buscar
          </button>
        </div>

        {/* ── Tabela ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-gray-100">
                <tr>
                  <SortTh label="Nome do Credor" col="nome" className="w-[35%]" />
                  <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-left">Histórico</th>
                  <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-left w-[180px]">
                    <span className="flex items-center gap-1"><Tag size={11} /> Grupo</span>
                  </th>
                  <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-left w-[180px]">Subgrupo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && rows.length === 0 ? (
                  <tr><td colSpan={4} className="py-16 text-center text-gray-400">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                    <span className="text-sm">Carregando...</span>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={4} className="py-16 text-center text-gray-400 text-sm">
                    Nenhum credor encontrado
                  </td></tr>
                ) : rows.map(credor => (
                  <tr key={credor.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="text-[13px] font-medium text-gray-800">{credor.nome}</span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[260px]">
                      <span className="text-[11px] text-gray-500 line-clamp-2">{credor.historico ?? '—'}</span>
                    </td>
                    {token && (
                      <ClassifCell
                        credor={credor}
                        grupos={grupos}
                        subgrupos={subgrupos}
                        token={token}
                        onSaved={onSaved}
                      />
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">{total} credores · página {page} de {totalPages}</span>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => load(page - 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                  ← Anterior
                </button>
                <button disabled={page >= totalPages} onClick={() => load(page + 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
