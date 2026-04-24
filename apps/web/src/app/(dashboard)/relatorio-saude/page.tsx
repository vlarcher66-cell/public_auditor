'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  ShieldCheck, TrendingUp, TrendingDown, Wallet, AlertTriangle,
  CheckCircle2, BarChart3, Users, ChevronDown, ChevronUp, Calendar,
} from 'lucide-react';
import TopBar from '@/components/dashboard/TopBar';
import { apiRequest } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';

// ─── Formatadores ──────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtK = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${fmt(v)}`;
};

const ANO_ATUAL = new Date().getFullYear();
const ANOS = [ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2];

const QUAD_INFO = [
  { q: 1, label: '1º Quadrimestre', periodo: 'Jan – Abr' },
  { q: 2, label: '2º Quadrimestre', periodo: 'Mai – Ago' },
  { q: 3, label: '3º Quadrimestre', periodo: 'Set – Dez' },
];

const GRUPO_COLORS = ['#1e4d95','#C9A84C','#059669','#7c3aed','#dc2626','#0891b2','#ea580c','#65a30d'];

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent, semaphore }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  accent?: string; semaphore?: 'green' | 'yellow' | 'red';
}) {
  const semColors = { green: '#16a34a', yellow: '#d97706', red: '#dc2626' };
  const semBg     = { green: '#f0fdf4', yellow: '#fffbeb', red: '#fef2f2' };
  return (
    <div style={{
      background: accent ? `linear-gradient(135deg, ${accent}, ${accent}dd)` : '#fff',
      borderRadius: '16px',
      border: accent ? 'none' : '1px solid #e2e8f0',
      padding: '20px',
      boxShadow: accent ? '0 4px 20px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: accent ? 'rgba(255,255,255,0.7)' : '#94a3b8' }}>{label}</span>
        <span style={{ color: accent ? 'rgba(255,255,255,0.6)' : '#94a3b8' }}>{icon}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {semaphore && (
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
            background: semColors[semaphore],
            boxShadow: `0 0 8px ${semColors[semaphore]}88`,
          }} />
        )}
        <span style={{ fontSize: '22px', fontWeight: 800, color: accent ? '#fff' : '#0F2A4E', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</span>
      </div>
      {sub && (
        <span style={{ fontSize: '11px', color: accent ? 'rgba(255,255,255,0.65)' : '#64748b' }}>{sub}</span>
      )}
    </div>
  );
}

// ─── Indice 15% detalhado ─────────────────────────────────────────────────────
function Indice15Card({ indice15, meses }: { indice15: any; meses: any[] }) {
  const pct = indice15?.pct ?? 0;
  const ok  = pct >= 15;
  const cor = pct >= 15 ? '#16a34a' : pct >= 12 ? '#d97706' : '#dc2626';
  const semaphore = pct >= 15 ? 'green' : pct >= 12 ? 'yellow' : 'red' as any;
  const barW = Math.min(100, (pct / 20) * 100);

  return (
    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldCheck size={15} color="rgba(255,255,255,0.7)" />
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Índice de Saúde — Mínimo 15%</span>
        <span style={{
          marginLeft: 'auto', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
          background: ok ? '#16a34a' : '#dc2626', color: '#fff',
        }}>{ok ? '✓ CONFORME' : '✗ ABAIXO DO MÍNIMO'}</span>
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Barra visual */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Aplicado em saúde</span>
            <span style={{ fontSize: '22px', fontWeight: 800, color: cor }}>{pct.toFixed(2)}%</span>
          </div>
          <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden', position: 'relative' }}>
            <div style={{ height: '100%', width: `${barW}%`, background: `linear-gradient(90deg, ${cor}, ${cor}cc)`, borderRadius: '99px', transition: 'width 0.8s ease' }} />
            {/* Linha 15% */}
            <div style={{ position: 'absolute', top: 0, left: `${(15/20)*100}%`, width: '2px', height: '100%', background: '#0F2A4E', opacity: 0.4 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>mínimo legal: 15%</span>
          </div>
        </div>

        {/* Grid de valores */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {[
            { label: 'Base de Cálculo', value: indice15?.baseCalc ?? 0, color: '#64748b' },
            { label: 'Aplicado em Saúde', value: indice15?.saude ?? 0, color: '#1e4d95' },
            { label: 'Mínimo Obrigatório (15%)', value: indice15?.minimo ?? 0, color: '#d97706' },
            { label: ok ? 'Superávit' : 'Déficit', value: Math.abs(indice15?.superavit ?? 0), color: ok ? '#16a34a' : '#dc2626' },
          ].map((item, i) => (
            <div key={i} style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{item.label}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: item.color, fontVariantNumeric: 'tabular-nums' }}>R$ {fmt(item.value)}</div>
            </div>
          ))}
        </div>

        {/* Tabela por mês */}
        {meses.some(m => m.temDados) && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Mês', 'Base Cálculo', 'Aplicado', 'Mínimo 15%', '%', 'Status'].map((h, i) => (
                    <th key={i} style={{ padding: '8px 10px', textAlign: i === 0 ? 'left' : 'right', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meses.map((m: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc', opacity: m.temDados ? 1 : 0.4 }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: '#334155' }}>{m.label}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>R$ {fmt(m.baseCalc)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#1e4d95', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>R$ {fmt(m.saude)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#d97706', fontVariantNumeric: 'tabular-nums' }}>R$ {fmt(m.minimo)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: m.pct >= 15 ? '#16a34a' : m.pct > 0 ? '#dc2626' : '#94a3b8' }}>{m.pct > 0 ? `${m.pct.toFixed(1)}%` : '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {m.temDados ? (
                        m.pct >= 15
                          ? <span style={{ color: '#16a34a', fontSize: '10px', fontWeight: 700 }}>✓</span>
                          : <span style={{ color: '#dc2626', fontSize: '10px', fontWeight: 700 }}>✗</span>
                      ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Seção expansível ─────────────────────────────────────────────────────────
function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '14px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{icon}</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', flex: 1 }}>{title}</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>
      {open && <div style={{ padding: '20px' }}>{children}</div>}
    </div>
  );
}

// ─── Tooltip customizado ──────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 700, color: '#0F2A4E', marginBottom: '6px' }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color, marginTop: '2px' }}>{p.name}: <strong>R$ {fmt(Number(p.value))}</strong></div>
      ))}
    </div>
  );
}

// ─── Page principal ────────────────────────────────────────────────────────────
export default function RelatorioSaudePage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const [ano,  setAno]  = useState(ANO_ATUAL);
  const [quad, setQuad] = useState(1);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['relatorio-quad', token, ano, quad],
    queryFn: () => apiRequest(`/relatorio-quadrimestral?ano=${ano}&quad=${quad}`, { token }),
    enabled: !!token,
  });

  const temDados = data && (data.totalReceitas > 0 || data.totalDespesas > 0);
  const saldoPositivo = (data?.saldo ?? 0) >= 0;
  const indice15 = data?.indice15 ?? {};
  const semaphore = indice15.pct >= 15 ? 'green' : indice15.pct >= 12 ? 'yellow' : 'red';

  // Dados do gráfico combinado receita × despesa
  const evolucaoData = (data?.meses ?? []).map((m: any) => ({
    label: m.label,
    Repasse: data?.receitaPorMes?.find((r: any) => r.mes === m.mes)?.total ?? 0,
    Despesa: data?.despesaPorMes?.find((r: any) => r.mes === m.mes)?.total ?? 0,
  }));

  const totalTopCredores = data?.topCredores?.reduce((s: number, r: any) => s + r.total, 0) ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f0f4f8' }}>
      <TopBar title="Relatório Quadrimestral" subtitle="Fundo Municipal de Saúde — Prestação de Contas ao Conselho" />

      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Seletor Ano + Quadrimestre ──────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            {/* Ano */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ano</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {ANOS.map(a => (
                  <button key={a} onClick={() => setAno(a)} style={{
                    padding: '7px 14px', borderRadius: '9px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 700, transition: 'all 0.15s',
                    background: ano === a ? 'linear-gradient(135deg, #0F2A4E, #1e4d95)' : '#f8fafc',
                    color: ano === a ? '#fff' : '#64748b',
                    boxShadow: ano === a ? '0 3px 10px rgba(15,42,78,0.25)' : 'none',
                    border: ano === a ? 'none' : '1px solid #e2e8f0',
                  } as React.CSSProperties}>{a}</button>
                ))}
              </div>
            </div>

            {/* Quadrimestre */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Período</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {QUAD_INFO.map(qi => (
                  <button key={qi.q} onClick={() => setQuad(qi.q)} style={{
                    padding: '7px 14px', borderRadius: '9px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 700, transition: 'all 0.15s',
                    background: quad === qi.q ? 'linear-gradient(135deg, #C9A84C, #a8852a)' : '#f8fafc',
                    color: quad === qi.q ? '#fff' : '#64748b',
                    boxShadow: quad === qi.q ? '0 3px 10px rgba(201,168,76,0.35)' : 'none',
                    border: quad === qi.q ? 'none' : '1px solid #e2e8f0',
                  } as React.CSSProperties}>
                    {qi.label}
                    <span style={{ fontSize: '10px', opacity: 0.75, marginLeft: '4px' }}>({qi.periodo})</span>
                  </button>
                ))}
              </div>
            </div>

            {data && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <Calendar size={13} color="#94a3b8" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{data.quadLabel} · {data.ano}</span>
              </div>
            )}
          </div>
        </div>

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: '#94a3b8', fontSize: '14px', gap: '10px' }}>
            <div style={{ width: '20px', height: '20px', border: '3px solid #e2e8f0', borderTopColor: '#1e4d95', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Carregando relatório...
          </div>
        )}

        {!isLoading && data && (
          <>
            {/* ── KPIs ─────────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <KpiCard
                icon={<TrendingUp size={18} />}
                label="Total Receitas"
                value={`R$ ${fmt(data.totalReceitas)}`}
                sub="Repasse ao Fundo de Saúde"
                accent="#1e4d95"
              />
              <KpiCard
                icon={<TrendingDown size={18} />}
                label="Total Despesas Pagas"
                value={`R$ ${fmt(data.totalDespesas)}`}
                sub="Ordens de pagamento"
              />
              <KpiCard
                icon={<Wallet size={18} />}
                label="Saldo do Período"
                value={`R$ ${fmt(Math.abs(data.saldo))}`}
                sub={saldoPositivo ? 'Superávit' : 'Déficit'}
                semaphore={saldoPositivo ? 'green' : 'red'}
              />
              <KpiCard
                icon={<ShieldCheck size={18} />}
                label="Índice de Saúde"
                value={`${indice15.pct?.toFixed(2) ?? '0.00'}%`}
                sub={indice15.pct >= 15 ? 'Acima do mínimo legal' : 'Abaixo do mínimo legal'}
                semaphore={semaphore as any}
              />
            </div>

            {!temDados && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '14px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertTriangle size={18} color="#d97706" />
                <span style={{ fontSize: '13px', color: '#92400e' }}>Nenhum dado encontrado para este período. Importe as receitas e despesas do quadrimestre selecionado.</span>
              </div>
            )}

            {/* ── Índice 15% ────────────────────────────────────────────── */}
            <Indice15Card indice15={indice15} meses={data.indice15Meses ?? []} />

            {/* ── Evolução Repasse × Despesa ────────────────────────────── */}
            <Section title="Evolução Mensal — Repasse × Despesas" icon={<BarChart3 size={15} />}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={evolucaoData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} width={70} axisLine={false} tickLine={false} />
                  <RTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15,42,78,0.04)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                  <Bar dataKey="Repasse" fill="#1e4d95" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesa" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>

            {/* ── Despesas por Grupo ────────────────────────────────────── */}
            {(data.despesaGrupos?.length ?? 0) > 0 && (
              <Section title="Despesas por Grupo" icon={<TrendingDown size={15} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(() => {
                    const total = data.despesaGrupos.reduce((s: number, g: any) => s + g.total, 0);
                    return data.despesaGrupos.map((g: any, i: number) => {
                      const pct = total > 0 ? (g.total / total) * 100 : 0;
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>{g.nome}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>{pct.toFixed(1)}%</span>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F2A4E', fontVariantNumeric: 'tabular-nums' }}>R$ {fmt(g.total)}</span>
                            </div>
                          </div>
                          <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: GRUPO_COLORS[i % GRUPO_COLORS.length], borderRadius: '99px', transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </Section>
            )}

            {/* ── Top Credores ──────────────────────────────────────────── */}
            {(data.topCredores?.length ?? 0) > 0 && (
              <Section title="Principais Credores Pagos" icon={<Users size={15} />}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['#', 'Credor', 'Grupo', 'Pagamentos', 'Total Pago', '%'].map((h, i) => (
                          <th key={i} style={{ padding: '9px 12px', textAlign: i >= 3 ? 'right' : 'left', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.topCredores.map((r: any, i: number) => {
                        const pct = totalTopCredores > 0 ? (r.total / totalTopCredores) * 100 : 0;
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                            <td style={{ padding: '9px 12px', color: '#cbd5e1', fontFamily: 'monospace', fontSize: '10px' }}>{String(i + 1).padStart(2, '0')}</td>
                            <td style={{ padding: '9px 12px', color: '#334155', fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.credor_nome}>{r.credor_nome}</td>
                            <td style={{ padding: '9px 12px', color: '#64748b', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.grupo_nome}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', color: '#64748b' }}>{r.qtd}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#0F2A4E', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>R$ {fmt(r.total)}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: pct >= 20 ? '#fef2f2' : pct >= 10 ? '#fffbeb' : '#f0fdf4', color: pct >= 20 ? '#dc2626' : pct >= 10 ? '#d97706' : '#16a34a' }}>
                                {pct.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                        <td colSpan={3} style={{ padding: '9px 12px', fontWeight: 700, color: '#64748b', fontSize: '11px' }}>Total</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#64748b' }}>
                          {data.topCredores.reduce((s: number, r: any) => s + r.qtd, 0)}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: '#0F2A4E', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>R$ {fmt(totalTopCredores)}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#0F2A4E', fontSize: '10px' }}>100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Section>
            )}

            {/* ── Rodapé ────────────────────────────────────────────────── */}
            <div style={{ textAlign: 'center', padding: '16px', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #e2e8f0' }}>
              Relatório gerado automaticamente pelo GestorPúblico · {data.quadLabel} de {data.ano} · Fundo Municipal de Saúde
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .quad-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
