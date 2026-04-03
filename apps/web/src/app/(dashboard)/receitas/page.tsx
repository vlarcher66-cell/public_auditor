'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Target, TrendingUp, BarChart2, AlertCircle,
  ChevronRight, Upload, Loader2, Download, InboxIcon,
  LayoutDashboard, Table2, Banknote,
} from 'lucide-react';
import TopBar from '@/components/dashboard/TopBar';
import { apiRequest } from '@/lib/api';
import Link from 'next/link';

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
  { prefixo: '1.3',             desc: 'Receita Patrimonial' },
  { prefixo: '1.6',             desc: 'Receita de Serviços' },
  { prefixo: '1.1',             desc: 'Receita Tributária' },
  { prefixo: '1.7.1.3.50',      desc: 'Transf. SUS — Manutenção (Bloco)' },
  { prefixo: '1.7.1.3.51',      desc: 'Transf. SUS — Estruturação (Bloco)' },
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
    }
    cMap.get(cKey)!.meses[mi] += val;
  }

  return Array.from(gMap.values()).sort((a, b) => a.cod.localeCompare(b.cod));
}

function soma(meses: number[]): number { return meses.reduce((a, v) => a + v, 0); }

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
                    <td style={{ padding: '10px 6px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{gTotal > 0 ? fmtFull(gTotal / 12) : '—'}</td>
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
                          <td style={{ padding: '9px 6px', textAlign: 'right', color: '#7c3aed', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{sgTotal > 0 ? fmtFull(sgTotal / 12) : '—'}</td>
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
                              <td style={{ padding: '8px 6px 8px 28px', color: '#475569', fontSize: '11px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 0 }} title={conta.desc}>{conta.desc}</td>
                              {showFonte && (
                                <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#0F2A4E', background: '#e8effa', borderRadius: '6px', padding: '2px 6px' }}>{conta.fonte || '—'}</span>
                                </td>
                              )}
                              {conta.meses.map((v, i) => (
                                <td key={i} style={{ padding: '8px 6px', textAlign: 'right', color: v > 0 ? '#334155' : '#e2e8f0', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v > 0 ? fmtFull(v) : '—'}</td>
                              ))}
                              <td style={{ padding: '8px 8px', textAlign: 'right', color: '#C9A84C', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderLeft: '1px solid #e2e8f0' }}>{cTotal > 0 ? fmtFull(cTotal) : '—'}</td>
                              <td style={{ padding: '8px 6px', textAlign: 'right', color: '#7c3aed', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{cTotal > 0 ? fmtFull(cTotal / 12) : '—'}</td>
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
              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{totalGeral > 0 ? fmtFull(totalGeral / 12) : '—'}</td>
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
                    <td style={{ padding: '10px 6px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{gTotal > 0 ? fmtFull(gTotal / 12) : '—'}</td>
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
                        <td style={{ padding: '9px 6px', textAlign: 'right', color: '#7c3aed', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{sgTotal > 0 ? fmtFull(sgTotal / 12) : '—'}</td>
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
              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#92400e', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{totalGeral > 0 ? fmtFull(totalGeral / 12) : '—'}</td>
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

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function ReceitasPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

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
  }, [token, ano]);

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
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 32px' }}>
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
        <div className="px-8 py-5 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-[#0F2A4E]">Receita Arrecadada</h1>
              <p className="text-sm text-gray-400 mt-0.5">Demonstrativo de Execução da Receita Orçamentária</p>
            </div>
            <div className="flex items-center gap-2">
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

        <div className="px-6 pb-6 space-y-5">
          {loading ? (
            <LoadingState />
          ) : isEmpty ? (
            <EmptyState href="/importacao-receita" label="Ir para Importação de Receita" />
          ) : (
            <>
              {activeTab === 'geral' && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
                    <BarChart2 size={28} className="text-[#C9A84C]" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-600 mb-1">Relatório Geral</h3>
                  <p className="text-sm text-gray-400">Em construção — em breve disponível.</p>
                </div>
              )}
              {activeTab === 'analitica' && (
                <TabelaDRE grupos={analiticaGrupos} titulo="Receita Analítica" ano={ano} showFonte />
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


