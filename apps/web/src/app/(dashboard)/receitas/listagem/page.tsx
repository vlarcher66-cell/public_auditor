'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, TrendingUp, BarChart2, Layers, Download,
  Search, SlidersHorizontal, ChevronLeft, ChevronRight,
  X, ChevronDown, ChevronUp, Filter, Loader2,
} from 'lucide-react';
import TopBar from '@/components/dashboard/TopBar';
import { apiRequest } from '@/lib/api';

// ─── Formatação ───────────────────────────────────────────────────────────────

function fmtVal(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoReceita = 'ORC' | 'EXTRA';

interface ReceitaRow {
  id: number;
  data_receita: string;
  conhecimento: string | null;
  num_empenho: string | null;
  codigo_rubrica: string | null;
  descricao: string | null;
  fornecedor_nome: string | null;
  fornecedor_doc: string | null;
  documento: string | null;
  fonte_recurso: string | null;
  tipo_receita: TipoReceita;
  valor: number;
  entidade_nome: string | null;
  ano: number | null;
  mes: number | null;
}

interface SummaryData {
  totais: {
    total_registros: number;
    valor_total: number;
    valor_orc: number;
    valor_extra: number;
  } | null;
  porFonte: Array<{ fonte_recurso: string; registros: number; total: number }>;
  porTipo: Array<{ tipo_receita: string; registros: number; total: number }>;
}

// ─── Badge de fonte ───────────────────────────────────────────────────────────

const FONTE_PALETTE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  '1500': { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Fonte 1500' },
  '1600': { bg: '#f0fdf4', color: '#15803d', border: '#86efac', label: 'Fonte 1600' },
  '1604': { bg: '#fdf4ff', color: '#7e22ce', border: '#d8b4fe', label: 'Fonte 1604' },
  '1605': { bg: '#fff7ed', color: '#c2410c', border: '#fdba74', label: 'Fonte 1605' },
  '1631': { bg: '#f0fdfa', color: '#0f766e', border: '#5eead4', label: 'Fonte 1631' },
};

function FonteBadge({ fonte }: { fonte: string | null }) {
  const key = fonte ?? '';
  const p = FONTE_PALETTE[key] ?? { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', label: key ? `Fonte ${key}` : '—' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 5,
      fontWeight: 600, fontSize: 10, fontFamily: 'ui-monospace, monospace',
      background: p.bg, color: p.color, border: `1px solid ${p.border}`,
      whiteSpace: 'nowrap', letterSpacing: '0.02em',
    }}>
      {p.label}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo: TipoReceita }) {
  return tipo === 'ORC'
    ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 whitespace-nowrap">Orçamentária</span>
    : <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap">Extra Orc.</span>;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

// ─── Painel de resumo ─────────────────────────────────────────────────────────

function SummaryPanel({ summary }: { summary: SummaryData | null }) {
  if (!summary) return null;
  const maxTotal = Math.max(...summary.porFonte.map(f => Number(f.total)));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Por Fonte de Recurso</p>
      <div className="space-y-3">
        {summary.porFonte.map(({ fonte_recurso: fonte, registros, total }) => {
          const p = FONTE_PALETTE[fonte] ?? { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', label: `Fonte ${fonte}` };
          const pct = maxTotal > 0 ? (Number(total) / maxTotal) * 100 : 0;
          return (
            <div key={fonte}>
              <div className="flex items-center justify-between mb-1">
                <FonteBadge fonte={fonte} />
                <span className="text-[10px] text-gray-400 font-mono">{registros} reg.</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: p.color, opacity: 0.7 }}
                  />
                </div>
                <span className="text-[11px] font-mono font-semibold text-[#0F2A4E] whitespace-nowrap">
                  R$ {fmtVal(Number(total))}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {summary.totais && (
        <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-blue-600 font-medium">Orçamentária</span>
            <span className="text-[11px] font-mono font-semibold text-[#0F2A4E]">
              R$ {fmtVal(Number(summary.totais.valor_orc))}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-amber-600 font-medium">Extra Orçamentária</span>
            <span className="text-[11px] font-mono font-semibold text-[#0F2A4E]">
              R$ {fmtVal(Number(summary.totais.valor_extra))}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-gray-100">
            <span className="text-[11px] font-semibold text-[#0F2A4E]">Total</span>
            <span className="text-[12px] font-mono font-bold text-[#0F2A4E]">
              R$ {fmtVal(Number(summary.totais.valor_total))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

const PER_PAGE = 50;

export default function ReceitaListagemPage() {
  // Filtros
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [fDataInicio, setFDataInicio] = useState('');
  const [fDataFim, setFDataFim]       = useState('');
  const [fTipo, setFTipo]             = useState('');
  const [fFonte, setFFonte]           = useState('');
  const [fFornecedor, setFFornecedor] = useState('');
  const [fValMin, setFValMin]         = useState('');
  const [fValMax, setFValMax]         = useState('');

  // Estado da API
  const [rows, setRows]         = useState<ReceitaRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [summary, setSummary]   = useState<SummaryData | null>(null);

  // Filtros aplicados (só mudam ao clicar "Aplicar")
  const [applied, setApplied] = useState({
    dataInicio: '', dataFim: '', tipo: '', fonte: '', fornecedor: '', valMin: '', valMax: '',
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRows = useCallback(async (pg: number, filters: typeof applied) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(PER_PAGE) });
      if (filters.dataInicio) params.set('dataInicio', filters.dataInicio);
      if (filters.dataFim)    params.set('dataFim', filters.dataFim);
      if (filters.tipo)       params.set('tipo', filters.tipo);
      if (filters.fonte)      params.set('fonte', filters.fonte);
      if (filters.fornecedor) params.set('fornecedor', filters.fornecedor);
      if (filters.valMin)     params.set('valorMin', filters.valMin);
      if (filters.valMax)     params.set('valorMax', filters.valMax);

      const data = await apiRequest<{ rows: ReceitaRow[]; total: number; page: number; limit: number }>(
        `/receitas?${params}`
      );
      setRows(data.rows);
      setTotal(data.total);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async (filters: typeof applied) => {
    try {
      const params = new URLSearchParams();
      if (filters.tipo)  params.set('tipo', filters.tipo);
      if (filters.fonte) params.set('fonte', filters.fonte);
      const data = await apiRequest<SummaryData>(`/receitas/summary?${params}`);
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, []);

  // Fetch inicial e quando filtros aplicados ou página mudam
  useEffect(() => {
    fetchRows(page, applied);
  }, [page, applied, fetchRows]);

  useEffect(() => {
    fetchSummary(applied);
  }, [applied, fetchSummary]);

  const applyFilters = () => {
    const next = { dataInicio: fDataInicio, dataFim: fDataFim, tipo: fTipo, fonte: fFonte, fornecedor: fFornecedor, valMin: fValMin, valMax: fValMax };
    setApplied(next);
    setPage(1);
  };

  const resetFilters = () => {
    setFDataInicio(''); setFDataFim(''); setFTipo(''); setFFonte('');
    setFFornecedor(''); setFValMin(''); setFValMax('');
    setApplied({ dataInicio: '', dataFim: '', tipo: '', fonte: '', fornecedor: '', valMin: '', valMax: '' });
    setPage(1);
  };

  const activeFiltersCount = Object.values(applied).filter(Boolean).length;
  const totalPages = Math.ceil(total / PER_PAGE);
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to   = Math.min(page * PER_PAGE, total);

  const summaryTotais = summary?.totais;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <TopBar title="Listagem de Receita" />

      <main className="flex-1 p-6 space-y-5">

        {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#0F2A4E]">Listagem de Receita</h1>
            <p className="text-sm text-gray-400 mt-0.5">Registros individuais de receita arrecadada</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-xl shadow-sm transition-colors">
              <Download size={14} />
              CSV
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#0F2A4E] hover:bg-[#183E7A] text-white text-sm font-medium rounded-xl shadow-sm transition-colors">
              <Download size={14} />
              Exportar PDF
            </button>
          </div>
        </div>

        {/* ── Cards de resumo ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-start gap-3 hover:shadow-md transition-shadow">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText size={19} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 mb-0.5">Total de Registros</p>
              <p className="text-xl font-bold text-[#0F2A4E]">{summaryTotais ? summaryTotais.total_registros : '—'}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">registros importados</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-start gap-3 hover:shadow-md transition-shadow">
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp size={19} className="text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-400 mb-0.5">Total Arrecadado</p>
              <p className="text-xl font-bold text-[#0F2A4E] leading-tight">
                {summaryTotais ? `R$ ${fmtVal(Number(summaryTotais.valor_total))}` : '—'}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Orc. + Extra Orc.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-start gap-3 hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(15,42,78,0.08)' }}>
              <BarChart2 size={19} className="text-[#0F2A4E]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-400 mb-0.5">Receita Orçamentária</p>
              <p className="text-xl font-bold text-[#0F2A4E] leading-tight">
                {summaryTotais ? `R$ ${fmtVal(Number(summaryTotais.valor_orc))}` : '—'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-start gap-3 hover:shadow-md transition-shadow">
            <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Layers size={19} className="text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-400 mb-0.5">Receita Extra Orc.</p>
              <p className="text-xl font-bold text-[#0F2A4E] leading-tight">
                {summaryTotais ? `R$ ${fmtVal(Number(summaryTotais.valor_extra))}` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Layout: Filtros + Tabela + Painel ───────────────────────────── */}
        <div className="flex gap-5 items-start">

          {/* Coluna principal */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Filtros */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setFiltersOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={15} className="text-gray-400" />
                  <span className="text-sm font-semibold text-[#0F2A4E]">Filtros</span>
                  {activeFiltersCount > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#C9A84C] text-white text-[10px] font-bold">
                      {activeFiltersCount}
                    </span>
                  )}
                </div>
                {filtersOpen
                  ? <ChevronUp size={15} className="text-gray-400" />
                  : <ChevronDown size={15} className="text-gray-400" />
                }
              </button>

              {filtersOpen && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                    {/* Data início */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Data Início</label>
                      <input
                        type="date"
                        value={fDataInicio}
                        onChange={e => setFDataInicio(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Data fim */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Data Fim</label>
                      <input
                        type="date"
                        value={fDataFim}
                        onChange={e => setFDataFim(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Tipo */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Tipo</label>
                      <select
                        value={fTipo}
                        onChange={e => setFTipo(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        <option value="ORC">Orçamentária</option>
                        <option value="EXTRA">Extra Orçamentária</option>
                      </select>
                    </div>

                    {/* Fonte */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Fonte de Recurso</label>
                      <select
                        value={fFonte}
                        onChange={e => setFFonte(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todas</option>
                        <option value="1500">Fonte 1500</option>
                        <option value="1600">Fonte 1600</option>
                        <option value="1604">Fonte 1604</option>
                        <option value="1605">Fonte 1605</option>
                        <option value="1631">Fonte 1631</option>
                      </select>
                    </div>

                    {/* Valor mín */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Valor Mínimo</label>
                      <input
                        type="number"
                        placeholder="0,00"
                        value={fValMin}
                        onChange={e => setFValMin(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Valor máx */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Valor Máximo</label>
                      <input
                        type="number"
                        placeholder="999.999,99"
                        value={fValMax}
                        onChange={e => setFValMax(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Busca fornecedor */}
                  <div className="mt-3">
                    <label className="text-xs font-medium text-gray-500 block mb-1">Buscar Fornecedor / Descrição</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Nome do fornecedor ou descrição da rubrica..."
                        value={fFornecedor}
                        onChange={e => setFFornecedor(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && applyFilters()}
                        className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {fFornecedor && (
                        <button onClick={() => setFFornecedor('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-end gap-2 mt-4">
                    <button
                      onClick={resetFilters}
                      className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 text-sm rounded-xl transition-colors"
                    >
                      <X size={13} />
                      Limpar
                    </button>
                    <button
                      onClick={applyFilters}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#C9A84C] hover:bg-[#b8953d] text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      <Filter size={13} />
                      Aplicar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Header da tabela */}
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#0F2A4E]">
                  {loading ? (
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Loader2 size={13} className="animate-spin" /> Carregando...
                    </span>
                  ) : (
                    <>
                      Exibindo{' '}
                      <span className="text-gray-500">{from}–{to}</span>
                      {' '}de{' '}
                      <span className="font-bold">{total}</span> registros
                    </>
                  )}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 1100 }}>
                  <thead>
                    <tr className="border-b border-gray-100 bg-slate-50">
                      {[
                        { label: 'Data',       w: 90 },
                        { label: 'Conhec.',    w: 70 },
                        { label: 'Empenho',    w: 80 },
                        { label: 'Código',     w: 160 },
                        { label: 'Descrição',  w: 260 },
                        { label: 'Fornecedor', w: 220 },
                        { label: 'Documento',  w: 140 },
                        { label: 'Fonte',      w: 100 },
                        { label: 'Tipo',       w: 110 },
                        { label: 'Valor',      w: 120, right: true },
                      ].map(col => (
                        <th
                          key={col.label}
                          className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400"
                          style={{ minWidth: col.w, textAlign: col.right ? 'right' : 'left' }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={10} className="px-5 py-16 text-center">
                          <Loader2 size={24} className="animate-spin text-gray-300 mx-auto" />
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-5 py-16 text-center text-sm text-gray-400">
                          Nenhum registro encontrado.{' '}
                          {activeFiltersCount > 0 && (
                            <button onClick={resetFilters} className="text-blue-500 underline ml-1">Limpar filtros</button>
                          )}
                        </td>
                      </tr>
                    ) : rows.map((row, i) => (
                      <tr
                        key={row.id}
                        className={cn(
                          'border-b border-gray-50 transition-colors hover:bg-blue-50/40',
                          i % 2 === 1 ? 'bg-slate-50/40' : 'bg-white',
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-xs text-gray-500 whitespace-nowrap">{fmtDate(row.data_receita)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="font-mono text-xs text-gray-600 font-semibold">{row.conhecimento ?? '—'}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-xs text-gray-500">{row.num_empenho ?? '—'}</span>
                        </td>
                        <td className="px-3 py-2.5" style={{ maxWidth: 160 }}>
                          <span title={row.codigo_rubrica ?? ''} className="font-mono text-[10px] text-gray-400 block truncate">
                            {row.codigo_rubrica ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5" style={{ maxWidth: 260 }}>
                          <span title={row.descricao ?? ''} className="text-xs text-gray-700 block truncate leading-snug">
                            {row.descricao ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5" style={{ maxWidth: 220 }}>
                          <span title={row.fornecedor_nome ?? ''} className="text-xs font-semibold text-[#0F2A4E] block truncate">
                            {row.fornecedor_nome ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-[10px] text-gray-400 whitespace-nowrap">{row.fornecedor_doc ?? row.documento ?? '—'}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <FonteBadge fonte={row.fonte_recurso} />
                        </td>
                        <td className="px-3 py-2.5">
                          <TipoBadge tipo={row.tipo_receita} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={cn(
                            'font-mono text-sm font-semibold whitespace-nowrap',
                            Number(row.valor) >= 100000 ? 'text-emerald-700' : 'text-[#0F2A4E]',
                          )}>
                            R$ {fmtVal(Number(row.valor))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {rows.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-gray-200">
                        <td colSpan={9} className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-right">
                          Total desta página:
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono text-sm font-bold text-[#0F2A4E]">
                            R$ {fmtVal(rows.reduce((a, r) => a + Number(r.valor), 0))}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      // Mostra no máximo 7 páginas centradas na atual
                      let p: number;
                      if (totalPages <= 7) {
                        p = i + 1;
                      } else if (page <= 4) {
                        p = i + 1;
                      } else if (page >= totalPages - 3) {
                        p = totalPages - 6 + i;
                      } else {
                        p = page - 3 + i;
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={cn(
                            'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                            p === page
                              ? 'bg-[#0F2A4E] text-white'
                              : 'text-gray-500 hover:bg-gray-100',
                          )}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Próximo <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Painel lateral de resumo */}
          <div className="w-64 flex-shrink-0">
            <SummaryPanel summary={summary} />
          </div>
        </div>
      </main>
    </div>
  );
}
