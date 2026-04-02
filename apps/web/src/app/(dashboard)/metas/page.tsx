'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import TopBar from '@/components/dashboard/TopBar';
import {
  Target, TrendingDown, TrendingUp, ChevronDown, ChevronRight,
  Save, BarChart3, AlertTriangle, CheckCircle2, Minus, Info,
  RefreshCw, Edit3, ChevronUp, Activity, Zap, Filter, Award,
  XCircle, Clock, ArrowUpRight,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend, Cell,
} from 'recharts';

const API = `${process.env.NEXT_PUBLIC_API_URL}/api`;
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ── Formatadores ─────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace('.', ',')}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace('.', ',')}k`;
  return `R$ ${fmt(v)}`;
};
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}%`;

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface SubgrupoReal {
  subgrupo_id: number;
  subgrupo_nome: string;
  meses: number[];
  dea_rp: number;
  total: number;
  // estado local de meta
  ajuste: number;
  meta_anual: number;
  meta_mensal: number;
  saved: boolean;
  observacao: string;
}

interface GrupoReal {
  grupo_id: number;
  grupo_nome: string;
  subgrupos: SubgrupoReal[];
  meses: number[];
  dea_rp: number;
  total: number;
  expanded: boolean;
}

interface MetaSalva {
  fk_subgrupo: number;
  meta_anual: number;
  percentual_ajuste: number;
  base_calculo: number;
  observacao: string;
}

// ── Cor do ajuste ─────────────────────────────────────────────────────────────
function ajusteBadge(pct: number) {
  if (pct < -10) return { bg: '#fef2f2', color: '#dc2626', icon: <TrendingDown size={11} /> };
  if (pct < 0)   return { bg: '#fff7ed', color: '#ea580c', icon: <TrendingDown size={11} /> };
  if (pct === 0) return { bg: '#f8fafc', color: '#64748b', icon: <Minus size={11} /> };
  if (pct <= 10) return { bg: '#f0fdf4', color: '#16a34a', icon: <TrendingUp size={11} /> };
  return { bg: '#fef9c3', color: '#ca8a04', icon: <TrendingUp size={11} /> };
}

