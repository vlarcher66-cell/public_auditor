'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Target, TrendingUp, BarChart2, AlertCircle,
  ChevronRight, Upload, Loader2, Download, InboxIcon,
  LayoutDashboard, Table2, Banknote, Activity, Calendar,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { useMunicipioEntidade } from '@/contexts/MunicipioEntidadeContext';
import TopBar from '@/components/dashboard/TopBar';
import { apiRequest } from '@/lib/api';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend, LabelList,
} from 'recharts';

// ─── Formatação ───────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined): string {
  if (!v || v === 0) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtFull(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtK(v: number): string {
  if (v >= 1_000_000) return 'R$ ' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return 'R$ ' + (v / 1_000).toFixed(0) + 'K';
  return 'R$ ' + fmtFull(v);
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DRERow {
  codigo_rubrica: string;
  descricao: string;
  tipo_receita: string;
  fonte_recurso: string;
  mes: number;
  total: number;
}

interface TransfDRERow {
  tipo_lancamento: string;
  conta_origem_nome: string;
  fonte_origem: string;
  mes: number;
  total: number;
}

interface Summary {
  total_registros: number;
  valor_total: number;
  valor_orc: number;
  valor_extra: number;
}

interface Conta   { cod: string; desc: string; fonte: string; meses: number[] }
interface SubGrupo { cod: string; desc: string; meses: number[]; contas: Conta[] }
interface Grupo    { cod: string; desc: string; meses: number[]; subgrupos: SubGrupo[] }

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

type TabId = 'geral' | 'analitica' | 'sintetica' | 'extra';
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'geral',     label: 'Geral',              icon: <LayoutDashboard size={14} /> },
  { id: 'analitica', label: 'Receita Analítica',  icon: <Table2 size={14} /> },
  { id: 'sintetica', label: 'Receita Sintética',  icon: <BarChart2 size={14} /> },
  { id: 'extra',     label: 'Receita Extra',       icon: <Banknote size={14} /> },
];

// ─── Mapeamento de subgrupos ──────────────────────────────────────────────────

const SUBGRUPO_MAP: Array<{ prefixo: string; desc: string }> = [
  { prefixo: '1.1',             desc: 'Receita Tributária' },
  { prefixo: '1.2',             desc: 'Contribuições' },
  { prefixo: '1.3',             desc: 'Receita Patrimonial' },
  { prefixo: '1.4',             desc: 'Receita Agropecuária' },
  { prefixo: '1.5',             desc: 'Receita Industrial' },
  { prefixo: '1.6',             desc: 'Receita de Serviços' },
  { prefixo: '1.8',             desc: 'Receitas Correntes Diversas' },
  { prefixo: '1.9',             desc: 'Outras Receitas Correntes' },
  // Blocos SUS — Manutenção: cada subfonte vira subgrupo próprio
  { prefixo: '1.7.1.3.50.1',    desc: 'SUS — Atenção Primária (AB/APS)' },
  { prefixo: '1.7.1.3.50.2',    desc: 'SUS — Atenção Especializada (MAC)' },
  { prefixo: '1.7.1.3.50.3',    desc: 'SUS — Vigilância em Saúde' },
  { prefixo: '1.7.1.3.50.4',    desc: 'SUS — Assistência Farmacêutica' },
  { prefixo: '1.7.1.3.50.5',    desc: 'SUS — Gestão do SUS' },
  { prefixo: '1.7.1.3.50.9',    desc: 'SUS — Bloco Unificado' },
  { prefixo: '1.7.1.3.50',      desc: 'SUS — Manutenção (Bloco)' },
  { prefixo: '1.7.1.3.51',      desc: 'SUS — Estruturação (Bloco)' },
  { prefixo: '1.7.1',           desc: 'Transferências da União' },
  { prefixo: '1.7.2',           desc: 'Transferências dos Estados — SUS' },
  { prefixo: '1.7',             desc: 'Transferências Correntes' },
  { prefixo: '2.1.1',           desc: 'Operações de Crédito Interno' },
  { prefixo: '2.4.1',           desc: 'Transferências de Capital — União' },
  { prefixo: '2.4.2',           desc: 'Transferências de Capital — Estados' },
  { prefixo: '2.4',             desc: 'Transferências de Capital' },
  { prefixo: '2.1.8.8.1.01.02', desc: 'Contribuições Previdenciárias (RGPS / ITAPREV)' },
  { prefixo: '2.1.8.8.1.01.04', desc: 'IRRF — Retenções na Fonte' },
  { prefixo: '2.1.8.8.1.01.08', desc: 'ISS — Retenções na Fonte' },
  { prefixo: '2.1.8.8.1.01.10', desc: 'Pensão Alimentícia' },
  { prefixo: '2.1.8.8.1.01.11', desc: 'Plano de Saúde / Odonto' },
  { prefixo: '2.1.8.8.1.01.13', desc: 'Contribuição Sindical' },
  { prefixo: '2.1.8.8.1.01.15', desc: 'Empréstimos e Financiamentos' },
  { prefixo: '2.1.8.8.1.03',    desc: 'Depósitos Judiciais' },
  { prefixo: '2.1.8',           desc: 'Receitas Extra-Orçamentárias (Retenções)' },
  { prefixo: '2.1',             desc: 'Operações de Crédito' },
  // Deduções da Receita (classe 9)
  { prefixo: '9.1',             desc: 'Deduções da Receita Tributária' },
  { prefixo: '9.2',             desc: 'Deduções da Receita de Contribuições' },
  { prefixo: '9.3',             desc: 'Deduções da Receita Patrimonial' },
  { prefixo: '9.7',             desc: 'Deduções de Transferências Correntes' },
  { prefixo: '9.9',             desc: 'Deduções de Outras Receitas Correntes' },
];

