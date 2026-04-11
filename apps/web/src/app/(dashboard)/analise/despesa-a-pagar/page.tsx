'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  SlidersHorizontal, X, ChevronUp, ChevronDown, Loader2, Search,
  Tag, Layers, Building2, ExternalLink, AlertTriangle, RefreshCw,
  DollarSign, Hash, Users,
} from 'lucide-react';
import TopBar from '@/components/dashboard/TopBar';
import { SearchSelect } from '@/components/SearchSelect';
import { formatCurrency, cn } from '@/lib/utils';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Grupo    { id: number; nome: string; }
interface Subgrupo { id: number; nome: string; fk_grupo: number; }
interface Empenho  {
  id: number;
  dt_liquidacao: string | null;
  num_empenho: string | null;
  num_reduzido: string | null;
  credor_nome: string | null;
  historico: string | null;
  tipo_empenho: string | null;
  dt_empenho: string | null;
  valor: number;
  periodo_ref: string;
  classificacao_orc: string | null;
  fk_credor: number | null;
  fk_credor_a_pagar: number | null;
  entidade_nome: string | null;
  fk_grupo: number | null;
  fk_subgrupo: number | null;
  grupo_nome: string | null;
  subgrupo_nome: string | null;
}

interface ListagemResponse {
  rows: Empenho[];
  total: number;
  page: number;
  limit: number;
  stats: {
    total_registros: number;
    valor_total: number;
    total_credores: number;
    sem_grupo: number;
    sem_subgrupo: number;
  };
}

// ─── Formatadores ─────────────────────────────────────────────────────────────
const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—';
  const s = String(val).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
}

// ─── SortTh ───────────────────────────────────────────────────────────────────
function SortTh({ label, col, sortBy, sortDir, onSort, align = 'center', className = '' }: {
  label: string; col: string; sortBy: string; sortDir: string;
  onSort: (col: string) => void; align?: 'left' | 'center' | 'right'; className?: string;
}) {
  const active = sortBy === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={cn(
        'px-3 py-3 text-xs font-semibold whitespace-nowrap cursor-pointer select-none transition-colors hover:text-blue-600',
        active ? 'text-blue-600' : 'text-gray-500',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
          : <ChevronDown size={10} className="opacity-30" />}
      </span>
    </th>
  );
}

