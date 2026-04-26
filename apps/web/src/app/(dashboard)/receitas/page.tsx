'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
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
  PieChart, Pie, Cell, Sector, AreaChart, Area, CartesianGrid, Legend, LabelList,
  RadialBarChart, RadialBar, Treemap, ScatterChart, Scatter, ZAxis,
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

// ─── InfoPopover ──────────────────────────────────────────────────────────────

function InfoPopover({ insights }: { insights: React.ReactNode }) {
  const [aberto, setAberto] = React.useState(false);
  const [fixado, setFixado] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function calcularPos() {
    if (!btnRef.current || !popoverRef.current) return;
    const btn = btnRef.current.getBoundingClientRect();
    const popW = popoverRef.current.offsetWidth || 300;
    const popH = popoverRef.current.offsetHeight || 200;
    const margin = 8;
    let left = btn.right - popW;
    if (left < margin) left = margin;
    if (left + popW > window.innerWidth - margin) left = window.innerWidth - popW - margin;
    let top = btn.bottom + 6;
    if (top + popH > window.innerHeight - margin) top = btn.top - popH - 6;
    if (top < margin) top = margin;
    setPos({ top, left });
  }

  React.useEffect(() => {
    if (!aberto) { setPos(null); return; }
    const frame = requestAnimationFrame(calcularPos);
    function onScroll() { calcularPos(); }
    window.addEventListener('scroll', onScroll, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll, true); };
  }, [aberto]);

  React.useEffect(() => {
    if (!fixado) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (!btnRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setAberto(false); setFixado(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [fixado]);

  function handleMouseEnter() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!fixado) setAberto(true);
  }
  function handleMouseLeave() {
    if (fixado) return;
    timerRef.current = setTimeout(() => setAberto(false), 150);
  }

  const popover = ReactDOM.createPortal(
    <div
      ref={popoverRef}
      onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
      onMouseLeave={() => { if (!fixado) timerRef.current = setTimeout(() => setAberto(false), 150); }}
      style={{
        position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999,
        visibility: (aberto && pos) ? 'visible' : 'hidden',
        pointerEvents: (aberto && pos) ? 'auto' : 'none',
        zIndex: 9999, width: '300px', background: '#fff',
        borderRadius: '12px', boxShadow: '0 8px 32px rgba(15,42,78,0.18)',
        border: '1px solid #e2e8f0', overflow: 'hidden',
      }}
    >
      <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>Como analisar</span>
        <button onClick={() => { setAberto(false); setFixado(false); }}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>
      <div style={{ padding: '12px 14px', fontSize: '11px', color: '#334155', lineHeight: 1.6 }}>{insights}</div>
    </div>,
    document.body
  );

  return (
    <div style={{ position: 'relative' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        ref={btnRef}
        onClick={() => { setFixado(f => !f); setAberto(a => !a); }}
        title="Como analisar"
        style={{
          width: '22px', height: '22px', borderRadius: '50%',
          background: aberto ? '#C9A84C' : 'rgba(255,255,255,0.15)',
          border: '1.5px solid rgba(255,255,255,0.35)',
          color: '#fff', fontSize: '11px', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s', flexShrink: 0,
        }}
      >?</button>
      {popover}
    </div>
  );
}

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
            {grupos.reduce((acc, g) => acc + g.subgrupos.reduce((a, sg) => a + sg.contas.length, 0), 0)} rubricas
          </span>
          <InfoPopover insights={<><strong>Receita Analítica — DRE Mensal</strong><br /><br />Demonstra a execução da receita arrecadada mês a mês, organizada em três níveis:<br /><br />• <strong>Grupo</strong>: Receitas Correntes, de Capital ou Transferências Bancárias<br />• <strong>Subgrupo</strong>: classificação por natureza (Tributária, SUS, Patrimonial…)<br />• <strong>Rubrica</strong>: código e fonte de recurso individuais<br /><br />💡 Clique nas linhas para expandir ou recolher. A coluna <strong>Média</strong> considera apenas os meses com receita registrada.</>} />
        </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
            {grupos.reduce((acc, g) => acc + g.subgrupos.length, 0)} subgrupos
          </span>
          <InfoPopover insights={<><strong>Receita Sintética</strong><br /><br />Visão resumida da receita agrupada por natureza, sem detalhar rubricas individuais.<br /><br />• <strong>Grupo</strong>: Receitas Correntes, de Capital ou Transferências Bancárias<br />• <strong>Subgrupo</strong>: classificação por natureza (Tributária, SUS, Patrimonial…)<br /><br />💡 Use esta visão para uma leitura rápida do desempenho por categoria. Para ver cada rubrica individualmente, acesse a aba <strong>Receita Analítica</strong>.</>} />
        </div>
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
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <Calendar size={12} />
                {ultimoMesIdx >= 0 ? `Até ${MESES[ultimoMesIdx]}` : ano}
              </div>
              <div style={{ background: '#0F2A4E', borderRadius: 6, padding: '2px 4px' }}>
                <InfoPopover insights={<><strong>Evolução Mensal da Receita</strong><br /><br />Barras mostram o total arrecadado em cada mês. A barra dourada indica o último mês com dados.<br /><br />📈 A linha verde mostra o crescimento acumulado no ano — ideal para projetar o total anual.<br /><br />💡 Meses com barra muito baixa podem indicar atraso no repasse ou na importação dos dados.</>} />
              </div>
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
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0F2A4E]">Composição da Receita</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Participação de cada fonte</p>
            </div>
            <div style={{ background: '#0F2A4E', borderRadius: 6, padding: '2px 4px' }}>
              <InfoPopover insights={<><strong>Composição da Receita</strong><br /><br />Divide o total arrecadado em três categorias:<br /><br />• <strong>Orçamentária</strong>: receitas previstas no orçamento (LOA)<br />• <strong>Transf. Bancárias</strong>: movimentações financeiras entre contas do município<br />• <strong>Extra-Orçamentária</strong>: retenções, depósitos judiciais e valores fora do orçamento<br /><br />💡 A receita Extra-Orçamentária não representa renda livre — são recursos de terceiros retidos temporariamente.</>} />
            </div>
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
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">{ano}</span>
              <div style={{ background: '#0F2A4E', borderRadius: 6, padding: '2px 4px' }}>
                <InfoPopover insights={<><strong>Principais Fontes de Receita</strong><br /><br />Ranking dos subgrupos que mais contribuíram para a arrecadação total.<br /><br />A barra horizontal representa o percentual em relação ao maior subgrupo. O número à direita mostra a fatia no total geral.<br /><br />⚠️ Dependência excessiva de um único subgrupo (ex: SUS) pode representar risco fiscal caso o repasse seja suspenso ou atrasado.</>} />
              </div>
            </div>
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
  function abreviarSubgrupo(name: string): string {
    return name
      .replace('TRANSFERÊNCIA FINANCEIRA RECEBIDA', 'Transf. Financeira Recebida')
      .replace('SUS — Atenção Primária (AB/APS)', 'SUS · At. Primária (AB/APS)')
      .replace('SUS — Atenção Especializada (MAC)', 'SUS · At. Especializada (MAC)')
      .replace('SUS — Bloco Unificado', 'SUS · Bloco Unificado')
      .replace('SUS — Estruturação (Bloco)', 'SUS · Estruturação')
      .replace('SUS — Assistência Farmacêutica', 'SUS · Assist. Farmacêutica')
      .replace('SUS — Atenção Primária', 'SUS · At. Primária')
      .replace('SUS — Gestão do SUS', 'SUS · Gestão')
      .replace('SUS — Vigilância em Saúde', 'SUS · Vigilância')
      .replace('SUS — Manutenção (Bloco)', 'SUS · Manutenção')
      .replace('Transferências dos Estados — SUS', 'Transf. Estados — SUS')
      .replace('Transferências da União', 'Transf. União')
      .replace('Transferências Correntes', 'Transf. Correntes')
      .replace('Transferências de Capital', 'Transf. Capital')
      .replace('Receita Patrimonial', 'Rec. Patrimonial')
      .replace('Receita Tributária', 'Rec. Tributária')
      .replace('Receitas Correntes Diversas', 'Rec. Diversas')
      .replace('Contribuições Previdenciárias (RGPS / ITAPREV)', 'Contrib. Previdenciárias')
      .replace('Operações de Crédito Interno', 'Op. Crédito Interno');
  }
  const topSg = sgFlat.sort((a, b) => b.value - a.value).slice(0, 8).map(s => ({
    ...s,
    name: abreviarSubgrupo(s.name),
  }));
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

      {/* ── Top SubGrupos BarChart ── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <BarChart2 size={15} color="rgba(255,255,255,0.6)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Top Subgrupos</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 'auto', fontFamily: 'monospace' }}>por valor arrecadado</span>
          <InfoPopover insights={<><strong>Top Subgrupos por Valor</strong><br /><br />Ranking dos 8 subgrupos com maior receita arrecadada no ano.<br /><br />💡 O tamanho da barra é proporcional ao valor — subgrupos maiores dominam a arrecadação.<br /><br />⚠️ Subgrupos SUS representam repasses federais vinculados — não podem ser usados livremente pelo município.</>} />
        </div>
        <div style={{ padding: '16px 8px 16px 0' }}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topSg} layout="vertical" margin={{ top: 0, right: 140, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1e4d95" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={200}
                tick={{ fontSize: 11, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
              />
              <defs>
                <filter id="barShadow" x="-5%" y="-50%" width="130%" height="200%">
                  <feDropShadow dx="2" dy="0" stdDeviation="4" floodColor="#3b82f6" floodOpacity="0.35" />
                </filter>
              </defs>
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
              <Bar dataKey="value" fill="url(#barGrad)" radius={[0, 8, 8, 0]} maxBarSize={28} isAnimationActive style={{ filter: 'url(#barShadow)' }}>
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(v: number) => `R$ ${fmtFull(v)}`}
                  style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Composição por Grupo PieChart ── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <PieChartIcon size={15} color="rgba(255,255,255,0.6)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Composição por Grupo</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 'auto', fontFamily: 'monospace' }}>participação %</span>
          <InfoPopover insights={<><strong>Composição por Grupo</strong><br /><br />Mostra a fatia de cada grande grupo no total da receita arrecadada:<br /><br />• <strong>Correntes</strong>: receitas tributárias, transferências SUS, patrimonial etc.<br />• <strong>Capital</strong>: operações de crédito e transferências de capital<br />• <strong>Transf. Bancárias</strong>: movimentações financeiras entre contas<br /><br />💡 Um município saudável tem a maior parte da receita em Correntes. Alta participação de Capital pode indicar endividamento ou investimentos pontuais.</>} />
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 20, alignItems: 'center' }}>
          {/* Donut */}
          <div style={{ flexShrink: 0, position: 'relative', width: 160, height: 160 }}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <defs>
                  {pieData.map((entry, index) => (
                    <linearGradient key={`pieGrad${index}`} id={`pieGrad${index}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={GRUPO_COLORS[entry.cod] ?? GRUPO_AREA_COLORS[index % 3]} stopOpacity={1} />
                      <stop offset="100%" stopColor={GRUPO_COLORS[entry.cod] ?? GRUPO_AREA_COLORS[index % 3]} stopOpacity={0.6} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  label={false}
                  labelLine={false}
                  isAnimationActive
                >
                  {pieData.map((entry, index) => (
                    <Cell key={entry.cod} fill={`url(#pieGrad${index})`} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Texto central */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap' }}>Total</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0F2A4E', whiteSpace: 'nowrap' }}>{fmtK(totalPie)}</div>
            </div>
          </div>

          {/* Legenda detalhada */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pieData.map((entry, index) => {
              const pct = totalPie > 0 ? (entry.value / totalPie) * 100 : 0;
              const color = GRUPO_COLORS[entry.cod] ?? GRUPO_AREA_COLORS[index % 3];
              return (
                <div key={entry.cod}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#1e293b', fontWeight: 500 }}>{entry.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>R$ {fmtFull(entry.value)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 38, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.7s ease' }} />
                  </div>
                </div>
              );
            })}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Total geral</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#C9A84C' }}>R$ {fmtFull(totalPie)}</span>
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
          <InfoPopover insights={<><strong>Evolução Mensal por Grupo</strong><br /><br />Compara a trajetória mensal de cada grupo de receita ao longo do ano.<br /><br />📈 Picos em determinados meses costumam refletir sazonalidade de repasses (ex: SUS paga por competência trimestral).<br /><br />💡 Meses com valor zero ainda não tiveram receita registrada ou importada.<br /><br />⚠️ Quedas bruscas podem indicar atraso de repasse federal ou falha na importação dos dados.</>} />
        </div>
        <div style={{ padding: '12px 8px 12px 0' }}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={areaData} margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <defs>
                {grupoLabels.map((label, i) => (
                  <linearGradient key={label} id={`areaGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GRUPO_AREA_COLORS[i % 3]} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={GRUPO_AREA_COLORS[i % 3]} stopOpacity={0.03} />
                  </linearGradient>
                ))}
                {grupoLabels.map((label, i) => (
                  <filter key={`shadow${i}`} id={`lineShadow${i}`} x="-20%" y="-50%" width="140%" height="200%">
                    <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor={GRUPO_AREA_COLORS[i % 3]} floodOpacity="0.4" />
                  </filter>
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
                  strokeWidth={3.5}
                  fill={`url(#areaGrad${i})`}
                  style={{ filter: `url(#lineShadow${i})` }}
                  dot={{ r: 4, fill: '#fff', stroke: GRUPO_AREA_COLORS[i % 3], strokeWidth: 2.5 }}
                  activeDot={{ r: 6, fill: '#fff', stroke: GRUPO_AREA_COLORS[i % 3], strokeWidth: 2.5 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}

// ─── Painel Sintética ─────────────────────────────────────────────────────────

const TRIMESTRES = ['Q1 (Jan-Mar)', 'Q2 (Abr-Jun)', 'Q3 (Jul-Set)', 'Q4 (Out-Dez)'];
const TRIMESTRE_MESES = [[0,1,2],[3,4,5],[6,7,8],[9,10,11]];

function CustomTooltipDark({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0F2A4E', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', minWidth: 160 }}>
      {label && <p style={{ color: '#C9A84C', fontSize: 11, fontWeight: 700, margin: '0 0 6px' }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: '#fff', fontSize: 11, margin: '2px 0', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{p.name}</span>
          <span style={{ fontWeight: 700 }}>R$ {fmtFull(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function PainelSintetica({ grupos }: { grupos: Grupo[] }) {
  if (grupos.length === 0) return null;

  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
  };
  const headerStyle: React.CSSProperties = {
    padding: '12px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)',
    display: 'flex', alignItems: 'center', gap: 8,
  };

  // ── 1. RadialBarChart — execução mensal vs média ──
  const todosMeses = MESES.map((_, i) => grupos.reduce((acc, g) => acc + g.meses[i], 0));
  const mediaMensal = todosMeses.filter(v => v > 0).reduce((a, v) => a + v, 0) / Math.max(1, todosMeses.filter(v => v > 0).length);
  const radialData = todosMeses.map((v, i) => ({
    mes: MESES[i],
    value: v,
    pct: mediaMensal > 0 ? Math.min(Math.round((v / mediaMensal) * 100), 150) : 0,
    fill: v === 0 ? '#e2e8f0' : v >= mediaMensal ? '#10b981' : '#f59e0b',
  })).filter(d => d.value > 0 || todosMeses.slice(0, todosMeses.indexOf(d.value) + 1).some(v => v > 0));

  // ── 2. Treemap — peso de cada subgrupo ──
  const treemapData = grupos.flatMap(g =>
    g.subgrupos.map(sg => ({
      name: sg.desc.length > 20 ? sg.desc.slice(0, 20) + '…' : sg.desc,
      fullName: sg.desc,
      size: soma(sg.meses),
      grupo: g.cod,
    }))
  ).filter(d => d.size > 0).sort((a, b) => b.size - a.size).slice(0, 12);

  const TREEMAP_COLORS: Record<string, string[]> = {
    '1':  ['#0F2A4E','#1e3d6e','#1e4d95','#2563b0','#3b82f6','#60a5fa'],
    '2':  ['#92400e','#b45309','#C9A84C','#d97706','#f59e0b','#fbbf24'],
    'TB': ['#1e40af','#2563b0','#3b82f6','#60a5fa'],
  };
  const colorCounters: Record<string, number> = {};
  const treemapWithColor = treemapData.map(d => {
    const palette = TREEMAP_COLORS[d.grupo] ?? TREEMAP_COLORS['1'];
    colorCounters[d.grupo] = (colorCounters[d.grupo] ?? 0);
    const color = palette[colorCounters[d.grupo] % palette.length];
    colorCounters[d.grupo]++;
    return { ...d, color };
  });

  // ── 3. BarChart Trimestral ──
  const trimData = TRIMESTRES.map((trim, ti) => {
    const entry: Record<string, any> = { trim };
    for (const g of grupos) {
      const label = g.desc.replace('RECEITAS CORRENTES', 'Correntes').replace('RECEITAS DE CAPITAL / EXTRA-ORÇ.', 'Capital').replace('TRANSFERÊNCIAS BANCÁRIAS', 'Transf. Banc.');
      entry[label] = TRIMESTRE_MESES[ti].reduce((acc, mi) => acc + g.meses[mi], 0);
    }
    return entry;
  });
  const trimLabels = grupos.map(g =>
    g.desc.replace('RECEITAS CORRENTES', 'Correntes').replace('RECEITAS DE CAPITAL / EXTRA-ORÇ.', 'Capital').replace('TRANSFERÊNCIAS BANCÁRIAS', 'Transf. Banc.')
  );

  // ── 4. Scatter — Regularidade vs Volume ──
  const scatterData = grupos.flatMap(g =>
    g.subgrupos.map(sg => ({
      regularidade: sg.meses.filter(v => v > 0).length,
      volume: soma(sg.meses),
      nome: sg.desc.length > 22 ? sg.desc.slice(0, 22) + '…' : sg.desc,
      fullName: sg.desc,
      grupo: g.cod,
    }))
  ).filter(d => d.volume > 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>

      {/* ── 1. RadialBarChart — Execução Mensal vs Média ── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <Activity size={15} color="rgba(255,255,255,0.6)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Execução Mensal vs Média</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 'auto', fontFamily: 'monospace' }}>% da média anual</span>
          <InfoPopover insights={<><strong>Execução Mensal vs Média</strong><br /><br />Cada barra radial representa um mês. O comprimento indica se aquele mês ficou acima ou abaixo da média mensal do ano.<br /><br />🟢 <strong>Verde</strong>: mês acima da média<br />🟡 <strong>Âmbar</strong>: mês abaixo da média<br /><br />💡 Meses consistentemente abaixo da média podem indicar sazonalidade de repasses ou atrasos na arrecadação.</>} />
        </div>
        <div style={{ padding: '16px', display: 'flex', gap: 16, alignItems: 'center' }}>
          <ResponsiveContainer width="55%" height={220}>
            <RadialBarChart
              cx="50%" cy="50%"
              innerRadius={20} outerRadius={100}
              data={radialData}
              startAngle={180} endAngle={-180}
            >
              <RadialBar dataKey="pct" background={{ fill: '#f1f5f9' }} isAnimationActive>
                {radialData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </RadialBar>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: '#0F2A4E', borderRadius: 10, padding: '8px 12px', fontSize: 11 }}>
                      <p style={{ color: '#C9A84C', fontWeight: 700, margin: 0 }}>{d.mes}</p>
                      <p style={{ color: '#fff', margin: '2px 0 0' }}>R$ {fmtFull(d.value)}</p>
                      <p style={{ color: 'rgba(255,255,255,0.6)', margin: '1px 0 0' }}>{d.pct}% da média</p>
                    </div>
                  );
                }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {radialData.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.fill, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: '#475569' }}>{d.mes}</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: d.fill }}>{d.pct}%</span>
              </div>
            ))}
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>Média mensal</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#0F2A4E', margin: '2px 0 0' }}>R$ {fmtFull(mediaMensal)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Distribuição por Subgrupo — Donut + Legenda ── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <PieChartIcon size={15} color="rgba(255,255,255,0.6)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Distribuição por Subgrupo</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 'auto', fontFamily: 'monospace' }}>top 8 por arrecadação</span>
          <InfoPopover insights={<><strong>Distribuição por Subgrupo</strong><br /><br />Exibe os 8 subgrupos de receita com maior arrecadação no ano, mostrando a participação relativa de cada um no total.<br /><br />• <strong>Donut</strong>: proporção visual de cada subgrupo<br />• <strong>Mini-barras</strong>: comparação proporcional entre os subgrupos<br /><br />💡 Passe o mouse sobre os itens para destacar a fatia correspondente no gráfico e ver o valor exato.</>} />
        </div>
        {(() => {
          const SG_PALETTE: Record<string, string[]> = {
            '1': ['#0F2A4E','#1e4d95','#2563b0','#3b82f6','#60a5fa'],
            '2': ['#92400e','#C9A84C','#f59e0b'],
            'TB': ['#1e3a8a','#1e4d95','#3b82f6','#60a5fa'],
          };
          const top8 = treemapData.slice(0, 8);
          const totalTop8 = top8.reduce((s, d) => s + d.size, 0);
          const maxVal = top8.length > 0 ? Math.max(...top8.map(d => d.size)) : 1;

          const getColor = (grupo: string, idx: number) => {
            const palette = SG_PALETTE[grupo] ?? SG_PALETTE['1'];
            return palette[idx % palette.length];
          };

          const sgColors = top8.map((d, i) => getColor(d.grupo, i));

          const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

          return (
            <div style={{ padding: '14px 16px 14px', display: 'flex', gap: 8, alignItems: 'center', minHeight: 200 }}>
              {/* Donut */}
              <div style={{ width: '42%', flexShrink: 0, position: 'relative' }}>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <defs>
                      {top8.map((d, i) => (
                        <linearGradient key={i} id={`sgGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={sgColors[i]} stopOpacity={1} />
                          <stop offset="100%" stopColor={sgColors[i]} stopOpacity={0.65} />
                        </linearGradient>
                      ))}
                      <filter id="sgShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0F2A4E" floodOpacity="0.18" />
                      </filter>
                    </defs>
                    <Pie
                      data={top8}
                      dataKey="size"
                      nameKey="fullName"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={82}
                      paddingAngle={2}
                      isAnimationActive={true}
                      animationBegin={100}
                      animationDuration={900}
                      activeIndex={activeIndex ?? undefined}
                      activeShape={(props: any) => {
                        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
                        return (
                          <Sector
                            cx={cx}
                            cy={cy}
                            innerRadius={innerRadius - 3}
                            outerRadius={outerRadius + 6}
                            startAngle={startAngle}
                            endAngle={endAngle}
                            fill={fill}
                            style={{ filter: 'url(#sgShadow)' }}
                          />
                        );
                      }}
                    >
                      {top8.map((d, i) => (
                        <Cell
                          key={i}
                          fill={`url(#sgGrad${i})`}
                          stroke="none"
                          style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                          opacity={activeIndex !== null && activeIndex !== i ? 0.45 : 1}
                          onMouseEnter={() => setActiveIndex(i)}
                          onMouseLeave={() => setActiveIndex(null)}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        const pct = totalTop8 > 0 ? (d.size / totalTop8 * 100).toFixed(1) : '0';
                        return (
                          <div style={{ background: '#0F2A4E', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
                            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>{d.fullName}</p>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>R$ {fmtFull(d.size)}</p>
                            <p style={{ margin: 0, fontSize: 10, color: '#C9A84C' }}>{pct}% do top 8</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Texto central */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F2A4E', lineHeight: 1.2 }}>R$ {fmtK(totalTop8)}</div>
                </div>
              </div>

              {/* Legenda */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, overflow: 'hidden' }}>
                {top8.map((d, i) => {
                  const color = sgColors[i];
                  const barW = maxVal > 0 ? (d.size / maxVal) * 100 : 0;
                  const isActive = activeIndex === i;
                  const isDimmed = activeIndex !== null && !isActive;
                  const truncName = d.fullName.length > 22 ? d.fullName.slice(0, 21) + '…' : d.fullName;
                  return (
                    <div
                      key={i}
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseLeave={() => setActiveIndex(null)}
                      style={{ opacity: isDimmed ? 0.5 : 1, transition: 'opacity 0.2s', cursor: 'default' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
                          boxShadow: isActive ? `0 0 0 2px ${color}55` : 'none',
                          transition: 'box-shadow 0.2s',
                        }} />
                        <span style={{
                          fontSize: 11, color: isActive ? '#0F2A4E' : '#475569',
                          fontWeight: isActive ? 600 : 400, flex: 1,
                          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                          transition: 'color 0.2s',
                        }} title={d.fullName}>{truncName}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: isActive ? color : '#0F2A4E',
                          fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                          transition: 'color 0.2s',
                        }}>R$ {fmtFull(d.size)}</span>
                      </div>
                      <div style={{ height: 3, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginLeft: 14 }}>
                        <div style={{
                          height: '100%', width: `${barW}%`,
                          background: `linear-gradient(90deg, ${color}, ${color}99)`,
                          borderRadius: 99,
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── 3. BarChart Trimestral — col-span-1 ── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <TrendingUp size={15} color="rgba(255,255,255,0.6)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Comparativo Trimestral</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 'auto', fontFamily: 'monospace' }}>por grupo de receita</span>
          <InfoPopover insights={<><strong>Comparativo Trimestral</strong><br /><br />Agrupa a receita em quatro trimestres e compara o desempenho de cada grupo.<br /><br />• <strong>Q1</strong>: Jan–Mar · <strong>Q2</strong>: Abr–Jun · <strong>Q3</strong>: Jul–Set · <strong>Q4</strong>: Out–Dez<br /><br />📈 Trimestres com queda podem refletir atrasos de repasse ou sazonalidade.<br /><br />💡 Q4 costuma ser o mais alto por conta de repasses de final de ano e 13º salário.</>} />
        </div>
        <div style={{ padding: '12px 8px 12px 0' }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trimData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <defs>
                {trimLabels.map((_, i) => (
                  <linearGradient key={i} id={`trimGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GRUPO_AREA_COLORS[i % 3]} stopOpacity={1} />
                    <stop offset="100%" stopColor={GRUPO_AREA_COLORS[i % 3]} stopOpacity={0.7} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="trim" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<CustomTooltipDark />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }} />
              {trimLabels.map((label, i) => (
                <Bar key={label} dataKey={label} name={label} fill={`url(#trimGrad${i})`} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 4. Scatter — Regularidade vs Volume ── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <Target size={15} color="rgba(255,255,255,0.6)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Regularidade vs Volume</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 'auto', fontFamily: 'monospace' }}>subgrupos por frequência</span>
          <InfoPopover insights={<><strong>Regularidade vs Volume</strong><br /><br />Cada ponto representa um subgrupo de receita.<br /><br />• <strong>Eixo X</strong>: quantos meses o subgrupo teve receita (1–12)<br />• <strong>Eixo Y</strong>: valor total arrecadado no ano<br /><br />🎯 <strong>Ideal</strong>: canto superior direito — alto volume e alta regularidade<br />⚠️ <strong>Atenção</strong>: alto volume mas poucos meses pode indicar receita pontual e não recorrente<br />💡 Passe o mouse nos pontos para ver o subgrupo.</>} />
        </div>
        <div style={{ padding: '12px 8px 12px 0' }}>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                type="number" dataKey="regularidade" name="Meses com receita"
                domain={[0, 12]} ticks={[1,2,3,4,5,6,7,8,9,10,11,12]}
                tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                label={{ value: 'meses com receita', position: 'insideBottom', offset: -4, fontSize: 9, fill: '#94a3b8' }}
              />
              <YAxis
                type="number" dataKey="volume" name="Volume"
                tickFormatter={fmtK} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={58}
              />
              <ZAxis range={[40, 200]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: '#0F2A4E', borderRadius: 10, padding: '8px 12px', fontSize: 11, maxWidth: 200 }}>
                      <p style={{ color: '#C9A84C', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{d.fullName}</p>
                      <p style={{ color: '#fff', margin: '4px 0 0' }}>R$ {fmtFull(d.volume)}</p>
                      <p style={{ color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>{d.regularidade} meses com receita</p>
                    </div>
                  );
                }}
              />
              {grupos.map((g, i) => (
                <Scatter
                  key={g.cod}
                  name={g.desc.replace('RECEITAS CORRENTES','Correntes').replace('RECEITAS DE CAPITAL / EXTRA-ORÇ.','Capital').replace('TRANSFERÊNCIAS BANCÁRIAS','Transf. Banc.')}
                  data={scatterData.filter(d => d.grupo === g.cod)}
                  fill={GRUPO_AREA_COLORS[i % 3]}
                  fillOpacity={0.8}
                />
              ))}
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 4 }} />
            </ScatterChart>
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
                  <TabelaDRE grupos={analiticaGrupos} titulo="Receita Analítica" ano={ano} showFonte />
                  <PainelAnalitica grupos={analiticaGrupos} />
                </>
              )}
              {activeTab === 'sintetica' && (
                <>
                  <TabelaSintetica grupos={[...orcGrupos, ...transfGrupos]} titulo="Receita Sintética — Orçamentária" ano={ano} />
                  <PainelSintetica grupos={[...orcGrupos, ...transfGrupos]} />
                </>
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