function getSubgrupoKey(cod: string): string {
  for (const s of SUBGRUPO_MAP) {
    if (cod.startsWith(s.prefixo)) return s.prefixo;
  }
  return cod.split('.').slice(0, 2).join('.');
}
function getSubgrupoDesc(k: string): string {
  return SUBGRUPO_MAP.find(s => s.prefixo === k)?.desc ?? k;
}
function getGrupoKey(cod: string): '1' | '2' {
  return cod.startsWith('1.') ? '1' : '2';
}

// Abrevia descrições longas de rubricas para a aba Analítica
function abreviarDesc(desc: string): string {
  return desc
    // SUS Manutenção
    .replace(/^Transferência[s]? de Recursos do SUS\s*[-–]\s*/i, '')
    // SUS Bloco Unificado (desc longa)
    .replace(/^Transferências de Recursos do Sistema Único de Saúde\s*[-–]\s*SUS destinados à\s*/i, '')
    // Bloco Estruturação
    .replace(/^Transferências de Recursos do Bloco de Estruturação da Rede de Serviços Públicos de Saúde\s*[-–]\s*/i, 'Estruturação — ')
    // Remuneração depósitos
    .replace(/^Remuneração de Depósitos Bancários de Recursos Vinculados\s*[-–]\s*/i, 'Rem. Dep. Vinculados — ')
    .replace(/^Remuneração de Depósitos Bancários\s*[-–]\s*/i, 'Rem. Dep. Bancários — ');
}

function agrupar(rows: DRERow[]): Grupo[] {
  const gMap  = new Map<string, Grupo>();
  const sgMap = new Map<string, SubGrupo>();
  const cMap  = new Map<string, Conta>();

  for (const row of rows) {
    const cod  = row.codigo_rubrica || '';
    const desc = row.descricao || '';
    const mi   = (row.mes || 1) - 1;
    const val  = Number(row.total) || 0;
    const fonte = row.fonte_recurso || '';

    const gKey  = getGrupoKey(cod);
    const sgKey = getSubgrupoKey(cod);

    if (!gMap.has(gKey)) {
      gMap.set(gKey, { cod: gKey, desc: gKey === '1' ? 'RECEITAS CORRENTES' : 'RECEITAS DE CAPITAL / EXTRA-ORÇ.', meses: Array(12).fill(0), subgrupos: [] });
    }
    const g = gMap.get(gKey)!;
    g.meses[mi] += val;

    const sgMapKey = gKey + '|' + sgKey;
    if (!sgMap.has(sgMapKey)) {
      const sg: SubGrupo = { cod: sgKey, desc: getSubgrupoDesc(sgKey), meses: Array(12).fill(0), contas: [] };
      sgMap.set(sgMapKey, sg);
      g.subgrupos.push(sg);
    }
    const sg = sgMap.get(sgMapKey)!;
    sg.meses[mi] += val;

    const cKey = sgMapKey + '|' + cod + '|' + fonte;
    if (!cMap.has(cKey)) {
      const c: Conta = { cod, desc, fonte, meses: Array(12).fill(0) };
      cMap.set(cKey, c);
      sg.contas.push(c);
    } else {
      // Mantém a descrição mais longa entre arquivos do mesmo período
      const existing = cMap.get(cKey)!;
      if (desc.length > existing.desc.length) existing.desc = desc;
    }
    cMap.get(cKey)!.meses[mi] += val;
  }

  // Remove entradas sem valor
  for (const g of gMap.values()) {
    g.subgrupos = g.subgrupos.filter(sg => {
      sg.contas = sg.contas.filter(c => soma(c.meses) > 0);
      return soma(sg.meses) > 0;
    });
  }

  return Array.from(gMap.values())
    .filter(g => soma(g.meses) > 0)
    .sort((a, b) => a.cod.localeCompare(b.cod));
}

function soma(meses: number[]): number { return meses.reduce((a, v) => a + v, 0); }
function mesesExecutados(meses: number[]): number { return Math.max(1, meses.filter(v => v > 0).length); }
function media(meses: number[]): number { return soma(meses) / mesesExecutados(meses); }

// Converte rows de transferência bancária em Grupo[] para inserir na DRE
function agruparTransf(rows: TransfDRERow[]): Grupo[] {
  if (rows.length === 0) return [];

  // Um único grupo "TRANSFERÊNCIAS BANCÁRIAS"
  const grupo: Grupo = {
    cod: 'TB',
    desc: 'TRANSFERÊNCIAS BANCÁRIAS',
    meses: Array(12).fill(0),
    subgrupos: [],
  };

  const sgMap = new Map<string, SubGrupo>();
  const cMap  = new Map<string, Conta>();

  for (const row of rows) {
    const mi  = (row.mes || 1) - 1;
    const val = Number(row.total) || 0;
    const sgKey = row.tipo_lancamento || 'SEM TIPO';
    const cKey  = sgKey + '|' + (row.conta_origem_nome || 'SEM CONTA');
    const fonte = row.fonte_origem || '';

    grupo.meses[mi] += val;

    if (!sgMap.has(sgKey)) {
      const sg: SubGrupo = { cod: sgKey, desc: sgKey, meses: Array(12).fill(0), contas: [] };
      sgMap.set(sgKey, sg);
      grupo.subgrupos.push(sg);
    }
    const sg = sgMap.get(sgKey)!;
    sg.meses[mi] += val;

    const fullCKey = cKey + '|' + fonte;
    if (!cMap.has(fullCKey)) {
      const c: Conta = { cod: sgKey, desc: row.conta_origem_nome || 'SEM CONTA', fonte, meses: Array(12).fill(0) };
      cMap.set(fullCKey, c);
      sg.contas.push(c);
    }
    cMap.get(fullCKey)!.meses[mi] += val;
  }

  return [grupo];
}