export default function MetasPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken ?? '';

  const anoBase = new Date().getFullYear() - 1; // ano da despesa real
  const anoMeta = anoBase + 1;                  // ano da meta

  const [grupos, setGrupos] = useState<GrupoReal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'matriz' | 'metas' | 'acompanhamento'>('matriz');
  const [showInfo, setShowInfo] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<'estourado' | 'alerta' | 'sem_meta' | null>(null);

  // ── Estado acompanhamento ───────────────────────────────────────────────────
  const [acomp, setAcomp] = useState<{
    subgrupos: Array<{
      grupo_id: number; grupo_nome: string; subgrupo_id: number; subgrupo_nome: string;
      meses: number[]; total: number;
    }>;
  } | null>(null);
  const [acompLoading, setAcompLoading] = useState(false);
  const [filtros, setFiltros] = useState({ mes: '', grupo: '', subgrupo: '', entidade: '' });
  const [entidades, setEntidades] = useState<Array<{ id: number; nome: string }>>([]);

  const authH = { Authorization: `Bearer ${token}` };

  // ── Carrega despesa real + metas salvas ─────────────────────────────────────
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [drRes, metasRes] = await Promise.all([
        fetch(`${API}/metas/despesa-real?ano=${anoBase}`, { headers: authH }),
        fetch(`${API}/metas?ano=${anoMeta}`, { headers: authH }),
      ]);
      const dr = await drRes.json();
      const metasSalvas: MetaSalva[] = await metasRes.json();

      const metaMap: Record<number, MetaSalva> = {};
      for (const m of metasSalvas) metaMap[m.fk_subgrupo] = m;

      const gruposFormatados: GrupoReal[] = (dr.grupos ?? []).map((g: any) => ({
        grupo_id: g.grupo_id,
        grupo_nome: g.grupo_nome,
        meses: g.meses,
        dea_rp: g.dea_rp ?? 0,
        total: g.total,
        expanded: false,
        subgrupos: (g.subgrupos ?? []).map((s: any) => {
          const saved = metaMap[s.subgrupo_id];
          const ajuste = saved ? Number(saved.percentual_ajuste) : 0;
          const meta_anual = s.total * (1 + ajuste / 100);
          return {
            subgrupo_id: s.subgrupo_id,
            subgrupo_nome: s.subgrupo_nome,
            meses: s.meses,
            dea_rp: s.dea_rp ?? 0,
            total: s.total,
            ajuste,
            meta_anual,
            meta_mensal: meta_anual / 12,
            saved: !!saved,
            observacao: saved?.observacao ?? '',
          };
        }),
      }));

      setGrupos(gruposFormatados);
    } finally {
      setLoading(false);
    }
  }, [token, anoBase, anoMeta]);

  useEffect(() => { load(); }, [load]);

  const loadAcomp = useCallback(async () => {
    if (!token) return;
    setAcompLoading(true);
    try {
      const params = new URLSearchParams({ ano: String(anoMeta) });
      if (filtros.mes)      params.set('mes', filtros.mes);
      if (filtros.entidade) params.set('fk_entidade', filtros.entidade);
      if (filtros.grupo)    params.set('fk_grupo', filtros.grupo);
      if (filtros.subgrupo) params.set('fk_subgrupo', filtros.subgrupo);
      const r = await fetch(`${API}/metas/executado?${params}`, { headers: authH });
      setAcomp(await r.json());
    } finally { setAcompLoading(false); }
  }, [token, anoMeta, filtros]);

  useEffect(() => {
    if (tab === 'acompanhamento') { loadAcomp(); }
  }, [tab, loadAcomp]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/metas/entidades`, { headers: authH })
      .then(r => r.json()).then(setEntidades).catch(() => {});
  }, [token]);

  // ── Atualiza ajuste de um subgrupo ──────────────────────────────────────────
  function updateAjuste(grupoIdx: number, subIdx: number, pct: number) {
    setGrupos(prev => {
      const next = [...prev];
      const sub = { ...next[grupoIdx].subgrupos[subIdx] };
      sub.ajuste = pct;
      sub.meta_anual = sub.total * (1 + pct / 100);
      sub.meta_mensal = sub.meta_anual / 12;
      next[grupoIdx] = {
        ...next[grupoIdx],
        subgrupos: next[grupoIdx].subgrupos.map((s, i) => i === subIdx ? sub : s),
      };
      return next;
    });
    setSaved(false);
  }

  function toggleGrupo(idx: number) {
    setGrupos(prev => prev.map((g, i) => i === idx ? { ...g, expanded: !g.expanded } : g));
  }

  // ── Salvar todas as metas ───────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const metas = grupos.flatMap(g =>
        g.subgrupos.map(s => ({
          ano: anoMeta,
          fk_subgrupo: s.subgrupo_id,
          meta_anual: s.meta_anual,
          percentual_ajuste: s.ajuste,
          base_calculo: s.total,
          observacao: s.observacao,
        }))
      );
      await fetch(`${API}/metas`, {
        method: 'POST',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ metas }),
      });
      setSaved(true);
      setGrupos(prev => prev.map(g => ({
        ...g,
        subgrupos: g.subgrupos.map(s => ({ ...s, saved: true })),
      })));
    } finally {
      setSaving(false);
    }
  }

  // ── Totais gerais ───────────────────────────────────────────────────────────
  const totalReal = grupos.reduce((a, g) => a + g.total, 0);
  const totalMeta = grupos.reduce((a, g) => a + g.subgrupos.reduce((b, s) => b + s.meta_anual, 0), 0);
  const variacaoTotal = totalReal > 0 ? ((totalMeta - totalReal) / totalReal) * 100 : 0;
  const mesesTotaisReal = Array(12).fill(0);
  for (const g of grupos) for (let i = 0; i < 12; i++) mesesTotaisReal[i] += g.meses[i];
  const totalDeaRp = grupos.reduce((a, g) => a + g.dea_rp, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f0f4f8' }}>
      <TopBar title="Planejamento de Metas" subtitle={`Despesa Real ${anoBase} → Metas ${anoMeta}`} />

      <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Tabs + ações ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#fff', borderRadius: '14px', padding: '4px', border: '1px solid #e2e8f0', gap: '4px' }}>
            {([
              { key: 'matriz', label: `Despesa Real ${anoBase}`, icon: <BarChart3 size={14} /> },
              { key: 'metas', label: `Definir Metas ${anoMeta}`, icon: <Target size={14} /> },
              { key: 'acompanhamento', label: `Acompanhamento ${anoMeta}`, icon: <Activity size={14} /> },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '8px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 700, transition: 'all 0.2s',
                  background: tab === t.key ? 'linear-gradient(135deg, #0F2A4E, #1e4d95)' : 'transparent',
                  color: tab === t.key ? '#fff' : '#64748b',
                }}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {tab === 'acompanhamento' && (
              <button
                onClick={() => setShowFiltros(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: `1px solid ${showFiltros ? '#1e4d95' : '#e2e8f0'}`, background: showFiltros ? '#eff6ff' : '#fff', color: showFiltros ? '#1e4d95' : '#64748b', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                <Filter size={14} />Filtros{showFiltros ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
            <button
              onClick={() => setShowInfo(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Info size={14} />Regra de cálculo
            </button>
            <button
              onClick={load}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              <RefreshCw size={14} />Atualizar
            </button>
            {tab === 'metas' && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '9px 20px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                  background: saved ? '#ecfdf5' : 'linear-gradient(135deg, #0F2A4E, #1e4d95)',
                  color: saved ? '#059669' : '#fff',
                  fontSize: '13px', fontWeight: 700, boxShadow: saved ? 'none' : '0 4px 14px rgba(15,42,78,0.3)',
                  transition: 'all 0.2s',
                }}
              >
                {saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Metas'}
              </button>
            )}
          </div>
        </div>

        {/* ── Info da regra (colapsável) ── */}
        {showInfo && (
          <div style={{ background: '#eff6ff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #bfdbfe', display: 'flex', gap: '14px' }}>
            <Info size={16} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '12px', color: '#1e40af', lineHeight: 1.7 }}>
              <strong>Regra da Despesa Real {anoBase}:</strong><br />
              ✅ <strong>Pagamentos de {anoBase}</strong> cujo grupo <strong>não é DEA nem RP</strong> → despesa própria de {anoBase}.<br />
              ✅ <strong>Pagamentos de {anoMeta}</strong> cujo grupo <strong>é DEA ou RP</strong> → eram compromissos de {anoBase} pagos com atraso.<br />
              ❌ Pagamentos de {anoBase} com grupo DEA/RP → dívidas de {anoBase - 1}, excluídas.<br />
              A <strong>meta mensal de {anoMeta}</strong> é a média aritmética: Meta Anual ÷ 12.
            </div>
          </div>
        )}

        {/* ── Cards de resumo ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {[
            {
              label: `Despesa Real ${anoBase}`,
              value: `R$ ${fmt(totalReal)}`,
              sub: `${grupos.length} grupos · ${grupos.reduce((a, g) => a + g.subgrupos.length, 0)} subgrupos`,
              color: '#0F2A4E', bg: 'linear-gradient(135deg, #0F2A4E, #1e4d95)',
              icon: <BarChart3 size={22} color="rgba(255,255,255,0.8)" />,
              light: false,
            },
            {
              label: `Meta Planejada ${anoMeta}`,
              value: `R$ ${fmt(totalMeta)}`,
              sub: `Média mensal: R$ ${fmt(totalMeta / 12)}`,
              color: '#065f46', bg: '#ecfdf5',
              icon: <Target size={22} color="#059669" />,
              light: true,
            },
            {
              label: 'Variação Total',
              value: fmtPct(variacaoTotal),
              sub: variacaoTotal >= 0 ? 'Aumento previsto' : 'Redução prevista',
              color: variacaoTotal >= 0 ? '#92400e' : '#065f46',
              bg: variacaoTotal >= 0 ? '#fffbeb' : '#ecfdf5',
              icon: variacaoTotal >= 0
                ? <TrendingUp size={22} color="#d97706" />
                : <TrendingDown size={22} color="#059669" />,
              light: true,
            },
            {
              label: 'Economia / Adição',
              value: `R$ ${fmt(Math.abs(totalMeta - totalReal))}`,
              sub: totalMeta <= totalReal ? `Economia de ${fmtPct(variacaoTotal)}` : `Adição de ${fmtPct(variacaoTotal)}`,
              color: totalMeta <= totalReal ? '#065f46' : '#92400e',
              bg: totalMeta <= totalReal ? '#ecfdf5' : '#fffbeb',
              icon: totalMeta <= totalReal
                ? <CheckCircle2 size={22} color="#059669" />
                : <AlertTriangle size={22} color="#d97706" />,
              light: true,
            },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, borderRadius: '18px', padding: '20px', border: c.light ? '1px solid rgba(0,0,0,0.06)' : 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: c.light ? '#94a3b8' : 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</span>
                {c.icon}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: c.light ? c.color : '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{c.value}</div>
              <div style={{ fontSize: '11px', color: c.light ? '#94a3b8' : 'rgba(255,255,255,0.5)' }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', color: '#94a3b8', fontSize: '14px' }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
            Carregando despesa real...
          </div>
        ) : grupos.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px' }}>
            <Target size={48} style={{ color: '#cbd5e1' }} />
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Nenhum dado de pagamento encontrado para {anoBase}.</p>
          </div>
        ) : (
          <>
            {/* ══════════════ TAB: MATRIZ DESPESA REAL ══════════════ */}
            {tab === 'matriz' && (
              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '16px 24px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <BarChart3 size={16} color="rgba(255,255,255,0.7)" />
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Matriz de Despesa Real — {anoBase}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Pagamentos {anoBase} (sem DEA/RP) + DEA/RP pagos em {anoMeta}</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '200px' }} />
                      {MESES.map((_, i) => <col key={i} />)}
                      <col style={{ width: '115px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '110px' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '9px 16px', textAlign: 'center', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0' }}>Grupo / Subgrupo</th>
                        {MESES.map(m => (
                          <th key={m} style={{ padding: '9px 4px', textAlign: 'center', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' }}>{m}</th>
                        ))}
                        <th style={{ padding: '9px 4px', textAlign: 'center', color: '#7c3aed', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', borderLeft: '2px solid #ede9fe', whiteSpace: 'nowrap', width: '90px' }}>DEA/RP</th>
                        <th style={{ padding: '9px 4px', textAlign: 'center', color: '#0F2A4E', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', borderLeft: '2px solid #e2e8f0', width: '100px' }}>Total</th>
                        <th style={{ padding: '9px 4px', textAlign: 'center', color: '#0F2A4E', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', width: '100px' }}>Média/Mês</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupos.map((g, gi) => (
                        <>
                          {/* Linha de grupo */}
                          <tr
                            key={`g-${g.grupo_id}`}
                            style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e3a6e)', cursor: 'pointer' }}
                            onClick={() => toggleGrupo(gi)}
                          >
                            <td style={{ padding: '10px 16px', color: '#93c5fd', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {g.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              {g.grupo_nome}
                            </td>
                            {g.meses.map((v, mi) => (
                              <td key={mi} style={{ padding: '10px 4px', textAlign: 'center', color: v > 0 ? '#bfdbfe' : 'rgba(255,255,255,0.15)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '10px' }}>
                                {v > 0 ? `R$ ${fmt(v)}` : '—'}
                              </td>
                            ))}
                            <td style={{ padding: '10px 4px', textAlign: 'right', color: g.dea_rp > 0 ? '#c4b5fd' : 'rgba(255,255,255,0.15)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '11px', borderLeft: '2px solid rgba(167,139,250,0.3)', width: '90px' }}>
                              {g.dea_rp > 0 ? `R$ ${fmt(g.dea_rp)}` : '—'}
                            </td>
                            <td style={{ padding: '10px 4px', textAlign: 'right', color: '#fbbf24', fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: '11px', borderLeft: '2px solid rgba(255,255,255,0.1)', width: '100px' }}>
                              R$ {fmt(g.total)}
                            </td>
                            <td style={{ padding: '10px 4px', textAlign: 'right', color: '#93c5fd', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '11px', width: '100px' }}>
                              R$ {fmt(g.total / 12)}
                            </td>
                          </tr>

                          {/* Subgrupos */}
                          {g.expanded && g.subgrupos.map((s, si) => (
                            <tr
                              key={`s-${s.subgrupo_id}`}
                              style={{ borderBottom: '1px solid #f1f5f9' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                            >
                              <td style={{ padding: '9px 16px 9px 32px', color: '#334155', fontWeight: 500 }}>
                                <span style={{ color: '#cbd5e1', marginRight: '6px' }}>↳</span>
                                {s.subgrupo_nome}
                              </td>
                              {s.meses.map((v, mi) => (
                                <td key={mi} style={{ padding: '9px 4px', textAlign: 'center', color: v > 0 ? '#475569' : '#e2e8f0', fontVariantNumeric: 'tabular-nums', fontSize: '10px' }}>
                                  {v > 0 ? `R$ ${fmt(v)}` : '—'}
                                </td>
                              ))}
                              <td style={{ padding: '9px 4px', textAlign: 'right', color: s.dea_rp > 0 ? '#7c3aed' : '#e2e8f0', fontWeight: s.dea_rp > 0 ? 700 : 400, fontVariantNumeric: 'tabular-nums', fontSize: '11px', borderLeft: '2px solid #ede9fe', background: s.dea_rp > 0 ? '#faf5ff' : 'transparent', width: '90px' }}>
                                {s.dea_rp > 0 ? `R$ ${fmt(s.dea_rp)}` : '—'}
                              </td>
                              <td style={{ padding: '9px 4px', textAlign: 'right', color: '#0F2A4E', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '11px', borderLeft: '2px solid #e2e8f0', width: '100px' }}>
                                R$ {fmt(s.total)}
                              </td>
                              <td style={{ padding: '9px 4px', textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums', fontSize: '11px', width: '100px' }}>
                                R$ {fmt(s.total / 12)}
                              </td>
                            </tr>
                          ))}
                        </>
                      ))}

                      {/* Total geral */}
                      <tr style={{ background: '#0F2A4E', borderTop: '3px solid #1e4d95' }}>
                        <td style={{ padding: '12px 16px', color: '#fff', fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>TOTAL GERAL</td>
                        {mesesTotaisReal.map((v, mi) => (
                          <td key={mi} style={{ padding: '12px 4px', textAlign: 'center', color: v > 0 ? '#93c5fd' : 'rgba(255,255,255,0.2)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '10px' }}>
                            {v > 0 ? `R$ ${fmt(v)}` : '—'}
                          </td>
                        ))}
                        <td style={{ padding: '12px 4px', textAlign: 'right', color: totalDeaRp > 0 ? '#c4b5fd' : 'rgba(255,255,255,0.2)', fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: '11px', borderLeft: '2px solid rgba(167,139,250,0.4)', width: '90px' }}>
                          {totalDeaRp > 0 ? `R$ ${fmt(totalDeaRp)}` : '—'}
                        </td>
                        <td style={{ padding: '12px 4px', textAlign: 'right', color: '#fbbf24', fontWeight: 900, fontVariantNumeric: 'tabular-nums', fontSize: '11px', borderLeft: '2px solid rgba(255,255,255,0.15)', width: '100px' }}>
                          R$ {fmt(totalReal)}
                        </td>
                        <td style={{ padding: '12px 4px', textAlign: 'right', color: '#93c5fd', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '11px', width: '100px' }}>
                          R$ {fmt(totalReal / 12)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══════════════ TAB: DEFINIR METAS ══════════════ */}
            {tab === 'metas' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {grupos.map((g, gi) => {
                  const metaGrupo = g.subgrupos.reduce((a, s) => a + s.meta_anual, 0);
                  const varGrupo = g.total > 0 ? ((metaGrupo - g.total) / g.total) * 100 : 0;
                  const bGrupo = ajusteBadge(varGrupo);

                  return (
                    <div key={g.grupo_id} style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      {/* Header do grupo */}
                      <button
                        onClick={() => toggleGrupo(gi)}
                        style={{ width: '100%', padding: '14px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e3a6e)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                      >
                        {g.expanded ? <ChevronUp size={15} color="rgba(255,255,255,0.6)" /> : <ChevronDown size={15} color="rgba(255,255,255,0.6)" />}
                        <span style={{ fontWeight: 800, fontSize: '13px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{g.grupo_nome}</span>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginBottom: '2px' }}>Real {anoBase}</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#93c5fd', fontVariantNumeric: 'tabular-nums' }}>R$ {fmt(g.total)}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginBottom: '2px' }}>Meta {anoMeta}</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>R$ {fmt(metaGrupo)}</div>
                          </div>
                          <div style={{ background: bGrupo.bg, borderRadius: '8px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ color: bGrupo.color }}>{bGrupo.icon}</span>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: bGrupo.color }}>{fmtPct(varGrupo)}</span>
                          </div>
                        </div>
                      </button>

                      {/* Subgrupos */}
                      {g.expanded && (
                        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {/* Header colunas */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 100px 150px 150px 110px', gap: '8px', padding: '6px 12px', background: '#f8fafc', borderRadius: '10px' }}>
                            {['Subgrupo', `Real ${anoBase}`, 'Ajuste %', `Meta Anual ${anoMeta}`, `Meta Mensal ${anoMeta}`, 'Status'].map(h => (
                              <div key={h} style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                            ))}
                          </div>

                          {g.subgrupos.map((s, si) => {
                            const b = ajusteBadge(s.ajuste);
                            return (
                              <div
                                key={s.subgrupo_id}
                                style={{ display: 'grid', gridTemplateColumns: '1fr 150px 100px 150px 150px 110px', gap: '8px', padding: '10px 12px', borderRadius: '12px', border: '1px solid #f1f5f9', alignItems: 'center', transition: 'all 0.15s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                              >
                                {/* Nome */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Edit3 size={12} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>{s.subgrupo_nome}</span>
                                  {s.saved && <CheckCircle2 size={11} style={{ color: '#10b981', flexShrink: 0 }} />}
                                </div>

                                {/* Real */}
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F2A4E', fontVariantNumeric: 'tabular-nums' }}>
                                  R$ {fmt(s.total)}
                                </div>

                                {/* Input ajuste */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={s.ajuste}
                                    onChange={e => updateAjuste(gi, si, parseFloat(e.target.value) || 0)}
                                    style={{
                                      width: '70px', padding: '5px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                                      border: `1.5px solid ${b.color}44`, color: b.color, background: b.bg,
                                      textAlign: 'center', outline: 'none', fontVariantNumeric: 'tabular-nums',
                                    }}
                                  />
                                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>%</span>
                                </div>

                                {/* Meta anual */}
                                <div style={{ fontSize: '12px', fontWeight: 800, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                                  R$ {fmt(s.meta_anual)}
                                </div>

                                {/* Meta mensal */}
                                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                                  R$ {fmt(s.meta_mensal)}<span style={{ fontSize: '9px', color: '#94a3b8', marginLeft: '3px' }}>/mês</span>
                                </div>

                                {/* Badge status */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: b.bg, borderRadius: '8px', padding: '4px 10px' }}>
                                  <span style={{ color: b.color }}>{b.icon}</span>
                                  <span style={{ fontSize: '11px', fontWeight: 800, color: b.color }}>{fmtPct(s.ajuste)}</span>
                                </div>
                              </div>
                            );
                          })}

                          {/* Totalizador do grupo */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 100px 150px 150px 110px', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: '#f0f9ff', border: '1px solid #bae6fd', alignItems: 'center', marginTop: '4px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total {g.grupo_nome}</div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F2A4E', fontVariantNumeric: 'tabular-nums' }}>R$ {fmt(g.total)}</div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: bGrupo.color }}>{fmtPct(varGrupo)}</div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>R$ {fmt(metaGrupo)}</div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', fontVariantNumeric: 'tabular-nums' }}>R$ {fmt(metaGrupo / 12)}<span style={{ fontSize: '9px', marginLeft: '3px', color: '#94a3b8' }}>/mês</span></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: bGrupo.bg, borderRadius: '8px', padding: '4px 10px' }}>
                              <span style={{ color: bGrupo.color }}>{bGrupo.icon}</span>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: bGrupo.color }}>{fmtPct(varGrupo)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Total geral metas */}
                <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', borderRadius: '20px', padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Total Geral das Metas {anoMeta}</div>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>R$ {fmt(totalMeta)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '32px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginBottom: '3px' }}>Base Real {anoBase}</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#93c5fd' }}>R$ {fmt(totalReal)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginBottom: '3px' }}>Variação</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: variacaoTotal >= 0 ? '#fca5a5' : '#6ee7b7' }}>{fmtPct(variacaoTotal)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginBottom: '3px' }}>Média Mensal</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#fbbf24' }}>R$ {fmt(totalMeta / 12)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* ══════════════ TAB: ACOMPANHAMENTO ══════════════ */}
            {tab === 'acompanhamento' && (() => {
              // Monta lista cruzada executado × meta
              const metaMap: Record<number, { meta_anual: number; meta_mensal: number; grupo_nome: string; grupo_id: number }> = {};
              for (const g of grupos) for (const s of g.subgrupos) {
                metaMap[s.subgrupo_id] = { meta_anual: s.meta_anual, meta_mensal: s.meta_mensal, grupo_nome: g.grupo_nome, grupo_id: g.grupo_id };
              }

              const execSubs = (acomp?.subgrupos ?? []);

              // Filtra por grupo/subgrupo no front se necessário
              const execFilt = execSubs.filter(s => {
                if (filtros.grupo && String(s.grupo_id) !== filtros.grupo) return false;
                if (filtros.subgrupo && String(s.subgrupo_id) !== filtros.subgrupo) return false;
                return true;
              });

              // totalMetaAno sempre vem de TODAS as metas cadastradas (filtradas por grupo/subgrupo)
              // independente de ter execução no período — evita distorção ao filtrar por mês
              const totalMetaAno = grupos
                .filter(g => !filtros.grupo || String(g.grupo_id) === filtros.grupo)
                .flatMap(g => g.subgrupos)
                .filter(s => !filtros.subgrupo || String(s.subgrupo_id) === filtros.subgrupo)
                .reduce((a, s) => a + s.meta_anual, 0);

              const totalExec = execFilt.reduce((a, s) => a + s.total, 0);
              const pctGeral = totalMetaAno > 0 ? (totalExec / totalMetaAno) * 100 : 0;

              // Mês atual
              const mesAtual = filtros.mes ? parseInt(filtros.mes) : new Date().getMonth() + 1;
              const metaMesAtual = totalMetaAno / 12;
              const execMesAtual = execFilt.reduce((a, s) => a + (s.meses[mesAtual - 1] ?? 0), 0);

              // Projeção anual linear: se estamos no mês M, projeção = execTotal / M * 12
              const projecao = mesAtual > 0 && totalExec > 0 ? (totalExec / mesAtual) * 12 : 0;
              const pctProjecao = totalMetaAno > 0 ? (projecao / totalMetaAno) * 100 : 0;

              // Grupos em alerta (>=85% e <100%) e estourados (>=100%)
              const gruposAlerta = execFilt.filter(s => {
                const m = metaMap[s.subgrupo_id];
                if (!m) return false;
                const pct = m.meta_anual > 0 ? (s.total / m.meta_anual) * 100 : 0;
                return pct >= 85 && pct < 100;
              }).length;
              const gruposEstourados = execFilt.filter(s => {
                const m = metaMap[s.subgrupo_id];
                if (!m) return false;
                return m.meta_anual > 0 && s.total >= m.meta_anual;
              }).length;

              // Dados gráfico evolução mensal (total executado vs meta mensal)
              const evolucaoData = MESES.map((nome, i) => {
                const exec = execFilt.reduce((a, s) => a + (s.meses[i] ?? 0), 0);
                const meta = totalMetaAno / 12;
                return { mes: nome, executado: exec, meta };
              });

              // Dados gráfico projeção acumulado
              const projecaoData = MESES.map((nome, i) => {
                const acumExec = execFilt.reduce((a, s) => {
                  return a + s.meses.slice(0, i + 1).reduce((b, v) => b + v, 0);
                }, 0);
                const metaAcum = (totalMetaAno / 12) * (i + 1);
                const proj = i < mesAtual - 1 ? null : (i === mesAtual - 1 ? acumExec : (acumExec > 0 ? (totalExec / mesAtual) * (i + 1) : null));
                return { mes: nome, executado: i < mesAtual ? acumExec : null, projecao: proj, meta: metaAcum };
              });

              // Status por subgrupo — inclui 'sem_meta' para execução sem meta cadastrada
              const statusRows = execFilt.map(s => {
                const m = metaMap[s.subgrupo_id];
                const meta_anual = m?.meta_anual ?? 0;
                const semMeta = !m || meta_anual === 0;
                const pct = meta_anual > 0 ? (s.total / meta_anual) * 100 : 0;
                const saldo = meta_anual - s.total;
                const projAnual = mesAtual > 0 ? (s.total / mesAtual) * 12 : 0;
                const status = semMeta ? 'sem_meta' : pct >= 100 ? 'estourado' : pct >= 85 ? 'alerta' : 'normal';
                return { ...s, meta_anual, pct, saldo, projAnual, status, grupo_nome: m?.grupo_nome ?? s.grupo_nome };
              }).sort((a, b) => {
                // sem_meta sempre no topo como prioridade máxima
                if (a.status === 'sem_meta' && b.status !== 'sem_meta') return -1;
                if (b.status === 'sem_meta' && a.status !== 'sem_meta') return 1;
                return b.pct - a.pct;
              });

              // Subgrupos com execução mas sem meta definida
              const semMetaRows = statusRows.filter(s => s.status === 'sem_meta');
              const totalSemMeta = semMetaRows.reduce((a, s) => a + s.total, 0);

              // Filtra tabela pelo card clicado (ou mostra todos)
              const statusRowsFiltrados = filtroStatus
                ? statusRows.filter(s => s.status === filtroStatus)
                : statusRows;

              // Termômetro por grupo
              const termData = Object.values(
                execFilt.reduce((acc, s) => {
                  const m = metaMap[s.subgrupo_id];
                  const k = s.grupo_nome;
                  if (!acc[k]) acc[k] = { nome: k, exec: 0, meta: 0 };
                  acc[k].exec += s.total;
                  acc[k].meta += m?.meta_anual ?? 0;
                  return acc;
                }, {} as Record<string, { nome: string; exec: number; meta: number }>)
              ).map(g => ({ ...g, pct: g.meta > 0 ? (g.exec / g.meta) * 100 : 0 }))
               .sort((a, b) => b.pct - a.pct);

              // Semáforo: >=100% vermelho | >=85% amarelo/âmbar | <85% verde | sem meta âmbar escuro
              const statusColor = (s: string) =>
                s === 'sem_meta' ? '#b45309' : s === 'estourado' ? '#dc2626' : s === 'alerta' ? '#d97706' : '#16a34a';
              const statusBg = (s: string) =>
                s === 'sem_meta' ? '#fffbeb' : s === 'estourado' ? '#fef2f2' : s === 'alerta' ? '#fffbeb' : '#f0fdf4';
              const statusLabel = (s: string) =>
                s === 'sem_meta' ? 'Sem Meta' : s === 'estourado' ? 'Estourado' : s === 'alerta' ? 'Alerta' : 'Normal';
              const statusIcon = (s: string) =>
                s === 'sem_meta' ? <AlertTriangle size={11} /> : s === 'estourado' ? <XCircle size={11} /> :
                s === 'alerta' ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />;

              const fmtCur = (v: number) => `R$ ${fmt(v)}`;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* ── Banner de alerta: execução sem meta ── */}
                  {!acompLoading && semMetaRows.length > 0 && (
                    <div style={{ background: '#fffbeb', borderRadius: '14px', padding: '14px 20px', border: '2px solid #fcd34d', display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <AlertTriangle size={18} color="#fff" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#92400e', marginBottom: '3px' }}>
                          ⚠️ {semMetaRows.length} subgrupo{semMetaRows.length > 1 ? 's' : ''} com execução sem meta definida
                        </div>
                        <div style={{ fontSize: '11px', color: '#b45309', lineHeight: 1.5 }}>
                          Total não coberto por meta: <strong>R$ {fmt(totalSemMeta)}</strong> — {semMetaRows.map(s => s.subgrupo_nome).join(', ')}.
                          Acesse <strong>Definir Metas</strong> para cadastrá-las.
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '10px', color: '#d97706', marginBottom: '2px' }}>Valor sem cobertura</div>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: '#b45309', fontVariantNumeric: 'tabular-nums' }}>R$ {fmt(totalSemMeta)}</div>
                      </div>
                    </div>
                  )}

                  {acompLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', color: '#94a3b8', fontSize: '14px' }}>
                      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                      Carregando acompanhamento...
                    </div>
                  ) : (
                    <>
                      {/* ── KPIs com faróis ── */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
                        {(() => {
                          const semaforo = (pct: number) =>
                            pct >= 100 ? { cor: '#dc2626', glow: 'rgba(220,38,38,0.25)', label: 'Crítico' }
                            : pct >= 85 ? { cor: '#d97706', glow: 'rgba(217,119,6,0.25)', label: 'Atenção' }
                            : { cor: '#16a34a', glow: 'rgba(22,163,74,0.25)', label: 'Normal' };

                          const kpis: Array<{
                            label: string; pct: number; value: string; sub: string; sub2: string;
                            useFarol: boolean; fixedCor?: string; fixedGlow?: string;
                            filterKey: 'estourado' | 'alerta' | 'sem_meta' | null;
                          }> = [
                            {
                              label: '% Executado da Meta',
                              pct: pctGeral,
                              value: `${pctGeral.toFixed(1)}%`,
                              sub: `R$ ${fmt(totalExec)}`,
                              sub2: `de R$ ${fmt(totalMetaAno)}`,
                              useFarol: true,
                              filterKey: null,
                            },
                            {
                              label: `Projeção Dez/${anoMeta}`,
                              pct: pctProjecao,
                              value: `${pctProjecao.toFixed(1)}%`,
                              sub: `R$ ${fmt(projecao)}`,
                              sub2: 'projeção anual',
                              useFarol: true,
                              filterKey: null,
                            },
                            {
                              label: 'Subgrupos Estourados',
                              pct: gruposEstourados > 0 ? 100 : 0,
                              value: String(gruposEstourados),
                              sub: '≥ 100% da meta',
                              sub2: gruposEstourados > 0 ? 'clique para filtrar' : 'nenhum',
                              useFarol: false,
                              fixedCor: gruposEstourados > 0 ? '#dc2626' : '#16a34a',
                              fixedGlow: gruposEstourados > 0 ? 'rgba(220,38,38,0.25)' : 'rgba(22,163,74,0.25)',
                              filterKey: 'estourado',
                            },
                            {
                              label: 'Subgrupos em Alerta',
                              pct: gruposAlerta > 0 ? 90 : 0,
                              value: String(gruposAlerta),
                              sub: '85% a 99% da meta',
                              sub2: gruposAlerta > 0 ? 'clique para filtrar' : 'nenhum',
                              useFarol: false,
                              fixedCor: gruposAlerta > 0 ? '#d97706' : '#16a34a',
                              fixedGlow: gruposAlerta > 0 ? 'rgba(217,119,6,0.25)' : 'rgba(22,163,74,0.25)',
                              filterKey: 'alerta',
                            },
                            {
                              label: 'Sem Meta Definida',
                              pct: semMetaRows.length > 0 ? 100 : 0,
                              value: String(semMetaRows.length),
                              sub: semMetaRows.length > 0 ? `R$ ${fmt(totalSemMeta)}` : 'Todos cobertos',
                              sub2: semMetaRows.length > 0 ? 'clique para filtrar' : '',
                              useFarol: false,
                              fixedCor: semMetaRows.length > 0 ? '#d97706' : '#16a34a',
                              fixedGlow: semMetaRows.length > 0 ? 'rgba(217,119,6,0.25)' : 'rgba(22,163,74,0.25)',
                              filterKey: 'sem_meta',
                            },
                          ];

                          return kpis.map((k, i) => {
                            const { cor, glow } = k.useFarol ? semaforo(k.pct) : { cor: k.fixedCor!, glow: k.fixedGlow! };
                            const isClickable = k.filterKey !== null;
                            const isActive = filtroStatus === k.filterKey && k.filterKey !== null;
                            return (
                              <div
                                key={i}
                                onClick={() => isClickable && setFiltroStatus(prev => prev === k.filterKey ? null : k.filterKey)}
                                style={{
                                  background: isActive ? `${cor}12` : '#fff',
                                  borderRadius: '18px', padding: '18px 20px',
                                  border: isActive ? `2px solid ${cor}` : '1px solid #e2e8f0',
                                  boxShadow: isActive ? `0 4px 18px ${glow}` : '0 2px 10px rgba(0,0,0,0.04)',
                                  display: 'flex', gap: '16px', alignItems: 'center',
                                  cursor: isClickable ? 'pointer' : 'default',
                                  transition: 'all 0.2s',
                                  transform: isActive ? 'translateY(-1px)' : 'none',
                                  position: 'relative',
                                }}
                                onMouseEnter={e => { if (isClickable && !isActive) (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px ${glow}`; }}
                                onMouseLeave={e => { if (isClickable && !isActive) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.04)'; }}
                              >
                                {/* Badge "filtro ativo" */}
                                {isActive && (
                                  <div style={{ position: 'absolute', top: '8px', right: '10px', fontSize: '9px', fontWeight: 800, color: cor, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    ✕ limpar
                                  </div>
                                )}
                                {/* Farol */}
                                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                  <div style={{
                                    width: '52px', height: '52px', borderRadius: '50%',
                                    background: cor, boxShadow: `0 0 16px ${glow}, 0 0 6px ${glow}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.3s',
                                  }}>
                                    <span style={{ fontSize: '13px', fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                                      {k.useFarol ? `${Math.round(k.pct)}%` : k.value}
                                    </span>
                                  </div>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cor, opacity: 0.4 }} />
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cor, opacity: 0.2 }} />
                                </div>
                                {/* Texto */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{k.label}</div>
                                  <div style={{ fontSize: k.useFarol ? '18px' : '26px', fontWeight: 900, color: '#0F2A4E', lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: '4px' }}>
                                    {k.value}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{k.sub}</div>
                                  {k.sub2 && <div style={{ fontSize: '10px', color: isActive ? cor : '#94a3b8', fontWeight: isActive ? 700 : 400 }}>{k.sub2}</div>}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* ── Filtros colapsáveis (abaixo dos KPIs) ── */}
                      {showFiltros && (
                        <div style={{ background: '#fff', borderRadius: '14px', padding: '14px 18px', border: '1px solid #bfdbfe', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <select value={filtros.mes} onChange={e => setFiltros(f => ({ ...f, mes: e.target.value }))}
                            style={{ padding: '7px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#334155', background: '#f8fafc', cursor: 'pointer', outline: 'none' }}>
                            <option value="">Todos os Meses</option>
                            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                          </select>
                          <select value={filtros.grupo} onChange={e => setFiltros(f => ({ ...f, grupo: e.target.value, subgrupo: '' }))}
                            style={{ padding: '7px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#334155', background: '#f8fafc', cursor: 'pointer', outline: 'none' }}>
                            <option value="">Todos os Grupos</option>
                            {[...new Map(grupos.map(g => [g.grupo_id, g.grupo_nome])).entries()].map(([id, nome]) => (
                              <option key={id} value={id}>{nome}</option>
                            ))}
                          </select>
                          <select value={filtros.subgrupo} onChange={e => setFiltros(f => ({ ...f, subgrupo: e.target.value }))}
                            style={{ padding: '7px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#334155', background: '#f8fafc', cursor: 'pointer', outline: 'none' }}>
                            <option value="">Todos os Subgrupos</option>
                            {grupos
                              .filter(g => !filtros.grupo || String(g.grupo_id) === filtros.grupo)
                              .flatMap(g => g.subgrupos)
                              .map(s => <option key={s.subgrupo_id} value={s.subgrupo_id}>{s.subgrupo_nome}</option>)}
                          </select>
                          <select value={filtros.entidade} onChange={e => setFiltros(f => ({ ...f, entidade: e.target.value }))}
                            style={{ padding: '7px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#334155', background: '#f8fafc', cursor: 'pointer', outline: 'none' }}>
                            <option value="">Todas as Entidades</option>
                            {entidades.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                          </select>
                          <button onClick={loadAcomp}
                            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', color: '#fff', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                            <RefreshCw size={13} />Aplicar
                          </button>
                        </div>
                      )}

                      {/* ── Linha 1: Termômetro + Evolução Mensal lado a lado ── */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px' }}>

                        {/* Termômetro */}
                        <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                          <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Zap size={15} color="rgba(255,255,255,0.7)" />
                            <span style={{ fontWeight: 700, fontSize: '12px', color: '#fff' }}>Execução por Grupo — % da Meta</span>
                          </div>
                          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {termData.length === 0 ? (
                              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '20px 0' }}>Sem dados no período</div>
                            ) : termData.map((g, i) => {
                              const pct = Math.min(g.pct, 150);
                              const clr = g.pct >= 100 ? '#dc2626' : g.pct >= 85 ? '#d97706' : '#16a34a';
                              return (
                                <div key={i}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>{g.nome}</span>
                                    <span style={{ fontSize: '11px', fontWeight: 800, color: clr }}>{g.pct.toFixed(1)}%</span>
                                  </div>
                                  <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{
                                      height: '100%', borderRadius: '4px',
                                      width: `${Math.min(pct, 100)}%`,
                                      background: g.pct >= 100
                                        ? 'linear-gradient(90deg,#dc2626,#fca5a5)'
                                        : g.pct >= 85
                                          ? 'linear-gradient(90deg,#d97706,#fbbf24)'
                                          : 'linear-gradient(90deg,#16a34a,#4ade80)',
                                      transition: 'width 0.6s ease',
                                    }} />
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>Exec: {fmtCur(g.exec)}</span>
                                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>Meta: {fmtCur(g.meta)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Evolução mensal */}
                        <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                          <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BarChart3 size={15} color="rgba(255,255,255,0.7)" />
                            <span style={{ fontWeight: 700, fontSize: '12px', color: '#fff' }}>Evolução Mensal — Executado vs Meta</span>
                          </div>
                          <div style={{ padding: '16px 8px' }}>
                            <ResponsiveContainer width="100%" height={240}>
                              <ComposedChart data={evolucaoData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 9, fill: '#94a3b8' }} width={70} />
                                <Tooltip formatter={(v: any) => `R$ ${fmt(Number(v))}`} contentStyle={{ fontSize: '11px', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                <Bar dataKey="executado" name="Executado" fill="#1e4d95" radius={[4, 4, 0, 0]}>
                                  {evolucaoData.map((d, i) => (
                                    <Cell key={i} fill={d.executado > d.meta ? '#dc2626' : d.executado > d.meta * 0.85 ? '#d97706' : '#16a34a'} />
                                  ))}
                                </Bar>
                                <Line dataKey="meta" name="Meta Mensal" stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="5 4" dot={false} />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* ── Linha 2: Tabela Status (largura total) ── */}
                      <div style={{ background: '#fff', borderRadius: '20px', border: filtroStatus ? `2px solid ${filtroStatus === 'estourado' ? '#dc2626' : filtroStatus === 'alerta' ? '#d97706' : '#d97706'}` : '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Target size={15} color="rgba(255,255,255,0.7)" />
                          <span style={{ fontWeight: 700, fontSize: '12px', color: '#fff' }}>Status por Subgrupo</span>
                          {filtroStatus && (
                            <span style={{ padding: '2px 10px', borderRadius: '20px', background: 'rgba(255,255,255,0.15)', fontSize: '10px', fontWeight: 700, color: '#fff' }}>
                              {filtroStatus === 'estourado' ? '🔴 Estourados' : filtroStatus === 'alerta' ? '🟡 Em Alerta' : '🟠 Sem Meta'}
                            </span>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
                            {statusRowsFiltrados.length}{filtroStatus ? ` de ${statusRows.length}` : ''} subgrupos
                          </span>
                          {filtroStatus && (
                            <button onClick={() => setFiltroStatus(null)}
                              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '8px', padding: '3px 10px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                              ✕ limpar
                            </button>
                          )}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc' }}>
                                {['Grupo', 'Subgrupo', 'Meta Anual', 'Executado', '% Meta', 'Saldo', 'Proj. Dez', 'Status'].map(h => (
                                  <th key={h} style={{ padding: '9px 14px', textAlign: h === 'Grupo' || h === 'Subgrupo' ? 'left' : 'right', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {statusRowsFiltrados.length === 0 ? (
                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>Sem dados no período selecionado</td></tr>
                              ) : statusRowsFiltrados.map((s, i) => (
                                <tr key={i}
                                  style={{ borderBottom: '1px solid #f1f5f9', background: s.status === 'sem_meta' ? '#fffdf0' : '#fff', borderLeft: s.status === 'sem_meta' ? '3px solid #d97706' : '3px solid transparent' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = s.status === 'sem_meta' ? '#fef3c7' : '#f8faff')}
                                  onMouseLeave={e => (e.currentTarget.style.background = s.status === 'sem_meta' ? '#fffdf0' : '#fff')}>
                                  <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '11px' }}>{s.grupo_nome}</td>
                                  <td style={{ padding: '10px 14px', fontWeight: 600, color: s.status === 'sem_meta' ? '#92400e' : '#334155' }}>
                                    {s.status === 'sem_meta' && <AlertTriangle size={11} style={{ display: 'inline', marginRight: '5px', color: '#d97706', verticalAlign: 'middle' }} />}
                                    {s.subgrupo_nome}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: s.status === 'sem_meta' ? '#d97706' : '#0F2A4E', fontVariantNumeric: 'tabular-nums', fontStyle: s.status === 'sem_meta' ? 'italic' : 'normal' }}>
                                    {s.status === 'sem_meta' ? '— não definida —' : fmtCur(s.meta_anual)}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: s.status === 'sem_meta' ? '#b45309' : '#334155', fontVariantNumeric: 'tabular-nums' }}>{fmtCur(s.total)}</td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor(s.status), boxShadow: `0 0 5px ${statusColor(s.status)}88`, flexShrink: 0 }} />
                                      <span style={{ fontSize: '12px', fontWeight: 700, color: statusColor(s.status), minWidth: '42px' }}>{s.status === 'sem_meta' ? '—' : `${s.pct.toFixed(1)}%`}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: s.status === 'sem_meta' ? '#d97706' : s.saldo >= 0 ? '#059669' : '#dc2626', fontVariantNumeric: 'tabular-nums', fontStyle: s.status === 'sem_meta' ? 'italic' : 'normal' }}>
                                    {s.status === 'sem_meta' ? '—' : `${fmtCur(Math.abs(s.saldo))}${s.saldo < 0 ? ' ⬆' : ''}`}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', color: s.status === 'sem_meta' ? '#b45309' : s.projAnual > s.meta_anual ? '#dc2626' : '#059669', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtCur(s.projAnual)}</td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: statusBg(s.status), color: statusColor(s.status), fontSize: '10px', fontWeight: 800 }}>
                                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusColor(s.status), boxShadow: `0 0 4px ${statusColor(s.status)}` }} />
                                      {statusLabel(s.status)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* ── Linha 3: Projeção Acumulada (largura total, último) ── */}
                      <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <TrendingUp size={15} color="rgba(255,255,255,0.7)" />
                          <span style={{ fontWeight: 700, fontSize: '12px', color: '#fff' }}>Projeção Acumulada vs Meta Anual {anoMeta}</span>
                          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>Linha tracejada = projeção linear</span>
                        </div>
                        <div style={{ padding: '16px 8px' }}>
                          <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={projecaoData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                              <defs>
                                <linearGradient id="gradExec" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#1e4d95" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#1e4d95" stopOpacity={0.02} />
                                </linearGradient>
                                <linearGradient id="gradProj" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                              <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 9, fill: '#94a3b8' }} width={70} />
                              <Tooltip formatter={(v: any, n: any) => [`R$ ${fmt(Number(v))}`, n]} contentStyle={{ fontSize: '11px', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                              <Area dataKey="meta" name="Meta Acumulada" stroke="#fbbf24" strokeWidth={2} fill="none" strokeDasharray="4 3" dot={false} connectNulls />
                              <Area dataKey="executado" name="Executado Real" stroke="#1e4d95" strokeWidth={2.5} fill="url(#gradExec)" dot={false} connectNulls />
                              <Area dataKey="projecao" name="Projeção" stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 3" fill="url(#gradProj)" dot={false} connectNulls />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                    </>
                  )}
                </div>
              );
            })()}

          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { opacity: 1; }
      `}</style>
    </div>
  );
}