// ─── Grupo/Subgrupo cell ──────────────────────────────────────────────────────
function GrupoCell({ row, grupos, subgrupos, token, onSaved }: {
  row: Empenho;
  grupos: Grupo[];
  subgrupos: Subgrupo[];
  token: string;
  onSaved: (id: number, fkGrupo: number | null, fkSubgrupo: number | null, grupoNome: string | null, subgrupoNome: string | null) => void;
}) {
  const [fkGrupo, setFkGrupo]       = useState<number | ''>(row.fk_grupo ?? '');
  const [fkSubgrupo, setFkSubgrupo] = useState<number | ''>(row.fk_subgrupo ?? '');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  const subsFiltrados = subgrupos.filter(s => s.fk_grupo === Number(fkGrupo));

  async function save(g: number | '', s: number | '') {
    if (!row.fk_credor && !row.fk_credor_a_pagar) return;
    setSaving(true);
    try {
      if (row.fk_credor) {
        await fetch(`${API_URL}/api/credores/${row.fk_credor}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fk_grupo: g || null, fk_subgrupo: s || null }),
        });
      } else {
        await fetch(`${API_URL}/api/credores-a-pagar/${row.fk_credor_a_pagar}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fk_grupo: g || null, fk_subgrupo: s || null }),
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      const grupoNome    = grupos.find(gr => gr.id === Number(g))?.nome ?? null;
      const subgrupoNome = subgrupos.find(sb => sb.id === Number(s))?.nome ?? null;
      onSaved(row.id, g ? Number(g) : null, s ? Number(s) : null, grupoNome, subgrupoNome);
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

  // Sem credor em nenhuma tabela → exibe link para cadastrar
  if (!row.fk_credor && !row.fk_credor_a_pagar) {
    return (
      <>
        <td className="px-2 py-2 text-center">
          <Link
            href={`/cadastros/credor?busca=${encodeURIComponent(row.credor_nome ?? '')}`}
            className="inline-flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium"
            title="Credor não cadastrado — clique para cadastrar"
          >
            <AlertTriangle size={9} />
            Cadastrar credor
            <ExternalLink size={9} />
          </Link>
        </td>
        <td className="px-2 py-2 text-center">
          <span className="text-[10px] text-gray-300">—</span>
        </td>
      </>
    );
  }

  return (
    <>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Layers size={11} className="text-indigo-400 shrink-0" />
          <SearchSelect
            value={fkGrupo}
            onChange={handleGrupo}
            options={grupos}
            placeholder="sem grupo"
          />
        </div>
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <SearchSelect
            value={fkSubgrupo}
            onChange={handleSubgrupo}
            options={subsFiltrados}
            placeholder="sem subgrupo"
            disabled={!fkGrupo || subsFiltrados.length === 0}
          />
          {saving && <Loader2 size={12} className="animate-spin text-indigo-400 shrink-0" />}
          {saved && !saving && (
            <span className="text-[10px] text-emerald-500 font-medium shrink-0">✓</span>
          )}
        </div>
      </td>
    </>
  );
}

// ─── Filtros ──────────────────────────────────────────────────────────────────
const EMPTY_FILTERS = {
  periodo: '', fk_entidade: '', fk_grupo: '', fk_subgrupo: '', credor: '', semGrupo: '', semSubgrupo: '',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DespesaAPagarPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string ?? '';

  const [rows, setRows]           = useState<Empenho[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [page, setPage]           = useState(1);
  const [limit]                   = useState(20);
  const [sortBy, setSortBy]       = useState('valor');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters]     = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats]         = useState<ListagemResponse['stats'] | null>(null);

  const [grupos, setGrupos]       = useState<Grupo[]>([]);
  const [subgrupos, setSubgrupos] = useState<Subgrupo[]>([]);
  const [periodos, setPeriodos]   = useState<string[]>([]);
  const [entidades, setEntidades] = useState<{ id: number; nome: string }[]>([]);

  const subgruposFiltrados = filters.fk_grupo
    ? subgrupos.filter(s => s.fk_grupo === Number(filters.fk_grupo))
    : subgrupos;

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const totalPages = Math.ceil(total / limit);

  function handleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
    setPage(1);
  }

  function setFilter(key: keyof typeof EMPTY_FILTERS, value: string) {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'fk_grupo') next.fk_subgrupo = '';
      return next;
    });
    setPage(1);
  }

  function clearFilters() { setFilters(EMPTY_FILTERS); setPage(1); }

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', String(limit));
    p.set('sortBy', sortBy);
    p.set('sortDir', sortDir);
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });

    try {
      const res = await fetch(`${API_URL}/api/empenhos-liquidados/listagem?${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ListagemResponse = await res.json();
      setRows(data.rows);
      setTotal(data.total);
      setStats(data.stats);
    } catch { /* offline */ }
    setLoading(false);
  }, [token, page, limit, sortBy, sortDir, filters]);

  useEffect(() => { load(); }, [load]);

  // Carrega metadados
  useEffect(() => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    fetch(`${API_URL}/api/credores/grupos`, { headers: h })
      .then(r => r.ok && r.json()).then(d => d && setGrupos(d)).catch(() => {});
    fetch(`${API_URL}/api/credores/subgrupos`, { headers: h })
      .then(r => r.ok && r.json()).then(d => d && setSubgrupos(d)).catch(() => {});
    fetch(`${API_URL}/api/empenhos-liquidados/periodos`, { headers: h })
      .then(r => r.ok && r.json()).then(d => d && setPeriodos(d)).catch(() => {});
    fetch(`${API_URL}/api/entidades?limit=200`, { headers: h })
      .then(r => r.ok && r.json())
      .then(d => { if (d?.rows) setEntidades(d.rows); else if (Array.isArray(d)) setEntidades(d); })
      .catch(() => {});
  }, [token]);

  function handleGrupoSaved(id: number, fkGrupo: number | null, fkSubgrupo: number | null, grupoNome: string | null, subgrupoNome: string | null) {
    setRows(prev => prev.map(r =>
      r.id === id ? { ...r, fk_grupo: fkGrupo, fk_subgrupo: fkSubgrupo, grupo_nome: grupoNome, subgrupo_nome: subgrupoNome } : r
    ));
  }

  return (
    <div>
      <TopBar title="Despesa a Pagar" subtitle={`${total} empenhos pendentes`} />

      <div className="p-4 space-y-4">

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border',
              showFilters
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600',
            )}
          >
            <SlidersHorizontal size={15} />
            Filtros
            {activeFilters > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-blue-600 text-xs font-bold flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>

          {activeFilters > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium">
              <X size={14} /> Limpar filtros
            </button>
          )}

          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border border-gray-200 bg-white text-gray-500 hover:text-gray-700">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <div className="ml-auto text-sm text-gray-400">
            {total > 0 && <span>{((page - 1) * limit) + 1}–{Math.min(page * limit, total)} de {total}</span>}
          </div>
        </div>

        {/* ── Filtros ───────────────────────────────────────────────────────── */}
        {showFilters && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

              {/* Período */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Período</label>
                <select
                  value={filters.periodo}
                  onChange={e => setFilter('periodo', e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Todos</option>
                  {periodos.slice().reverse().map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Entidade */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Entidade</label>
                <select
                  value={filters.fk_entidade}
                  onChange={e => setFilter('fk_entidade', e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Todas</option>
                  {entidades.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>

              {/* Grupo */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Grupo</label>
                <select
                  value={filters.fk_grupo}
                  onChange={e => setFilter('fk_grupo', e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Todos</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </div>

              {/* Subgrupo */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Subgrupo</label>
                <select
                  value={filters.fk_subgrupo}
                  onChange={e => setFilter('fk_subgrupo', e.target.value)}
                  disabled={!filters.fk_grupo}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-40"
                >
                  <option value="">Todos</option>
                  {subgruposFiltrados.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>

              {/* Credor (busca texto) */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Credor</label>
                <div className="relative">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={filters.credor}
                    onChange={e => setFilter('credor', e.target.value)}
                    placeholder="Buscar…"
                    className="w-full text-xs border rounded-lg pl-7 pr-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Sem grupo */}
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filters.semGrupo === '1'}
                    onChange={e => setFilter('semGrupo', e.target.checked ? '1' : '')}
                    className="accent-orange-500 w-4 h-4"
                  />
                  <span className="text-xs text-gray-600 font-medium">Sem grupo</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Cards informativos */}
            {[
              { icon: <Hash size={16} className="text-blue-400" />, label: 'Total Empenhos', value: stats.total_registros.toLocaleString('pt-BR'), bg: '#eff6ff', border: '#bfdbfe' },
              { icon: <DollarSign size={16} className="text-emerald-400" />, label: 'Valor Total', value: `R$ ${fmt(stats.valor_total)}`, bg: '#ecfdf5', border: '#a7f3d0' },
              { icon: <Users size={16} className="text-violet-400" />, label: 'Credores', value: stats.total_credores.toLocaleString('pt-BR'), bg: '#fdf4ff', border: '#e9d5ff' },
            ].map((k, i) => (
              <div key={i} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: '14px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</span>
                  {k.icon}
                </div>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#0F2A4E', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{k.value}</span>
              </div>
            ))}
            {/* Card clicável — Grupo s/ Class. */}
            <button
              onClick={() => { setFilter('semGrupo', filters.semGrupo === '1' ? '' : '1'); setFilter('semSubgrupo', ''); }}
              style={{
                background: filters.semGrupo === '1' ? '#fef3c7' : stats.sem_grupo > 0 ? '#fffbeb' : '#f0fdf4',
                border: `2px solid ${filters.semGrupo === '1' ? '#f59e0b' : stats.sem_grupo > 0 ? '#fde68a' : '#a7f3d0'}`,
                borderRadius: '14px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px',
                cursor: stats.sem_grupo > 0 ? 'pointer' : 'default', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Grupo s/ Class.</span>
                <Layers size={16} className={filters.semGrupo === '1' ? 'text-amber-500' : 'text-amber-400'} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#0F2A4E', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{stats.sem_grupo.toLocaleString('pt-BR')}</span>
                {filters.semGrupo === '1' && <span style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b' }}>✕ filtrado</span>}
              </div>
            </button>
            {/* Card clicável — Subgrupo s/ Class. */}
            <button
              onClick={() => { setFilter('semSubgrupo', filters.semSubgrupo === '1' ? '' : '1'); setFilter('semGrupo', ''); }}
              style={{
                background: filters.semSubgrupo === '1' ? '#ede9fe' : stats.sem_subgrupo > 0 ? '#faf5ff' : '#f0fdf4',
                border: `2px solid ${filters.semSubgrupo === '1' ? '#7c3aed' : stats.sem_subgrupo > 0 ? '#e9d5ff' : '#a7f3d0'}`,
                borderRadius: '14px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px',
                cursor: stats.sem_subgrupo > 0 ? 'pointer' : 'default', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subgrupo s/ Class.</span>
                <Tag size={16} className={filters.semSubgrupo === '1' ? 'text-purple-600' : 'text-purple-400'} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#0F2A4E', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{stats.sem_subgrupo.toLocaleString('pt-BR')}</span>
                {filters.semSubgrupo === '1' && <span style={{ fontSize: '10px', fontWeight: 700, color: '#7c3aed' }}>✕ filtrado</span>}
              </div>
            </button>
          </div>
        )}

        {/* ── Tabela ───────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{ minWidth: '1100px' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <SortTh label="Dt. Liquidação" col="dt_liquidacao" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="left" className="pl-4" />
                  <SortTh label="Empenho"        col="num_empenho"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="center" />
                  <SortTh label="Credor"         col="credor_nome"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="left" />
                  <SortTh label="Histórico"      col="historico"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="left" />
                  <SortTh label="Período"        col="periodo_ref"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="center" />
                  <SortTh label="Entidade"       col="entidade_nome" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="left" />
                  <SortTh label="Grupo"          col="grupo_nome"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="left" />
                  <SortTh label="Subgrupo"       col="subgrupo_nome" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="left" />
                  <SortTh label="Valor"          col="valor"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="right" className="pr-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <Loader2 size={20} className="animate-spin text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Carregando…</p>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <p className="text-sm text-gray-400">Nenhum empenho pendente encontrado</p>
                    </td>
                  </tr>
                ) : rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-blue-50/30 transition-colors"
                    style={{ borderBottom: '1px solid #f8fafc' }}
                  >
                    {/* Data liquidação */}
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap pl-4">
                      {fmtDate(row.dt_liquidacao)}
                    </td>

                    {/* Empenho */}
                    <td className="px-3 py-2.5 text-center font-mono text-gray-500 text-[11px]">
                      {row.num_empenho || '—'}
                    </td>

                    {/* Credor */}
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        {!row.fk_credor && (
                          <span title="Credor não cadastrado">
                            <AlertTriangle size={11} className="text-amber-400 shrink-0" />
                          </span>
                        )}
                        <span
                          className="text-gray-700 font-medium truncate text-xs"
                          title={row.credor_nome ?? ''}
                        >
                          {row.credor_nome || '—'}
                        </span>
                      </div>
                      {row.fk_credor && (
                        <Link
                          href={`/cadastros/credor?id=${row.fk_credor}`}
                          className="text-[10px] text-blue-400 hover:text-blue-600 flex items-center gap-0.5 mt-0.5"
                          title="Ver credor"
                        >
                          <ExternalLink size={9} /> ver credor
                        </Link>
                      )}
                    </td>

                    {/* Histórico */}
                    <td className="px-3 py-2.5 max-w-[240px]">
                      <span className="text-gray-500 text-[11px] line-clamp-2" title={row.historico ?? ''}>
                        {row.historico || '—'}
                      </span>
                    </td>

                    {/* Período */}
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block bg-slate-100 text-slate-600 text-[10px] font-mono px-2 py-0.5 rounded-full font-medium">
                        {row.periodo_ref}
                      </span>
                    </td>

                    {/* Entidade */}
                    <td className="px-3 py-2.5 max-w-[140px]">
                      <span className="text-gray-500 text-[11px] truncate block" title={row.entidade_nome ?? ''}>
                        {row.entidade_nome || '—'}
                      </span>
                    </td>

                    {/* Grupo + Subgrupo — classificação via credor */}
                    {token ? (
                      <GrupoCell
                        row={row}
                        grupos={grupos}
                        subgrupos={subgrupos}
                        token={token}
                        onSaved={handleGrupoSaved}
                      />
                    ) : (
                      <>
                        <td className="px-3 py-2.5 text-gray-400 text-[11px]">{row.grupo_nome || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-400 text-[11px]">{row.subgrupo_nome || '—'}</td>
                      </>
                    )}

                    {/* Valor */}
                    <td className="px-3 py-2.5 text-right pr-4 whitespace-nowrap">
                      <span className={cn(
                        'font-bold tabular-nums text-xs',
                        Number(row.valor) < 0 ? 'text-emerald-600' : 'text-gray-800',
                      )}>
                        R$ {fmt(Number(row.valor))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <span className="text-xs text-gray-400">
                Página {page} de {totalPages} · {total} registros
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Anterior
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={cn(
                        'w-8 h-8 text-xs rounded-lg border transition-colors',
                        p === page
                          ? 'bg-blue-600 text-white border-blue-600 font-bold'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600',
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
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
