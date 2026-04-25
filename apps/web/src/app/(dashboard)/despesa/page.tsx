'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingDown, Banknote, FileCheck, ArrowRight, BarChart2, Clock, TrendingUp, ChevronDown, FileDown, Loader2, ChevronRight, Layers2, LayoutDashboard, Table2, BriefcaseBusiness } from 'lucide-react';
import Link from 'next/link';
import TopBar from '@/components/dashboard/TopBar';
import StatCard from '@/components/dashboard/StatCard';
import { apiRequest } from '@/lib/api';
import { useMunicipioEntidade } from '@/contexts/MunicipioEntidadeContext';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line, LabelList,
  RadialBarChart, RadialBar,
  ComposedChart, Area, AreaChart,
} from 'recharts';
import { ReferenceLine } from 'recharts';
import type { OrdemPagamentoSummary } from '@public-auditor/shared';

// ─── Paleta de cores para grupos ──────────────────────────────────────────────
const GROUP_COLORS = [
  '#0F2A4E','#1e4d95','#C9A84C','#2563eb','#7c3aed',
  '#059669','#dc2626','#ea580c','#0891b2','#65a30d',
  '#9333ea','#db2777','#0284c7','#16a34a','#ca8a04',
  '#6366f1','#14b8a6','#f43f5e','#84cc16','#f97316',
];

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'sintetica' | 'desp_sintetica' | 'analitica' | 'diarias' | 'outros';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'sintetica',     label: 'Geral',                icon: <LayoutDashboard size={14} /> },
  { id: 'desp_sintetica',label: 'Despesa Sintética',    icon: <BarChart2 size={14} /> },
  { id: 'analitica',     label: 'Despesa Analítica',    icon: <Table2 size={14} /> },
  { id: 'diarias',       label: 'Despesa com Diárias',  icon: <BriefcaseBusiness size={14} /> },
  { id: 'outros',        label: 'Outros Exercícios',    icon: <Clock size={14} /> },
];

// ─── Tab: Em Construção ───────────────────────────────────────────────────────

// ─── Tab: Despesa Analítica ───────────────────────────────────────────────────

interface AnaliticaData {
  grupos: { id: number; nome: string }[];
  subgrupos: { id: number; nome: string; fk_grupo: number }[];
  // matrix[grupo_id][subgrupo_id | 0][mes] = total
  matrix: Record<string, Record<string, Record<string, number>>>;
  totaisMes: Record<number, number>;
  totaisExAnt: Record<number, number>;
  idsExAnt: number[];
  ano: string;
}

// ─── Tooltips padrão dark ─────────────────────────────────────────────────────

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

