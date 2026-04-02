'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  AlertTriangle, Clock, TrendingDown, CalendarClock, ChevronDown, ChevronRight,
  Search, X, Building2, Users, RefreshCw, CreditCard, Activity, Filter,
  CheckCircle2, XCircle, BarChart3, Banknote,
} from 'lucide-react';
import TopBar from '@/components/dashboard/TopBar';
import { apiRequest } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, AreaChart, Area,
} from 'recharts';

// ─── Formatadores ──────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtK = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace('.', ',')}M`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace('.', ',')}k`;
  return `R$ ${fmt(v)}`;
};

// ─── Cores aging ──────────────────────────────────────────────────────────────
const AGING_COLORS = ['#16a34a', '#ca8a04', '#ea580c', '#dc2626', '#7c2d12'];
const GRUPO_COLORS = [
  '#1e4d95','#C9A84C','#2563eb','#7c3aed','#059669',
  '#dc2626','#ea580c','#0891b2','#65a30d','#9333ea',
];

// ─── Tooltip customizado ──────────────────────────────────────────────────────
function AgingTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: '12px' }}>
      <div style={{ fontWeight: 800, color: '#0F2A4E', marginBottom: '6px' }}>{label}</div>
      <div style={{ color: '#334155' }}>Total: <strong style={{ color: '#0F2A4E' }}>R$ {fmt(payload[0]?.value ?? 0)}</strong></div>
      <div style={{ color: '#64748b', marginTop: '2px' }}>{payload[0]?.payload?.qtd ?? 0} empenhos</div>
    </div>
  );
}

function EvolTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: '12px' }}>
      <div style={{ fontWeight: 800, color: '#0F2A4E', marginBottom: '6px' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: '#334155', marginTop: '2px' }}>
          {p.name === 'total' ? 'Saldo a pagar' : 'Qtd'}: <strong style={{ color: p.color }}>
            {p.name === 'total' ? `R$ ${fmt(Number(p.value))}` : p.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

// ─── Tabela de empenhos pendentes ─────────────────────────────────────────────
function TabelaPendentes({ token, periodo, entidade }: {
  token: string | undefined; periodo: string | undefined; entidade: number | null;
}) {
  const [busca, setBusca] = useState('');
  const [expanded, setExpanded] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['empenhos-pendentes', token, periodo, entidade],
    queryFn: () => {
      const p = new URLSearchParams();
      if (periodo)  p.set('periodo', periodo);
      if (entidade) p.set('fk_entidade', String(entidade));
      return apiRequest(`/empenhos-liquidados/pendentes?${p}`, { token });
    },
    enabled: !!token,
  });

  const filtrados = useMemo(() => {
    if (!busca) return rows;
    const b = busca.toLowerCase();
    return rows.filter((r: any) =>
      r.credor_nome?.toLowerCase().includes(b) ||
      r.num_empenho?.toLowerCase().includes(b) ||
      r.historico?.toLowerCase().includes(b) ||
      r.entidade_nome?.toLowerCase().includes(b)
    );
  }, [rows, busca]);

  const visivel = expanded ? filtrados : filtrados.slice(0, 20);

  return (
    <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <BarChart3 size={15} color="rgba(255,255,255,0.7)" />
        <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Empenhos Pendentes de Pagamento</span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{filtrados.length} registros</span>
      </div>

      {/* Barra de busca */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
          <Search size={13} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por credor, empenho, histórico…"
            style={{ width: '100%', paddingLeft: '32px', paddingRight: busca ? '30px' : '12px', paddingTop: '8px', paddingBottom: '8px', fontSize: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff', outline: 'none', color: '#334155', boxSizing: 'border-box' }}
          />
          {busca && (
            <button onClick={() => setBusca('')} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
              <X size={12} />
            </button>
          )}
        </div>
        {busca && <span style={{ fontSize: '11px', color: '#94a3b8' }}>{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</span>}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', gap: '10px', color: '#94a3b8', fontSize: '13px' }}>
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />Carregando…
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Dt. Liquidação', 'Empenho', 'Credor', 'Grupo', 'Subgrupo', 'Entidade', 'Valor'].map((h, i) => (
                    <th key={i} style={{ padding: '9px 14px', textAlign: i === 6 ? 'right' : 'left', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visivel.map((r: any, i: number) => (
                  <tr
                    key={r.id ?? i}
                    style={{ borderBottom: '1px solid #f8fafc' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {r.dt_liquidacao ? (() => {
                          const s = String(r.dt_liquidacao);
                          // yyyy-mm-dd or yyyy-mm-ddTHH... → parse safely
                          const d = s.slice(0, 10); // "2026-01-15"
                          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                            const [y, m, day] = d.split('-');
                            return `${day}/${m}/${y}`;
                          }
                          return s;
                        })() : '—'}
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#475569', fontSize: '10px' }}>{r.num_empenho || '—'}</td>
                    <td style={{ padding: '9px 14px', color: '#334155', fontWeight: 500, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.credor_nome}>{r.credor_nome}</td>
                    <td style={{ padding: '9px 14px', color: '#64748b', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.grupo_nome || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Sem grupo</span>}</td>
                    <td style={{ padding: '9px 14px', color: '#64748b', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subgrupo_nome || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>—</span>}</td>
                    <td style={{ padding: '9px 14px', color: '#64748b', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.entidade_nome}>{r.entidade_nome}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: Number(r.valor) < 0 ? '#059669' : '#0F2A4E', whiteSpace: 'nowrap' }}>
                      R$ {fmt(Number(r.valor))}
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      Nenhum empenho pendente encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtrados.length > 20 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
              <button
                onClick={() => setExpanded(v => !v)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#1e4d95' }}
              >
                {expanded ? <><ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} /> Mostrar menos</> : <><ChevronDown size={13} /> Ver todos {filtrados.length} registros</>}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Page principal ────────────────────────────────────────────────────────────
export default function ContasAPagarPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const [periodoFiltro, setPeriodoFiltro] = useState('');
  const [entidadeFiltro, setEntidadeFiltro] = useState<number | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: periodos = [] } = useQuery<string[]>({
    queryKey: ['empenhos-periodos', token],
    queryFn: () => apiRequest('/empenhos-liquidados/periodos', { token }),
    enabled: !!token,
  });

  const { data: resumo, isLoading: loadingResumo } = useQuery<any>({
    queryKey: ['empenhos-resumo', token],
    queryFn: () => apiRequest('/empenhos-liquidados/resumo', { token }),
    enabled: !!token,
  });

  const { data: aging } = useQuery<any>({
    queryKey: ['empenhos-aging', token],
    queryFn: () => apiRequest('/empenhos-liquidados/aging', { token }),
    enabled: !!token,
  });

  const { data: evolucao = [] } = useQuery<any[]>({
    queryKey: ['empenhos-evolucao', token],
    queryFn: () => apiRequest('/empenhos-liquidados/evolucao', { token }),
    enabled: !!token,
  });

  const { data: topCredoresData } = useQuery<any>({
    queryKey: ['empenhos-top-credores', token, periodoFiltro],
    queryFn: () => {
      const p = new URLSearchParams();
      if (periodoFiltro) p.set('periodo', periodoFiltro);
      return apiRequest(`/empenhos-liquidados/top-credores?${p}`, { token });
    },
    enabled: !!token,
  });

  const { data: matriz } = useQuery<any>({
    queryKey: ['empenhos-matriz', token],
    queryFn: () => apiRequest('/empenhos-liquidados/matriz', { token }),
    enabled: !!token,
  });

  // ── Dados derivados ────────────────────────────────────────────────────────
  const ultimoPeriodo = resumo?.ultimo_periodo ?? periodos[periodos.length - 1] ?? '';
  const periodoAtivo = periodoFiltro || ultimoPeriodo;
  const entidades: any[] = resumo?.por_entidade ?? [];

  const agingData = (aging?.faixas ?? []).map((f: any) => ({ ...f, total: Number(f.total) }));
  const evolucaoData = evolucao.map((r: any) => ({ periodo: r.periodo, total: Number(r.total), qtd: Number(r.qtd) }));
  const topData = (topCredoresData?.rows ?? []).map((r: any, i: number) => ({ ...r, color: GRUPO_COLORS[i % GRUPO_COLORS.length] }));
  const totalGeralCredores = topCredoresData?.total_geral ?? 0;

  const gruposMatriz = useMemo(() => {
    if (!matriz?.grupos || !matriz.ultimo_periodo) return [];
    const up = matriz.ultimo_periodo;
    return matriz.grupos
      .map((g: any) => ({ nome: g.grupo_nome, total: g.totais[up] ?? 0 }))
      .filter((g: any) => g.total > 0)
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 8);
  }, [matriz]);

  const totalGrupos = gruposMatriz.reduce((s: number, g: any) => s + g.total, 0);

  const totalAPagar = Number(resumo?.total_a_pagar ?? 0);
  const maisAntigo = aging?.mais_antigo_dias ?? 0;
  const vencidoAcima90 = agingData.filter((f: any) => f.min >= 91).reduce((s: number, f: any) => s + f.total, 0);
  const pctVencido = totalAPagar > 0 ? (vencidoAcima90 / totalAPagar) * 100 : 0;

  // Semáforo mais antigo
  const semaforo = maisAntigo > 180
    ? { cor: '#dc2626', glow: 'rgba(220,38,38,0.3)', label: 'Crítico' }
    : maisAntigo > 90
    ? { cor: '#d97706', glow: 'rgba(217,119,6,0.3)', label: 'Atenção' }
    : { cor: '#16a34a', glow: 'rgba(22,163,74,0.3)', label: 'Normal' };

  const semaforoPct = pctVencido > 30
    ? { cor: '#dc2626', glow: 'rgba(220,38,38,0.3)', label: 'Crítico' }
    : pctVencido > 10
    ? { cor: '#d97706', glow: 'rgba(217,119,6,0.3)', label: 'Atenção' }
    : { cor: '#16a34a', glow: 'rgba(22,163,74,0.3)', label: 'Normal' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f0f4f8' }}>
      <TopBar title="Contas a Pagar" subtitle="Empenhos liquidados pendentes de pagamento" />

      <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Filtros de período ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={13} style={{ color: '#94a3b8' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Período</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setPeriodoFiltro('')}
              style={{
                padding: '7px 14px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, transition: 'all 0.15s',
                background: !periodoFiltro ? 'linear-gradient(135deg, #0F2A4E, #1e4d95)' : '#fff',
                color: !periodoFiltro ? '#fff' : '#64748b',
                boxShadow: !periodoFiltro ? '0 3px 10px rgba(15,42,78,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
                border: !periodoFiltro ? 'none' : '1px solid #e2e8f0',
              } as React.CSSProperties}
            >
              Último
            </button>
            {periodos.slice().reverse().slice(0, 8).map(p => (
              <button
                key={p}
                onClick={() => setPeriodoFiltro(periodoFiltro === p ? '' : p)}
                style={{
                  padding: '7px 14px', borderRadius: '9px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, transition: 'all 0.15s',
                  background: periodoFiltro === p ? 'linear-gradient(135deg, #0F2A4E, #1e4d95)' : '#fff',
                  color: periodoFiltro === p ? '#fff' : '#64748b',
                  boxShadow: periodoFiltro === p ? '0 3px 10px rgba(15,42,78,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
                  border: periodoFiltro === p ? 'none' : '1px solid #e2e8f0',
                } as React.CSSProperties}
              >
                {p}
              </button>
            ))}
          </div>

          {entidades.length > 1 && (
            <>
              <span style={{ color: '#e2e8f0', fontSize: '18px', margin: '0 4px' }}>|</span>
              <Building2 size={13} style={{ color: '#94a3b8' }} />
              <select
                value={entidadeFiltro ?? ''}
                onChange={e => setEntidadeFiltro(e.target.value ? Number(e.target.value) : null)}
                style={{ fontSize: '12px', fontWeight: 600, border: '1px solid #e2e8f0', background: '#fff', borderRadius: '9px', padding: '7px 12px', color: '#334155', outline: 'none', cursor: 'pointer' }}
              >
                <option value="">Todas as entidades</option>
                {entidades.map((e: any) => (
                  <option key={e.entidade_id} value={e.entidade_id}>{e.entidade_nome}</option>
                ))}
              </select>
            </>
          )}

          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#94a3b8' }}>
            Referência: <strong style={{ color: '#475569' }}>{ultimoPeriodo || '—'}</strong>
          </span>
        </div>

        {/* ── KPIs ──────────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>

          {/* Total a pagar — card escuro em destaque */}
          <div style={{ background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', borderRadius: '18px', padding: '20px', boxShadow: '0 4px 20px rgba(15,42,78,0.3)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total a Pagar</span>
              <TrendingDown size={20} color="rgba(255,255,255,0.4)" />
            </div>
            {loadingResumo
              ? <div style={{ height: '32px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', animation: 'pulse 1.5s ease-in-out infinite' }} />
              : <div style={{ fontSize: '24px', fontWeight: 900, color: '#fbbf24', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>R$ {fmt(totalAPagar)}</div>
            }
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Referência {ultimoPeriodo || '—'}</div>
          </div>

          {/* Acima de 90 dias */}
          <div style={{ background: vencidoAcima90 > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '18px', padding: '20px', border: `1px solid ${vencidoAcima90 > 0 ? '#fca5a5' : '#bbf7d0'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Acima de 90 dias</span>
              <AlertTriangle size={20} color={vencidoAcima90 > 0 ? '#dc2626' : '#16a34a'} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: semaforoPct.cor, boxShadow: `0 0 8px ${semaforoPct.glow}`, flexShrink: 0 }} />
              <div style={{ fontSize: '22px', fontWeight: 900, color: vencidoAcima90 > 0 ? '#dc2626' : '#059669', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>R$ {fmt(vencidoAcima90)}</div>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{pctVencido.toFixed(1)}% do total pendente</div>
          </div>

          {/* Mais antigo */}
          <div style={{ background: maisAntigo > 90 ? '#fffbeb' : '#f0fdf4', borderRadius: '18px', padding: '20px', border: `1px solid ${maisAntigo > 180 ? '#fca5a5' : maisAntigo > 90 ? '#fcd34d' : '#bbf7d0'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Empenho Mais Antigo</span>
              <Clock size={20} color={semaforo.cor} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: semaforo.cor, boxShadow: `0 0 8px ${semaforo.glow}`, flexShrink: 0 }} />
              <div style={{ fontSize: '22px', fontWeight: 900, color: semaforo.cor === '#16a34a' ? '#059669' : semaforo.cor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {maisAntigo > 0 ? `${maisAntigo} dias` : '—'}
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{semaforo.label} · desde dt. empenho</div>
          </div>

          {/* Entidades */}
          <div style={{ background: '#f0f9ff', borderRadius: '18px', padding: '20px', border: '1px solid #bae6fd', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Entidades</span>
              <Building2 size={20} color="#0284c7" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#0369a1', lineHeight: 1 }}>{entidades.length}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>com saldo pendente</div>
          </div>
        </div>

        {/* ── Linha 2: Aging + Termômetro ───────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {/* Aging */}
          <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <CalendarClock size={14} color="rgba(255,255,255,0.7)" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Distribuição por Idade</span>
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Dias desde o empenho</span>
            </div>
            <div style={{ padding: '16px 20px 8px' }}>
              {agingData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={agingData} barSize={38} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} width={70} axisLine={false} tickLine={false} />
                    <RTooltip content={<AgingTooltip />} cursor={{ fill: 'rgba(15,42,78,0.04)' }} />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {agingData.map((_: any, i: number) => (
                        <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>Sem dados de aging</div>
              )}
            </div>
            {/* Legenda */}
            <div style={{ padding: '8px 20px 16px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {agingData.map((f: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: AGING_COLORS[i % AGING_COLORS.length], flexShrink: 0, display: 'inline-block' }} />
                  {f.label}: <strong style={{ color: '#334155' }}>{f.qtd} emp.</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Termômetro por grupo */}
          <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Activity size={14} color="rgba(255,255,255,0.7)" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Saldo por Grupo</span>
              </div>
              <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', padding: '3px 9px', borderRadius: '20px', fontWeight: 600 }}>{ultimoPeriodo}</span>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {gruposMatriz.length > 0 ? gruposMatriz.map((g: any, i: number) => {
                const pct = totalGrupos > 0 ? (g.total / totalGrupos) * 100 : 0;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '12px', color: '#334155', fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.nome}>{g.nome}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{pct.toFixed(1)}%</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F2A4E', fontVariantNumeric: 'tabular-nums' }}>R$ {fmt(g.total)}</span>
                      </div>
                    </div>
                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: GRUPO_COLORS[i % GRUPO_COLORS.length], borderRadius: '99px', transition: 'width 0.7s ease' }} />
                    </div>
                  </div>
                );
              }) : (
                <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>Sem dados por grupo</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Linha 3: Evolução + Top Credores ──────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>

          {/* Evolução mensal */}
          <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Banknote size={14} color="rgba(255,255,255,0.7)" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Evolução do Saldo a Pagar</span>
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>por período importado</span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {evolucaoData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={evolucaoData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPagar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e4d95" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#1e4d95" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} width={72} axisLine={false} tickLine={false} />
                    <RTooltip content={<EvolTooltip />} cursor={{ stroke: '#e2e8f0' }} />
                    <Area type="monotone" dataKey="total" stroke="#1e4d95" strokeWidth={2.5} fill="url(#gradPagar)" dot={{ r: 4, fill: '#1e4d95', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="total" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>Sem dados de evolução</div>
              )}
            </div>
          </div>

          {/* Top Credores */}
          <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #0F2A4E, #1e4d95)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <Users size={14} color="rgba(255,255,255,0.7)" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Credores com Saldo a Pagar</span>
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>{topData.length} credores · {ultimoPeriodo}</span>
            </div>
            {/* Sub-header colunas */}
            <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 90px 60px 70px', gap: '8px', padding: '8px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', flexShrink: 0 }}>
              {['#', 'Credor / Grupo', 'Valor', 'Emp.', '%'].map((h, i) => (
                <span key={i} style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>{h}</span>
              ))}
            </div>
            {/* Lista com scroll */}
            <div style={{ overflowY: 'auto', maxHeight: '340px', flexShrink: 0 }}>
              {topData.length > 0 ? topData.map((r: any, i: number) => (
                <div
                  key={i}
                  style={{ display: 'grid', gridTemplateColumns: '24px 1fr 90px 60px 70px', gap: '8px', padding: '9px 16px', borderBottom: '1px solid #f8fafc', alignItems: 'center', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <span style={{ fontSize: '10px', color: '#cbd5e1', fontFamily: 'monospace', fontWeight: 600 }}>{String(i + 1).padStart(2, '0')}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.credor_nome}>{r.credor_nome}</div>
                    <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '1px' }}>{r.grupo_nome}</div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F2A4E', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>R$ {fmt(r.total)}</span>
                  <span style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{r.qtd}</span>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: r.pct >= 20 ? '#dc2626' : r.pct >= 10 ? '#d97706' : '#059669', background: r.pct >= 20 ? '#fef2f2' : r.pct >= 10 ? '#fffbeb' : '#f0fdf4', padding: '2px 6px', borderRadius: '6px' }}>
                      {r.pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )) : (
                <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>Sem dados</div>
              )}
            </div>
            {/* Rodapé total */}
            {topData.length > 0 && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '24px 1fr 90px 60px 70px', gap: '8px', background: '#f8fafc', flexShrink: 0 }}>
                <span />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Total geral</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F2A4E', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>R$ {fmt(totalGeralCredores)}</span>
                <span style={{ fontSize: '11px', color: '#64748b', textAlign: 'right' }}>{topData.reduce((s: number, r: any) => s + r.qtd, 0)}</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#0F2A4E', textAlign: 'right' }}>100%</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Tabela detalhada ──────────────────────────────────────────────── */}
        <TabelaPendentes token={token} periodo={periodoAtivo || undefined} entidade={entidadeFiltro} />

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>
    </div>
  );
}