// ─── Componentes de UI ────────────────────────────────────────────────────────

function EmptyState({ href, label }: { href: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <InboxIcon size={28} className="text-gray-300" />
      </div>
      <h3 className="text-base font-semibold text-gray-500 mb-1">Nenhuma receita importada</h3>
      <p className="text-sm text-gray-400 mb-5">Importe uma Listagem de Receita Arrecadada do FATOR para visualizar os dados.</p>
      <Link href={href} className="flex items-center gap-2 px-4 py-2 bg-[#C9A84C] hover:bg-[#b8953d] text-white text-sm font-semibold rounded-xl transition-colors">
        <Upload size={15} />{label}
      </Link>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '10px', color: '#94a3b8' }}>
      <Loader2 size={20} className="animate-spin" />
      <span style={{ fontSize: '13px' }}>Carregando dados...</span>
    </div>
  );
}

function SummaryCards({ summary, loading, ano, totalTransf = 0 }: { summary: Summary | null; loading: boolean; ano: string; totalTransf?: number }) {
  const totalOrc   = summary ? Number(summary.valor_orc)   : 0;
  const totalExtra = summary ? Number(summary.valor_extra) : 0;
  const totalGeral = totalOrc + totalExtra + totalTransf;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: 'Previsto Anual',          value: '—',                                              sub: 'Orçamento LOA ' + ano,               icon: <Target      size={19} className="text-blue-600"    />, bg: 'bg-blue-50',    bgStyle: undefined },
        { label: 'Total Arrecadado',        value: totalGeral > 0 ? 'R$ '+fmtFull(totalGeral) : '—', sub: 'Orc. + Extra + Transf.',             icon: <TrendingUp  size={19} className="text-emerald-600" />, bg: 'bg-emerald-50', bgStyle: undefined },
        { label: 'Orçamentária',            value: totalOrc   > 0 ? 'R$ '+fmtFull(totalOrc)   : '—', sub: `${summary?.total_registros ?? 0} registros`, icon: <BarChart2   size={19} className="text-[#0F2A4E]"  />, bg: '',              bgStyle: { background: 'rgba(15,42,78,0.08)' } },
        { label: 'Transf. Bancária',        value: totalTransf > 0 ? 'R$ '+fmtFull(totalTransf) : '—', sub: 'Transferências financeiras',       icon: <AlertCircle size={19} className="text-amber-600"   />, bg: 'bg-amber-50',   bgStyle: undefined },
      ].map((card, i) => (
        <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-start gap-3 hover:shadow-md transition-shadow">
          <div className={`w-11 h-11 ${card.bg} rounded-xl flex items-center justify-center flex-shrink-0`} style={card.bgStyle}>{card.icon}</div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-400 mb-0.5">{card.label}</p>
            <p className="text-xl font-bold text-[#0F2A4E] leading-tight">{loading ? '...' : card.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tabela DRE reutilizável ──────────────────────────────────────────────────

function TabelaDRE({
  grupos, titulo, ano, showFonte = false,
}: {
  grupos: Grupo[]; titulo: string; ano: string; showFonte?: boolean;
}) {
  const [gruposOpen,    setGruposOpen]    = useState<Record<string, boolean>>({});
  const [subgruposOpen, setSubgruposOpen] = useState<Record<string, boolean>>({});

  const totaisMeses = MESES.map((_, i) => grupos.reduce((acc, g) => acc + g.meses[i], 0));
  const totalGeral  = soma(totaisMeses);

  if (grupos.length === 0) return null;

  return (
    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={16} color="rgba(255,255,255,0.6)" />
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>{titulo} — {ano}</span>
        </div>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
          {grupos.reduce((acc, g) => acc + g.subgrupos.reduce((a, sg) => a + sg.contas.length, 0), 0)} rubricas
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: showFonte ? '260px' : '300px' }} />
            {showFonte && <col style={{ width: '55px' }} />}
            {MESES.map((_, i) => <col key={i} style={{ width: '60px' }} />)}
            <col style={{ width: '88px' }} />
            <col style={{ width: '65px' }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#0F2A4E' }}>
              <th style={{ padding: '9px 14px', textAlign: 'left', color: '#e2e8f0', fontWeight: 600, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Rubrica / Descrição</th>
              {showFonte && <th style={{ padding: '9px 6px', textAlign: 'center', color: '#e2e8f0', fontWeight: 600, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Fonte</th>}
              {MESES.map(m => (
                <th key={m} style={{ padding: '9px 6px', textAlign: 'right', color: '#e2e8f0', fontWeight: 600, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{m}</th>
              ))}
              <th style={{ padding: '9px 8px', textAlign: 'right', color: '#fde68a', fontWeight: 600, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase', borderLeft: '1px solid rgba(255,255,255,0.12)' }}>Total</th>
              <th style={{ padding: '9px 6px', textAlign: 'right', color: '#fde68a', fontWeight: 600, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Média</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map(grupo => {
              const gTotal = soma(grupo.meses);
              const gOpen  = gruposOpen[grupo.cod] !== false;
              return (
                <React.Fragment key={grupo.cod}>
                  {/* N1 — Grupo */}
                  <tr onClick={() => setGruposOpen(p => ({ ...p, [grupo.cod]: !gOpen }))} style={{ background: '#0F2A4E', cursor: 'pointer', userSelect: 'none' }}>
                    <td style={{ padding: '10px 6px', color: '#fff', fontWeight: 700, fontSize: '11px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 0 }} title={grupo.desc}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <ChevronRight size={13} color="rgba(255,255,255,0.5)" style={{ flexShrink: 0, transition: 'transform 0.15s', transform: gOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                        <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{grupo.desc}</span>
                      </div>
                    </td>
                    {showFonte && <td style={{ padding: '10px 6px', color: 'rgba(255,255,255,0.3)' }} />}
                    {grupo.meses.map((v, i) => (
                      <td key={i} style={{ padding: '10px 6px', textAlign: 'right', color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v > 0 ? fmtFull(v) : '—'}</td>
                    ))}
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#fff', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderLeft: '1px solid rgba(255,255,255,0.12)' }}>{gTotal > 0 ? fmtFull(gTotal) : '—'}</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{gTotal > 0 ? fmtFull(media(grupo.meses)) : '—'}</td>
                  </tr>

                  {gOpen && grupo.subgrupos.map(sg => {
                    const sgTotal = soma(sg.meses);
                    const sgKey   = grupo.cod + '|' + sg.cod;
                    const sgOpen  = subgruposOpen[sgKey] !== false;
                    return (
                      <React.Fragment key={sgKey}>
                        {/* N2 — Subgrupo */}
                        <tr
                          onClick={() => setSubgruposOpen(p => ({ ...p, [sgKey]: !sgOpen }))}
                          style={{ background: '#f1f5f9', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #e2e8f0' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#e8effa')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#f1f5f9')}
                        >
                          <td style={{ padding: '9px 6px 9px 16px', color: '#0F2A4E', fontWeight: 600, fontSize: '11px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 0 }} title={sg.desc}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <ChevronRight size={11} color="rgba(15,42,78,0.4)" style={{ flexShrink: 0, transition: 'transform 0.15s', transform: sgOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                              <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{sg.desc}</span>
                            </div>
                          </td>
                          {showFonte && <td style={{ padding: '9px 6px' }} />}
                          {sg.meses.map((v, i) => (
                            <td key={i} style={{ padding: '9px 6px', textAlign: 'right', color: v > 0 ? '#1e293b' : '#e2e8f0', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v > 0 ? fmtFull(v) : '—'}</td>
                          ))}
                          <td style={{ padding: '9px 8px', textAlign: 'right', color: '#0F2A4E', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderLeft: '1px solid #e2e8f0' }}>{sgTotal > 0 ? fmtFull(sgTotal) : '—'}</td>
                          <td style={{ padding: '9px 6px', textAlign: 'right', color: '#7c3aed', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{sgTotal > 0 ? fmtFull(media(sg.meses)) : '—'}</td>
                        </tr>

                        {/* N3 — Contas */}
                        {sgOpen && sg.contas.map(conta => {
                          const cTotal = soma(conta.meses);
                          return (
                            <tr key={conta.cod + conta.fonte}
                              style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', transition: 'background 0.12s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                            >
                              <td style={{ padding: '8px 6px 8px 28px', color: '#475569', fontSize: '11px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 0 }} title={conta.desc}>{showFonte ? abreviarDesc(conta.desc) : conta.desc}</td>
                              {showFonte && (
                                <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#0F2A4E', background: '#e8effa', borderRadius: '6px', padding: '2px 6px' }}>{conta.fonte || '—'}</span>
                                </td>
                              )}
                              {conta.meses.map((v, i) => (
                                <td key={i} style={{ padding: '8px 6px', textAlign: 'right', color: v > 0 ? '#334155' : '#e2e8f0', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v > 0 ? fmtFull(v) : '—'}</td>
                              ))}
                              <td style={{ padding: '8px 8px', textAlign: 'right', color: '#C9A84C', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderLeft: '1px solid #e2e8f0' }}>{cTotal > 0 ? fmtFull(cTotal) : '—'}</td>
                              <td style={{ padding: '8px 6px', textAlign: 'right', color: '#7c3aed', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{cTotal > 0 ? fmtFull(media(conta.meses)) : '—'}</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Total Geral */}
            <tr style={{ background: '#dbeafe', borderTop: '2px solid #93c5fd' }}>
              <td colSpan={showFonte ? 2 : 1} style={{ padding: '10px 14px', color: '#1e3a5f', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap' }}>TOTAL GERAL DA RECEITA</td>
              {totaisMeses.map((v, i) => (
                <td key={i} style={{ padding: '10px 6px', textAlign: 'right', color: v > 0 ? '#1e3a5f' : '#bfdbfe', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v > 0 ? fmtFull(v) : '—'}</td>
              ))}
              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderLeft: '1px solid #93c5fd' }}>{totalGeral > 0 ? fmtFull(totalGeral) : '—'}</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{totalGeral > 0 ? fmtFull(media(totaisMeses)) : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
        <p style={{ fontSize: '11px', color: '#94a3b8' }}>Fonte: FATOR · Exercício: {ano}</p>
      </div>
    </div>
  );
}

// ─── Aba Sintética (apenas subgrupos, sem detalhar contas) ────────────────────

function TabelaSintetica({ grupos, titulo, ano }: { grupos: Grupo[]; titulo: string; ano: string }) {
  const [gruposOpen, setGruposOpen] = useState<Record<string, boolean>>({});
  const totaisMeses = MESES.map((_, i) => grupos.reduce((acc, g) => acc + g.meses[i], 0));
  const totalGeral  = soma(totaisMeses);
  if (grupos.length === 0) return null;

  return (
    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={16} color="rgba(255,255,255,0.6)" />
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>{titulo} — {ano}</span>
        </div>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
          {grupos.reduce((acc, g) => acc + g.subgrupos.length, 0)} subgrupos
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '240px' }} />
            {MESES.map((_, i) => <col key={i} style={{ width: '62px' }} />)}
            <col style={{ width: '92px' }} />
            <col style={{ width: '68px' }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#0F2A4E' }}>
              <th style={{ padding: '9px 14px', textAlign: 'left', color: '#e2e8f0', fontWeight: 600, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Rubrica / Descrição</th>
              {MESES.map(m => <th key={m} style={{ padding: '9px 6px', textAlign: 'right', color: '#e2e8f0', fontWeight: 600, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{m}</th>)}
              <th style={{ padding: '9px 8px', textAlign: 'right', color: '#fde68a', fontWeight: 600, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase', borderLeft: '1px solid rgba(255,255,255,0.12)' }}>Total</th>
              <th style={{ padding: '9px 6px', textAlign: 'right', color: '#fde68a', fontWeight: 600, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Média</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map(grupo => {
              const gTotal = soma(grupo.meses);
              const gOpen  = gruposOpen[grupo.cod] !== false;
              return (
                <React.Fragment key={grupo.cod}>
                  <tr onClick={() => setGruposOpen(p => ({ ...p, [grupo.cod]: !gOpen }))} style={{ background: '#0F2A4E', cursor: 'pointer', userSelect: 'none' }}>
                    <td style={{ padding: '10px 14px', color: '#fff', fontWeight: 700, fontSize: '11px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <ChevronRight size={13} color="rgba(255,255,255,0.5)" style={{ flexShrink: 0, transition: 'transform 0.15s', transform: gOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                        <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{grupo.desc}</span>
                      </div>
                    </td>
                    {grupo.meses.map((v, i) => <td key={i} style={{ padding: '10px 6px', textAlign: 'right', color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v > 0 ? fmtFull(v) : '—'}</td>)}
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#fff', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderLeft: '1px solid rgba(255,255,255,0.12)' }}>{gTotal > 0 ? fmtFull(gTotal) : '—'}</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{gTotal > 0 ? fmtFull(media(grupo.meses)) : '—'}</td>
                  </tr>

                  {gOpen && grupo.subgrupos.map(sg => {
                    const sgTotal = soma(sg.meses);
                    return (
                      <tr key={sg.cod}
                        style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#eef4ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
                      >
                        <td style={{ padding: '9px 14px 9px 32px', color: '#1e293b', fontWeight: 500, fontSize: '11px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{sg.desc}</td>
                        {sg.meses.map((v, i) => <td key={i} style={{ padding: '9px 6px', textAlign: 'right', color: v > 0 ? '#334155' : '#e2e8f0', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v > 0 ? fmtFull(v) : '—'}</td>)}
                        <td style={{ padding: '9px 8px', textAlign: 'right', color: '#0F2A4E', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderLeft: '1px solid #e2e8f0' }}>{sgTotal > 0 ? fmtFull(sgTotal) : '—'}</td>
                        <td style={{ padding: '9px 6px', textAlign: 'right', color: '#7c3aed', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{sgTotal > 0 ? fmtFull(media(sg.meses)) : '—'}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
            <tr style={{ background: '#dbeafe', borderTop: '2px solid #93c5fd' }}>
              <td style={{ padding: '10px 14px', color: '#1e3a5f', fontWeight: 700, fontSize: '11px' }}>TOTAL GERAL DA RECEITA</td>
              {totaisMeses.map((v, i) => <td key={i} style={{ padding: '10px 6px', textAlign: 'right', color: v > 0 ? '#1e3a5f' : '#bfdbfe', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v > 0 ? fmtFull(v) : '—'}</td>)}
              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderLeft: '1px solid #93c5fd' }}>{totalGeral > 0 ? fmtFull(totalGeral) : '—'}</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{totalGeral > 0 ? fmtFull(media(totaisMeses)) : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
        <p style={{ fontSize: '11px', color: '#94a3b8' }}>Fonte: FATOR · Exercício: {ano}</p>
      </div>
    </div>
  );
}

// ─── Aba Geral ────────────────────────────────────────────────────────────────

function TabGeralReceita({
  dreRows, transfRows, summary, ano,
}: {
  dreRows: DRERow[];
  transfRows: TransfDRERow[];
  summary: Summary | null;
  ano: string;
}) {
  const orcRows   = dreRows.filter(r => r.tipo_receita === 'ORC');
  const extraRows = dreRows.filter(r => r.tipo_receita === 'EXTRA');

  const totalOrc    = summary ? Number(summary.valor_orc)   : 0;
  const totalExtra  = summary ? Number(summary.valor_extra) : 0;
  const totalTransf = transfRows.reduce((s, r) => s + Number(r.total), 0);
  const totalGeral  = totalOrc + totalExtra + totalTransf;

  // Evolução mensal (ORC + Transf)
  const mensal = MESES.map((_, i) => {
    const orc   = orcRows.filter(r => r.mes === i + 1).reduce((s, r) => s + Number(r.total), 0);
    const transf = transfRows.filter(r => r.mes === i + 1).reduce((s, r) => s + Number(r.total), 0);
    return orc + transf;
  });
  const maxMensal = Math.max(...mensal, 1);
  const ultimoMesIdx = mensal.map((v, i) => v > 0 ? i : -1).filter(i => i >= 0).pop() ?? -1;

  // Breakdown por subgrupo (top 6)
  const sgMap = new Map<string, number>();
  for (const r of orcRows) {
    const key = getSubgrupoDesc(getSubgrupoKey(r.codigo_rubrica));
    sgMap.set(key, (sgMap.get(key) ?? 0) + Number(r.total));
  }
  const topSubgrupos = Array.from(sgMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxSg = topSubgrupos[0]?.[1] ?? 1;

  // Média mensal (só meses com dados)
  const mesesComDados = mensal.filter(v => v > 0);
  const mediaMensal   = mesesComDados.length ? mesesComDados.reduce((a, v) => a + v, 0) / mesesComDados.length : 0;

  // Acumulado mensal para o gráfico de linha
  const acumulado = mensal.map((_, i) => mensal.slice(0, i + 1).reduce((a, v) => a + v, 0));
  const maxAcum   = acumulado[ultimoMesIdx >= 0 ? ultimoMesIdx : acumulado.length - 1] || 1;
  const mesesAtivos = ultimoMesIdx >= 0 ? ultimoMesIdx + 1 : 12;

  const cores = [
    '#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4',
  ];

  return (
    <div className="space-y-5">

      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ── Evolução Mensal ── */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0F2A4E]">Evolução Mensal</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Receita arrecadada por mês — {ano}</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <Calendar size={12} />
              {ultimoMesIdx >= 0 ? `Até ${MESES[ultimoMesIdx]}` : ano}
            </div>
          </div>

          {/* Barras */}
          <div className="flex items-end gap-1.5 h-36">
            {mensal.map((v, i) => {
              const pct = maxMensal > 0 ? (v / maxMensal) * 100 : 0;
              const isAtual = i === ultimoMesIdx;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip */}
                  {v > 0 && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#0F2A4E] text-white text-[10px] rounded-lg px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                      {fmtFull(v)}
                    </div>
                  )}
                  <div className="w-full relative" style={{ height: '112px', display: 'flex', alignItems: 'flex-end' }}>
                    <div
                      className="w-full rounded-t-lg transition-all duration-500"
                      style={{
                        height: pct > 0 ? `${Math.max(pct, 4)}%` : '3px',
                        background: isAtual
                          ? 'linear-gradient(180deg, #C9A84C, #e8c84a)'
                          : v > 0
                          ? 'linear-gradient(180deg, #3b82f6, #1d4ed8)'
                          : '#f1f5f9',
                        opacity: v > 0 ? 1 : 0.5,
                      }}
                    />
                  </div>
                  <span className={`text-[9px] font-medium ${isAtual ? 'text-[#C9A84C]' : 'text-gray-400'}`}>
                    {MESES[i]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Gráfico de linha — crescimento acumulado */}
          {mesesAtivos >= 1 && acumulado[ultimoMesIdx >= 0 ? ultimoMesIdx : 0] > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-gray-500">Crescimento Acumulado</span>
                <span className="text-[11px] font-bold text-emerald-600">
                  R$ {fmtFull(acumulado[ultimoMesIdx >= 0 ? ultimoMesIdx : 0])}
                </span>
              </div>
              <svg width="100%" height="64" viewBox="0 0 440 64" preserveAspectRatio="none" className="overflow-visible">
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {(() => {
                  const W = 440;
                  const H = 64;
                  const pad = 10;
                  const pts = acumulado.map((v, i) => {
                    const x = pad + (i / 11) * (W - pad * 2);
                    const y = v > 0 ? (H - pad) - (v / maxAcum) * (H - pad * 2) : H - pad;
                    return { x, y, v, hasData: mensal[i] > 0 };
                  });
                  // só pontos até o último mês com dados
                  const activePts = pts.slice(0, Math.max(ultimoMesIdx + 1, 1));
                  const pathD = [
                    `M ${activePts[0].x} ${H - pad}`,
                    ...activePts.map(p => `L ${p.x} ${p.y}`),
                    `L ${activePts[activePts.length - 1].x} ${H - pad}`,
                    'Z',
                  ].join(' ');
                  const lineD = activePts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  return (
                    <>
                      <path d={pathD} fill="url(#lineGrad)" />
                      <path d={lineD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                      {activePts.map((p, i) => p.hasData && (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r={i === ultimoMesIdx ? 5 : 3} fill={i === ultimoMesIdx ? '#C9A84C' : '#10b981'} />
                          {i === ultimoMesIdx && <circle cx={p.x} cy={p.y} r={9} fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeOpacity="0.35" />}
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
              <div className="flex justify-between mt-1">
                {MESES.map((m, i) => (
                  <span key={i} className={`text-[9px] ${i === ultimoMesIdx ? 'text-[#C9A84C] font-semibold' : 'text-gray-300'}`}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Legenda */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-500" />
              <span className="text-[10px] text-gray-400">Meses anteriores</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-[#C9A84C]" />
              <span className="text-[10px] text-gray-400">Último mês com dados</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-emerald-500" />
              <span className="text-[10px] text-gray-400">Acumulado</span>
            </div>
          </div>
        </div>

        {/* ── Composição da Receita ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[#0F2A4E]">Composição da Receita</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Participação de cada fonte</p>
          </div>

          <div className="space-y-1.5">
            {[
              { label: 'Orçamentária', value: totalOrc, color: '#3b82f6' },
              { label: 'Transf. Bancárias', value: totalTransf, color: '#f59e0b' },
              { label: 'Extra-Orçamentária', value: totalExtra, color: '#8b5cf6' },
            ].map((item) => {
              const pct = totalGeral > 0 ? (item.value / totalGeral) * 100 : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-[11px] text-gray-600">{item.label}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-700">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 mb-1">Total consolidado</p>
            <p className="text-base font-bold text-[#0F2A4E]">R$ {fmtFull(totalGeral)}</p>
          </div>
        </div>
      </div>

      {/* ── Top Subgrupos ── */}
      {topSubgrupos.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0F2A4E]">Principais Fontes de Receita</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Top {topSubgrupos.length} subgrupos por valor arrecadado</p>
            </div>
            <span className="text-[11px] text-gray-400">{ano}</span>
          </div>
          <div className="space-y-3">
            {topSubgrupos.map(([desc, valor], i) => {
              const pct = (valor / maxSg) * 100;
              const share = totalGeral > 0 ? ((valor / totalGeral) * 100).toFixed(1) : '0';
              return (
                <div key={desc} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ background: cores[i] }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-gray-700 truncate pr-2">{desc}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-gray-400">{share}%</span>
                        <span className="text-[11px] font-semibold text-[#0F2A4E]">{fmtFull(valor)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: cores[i], opacity: 0.85 }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Painel Analítica ─────────────────────────────────────────────────────────

const GRUPO_COLORS: Record<string, string> = {
  '1':  '#0F2A4E',
  '2':  '#C9A84C',
  'TB': '#3b82f6',
};

const GRUPO_AREA_COLORS = ['#0F2A4E', '#C9A84C', '#3b82f6'];

function CustomBarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0F2A4E', borderRadius: 10, padding: '8px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
      <p style={{ color: '#fff', fontSize: 11, fontWeight: 700, margin: 0 }}>R$ {fmtFull(payload[0].value)}</p>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, margin: '2px 0 0' }}>{payload[0].payload.fullName}</p>
    </div>
  );
}

function CustomAreaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0F2A4E', borderRadius: 12, padding: '10px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', minWidth: 160 }}>
      <p style={{ color: '#C9A84C', fontSize: 11, fontWeight: 700, margin: '0 0 6px' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: '#fff', fontSize: 11, margin: '2px 0', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{p.name}</span>
          <span style={{ fontWeight: 700 }}>{fmtK(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0F2A4E', borderRadius: 10, padding: '8px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
      <p style={{ color: '#C9A84C', fontSize: 11, fontWeight: 700, margin: 0 }}>{payload[0].name}</p>
      <p style={{ color: '#fff', fontSize: 11, margin: '2px 0 0' }}>R$ {fmtFull(payload[0].value)}</p>
    </div>
  );
}

function PainelAnalitica({ grupos }: { grupos: Grupo[] }) {
  if (grupos.length === 0) return null;

  // Top 8 subgrupos por valor
  const sgFlat: { name: string; fullName: string; value: number }[] = [];
  for (const g of grupos) {
    for (const sg of g.subgrupos) {
      const val = soma(sg.meses);
      if (val > 0) sgFlat.push({ name: sg.desc, fullName: sg.desc, value: val });
    }
  }
  const topSg = sgFlat.sort((a, b) => b.value - a.value).slice(0, 8);
  const maxTopSg = topSg[0]?.value ?? 1;

  // Composição por grupo (pie)
  const pieData = grupos.map(g => ({
    name: g.desc.replace('RECEITAS CORRENTES', 'Correntes').replace('RECEITAS DE CAPITAL / EXTRA-ORÇ.', 'Capital').replace('TRANSFERÊNCIAS BANCÁRIAS', 'Transf. Banc.'),
    value: soma(g.meses),
    cod: g.cod,
  })).filter(d => d.value > 0);

  const totalPie = pieData.reduce((s, d) => s + d.value, 0);

  // Evolução mensal por grupo (area chart)
  const areaData = MESES.map((mes, i) => {
    const entry: Record<string, any> = { mes };
    for (const g of grupos) {
      const label = g.desc.replace('RECEITAS CORRENTES', 'Correntes').replace('RECEITAS DE CAPITAL / EXTRA-ORÇ.', 'Capital').replace('TRANSFERÊNCIAS BANCÁRIAS', 'Transf. Banc.');
      entry[label] = g.meses[i];
    }
    return entry;
  });

  const grupoLabels = grupos.map(g =>
    g.desc.replace('RECEITAS CORRENTES', 'Correntes').replace('RECEITAS DE CAPITAL / EXTRA-ORÇ.', 'Capital').replace('TRANSFERÊNCIAS BANCÁRIAS', 'Transf. Banc.')
  );

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}
      className="grid-cols-1 md:grid-cols-2">

      {/* ── Top SubGrupos ── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <BarChart2 size={15} color="rgba(255,255,255,0.6)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Top Subgrupos</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 'auto', fontFamily: 'monospace' }}>por valor arrecadado</span>
        </div>
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {topSg.map((item, i) => {
            const pct = (item.value / maxTopSg) * 100;
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#1e293b', fontWeight: 500, lineHeight: 1.3 }}>{item.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0F2A4E', whiteSpace: 'nowrap', marginLeft: 12, flexShrink: 0 }}>{fmtK(item.value)}</span>
                </div>
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: 'linear-gradient(90deg, #1e4d95, #3b82f6)', transition: 'width 0.6s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Composição por Grupo PieChart ── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <PieChartIcon size={15} color="rgba(255,255,255,0.6)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Composição por Grupo</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 'auto', fontFamily: 'monospace' }}>participação %</span>
        </div>
        <div style={{ padding: '12px 16px 16px' }}>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                  const RADIAN = Math.PI / 180;
                  const radius = innerRadius + (outerRadius - innerRadius) * 1.45;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  return percent > 0.04 ? (
                    <text x={x} y={y} fill="#475569" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>
                      {(percent * 100).toFixed(0)}%
                    </text>
                  ) : null;
                }}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={entry.cod} fill={GRUPO_COLORS[entry.cod] ?? GRUPO_AREA_COLORS[index % 3]} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {pieData.map((entry, index) => (
              <div key={entry.cod} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: GRUPO_COLORS[entry.cod] ?? GRUPO_AREA_COLORS[index % 3], flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#475569' }}>{entry.name}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0F2A4E' }}>{fmtK(entry.value)}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Total</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#C9A84C' }}>{fmtK(totalPie)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Evolução Mensal AreaChart — col-span-2 ── */}
      <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
        <div style={headerStyle}>
          <Activity size={15} color="rgba(255,255,255,0.6)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Evolução por Grupo — Mês a Mês</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 'auto', fontFamily: 'monospace' }}>receita mensal por categoria</span>
        </div>
        <div style={{ padding: '12px 8px 12px 0' }}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={areaData} margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <defs>
                {grupoLabels.map((label, i) => (
                  <linearGradient key={label} id={`areaGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GRUPO_AREA_COLORS[i % 3]} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={GRUPO_AREA_COLORS[i % 3]} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={58} />
              <Tooltip content={<CustomAreaTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 12 }}
              />
              {grupoLabels.map((label, i) => (
                <Area
                  key={label}
                  type="monotone"
                  dataKey={label}
                  name={label}
                  stroke={GRUPO_AREA_COLORS[i % 3]}
                  strokeWidth={2.5}
                  fill={`url(#areaGrad${i})`}
                  dot={{ r: 3, fill: GRUPO_AREA_COLORS[i % 3], strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function ReceitasPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const { entidadeSelecionada, municipioSelecionado } = useMunicipioEntidade();

  const [ano,     setAno]     = useState(String(new Date().getFullYear()));
  const [activeTab, setActiveTab] = useState<TabId>('geral');
  const [loading, setLoading] = useState(true);
  const [dreRows, setDreRows] = useState<DRERow[]>([]);
  const [transfRows, setTransfRows] = useState<TransfDRERow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { ano };
      if (entidadeSelecionada?.id) params.entidadeId = String(entidadeSelecionada.id);
      else if (municipioSelecionado?.id) params.municipioId = String(municipioSelecionado.id);
      const [dreData, sumData, transfData] = await Promise.all([
        apiRequest<{ rows: DRERow[] }>('/receitas/dre', { token, params }),
        apiRequest<{ totais: Summary }>('/receitas/summary', { token, params }),
        apiRequest<{ rows: TransfDRERow[] }>('/transferencias-bancarias/dre', { token, params }).catch(() => ({ rows: [] })),
      ]);
      setDreRows(dreData.rows);
      setSummary(sumData.totais);
      setTransfRows(transfData.rows);
    } catch {
      setDreRows([]);
      setTransfRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [token, ano, entidadeSelecionada, municipioSelecionado]);

  useEffect(() => { load(); }, [load]);

  // Grupos por tipo
  const orcGrupos    = agrupar(dreRows.filter(r => r.tipo_receita === 'ORC'));
  const extraGrupos  = agrupar(dreRows.filter(r => r.tipo_receita === 'EXTRA'));
  const transfGrupos = agruparTransf(transfRows);
  // Analítica = ORC + Transferências Bancárias (sem EXTRA)
  const analiticaGrupos = [...orcGrupos, ...transfGrupos];
  const isEmpty      = !loading && dreRows.length === 0 && transfRows.length === 0;

  return (
    <div>
      <TopBar title="Receita Arrecadada" subtitle="Demonstrativo de Execução da Receita Orçamentária" />

      {/* ── Barra de Abas — pill style ── */}
      <div className="bg-white border-b border-slate-200 px-3 md:px-8 py-3 overflow-x-auto">
        <div style={{ display: 'flex', background: '#f8fafc', borderRadius: '14px', padding: '4px', border: '1px solid #e2e8f0', gap: '4px', width: 'fit-content' }}>
          {TABS.map(tab => {
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

      {/* ── Conteúdo das abas ── */}
      <div className="bg-slate-50 min-h-screen">
        {/* Cards + botões */}
        <div className="px-3 md:px-8 py-4 md:py-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-[#0F2A4E]">Receita Arrecadada</h1>
              <p className="text-sm text-gray-400 mt-0.5">Demonstrativo de Execução da Receita Orçamentária</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={ano}
                onChange={e => setAno(e.target.value)}
                className="text-sm border border-gray-200 bg-white rounded-xl px-3 py-2 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {['2024','2025','2026','2027'].map(y => <option key={y}>{y}</option>)}
              </select>
              <Link
                href="/importacao-receita"
                className="flex items-center gap-2 px-4 py-2 bg-[#C9A84C] hover:bg-[#b8953d] text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
              >
                <Upload size={15} />
                Importar
              </Link>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-xl shadow-sm transition-colors">
                <Download size={15} />
                Exportar
              </button>
            </div>
          </div>
          <SummaryCards summary={summary} loading={loading} ano={ano} totalTransf={transfRows.reduce((s, r) => s + Number(r.total), 0)} />
        </div>

        <div className="px-3 md:px-6 pb-4 md:pb-6 space-y-5">
          {loading ? (
            <LoadingState />
          ) : isEmpty ? (
            <EmptyState href="/importacao-receita" label="Ir para Importação de Receita" />
          ) : (
            <>
              {activeTab === 'geral' && (
                <TabGeralReceita
                  dreRows={dreRows}
                  transfRows={transfRows}
                  summary={summary}
                  ano={ano}
                />
              )}
              {activeTab === 'analitica' && (
                <>
                  <PainelAnalitica grupos={analiticaGrupos} />
                  <TabelaDRE grupos={analiticaGrupos} titulo="Receita Analítica" ano={ano} showFonte />
                </>
              )}
              {activeTab === 'sintetica' && (
                <TabelaSintetica grupos={[...orcGrupos, ...transfGrupos]} titulo="Receita Sintética — Orçamentária" ano={ano} />
              )}
              {activeTab === 'extra' && (
                extraGrupos.length > 0 ? (
                  <TabelaDRE grupos={extraGrupos} titulo="Receita Extra-Orçamentária (Retenções)" ano={ano} showFonte />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                    <AlertCircle size={32} className="mb-3 opacity-20" />
                    <p className="text-sm">Nenhuma receita extra-orçamentária no período.</p>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