function DarkTooltipBar({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0F2A4E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px 16px', fontSize: '11px', boxShadow: '0 8px 32px rgba(0,0,0,0.32)', minWidth: '200px' }}>
      <div style={{ fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: i < payload.length - 1 ? '4px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.fill || p.color || p.stroke }} />
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>{p.name}</span>
          </div>
          <span style={{ fontWeight: 700, color: '#fff' }}>{fmtBRL(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

function DarkTooltipLine({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const val = Number(p.value);
  const isPercent = p.dataKey === 'perc';
  return (
    <div style={{ background: '#0F2A4E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px 16px', fontSize: '11px', boxShadow: '0 8px 32px rgba(0,0,0,0.32)', minWidth: '180px' }}>
      <div style={{ fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '2px', background: p.stroke || p.color, borderRadius: '1px' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{isPercent ? 'Crescimento' : p.name}</span>
        </div>
        <span style={{ fontWeight: 700, color: p.stroke || p.color }}>
          {isPercent ? `${val > 0 ? '+' : ''}${val.toFixed(2)}%` : fmtBRL(val)}
        </span>
      </div>
    </div>
  );
}

function DarkTooltipPie({ active, payload, totalPie }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const pct = totalPie > 0 ? ((d.value / totalPie) * 100).toFixed(1) : '0.0';
  return (
    <div style={{ background: '#0F2A4E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px 16px', fontSize: '11px', boxShadow: '0 8px 32px rgba(0,0,0,0.32)', minWidth: '180px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.payload?.color || d.payload?.fill }} />
        <span style={{ fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '10px' }}>{d.name}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Valor</span>
        <span style={{ fontWeight: 700, color: '#fff' }}>{fmtBRL(d.value)}</span>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '6px', paddingTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Participação</span>
        <span style={{ fontWeight: 700, color: '#C9A84C' }}>{pct}%</span>
      </div>
    </div>
  );
}

function DarkTooltipSetor({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const row = d.payload;
  return (
    <div style={{ background: '#0F2A4E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px 16px', fontSize: '11px', boxShadow: '0 8px 32px rgba(0,0,0,0.32)', minWidth: '200px' }}>
      <div style={{ fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{row.nome || d.payload?.fullName || d.payload?.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.color || d.fill }} />
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Total Bruto</span>
        </div>
        <span style={{ fontWeight: 700, color: '#fff' }}>{fmtBRL(Number(d.value))}</span>
      </div>
      {row.pct !== undefined && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '6px', paddingTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Participação</span>
          <span style={{ fontWeight: 700, color: '#C9A84C' }}>{row.pct.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

// ─── InfoPopover global ───────────────────────────────────────────────────────

function InfoPopover({ insights }: { insights: React.ReactNode }) {
  const [aberto, setAberto] = React.useState(false);
  const [fixado, setFixado] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!fixado) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false); setFixado(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [fixado]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onMouseEnter={() => { if (!fixado) setAberto(true); }}
        onMouseLeave={() => { if (!fixado) setAberto(false); }}
        onClick={() => { setFixado(f => !f); setAberto(a => !a); }}
        title="Como analisar este gráfico"
        style={{
          width: '22px', height: '22px', borderRadius: '50%',
          background: aberto ? '#C9A84C' : 'rgba(255,255,255,0.15)',
          border: '1.5px solid rgba(255,255,255,0.35)',
          color: '#fff', fontSize: '11px', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s', flexShrink: 0,
        }}
      >?</button>
      {aberto && (
        <div style={{
          position: 'absolute', top: '30px', right: 0, zIndex: 50,
          width: '300px', background: '#fff',
          borderRadius: '12px', boxShadow: '0 8px 32px rgba(15,42,78,0.18)',
          border: '1px solid #e2e8f0', overflow: 'hidden',
        }}>
          <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>Como analisar</span>
            {fixado && (
              <button onClick={() => { setAberto(false); setFixado(false); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}>×</button>
            )}
          </div>
          <div style={{ padding: '12px 14px', fontSize: '11px', color: '#334155', lineHeight: 1.6 }}>
            {insights}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function TabDespesaAnalitica({ token, entidadeId, municipioId }: { token: string | undefined; entidadeId?: number; municipioId?: number }) {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const anos = Array.from({ length: 5 }, (_, i) => anoAtual - i);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [fEntidade, setFEntidade]   = useState('');
  const [fSecretaria, setFSecretaria] = useState('');
  const [fSetor, setFSetor]         = useState('');
  const [fBloco, setFBloco]         = useState('');
  const [fFonte, setFFonte]         = useState('');
  const [fGrupo, setFGrupo]         = useState('');
  const [fSubgrupo, setFSubgrupo]   = useState('');
  const [procPage, setProcPage]     = useState(1);
  const [sortBy,   setSortBy]       = useState('data_pagamento');
  const [sortDir,  setSortDir]      = useState<'asc'|'desc'>('desc');
  const PROC_LIMIT = 20;

  function toggleSort(col: string) {
    if (sortBy === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortBy(col); setSortDir('desc'); }
    setProcPage(1);
  }

  const { data: filtrosDisp } = useQuery<{
    entidades:   { id: number; nome: string }[];
    secretarias: { id: number; nome: string; sigla?: string }[];
    setores:     { id: number; descricao: string }[];
    blocos:      { id: number; descricao: string }[];
    fontes:      string[];
    grupos:      { id: number; nome: string }[];
    subgrupos:   { id: number; nome: string; fk_grupo: number }[];
  }>({
    queryKey: ['sintetica-filtros', ano],
    queryFn: () => apiRequest(`/pagamentos/sintetica-filtros?ano=${ano}`, { token }),
    enabled: !!token,
  });

  const { data, isLoading } = useQuery<AnaliticaData>({
    queryKey: ['analitica-mensal', ano, fEntidade, fSecretaria, fSetor, fBloco, fFonte, fGrupo, fSubgrupo],
    queryFn: () => {
      const p = new URLSearchParams({ ano: String(ano) });
      if (fEntidade)   p.set('entidadeId', fEntidade);
      if (fSecretaria) p.set('secretariaId', fSecretaria);
      if (fSetor)      p.set('setorId', fSetor);
      if (fBloco)      p.set('blocoId', fBloco);
      if (fFonte)      p.set('fonteRecurso', fFonte);
      if (fGrupo)      p.set('grupoId', fGrupo);
      if (fSubgrupo)   p.set('subgrupoId', fSubgrupo);
      return apiRequest(`/pagamentos/analitica-mensal?${p}`, { token });
    },
    enabled: !!token,
  });

  // reset paginação e recolhe matriz ao mudar filtros
  useEffect(() => {
    setProcPage(1);
    setExpandidos(new Set());
  }, [ano, fEntidade, fSecretaria, fSetor, fBloco, fFonte, fGrupo, fSubgrupo]);

  const { data: processos, isLoading: loadingProc } = useQuery<{
    rows: {
      id: number; tipo_relatorio: string | null; num_processo: string | null;
      num_empenho: string | null; reduzido: string | null;
      data_pagamento: string; credor_nome: string; historico: string | null;
      setor_nome: string | null; grupo_pag_nome: string | null; subgrupo_pag_nome: string | null;
      grupo_nome: string | null; subgrupo_nome: string | null;
      fonte_recurso: string | null; valor_bruto: number;
    }[];
    total: number; page: number; limit: number;
  }>({
    queryKey: ['analitica-processos', ano, fEntidade, fSecretaria, fSetor, fBloco, fFonte, fGrupo, fSubgrupo, procPage, sortBy, sortDir],
    queryFn: () => {
      const p = new URLSearchParams({ ano: String(ano) });
      if (fEntidade)   p.set('entidadeId', fEntidade);
      if (fSecretaria) p.set('secretariaId', fSecretaria);
      if (fSetor)      p.set('setorId', fSetor);
      if (fBloco)      p.set('blocoId', fBloco);
      if (fFonte)      p.set('fonteRecurso', fFonte);
      if (fGrupo)      p.set('grupoId', fGrupo);
      if (fSubgrupo)   p.set('subgrupoId', fSubgrupo);
      p.set('page', String(procPage));
      p.set('limit', String(PROC_LIMIT));
      p.set('sortBy', sortBy);
      p.set('sortDir', sortDir);
      return apiRequest(`/pagamentos?${p}`, { token });
    },
    enabled: !!token,
  });

  // Quando os dados chegam, expande todos os grupos do resultado atual
  useEffect(() => {
    if (data?.grupos) {
      setExpandidos(new Set(data.grupos.map(g => g.id)));
    }
  }, [data]);

  function toggleGrupo(id: number) {
    setExpandidos(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function expandirTodos() {
    if (data) setExpandidos(new Set(data.grupos.map(g => g.id)));
  }
  function recolherTodos() { setExpandidos(new Set()); }

  // Soma de um grupo por mês
  function somaGrupoMes(gId: number, mes: number): number {
    const subs = data?.matrix[gId] ?? {};
    return Object.values(subs).reduce((acc, meses) => acc + (meses[mes] ?? 0), 0);
  }
  // Soma total de um grupo
  function somaGrupoTotal(gId: number): number {
    const subs = data?.matrix[gId] ?? {};
    return Object.values(subs).reduce((acc, meses) =>
      acc + Object.values(meses).reduce((a, v) => a + v, 0), 0);
  }
  // Soma de um subgrupo por mês
  function somaSubMes(gId: number, sId: number, mes: number): number {
    return data?.matrix[gId]?.[sId]?.[mes] ?? 0;
  }
  // Soma total de um subgrupo
  function somaSubTotal(gId: number, sId: number): number {
    const meses = data?.matrix[gId]?.[sId] ?? {};
    return Object.values(meses).reduce((a, v) => a + v, 0);
  }
  // Média mensal (só meses com valor)
  function media(totais: number[]): number {
    const comValor = totais.filter(v => v > 0);
    return comValor.length ? totais.reduce((a, b) => a + b, 0) / comValor.length : 0;
  }

  const gruposComDados = (data?.grupos ?? [])
    .filter(g => somaGrupoTotal(g.id) > 0)
    .sort((a, b) => {
      const aExAnt = [22, 23].includes(a.id);
      const bExAnt = [22, 23].includes(b.id);
      if (aExAnt && !bExAnt) return 1;   // ExAnt vai pro final
      if (!aExAnt && bExAnt) return -1;
      if (aExAnt && bExAnt) return 0;    // entre si mantém ordem
      return somaGrupoTotal(b.id) - somaGrupoTotal(a.id); // normais: maior primeiro
    });

  const TH: React.CSSProperties = {
    padding: '9px 6px', textAlign: 'center', color: '#e2e8f0',
    fontWeight: 600, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase',
  };

  return (
    <div className="p-3 md:p-6 space-y-4" style={{ background: '#fff', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#1e4d95,#0F2A4E)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart2 size={18} color="#C9A84C" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F2A4E', margin: 0 }}>Despesa Analítica</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Detalhado por grupo e subgrupo — competência {ano}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={expandirTodos}
            style={{ fontSize: '12px', color: '#0F2A4E', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontWeight: 500 }}>
            Expandir todos
          </button>
          <button onClick={recolherTodos}
            style={{ fontSize: '12px', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontWeight: 500 }}>
            Recolher todos
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ background: '#f8faff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '10px 14px', display: 'flex', flexWrap: 'nowrap', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Filtros:</span>
        <div style={{ position: 'relative', width: '82px', flexShrink: 0 }}>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            style={{ appearance: 'none', width: '100%', padding: '6px 22px 6px 8px', fontSize: '12px', color: '#0F2A4E', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '7px', cursor: 'pointer' }}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <ChevronDown size={11} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
        </div>
        <div style={{ width: '1px', height: '18px', background: '#e2e8f0', flexShrink: 0 }} />
        {[
          { label: 'Entidade', val: fEntidade, set: (v: string) => { setFEntidade(v); setFSecretaria(''); setFSetor(''); }, opts: (filtrosDisp?.entidades || []).map(e => ({ id: String(e.id), nome: e.nome })) },
          { label: 'Secretaria', val: fSecretaria, set: (v: string) => { setFSecretaria(v); setFSetor(''); }, opts: (filtrosDisp?.secretarias || []).map(s => ({ id: String(s.id), nome: (s.sigla ? `${s.sigla} — ` : '') + s.nome })) },
          { label: 'Setor', val: fSetor, set: setFSetor, opts: (filtrosDisp?.setores || []).map(s => ({ id: String(s.id), nome: s.descricao })) },
          { label: 'Grupo', val: fGrupo, set: (v: string) => { setFGrupo(v); setFSubgrupo(''); }, opts: (filtrosDisp?.grupos || []).map(g => ({ id: String(g.id), nome: g.nome })) },
          { label: 'Subgrupo', val: fSubgrupo, set: setFSubgrupo, opts: (filtrosDisp?.subgrupos || []).filter(s => !fGrupo || String(s.fk_grupo) === fGrupo).map(s => ({ id: String(s.id), nome: s.nome })) },
          { label: 'Bloco', val: fBloco, set: setFBloco, opts: (filtrosDisp?.blocos || []).map(b => ({ id: String(b.id), nome: b.descricao })) },
          { label: 'Fonte', val: fFonte, set: setFFonte, opts: (filtrosDisp?.fontes || []).map(f => ({ id: f, nome: f })) },
        ].map(({ label, val, set, opts }) => (
          <div key={label} style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
            <select value={val} onChange={e => set(e.target.value)}
              style={{ appearance: 'none', width: '100%', padding: '6px 22px 6px 8px', fontSize: '12px', color: val ? '#0F2A4E' : '#94a3b8', background: '#fff', border: `1.5px solid ${val ? '#3b82f6' : '#e2e8f0'}`, borderRadius: '7px', cursor: 'pointer' }}>
              <option value="">{label}</option>
              {opts.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
            <ChevronDown size={11} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          </div>
        ))}
        {(fEntidade || fSecretaria || fSetor || fBloco || fFonte || fGrupo || fSubgrupo) && (
          <button onClick={() => { setFEntidade(''); setFSecretaria(''); setFSetor(''); setFBloco(''); setFFonte(''); setFGrupo(''); setFSubgrupo(''); }}
            style={{ fontSize: '11px', color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
            ✕ Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '10px', color: '#94a3b8' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '13px' }}>Carregando dados...</span>
          </div>
        ) : gruposComDados.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '8px', color: '#94a3b8' }}>
            <Layers2 size={32} style={{ opacity: 0.3 }} />
            <span style={{ fontSize: '13px' }}>Nenhum dado para os filtros selecionados</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '220px' }} />
                {MESES.map((_, i) => <col key={i} style={{ width: '62px' }} />)}
                <col style={{ width: '90px' }} />
                <col style={{ width: '78px' }} />
              </colgroup>
              <thead>
                <tr style={{ background: '#0F2A4E' }}>
                  <th style={{ ...TH, textAlign: 'center', padding: '9px 14px' }}>Descrição</th>
                  {MESES.map((m, i) => <th key={i} style={TH}>{m}</th>)}
                  <th style={{ ...TH, color: '#fde68a', borderLeft: '1px solid rgba(255,255,255,0.12)' }}>Total</th>
                  <th style={{ ...TH, color: '#fde68a' }}>Média</th>
                </tr>
              </thead>
              <tbody>
                {/* TOTAL GERAL */}
                {!isLoading && (() => {
                  const totaisMes = data?.totaisMes ?? {};
                  const totalGeral = Object.values(totaisMes).reduce((a: number, b: number) => a + b, 0);
                  const mesesTotal = MESES.map((_, i) => (totaisMes as Record<number,number>)[i+1] || 0);
                  const mediaGeral = mesesTotal.filter(v => v > 0).length ? totalGeral / mesesTotal.filter(v => v > 0).length : 0;
                  return (
                    <tr style={{ background: '#dbeafe', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '9px 14px', color: '#1e3a5f', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', whiteSpace: 'nowrap', textAlign: 'center' }}>TOTAL GERAL DA DESPESA</td>
                      {mesesTotal.map((v, i) => (
                        <td key={i} style={{ padding: '9px 6px', textAlign: 'right', color: v > 0 ? '#1e3a5f' : '#bfdbfe', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(v)}</td>
                      ))}
                      <td style={{ padding: '9px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderLeft: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{fmt(totalGeral)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(mediaGeral)}</td>
                    </tr>
                  );
                })()}

                {/* MESMO EXERCÍCIO */}
                {!isLoading && (() => {
                  const totaisMes = data?.totaisMes ?? {};
                  const totaisExAnt = data?.totaisExAnt ?? {};
                  const mesesME = MESES.map((_, i) => ((totaisMes as Record<number,number>)[i+1] || 0) - ((totaisExAnt as Record<number,number>)[i+1] || 0));
                  const totalME = mesesME.reduce((a, b) => a + b, 0);
                  const mediaME = mesesME.filter(v => v > 0).length ? totalME / mesesME.filter(v => v > 0).length : 0;
                  return (
                    <tr style={{ background: '#eff6ff', borderBottom: '2px solid #bfdbfe' }}>
                      <td style={{ padding: '9px 14px', color: '#1e4d95', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', whiteSpace: 'nowrap', textAlign: 'center' }}>MESMO EXERCÍCIO</td>
                      {mesesME.map((v, i) => (
                        <td key={i} style={{ padding: '9px 6px', textAlign: 'right', color: v > 0 ? '#1e3a5f' : '#bfdbfe', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(v)}</td>
                      ))}
                      <td style={{ padding: '9px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderLeft: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>{fmt(totalME)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(mediaME)}</td>
                    </tr>
                  );
                })()}

                {gruposComDados.map((grupo, gi) => {
                  const isExAnt = [22, 23].includes(grupo.id);
                  const isPrimeiroExAnt = isExAnt && !gruposComDados.slice(0, gi).some(g => [22, 23].includes(g.id));
                  const isExpanded = expandidos.has(grupo.id);
                  const grupoMeses = MESES.map((_, i) => somaGrupoMes(grupo.id, i + 1));
                  const grupoTotal = grupoMeses.reduce((a, b) => a + b, 0);
                  const grupoMedia = media(grupoMeses);
                  const cor = GROUP_COLORS[gi % GROUP_COLORS.length];

                  // Subgrupos desse grupo com dados — ordenados do maior para o menor
                  const subsComDados = (data?.subgrupos ?? [])
                    .filter(s => s.fk_grupo === grupo.id && somaSubTotal(grupo.id, s.id) > 0)
                    .sort((a, b) => somaSubTotal(grupo.id, b.id) - somaSubTotal(grupo.id, a.id));
                  const temSemSub = somaSubTotal(grupo.id, 0) > 0;

                  const totaisExAnt = data?.totaisExAnt ?? {};
                  const totalEA = Object.values(totaisExAnt).reduce((a: number, b: number) => a + b, 0);
                  const mesesEA = MESES.map((_, i) => (totaisExAnt as Record<number,number>)[i+1] || 0);
                  const mediaEA = mesesEA.filter(v => v > 0).length ? totalEA / mesesEA.filter(v => v > 0).length : 0;

                  return (
                    <React.Fragment key={grupo.id}>
                      {/* Totalizador OUTROS EXERCÍCIOS antes do primeiro grupo DEA/RP */}
                      {isPrimeiroExAnt && totalEA > 0 && (
                        <tr style={{ background: '#dbeafe', borderTop: '2px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '9px 14px', color: '#1e3a5f', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', whiteSpace: 'nowrap', textAlign: 'center' }}>OUTROS EXERCÍCIOS</td>
                          {mesesEA.map((v, i) => (
                            <td key={i} style={{ padding: '9px 6px', textAlign: 'right', color: v > 0 ? '#1e3a5f' : '#bfdbfe', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(v)}</td>
                          ))}
                          <td style={{ padding: '9px 8px', textAlign: 'right', color: '#1e3a5f', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderLeft: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>{fmt(totalEA)}</td>
                          <td style={{ padding: '9px 8px', textAlign: 'right', color: '#1e3a5f', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(mediaEA)}</td>
                        </tr>
                      )}
                      {/* Linha do Grupo (pai) */}
                      <tr
                        onClick={() => toggleGrupo(grupo.id)}
                        style={{ cursor: 'pointer', background: '#f8faff', borderTop: `3px solid #e2e8f0`, borderBottom: '1px solid #e2e8f0', transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#f8faff')}
                      >
                        <td style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '18px', height: '18px', borderRadius: '5px', display: 'inline-flex',
                            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            background: '#1e4d95', transition: 'transform 0.18s',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          }}>
                            <ChevronRight size={12} color="#fff" />
                          </span>
                          <span style={{ fontWeight: 700, color: '#0F2A4E', fontSize: '11px', lineHeight: 1.3 }}>{grupo.nome}</span>
                          {(subsComDados.length > 0 || temSemSub) && (
                            <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '2px' }}>
                              ({subsComDados.length + (temSemSub ? 1 : 0)})
                            </span>
                          )}
                        </td>
                        {grupoMeses.map((v, i) => (
                          <td key={i} style={{ padding: '10px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: v > 0 ? '#0f172a' : '#cbd5e1', whiteSpace: 'nowrap' }}>
                            {fmt(v)}
                          </td>
                        ))}
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#C9A84C', borderLeft: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                          {fmt(grupoTotal)}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#7c3aed', whiteSpace: 'nowrap' }}>
                          {fmt(grupoMedia)}
                        </td>
                      </tr>

                      {/* Linhas dos Subgrupos (filhos) */}
                      {isExpanded && (
                        <>
                          {subsComDados.map(sub => {
                            const subMeses = MESES.map((_, i) => somaSubMes(grupo.id, sub.id, i + 1));
                            const subTotal = subMeses.reduce((a, b) => a + b, 0);
                            const subMedia = media(subMeses);
                            return (
                              <tr key={sub.id} style={{ background: '#fff', borderBottom: '1px solid #f0f4fb' }}>
                                <td style={{ padding: '8px 14px 8px 42px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '3px', height: '14px', borderRadius: '2px', background: cor, opacity: 0.5, flexShrink: 0 }} />
                                    <span style={{ color: '#334155', fontSize: '11px' }}>{sub.nome}</span>
                                  </div>
                                </td>
                                {subMeses.map((v, i) => (
                                  <td key={i} style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: v > 0 ? '#475569' : '#e2e8f0', whiteSpace: 'nowrap' }}>
                                    {fmt(v)}
                                  </td>
                                ))}
                                <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#C9A84C', borderLeft: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                                  {fmt(subTotal)}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#7c3aed', whiteSpace: 'nowrap' }}>
                                  {fmt(subMedia)}
                                </td>
                              </tr>
                            );
                          })}
                          {/* Subgrupo "Sem subgrupo" */}
                          {temSemSub && (() => {
                            const semMeses = MESES.map((_, i) => somaSubMes(grupo.id, 0, i + 1));
                            const semTotal = semMeses.reduce((a, b) => a + b, 0);
                            const semMedia = media(semMeses);
                            return (
                              <tr style={{ background: '#fffbeb', borderBottom: '1px solid #fef3c7' }}>
                                <td style={{ padding: '8px 14px 8px 42px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '3px', height: '14px', borderRadius: '2px', background: '#f59e0b', opacity: 0.5, flexShrink: 0 }} />
                                    <span style={{ color: '#92400e', fontSize: '11px', fontStyle: 'italic' }}>Sem subgrupo</span>
                                  </div>
                                </td>
                                {semMeses.map((v, i) => (
                                  <td key={i} style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: v > 0 ? '#92400e' : '#e2e8f0', whiteSpace: 'nowrap' }}>
                                    {fmt(v)}
                                  </td>
                                ))}
                                <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#C9A84C', borderLeft: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                                  {fmt(semTotal)}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#7c3aed', whiteSpace: 'nowrap' }}>
                                  {fmt(semMedia)}
                                </td>
                              </tr>
                            );
                          })()}
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── HEATMAP + WATERFALL ─────────────────────────────────────────── */}
      <div style={{ marginTop: '24px' }}>
      {!isLoading && gruposComDados.length > 0 && (() => {
        const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const fmtBRL     = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
        const fmtHeat    = (v: number) => Math.round(v).toLocaleString('pt-BR'); // sem R$, sem decimais — cabe na célula

        // ── dados heatmap ──
        const heatRows = gruposComDados.map(g => ({
          nome: g.nome.length > 22 ? g.nome.slice(0, 22) + '…' : g.nome,
          nomeCompleto: g.nome,
          meses: MESES_LABEL.map((_, i) => somaGrupoMes(g.id, i + 1)),
        }));
        const allVals = heatRows.flatMap(r => r.meses).filter(v => v > 0);
        const maxHeat = allVals.length ? Math.max(...allVals) : 1;

        // semáforo pastel: verde claro → amarelo claro → vermelho claro
        function heatColor(v: number): string {
          if (v === 0) return '#f8fafc';
          const t = Math.pow(v / maxHeat, 0.6); // 0..1
          if (t < 0.5) {
            // verde→amarelo: #dcfce7 → #fef9c3
            const tt = t / 0.5;
            const r = Math.round(220 + (254 - 220) * tt);
            const g = Math.round(252 + (249 - 252) * tt);
            const b = Math.round(231 + (195 - 231) * tt);
            return `rgb(${r},${g},${b})`;
          } else {
            // amarelo→vermelho: #fef9c3 → #fecaca
            const tt = (t - 0.5) / 0.5;
            const r = Math.round(254 + (254 - 254) * tt);
            const g = Math.round(249 + (202 - 249) * tt);
            const b = Math.round(195 + (202 - 195) * tt);
            return `rgb(${r},${g},${b})`;
          }
        }
        // texto sempre escuro — fundo nunca fica tão escuro a ponto de precisar de branco
        function textColor(_v: number): string { return '#1e293b'; }

        // ── dados waterfall ──
        const totalGeral = gruposComDados.reduce((s, g) => s + somaGrupoTotal(g.id), 0);
        const topGrupos = [...gruposComDados].sort((a,b) => somaGrupoTotal(b.id) - somaGrupoTotal(a.id)).slice(0, 8);
        let runningTotal = totalGeral;
        const waterfallData = topGrupos.map((g, i) => {
          const val = somaGrupoTotal(g.id);
          const start = runningTotal - val;
          runningTotal = start;
          return {
            nome: g.nome.length > 28 ? g.nome.slice(0, 28) + '…' : g.nome,
            nomeCompleto: g.nome,
            valor: val,
            start,
            pct: totalGeral > 0 ? (val / totalGeral) * 100 : 0,
            color: i === 0 ? '#C9A84C' : i === 1 ? '#1e4d95' : i === 2 ? '#2563eb' : '#64748b',
          };
        });

        // ── insights dinâmicos heatmap ──
        const grupoMaisHeavy = gruposComDados.reduce((a, b) => somaGrupoTotal(a.id) > somaGrupoTotal(b.id) ? a : b);
        const mesPicoIdx = MESES_LABEL.map((_, i) => allVals.length
          ? heatRows.reduce((s, r) => s + r.meses[i], 0) : 0).indexOf(
          Math.max(...MESES_LABEL.map((_, i) => heatRows.reduce((s, r) => s + r.meses[i], 0)))
        );
        const mesPicoValor = heatRows.reduce((s, r) => s + r.meses[mesPicoIdx], 0);
        const mesesComDados = MESES_LABEL.filter((_, i) => heatRows.some(r => r.meses[i] > 0)).length;

        // ── insights dinâmicos waterfall ──
        const top3Pct = waterfallData.slice(0, 3).reduce((s, d) => s + d.pct, 0);
        const cobertoTotal = waterfallData.reduce((s, d) => s + d.valor, 0);
        const pctCoberto = totalGeral > 0 ? (cobertoTotal / totalGeral) * 100 : 0;
        const concentrado = top3Pct > 70;

        // ── componente popover ──
        function InfoPopover({ insights }: { insights: React.ReactNode }) {
          const [aberto, setAberto] = React.useState(false);
          const [fixado, setFixado] = React.useState(false);
          const ref = React.useRef<HTMLDivElement>(null);

          React.useEffect(() => {
            if (!fixado) return;
            function handler(e: MouseEvent) {
              if (ref.current && !ref.current.contains(e.target as Node)) {
                setAberto(false);
                setFixado(false);
              }
            }
            document.addEventListener('mousedown', handler);
            return () => document.removeEventListener('mousedown', handler);
          }, [fixado]);

          return (
            <div ref={ref} style={{ position: 'relative' }}>
              <button
                onMouseEnter={() => { if (!fixado) setAberto(true); }}
                onMouseLeave={() => { if (!fixado) setAberto(false); }}
                onClick={() => { setFixado(f => !f); setAberto(a => !a); }}
                title="Como analisar este gráfico"
                style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: aberto ? '#C9A84C' : 'rgba(255,255,255,0.15)',
                  border: '1.5px solid rgba(255,255,255,0.35)',
                  color: '#fff', fontSize: '11px', fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}
              >?</button>
              {aberto && (
                <div style={{
                  position: 'absolute', top: '30px', right: 0, zIndex: 50,
                  width: '300px', background: '#fff',
                  borderRadius: '12px', boxShadow: '0 8px 32px rgba(15,42,78,0.18)',
                  border: '1px solid #e2e8f0', overflow: 'hidden',
                }}>
                  <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>Como analisar</span>
                    {fixado && (
                      <button onClick={() => { setAberto(false); setFixado(false); }}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}>×</button>
                    )}
                  </div>
                  <div style={{ padding: '12px 14px', fontSize: '11px', color: '#334155', lineHeight: 1.6 }}>
                    {insights}
                  </div>
                </div>
              )}
            </div>
          );
        }

        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>

            {/* ── HEATMAP ── */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ background: 'linear-gradient(135deg, #0F2A4E 0%, #1e4d95 100%)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>Mapa de Calor</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Intensidade de gasto — Grupo × Mês</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '60px', height: '6px', borderRadius: '3px', background: 'linear-gradient(90deg, #dcfce7, #fef9c3 50%, #fecaca)' }} />
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>baixo → alto</span>
                  </div>
                  <InfoPopover insights={
                    <div>
                      <p style={{ marginBottom: '8px', color: '#475569' }}>
                        Células vermelhas indicam maior concentração de gasto; verdes, menor. Linhas vermelhas em meses consecutivos sugerem contratos contínuos ou folha de pagamento.
                      </p>
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#0F2A4E', marginBottom: '2px' }}>📊 Seus dados agora</span>
                        <span>• Grupo de maior gasto: <strong>{grupoMaisHeavy.nome}</strong> — {fmtBRL(somaGrupoTotal(grupoMaisHeavy.id))}</span>
                        <span>• Mês de pico: <strong>{MESES_LABEL[mesPicoIdx]}</strong> — {fmtBRL(mesPicoValor)}</span>
                        <span>• Meses com movimentação: <strong>{mesesComDados} de 12</strong></span>
                        {mesesComDados < 12 && (
                          <span style={{ color: '#f59e0b' }}>⚠️ Meses sem dados podem indicar exercício incompleto ou filtro aplicado.</span>
                        )}
                      </div>
                    </div>
                  } />
                </div>
              </div>
              <div style={{ padding: '16px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '3px' }}>
                  <thead>
                    <tr>
                      <td style={{ width: '130px' }} />
                      {MESES_LABEL.map(m => (
                        <td key={m} style={{ textAlign: 'center', fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', paddingBottom: '4px' }}>{m.toUpperCase()}</td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatRows.map((row, ri) => (
                      <tr key={ri}>
                        <td style={{ paddingRight: '8px', paddingBottom: '3px' }}>
                          <div title={row.nomeCompleto} style={{ fontSize: '10px', color: '#334155', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>
                            {row.nome}
                          </div>
                        </td>
                        {row.meses.map((v, mi) => (
                          <td key={mi} style={{ padding: '0' }}>
                            <div
                              title={v > 0 ? `${row.nomeCompleto} — ${MESES_LABEL[mi]}: ${fmtBRL(v)}` : '—'}
                              style={{
                                background: heatColor(v),
                                borderRadius: '5px',
                                height: '28px',
                                minWidth: '32px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '8px', fontWeight: 700,
                                color: textColor(v),
                                cursor: 'default',
                              }}
                            >
                              {v > 0 ? fmtHeat(v) : ''}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── WATERFALL ── */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ background: 'linear-gradient(135deg, #0F2A4E 0%, #1e4d95 100%)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>Cascata de Despesa</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Composição do total — do maior ao menor grupo</div>
                </div>
                <InfoPopover insights={
                  <div>
                    <p style={{ marginBottom: '8px', color: '#475569' }}>
                      Cada barra representa a fatia de um grupo no total geral. Quanto maior a barra, maior a participação. Grupos com mais de 50% merecem atenção especial do controle interno.
                    </p>
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#0F2A4E', marginBottom: '2px' }}>📊 Seus dados agora</span>
                      <span>• Total geral: <strong>{fmtBRL(totalGeral)}</strong></span>
                      <span>• Maior grupo: <strong>{waterfallData[0]?.nomeCompleto}</strong> ({waterfallData[0]?.pct.toFixed(1)}%)</span>
                      <span>• Top 3 grupos somam: <strong>{top3Pct.toFixed(1)}%</strong> do total</span>
                      <span>• Top {waterfallData.length} grupos cobrem: <strong>{pctCoberto.toFixed(1)}%</strong></span>
                      {concentrado && (
                        <span style={{ color: '#ef4444' }}>⚠️ Alta concentração: 3 grupos respondem por mais de 70% da despesa.</span>
                      )}
                    </div>
                  </div>
                } />
              </div>
              <div style={{ padding: '20px' }}>
                {/* Barra total no topo */}
                <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>TOTAL GERAL</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#C9A84C' }}>{fmtBRL(totalGeral)}</span>
                </div>
                {/* Cascata */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {waterfallData.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div title={item.nomeCompleto} style={{ width: '190px', flexShrink: 0, fontSize: '10px', color: '#475569', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.nome}
                      </div>
                      <div style={{ flex: 1, position: 'relative', height: '28px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${item.pct}%`,
                          background: `linear-gradient(90deg, ${item.color}dd, ${item.color})`,
                          borderRadius: '6px',
                          display: 'flex', alignItems: 'center', paddingLeft: '8px',
                          transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                        }}>
                          {item.pct > 18 && (
                            <span style={{ fontSize: '9px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                              {fmtBRL(item.valor)}
                            </span>
                          )}
                        </div>
                        {item.pct <= 18 && (
                          <span style={{ position: 'absolute', left: `${item.pct + 1}%`, top: '50%', transform: 'translateY(-50%)', fontSize: '9px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                            {fmtBRL(item.valor)}
                          </span>
                        )}
                      </div>
                      <div style={{ width: '42px', flexShrink: 0, textAlign: 'right', fontSize: '10px', fontWeight: 700, color: item.color }}>
                        {item.pct.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '14px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Top {waterfallData.length} grupos cobrem</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F2A4E' }}>{pctCoberto.toFixed(1)}% do total</span>
                </div>
              </div>
            </div>

          </div>
        );
      })()}
      </div>

      {/* Listagem de Processos */}
      {(() => {
        const totalProc = processos?.total ?? 0;
        const totalPages = Math.ceil(totalProc / PROC_LIMIT);
        const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';
        const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [histAberto, setHistAberto] = React.useState<number | null>(null);
        return (
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Processos de Pagamento</span>
              {!loadingProc && totalProc > 0 && (
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', padding: '3px 10px' }}>
                  {totalProc.toLocaleString('pt-BR')} registros
                </span>
              )}
            </div>

            {loadingProc ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '10px', color: '#94a3b8' }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '13px' }}>Carregando processos...</span>
              </div>
            ) : !processos?.rows?.length ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>
                Nenhum processo encontrado para os filtros selecionados
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        {([
                          ['Tipo',        'tipo_relatorio', false],
                          ['Data Pag.',   'data_pagamento', false],
                          ['Nº Processo', null,             false],
                          ['Nº Empenho',  'num_empenho',    false],
                          ['Credor',      'credor',         false],
                          ['Histórico',   null,             false],
                          ['Setor',       'setor',          false],
                          ['Grupo',       null,             false],
                          ['Subgrupo',    null,             false],
                          ['Fonte',       null,             false],
                          ['Vlr. Bruto',  'valor_bruto',    true],
                        ] as [string, string|null, boolean][]).map(([label, col, right]) => {
                          const ativo = col && sortBy === col;
                          return (
                            <th
                              key={label}
                              onClick={() => col && toggleSort(col)}
                              style={{
                                padding: '9px 10px',
                                textAlign: right ? 'right' : 'left',
                                color: ativo ? '#0F2A4E' : '#64748b',
                                fontWeight: ativo ? 700 : 600,
                                fontSize: '10px', letterSpacing: '0.04em',
                                textTransform: 'uppercase', whiteSpace: 'nowrap',
                                cursor: col ? 'pointer' : 'default',
                                userSelect: 'none',
                                background: ativo ? '#e8f0fe' : 'transparent',
                                transition: 'background 0.15s',
                              }}
                            >
                              {label}
                              {col && (
                                <span style={{ marginLeft: '4px', opacity: ativo ? 1 : 0.3, fontSize: '9px' }}>
                                  {ativo ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                                </span>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {processos.rows.map((row, i) => {
                        const tipo = row.tipo_relatorio ?? '—';
                        const tipoColor = tipo === 'RP' ? '#92400e' : tipo === 'DEA' ? '#5b21b6' : '#1e4d95';
                        const tipoBg   = tipo === 'RP' ? '#fef3c7' : tipo === 'DEA' ? '#ede9fe' : '#eff6ff';
                        const grupoNome    = row.grupo_pag_nome    ?? row.grupo_nome    ?? '—';
                        const subgrupoNome = row.subgrupo_pag_nome ?? row.subgrupo_nome ?? '—';
                        return (
                          <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
                            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa')}>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: tipoColor, background: tipoBg, borderRadius: '4px', padding: '2px 6px' }}>{tipo}</span>
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDate(row.data_pagamento)}</td>
                            <td style={{ padding: '8px 10px', color: '#0F2A4E', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.num_processo ?? '—'}</td>
                            <td style={{ padding: '8px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{row.num_empenho ?? '—'}</td>
                            <td style={{ padding: '8px 10px', color: '#334155', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.credor_nome}>{row.credor_nome}</td>
                            <td style={{ padding: '8px 10px', maxWidth: '200px' }}>
                              {row.historico ? (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                  <span style={{
                                    color: '#64748b', fontSize: '11px', lineHeight: 1.4,
                                    overflow: histAberto === row.id ? 'visible' : 'hidden',
                                    textOverflow: histAberto === row.id ? 'unset' : 'ellipsis',
                                    whiteSpace: histAberto === row.id ? 'normal' : 'nowrap',
                                    flex: 1,
                                  }}>{row.historico}</span>
                                  <button
                                    onClick={() => setHistAberto(histAberto === row.id ? null : row.id)}
                                    title={histAberto === row.id ? 'Recolher' : 'Ver histórico completo'}
                                    style={{
                                      flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                                      color: histAberto === row.id ? '#0F2A4E' : '#94a3b8',
                                      padding: '0 2px', fontSize: '12px', lineHeight: 1,
                                      transition: 'color 0.15s',
                                    }}
                                  >{histAberto === row.id ? '▲' : '▼'}</button>
                                </div>
                              ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.setor_nome ?? ''}>{row.setor_nome ?? '—'}</td>
                            <td style={{ padding: '8px 10px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={grupoNome}>
                              <span style={{ fontSize: '10px', color: '#1e4d95', background: '#eff6ff', borderRadius: '4px', padding: '2px 6px', fontWeight: 500 }}>{grupoNome}</span>
                            </td>
                            <td style={{ padding: '8px 10px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={subgrupoNome}>
                              <span style={{ fontSize: '10px', color: '#475569', background: '#f1f5f9', borderRadius: '4px', padding: '2px 6px' }}>{subgrupoNome}</span>
                            </td>
                            <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>{row.fonte_recurso ?? '—'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0F2A4E', fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(row.valor_bruto)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Página {procPage} de {totalPages} · {totalProc.toLocaleString('pt-BR')} registros
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => setProcPage(p => Math.max(1, p - 1))}
                        disabled={procPage === 1}
                        style={{ padding: '5px 12px', fontSize: '11px', borderRadius: '6px', border: '1px solid #e2e8f0', background: procPage === 1 ? '#f8fafc' : '#fff', color: procPage === 1 ? '#cbd5e1' : '#0F2A4E', cursor: procPage === 1 ? 'default' : 'pointer', fontWeight: 600 }}>
                        ← Anterior
                      </button>
                      <button
                        onClick={() => setProcPage(p => Math.min(totalPages, p + 1))}
                        disabled={procPage === totalPages}
                        style={{ padding: '5px 12px', fontSize: '11px', borderRadius: '6px', border: '1px solid #e2e8f0', background: procPage === totalPages ? '#f8fafc' : '#fff', color: procPage === totalPages ? '#cbd5e1' : '#0F2A4E', cursor: procPage === totalPages ? 'default' : 'pointer', fontWeight: 600 }}>
                        Próxima →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function TabEmConstrucao({ title }: { title: string }) {
  return (
    <div className="p-3 md:p-8">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-24 gap-5">
        <div className="w-16 h-16 rounded-2xl bg-navy-50 flex items-center justify-center">
          <BarChart2 size={32} className="text-navy-300" />
        </div>
        <div className="text-center">
          <h3 className="text-navy-800 font-semibold text-lg mb-1">{title}</h3>
          <p className="text-gray-400 text-sm flex items-center gap-1.5 justify-center">
            <Clock size={13} />
            Em breve — esta análise está sendo desenvolvida
          </p>
        </div>
        <div className="flex gap-1.5 mt-1">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-navy-200"
              style={{ opacity: 0.4 + i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Outros Exercícios ───────────────────────────────────────────────────

interface OutrosExerciciosProcesso {
  id: number;
  data_pagamento: string;
  num_empenho: string;
  historico: string | null;
  credor_nome: string;
  credor_doc: string | null;
  elemento_despesa: string;
  grupo_nome: string | null;
  subgrupo_nome: string | null;
  setor_nome: string | null;
  entidade_nome: string;
  fonte_recurso: string;
  valor_bruto: number;
  valor_retido: number;
  valor_liquido: number;
}

interface OutrosExerciciosData {
  grupos: { id: number; nome: string }[];
  subgrupos: { id: number; nome: string; fk_grupo: number }[];
  matrixMes: Record<number, Record<number, number>>;
  totaisMes: Record<number, number>;
  totalGeral: number;
  totalRP: number;
  totalDEA: number;
  porSubgrupo: { grupo_id: number; subgrupo_id: number | null; total: number }[];
  porCredor: { credor: string; grupo_id: number; total: number; qtd: number }[];
  porSetor: { setor: string; grupo_id: number; total: number }[];
  ano: string;
}

const MESES_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function TabOutrosExercicios({ token, entidadeId, municipioId }: { token: string | undefined; entidadeId?: number; municipioId?: number }) {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const anos = Array.from({ length: 5 }, (_, i) => anoAtual - i);
  const [fEntidade, setFEntidade]     = useState('');
  const [fSecretaria, setFSecretaria] = useState('');
  const [fSetor, setFSetor]           = useState('');
  const [fBloco, setFBloco]           = useState('');
  const [fFonte, setFFonte]           = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const [exportando, setExportando]   = useState(false);
  const [procPage, setProcPage]       = useState(1);
  const PROC_LIMIT = 20;

  const { data: filtrosDisp } = useQuery<{
    entidades: { id: number; nome: string }[];
    secretarias: { id: number; nome: string; sigla?: string }[];
    setores: { id: number; descricao: string }[];
    blocos: { id: number; descricao: string }[];
    fontes: string[];
  }>({
    queryKey: ['sintetica-filtros', ano],
    queryFn: () => apiRequest(`/pagamentos/sintetica-filtros?ano=${ano}`, { token }),
    enabled: !!token,
  });

  const params = new URLSearchParams({ ano: String(ano) });
  if (fEntidade)   params.set('entidadeId', fEntidade);
  if (fSecretaria) params.set('secretariaId', fSecretaria);
  if (fSetor)      params.set('setorId', fSetor);
  if (fBloco)      params.set('blocoId', fBloco);
  if (fFonte)      params.set('fonteRecurso', fFonte);

  const { data, isLoading } = useQuery<OutrosExerciciosData>({
    queryKey: ['outros-exercicios', ano, fEntidade, fSecretaria, fSetor, fBloco, fFonte],
    queryFn: () => apiRequest(`/pagamentos/outros-exercicios?${params}`, { token }),
    enabled: !!token,
  });

  // reset paginação ao mudar filtros
  useEffect(() => { setProcPage(1); }, [ano, fEntidade, fSecretaria, fSetor, fBloco, fFonte]);

  const procParams = new URLSearchParams(params);
  procParams.set('page', String(procPage));
  procParams.set('limit', String(PROC_LIMIT));

  const { data: processos, isLoading: loadingProc } = useQuery<{ rows: OutrosExerciciosProcesso[]; total: number; page: number; limit: number }>({
    queryKey: ['outros-exercicios-processos', ano, fEntidade, fSecretaria, fSetor, fBloco, fFonte, procPage],
    queryFn: () => apiRequest(`/pagamentos/outros-exercicios/processos?${procParams}`, { token }),
    enabled: !!token,
  });

  async function handleExportPDF() {
    if (!printRef.current) return;
    setExportando(true);
    try {
      const [{ default: html2canvas }, jspdfModule] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const jsPDF = (jspdfModule as any).jsPDF ?? (jspdfModule as any).default;
      const el = printRef.current;
      const pdfFiltersEl = el.querySelector<HTMLElement>('[data-pdf-filters]');
      if (pdfFiltersEl) pdfFiltersEl.style.display = 'block';
      const wrappers = el.querySelectorAll<HTMLElement>('div[style*="overflow"]');
      const prev: string[] = [];
      wrappers.forEach((e, i) => { prev[i] = e.style.overflow + '|' + e.style.overflowX; e.style.overflow = 'visible'; e.style.overflowX = 'visible'; });
      const prevW = el.style.width;
      el.style.width = Math.max(el.scrollWidth, 1300) + 'px';
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', width: el.scrollWidth, windowWidth: el.scrollWidth });
      el.style.width = prevW;
      if (pdfFiltersEl) pdfFiltersEl.style.display = 'none';
      wrappers.forEach((e, i) => { const [ov, ovx] = prev[i].split('|'); e.style.overflow = ov; e.style.overflowX = ovx; });
      const MARGIN = 8;
      // Página com tamanho exato do conteúdo — sem quebra de página
      const printW = 297 - MARGIN * 2;
      const scaledH = (canvas.height / 2) * (printW / (canvas.width / 2));
      const pageH = scaledH + MARGIN * 2;
      const pdf = new jsPDF({ unit: 'mm', format: [297, pageH], orientation: 'landscape' });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', MARGIN, MARGIN, printW, scaledH);
      pdf.save(`outros-exercicios-${ano}.pdf`);
    } finally { setExportando(false); }
  }

  const fmt = (v: number) => formatCurrency(v);
  const fmtK = (v: number) => v >= 1000000 ? `R$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v.toFixed(0)}`;
  const fmtPct = (a: number, b: number) => b > 0 ? `${((a/b)*100).toFixed(1)}%` : '—';

  // Dados para gráficos
  const totalGeral = data?.totalGeral ?? 0;
  const totalRP    = data?.totalRP ?? 0;
  const totalDEA   = data?.totalDEA ?? 0;

  // Evolução mensal por grupo — para ComposedChart
  const evolucaoData = MESES_SHORT.map((m, i) => ({
    mes: m,
    rp:  data?.matrixMes[22]?.[i + 1] ?? 0,
    dea: data?.matrixMes[23]?.[i + 1] ?? 0,
    total: (data?.matrixMes[22]?.[i + 1] ?? 0) + (data?.matrixMes[23]?.[i + 1] ?? 0),
  }));

  // Subgrupos com nome
  const subgruposMap = Object.fromEntries((data?.subgrupos ?? []).map(s => [s.id, s]));
  const porSubgrupoEnriquecido = (data?.porSubgrupo ?? []).map(s => ({
    ...s,
    nome: s.subgrupo_id ? (subgruposMap[s.subgrupo_id]?.nome ?? 'Sem subgrupo') : 'Sem subgrupo',
    grupo: s.grupo_id === 22 ? 'RP' : 'DEA',
  })).filter(s => s.total > 0);

  // Pie data por grupo
  const pieGrupo = [
    { name: 'Restos a Pagar', value: totalRP, fill: '#1e4d95' },
    { name: 'DEA', value: totalDEA, fill: '#C9A84C' },
  ].filter(d => d.value > 0);

  // Credores top 10
  const topCredores = data?.porCredor ?? [];

  const TH: React.CSSProperties = {
    padding: '9px 10px', textAlign: 'center' as const, color: '#e2e8f0',
    fontWeight: 700, fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase' as const,
  };

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '10px', color: '#94a3b8' }}>
      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '13px' }}>Carregando dados...</span>
    </div>
  );

  return (
    <div ref={printRef} className="p-3 md:p-6 space-y-5" style={{ background: '#f8fafc', minHeight: '100vh' }}>

      {/* ── HEADER ── */}
      <div style={{ background: 'linear-gradient(135deg, #0F2A4E 0%, #1a3a6b 60%, #0F2A4E 100%)', borderRadius: '16px', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 20px rgba(15,42,78,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={20} color="#C9A84C" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Outros Exercícios</h2>
            <p style={{ margin: 0, fontSize: '11px', color: '#93c5fd' }}>Restos a Pagar · Despesas do Exercício Anterior — {ano}</p>
          </div>
        </div>
        <button data-html2canvas-ignore="true" onClick={handleExportPDF} disabled={exportando}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, background: exportando ? 'rgba(255,255,255,0.1)' : 'rgba(201,168,76,0.2)', color: exportando ? '#94a3b8' : '#C9A84C', border: '1.5px solid rgba(201,168,76,0.35)', cursor: 'pointer' }}>
          {exportando ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileDown size={13} />}
          {exportando ? 'Gerando...' : 'Exportar PDF'}
        </button>
      </div>

      {/* Filtros estáticos PDF */}
      <div data-pdf-filters style={{ display: 'none', background: '#f8faff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '7px 12px', fontSize: '11px', color: '#475569' }}>
        <span style={{ fontWeight: 700, marginRight: '8px' }}>Filtros:</span>
        <span style={{ fontWeight: 600, color: '#0F2A4E' }}>Exercício {ano}</span>
        {fEntidade && filtrosDisp?.entidades.find(e => String(e.id) === fEntidade) && <span> · Entidade: <strong>{filtrosDisp.entidades.find(e => String(e.id) === fEntidade)?.nome}</strong></span>}
      </div>

      {/* Filtros interativos */}
      <div data-html2canvas-ignore="true" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '10px 14px', display: 'flex', flexWrap: 'nowrap', gap: '8px', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Filtros:</span>
        <div style={{ position: 'relative', width: '82px', flexShrink: 0 }}>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} style={{ appearance: 'none', width: '100%', padding: '6px 22px 6px 8px', fontSize: '12px', color: '#0F2A4E', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '7px', cursor: 'pointer' }}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <ChevronDown size={11} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
        </div>
        <div style={{ width: '1px', height: '18px', background: '#e2e8f0', flexShrink: 0 }} />
        {([
          { label: 'Entidade', val: fEntidade, set: (v: string) => { setFEntidade(v); setFSecretaria(''); setFSetor(''); }, opts: (filtrosDisp?.entidades || []).map(e => ({ id: String(e.id), nome: e.nome })) },
          { label: 'Secretaria', val: fSecretaria, set: (v: string) => { setFSecretaria(v); setFSetor(''); }, opts: (filtrosDisp?.secretarias || []).map(s => ({ id: String(s.id), nome: (s.sigla ? `${s.sigla} — ` : '') + s.nome })) },
          { label: 'Setor', val: fSetor, set: setFSetor, opts: (filtrosDisp?.setores || []).map(s => ({ id: String(s.id), nome: s.descricao })) },
          { label: 'Bloco', val: fBloco, set: setFBloco, opts: (filtrosDisp?.blocos || []).map(b => ({ id: String(b.id), nome: b.descricao })) },
          { label: 'Fonte', val: fFonte, set: setFFonte, opts: (filtrosDisp?.fontes || []).map(f => ({ id: f, nome: f })) },
        ] as { label: string; val: string; set: (v: string) => void; opts: { id: string; nome: string }[] }[]).map(({ label, val, set, opts }) => (
          <div key={label} style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
            <select value={val} onChange={e => set(e.target.value)} style={{ appearance: 'none', width: '100%', padding: '6px 22px 6px 8px', fontSize: '12px', color: val ? '#0F2A4E' : '#94a3b8', background: '#fff', border: `1.5px solid ${val ? '#3b82f6' : '#e2e8f0'}`, borderRadius: '7px', cursor: 'pointer' }}>
              <option value="">{label}</option>
              {opts.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
            <ChevronDown size={11} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          </div>
        ))}
        {(fEntidade || fSecretaria || fSetor || fBloco || fFonte) && (
          <button onClick={() => { setFEntidade(''); setFSecretaria(''); setFSetor(''); setFBloco(''); setFFonte(''); }} style={{ fontSize: '11px', color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>Limpar</button>
        )}
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Outros Exercícios', value: totalGeral, color: '#0F2A4E', bg: 'linear-gradient(135deg,#0F2A4E,#1e4d95)', icon: '⚖', sub: '100% do período' },
          { label: 'Restos a Pagar (RP)', value: totalRP, color: '#1e4d95', bg: 'linear-gradient(135deg,#1e4d95,#2563eb)', icon: '📋', sub: fmtPct(totalRP, totalGeral) + ' do total' },
          { label: 'Desp. Exercício Anterior (DEA)', value: totalDEA, color: '#C9A84C', bg: 'linear-gradient(135deg,#92720a,#C9A84C)', icon: '🗂', sub: fmtPct(totalDEA, totalGeral) + ' do total' },
        ].map((card, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 22px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: card.bg, borderRadius: '14px 14px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: '0 0 6px 0', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{card.label}</p>
                <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: card.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmt(card.value)}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#94a3b8' }}>{card.sub}</p>
              </div>
              <span style={{ fontSize: '24px', opacity: 0.15 }}>{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── GRÁFICOS LINHA 1: ComposedChart + Pie ── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-4">
        {/* ComposedChart — Evolução RP vs DEA */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ background: 'linear-gradient(135deg, #0F2A4E 0%, #1a3a6b 60%, #0F2A4E 100%)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Evolução Mensal — RP vs DEA</h3>
            <div style={{ display: 'flex', gap: '12px', fontSize: '10px', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#93c5fd' }}><span style={{ width: '10px', height: '10px', background: '#1e4d95', borderRadius: '2px', display: 'inline-block' }} />RP</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fde68a' }}><span style={{ width: '10px', height: '10px', background: '#C9A84C', borderRadius: '2px', display: 'inline-block' }} />DEA</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fca5a5' }}><span style={{ width: '20px', height: '2px', background: '#ef4444', display: 'inline-block' }} />Total</span>
              <InfoPopover insights={<><strong>Evolução RP vs DEA</strong><br /><strong>RP (Restos a Pagar):</strong> valores empenhados em anos anteriores que estão sendo pagos agora.<br /><br /><strong>DEA (Despesas de Exercícios Anteriores):</strong> despesas reconhecidas fora do exercício de competência.<br /><br />⚠️ Volume elevado de RP pode indicar dificuldades de caixa no ano anterior. DEA elevado pode sinalizar irregularidades contábeis.</>} />
            </div>
          </div>
          <div style={{ padding: '16px 20px' }}>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={evolucaoData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradRP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e4d95" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#1e4d95" stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="gradDEA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#C9A84C" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<DarkTooltipBar />} />
              <Bar dataKey="rp" fill="url(#gradRP)" radius={[3, 3, 0, 0]} barSize={18} />
              <Bar dataKey="dea" fill="url(#gradDEA)" radius={[3, 3, 0, 0]} barSize={18} />
              <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3, strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Pie — participação RP vs DEA */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ background: 'linear-gradient(135deg, #0F2A4E 0%, #1a3a6b 60%, #0F2A4E 100%)', padding: '12px 16px' }}>
            <h3 style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Participação (%)</h3>
          </div>
          <div style={{ padding: '16px 20px' }}>
          {pieGrupo.length === 0 ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieGrupo} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {pieGrupo.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip content={(props: any) => <DarkTooltipPie {...props} totalPie={pieGrupo.reduce((a: number, d: any) => a + d.value, 0)} />} />
                <Legend iconType="square" iconSize={8} formatter={(v) => <span style={{ fontSize: '10px', color: '#475569' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
          {/* Resumo textual */}
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[{ label: 'RP', value: totalRP, color: '#1e4d95' }, { label: 'DEA', value: totalDEA, color: '#C9A84C' }].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: item.color }}>{item.label}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F2A4E', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.value)}</span>
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>

      {/* ── GRÁFICOS LINHA 2: Subgrupos + Setores ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top subgrupos */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ background: 'linear-gradient(135deg, #0F2A4E 0%, #1a3a6b 60%, #0F2A4E 100%)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top Subgrupos</h3>
            <InfoPopover insights={<><strong>Top Subgrupos — Outros Exercícios</strong><br />Ranking dos subgrupos de despesa com maior volume de RP e DEA.<br /><br />A barra horizontal representa o percentual do total de outros exercícios que aquele subgrupo representa.<br /><br />💡 Subgrupos com valor alto podem indicar contratos de longa duração ou atrasos sistemáticos de pagamento.</>} />
          </div>
          <div style={{ padding: '16px 20px' }}>
          {porSubgrupoEnriquecido.length === 0 ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>Sem subgrupos classificados</div>
          ) : (() => {
            const maxSub = Math.max(...porSubgrupoEnriquecido.map(s => s.total), 1);
            return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
              {porSubgrupoEnriquecido.map((s, i) => {
                const pct = (s.total / maxSub) * 100;
                const cor = s.grupo_id === 22 ? '#1e4d95' : '#C9A84C';
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 110px', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#fff', background: cor, borderRadius: '4px', padding: '2px 4px', textAlign: 'center' }}>{s.grupo}</span>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.nome}>{s.nome}</div>
                      <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px', marginTop: '3px' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: '2px', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#0F2A4E', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(s.total)}</div>
                  </div>
                );
              })}
            </div>
            );
          })()}
          </div>
        </div>

        {/* Top setores */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ background: 'linear-gradient(135deg, #0F2A4E 0%, #1a3a6b 60%, #0F2A4E 100%)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top Setores</h3>
            <InfoPopover insights={<><strong>Top Setores — Outros Exercícios</strong><br />Setores com maior volume de pagamentos de RP e DEA.<br /><br />Setores que aparecem frequentemente neste ranking podem ter processos de liquidação demorados ou dificuldades orçamentárias recorrentes.</>} />
          </div>
          <div style={{ padding: '16px 20px' }}>
          {(data?.porSetor ?? []).length === 0 ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>Sem dados de setor</div>
          ) : (() => {
            const maxSetor = Math.max(...(data?.porSetor ?? []).map(s => s.total), 1);
            return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
              {(data?.porSetor ?? []).map((s, i) => {
                const pct = (s.total / maxSetor) * 100;
                const cor = s.grupo_id === 22 ? '#1e4d95' : '#C9A84C';
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 110px', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#fff', background: cor, borderRadius: '4px', padding: '2px 4px', textAlign: 'center' }}>{s.grupo_id === 22 ? 'RP' : 'DEA'}</span>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.setor}>{s.setor}</div>
                      <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px', marginTop: '3px' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: '2px' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#0F2A4E', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(s.total)}</div>
                  </div>
                );
              })}
            </div>
            );
          })()}
          </div>
        </div>
      </div>

      {/* ── TOP CREDORES ── */}
      {topCredores.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ background: 'linear-gradient(90deg, #0F2A4E, #1e4d95)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top Credores — Outros Exercícios</h3>
              <InfoPopover insights={<><strong>Top Credores — Outros Exercícios</strong><br />Credores com maior volume recebido via RP e DEA.<br /><br />💡 Um credor que aparece continuamente neste ranking pode indicar contratos não quitados no exercício de competência — sinal de alerta para auditoria.<br /><br />A coluna <strong>% Acum.</strong> mostra o percentual acumulado até aquele credor no ranking.</>} />
            </div>
            <span style={{ fontSize: '10px', color: '#93c5fd' }}>{topCredores.length} registros · {fmt(totalGeral)}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: '#0F2A4E' }}>
                  <th style={{ ...TH, textAlign: 'left' as const, paddingLeft: '20px', width: '40%' }}>Credor</th>
                  <th style={TH}>Grupo</th>
                  <th style={TH}>Qtd. Pag.</th>
                  <th style={{ ...TH, color: '#C9A84C' }}>Valor Total</th>
                  <th style={{ ...TH }}>% Total</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const maxCred = Math.max(...topCredores.map(c => c.total), 1);
                  return topCredores.map((c, i) => {
                  const pctBarra = (c.total / maxCred) * 100;
                  const pctTotal = totalGeral > 0 ? (c.total / totalGeral) * 100 : 0;
                  const cor = c.grupo_id === 22 ? '#1e4d95' : '#C9A84C';
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbff' }}>
                      <td style={{ padding: '9px 12px 9px 20px', fontWeight: 600, color: '#1e293b', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.credor}>{c.credor}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'center' as const }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#fff', background: cor, borderRadius: '4px', padding: '2px 6px' }}>{c.grupo_id === 22 ? 'RP' : 'DEA'}</span>
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'center' as const, color: '#64748b', fontWeight: 500 }}>{c.qtd}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' as const, fontWeight: 700, color: '#0F2A4E', fontVariantNumeric: 'tabular-nums' }}>{fmt(c.total)}</td>
                      <td style={{ padding: '9px 16px 9px 10px', textAlign: 'right' as const }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          <div style={{ width: '50px', height: '4px', background: '#f1f5f9', borderRadius: '2px' }}>
                            <div style={{ width: `${pctBarra}%`, height: '100%', background: cor, borderRadius: '2px' }} />
                          </div>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', minWidth: '32px', textAlign: 'right' as const }}>{pctTotal.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                  });
                })()}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {totalGeral === 0 && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '8px', color: '#94a3b8', background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <Layers2 size={32} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: '13px' }}>Nenhum dado de Outros Exercícios para os filtros selecionados</span>
        </div>
      )}

      {/* ── Tabela de Processos ── */}
      {(processos?.total ?? 0) > 0 && (
        <div data-html2canvas-ignore style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* cabeçalho */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #0F2A4E 0%, #1e4d95 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '30px', height: '30px', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileCheck size={15} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Ordens de Pagamento</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>DEA e Restos a Pagar — listagem completa</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                {processos?.total ?? 0} registro{(processos?.total ?? 0) !== 1 ? 's' : ''}
              </span>
              {loadingProc && <Loader2 size={14} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />}
            </div>
          </div>

          {/* tabela */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '9px 12px', textAlign: 'left' as const, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Data</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left' as const, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Nº Empenho</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left' as const, fontWeight: 700, color: '#475569', minWidth: '200px', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Credor</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left' as const, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Tipo</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left' as const, fontWeight: 700, color: '#475569', minWidth: '140px', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Subgrupo</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left' as const, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Elemento</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left' as const, fontWeight: 700, color: '#475569', minWidth: '140px', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Setor</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left' as const, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Fonte</th>
                  <th style={{ padding: '9px 14px', textAlign: 'right' as const, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Valor Bruto</th>
                  <th style={{ padding: '9px 14px', textAlign: 'right' as const, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Retido</th>
                  <th style={{ padding: '9px 14px 9px 10px', textAlign: 'right' as const, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Líquido</th>
                </tr>
              </thead>
              <tbody>
                {loadingProc
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {Array.from({ length: 11 }).map((__, j) => (
                          <td key={j} style={{ padding: '10px 12px' }}>
                            <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '4px', width: j === 2 ? '80%' : j >= 8 ? '60%' : '70%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : (processos?.rows ?? []).map((p, i) => {
                      const isRP = p.grupo_nome?.toUpperCase().includes('REST') || p.grupo_nome?.toUpperCase().includes('RP');
                      const tipoCor = isRP ? '#1e4d95' : '#C9A84C';
                      const tipoLabel = isRP ? 'RP' : 'DEA';
                      const dataFmt = p.data_pagamento ? new Date(p.data_pagamento).toLocaleDateString('pt-BR') : '—';
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbff' }}>
                          <td style={{ padding: '9px 12px', color: '#64748b', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{dataFmt}</td>
                          <td style={{ padding: '9px 12px', color: '#0F2A4E', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '11px' }}>{p.num_empenho}</td>
                          <td style={{ padding: '9px 12px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1e293b', fontWeight: 500 }} title={p.credor_nome}>{p.credor_nome}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: '#fff', background: tipoCor, borderRadius: '4px', padding: '2px 6px' }}>{tipoLabel}</span>
                          </td>
                          <td style={{ padding: '9px 12px', color: '#475569', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.subgrupo_nome ?? ''}>{p.subgrupo_nome ?? <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                          <td style={{ padding: '9px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>{p.elemento_despesa}</td>
                          <td style={{ padding: '9px 12px', color: '#475569', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.setor_nome ?? ''}>{p.setor_nome ?? <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                          <td style={{ padding: '9px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>{p.fonte_recurso}</td>
                          <td style={{ padding: '9px 14px', textAlign: 'right' as const, fontWeight: 700, color: '#0F2A4E', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(Number(p.valor_bruto))}</td>
                          <td style={{ padding: '9px 14px', textAlign: 'right' as const, color: Number(p.valor_retido) > 0 ? '#dc2626' : '#94a3b8', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{Number(p.valor_retido) > 0 ? fmt(Number(p.valor_retido)) : '—'}</td>
                          <td style={{ padding: '9px 14px 9px 10px', textAlign: 'right' as const, fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(Number(p.valor_liquido))}</td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {/* paginação */}
          {(processos?.total ?? 0) > PROC_LIMIT && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbff' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Exibindo {((procPage - 1) * PROC_LIMIT) + 1}–{Math.min(procPage * PROC_LIMIT, processos?.total ?? 0)} de {processos?.total ?? 0}
              </span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  onClick={() => setProcPage(p => Math.max(1, p - 1))}
                  disabled={procPage === 1}
                  style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', border: '1px solid #e2e8f0', background: procPage === 1 ? '#f8fafc' : '#fff', color: procPage === 1 ? '#cbd5e1' : '#0F2A4E', cursor: procPage === 1 ? 'default' : 'pointer' }}
                >← Anterior</button>
                <span style={{ fontSize: '12px', color: '#64748b', padding: '0 8px' }}>Pág. {procPage} / {Math.ceil((processos?.total ?? 1) / PROC_LIMIT)}</span>
                <button
                  onClick={() => setProcPage(p => p + 1)}
                  disabled={procPage * PROC_LIMIT >= (processos?.total ?? 0)}
                  style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', border: '1px solid #e2e8f0', background: procPage * PROC_LIMIT >= (processos?.total ?? 0) ? '#f8fafc' : '#fff', color: procPage * PROC_LIMIT >= (processos?.total ?? 0) ? '#cbd5e1' : '#0F2A4E', cursor: procPage * PROC_LIMIT >= (processos?.total ?? 0) ? 'default' : 'pointer' }}
                >Próxima →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmt(v: number) {
  if (v === 0) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtK(v: number) {
  const n = Number(v);
  if (!isFinite(n)) return '—';
  if (n >= 1_000_000) return `R$${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$${(n/1_000).toFixed(0)}k`;
  return `R$${n.toFixed(0)}`;
}

// ─── Tab: Despesa Sintética ───────────────────────────────────────────────────

function TabDespesaSintetica({ token, entidadeId, municipioId }: { token: string | undefined; entidadeId?: number; municipioId?: number }) {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const anos = Array.from({ length: 5 }, (_, i) => anoAtual - i);
  const [exportando, setExportando] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Filtros
  const [fEntidade,   setFEntidade]   = useState('');
  const [fSecretaria, setFSecretaria] = useState('');
  const [fSetor,      setFSetor]      = useState('');
  const [fBloco,      setFBloco]      = useState('');
  const [fFonte,      setFFonte]      = useState('');
  const [fGrupo,      setFGrupo]      = useState('');
  const [fSubgrupo,   setFSubgrupo]   = useState('');

  async function handleExportPDF() {
    if (!printRef.current) return;
    setExportando(true);
    try {
      const [{ default: html2canvas }, jspdfModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      // jsPDF v4 pode ser export default ou named export
      const jsPDF = (jspdfModule as any).jsPDF ?? (jspdfModule as any).default;

      const el = printRef.current;

      // Mostra filtros estáticos, esconde filtros interativos
      const pdfFiltersEl = el.querySelector<HTMLElement>('[data-pdf-filters]');
      if (pdfFiltersEl) pdfFiltersEl.style.display = 'block';

      // Remove overflow de todos os wrappers internos para capturar tudo
      const tableWrappers = el.querySelectorAll<HTMLElement>('div[style*="overflow"]');
      const prevWrappers: string[] = [];
      tableWrappers.forEach((e, i) => {
        prevWrappers[i] = e.style.overflow + '|' + e.style.overflowX;
        e.style.overflow = 'visible';
        e.style.overflowX = 'visible';
      });

      // Força largura mínima suficiente para a tabela inteira
      const prevWidth = el.style.width;
      el.style.width = Math.max(el.scrollWidth, 1300) + 'px';

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: el.scrollWidth,
        windowWidth: el.scrollWidth,
      });

      // Restaura
      el.style.width = prevWidth;
      if (pdfFiltersEl) pdfFiltersEl.style.display = 'none';
      tableWrappers.forEach((e, i) => {
        const [ov, ovx] = prevWrappers[i].split('|');
        e.style.overflow = ov;
        e.style.overflowX = ovx;
      });

      const MARGIN = 8;
      // Página com tamanho exato do conteúdo — sem quebra de página
      const printW = 297 - MARGIN * 2;
      const scaledH = (canvas.height / 2) * (printW / (canvas.width / 2));
      const pageH = scaledH + MARGIN * 2;
      const pdf = new jsPDF({ unit: 'mm', format: [297, pageH], orientation: 'landscape' });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', MARGIN, MARGIN, printW, scaledH);

      pdf.save(`despesa-sintetica-${ano}.pdf`);
    } finally {
      setExportando(false);
    }
  }

  // Opções dos dropdowns (vindas do banco, apenas com dados)
  const { data: filtrosDisp } = useQuery<{
    entidades:   { id: number; nome: string }[];
    secretarias: { id: number; nome: string; sigla?: string }[];
    setores:     { id: number; descricao: string }[];
    blocos:      { id: number; descricao: string }[];
    fontes:      string[];
    grupos:      { id: number; nome: string }[];
    subgrupos:   { id: number; nome: string; fk_grupo: number }[];
  }>({
    queryKey: ['sintetica-filtros', ano],
    queryFn: () => apiRequest(`/pagamentos/sintetica-filtros?ano=${ano}`, { token }),
    enabled: !!token,
  });

  const params = new URLSearchParams({ ano: String(ano) });
  if (fEntidade)   params.set('entidadeId',   fEntidade);
  if (fSecretaria) params.set('secretariaId', fSecretaria);
  if (fSetor)      params.set('setorId',      fSetor);
  if (fBloco)      params.set('blocoId',      fBloco);
  if (fFonte)      params.set('fonteRecurso', fFonte);
  if (fGrupo)      params.set('grupoId',      fGrupo);
  if (fSubgrupo)   params.set('subgrupoId',   fSubgrupo);

  const { data, isLoading } = useQuery<{
    grupos: { id: number; nome: string }[];
    matrix: Record<number, Record<number, number>>;
    totaisMes: Record<number, number>;
    totaisExAnt: Record<number, number>;
    idsExAnt: number[];
    ano: string;
  }>({
    queryKey: ['sintetica-mensal', params.toString()],
    queryFn: () => apiRequest(`/pagamentos/sintetica-mensal?${params}`, { token }),
    enabled: !!token,
  });

  const grupos = data?.grupos || [];
  const matrix = data?.matrix || {};
  const totaisMes = data?.totaisMes || {};
  const totaisExAnt = data?.totaisExAnt || {};
  const idsExAnt = new Set(data?.idsExAnt || []);

  // Separa grupos normais dos de exercícios anteriores e ordena normais por total desc
  const gruposNormais = grupos
    .filter(g => !idsExAnt.has(g.id))
    .sort((a, b) => {
      const tA = Object.values(matrix[a.id] || {}).reduce((s, v) => s + v, 0);
      const tB = Object.values(matrix[b.id] || {}).reduce((s, v) => s + v, 0);
      return tB - tA;
    });
  const gruposExAnt   = grupos.filter(g =>  idsExAnt.has(g.id));
  const temExAnt = gruposExAnt.length > 0;

  // Total geral
  const totalGeral = Object.values(totaisMes).reduce((a, b) => a + b, 0);

  // Total por grupo (acumulado)
  const totalPorGrupo = (gId: number) =>
    Object.values(matrix[gId] || {}).reduce((a, b) => a + b, 0);

  // Média por grupo
  const mediaPorGrupo = (gId: number) => {
    const vals = Object.values(matrix[gId] || {}).filter(v => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  // Dados para gráfico de barras mensal (total geral)
  const barData = MESES.map((m, i) => ({
    mes: m,
    total: totaisMes[i + 1] || 0,
  }));

  // Crescimento % mês a mês
  const crescData = MESES.map((m, i) => {
    const atual = totaisMes[i + 1] || 0;
    const anterior = totaisMes[i] || 0;
    const perc = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;
    return { mes: m, perc: i === 0 ? 0 : Number(perc.toFixed(2)) };
  });

  // Pie chart por grupo
  const pieData = grupos
    .map((g, i) => ({ name: g.nome, value: totalPorGrupo(g.id), color: GROUP_COLORS[i % GROUP_COLORS.length] }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);



  const TH: React.CSSProperties = {
    padding: '9px 6px', textAlign: 'center', color: '#e2e8f0',
    fontWeight: 600, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' as const,
  };

  return (
    <div ref={printRef} className="p-3 md:p-6 space-y-4" style={{ background: '#fff', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#1e4d95,#0F2A4E)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart2 size={18} color="#C9A84C" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F2A4E', margin: 0 }}>Despesa Sintética</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Consolidado por grupo de despesa — competência {ano}</p>
          </div>
        </div>
        <button
          data-html2canvas-ignore="true"
          onClick={handleExportPDF}
          disabled={exportando || isLoading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '7px 16px', borderRadius: '9px', fontSize: '13px', fontWeight: 600,
            background: exportando ? '#e2e8f0' : '#0F2A4E', color: exportando ? '#94a3b8' : '#fff',
            border: 'none', cursor: exportando ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
          }}
        >
          {exportando
            ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Gerando PDF...</>
            : <><FileDown size={14} /> Exportar PDF</>}
        </button>
      </div>

      {/* Filtros estáticos — só no PDF */}
      <div data-pdf-filters style={{ display: 'none', background: '#f8faff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '7px 12px', fontSize: '11px', color: '#475569', marginBottom: '12px' }}>
        <span style={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '8px' }}>Filtros:</span>
        <span style={{ fontWeight: 600, color: '#0F2A4E' }}>Exercício {ano}</span>
        {fEntidade && filtrosDisp?.entidades.find(e => String(e.id) === fEntidade) && (<span> · Entidade: <strong>{filtrosDisp.entidades.find(e => String(e.id) === fEntidade)?.nome}</strong></span>)}
        {fSecretaria && filtrosDisp?.secretarias.find(s => String(s.id) === fSecretaria) && (<span> · Secretaria: <strong>{filtrosDisp.secretarias.find(s => String(s.id) === fSecretaria)?.nome}</strong></span>)}
        {fSetor && filtrosDisp?.setores.find(s => String(s.id) === fSetor) && (<span> · Setor: <strong>{filtrosDisp.setores.find(s => String(s.id) === fSetor)?.descricao}</strong></span>)}
        {fBloco && filtrosDisp?.blocos.find(b => String(b.id) === fBloco) && (<span> · Bloco: <strong>{filtrosDisp.blocos.find(b => String(b.id) === fBloco)?.descricao}</strong></span>)}
        {fFonte && <span> · Fonte: <strong style={{ fontFamily: 'monospace' }}>{fFonte}</strong></span>}
      </div>

      {/* Filtros interativos */}
      <div data-html2canvas-ignore="true" style={{ background: '#f8faff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '10px 14px', display: 'flex', flexWrap: 'nowrap', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Filtros:</span>
        <div style={{ position: 'relative', width: '82px', flexShrink: 0 }}>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            style={{ appearance: 'none', width: '100%', padding: '6px 22px 6px 8px', fontSize: '12px', color: '#0F2A4E', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '7px', cursor: 'pointer' }}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <ChevronDown size={11} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
        </div>
        <div style={{ width: '1px', height: '18px', background: '#e2e8f0', flexShrink: 0 }} />
        {[
          { label: 'Entidade', val: fEntidade, set: (v: string) => { setFEntidade(v); setFSecretaria(''); setFSetor(''); }, opts: (filtrosDisp?.entidades || []).map(e => ({ id: String(e.id), nome: e.nome })) },
          { label: 'Secretaria', val: fSecretaria, set: (v: string) => { setFSecretaria(v); setFSetor(''); }, opts: (filtrosDisp?.secretarias || []).map(s => ({ id: String(s.id), nome: (s.sigla ? `${s.sigla} — ` : '') + s.nome })) },
          { label: 'Setor', val: fSetor, set: setFSetor, opts: (filtrosDisp?.setores || []).map(s => ({ id: String(s.id), nome: s.descricao })) },
          { label: 'Grupo', val: fGrupo, set: (v: string) => { setFGrupo(v); setFSubgrupo(''); }, opts: (filtrosDisp?.grupos || []).map(g => ({ id: String(g.id), nome: g.nome })) },
          { label: 'Subgrupo', val: fSubgrupo, set: setFSubgrupo, opts: (filtrosDisp?.subgrupos || []).filter(s => !fGrupo || String(s.fk_grupo) === fGrupo).map(s => ({ id: String(s.id), nome: s.nome })) },
          { label: 'Bloco', val: fBloco, set: setFBloco, opts: (filtrosDisp?.blocos || []).map(b => ({ id: String(b.id), nome: b.descricao })) },
          { label: 'Fonte', val: fFonte, set: setFFonte, opts: (filtrosDisp?.fontes || []).map(f => ({ id: f, nome: f })) },
        ].map(({ label, val, set, opts }) => (
          <div key={label} style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
            <select value={val} onChange={e => set(e.target.value)}
              style={{ appearance: 'none', width: '100%', padding: '6px 22px 6px 8px', fontSize: '12px', color: val ? '#0F2A4E' : '#94a3b8', background: '#fff', border: `1.5px solid ${val ? '#3b82f6' : '#e2e8f0'}`, borderRadius: '7px', cursor: 'pointer' }}>
              <option value="">{label}</option>
              {opts.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
            <ChevronDown size={11} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          </div>
        ))}
        {(fEntidade || fSecretaria || fSetor || fGrupo || fSubgrupo || fBloco || fFonte) && (
          <button onClick={() => { setFEntidade(''); setFSecretaria(''); setFSetor(''); setFGrupo(''); setFSubgrupo(''); setFBloco(''); setFFonte(''); }}
            style={{ fontSize: '11px', color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>
            Limpar
          </button>
        )}
      </div>

      {/* Matriz */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '220px' }} />
              {MESES.map((_, i) => <col key={i} style={{ width: '62px' }} />)}
              <col style={{ width: '90px' }} />
              <col style={{ width: '78px' }} />
            </colgroup>
            <thead>
              <tr style={{ background: '#0F2A4E' }}>
                <th style={{ ...TH, textAlign: 'left', padding: '9px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Descrição
                    <InfoPopover insights={<><strong>Matriz de Despesa Sintética</strong><br />Cada linha representa um <strong>grupo de natureza de despesa</strong> e cada coluna um mês do ano.<br /><br />📊 Os valores mostram o total pago em cada mês por grupo.<br /><br />🔵 <strong>Exercícios Anteriores:</strong> linhas em azul claro indicam Restos a Pagar e DEA — despesas de anos passados pagas neste exercício.<br /><br />💡 Use os filtros acima para recortar por secretaria, setor ou fonte de recurso.</>} />
                  </div>
                </th>
                {MESES.map((m, i) => <th key={i} style={TH}>{m}</th>)}
                <th style={{ ...TH, color: '#fde68a', borderLeft: '1px solid rgba(255,255,255,0.12)' }}>Total</th>
                <th style={{ ...TH, color: '#fde68a' }}>Média</th>
              </tr>
            </thead>
            <tbody>
              {/* TOTAL GERAL */}
              <tr style={{ background: '#dbeafe', borderBottom: '2px solid #93c5fd' }}>
                <td style={{ padding: '10px 14px', color: '#1e3a5f', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                  TOTAL GERAL DA DESPESA
                </td>
                {MESES.map((_, i) => (
                  <td key={i} style={{ padding: '10px 6px', textAlign: 'right', color: (totaisMes[i+1]||0) > 0 ? '#1e3a5f' : '#bfdbfe', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {isLoading ? '·' : fmt(totaisMes[i + 1] || 0)}
                  </td>
                ))}
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderLeft: '1px solid #93c5fd', whiteSpace: 'nowrap' }}>
                  {isLoading ? '·' : fmt(totalGeral)}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {isLoading ? '·' : fmt(totalGeral / 12)}
                </td>
              </tr>

              {/* MESMO EXERCÍCIO */}
              {!isLoading && (() => {
                const totalME = Object.values(totaisMes).reduce((a: number, b: number) => a + b, 0) - Object.values(totaisExAnt).reduce((a: number, b: number) => a + b, 0);
                const mesesME = MESES.map((_, i) => (totaisMes[i+1]||0) - ((totaisExAnt as Record<number,number>)[i+1]||0));
                const mediaME = mesesME.filter(v => v > 0).length ? totalME / mesesME.filter(v => v > 0).length : 0;
                return (
                  <tr style={{ background: '#eff6ff', borderBottom: '2px solid #bfdbfe' }}>
                    <td style={{ padding: '10px 14px', color: '#1e4d95', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>MESMO EXERCÍCIO</td>
                    {mesesME.map((val, i) => (
                      <td key={i} style={{ padding: '10px 6px', textAlign: 'right', color: val > 0 ? '#1e3a5f' : '#bfdbfe', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(val)}</td>
                    ))}
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderLeft: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>{fmt(totalME)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(mediaME)}</td>
                  </tr>
                );
              })()}

              {/* Grupos normais */}
              {isLoading ? (
                <tr><td colSpan={15} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...
                  </div>
                </td></tr>
              ) : grupos.length === 0 ? (
                <tr><td colSpan={15} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '13px' }}>Nenhum grupo classificado encontrado</td></tr>
              ) : gruposNormais.filter(g => totalPorGrupo(g.id) > 0).map((g, idx) => {
                const acum = totalPorGrupo(g.id);
                const media = mediaPorGrupo(g.id);
                const cor = GROUP_COLORS[idx % GROUP_COLORS.length];
                return (
                  <tr key={g.id}
                    style={{ background: '#fff', borderTop: `2px solid ${cor}`, borderBottom: '1px solid #eef2f9', transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <td style={{ padding: '9px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ width: '4px', height: '16px', borderRadius: '2px', background: cor, flexShrink: 0 }} />
                        <span style={{ color: '#0f172a', fontWeight: 600, fontSize: '11px', lineHeight: 1.3 }} title={g.nome}>{g.nome}</span>
                      </div>
                    </td>
                    {MESES.map((_, i) => {
                      const val = matrix[g.id]?.[i+1] || 0;
                      return <td key={i} style={{ padding: '9px 6px', textAlign: 'right', color: val > 0 ? '#1e293b' : '#e2e8f0', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(val)}</td>;
                    })}
                    <td style={{ padding: '9px 8px', textAlign: 'right', color: '#C9A84C', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderLeft: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{fmt(acum)}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', color: '#7c3aed', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(media)}</td>
                  </tr>
                );
              })}

              {/* OUTROS EXERCÍCIOS */}
              {!isLoading && temExAnt && (() => {
                const totalEA = Object.values(totaisExAnt).reduce((a: number, b: number) => a + b, 0);
                const mesesEAComValor = Object.values(totaisExAnt).filter((v: number) => v > 0);
                const mediaEA = mesesEAComValor.length ? totalEA / mesesEAComValor.length : 0;
                return (
                  <>
                    <tr style={{ background: '#dbeafe', borderTop: '2px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 14px', color: '#1e3a5f', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', whiteSpace: 'nowrap', textAlign: 'center' }}>OUTROS EXERCÍCIOS</td>
                      {MESES.map((_, i) => {
                        const val = (totaisExAnt as Record<number,number>)[i+1] || 0;
                        return <td key={i} style={{ padding: '10px 6px', textAlign: 'right', color: val > 0 ? '#1e3a5f' : '#bfdbfe', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(val)}</td>;
                      })}
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#1e3a5f', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderLeft: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>{fmt(totalEA)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#1e3a5f', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(mediaEA)}</td>
                    </tr>
                    {gruposExAnt.filter(g => totalPorGrupo(g.id) > 0).map((g, idx) => {
                      const acum = totalPorGrupo(g.id);
                      const media = mediaPorGrupo(g.id);
                      return (
                        <tr key={g.id}
                          style={{ background: idx % 2 === 0 ? '#fff' : '#f8faff', borderBottom: '1px solid #f0f4fb', transition: 'background 0.12s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                          onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#f8faff')}
                        >
                          <td style={{ padding: '9px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <span style={{ width: '4px', height: '16px', borderRadius: '2px', background: '#94a3b8', flexShrink: 0 }} />
                              <span style={{ color: '#334155', fontWeight: 600, fontSize: '11px' }} title={g.nome}>{g.nome}</span>
                            </div>
                          </td>
                          {MESES.map((_, i) => {
                            const val = matrix[g.id]?.[i+1] || 0;
                            return <td key={i} style={{ padding: '9px 6px', textAlign: 'right', color: val > 0 ? '#475569' : '#e2e8f0', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(val)}</td>;
                          })}
                          <td style={{ padding: '9px 8px', textAlign: 'right', color: '#C9A84C', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderLeft: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{fmt(acum)}</td>
                          <td style={{ padding: '9px 8px', textAlign: 'right', color: '#7c3aed', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(media)}</td>
                        </tr>
                      );
                    })}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginTop: '16px' }}>
        {/* Evolução Mensal */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Evolução das Despesas</h3>
              <InfoPopover insights={<><strong>Evolução Mensal das Despesas</strong><br />Barras mostram o total pago em cada mês do ano selecionado.<br /><br />📈 Compare meses para identificar picos de pagamento — frequentemente relacionados a 13º salário, contratos sazonais ou repasses.<br /><br />💡 Meses com R$0 ainda não tiveram pagamentos registrados.</>} />
            </div>
          </div>
          <div style={{ padding: '16px 20px 20px' }}>
          {isLoading ? (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ left: 0, right: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<DarkTooltipBar />} />
                <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
                  {barData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#0F2A4E' : '#1e4d95'} />)}
                  <LabelList dataKey="total" position="top" formatter={fmtK} style={{ fontSize: '9px', fill: '#64748b' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          </div>
        </div>

        {/* Pizza por grupo */}
        {(() => {
          const [hoveredIndexPie, setHoveredIndexPie] = React.useState<number | null>(null);
          const totalPieGrupo = pieData.reduce((a, d) => a + d.value, 0);
          return (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>Distribuição por Grupo</span>
                <InfoPopover insights={<><strong>Distribuição por Grupo</strong><br />Mostra a fatia de cada grupo de despesa no total do período filtrado.<br /><br />🖱️ Passe o mouse na fatia ou na legenda para ver valor e percentual.<br /><br />💡 Aplique filtros (secretaria, setor) para ver a composição de uma área específica.</>} />
              </div>
              <div style={{ padding: '16px 20px 20px' }}>
                {isLoading ? (
                  <div style={{ height: '260px', background: '#f1f5f9', borderRadius: '10px' }} />
                ) : pieData.length === 0 ? (
                  <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>Sem dados classificados</div>
                ) : (
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    {/* Donut */}
                    <div style={{ flex: '0 0 auto' }}>
                      <PieChart width={220} height={220}>
                        <Pie
                          data={pieData}
                          cx={105} cy={105}
                          innerRadius={65} outerRadius={100}
                          dataKey="value"
                          paddingAngle={2}
                          strokeWidth={0}
                          onMouseEnter={(_, index) => setHoveredIndexPie(index)}
                          onMouseLeave={() => setHoveredIndexPie(null)}
                        >
                          {pieData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry.color}
                              opacity={hoveredIndexPie === null || hoveredIndexPie === i ? 1 : 0.35}
                              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={(props: any) => <DarkTooltipPie {...props} totalPie={totalPieGrupo} />} />
                      </PieChart>
                    </div>

                    {/* Legenda com barra de progresso e valor */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                      {pieData.map((d, i) => {
                        const pct = totalPieGrupo > 0 ? (d.value / totalPieGrupo) * 100 : 0;
                        const isHovered = hoveredIndexPie === i;
                        return (
                          <div
                            key={i}
                            onMouseEnter={() => setHoveredIndexPie(i)}
                            onMouseLeave={() => setHoveredIndexPie(null)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '5px 8px', borderRadius: '8px', cursor: 'default',
                              background: isHovered ? '#f8fafc' : 'transparent',
                              transition: 'background 0.15s',
                            }}
                          >
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color, flexShrink: 0, transition: 'transform 0.15s', transform: isHovered ? 'scale(1.4)' : 'scale(1)' }} />
                            <span style={{ fontSize: '11px', color: isHovered ? '#0F2A4E' : '#475569', fontWeight: isHovered ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.15s' }} title={d.name}>
                              {d.name}
                            </span>
                            <div style={{ width: '60px', height: '4px', background: '#f1f5f9', borderRadius: '99px', flexShrink: 0 }}>
                              <div style={{ height: '100%', borderRadius: '99px', background: d.color, width: `${pct}%`, transition: 'width 0.4s ease' }} />
                            </div>
                            <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(d.value)}
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: d.color, whiteSpace: 'nowrap', minWidth: '36px', textAlign: 'right' }}>
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Gráfico por Setor */}
      <GraficoPorSetor
        ano={String(ano)}
        token={token}
        fEntidade={fEntidade}
        fSecretaria={fSecretaria}
        fSetor={fSetor}
        fBloco={fBloco}
        fFonte={fFonte}
        fGrupo={fGrupo}
        fSubgrupo={fSubgrupo}
      />

      {/* Crescimento Mensal */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Crescimento Mensal da Despesa (%)</h3>
          <InfoPopover insights={<><strong>Crescimento Mensal (%)</strong><br />Mostra a variação percentual do total de despesas de um mês para o seguinte.<br /><br />📈 Valores <strong>positivos</strong> indicam que o mês gastou mais que o anterior.<br />📉 Valores <strong>negativos</strong> indicam redução nos pagamentos.<br /><br />⚠️ Queda de -100% em Abril geralmente indica que os pagamentos do mês anterior não se repetiram — comum no início de exercício ou após folha de 13º.</>} />
        </div>
        <div style={{ padding: '16px 20px 20px' }}>
        {isLoading ? (
          <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...</div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={crescData} margin={{ left: 8, right: 8, top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={45} />
              <Tooltip content={<DarkTooltipLine />} />
              <Line type="monotone" dataKey="perc" stroke="#C9A84C" strokeWidth={2.5} dot={{ fill: '#C9A84C', r: 4, strokeWidth: 0 }}>
                <LabelList dataKey="perc" position="top" formatter={(v: number) => v === 0 ? '' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`} style={{ fontSize: '9px', fill: '#64748b', fontWeight: 600 }} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        )}
        </div>
      </div>

    </div>
  );
}

// ─── Tab: Visão Geral ─────────────────────────────────────────────────────────

interface SinteticaMensalData {
  grupos: { id: number; nome: string }[];
  matrix: Record<string, Record<string, number>>;
  totaisMes: Record<string, number>;
  totaisExAnt: Record<string, number>;
  idsExAnt: number[];
  ano: string;
}

function TabSintetica({
  summary, isLoading, token, entidadeId, municipioId,
}: {
  summary: OrdemPagamentoSummary | undefined;
  isLoading: boolean;
  token: string | undefined;
  entidadeId?: number;
  municipioId?: number;
}) {
  const anoAtual = new Date().getFullYear();

  // Dia do ano até hoje (para média diária de OPs)
  const inicio = new Date(anoAtual, 0, 1);
  const hoje = new Date();
  const diasNoAno = Math.floor((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const [sinteticaData, setSinteticaData] = useState<SinteticaMensalData | undefined>(undefined);
  const [loadingSintetica, setLoadingSintetica] = useState(false);
  const [setoresData, setSetoresData] = useState<{ id: number; nome: string; total: number; qtd: number; pct: number }[] | undefined>(undefined);
  const [loadingSetores, setLoadingSetores] = useState(false);

  useEffect(() => {
    if (!token || !entidadeId) return;
    const p = new URLSearchParams({ ano: String(anoAtual), entidadeId: String(entidadeId) });
    setLoadingSintetica(true);
    setLoadingSetores(true);
    apiRequest<SinteticaMensalData>(`/pagamentos/sintetica-mensal?${p}`, { token })
      .then(setSinteticaData).catch(() => {}).finally(() => setLoadingSintetica(false));
    apiRequest<{ id: number; nome: string; total: number; qtd: number; pct: number }[]>(`/pagamentos/por-setor?${p}`, { token })
      .then(setSetoresData).catch(() => {}).finally(() => setLoadingSetores(false));
  }, [token, entidadeId, municipioId]); // eslint-disable-line

  // Último mês com dados lançados no sistema (baseado em totaisMes)
  const ultimoMesComDados = sinteticaData?.totaisMes
    ? Math.max(0, ...Object.entries(sinteticaData.totaisMes)
        .filter(([, v]) => (v as number) > 0)
        .map(([k]) => Number(k)))
    : 0;
  const mesReferencia = ultimoMesComDados || new Date().getMonth() + 1;

  // Meses para o gráfico de evolução
  // Separa RP e DEA (exercício anterior) usando o nome do grupo na matrix
  const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  const idRP  = sinteticaData?.grupos.find(g => g.nome.toUpperCase().includes('RESTOS A PAGAR'))?.id;
  const idDEA = sinteticaData?.grupos.find(g => g.nome.toUpperCase().includes('EXERC') && g.nome.toUpperCase().includes('ANTERIOR'))?.id;

  const evolucaoData = mesesNomes.map((nome, i) => {
    const mes            = i + 1;
    const total          = sinteticaData?.totaisMes?.[mes] ?? 0;
    const rp             = idRP  ? (sinteticaData?.matrix?.[idRP]?.[mes]  ?? 0) : 0;
    const dea            = idDEA ? (sinteticaData?.matrix?.[idDEA]?.[mes] ?? 0) : 0;
    const outrosExerc    = sinteticaData?.totaisExAnt?.[mes] ?? 0;
    const mesmoExercicio = total - outrosExerc;
    return {
      mes: nome,
      total,
      mesmoExercicio: mesmoExercicio > 0 ? mesmoExercicio : 0,
      rp:  rp  > 0 ? rp  : 0,
      dea: dea > 0 ? dea : 0,
    };
  });

  const totaisValidos = evolucaoData.filter(d => d.total > 0).map(d => d.total);
  const mediaEvolucao = totaisValidos.length ? totaisValidos.reduce((a, b) => a + b, 0) / totaisValidos.length : 0;

  // Últimos 6 meses para sparkline (baseado no último mês com dados)
  const ultimos6 = mesesNomes.slice(Math.max(0, mesReferencia - 6), mesReferencia).map((_, i) => {
    const mes = Math.max(1, mesReferencia - 5) + i;
    return { v: sinteticaData?.totaisMes?.[mes] ?? 0 };
  });

  // Pie data dos grupos
  const pieData = (sinteticaData?.grupos ?? []).map((g, i) => {
    const totalGrupo = Object.values(sinteticaData?.matrix?.[g.id] ?? {}).reduce((a: number, b: number) => a + (b as number), 0);
    return { name: g.nome, value: totalGrupo, color: GROUP_COLORS[i % GROUP_COLORS.length] };
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);

  const totalPie = pieData.reduce((a, d) => a + d.value, 0);

  // Setores para ranking
  const setores = (setoresData ?? []).slice(0, 10);
  const maxSetor = setores.length ? Math.max(...setores.map(s => s.total)) : 1;
  const totalSetores = setores.reduce((a, s) => a + s.total, 0);

  // % retido
  const pctRetido = summary && summary.totalBruto > 0
    ? ((summary.totalRetido / summary.totalBruto) * 100).toFixed(1)
    : '0.0';

  // Tooltip do gráfico de evolução
  const EvolucaoTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const mesmoExerc = payload.find((p: any) => p.dataKey === 'mesmoExercicio')?.value ?? 0;
    const rpVal      = payload.find((p: any) => p.dataKey === 'rp')?.value             ?? 0;
    const deaVal     = payload.find((p: any) => p.dataKey === 'dea')?.value            ?? 0;
    const totalGeral = payload.find((p: any) => p.dataKey === 'total')?.value          ?? (mesmoExerc + rpVal + deaVal);
    const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
    const Row = ({ cor, label: l, valor, destaque }: { cor: string; label: string; valor: number; destaque?: boolean }) => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cor }} />
          <span style={{ color: destaque ? cor : 'rgba(255,255,255,0.6)' }}>{l}</span>
        </div>
        <span style={{ fontWeight: 700, color: destaque ? cor : '#fff' }}>{fmtBRL(valor)}</span>
      </div>
    );
    return (
      <div style={{ background: '#0F2A4E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px 16px', fontSize: '11px', boxShadow: '0 8px 32px rgba(0,0,0,0.32)', minWidth: '260px' }}>
        <div style={{ fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{label}</div>
        <Row cor="#1e4d95" label="Mesmo Exercício" valor={mesmoExerc} />
        <div style={{ borderLeft: '2px solid rgba(255,255,255,0.08)', marginLeft: '4px', paddingLeft: '10px', marginBottom: '4px' }}>
          <Row cor="#C9A84C" label="Restos a Pagar" valor={rpVal} />
          <Row cor="#f97316" label="DEA (Exerc. Anterior)" valor={deaVal} />
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '6px', paddingTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '2px', background: '#ef4444', borderRadius: '1px' }} />
              <span style={{ fontWeight: 700, color: '#ef4444' }}>Total Geral</span>
            </div>
            <span style={{ fontWeight: 700, color: '#ef4444' }}>{fmtBRL(totalGeral)}</span>
          </div>
        </div>
      </div>
    );
  };

  // Tooltip do gráfico de distribuição por grupo
  const GrupoTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    const pct = totalPie > 0 ? ((d.value / totalPie) * 100).toFixed(1) : '0.0';
    return (
      <div style={{ background: '#0F2A4E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px 16px', fontSize: '11px', boxShadow: '0 8px 32px rgba(0,0,0,0.32)', minWidth: '180px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.payload.color }} />
          <span style={{ fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '10px' }}>{d.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Valor</span>
          <span style={{ fontWeight: 700, color: '#fff' }}>{formatCurrency(d.value)}</span>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '6px', paddingTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Participação</span>
          <span style={{ fontWeight: 700, color: '#C9A84C' }}>{pct}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 md:p-6" style={{ background: '#f8fafc', minHeight: '100%' }}>

      {/* 1. HERO HEADER */}
      <div className="px-5 py-3" style={{ background: 'linear-gradient(135deg, #0c2240 0%, #0F2A4E 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Despesa Municipal</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Exercício {anoAtual} — Visão Geral Consolidada</div>
        </div>
        <div style={{ flex: 1, minWidth: '220px', maxWidth: '360px' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px', textAlign: 'center' }}>
            {ultimoMesComDados > 0
              ? `Dados até ${mesesNomes[ultimoMesComDados - 1]} (mês ${ultimoMesComDados} de 12)`
              : 'Aguardando dados lançados'}
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {mesesNomes.map((nome, i) => {
              const mesNum = i + 1;
              const comDados = mesNum <= ultimoMesComDados;
              const atual = mesNum === ultimoMesComDados + 1;
              return (
                <div key={nome} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{
                    height: '10px', width: '100%', borderRadius: '4px',
                    background: comDados ? '#C9A84C' : atual ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.3s ease',
                    boxShadow: comDados ? '0 0 6px rgba(201,168,76,0.6)' : 'none',
                  }} />
                  <span style={{ fontSize: '9px', color: comDados ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)', fontWeight: comDados ? 600 : 400 }}>
                    {nome.slice(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ background: 'rgba(201,168,76,0.15)', border: '1.5px solid #C9A84C', borderRadius: '10px', padding: '6px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Exercício</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#C9A84C', lineHeight: 1.1 }}>{anoAtual}</div>
        </div>
      </div>

      {/* 2. KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        {/* Card 1 — Total Bruto */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ background: 'rgba(15,42,78,0.08)', borderRadius: '8px', padding: '5px', display: 'inline-flex' }}>
              <DollarSign size={14} color="#0F2A4E" />
            </div>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Total Bruto</span>
          </div>
          {isLoading ? <div style={{ height: '22px', background: '#e2e8f0', borderRadius: '6px' }} /> : (
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0F2A4E', lineHeight: 1.2 }}>{formatCurrency(summary?.totalBruto ?? 0)}</div>
          )}
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>Valor total empenhado</div>
          {!loadingSintetica && ultimos6.length > 0 && (
            <div style={{ marginTop: '8px', height: '24px' }}>
              <ResponsiveContainer width="100%" height={24}>
                <LineChart data={ultimos6} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <Line type="monotone" dataKey="v" stroke="#C9A84C" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Card 2 — Total Retido */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: 'rgba(220,38,38,0.08)', borderRadius: '8px', padding: '5px', display: 'inline-flex' }}>
                <TrendingDown size={14} color="#dc2626" />
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Total Retido</span>
            </div>
            {!isLoading && (
              <span style={{ fontSize: '10px', background: 'rgba(220,38,38,0.08)', color: '#dc2626', borderRadius: '5px', padding: '1px 6px', fontWeight: 600 }}>
                {pctRetido}% do bruto
              </span>
            )}
          </div>
          {isLoading ? <div style={{ height: '22px', background: '#e2e8f0', borderRadius: '6px' }} /> : (
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626', lineHeight: 1.2 }}>{formatCurrency(summary?.totalRetido ?? 0)}</div>
          )}
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>Impostos e retenções</div>
        </div>

        {/* Card 3 — Total Líquido */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '3px solid #059669', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ background: 'rgba(5,150,105,0.08)', borderRadius: '8px', padding: '5px', display: 'inline-flex' }}>
              <Banknote size={14} color="#059669" />
            </div>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Total Líquido</span>
          </div>
          {isLoading ? <div style={{ height: '22px', background: '#e2e8f0', borderRadius: '6px' }} /> : (
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>{formatCurrency(summary?.totalLiquido ?? 0)}</div>
          )}
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>Valor efetivamente pago</div>
        </div>

        {/* Card 4 — Ordens de Pagamento */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ background: 'rgba(201,168,76,0.12)', borderRadius: '8px', padding: '5px', display: 'inline-flex' }}>
              <FileCheck size={14} color="#a8832a" />
            </div>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Ordens de Pagamento</span>
          </div>
          {isLoading ? <div style={{ height: '22px', background: '#e2e8f0', borderRadius: '6px' }} /> : (
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0F2A4E', lineHeight: 1.2 }}>{(summary?.countRegistros ?? 0).toLocaleString('pt-BR')}</div>
          )}
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>
            {!isLoading && diasNoAno > 0 && summary?.countRegistros
              ? `≈ ${(summary.countRegistros / diasNoAno).toFixed(1)} por dia`
              : 'Registros processados'}
          </div>
        </div>
      </div>

      {/* 3. EVOLUÇÃO MENSAL */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '24px', marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F2A4E' }}>Evolução Mensal da Despesa {anoAtual}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Mesmo Exercício + Restos a Pagar + DEA (Exerc. Anterior) por mês</div>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', flexWrap: 'wrap', alignItems: 'center' }}>
            {([['#1e4d95','Mesmo Exercício','sq'],['#C9A84C','Restos a Pagar','sq'],['#f97316','DEA (Exerc. Anterior)','sq'],['#ef4444','Total Geral','ln']] as [string,string,string][]).map(([cor, lbl, tipo]) => (
              <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: tipo === 'ln' ? '16px' : '10px', height: tipo === 'ln' ? '2px' : '10px', background: cor, borderRadius: '2px', display: 'inline-block' }} />
                <span style={{ color: '#64748b' }}>{lbl}</span>
              </span>
            ))}
            <InfoPopover insights={<><strong>Evolução Mensal da Despesa</strong><br />Barras empilhadas mostram o total pago por mês dividido em 3 categorias:<br /><br />🔵 <strong>Mesmo Exercício:</strong> despesas do ano corrente.<br />🟡 <strong>Restos a Pagar (RP):</strong> compromissos de anos anteriores pagos neste exercício.<br />🟠 <strong>DEA:</strong> Despesas de Exercícios Anteriores reconhecidas agora.<br /><br />A linha vermelha mostra o <strong>Total Geral</strong> mês a mês. Meses sem barra ainda não tiveram pagamentos.</>} />
          </div>
        </div>
        {loadingSintetica ? (
          <div style={{ height: '260px', background: '#f1f5f9', borderRadius: '10px' }} />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={evolucaoData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<EvolucaoTooltip />} />
              {mediaEvolucao > 0 && (
                <ReferenceLine y={mediaEvolucao} stroke="#94a3b8" strokeDasharray="5 4" strokeWidth={1.5}
                  label={{ value: `Média: ${fmtK(mediaEvolucao)}`, position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }}
                />
              )}
              <Bar dataKey="mesmoExercicio" stackId="a" fill="#1e4d95" radius={[0,0,0,0]} maxBarSize={40} name="Mesmo Exercício" />
              <Bar dataKey="rp"             stackId="a" fill="#C9A84C" radius={[0,0,0,0]} maxBarSize={40} name="Restos a Pagar" />
              <Bar dataKey="dea"            stackId="a" fill="#f97316" radius={[4,4,0,0]} maxBarSize={40} name="DEA (Exerc. Anterior)" />
              <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2.5} dot={{ fill: '#ef4444', r: 3, strokeWidth: 0 }} name="Total Geral" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 4. CURVA ABC + GRUPOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Curva ABC */}
        {(() => {
          const credoresABC = [...(summary?.topCredores ?? [])].sort((a, b) => b.total - a.total);
          const totalABC = credoresABC.reduce((s, c) => s + Number(c.total), 0);
          let acumABC = 0;
          const curvaABC = credoresABC.map((c, i) => {
            const valor = Number(c.total);
            acumABC += valor;
            const pctIndividual = totalABC > 0 ? (valor / totalABC) * 100 : 0;
            const pctAcum = totalABC > 0 ? (acumABC / totalABC) * 100 : 0;
            const classe = pctAcum <= 80 ? 'A' : pctAcum <= 95 ? 'B' : 'C';
            return { rank: i + 1, nome: c.nome, valor, pctIndividual, pctAcum, classe };
          });
          return (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Curva ABC — Credores por Despesa</div>
                  <div style={{ fontSize: '11px', color: 'rgba(147,197,253,0.9)', marginTop: '2px' }}>Concentração de pagamentos por credor</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <InfoPopover insights={<><strong>Curva ABC de Credores</strong><br />Classifica credores pelo volume de pagamentos recebidos:<br /><br />🔵 <strong>Classe A (≤80%):</strong> poucos credores que concentram a maior parte dos gastos. Merecem atenção prioritária na auditoria.<br />🟡 <strong>Classe B (≤95%):</strong> credores intermediários.<br />🔴 <strong>Classe C (&gt;95%):</strong> muitos credores com pequenos valores individuais.<br /><br />A coluna <strong>% Acum.</strong> mostra quanto do total aquele credor representa acumulado até ele.</>} />
                  {(['A','B','C'] as const).map(cl => (
                    <span key={cl} style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                      background: cl === 'A' ? '#3b82f620' : cl === 'B' ? '#f59e0b20' : '#ef444420',
                      color: cl === 'A' ? '#93c5fd' : cl === 'B' ? '#fcd34d' : '#fca5a5',
                      border: `1px solid ${cl === 'A' ? '#3b82f640' : cl === 'B' ? '#f59e0b40' : '#ef444440'}`,
                    }}>
                      {cl === 'A' ? 'A ≤80%' : cl === 'B' ? 'B ≤95%' : 'C >95%'}
                    </span>
                  ))}
                </div>
              </div>
              {isLoading ? (
                <div style={{ height: '260px', background: '#f1f5f9', margin: '16px 20px', borderRadius: '10px' }} />
              ) : curvaABC.length > 0 ? (
                <>
                  <div style={{ overflowY: 'auto', maxHeight: '300px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ position: 'sticky', top: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', width: '32px' }}>#</th>
                          <th style={{ padding: '8px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Credor</th>
                          <th style={{ padding: '8px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Valor</th>
                          <th style={{ padding: '8px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', width: '48px' }}>%</th>
                          <th style={{ padding: '8px 8px', fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', width: '120px' }}>% Acum.</th>
                          <th style={{ padding: '8px 8px', textAlign: 'center', fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', width: '36px' }}>Cl.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {curvaABC.map((c, i) => {
                          const clColor = c.classe === 'A' ? { bg: '#eff6ff', text: '#2563eb', bar: '#3b82f6' }
                                        : c.classe === 'B' ? { bg: '#fffbeb', text: '#d97706', bar: '#f59e0b' }
                                        : { bg: '#fef2f2', text: '#dc2626', bar: '#ef4444' };
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                              onMouseLeave={e => (e.currentTarget.style.background = '')}>
                              <td style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: '#cbd5e1' }}>{c.rank}</td>
                              <td style={{ padding: '8px 8px', fontWeight: 500, color: '#334155', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.nome}>{c.nome}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>R$ {fmt(c.valor)}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'right', fontSize: '10px', color: '#64748b' }}>{c.pctIndividual.toFixed(1)}%</td>
                              <td style={{ padding: '8px 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: '999px', width: `${Math.min(c.pctAcum, 100)}%`, background: clColor.bar, transition: 'width 0.4s ease' }} />
                                  </div>
                                  <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#94a3b8', width: '28px', textAlign: 'right' }}>{c.pctAcum.toFixed(0)}%</span>
                                </div>
                              </td>
                              <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: clColor.bg, color: clColor.text }}>{c.classe}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {(['A','B','C'] as const).map(cl => {
                      const items = curvaABC.filter(c => c.classe === cl);
                      const tot = items.reduce((s, c) => s + c.valor, 0);
                      const clColor = cl === 'A' ? '#2563eb' : cl === 'B' ? '#d97706' : '#dc2626';
                      return (
                        <div key={cl} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: clColor }}>Classe {cl}:</span>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>{items.length} credor{items.length !== 1 ? 'es' : ''}</span>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#334155' }}>· R$ {fmtK(tot)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  Nenhuma despesa encontrada
                </div>
              )}
            </div>
          );
        })()}

        {/* Distribuição por Grupo */}
        {(() => {
          const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
          return (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>Distribuição por Grupo</span>
                <InfoPopover insights={<><strong>Distribuição por Grupo de Despesa</strong><br />O gráfico de rosca mostra como o total de despesas está dividido entre os grupos de natureza de despesa.<br /><br />Passe o mouse sobre uma fatia para ver o valor e o percentual. Clique na legenda para destacar um grupo.<br /><br />💡 Grupos com fatia grande indicam onde o município concentra seus gastos — ideal para priorizar análises de conformidade.</>} />
              </div>
              <div style={{ padding: '16px 20px 20px' }}>
                {loadingSintetica ? (
                  <div style={{ height: '260px', background: '#f1f5f9', borderRadius: '10px' }} />
                ) : pieData.length === 0 ? (
                  <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    Sem dados para o período
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    {/* Donut maior */}
                    <div style={{ flex: '0 0 auto' }}>
                      <PieChart width={220} height={220}>
                        <Pie
                          data={pieData}
                          cx={105} cy={105}
                          innerRadius={65} outerRadius={100}
                          dataKey="value"
                          paddingAngle={2}
                          strokeWidth={0}
                          onMouseEnter={(_, index) => setHoveredIndex(index)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        >
                          {pieData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry.color}
                              opacity={hoveredIndex === null || hoveredIndex === i ? 1 : 0.35}
                              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<GrupoTooltip />} />
                      </PieChart>
                    </div>

                    {/* Legenda com barra de progresso e valor */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {pieData.map((d, i) => {
                        const pct = totalPie > 0 ? (d.value / totalPie) * 100 : 0;
                        const isHovered = hoveredIndex === i;
                        return (
                          <div
                            key={i}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '5px 8px', borderRadius: '8px', cursor: 'default',
                              background: isHovered ? '#f8fafc' : 'transparent',
                              transition: 'background 0.15s',
                            }}
                          >
                            {/* Bolinha colorida */}
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color, flexShrink: 0, transition: 'transform 0.15s', transform: isHovered ? 'scale(1.4)' : 'scale(1)' }} />

                            {/* Nome */}
                            <span style={{ fontSize: '11px', color: isHovered ? '#0F2A4E' : '#475569', fontWeight: isHovered ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.15s' }} title={d.name}>
                              {d.name}
                            </span>

                            {/* Barra de progresso */}
                            <div style={{ width: '60px', height: '4px', background: '#f1f5f9', borderRadius: '99px', flexShrink: 0 }}>
                              <div style={{ height: '100%', borderRadius: '99px', background: d.color, width: `${pct}%`, transition: 'width 0.4s ease' }} />
                            </div>

                            {/* Valor */}
                            <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(d.value)}
                            </span>

                            {/* Percentual */}
                            <span style={{ fontSize: '10px', fontWeight: 700, color: d.color, whiteSpace: 'nowrap', minWidth: '36px', textAlign: 'right' }}>
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 5. RANKING DE SETORES */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', marginTop: '16px' }}>
        <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>Despesas por Setor — {anoAtual}</span>
          {!loadingSetores && setores.length > 0 && (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.12)', borderRadius: '6px', padding: '3px 10px' }}>
              {setores.length} setores · {fmtK(totalSetores)} total
            </span>
          )}
        </div>
        <div style={{ padding: '16px 20px 20px' }}>
          {loadingSetores ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1,2,3,4,5].map(i => <div key={i} style={{ height: '36px', background: '#f1f5f9', borderRadius: '8px' }} />)}
            </div>
          ) : setores.length === 0 ? (
            <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
              Nenhum setor classificado para {anoAtual}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
              {setores.map((setor, i) => (
                <div key={setor.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flexShrink: 0, width: '28px', height: '28px', background: '#0F2A4E', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 700 }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{ flex: '0 0 180px', fontSize: '12px', color: '#334155', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={setor.nome}>
                    {setor.nome}
                  </div>
                  <div style={{ flex: 1, background: '#f1f5f9', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${(setor.total / maxSetor) * 100}%`, height: '100%', background: SETOR_COLORS[i % SETOR_COLORS.length], borderRadius: '999px', transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ flex: '0 0 110px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#0F2A4E', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(setor.total)}
                  </div>
                  <div style={{ flexShrink: 0, background: 'rgba(15,42,78,0.07)', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', color: '#475569', fontWeight: 500 }}>
                    {setor.qtd} pag.
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


    </div>
  );
}

// ─── Gráfico Pagamentos por Setor ─────────────────────────────────────────────

const SETOR_COLORS = [
  '#0F2A4E','#1e4d95','#2563eb','#3b82f6','#60a5fa',
  '#0891b2','#059669','#7c3aed','#C9A84C','#ea580c',
  '#dc2626','#db2777','#65a30d','#9333ea','#0284c7',
];

function GraficoPorSetor({ ano, token, fEntidade, fSecretaria, fSetor, fBloco, fFonte, fGrupo, fSubgrupo }: {
  ano: string;
  token: string | undefined;
  fEntidade?: string;
  fSecretaria?: string;
  fSetor?: string;
  fBloco?: string;
  fFonte?: string;
  fGrupo?: string;
  fSubgrupo?: string;
}) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

  const params = new URLSearchParams({ ano });
  if (fEntidade)   params.set('entidadeId',   fEntidade);
  if (fSecretaria) params.set('secretariaId', fSecretaria);
  if (fSetor)      params.set('setorId',      fSetor);
  if (fBloco)      params.set('blocoId',      fBloco);
  if (fFonte)      params.set('fonteRecurso', fFonte);
  if (fGrupo)      params.set('grupoId',      fGrupo);
  if (fSubgrupo)   params.set('subgrupoId',   fSubgrupo);

  const { data, isLoading } = useQuery<{ id: number; nome: string; total: number; qtd: number; pct: number }[]>({
    queryKey: ['por-setor', params.toString()],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/pagamentos/por-setor?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  const rows = data || [];
  const totalGeral = rows.reduce((s, r) => s + r.total, 0);
  const media = rows.length ? totalGeral / rows.length : 0;

  const fmtK = (v: number) => {
    if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}K`;
    return `R$${v.toFixed(0)}`;
  };

  const chartData = rows.map((r, i) => ({
    ...r,
    color: SETOR_COLORS[i % SETOR_COLORS.length],
    nomeAbrev: r.nome.length > 12 ? r.nome.slice(0, 12) + '…' : r.nome,
  }));

  return (
    <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Despesas por Setor
          </h3>
          <InfoPopover insights={<><strong>Ranking de Despesas por Setor</strong><br />Exibe os <strong>top 20 setores</strong> ordenados pelo volume total de pagamentos.<br /><br />A linha tracejada indica a <strong>média</strong> entre os setores — setores acima dela têm concentração de gastos relevante.<br /><br />💡 Use o filtro de Setor acima para detalhar um setor específico nas demais visões.</>} />
        </div>
        {!isLoading && rows.length > 0 && (
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.12)', borderRadius: '6px', padding: '3px 10px', fontWeight: 500 }}>
            {rows.length} setores · {fmtK(totalGeral)} total
          </span>
        )}
      </div>
      <div style={{ padding: '4px 20px 8px' }}>
      <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px', marginTop: '12px' }}>
        Ranking dos setores com maior volume de pagamentos em {ano}
      </p>

      {isLoading ? (
        <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Carregando...</div>
      ) : rows.length === 0 ? (
        <div style={{ height: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px' }}>
          <BarChart2 size={32} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: '12px' }}>Nenhum setor classificado para {ano}</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ left: 8, right: 8, top: 20, bottom: 60 }} barCategoryGap="25%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="nomeAbrev"
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false} tickLine={false}
              angle={-35} textAnchor="end" interval={0}
            />
            <YAxis
              tickFormatter={fmtK}
              tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={55}
            />
            <Tooltip content={<DarkTooltipSetor />} />
            <ReferenceLine y={media} stroke="#C9A84C" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: `Média: ${fmtK(media)}`, position: 'insideTopRight', fontSize: 10, fill: '#C9A84C', fontWeight: 600 }}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]} minPointSize={3}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
              <LabelList
                dataKey="pct"
                position="top"
                formatter={(v: number) => `${v.toFixed(1)}%`}
                style={{ fontSize: '9px', fill: '#475569', fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      </div>
    </div>
  );
}

// ─── Tab: Despesa com Diárias ─────────────────────────────────────────────────

interface DiariasData {
  subgrupos: { id: number; nome: string }[];
  matrix: Record<number, Record<number, number>>;
  totaisMes: Record<number, number>;
  porSetor: { setor: string; total: number }[];
  credores: { nome: string; meses: Record<number, number>; total: number }[];
  ano: string;
}

function TabDespesaDiarias({ token, entidadeId, municipioId }: { token: string | undefined; entidadeId?: number; municipioId?: number }) {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const anos = Array.from({ length: 5 }, (_, i) => anoAtual - i);
  const [exportando, setExportando] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [fEntidade, setFEntidade]     = useState('');
  const [fSecretaria, setFSecretaria] = useState('');
  const [fSetor, setFSetor]           = useState('');
  const [fBloco, setFBloco]           = useState('');
  const [fFonte, setFFonte]           = useState('');

  async function handleExportPDF() {
    if (!printRef.current) return;
    setExportando(true);
    try {
      const [{ default: html2canvas }, jspdfModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const jsPDF = (jspdfModule as any).jsPDF ?? (jspdfModule as any).default;
      const el = printRef.current;

      const pdfFiltersEl = el.querySelector<HTMLElement>('[data-pdf-filters]');
      if (pdfFiltersEl) pdfFiltersEl.style.display = 'block';

      const tableWrappers = el.querySelectorAll<HTMLElement>('div[style*="overflow"]');
      const prevWrappers: string[] = [];
      tableWrappers.forEach((e, i) => {
        prevWrappers[i] = e.style.overflow + '|' + e.style.overflowX;
        e.style.overflow = 'visible';
        e.style.overflowX = 'visible';
      });

      const prevWidth = el.style.width;
      el.style.width = Math.max(el.scrollWidth, 1300) + 'px';

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: el.scrollWidth,
        windowWidth: el.scrollWidth,
      });

      el.style.width = prevWidth;
      if (pdfFiltersEl) pdfFiltersEl.style.display = 'none';
      tableWrappers.forEach((e, i) => {
        const [ov, ovx] = prevWrappers[i].split('|');
        e.style.overflow = ov;
        e.style.overflowX = ovx;
      });

      const MARGIN = 8;
      // Página com tamanho exato do conteúdo — sem quebra de página
      const printW = 297 - MARGIN * 2;
      const scaledH = (canvas.height / 2) * (printW / (canvas.width / 2));
      const pageH = scaledH + MARGIN * 2;
      const pdf = new jsPDF({ unit: 'mm', format: [297, pageH], orientation: 'landscape' });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', MARGIN, MARGIN, printW, scaledH);

      pdf.save(`despesa-diarias-${ano}.pdf`);
    } finally {
      setExportando(false);
    }
  }

  const { data: filtrosDisp } = useQuery<{
    entidades:   { id: number; nome: string }[];
    secretarias: { id: number; nome: string; sigla?: string }[];
    setores:     { id: number; descricao: string }[];
    blocos:      { id: number; descricao: string }[];
    fontes:      string[];
    grupos:      { id: number; nome: string }[];
    subgrupos:   { id: number; nome: string; fk_grupo: number }[];
  }>({
    queryKey: ['sintetica-filtros', ano],
    queryFn: () => apiRequest(`/pagamentos/sintetica-filtros?ano=${ano}`, { token }),
    enabled: !!token,
  });

  const dParams = new URLSearchParams({ ano: String(ano) });
  if (fEntidade)   dParams.set('entidadeId', fEntidade);
  if (fSecretaria) dParams.set('secretariaId', fSecretaria);
  if (fSetor)      dParams.set('setorId', fSetor);
  if (fBloco)      dParams.set('blocoId', fBloco);
  if (fFonte)      dParams.set('fonteRecurso', fFonte);

  const { data, isLoading } = useQuery<DiariasData>({
    queryKey: ['diarias', ano, fEntidade, fSecretaria, fSetor, fBloco, fFonte],
    queryFn: () => apiRequest(`/pagamentos/diarias?${dParams}`, { token }),
    enabled: !!token,
  });

  const subgrupos = data?.subgrupos ?? [];
  const matrix = data?.matrix ?? {};
  const totaisMes = data?.totaisMes ?? {};

  const totalGeral = Object.values(totaisMes).reduce((a: number, b: number) => a + b, 0);

  function subMes(sId: number, mes: number): number {
    return matrix[sId]?.[mes] ?? 0;
  }
  function subTotal(sId: number): number {
    return Object.values(matrix[sId] ?? {}).reduce((a: number, b: number) => a + b, 0);
  }
  function subMedia(sId: number): number {
    const vals = Object.values(matrix[sId] ?? {}).filter((v: number) => v > 0);
    return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
  }
  function crescimento(mes: number): number {
    const atual = totaisMes[mes] ?? 0;
    const ant = totaisMes[mes - 1] ?? 0;
    if (mes === 1 || ant === 0) return 0;
    return ((atual - ant) / ant) * 100;
  }
  function crescSubgrupo(sId: number, mes: number): number {
    const atual = subMes(sId, mes);
    const ant = subMes(sId, mes - 1);
    if (mes === 1 || ant === 0) return 0;
    return ((atual - ant) / ant) * 100;
  }

  const subgruposComDados = subgrupos
    .filter(s => subTotal(s.id) > 0)
    .sort((a, b) => subTotal(b.id) - subTotal(a.id));
  // Sem subgrupo
  const temSemSub = Object.values(matrix[0] ?? {}).some((v: number) => v > 0);

  // Dados para gráficos
  const barData = MESES.map((m, i) => ({ mes: m, total: totaisMes[i + 1] || 0 }));
  const pieData = subgruposComDados
    .map((s, i) => ({ name: s.nome, value: subTotal(s.id), color: GROUP_COLORS[i % GROUP_COLORS.length] }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const crescData = MESES.map((m, i) => ({ mes: m, perc: crescimento(i + 1) }));

  const TH: React.CSSProperties = {
    padding: '8px 6px', textAlign: 'center', color: '#e2e8f0',
    fontWeight: 600, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' as const,
  };

  const fmtPerc = (v: number) => v === 0 ? '0%' : `${v > 0 ? '+' : ''}${v.toFixed(0)}%`;
  const percColor = (v: number) => v > 0 ? '#dc2626' : v < 0 ? '#16a34a' : '#94a3b8';

  return (
    <div ref={printRef} className="p-3 md:p-6 space-y-4" style={{ background: '#fff', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#1e4d95,#0F2A4E)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart2 size={18} color="#C9A84C" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F2A4E', margin: 0 }}>Despesa com Diárias</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Detalhado por subgrupo — competência {ano}</p>
          </div>
        </div>
        <button
          data-html2canvas-ignore="true"
          onClick={handleExportPDF}
          disabled={exportando || isLoading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '7px 16px', borderRadius: '9px', fontSize: '13px', fontWeight: 600,
            background: exportando ? '#e2e8f0' : '#0F2A4E', color: exportando ? '#94a3b8' : '#fff',
            border: 'none', cursor: exportando ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
          }}
        >
          {exportando
            ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Gerando PDF...</>
            : <><FileDown size={14} /> Exportar PDF</>}
        </button>
      </div>

      {/* Filtros estáticos — só no PDF */}
      <div data-pdf-filters style={{ display: 'none', background: '#f8faff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '7px 12px', fontSize: '11px', color: '#475569', marginBottom: '12px' }}>
        <span style={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '8px' }}>Filtros:</span>
        <span style={{ fontWeight: 600, color: '#0F2A4E' }}>Exercício {ano}</span>
        {fEntidade && filtrosDisp?.entidades.find(e => String(e.id) === fEntidade) && (<span> · Entidade: <strong>{filtrosDisp.entidades.find(e => String(e.id) === fEntidade)?.nome}</strong></span>)}
        {fSecretaria && filtrosDisp?.secretarias.find(s => String(s.id) === fSecretaria) && (<span> · Secretaria: <strong>{filtrosDisp.secretarias.find(s => String(s.id) === fSecretaria)?.nome}</strong></span>)}
        {fSetor && filtrosDisp?.setores.find(s => String(s.id) === fSetor) && (<span> · Setor: <strong>{filtrosDisp.setores.find(s => String(s.id) === fSetor)?.descricao}</strong></span>)}
        {fBloco && filtrosDisp?.blocos.find(b => String(b.id) === fBloco) && (<span> · Bloco: <strong>{filtrosDisp.blocos.find(b => String(b.id) === fBloco)?.descricao}</strong></span>)}
        {fFonte && <span> · Fonte: <strong style={{ fontFamily: 'monospace' }}>{fFonte}</strong></span>}
      </div>

      {/* Filtros interativos */}
      <div data-html2canvas-ignore="true" style={{ background: '#f8faff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '10px 14px', display: 'flex', flexWrap: 'nowrap', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Filtros:</span>
        <div style={{ position: 'relative', width: '82px', flexShrink: 0 }}>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            style={{ appearance: 'none', width: '100%', padding: '6px 22px 6px 8px', fontSize: '12px', color: '#0F2A4E', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '7px', cursor: 'pointer' }}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <ChevronDown size={11} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
        </div>
        <div style={{ width: '1px', height: '18px', background: '#e2e8f0', flexShrink: 0 }} />
        {[
          { label: 'Entidade', val: fEntidade, set: (v: string) => { setFEntidade(v); setFSecretaria(''); setFSetor(''); }, opts: (filtrosDisp?.entidades || []).map(e => ({ id: String(e.id), nome: e.nome })) },
          { label: 'Secretaria', val: fSecretaria, set: (v: string) => { setFSecretaria(v); setFSetor(''); }, opts: (filtrosDisp?.secretarias || []).map(s => ({ id: String(s.id), nome: (s.sigla ? `${s.sigla} — ` : '') + s.nome })) },
          { label: 'Setor', val: fSetor, set: setFSetor, opts: (filtrosDisp?.setores || []).map(s => ({ id: String(s.id), nome: s.descricao })) },
          { label: 'Bloco', val: fBloco, set: setFBloco, opts: (filtrosDisp?.blocos || []).map(b => ({ id: String(b.id), nome: b.descricao })) },
          { label: 'Fonte', val: fFonte, set: setFFonte, opts: (filtrosDisp?.fontes || []).map(f => ({ id: f, nome: f })) },
        ].map(({ label, val, set, opts }) => (
          <div key={label} style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
            <select value={val} onChange={e => set(e.target.value)}
              style={{ appearance: 'none', width: '100%', padding: '6px 22px 6px 8px', fontSize: '12px', color: val ? '#0F2A4E' : '#94a3b8', background: '#fff', border: `1.5px solid ${val ? '#3b82f6' : '#e2e8f0'}`, borderRadius: '7px', cursor: 'pointer' }}>
              <option value="">{label}</option>
              {opts.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
            <ChevronDown size={11} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          </div>
        ))}
        {(fEntidade || fSecretaria || fSetor || fBloco || fFonte) && (
          <button onClick={() => { setFEntidade(''); setFSecretaria(''); setFSetor(''); setFBloco(''); setFFonte(''); }}
            style={{ fontSize: '11px', color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}>
            Limpar
          </button>
        )}
      </div>

      {/* Matriz principal */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '200px' }} />
              {MESES.map((_, i) => <col key={i} style={{ width: '62px' }} />)}
              <col style={{ width: '90px' }} />
              <col style={{ width: '78px' }} />
            </colgroup>
            <thead>
              <tr style={{ background: '#0F2A4E' }}>
                <th style={{ ...TH, textAlign: 'center', padding: '8px 14px' }}>Descrição</th>
                {MESES.map((m, i) => <th key={i} style={TH}>{m}</th>)}
                <th style={{ ...TH, color: '#fde68a', borderLeft: '1px solid rgba(255,255,255,0.12)' }}>Total</th>
                <th style={{ ...TH, color: '#fde68a' }}>Média</th>
              </tr>
            </thead>
            <tbody>
              {/* TOTAL DIÁRIAS */}
              <tr style={{ background: '#dbeafe', borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '9px 14px', color: '#1e3a5f', fontWeight: 700, fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>TOTAL DIÁRIAS</td>
                {MESES.map((_, i) => {
                  const v = totaisMes[i + 1] || 0;
                  return <td key={i} style={{ padding: '9px 6px', textAlign: 'right', color: v > 0 ? '#1e3a5f' : '#bfdbfe', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{isLoading ? '·' : fmt(v)}</td>;
                })}
                <td style={{ padding: '9px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderLeft: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{isLoading ? '·' : fmt(totalGeral)}</td>
                <td style={{ padding: '9px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{isLoading ? '·' : fmt(totalGeral / 12)}</td>
              </tr>

              {/* Subgrupos */}
              {isLoading ? (
                <tr><td colSpan={15} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...
                  </div>
                </td></tr>
              ) : subgruposComDados.length === 0 && !temSemSub ? (
                <tr><td colSpan={15} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '13px' }}>Nenhum dado de diárias encontrado</td></tr>
              ) : (
                <>
                  {subgruposComDados.map((s, idx) => {
                    const cor = GROUP_COLORS[idx % GROUP_COLORS.length];
                    return (
                      <tr key={s.id} style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                        <td style={{ padding: '9px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <span style={{ width: '3px', height: '14px', borderRadius: '2px', background: cor, flexShrink: 0 }} />
                            <span style={{ color: '#0f172a', fontWeight: 600, fontSize: '11px' }}>{s.nome}</span>
                          </div>
                        </td>
                        {MESES.map((_, i) => {
                          const v = subMes(s.id, i + 1);
                          return <td key={i} style={{ padding: '9px 6px', textAlign: 'right', color: v > 0 ? '#1e293b' : '#e2e8f0', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(v)}</td>;
                        })}
                        <td style={{ padding: '9px 8px', textAlign: 'right', color: '#C9A84C', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderLeft: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{fmt(subTotal(s.id))}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', color: '#7c3aed', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(subMedia(s.id))}</td>
                      </tr>
                    );
                  })}
                  {temSemSub && (
                    <tr style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span style={{ width: '3px', height: '14px', borderRadius: '2px', background: '#94a3b8', flexShrink: 0 }} />
                          <span style={{ color: '#64748b', fontWeight: 600, fontSize: '11px', fontStyle: 'italic' }}>Sem subgrupo</span>
                        </div>
                      </td>
                      {MESES.map((_, i) => {
                        const v = subMes(0, i + 1);
                        return <td key={i} style={{ padding: '9px 6px', textAlign: 'right', color: v > 0 ? '#1e293b' : '#e2e8f0', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(v)}</td>;
                      })}
                      <td style={{ padding: '9px 8px', textAlign: 'right', color: '#C9A84C', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderLeft: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{fmt(Object.values(matrix[0] ?? {}).reduce((a: number, b: number) => a + b, 0))}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', color: '#7c3aed', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>—</td>
                    </tr>
                  )}
                </>
              )}

              {/* Linha de crescimento % */}
              {!isLoading && totalGeral > 0 && (
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 14px', color: '#64748b', fontWeight: 700, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'center' }}>Crescimento</td>
                  {MESES.map((_, i) => {
                    const v = crescimento(i + 1);
                    return (
                      <td key={i} style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '10px', fontWeight: 700, color: percColor(v), whiteSpace: 'nowrap' }}>
                        {fmtPerc(v)}
                      </td>
                    );
                  })}
                  <td style={{ borderLeft: '1px solid #e2e8f0' }} />
                  <td />
                </tr>
              )}

              {/* Crescimento por subgrupo */}
              {!isLoading && subgruposComDados.map(s => (
                <tr key={`cresc-${s.id}`} style={{ background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 14px 6px 28px', color: '#94a3b8', fontSize: '10px', fontStyle: 'italic' }}>{s.nome}</td>
                  {MESES.map((_, i) => {
                    const v = crescSubgrupo(s.id, i + 1);
                    return (
                      <td key={i} style={{ padding: '6px', textAlign: 'right', fontSize: '10px', fontWeight: 600, color: percColor(v), whiteSpace: 'nowrap' }}>
                        {fmtPerc(v)}
                      </td>
                    );
                  })}
                  <td style={{ borderLeft: '1px solid #e2e8f0' }} /><td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráficos */}
      {/* Linha 1: Setor + Pizza */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Diárias por Setor — RadialBarChart */}
      {!isLoading && (data?.porSetor ?? []).length > 0 && (() => {
        const setores = data!.porSetor.slice(0, 8);
        const totalGeral2 = setores.reduce((a, s) => a + s.total, 0);
        const RADIAL_COLORS = ['#0F2A4E','#1e4d95','#2563eb','#3b82f6','#60a5fa','#7c3aed','#db2777','#ea580c'];
        const radialData = setores.map((s, i) => ({
          name: s.setor.length > 28 ? s.setor.slice(0, 28) + '…' : s.setor,
          fullName: s.setor,
          total: s.total,
          fill: RADIAL_COLORS[i % RADIAL_COLORS.length],
        }));
        return (
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0 }}>Diárias por Setor</h3>
                <InfoPopover insights={<><strong>Diárias por Setor</strong><br />Gráfico radial que mostra quais setores tiveram maior volume de gastos com diárias.<br /><br />Cada barra representa um setor — quanto mais longa, maior o valor gasto em diárias.<br /><br />⚠️ Setores com volume desproporcional de diárias em relação à sua estrutura podem merecer atenção especial na fiscalização.</>} />
              </div>
              <span style={{ fontSize: '10px', color: '#93c5fd' }}>Top {setores.length} · {formatCurrency(totalGeral2)}</span>
            </div>
            <div style={{ padding: '16px 24px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

              {/* Gráfico */}
              <ResponsiveContainer width="55%" height={280}>
                <RadialBarChart
                  innerRadius="20%"
                  outerRadius="95%"
                  data={radialData}
                  startAngle={180}
                  endAngle={-180}
                >
                  <RadialBar
                    dataKey="total"
                    cornerRadius={4}
                    background={{ fill: '#f1f5f9' }}
                    label={false}
                  />
                  <Tooltip content={<DarkTooltipSetor />} />
                </RadialBarChart>
              </ResponsiveContainer>
              {/* Legenda manual */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {radialData.map((s, i) => {
                  const share = totalGeral2 > 0 ? (s.total / totalGeral2) * 100 : 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.fill, flexShrink: 0 }} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.fullName}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: '9px', color: '#94a3b8' }}>{formatCurrency(s.total)} · {share.toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          </div>
        );
      })()}

        {/* Pizza por subgrupo */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px', marginBottom: '0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0 }}>(%) Participação nas Diárias</h3>
            <InfoPopover insights={<><strong>Participação nas Diárias por Subgrupo</strong><br />Distribuição percentual das diárias entre os subgrupos de despesa.<br /><br />Passe o mouse nas fatias para ver valor e participação de cada subgrupo.<br /><br />💡 Subgrupos com participação muito alta podem indicar concentração em um tipo específico de viagem ou beneficiário.</>} />
          </div>
          <div style={{ padding: '16px 20px 20px' }}>
          {isLoading ? (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...</div>
          ) : pieData.length === 0 ? (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>Sem dados</div>
          ) : (() => {
            const totalPieDiarias = pieData.reduce((a, d) => a + d.value, 0);
            return (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ flex: '0 0 auto' }}>
                  <PieChart width={170} height={170}>
                    <Pie data={pieData} cx={80} cy={80} innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={2} paddingAngle={2}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={(props: any) => <DarkTooltipPie {...props} totalPie={pieData.reduce((a: number, d: any) => a + d.value, 0)} />} />
                  </PieChart>
                </div>
                <div style={{ flex: 1, maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pieData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.name}>{d.name}</span>
                      <span style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{totalPieDiarias > 0 ? ((d.value / totalPieDiarias) * 100).toFixed(1) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          </div>
        </div>
      </div>

      {/* ── Matriz Credor × Mês ─────────────────────────────────────────── */}
      {!isLoading && (data?.credores ?? []).length > 0 && (() => {
        const credores = data!.credores;
        const mesesAtivos = MESES.map((_, i) => i + 1);
        const totalGeral = credores.reduce((a, c) => a + c.total, 0);
        // Média por mês (só meses com valor)
        const mediaPorMes = (c: typeof credores[0]) => {
          const vals = Object.values(c.meses).filter(v => v > 0);
          return vals.length ? c.total / vals.length : 0;
        };
        // Intensidade de heat para célula
        const maxVal = Math.max(...credores.flatMap(c => Object.values(c.meses)));

        const TH2: React.CSSProperties = {
          padding: '9px 8px', textAlign: 'center', color: '#e2e8f0',
          fontWeight: 700, fontSize: '10px', letterSpacing: '0.05em',
          textTransform: 'uppercase', whiteSpace: 'nowrap',
        };

        return (
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {/* Cabeçalho */}
            <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(201,168,76,0.2)', border: '1px solid rgba(201,168,76,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#C9A84C', fontSize: '13px' }}>⊞</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#fff' }}>Credor por Mês — Diárias</h3>
                  <p style={{ margin: 0, fontSize: '10px', color: '#93c5fd' }}>{credores.length} beneficiários · Total {formatCurrency(totalGeral)}</p>
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ background: '#0F2A4E' }}>
                    <th style={{ ...TH2, textAlign: 'left', minWidth: '180px', paddingLeft: '16px', position: 'sticky', left: 0, background: '#0F2A4E', zIndex: 2 }}>Credor</th>
                    {mesesAtivos.map(m => (
                      <th key={m} style={TH2}>{MESES[m - 1]}</th>
                    ))}
                    <th style={{ ...TH2, color: '#C9A84C', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>Total</th>
                    <th style={{ ...TH2, color: '#93c5fd' }}>Média</th>
                  </tr>
                </thead>
                <tbody>
                  {credores.map((c, ci) => (
                    <tr key={ci} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Nome */}
                      <td style={{
                        padding: '9px 12px 9px 16px', fontWeight: 600, color: '#1e293b',
                        fontSize: '11px', maxWidth: '200px', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        position: 'sticky', left: 0, background: '#fff', zIndex: 1,
                        borderRight: '1px solid #e2e8f0',
                      }} title={c.nome}>
                        {c.nome}
                      </td>
                      {/* Meses com heatmap sutil */}
                      {mesesAtivos.map(m => {
                        const v = c.meses[m] ?? 0;
                        const intensity = maxVal > 0 ? v / maxVal : 0;
                        const bg = v > 0
                          ? `rgba(30, 77, 149, ${0.08 + intensity * 0.3})`
                          : 'transparent';
                        return (
                          <td key={m} style={{
                            padding: '9px 8px', textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums', fontSize: '11px',
                            color: v > 0 ? '#0F2A4E' : '#cbd5e1',
                            background: bg, whiteSpace: 'nowrap', fontWeight: v > 0 ? 600 : 400,
                          }}>
                            {v > 0 ? formatCurrency(v) : '—'}
                          </td>
                        );
                      })}
                      {/* Total */}
                      <td style={{
                        padding: '9px 12px', textAlign: 'right', fontWeight: 700,
                        color: '#0F2A4E', fontVariantNumeric: 'tabular-nums',
                        borderLeft: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                        background: '#f8faff', fontSize: '11px',
                      }}>
                        {formatCurrency(c.total)}
                      </td>
                      {/* Média */}
                      <td style={{
                        padding: '9px 12px', textAlign: 'right', fontWeight: 600,
                        color: '#1e4d95', fontVariantNumeric: 'tabular-nums',
                        fontSize: '11px', whiteSpace: 'nowrap',
                      }}>
                        {formatCurrency(mediaPorMes(c))}
                      </td>
                    </tr>
                  ))}

                  {/* Linha TOTAL GERAL */}
                  <tr style={{ background: '#dbeafe', borderTop: '2px solid #bfdbfe' }}>
                    <td style={{
                      padding: '10px 12px 10px 16px', fontWeight: 800, color: '#1e3a5f',
                      fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em',
                      position: 'sticky', left: 0, background: '#dbeafe', zIndex: 1,
                      borderRight: '1px solid #bfdbfe',
                    }}>
                      Total Geral
                    </td>
                    {mesesAtivos.map(m => {
                      const v = credores.reduce((a, c) => a + (c.meses[m] ?? 0), 0);
                      return (
                        <td key={m} style={{
                          padding: '10px 8px', textAlign: 'right', fontWeight: 800,
                          color: '#1e3a5f', fontVariantNumeric: 'tabular-nums',
                          fontSize: '11px', whiteSpace: 'nowrap',
                        }}>
                          {v > 0 ? formatCurrency(v) : '—'}
                        </td>
                      );
                    })}
                    <td style={{
                      padding: '10px 12px', textAlign: 'right', fontWeight: 800,
                      color: '#1e3a5f', fontVariantNumeric: 'tabular-nums',
                      borderLeft: '1px solid #bfdbfe', whiteSpace: 'nowrap', fontSize: '11px',
                    }}>
                      {formatCurrency(totalGeral)}
                    </td>
                    <td style={{
                      padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                      color: '#1e4d95', fontVariantNumeric: 'tabular-nums', fontSize: '11px',
                    }}>
                      {(() => {
                        const vals = mesesAtivos.map(m => credores.reduce((a, c) => a + (c.meses[m] ?? 0), 0)).filter(v => v > 0);
                        return formatCurrency(vals.length ? totalGeral / vals.length : 0);
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Evolução Mensal — full width */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0 }}>Evolução das Diárias</h3>
          <InfoPopover insights={<><strong>Evolução Mensal das Diárias</strong><br />Total pago em diárias mês a mês.<br /><br />📈 Picos costumam coincidir com eventos, campanhas de saúde, eleições ou períodos de maior atividade administrativa.<br /><br />💡 Compare com outros anos para identificar tendências de crescimento.</>} />
        </div>
        <div style={{ padding: '16px 20px 20px' }}>
        {isLoading ? (
          <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ left: 0, right: 8, bottom: 0, top: 24 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<DarkTooltipBar />} />
              <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
                {barData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#8a7020' : '#a68a2a'} />)}
                <LabelList dataKey="total" position="top" formatter={(v: number) => formatCurrency(v)} style={{ fontSize: '11px', fill: '#6b5518', fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        </div>
      </div>

      {/* Crescimento Mensal */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0 }}>Crescimento Mensal das Diárias (%)</h3>
          <InfoPopover insights={<><strong>Crescimento Mensal das Diárias (%)</strong><br />Variação percentual do total de diárias de um mês para o seguinte.<br /><br />📈 Crescimento acima de 50% em um mês merece investigação — pode indicar aumento atípico de viagens ou pagamentos retroativos.<br /><br />Valores negativos são normais após meses de pico.</>} />
        </div>
        <div style={{ padding: '16px 20px 20px' }}>
        {isLoading ? (
          <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...</div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={crescData} margin={{ left: 8, right: 8, top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={45} />
              <Tooltip content={<DarkTooltipLine />} />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="perc" stroke="#dc2626" strokeWidth={2.5} dot={{ fill: '#dc2626', r: 4, strokeWidth: 0 }}>
                <LabelList dataKey="perc" position="top" formatter={(v: number) => v === 0 ? '' : `${v > 0 ? '+' : ''}${v.toFixed(0)}%`} style={{ fontSize: '9px', fill: '#dc2626', fontWeight: 600 }} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const [activeTab, setActiveTab] = useState<TabId>('sintetica');
  const { entidadeSelecionada, municipioSelecionado } = useMunicipioEntidade();
  const entidadeId = entidadeSelecionada?.id;
  const municipioId = municipioSelecionado?.id;

  const [summary, setSummary] = useState<OrdemPagamentoSummary | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token || !entidadeId) return;
    setIsLoading(true);
    const params = new URLSearchParams();
    params.set('entidadeId', String(entidadeId));
    apiRequest<OrdemPagamentoSummary>(`/pagamentos/summary?${params}`, { token })
      .then(setSummary)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token, entidadeId, municipioId]); // eslint-disable-line

  return (
    <div>
      <TopBar title="Despesa" subtitle="Análise de despesas municipais" />

      {/* Barra de Tabs — pill style */}
      <div className="bg-white border-b border-slate-200 px-3 md:px-8 py-3 overflow-x-auto">
        <div style={{ display: 'flex', background: '#f8fafc', borderRadius: '14px', padding: '4px', border: '1px solid #e2e8f0', gap: '4px', width: 'fit-content' }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '8px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 700, transition: 'all 0.2s',
                  background: active ? 'linear-gradient(135deg, #0F2A4E, #1e4d95)' : 'transparent',
                  color: active ? '#fff' : '#64748b',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.icon}{tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo da aba */}
      {activeTab === 'sintetica'      && <TabSintetica summary={summary} isLoading={isLoading} token={token} entidadeId={entidadeId} municipioId={municipioId} />}
      {activeTab === 'desp_sintetica' && <TabDespesaSintetica token={token} entidadeId={entidadeId} municipioId={municipioId} />}
      {activeTab === 'analitica'      && <TabDespesaAnalitica token={token} entidadeId={entidadeId} municipioId={municipioId} />}
      {activeTab === 'diarias'        && <TabDespesaDiarias token={token} entidadeId={entidadeId} municipioId={municipioId} />}
      {activeTab === 'outros'         && <TabOutrosExercicios token={token} entidadeId={entidadeId} municipioId={municipioId} />}
    </div>
  );
}
