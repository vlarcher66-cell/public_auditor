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
  if (fEntidade)   params.set('entidadeId', fEntidade);
  if (fSecretaria) params.set('secretariaId', fSecretaria);
  if (fSetor)      params.set('setorId', fSetor);
  if (fBloco)      params.set('blocoId', fBloco);
  if (fFonte)      params.set('fonteRecurso', fFonte);

  const { data, isLoading } = useQuery<AnaliticaData>({
    queryKey: ['analitica-mensal', ano, fEntidade, fSecretaria, fSetor, fBloco, fFonte, fGrupo, fSubgrupo],
    queryFn: () => apiRequest(`/pagamentos/analitica-mensal?${params}`, { token }),
    enabled: !!token,
  });

  // Expande todos os grupos automaticamente quando os dados chegam
  useEffect(() => {
    if (data?.grupos) setExpandidos(new Set(data.grupos.map(g => g.id)));
  }, [data?.grupos]);

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
        {(fEntidade || fSecretaria || fSetor || fBloco || fFonte) && (
          <button onClick={() => { setFEntidade(''); setFSecretaria(''); setFSetor(''); setFBloco(''); setFFonte(''); }}
            style={{ fontSize: '11px', color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}>
            Limpar
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
            <div style={{ display: 'flex', gap: '12px', fontSize: '10px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#93c5fd' }}><span style={{ width: '10px', height: '10px', background: '#1e4d95', borderRadius: '2px', display: 'inline-block' }} />RP</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fde68a' }}><span style={{ width: '10px', height: '10px', background: '#C9A84C', borderRadius: '2px', display: 'inline-block' }} />DEA</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fca5a5' }}><span style={{ width: '20px', height: '2px', background: '#ef4444', display: 'inline-block' }} />Total</span>
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
              <Tooltip
                formatter={(v: number, name: string) => [fmt(v), name === 'rp' ? 'Restos a Pagar' : name === 'dea' ? 'DEA' : 'Total']}
                contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
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
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
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
          <div style={{ background: 'linear-gradient(135deg, #0F2A4E 0%, #1a3a6b 60%, #0F2A4E 100%)', padding: '12px 16px' }}>
            <h3 style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top Subgrupos</h3>
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
          <div style={{ background: 'linear-gradient(135deg, #0F2A4E 0%, #1a3a6b 60%, #0F2A4E 100%)', padding: '12px 16px' }}>
            <h3 style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top Setores</h3>
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
            <h3 style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top Credores — Outros Exercícios</h3>
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
                <th style={{ ...TH, textAlign: 'center', padding: '9px 14px' }}>Descrição</th>
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
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Evolução das Despesas</h3>
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
                <Tooltip formatter={(v: number) => [formatCurrency(v), 'Total']} labelStyle={{ fontWeight: 600 }} contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {barData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#0F2A4E' : '#1e4d95'} />)}
                  <LabelList dataKey="total" position="top" formatter={fmtK} style={{ fontSize: '9px', fill: '#64748b' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          </div>
        </div>

        {/* Pizza por grupo */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>(%) Despesas por Grupo</h3>
          </div>
          <div style={{ padding: '16px 20px 20px' }}>
          {isLoading ? (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...</div>
          ) : pieData.length === 0 ? (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>Sem dados classificados</div>
          ) : (() => {
            const totalPieGrupo = pieData.reduce((a, d) => a + d.value, 0);
            return (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ flex: '0 0 auto' }}>
                  <PieChart width={170} height={170}>
                    <Pie data={pieData} cx={80} cy={80} innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={2} paddingAngle={2}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [formatCurrency(v), '']} contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  </PieChart>
                </div>
                <div style={{ flex: 1, maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pieData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.name}>{d.name}</span>
                      <span style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{totalPieGrupo > 0 ? ((d.value / totalPieGrupo) * 100).toFixed(1) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          </div>
        </div>
      </div>

      {/* Gráfico por Setor */}
      <GraficoPorSetor ano={String(ano)} token={token} />

      {/* Crescimento Mensal */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Crescimento Mensal da Despesa (%)</h3>
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
              <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, 'Crescimento']} contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
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

  const contextParams = new URLSearchParams();
  contextParams.set('ano', String(anoAtual));
  if (entidadeId) contextParams.set('entidadeId', String(entidadeId));

  const { data: sinteticaData, isLoading: loadingSintetica } = useQuery<SinteticaMensalData>({
    queryKey: ['sintetica-mensal-geral', anoAtual, entidadeId, municipioId],
    queryFn: () => apiRequest(`/pagamentos/sintetica-mensal?${contextParams}`, { token }),
    enabled: !!token,
  });

  const { data: setoresData, isLoading: loadingSetores } = useQuery<{ id: number; nome: string; total: number; qtd: number; pct: number }[]>({
    queryKey: ['por-setor-geral', anoAtual, entidadeId, municipioId],
    queryFn: () => apiRequest(`/pagamentos/por-setor?${contextParams}`, { token }),
    enabled: !!token,
  });

  // Último mês com dados lançados no sistema (baseado em totaisMes)
  const ultimoMesComDados = sinteticaData?.totaisMes
    ? Math.max(0, ...Object.entries(sinteticaData.totaisMes)
        .filter(([, v]) => (v as number) > 0)
        .map(([k]) => Number(k)))
    : 0;
  const mesReferencia = ultimoMesComDados || new Date().getMonth() + 1;

  // Meses para o gráfico de evolução
  const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const evolucaoData = mesesNomes.map((nome, i) => {
    const mes = i + 1;
    const total = sinteticaData?.totaisMes?.[mes] ?? 0;
    const exAnt = sinteticaData?.totaisExAnt?.[mes] ?? 0;
    const dea = total - exAnt;
    return { mes: nome, total, dea: dea > 0 ? dea : 0, rp: exAnt > 0 ? exAnt : 0 };
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
    const dea = payload.find((p: any) => p.dataKey === 'dea')?.value ?? 0;
    const rp = payload.find((p: any) => p.dataKey === 'rp')?.value ?? 0;
    const total = dea + rp;
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
        <div style={{ fontWeight: 700, color: '#0F2A4E', marginBottom: '6px' }}>{label}</div>
        <div style={{ color: '#1e4d95' }}>DEA: <strong>{fmtK(dea)}</strong></div>
        <div style={{ color: '#C9A84C' }}>Restos a Pagar: <strong>{fmtK(rp)}</strong></div>
        <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '6px', paddingTop: '6px', color: '#0F2A4E', fontWeight: 700 }}>Total: {fmtK(total)}</div>
      </div>
    );
  };

  return (
    <div className="p-3 md:p-6" style={{ background: '#f8fafc', minHeight: '100%' }}>

      {/* 1. HERO HEADER */}
      <div className="p-4 md:px-8 md:py-6" style={{ background: 'linear-gradient(135deg, #0c2240 0%, #0F2A4E 100%)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Despesa Municipal</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Exercício {anoAtual} — Visão Geral Consolidada</div>
        </div>
        <div style={{ flex: 1, minWidth: '200px', maxWidth: '340px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', textAlign: 'center' }}>
            {ultimoMesComDados > 0
              ? `Dados até ${mesesNomes[ultimoMesComDados - 1]} (mês ${ultimoMesComDados} de 12)`
              : 'Aguardando dados lançados'}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${(mesReferencia / 12) * 100}%`, height: '100%', background: '#C9A84C', borderRadius: '999px', transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Jan</span>
            <span style={{ fontSize: '10px', color: '#C9A84C', fontWeight: 600 }}>{Math.round((mesReferencia / 12) * 100)}% do ano</span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Dez</span>
          </div>
        </div>
        <div style={{ background: 'rgba(201,168,76,0.15)', border: '1.5px solid #C9A84C', borderRadius: '12px', padding: '10px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Exercício</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#C9A84C', lineHeight: 1.1 }}>{anoAtual}</div>
        </div>
      </div>

      {/* 2. KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {/* Card 1 — Total Bruto */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '20px 24px' }}>
          <div style={{ background: 'rgba(15,42,78,0.08)', borderRadius: '10px', padding: '8px', display: 'inline-flex', marginBottom: '12px' }}>
            <DollarSign size={18} color="#0F2A4E" />
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500 }}>Total Bruto</div>
          {isLoading ? <div style={{ height: '28px', background: '#e2e8f0', borderRadius: '6px' }} /> : (
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0F2A4E', lineHeight: 1.2 }}>{formatCurrency(summary?.totalBruto ?? 0)}</div>
          )}
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Valor total empenhado</div>
          {!loadingSintetica && ultimos6.length > 0 && (
            <div style={{ marginTop: '12px', height: '32px' }}>
              <ResponsiveContainer width="100%" height={32}>
                <LineChart data={ultimos6} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <Line type="monotone" dataKey="v" stroke="#C9A84C" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Card 2 — Total Retido */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ background: 'rgba(220,38,38,0.08)', borderRadius: '10px', padding: '8px', display: 'inline-flex' }}>
              <TrendingDown size={18} color="#dc2626" />
            </div>
            {!isLoading && (
              <span style={{ fontSize: '11px', background: 'rgba(220,38,38,0.08)', color: '#dc2626', borderRadius: '6px', padding: '2px 8px', fontWeight: 600 }}>
                {pctRetido}% do bruto
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500 }}>Total Retido</div>
          {isLoading ? <div style={{ height: '28px', background: '#e2e8f0', borderRadius: '6px' }} /> : (
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626', lineHeight: 1.2 }}>{formatCurrency(summary?.totalRetido ?? 0)}</div>
          )}
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Impostos e retenções</div>
        </div>

        {/* Card 3 — Total Líquido */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', borderLeft: '3px solid #059669', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '20px 24px' }}>
          <div style={{ background: 'rgba(5,150,105,0.08)', borderRadius: '10px', padding: '8px', display: 'inline-flex', marginBottom: '12px' }}>
            <Banknote size={18} color="#059669" />
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500 }}>Total Líquido</div>
          {isLoading ? <div style={{ height: '28px', background: '#e2e8f0', borderRadius: '6px' }} /> : (
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>{formatCurrency(summary?.totalLiquido ?? 0)}</div>
          )}
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Valor efetivamente pago</div>
        </div>

        {/* Card 4 — Ordens de Pagamento */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '20px 24px' }}>
          <div style={{ background: 'rgba(201,168,76,0.12)', borderRadius: '10px', padding: '8px', display: 'inline-flex', marginBottom: '12px' }}>
            <FileCheck size={18} color="#a8832a" />
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500 }}>Ordens de Pagamento</div>
          {isLoading ? <div style={{ height: '28px', background: '#e2e8f0', borderRadius: '6px' }} /> : (
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0F2A4E', lineHeight: 1.2 }}>{(summary?.countRegistros ?? 0).toLocaleString('pt-BR')}</div>
          )}
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
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
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Despesas do exercício (DEA) + Restos a Pagar (RP) por mês</div>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
            {[['#1e4d95','DEA'],['#C9A84C','Restos a Pagar'],['#ef4444','Total']].map(([cor, label]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: label === 'Total' ? '16px' : '10px', height: label === 'Total' ? '2px' : '10px', background: cor, borderRadius: '2px', display: 'inline-block' }} />
                <span style={{ color: '#64748b' }}>{label}</span>
              </span>
            ))}
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
              <Bar dataKey="dea" stackId="a" fill="#1e4d95" radius={[0,0,0,0]} maxBarSize={40} />
              <Bar dataKey="rp"  stackId="a" fill="#C9A84C" radius={[4,4,0,0]} maxBarSize={40} />
              <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2.5} dot={{ fill: '#ef4444', r: 3, strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 4. TOP CREDORES + GRUPOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Top Credores */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>Top 10 Credores</span>
          </div>
          <div style={{ padding: '16px 20px 20px' }}>
            {isLoading ? (
              <div style={{ height: '260px', background: '#f1f5f9', borderRadius: '10px' }} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={summary?.topCredores ?? []} layout="vertical" margin={{ left: 0, right: 60, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 9, fill: '#475569' }} width={110} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Total']} contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="total" radius={[0,4,4,0]} maxBarSize={20}>
                    {(summary?.topCredores ?? []).map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#C9A84C' : '#0F2A4E'} opacity={1 - i * 0.07} />
                    ))}
                    <LabelList dataKey="total" position="right" formatter={fmtK} style={{ fontSize: '10px', fill: '#475569', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div style={{ marginTop: '12px', textAlign: 'right' }}>
              <Link href="/pagamentos" style={{ fontSize: '12px', color: '#1e4d95', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Ver análise completa <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>

        {/* Distribuição por Grupo */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>Distribuição por Grupo</span>
          </div>
          <div style={{ padding: '16px 20px 20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            {loadingSintetica ? (
              <div style={{ height: '260px', flex: 1, background: '#f1f5f9', borderRadius: '10px' }} />
            ) : pieData.length === 0 ? (
              <div style={{ flex: 1, height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Sem dados para o período
              </div>
            ) : (
              <>
                <div style={{ flex: '0 0 auto' }}>
                  <PieChart width={170} height={170}>
                    <Pie data={pieData} cx={80} cy={80} innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={2}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [formatCurrency(v), '']} contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  </PieChart>
                </div>
                <div style={{ flex: 1, maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pieData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.name}>{d.name}</span>
                      <span style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{totalPie > 0 ? ((d.value / totalPie) * 100).toFixed(1) : 0}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
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

      {/* 6. CTA */}
      <div style={{ background: 'linear-gradient(135deg, #0c2240 0%, #0F2A4E 100%)', borderRadius: '16px', padding: '24px 32px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Importar novo relatório de despesa</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>Carregue um PDF ou Excel do SIAFIC para processar automaticamente</div>
        </div>
        <Link href="/importacao" style={{ background: '#C9A84C', color: '#0F2A4E', fontWeight: 700, padding: '12px 28px', borderRadius: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
          <ArrowRight size={16} />
          Importar Agora
        </Link>
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

function GraficoPorSetor({ ano, token }: { ano: string; token: string | undefined }) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

  const { data, isLoading } = useQuery<{ id: number; nome: string; total: number; qtd: number; pct: number }[]>({
    queryKey: ['por-setor', ano],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/pagamentos/por-setor?ano=${ano}`, {
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
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Despesas por Setor
        </h3>
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
            <Tooltip
              formatter={(v: number) => [
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v),
                'Total Bruto'
              ]}
              labelFormatter={(label) => {
                const row = chartData.find(r => r.nomeAbrev === label);
                return row ? row.nome : label;
              }}
              contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
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
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0 }}>Diárias por Setor</h3>
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
                  <Tooltip
                    formatter={(v: number, _name: any, props: any) => [formatCurrency(v), props?.payload?.fullName || props?.payload?.name || 'Total']}
                    labelFormatter={() => ''}
                    contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
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
          <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px', marginBottom: '0' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0 }}>(%) Participação nas Diárias</h3>
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
                    <Tooltip formatter={(v: number) => [formatCurrency(v), '']} contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
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
        <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0 }}>Evolução das Diárias</h3>
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
              <Tooltip formatter={(v: number) => [formatCurrency(v), 'Total']} labelStyle={{ fontWeight: 600 }} contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
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
        <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '14px 20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0 }}>Crescimento Mensal das Diárias (%)</h3>
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
              <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, 'Crescimento']} contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
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

  const { data: summary, isLoading } = useQuery<OrdemPagamentoSummary>({
    queryKey: ['summary', entidadeId, municipioId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (entidadeId) params.set('entidadeId', String(entidadeId));
      return apiRequest(`/pagamentos/summary?${params}`, { token });
    },
    enabled: !!token,
    refetchInterval: 60_000,
  });

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
