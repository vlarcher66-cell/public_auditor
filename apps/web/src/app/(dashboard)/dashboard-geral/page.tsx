'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area, Cell,
} from 'recharts';
import {
  TrendingDown, TrendingUp, ShieldCheck, Target,
  AlertTriangle, CheckCircle2, RefreshCw, Calendar,
  ArrowUpRight, ArrowDownRight, Building2, CreditCard,
} from 'lucide-react';
import TopBar from '@/components/dashboard/TopBar';
import { useMunicipioEntidade } from '@/contexts/MunicipioEntidadeContext';
import { apiRequest } from '@/lib/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DespesaSummary {
  totalBruto: number; totalLiquido: number; countRegistros: number;
  topCredores: { nome: string; total: number }[];
}
interface ReceitaSummary { valor_total: number; valor_orc: number; valor_extra: number; total_registros: number; }
interface Indice15 {
  acumulado: { baseCalc: number; saude: number; minimo: number; superavit: number; percentual: number };
  matrix: { mes: number; percentual: number; saude: number; minimo: number; temDados: boolean }[];
}
interface ContasResumo { ultimo_periodo: string | null; total_a_pagar: number; por_entidade: { entidade_nome: string; total: number }[] }
interface MetaItem { subgrupo_nome: string; grupo_nome: string; meta_valor: number; fk_subgrupo: number }
interface ExecItem { subgrupo_id: number; subgrupo_nome: string; total: number }

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmt(v: number | null | undefined) {
  const n = Number(v ?? 0);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtM(v: number | null | undefined) {
  const n = Number(v ?? 0);
  if (n >= 1e6) return 'R$ ' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return 'R$ ' + (n / 1e3).toFixed(0) + 'K';
  return 'R$ ' + fmt(n);
}

// ─── Tooltip customizado ──────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0F2A4E] rounded-xl px-4 py-3 shadow-2xl border border-white/10 min-w-[180px]">
      <p className="text-[11px] text-blue-300 font-bold uppercase tracking-wider mb-2">{label}</p>
      {payload.map((p: any, i: number) => p.value > 0 && (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-[11px] text-white/60">{p.name}</span>
          </div>
          <span className="text-[11px] font-bold text-white">{fmtM(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color, bg, delay = 0, prefix = 'R$ ', decimals = 2, suffix = '' }: {
  label: string; value: number; sub: string; icon: React.ReactNode;
  color: string; bg: string; delay?: number; prefix?: string; decimals?: number; suffix?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: bg, color }}>
        {icon}
      </div>
      <p className="text-[11px] font-medium text-gray-400 mb-0.5">{label}</p>
      <p className="text-xl font-bold text-[#0F2A4E] leading-tight">
        {prefix}<CountUp end={value} decimals={decimals} duration={1.6} separator="." decimal="," delay={delay} />{suffix}
      </p>
      <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
    </motion.div>
  );
}

// ─── Mini Gauge ───────────────────────────────────────────────────────────────

function MiniGauge({ pct }: { pct: number }) {
  const color = pct >= 20 ? '#10b981' : pct >= 15 ? '#3b82f6' : pct >= 12 ? '#f59e0b' : '#ef4444';
  const label = pct >= 20 ? 'Excelente' : pct >= 15 ? 'Cumprido' : pct >= 12 ? 'Atenção' : pct > 0 ? 'Déficit' : 'Sem dados';
  const angle = Math.min((pct / 30) * 180, 180);
  const rad = (angle - 180) * (Math.PI / 180);
  const cx = 100, cy = 90, r = 70;
  const nx = cx + r * Math.cos(rad), ny = cy + r * Math.sin(rad);
  return (
    <svg viewBox="0 0 200 110" className="w-full max-w-[180px] mx-auto">
      <defs>
        <linearGradient id="gR" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#ff2d2d"/><stop offset="100%" stopColor="#ff6b00"/></linearGradient>
        <linearGradient id="gY" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f59e0b"/><stop offset="100%" stopColor="#fbbf24"/></linearGradient>
        <linearGradient id="gG" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#34d399"/></linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <path d="M 30 90 A 70 70 0 0 1 170 90" fill="none" stroke="#e8edf5" strokeWidth="14" strokeLinecap="round"/>
      <path d="M 30 90 A 70 70 0 0 1 100 20" fill="none" stroke="url(#gR)" strokeWidth="12" strokeLinecap="round" strokeDasharray="109.9 219.9"/>
      <path d="M 30 90 A 70 70 0 0 1 170 90" fill="none" stroke="url(#gY)" strokeWidth="12" strokeLinecap="round" strokeDasharray="55 219.9" strokeDashoffset="-109.9"/>
      <path d="M 30 90 A 70 70 0 0 1 170 90" fill="none" stroke="url(#gG)" strokeWidth="12" strokeLinecap="round" strokeDasharray="55 219.9" strokeDashoffset="-164.9"/>
      {pct > 0 && (<>
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="3" strokeLinecap="round" filter="url(#glow)"/>
        <circle cx={cx} cy={cy} r="6" fill={color} filter="url(#glow)"/>
        <circle cx={cx} cy={cy} r="3" fill="#fff"/>
      </>)}
      <text x="100" y="76" textAnchor="middle" fontSize="19" fontWeight="800" fill={color}>{pct > 0 ? pct.toFixed(2) + '%' : '—'}</text>
      <text x="100" y="92" textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="700" letterSpacing="0.08em">{label.toUpperCase()}</text>
    </svg>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function DashboardGeralPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const { entidadeSelecionada, municipioSelecionado } = useMunicipioEntidade();

  const ano = String(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [despesa,  setDespesa]  = useState<DespesaSummary | null>(null);
  const [receita,  setReceita]  = useState<ReceitaSummary | null>(null);
  const [indice,   setIndice]   = useState<Indice15 | null>(null);
  const [contas,   setContas]   = useState<ContasResumo | null>(null);
  const [metas,    setMetas]    = useState<MetaItem[]>([]);
  const [exec,     setExec]     = useState<ExecItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const ctxParams: Record<string, string> = {};
  if (entidadeSelecionada?.id) ctxParams.entidadeId = String(entidadeSelecionada.id);
  else if (municipioSelecionado?.id) ctxParams.municipioId = String(municipioSelecionado.id);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [desp, rec, ind, cnt, met, ex] = await Promise.all([
        apiRequest<DespesaSummary>('/pagamentos/summary', { token, params: ctxParams }).catch(() => null),
        apiRequest<{ totais: ReceitaSummary }>('/receitas/summary', { token, params: { ano, ...ctxParams } }).catch(() => null),
        apiRequest<Indice15>('/indice15', { token, params: { ano, ...ctxParams } }).catch(() => null),
        apiRequest<ContasResumo>('/empenhos-liquidados/resumo', { token, params: ctxParams }).catch(() => null),
        apiRequest<MetaItem[]>('/metas', { token, params: { ano, ...ctxParams } }).catch(() => []),
        apiRequest<{ rows: ExecItem[] }>('/metas/executado', { token, params: { ano, ...ctxParams } }).catch(() => ({ rows: [] })),
      ]);
      setDespesa(desp);
      setReceita(rec?.totais ?? null);
      setIndice(ind);
      setContas(cnt);
      setMetas(Array.isArray(met) ? met : []);
      setExec((ex as any)?.rows ?? (Array.isArray(ex) ? ex : []));
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [token, entidadeSelecionada, municipioSelecionado]);

  useEffect(() => { load(); }, [load]);

  // ── Dados derivados ──────────────────────────────────────────────────────────

  const totalReceita  = receita ? (Number(receita.valor_orc ?? 0) + Number(receita.valor_extra ?? 0)) : 0;
  const totalDespesa  = Number(despesa?.totalLiquido ?? 0);
  const totalContas   = Number(contas?.total_a_pagar ?? 0);
  const saldo         = totalReceita - totalDespesa;
  const pctSaude      = Number(indice?.acumulado?.percentual ?? 0);
  const superavit     = Number(indice?.acumulado?.superavit ?? 0);

  // Gráfico Receita × Despesa × Contas a Pagar por mês
  const chartMensal = MESES.map((mes, i) => {
    const mesNum = i + 1;
    const recMes  = indice?.matrix.find(m => m.mes === mesNum);
    // Receita mensal via índice (base de cálculo é receita)
    const recVal  = recMes?.temDados ? recMes.saude / (pctSaude / 100 || 0.01) * (pctSaude / 100) : 0;
    // Despesa mensal — proporcional ao total (aproximação sem endpoint mensal)
    return {
      mes,
      receita: recMes?.temDados ? recMes.minimo / 0.15 : 0,
      despesa: recMes?.temDados ? recMes.saude : 0,
      contas:  0, // contas a pagar é total do último período, não mensal
    };
  }).filter(d => d.receita > 0 || d.despesa > 0);

  // Metas com executado cruzado
  const metasComExec = metas.slice(0, 5).map(m => {
    const ex = exec.find(e => e.subgrupo_id === m.fk_subgrupo);
    const executado = ex?.total ?? 0;
    const pct = m.meta_valor > 0 ? Math.min((executado / m.meta_valor) * 100, 100) : 0;
    return { nome: m.subgrupo_nome, meta: m.meta_valor, executado, pct };
  });

  // Top credores
  const topCredores = (despesa?.topCredores ?? []).slice(0, 5).map(c => ({
    nome: c.nome.length > 22 ? c.nome.slice(0, 22) + '…' : c.nome,
    valor: c.total,
  }));

  // Meses do índice de saúde para status
  const mesesSaude = indice?.matrix ?? [];

  const stagger = (i: number) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: i * 0.08 } });

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar title="Dashboard" subtitle="Visão geral consolidada do exercício" />

      <div className="px-3 py-3 md:px-8 md:py-6 space-y-5">

        {/* ── Header ── */}
        <motion.div {...stagger(0)} className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0F2A4E]">Painel Geral — {ano}</h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <Building2 size={13} />
              {entidadeSelecionada?.nome ?? municipioSelecionado?.nome ?? 'Consolidado'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <Calendar size={11} />
              {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button onClick={load} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-600 transition-colors">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-40 gap-3 text-gray-400">
            <RefreshCw size={18} className="animate-spin" />
            <span className="text-sm">Carregando módulos...</span>
          </div>
        ) : (
          <AnimatePresence>

            {/* ── BLOCO 1 — KPI Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard label="Receita Arrecadada" value={totalReceita}
                sub={`${receita?.total_registros ?? 0} registros`}
                icon={<TrendingUp size={18}/>} color="#10b981" bg="#ecfdf5" delay={0.05} />
              <KpiCard label="Despesa Liquidada" value={totalDespesa}
                sub={`${despesa?.countRegistros ?? 0} processos`}
                icon={<TrendingDown size={18}/>} color="#ef4444" bg="#fef2f2" delay={0.1} />
              <KpiCard label="Contas a Pagar" value={totalContas}
                sub={contas?.ultimo_periodo ? `Ref. ${contas.ultimo_periodo}` : 'Último período'}
                icon={<CreditCard size={18}/>} color="#f59e0b" bg="#fffbeb" delay={0.15} />
              <KpiCard label="Saldo do Período" value={Math.abs(saldo)}
                sub={saldo >= 0 ? '▲ Superávit' : '▼ Déficit'}
                icon={saldo >= 0 ? <ArrowUpRight size={18}/> : <ArrowDownRight size={18}/>}
                color={saldo >= 0 ? '#3b82f6' : '#f59e0b'} bg={saldo >= 0 ? '#eff6ff' : '#fffbeb'} delay={0.2} />
              <KpiCard label="Índice de Saúde" value={pctSaude}
                sub={`Mín. 15% — ${superavit >= 0 ? '+' : ''}R$ ${fmt(superavit)}`}
                icon={<ShieldCheck size={18}/>}
                color={pctSaude >= 20 ? '#10b981' : pctSaude >= 15 ? '#3b82f6' : '#ef4444'}
                bg={pctSaude >= 20 ? '#ecfdf5' : pctSaude >= 15 ? '#eff6ff' : '#fef2f2'}
                delay={0.25} prefix="" suffix="%" />
            </div>

            {/* ── BLOCO 2 — Gráfico Receita × Despesa × Contas a Pagar ── */}
            <motion.div {...stagger(4)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#0F2A4E]">Receita × Despesa × Contas a Pagar</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">Comparativo mensal — {ano}</p>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  {[
                    { color: '#10b981', label: 'Receita' },
                    { color: '#ef4444', label: 'Despesa Liquidada' },
                    { color: '#f59e0b', label: 'Contas a Pagar' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                      <span className="text-gray-500">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {chartMensal.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartMensal} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%" barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : String(v)}/>
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,42,78,0.04)' }}/>
                    <Bar dataKey="receita"  name="Receita"           fill="#10b981" radius={[4,4,0,0]}/>
                    <Bar dataKey="despesa"  name="Despesa Liquidada" fill="#ef4444" radius={[4,4,0,0]}/>
                    <Bar dataKey="contas"   name="Contas a Pagar"    fill="#f59e0b" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-44 text-gray-400 gap-2">
                  <TrendingUp size={28} className="opacity-20"/>
                  <p className="text-sm">Importe receitas e despesas para visualizar o comparativo</p>
                </div>
              )}
            </motion.div>

            {/* ── BLOCO 3 — Saúde + Metas + Contas ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Saúde 15% */}
              <motion.div {...stagger(5)} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F2A4E]">Índice de Saúde 15%</h3>
                    <p className="text-[11px] text-gray-400">Acumulado {ano}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    pctSaude >= 20 ? 'bg-emerald-100 text-emerald-700' :
                    pctSaude >= 15 ? 'bg-blue-100 text-blue-700' :
                    pctSaude > 0   ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {pctSaude >= 20 ? '✦ Excelente' : pctSaude >= 15 ? '✓ Cumprido' : pctSaude > 0 ? '✕ Déficit' : 'Sem dados'}
                  </span>
                </div>
                <MiniGauge pct={pctSaude} />
                {/* Status por mês */}
                <div className="grid grid-cols-6 gap-1 mt-3">
                  {MESES.map((m, i) => {
                    const md = mesesSaude.find(x => x.mes === i + 1);
                    const c = !md?.temDados ? '#e2e8f0' : md.percentual >= 20 ? '#10b981' : md.percentual >= 15 ? '#3b82f6' : md.percentual >= 12 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={m} title={md?.temDados ? `${m}: ${md.percentual.toFixed(1)}%` : m}
                        className="flex flex-col items-center gap-0.5">
                        <div className="w-full h-2 rounded-full" style={{ background: c }} />
                        <span className="text-[8px] text-gray-400">{m}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mínimo obrigatório</span>
                    <span className="font-semibold text-red-500">R$ {fmt(indice?.acumulado.minimo ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Aplicado em saúde</span>
                    <span className="font-semibold text-emerald-600">R$ {fmt(indice?.acumulado.saude ?? 0)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5">
                    <span className="text-gray-400">Superávit / Déficit</span>
                    <span className={`font-bold ${superavit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {superavit >= 0 ? '+' : ''}R$ {fmt(superavit)}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Metas por Subgrupo */}
              <motion.div {...stagger(6)} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F2A4E]">Metas de Despesa</h3>
                    <p className="text-[11px] text-gray-400">Executado vs meta — {ano}</p>
                  </div>
                  <Target size={16} className="text-gray-300"/>
                </div>
                {metasComExec.length > 0 ? (
                  <div className="space-y-3.5">
                    {metasComExec.map((m, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-gray-600 truncate pr-2 max-w-[160px]">{m.nome}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] text-gray-400">{m.pct.toFixed(0)}%</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              m.pct >= 100 ? 'bg-red-100 text-red-600' :
                              m.pct >= 80  ? 'bg-amber-100 text-amber-600' :
                              'bg-emerald-100 text-emerald-600'
                            }`}>
                              {fmtM(m.executado)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${m.pct}%` }}
                            transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                            className="h-full rounded-full"
                            style={{ background: m.pct >= 100 ? '#ef4444' : m.pct >= 80 ? '#f59e0b' : '#10b981' }}
                          />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[9px] text-gray-300">R$ 0</span>
                          <span className="text-[9px] text-gray-300">Meta: {fmtM(m.meta)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                    <Target size={28} className="opacity-20"/>
                    <p className="text-xs text-center">Nenhuma meta cadastrada para {ano}</p>
                  </div>
                )}
              </motion.div>

              {/* Contas a Pagar */}
              <motion.div {...stagger(7)} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F2A4E]">Contas a Pagar</h3>
                    <p className="text-[11px] text-gray-400">
                      {contas?.ultimo_periodo ? `Ref. ${contas.ultimo_periodo}` : 'Último período'}
                    </p>
                  </div>
                  <CreditCard size={16} className="text-gray-300"/>
                </div>

                {/* Total destaque */}
                <div className="bg-amber-50 rounded-xl p-3 mb-4 border border-amber-100">
                  <p className="text-[10px] text-amber-600 font-semibold mb-0.5">Total em Aberto</p>
                  <p className="text-lg font-bold text-amber-700">
                    {totalContas > 0 ? 'R$ ' + fmt(totalContas) : '—'}
                  </p>
                </div>

                {/* Por entidade */}
                {(contas?.por_entidade ?? []).length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Por Entidade</p>
                    {contas!.por_entidade.slice(0, 4).map((e, i) => {
                      const pct = totalContas > 0 ? (e.total / totalContas) * 100 : 0;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] text-gray-600 truncate pr-2 max-w-[140px]">{e.entidade_nome}</span>
                            <span className="text-[11px] font-semibold text-gray-700 flex-shrink-0">{fmtM(e.total)}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 1, delay: 0.6 + i * 0.1 }}
                              className="h-full rounded-full bg-amber-400"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-28 text-gray-400 gap-2">
                    <CheckCircle2 size={24} className="text-emerald-300"/>
                    <p className="text-xs">Nenhuma conta em aberto</p>
                  </div>
                )}
              </motion.div>
            </div>

            {/* ── BLOCO 4 — Top Credores + Alertas ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Top Credores */}
              <motion.div {...stagger(8)} className="md:col-span-2 lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F2A4E]">Top Credores por Despesa</h3>
                    <p className="text-[11px] text-gray-400">Maiores pagamentos do período</p>
                  </div>
                </div>
                {topCredores.length > 0 ? (
                  <div className="overflow-x-auto">
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={topCredores} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                        tickFormatter={v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : String(v)}/>
                      <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={140}/>
                      <Tooltip content={<ChartTooltip />}/>
                      <Bar dataKey="valor" name="Valor Pago" radius={[0,6,6,0]} barSize={20}>
                        {topCredores.map((_, i) => (
                          <Cell key={i} fill={['#3b82f6','#6366f1','#8b5cf6','#a855f7','#ec4899'][i % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-44 text-gray-400 text-sm">
                    Nenhuma despesa encontrada
                  </div>
                )}
              </motion.div>

              {/* Alertas do Sistema */}
              <motion.div {...stagger(9)} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-[#0F2A4E]">Status do Sistema</h3>
                  <p className="text-[11px] text-gray-400">Indicadores de atenção</p>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: 'Receita Importada',  ok: (receita?.total_registros ?? 0) > 0, val: `${receita?.total_registros ?? 0} registros` },
                    { label: 'Despesa Importada',  ok: (despesa?.countRegistros ?? 0) > 0,  val: `${despesa?.countRegistros ?? 0} processos` },
                    { label: 'Índice Saúde 15%',   ok: pctSaude >= 15,                       val: pctSaude > 0 ? `${pctSaude.toFixed(2)}%` : 'Sem dados' },
                    { label: 'Contas em Aberto',   ok: totalContas === 0,                    val: totalContas > 0 ? fmtM(totalContas) : 'Nenhuma' },
                    { label: 'Saldo Positivo',     ok: saldo >= 0,                           val: saldo !== 0 ? fmtM(Math.abs(saldo)) : 'Sem dados' },
                    { label: 'Metas Cadastradas',  ok: metas.length > 0,                     val: `${metas.length} subgrupos` },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50">
                      {item.ok
                        ? <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0"/>
                        : <AlertTriangle size={15} className="text-amber-500 flex-shrink-0"/>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-gray-700">{item.label}</p>
                        <p className="text-[10px] text-gray-400">{item.val}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
