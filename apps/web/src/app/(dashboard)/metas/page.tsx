'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import TopBar from '@/components/dashboard/TopBar';
import {
  Target, TrendingDown, TrendingUp, ChevronDown, ChevronRight,
  Save, BarChart3, AlertTriangle, CheckCircle2, Minus, Info,
  RefreshCw, Edit3, ChevronUp,
} from 'lucide-react';

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
  total: number;
  // estado local de meta
  ajuste: number;       // percentual digitado
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
  const [tab, setTab] = useState<'matriz' | 'metas'>('matriz');
  const [showInfo, setShowInfo] = useState(false);

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
        total: g.total,
        expanded: true,
        subgrupos: (g.subgrupos ?? []).map((s: any) => {
          const saved = metaMap[s.subgrupo_id];
          const ajuste = saved ? Number(saved.percentual_ajuste) : 0;
          const meta_anual = saved ? Number(saved.meta_anual) : s.total * (1 + ajuste / 100);
          return {
            subgrupo_id: s.subgrupo_id,
            subgrupo_nome: s.subgrupo_nome,
            meses: s.meses,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f0f4f8' }}>
      <TopBar title="Planejamento de Metas" subtitle={`Despesa Real ${anoBase} → Metas ${anoMeta}`} />

      <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>

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

        {/* ── Tabs + ações ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#fff', borderRadius: '14px', padding: '4px', border: '1px solid #e2e8f0', gap: '4px' }}>
            {([
              { key: 'matriz', label: `Despesa Real ${anoBase}`, icon: <BarChart3 size={14} /> },
              { key: 'metas', label: `Definir Metas ${anoMeta}`, icon: <Target size={14} /> },
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

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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

        {/* ── Info da regra ── */}
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
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '110px' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '9px 16px', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0' }}>Grupo / Subgrupo</th>
                        {MESES.map(m => (
                          <th key={m} style={{ padding: '9px 4px', textAlign: 'center', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' }}>{m}</th>
                        ))}
                        <th style={{ padding: '9px 12px', textAlign: 'right', color: '#0F2A4E', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', borderLeft: '2px solid #e2e8f0' }}>Total</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right', color: '#0F2A4E', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Média/Mês</th>
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
                                {v > 0 ? fmt(v) : '—'}
                              </td>
                            ))}
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fbbf24', fontWeight: 800, fontVariantNumeric: 'tabular-nums', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                              R$ {fmt(g.total)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#93c5fd', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
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
                                  {v > 0 ? fmt(v) : '—'}
                                </td>
                              ))}
                              <td style={{ padding: '9px 12px', textAlign: 'right', color: '#0F2A4E', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '11px', borderLeft: '2px solid #e2e8f0' }}>
                                R$ {fmt(s.total)}
                              </td>
                              <td style={{ padding: '9px 12px', textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums', fontSize: '11px' }}>
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
                            {v > 0 ? fmt(v) : '—'}
                          </td>
                        ))}
                        <td style={{ padding: '12px 12px', textAlign: 'right', color: '#fbbf24', fontWeight: 900, fontVariantNumeric: 'tabular-nums', fontSize: '13px', borderLeft: '2px solid rgba(255,255,255,0.15)' }}>
                          R$ {fmt(totalReal)}
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', color: '#93c5fd', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
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
