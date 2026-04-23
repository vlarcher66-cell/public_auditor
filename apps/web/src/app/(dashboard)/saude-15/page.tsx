'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  ShieldCheck, TrendingUp, AlertTriangle, Activity,
  ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import TopBar from '@/components/dashboard/TopBar';
import { apiRequest } from '@/lib/api';
import { useMunicipioEntidade } from '@/contexts/MunicipioEntidadeContext';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
  AreaChart, Area,
} from 'recharts';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const LIMITE = 15;
const META_IDEAL = 20;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface MesData {
  mes: number;
  baseCalc: number;
  baseBruta: number;
  deducoes: number;
  saude: number;
  minimo: number;
  superavit: number;
  percentual: number;
  detalhe: Record<string, number>;
  temDados: boolean;
}

interface Acumulado {
  baseCalc: number;
  saude: number;
  minimo: number;
  superavit: number;
  percentual: number;
}

interface Indice15Data {
  ano: number;
  matrix: MesData[];
  acumulado: Acumulado;
  detalheAnual: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtM(v: number) {
  if (Math.abs(v) >= 1_000_000) return 'R$ ' + (v / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(v) >= 1_000)     return 'R$ ' + (v / 1_000).toFixed(1) + 'K';
  return 'R$ ' + fmt(v);
}
function fmtPct(v: number) { return v.toFixed(2) + '%'; }

function statusConfig(pct: number) {
  if (pct === 0)    return { color: '#94a3b8', bg: '#f1f5f9', label: 'Sem dados',  icon: '—' };
  if (pct >= META_IDEAL) return { color: '#10b981', bg: '#ecfdf5', label: 'Excelente', icon: '✦' };
  if (pct >= LIMITE)     return { color: '#0F2A4E', bg: '#eff6ff', label: 'Cumprido',  icon: '✓' };
  if (pct >= 12)         return { color: '#f59e0b', bg: '#fffbeb', label: 'Atenção',   icon: '⚠' };
  return                        { color: '#ff2d2d', bg: '#fff1f1', label: 'Déficit',   icon: '✕' };
}

// ─── Tooltip customizado ──────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0F2A4E', borderRadius: '12px', padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', minWidth: '220px' }}>
      <p style={{ color: '#93c5fd', fontSize: '11px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>{p.name}</span>
          <span style={{ color: p.color || '#fff', fontSize: '11px', fontWeight: 700 }}>
            {p.name === '% Aplicado' || p.name === 'Mínimo (15%)' || p.name === 'pct'
              ? fmtPct(p.value)
              : 'R$ ' + fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Gauge SVG ────────────────────────────────────────────────────────────────

function GaugeMeter({ pct }: { pct: number }) {
  const capped   = Math.min(pct, 40);
  const angle    = (capped / 40) * 180;
  const r        = 80;
  const cx = 100; const cy = 100;
  const toRad    = (d: number) => (d * Math.PI) / 180;
  const needleX  = cx + r * Math.cos(toRad(180 - angle));
  const needleY  = cy - r * Math.sin(toRad(180 - angle));
  const status   = statusConfig(pct);

  return (
    <svg viewBox="0 0 200 120" style={{ width: '100%', maxWidth: '280px' }}>
      <defs>
        <linearGradient id="arcRed" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff2d2d" />
          <stop offset="100%" stopColor="#ff6b00" />
        </linearGradient>
        <linearGradient id="arcYellow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <linearGradient id="arcGreen" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Arco fundo */}
      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e8edf5" strokeWidth="16" strokeLinecap="round" />
      {/* Arco vermelho 0-15% */}
      <path d="M 20 100 A 80 80 0 0 1 100 20" fill="none" stroke="url(#arcRed)" strokeWidth="14" strokeLinecap="round" strokeDasharray="125.6 251.2" strokeDashoffset="0" />
      {/* Arco amarelo 15-20% */}
      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#arcYellow)" strokeWidth="14" strokeLinecap="round" strokeDasharray="62.8 251.2" strokeDashoffset="-125.6" />
      {/* Arco verde 20%+ */}
      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#arcGreen)" strokeWidth="14" strokeLinecap="round" strokeDasharray="62.8 251.2" strokeDashoffset="-188.4" />
      {/* Marcador 15% */}
      <line x1="100" y1="22" x2="100" y2="34" stroke="#0F2A4E" strokeWidth="2" />
      <text x="100" y="44" textAnchor="middle" fontSize="8" fill="#0F2A4E" fontWeight="700">15%</text>
      {/* Agulha com brilho */}
      {pct > 0 && (
        <>
          <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={status.color} strokeWidth="3.5" strokeLinecap="round" filter="url(#glow)" />
          <circle cx={cx} cy={cy} r="7" fill={status.color} filter="url(#glow)" />
          <circle cx={cx} cy={cy} r="4" fill="#fff" />
        </>
      )}
      {/* Valor */}
      <text x="100" y="88" textAnchor="middle" fontSize="22" fontWeight="800" fill={status.color}>
        {pct > 0 ? fmtPct(pct) : '—'}
      </text>
      <text x="100" y="104" textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="600" letterSpacing="0.08em">
        {status.label.toUpperCase()}
      </text>
    </svg>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function Indice15Page() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const { entidadeSelecionada, municipioSelecionado } = useMunicipioEntidade();

  const [ano, setAno]       = useState(String(new Date().getFullYear()));
  const [data, setData]     = useState<Indice15Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMatriz, setShowMatriz] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { ano };
      if (entidadeSelecionada?.id) params.entidadeId = String(entidadeSelecionada.id);
      else if (municipioSelecionado?.id) params.municipioId = String(municipioSelecionado.id);
      const res = await apiRequest<Indice15Data>('/indice15', { token, params });
      setData(res);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [token, ano, entidadeSelecionada, municipioSelecionado]);

  useEffect(() => { load(); }, [load]);

  const mesesComDados = data?.matrix.filter(m => m.temDados) ?? [];
  const acum          = data?.acumulado;
  const statusAcum    = statusConfig(acum?.percentual ?? 0);

  // Dados para gráfico
  const chartData = (data?.matrix ?? []).map(m => ({
    mes:       MESES_LABELS[m.mes - 1],
    base:      m.baseCalc,
    saude:     m.saude,
    minimo:    m.minimo,
    pct:       m.percentual,
    limite:    LIMITE,
    temDados:  m.temDados,
  })).filter(d => d.temDados);

  // Dados acumulados para área
  let accBase = 0; let accSaude = 0;
  const areaData = (data?.matrix ?? []).filter(m => m.temDados).map(m => {
    accBase  += m.baseCalc;
    accSaude += m.saude;
    return {
      mes:    MESES_LABELS[m.mes - 1],
      base:   accBase,
      saude:  accSaude,
      minimo: accBase * 0.15,
      pct:    accBase > 0 ? (accSaude / accBase) * 100 : 0,
    };
  });

  return (
    <div style={{ fontFamily: "'Nunito', 'Segoe UI', sans-serif" }}>
      <TopBar title="Índice Constitucional de Saúde" subtitle="Acompanhamento do mínimo de 15% — Lei Complementar nº 141/2012" />

      {/* ── Barra de abas / controles ── */}
      <div className="px-3 md:px-8" style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {['Painel', 'Evolução', 'Matriz'].map((tab, i) => {
            const isActive = (i === 0 && showMatriz === true && false) || false; // controlled separately
            return (
              <div key={tab} style={{ padding: '14px 20px', fontSize: '13px', color: '#6b7280', cursor: 'default' }} />
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Exercício:</span>
          <select
            value={ano}
            onChange={e => setAno(e.target.value)}
            style={{ fontSize: '13px', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '6px 10px', color: '#0F2A4E', fontWeight: 600, background: '#fff', cursor: 'pointer' }}
          >
            {['2024','2025','2026','2027'].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="p-3 md:p-8" style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px', color: '#94a3b8' }}>
            <Activity size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '14px' }}>Calculando indicadores...</span>
          </div>
        ) : !data || mesesComDados.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}>
            <ShieldCheck size={48} style={{ color: '#cbd5e1' }} />
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Nenhum dado encontrado para {ano}.</p>
            <p style={{ color: '#cbd5e1', fontSize: '12px' }}>Importe as receitas da Prefeitura e do Fundo de Saúde.</p>
          </div>
        ) : (
          <>
            {/* ── LINHA 1: Gauge + Cards grandes ── */}
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5">

              {/* Gauge acumulado */}
              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Activity size={16} color="rgba(255,255,255,0.7)" />
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Acumulado {ano}</span>
                  <div style={{ marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%', background: statusAcum.color, boxShadow: `0 0 6px ${statusAcum.color}` }} />
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                <GaugeMeter pct={acum?.percentual ?? 0} />
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: '#94a3b8' }}>Base de cálculo</span>
                    <span style={{ fontWeight: 700, color: '#0F2A4E' }}>R$ {fmt(acum?.baseCalc ?? 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: '#94a3b8' }}>Mínimo obrigatório (15%)</span>
                    <span style={{ fontWeight: 700, color: '#dc2626' }}>R$ {fmt(acum?.minimo ?? 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: '#94a3b8' }}>Aplicado em saúde</span>
                    <span style={{ fontWeight: 700, color: '#059669' }}>R$ {fmt(acum?.saude ?? 0)}</span>
                  </div>
                  <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#94a3b8' }}>Superávit/Déficit</span>
                    <span style={{ fontWeight: 800, color: (acum?.superavit ?? 0) >= 0 ? '#059669' : '#dc2626' }}>
                      {(acum?.superavit ?? 0) >= 0 ? '+' : ''}R$ {fmt(acum?.superavit ?? 0)}
                    </span>
                  </div>
                </div>
                </div>
              </div>

              {/* Cards mensais grid */}
              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '16px 24px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={16} color="rgba(255,255,255,0.7)" />
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Situação por Mês — {ano}</span>
                  <span className="hidden md:flex ml-auto flex-wrap gap-1" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
                    <span style={{ background: '#ecfdf5', color: '#059669', borderRadius: '4px', padding: '1px 6px', fontSize: '9px', fontWeight: 800 }}>✦ ≥20% Excelente</span>
                    <span style={{ background: '#eff6ff', color: '#0F2A4E', borderRadius: '4px', padding: '1px 6px', fontSize: '9px', fontWeight: 800 }}>✓ ≥15% Cumprido</span>
                    <span style={{ background: '#fffbeb', color: '#d97706', borderRadius: '4px', padding: '1px 6px', fontSize: '9px', fontWeight: 800 }}>⚠ Atenção</span>
                    <span style={{ background: '#fef2f2', color: '#dc2626', borderRadius: '4px', padding: '1px 6px', fontSize: '9px', fontWeight: 800 }}>✕ Déficit</span>
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', padding: '16px', alignContent: 'start' }}>
                {data.matrix.map(m => {
                  const st = statusConfig(m.percentual);
                  const mesLabel = MESES_LABELS[m.mes - 1];
                  if (!m.temDados) return (
                    <div key={m.mes} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #f1f5f9', padding: '14px 12px', opacity: 0.4 }}>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{mesLabel}</p>
                      <p style={{ fontSize: '18px', fontWeight: 800, color: '#e2e8f0' }}>—</p>
                    </div>
                  );
                  return (
                    <div key={m.mes} style={{ background: '#fff', borderRadius: '14px', border: `1px solid ${st.color}22`, padding: '14px 12px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: st.color, borderRadius: '14px 14px 0 0' }} />
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{mesLabel}</p>
                      <p style={{ fontSize: '22px', fontWeight: 900, color: st.color, lineHeight: 1, marginBottom: '4px' }}>{fmtPct(m.percentual)}</p>
                      <p style={{ fontSize: '9px', fontWeight: 700, color: st.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{st.label}</p>
                      <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span>Saúde: <b style={{ color: '#059669' }}>R$ {fmt(m.saude)}</b></span>
                        <span>Mín: <b style={{ color: '#dc2626' }}>R$ {fmt(m.minimo)}</b></span>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>

            {/* ── LINHA 2: Matriz mensal ── */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <button
                onClick={() => setShowMatriz(p => !p)}
                style={{ width: '100%', padding: '16px 24px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={16} color="rgba(255,255,255,0.7)" />
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Matriz de Acompanhamento Mensal — Base de Cálculo × Saúde</span>
                </div>
                {showMatriz ? <ChevronUp size={16} color="rgba(255,255,255,0.6)" /> : <ChevronDown size={16} color="rgba(255,255,255,0.6)" />}
              </button>

              {showMatriz && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '200px' }} />
                      {MESES_LABELS.map((_, i) => <col key={i} />)}
                      <col style={{ width: '120px' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '7px 16px', textAlign: 'center', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Rubrica</th>
                        {MESES_LABELS.map(m => (
                          <th key={m} style={{ padding: '7px 8px', textAlign: 'center', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{m}</th>
                        ))}
                        <th style={{ padding: '7px 12px', textAlign: 'center', color: '#0F2A4E', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0', borderLeft: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Seção BASE DE CÁLCULO */}
                      <tr style={{ background: '#0F2A4E' }}>
                        <td colSpan={14} style={{ padding: '4px 16px', color: '#93c5fd', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          BASE DE CÁLCULO (IMPOSTOS)
                        </td>
                      </tr>
                      {Object.entries(data.detalheAnual)
                        .filter(([, v]) => v > 0)
                        .sort(([,a],[,b]) => b - a)
                        .map(([rubrica]) => (
                          <tr key={rubrica} style={{ borderBottom: '1px solid #f1f5f9' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                          >
                            <td style={{ padding: '9px 16px', color: '#334155', fontWeight: 500, wordBreak: 'break-word' }}>{rubrica}</td>
                            {MESES_LABELS.map((_, mi) => {
                              const m = data.matrix[mi];
                              const v = m.detalhe[rubrica] ?? 0;
                              return (
                                <td key={mi} style={{ padding: '9px 8px', textAlign: 'right', color: v > 0 ? '#334155' : '#e2e8f0', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                  {v > 0 ? fmt(v) : '—'}
                                </td>
                              );
                            })}
                            <td style={{ padding: '9px 12px', textAlign: 'right', color: '#0F2A4E', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderLeft: '2px solid #e2e8f0' }}>
                              {fmt(data.detalheAnual[rubrica] ?? 0)}
                            </td>
                          </tr>
                        ))}

                      {/* Linha total base */}
                      <tr style={{ background: '#dbeafe', borderTop: '2px solid #93c5fd' }}>
                        <td style={{ padding: '10px 16px', color: '#1e3a5f', fontWeight: 800, fontSize: '11px' }}>TOTAL BASE DE CÁLCULO</td>
                        {data.matrix.map((m, i) => (
                          <td key={i} style={{ padding: '10px 8px', textAlign: 'right', color: m.baseCalc > 0 ? '#1e3a5f' : '#bfdbfe', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {m.baseCalc > 0 ? fmt(m.baseCalc) : '—'}
                          </td>
                        ))}
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1e3a5f', fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderLeft: '2px solid #93c5fd' }}>
                          {fmt(acum?.baseCalc ?? 0)}
                        </td>
                      </tr>

                      {/* Mínimo 15% */}
                      <tr style={{ background: '#fef2f2', borderTop: '1px solid #fca5a5' }}>
                        <td style={{ padding: '10px 16px', color: '#991b1b', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ background: '#fca5a5', borderRadius: '4px', padding: '1px 6px', fontSize: '9px', fontWeight: 800 }}>MÍNIMO 15%</span>
                          <span>Mínimo Obrigatório — LC 141/2012</span>
                        </td>
                        {data.matrix.map((m, i) => (
                          <td key={i} style={{ padding: '10px 8px', textAlign: 'right', color: m.minimo > 0 ? '#991b1b' : '#fca5a5', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {m.minimo > 0 ? fmt(m.minimo) : '—'}
                          </td>
                        ))}
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#991b1b', fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderLeft: '2px solid #fca5a5' }}>
                          {fmt(acum?.minimo ?? 0)}
                        </td>
                      </tr>

                      {/* Saúde aplicada */}
                      <tr style={{ background: '#ecfdf5', borderTop: '1px solid #6ee7b7' }}>
                        <td style={{ padding: '10px 16px', color: '#065f46', fontWeight: 700, fontSize: '11px' }}>
                          <span style={{ background: '#6ee7b7', borderRadius: '4px', padding: '1px 6px', fontSize: '9px', fontWeight: 800, marginRight: '6px' }}>REPASSE</span>
                          Repasse ao Fundo de Saúde (FMS)
                        </td>
                        {data.matrix.map((m, i) => (
                          <td key={i} style={{ padding: '10px 8px', textAlign: 'right', color: m.saude > 0 ? '#065f46' : '#a7f3d0', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {m.saude > 0 ? fmt(m.saude) : '—'}
                          </td>
                        ))}
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#065f46', fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderLeft: '2px solid #6ee7b7' }}>
                          {fmt(acum?.saude ?? 0)}
                        </td>
                      </tr>

                      {/* % aplicado */}
                      <tr style={{ background: '#0F2A4E' }}>
                        <td style={{ padding: '12px 16px', color: '#fff', fontWeight: 800, fontSize: '12px' }}>% APLICADO EM SAÚDE</td>
                        {data.matrix.map((m, i) => {
                          const st = statusConfig(m.percentual);
                          return (
                            <td key={i} style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, fontSize: '12px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                              {m.percentual > 0 ? (
                                <span style={{ background: st.bg, color: st.color, borderRadius: '6px', padding: '2px 6px', fontSize: '11px', fontWeight: 800 }}>
                                  {fmtPct(m.percentual)}
                                </span>
                              ) : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
                            </td>
                          );
                        })}
                        <td style={{ padding: '12px 12px', textAlign: 'right', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                          <span style={{ background: statusAcum.bg, color: statusAcum.color, borderRadius: '8px', padding: '4px 10px', fontSize: '13px', fontWeight: 900 }}>
                            {fmtPct(acum?.percentual ?? 0)}
                          </span>
                        </td>
                      </tr>

                      {/* Superávit/Déficit */}
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                        <td style={{ padding: '10px 16px', color: '#475569', fontWeight: 700, fontSize: '11px' }}>Superávit / Déficit</td>
                        {data.matrix.map((m, i) => {
                          const pos = m.superavit >= 0;
                          return (
                            <td key={i} style={{ padding: '10px 8px', textAlign: 'right', color: m.superavit !== 0 ? (pos ? '#059669' : '#dc2626') : '#e2e8f0', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                              {m.superavit !== 0 ? (pos ? '+' : '') + fmt(m.superavit) : '—'}
                            </td>
                          );
                        })}
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: (acum?.superavit ?? 0) >= 0 ? '#059669' : '#dc2626', fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderLeft: '2px solid #e2e8f0' }}>
                          {(acum?.superavit ?? 0) >= 0 ? '+' : ''}{fmt(acum?.superavit ?? 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── LINHA 3: Gráfico Mensal ── */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '16px 24px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <TrendingUp size={16} color="rgba(255,255,255,0.7)" />
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Evolução Mensal — % Repasse ao Fundo de Saúde</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#93c5fd' }}>
                    <span style={{ width: '10px', height: '10px', background: '#3b82f6', borderRadius: '2px', display: 'inline-block' }} />Base de Cálculo
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#6ee7b7' }}>
                    <span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px', display: 'inline-block' }} />Aplicado Saúde
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#fde68a' }}>
                    <span style={{ width: '20px', height: '2px', background: '#fbbf24', display: 'inline-block', borderTop: '2px dashed #fbbf24' }} />% Aplicado
                  </span>
                </div>
              </div>
              <div style={{ padding: '20px 16px 12px' }}>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="valor" orientation="left" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtM(v)} width={70} />
                    <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} width={40} domain={[0, Math.max(40, ...(chartData.map(d => d.pct)))]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar yAxisId="valor" dataKey="base" name="Base de Cálculo" fill="#dbeafe" radius={[4,4,0,0]} />
                    <Bar yAxisId="valor" dataKey="saude" name="Aplicado Saúde" fill="#10b981" radius={[4,4,0,0]} />
                    <ReferenceLine yAxisId="pct" y={15} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={2} label={{ value: '15%', position: 'right', fontSize: 10, fill: '#ef4444', fontWeight: 700 }} />
                    <ReferenceLine yAxisId="pct" y={20} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5} />
                    <Line yAxisId="pct" type="monotone" dataKey="pct" name="% Aplicado" stroke="#fbbf24" strokeWidth={2.5} dot={{ fill: '#fbbf24', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── LINHA 4: Evolução Acumulada ── */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '16px 24px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity size={16} color="rgba(255,255,255,0.7)" />
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Acumulado — Base vs Saúde vs Mínimo Obrigatório</span>
              </div>
              <div style={{ padding: '20px 16px 12px' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={areaData} margin={{ top: 8, right: 20, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradBase" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#bfdbfe" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#bfdbfe" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="gradSaude" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6ee7b7" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#6ee7b7" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="gradMin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fca5a5" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#fca5a5" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtM(v)} width={75} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="base" name="Base Acumulada" stroke="#3b82f6" strokeWidth={2} fill="url(#gradBase)" />
                    <Area type="monotone" dataKey="minimo" name="Mínimo (15%)" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 3" fill="url(#gradMin)" />
                    <Area type="monotone" dataKey="saude" name="Saúde Acumulada" stroke="#10b981" strokeWidth={2.5} fill="url(#gradSaude)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Legenda legal ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#eff6ff', borderRadius: '14px', padding: '14px 18px', border: '1px solid #bfdbfe' }}>
              <Info size={15} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '1px' }} />
              <div style={{ fontSize: '11px', color: '#1e40af', lineHeight: 1.6 }}>
                <strong>Fundamento Legal:</strong> Lei Complementar nº 141/2012 — Os municípios devem aplicar, anualmente, no mínimo <strong>15%</strong> da receita resultante de impostos (incluindo transferências constitucionais) em ações e serviços públicos de saúde.
                A base de cálculo considera impostos próprios (IPTU, ISS, ITBI, IRRF) e transferências constitucionais (FPM, ICMS, IPVA, IPI, ITR), deduzidas as parcelas constitucionalmente transferidas (FUNDEB).
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
