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
  porMes: { mes: number; total: number }[];
}
interface ReceitaSummary {
  valor_total: number; valor_orc: number; valor_extra: number; total_registros: number;
}
interface ReceitaSummaryResponse {
  totais: ReceitaSummary;
  porMes: { mes: number; total: number }[];
}
interface Indice15 {
  acumulado: { baseCalc: number; saude: number; minimo: number; superavit: number; percentual: number };
  matrix: { mes: number; percentual: number; saude: number; minimo: number; temDados: boolean }[];
}
interface ContasResumo { ultimo_periodo: string | null; total_a_pagar: number; por_entidade: { entidade_nome: string; total: number }[] }
interface MetaItem { subgrupo_nome: string; grupo_nome: string; meta_valor: number; fk_subgrupo: number }
interface ExecItem { subgrupo_id: number; subgrupo_nome: string; total: number }
interface FarolGrupo {
  grupo_id: number; grupo_nome: string;
  meta_mensal: number;
  pago_mes: number; a_pagar_mes: number; total_mes: number;
  media_meta: number; media_total: number;
  pct_mes: number; pct_media: number;
  farol_mes: 'verde' | 'amarelo' | 'vermelho' | 'cinza';
  farol_media: 'verde' | 'amarelo' | 'vermelho' | 'cinza';
}
interface FarolData { ano: number; mes: number | null; periodo_ref: string; grupos: FarolGrupo[] }

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
          <span className="text-[11px] font-bold text-white">R$ {fmt(p.value)}</span>
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
  const [loading,    setLoading]    = useState(true);
  const [despesa,    setDespesa]    = useState<DespesaSummary | null>(null);
  const [receita,    setReceita]    = useState<ReceitaSummaryResponse | null>(null);
  const [indice,     setIndice]     = useState<Indice15 | null>(null);
  const [contas,     setContas]     = useState<ContasResumo | null>(null);
  const [metas,      setMetas]      = useState<MetaItem[]>([]);
  const [exec,       setExec]       = useState<ExecItem[]>([]);
  const [farol,      setFarol]      = useState<FarolData | null>(null);
  const [mesFarol,   setMesFarol]   = useState<number | null>(null); // null = último
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [grupoTooltip, setGrupoTooltip] = useState<number | null>(null);

  const ctxParams: Record<string, string> = {};
  if (entidadeSelecionada?.id) ctxParams.entidadeId = String(entidadeSelecionada.id);
  else if (municipioSelecionado?.id) ctxParams.municipioId = String(municipioSelecionado.id);

  const loadFarol = useCallback(async (mes: number | null) => {
    if (!token) return;
    const p: Record<string, string> = { ano, ...ctxParams };
    if (mes) p.mes = String(mes);
    const f = await apiRequest<FarolData>('/metas/farol', { token, params: p }).catch(() => null);
    setFarol(f);
    if (f?.mes && !mes) setMesFarol(f.mes); // sincroniza mês automático
  }, [token, ano, entidadeSelecionada, municipioSelecionado]); // eslint-disable-line

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [desp, rec, ind, cnt, met, ex] = await Promise.all([
        apiRequest<DespesaSummary>('/pagamentos/summary', { token, params: { ano, ...ctxParams } }).catch(() => null),
        apiRequest<ReceitaSummaryResponse>('/receitas/summary', { token, params: { ano, ...ctxParams } }).catch(() => null),
        apiRequest<Indice15>('/indice15', { token, params: { ano, ...ctxParams } }).catch(() => null),
        apiRequest<ContasResumo>('/empenhos-liquidados/resumo', { token, params: ctxParams }).catch(() => null),
        apiRequest<MetaItem[]>('/metas', { token, params: { ano, ...ctxParams } }).catch(() => []),
        apiRequest<{ rows: ExecItem[] }>('/metas/executado', { token, params: { ano, ...ctxParams } }).catch(() => ({ rows: [] })),
      ]);
      setDespesa(desp);
      setReceita(rec ?? null);
      setIndice(ind);
      setContas(cnt);
      setMetas(Array.isArray(met) ? met : []);
      setExec((ex as any)?.rows ?? (Array.isArray(ex) ? ex : []));
      setLastUpdate(new Date());
      await loadFarol(null); // carrega farol com último mês automaticamente
    } finally {
      setLoading(false);
    }
  }, [token, entidadeSelecionada, municipioSelecionado]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  // Quando mês do farol muda manualmente
  const handleMesFarol = useCallback((mes: number | null) => {
    setMesFarol(mes);
    loadFarol(mes);
  }, [loadFarol]);

  // ── Dados derivados ──────────────────────────────────────────────────────────

  const totalReceita  = receita ? (Number(receita.totais?.valor_orc ?? 0) + Number(receita.totais?.valor_extra ?? 0)) : 0;
  const totalDespesa  = Number(despesa?.totalLiquido ?? 0);
  const totalContas   = Number(contas?.total_a_pagar ?? 0);
  const saldo         = totalReceita - totalDespesa;
  const pctSaude      = Number(indice?.acumulado?.percentual ?? 0);
  const superavit     = Number(indice?.acumulado?.superavit ?? 0);

  // Gráfico Receita × Despesa por mês — usando dados reais dos summaries
  const chartMensal = MESES.map((mes, i) => {
    const mesNum = i + 1;
    const recMes  = receita?.porMes?.find((m: any) => Number(m.mes) === mesNum);
    const despMes = despesa?.porMes?.find((m: any) => Number(m.mes) === mesNum);
    return {
      mes,
      receita: Number(recMes?.total ?? 0),
      despesa: Number(despMes?.total ?? 0),
    };
  }).filter(d => d.receita > 0 || d.despesa > 0);

  // Metas com executado cruzado
  const metasComExec = metas.slice(0, 5).map(m => {
    const ex = exec.find(e => e.subgrupo_id === m.fk_subgrupo);
    const executado = ex?.total ?? 0;
    const pct = m.meta_valor > 0 ? Math.min((executado / m.meta_valor) * 100, 100) : 0;
    return { nome: m.subgrupo_nome, meta: m.meta_valor, executado, pct };
  });

  // Curva ABC — usa todos os credores disponíveis (até 20), ordenados desc
  const credoresABC = (despesa?.topCredores ?? [])
    .sort((a, b) => b.total - a.total);
  const totalGeral = credoresABC.reduce((s, c) => s + Number(c.total), 0);
  let acum = 0;
  const curvaABC = credoresABC.map((c, i) => {
    const valor = Number(c.total);
    acum += valor;
    const pctIndividual = totalGeral > 0 ? (valor / totalGeral) * 100 : 0;
    const pctAcum = totalGeral > 0 ? (acum / totalGeral) * 100 : 0;
    const classe = pctAcum <= 80 ? 'A' : pctAcum <= 95 ? 'B' : 'C';
    return { rank: i + 1, nome: c.nome, valor, pctIndividual, pctAcum, classe };
  });
  // Para compatibilidade com o resto do código
  const topCredores = curvaABC.slice(0, 5).map(c => ({ nome: c.nome.slice(0, 22), valor: c.valor }));

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
                sub={`${receita?.totais?.total_registros ?? 0} registros`}
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
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3"
                style={{ background: 'linear-gradient(90deg, #0F2A4E, #1e4d95)' }}>
                <div>
                  <h3 className="text-sm font-bold text-white">Receita × Despesa Liquidada</h3>
                  <p className="text-[11px] text-blue-200 mt-0.5">Comparativo mensal — {ano}</p>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  {[
                    { color: '#10b981', label: 'Receita' },
                    { color: '#ef4444', label: 'Despesa Liquidada' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                      <span className="text-blue-100">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5">
              {chartMensal.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartMensal} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%" barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      tickFormatter={(v: number) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/>
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,42,78,0.04)' }}/>
                    <Bar dataKey="receita"  name="Receita"           fill="#10b981" radius={[4,4,0,0]}/>
                    <Bar dataKey="despesa"  name="Despesa Liquidada" fill="#ef4444" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-44 text-gray-400 gap-2">
                  <TrendingUp size={28} className="opacity-20"/>
                  <p className="text-sm">Importe receitas e despesas para visualizar o comparativo</p>
                </div>
              )}
              </div>
            </motion.div>

            {/* ── BLOCO 2.5 — Farol de Metas por Grupo ── */}
            <motion.div {...stagger(4.5)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Header + seletor de mês */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3"
                style={{ background: 'linear-gradient(90deg, #0F2A4E, #1e4d95)' }}>
                <div>
                  <h3 className="text-sm font-bold text-white">Farol de Metas — Despesa por Grupo</h3>
                  <p className="text-[11px] text-blue-200 mt-0.5">
                    {farol?.mes ? `Ref. ${ano}-${String(farol.mes).padStart(2,'0')}` : 'Carregando...'}
                  </p>
                </div>
                {/* Seletor de mês */}
                <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
                  {/* Botão Último — linha própria no mobile */}
                  <button
                    onClick={() => handleMesFarol(null)}
                    className={`w-full sm:w-auto px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      mesFarol === null || mesFarol === farol?.mes
                        ? 'bg-[#0F2A4E] text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    Último
                  </button>
                  {/* Grade 4×3 no mobile, inline no desktop */}
                  <div className="grid grid-cols-4 gap-1 sm:flex sm:flex-wrap sm:gap-1.5">
                    {MESES.map((m, i) => {
                      const mesNum = i + 1;
                      const ativo = mesFarol === mesNum;
                      return (
                        <button key={m}
                          onClick={() => handleMesFarol(mesNum)}
                          className={`py-1.5 rounded-lg text-[11px] font-medium transition-colors sm:px-2.5 ${
                            ativo
                              ? 'bg-[#C9A84C] text-white'
                              : 'bg-white/10 text-white/80 hover:bg-white/20'
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tabela */}
              <div className="p-5">
              {farol && farol.grupos.length > 0 ? (
                <div className="overflow-x-auto" onClick={(e) => { if (!(e.target as HTMLElement).closest('.relative')) setGrupoTooltip(null); }}>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b-2 border-gray-100">
                        <th className="text-left py-2 pr-3 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Grupo</th>
                        {/* Desktop only */}
                        <th className="hidden sm:table-cell text-right py-2 px-2 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Meta Mês</th>
                        <th className="hidden sm:table-cell text-right py-2 px-2 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Pago</th>
                        <th className="hidden sm:table-cell text-right py-2 px-2 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">A Pagar</th>
                        <th className="hidden sm:table-cell text-right py-2 px-2 font-semibold text-[#0F2A4E] uppercase tracking-wider text-[10px]">Total Mês</th>
                        <th className="hidden sm:table-cell text-right py-2 px-2 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">% Mês</th>
                        <th className="hidden sm:table-cell text-center py-2 px-2 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Farol Mês</th>
                        {/* Mobile + Desktop */}
                        <th className="text-right py-2 px-2 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Méd. Meta</th>
                        <th className="text-right py-2 px-2 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Méd. Total</th>
                        <th className="hidden sm:table-cell text-right py-2 px-2 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">% Acum.</th>
                        <th className="text-center py-2 pl-2 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Farol</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {farol.grupos.map((g) => {
                        const cor = (f: string) =>
                          f === 'verde'    ? { bg: '#dcfce7', text: '#16a34a' } :
                          f === 'amarelo'  ? { bg: '#fef9c3', text: '#ca8a04' } :
                          f === 'vermelho' ? { bg: '#fee2e2', text: '#dc2626' } :
                                             { bg: '#f1f5f9', text: '#94a3b8' };
                        const cMes   = cor(g.farol_mes);
                        const cMedia = cor(g.farol_media);
                        return (
                          <tr key={g.grupo_id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-2.5 pr-3 font-medium text-[#0F2A4E] max-w-[120px]">
                              <div className="relative">
                                <span
                                  className="block truncate cursor-pointer sm:cursor-default"
                                  title={g.grupo_nome}
                                  onClick={() => setGrupoTooltip(grupoTooltip === g.grupo_id ? null : g.grupo_id)}
                                >
                                  {g.grupo_nome}
                                </span>
                                {grupoTooltip === g.grupo_id && (
                                  <div
                                    className="absolute left-0 top-full mt-1 z-50 bg-[#0F2A4E] text-white text-[11px] font-medium rounded-lg px-3 py-2 shadow-xl whitespace-normal min-w-[180px] max-w-[260px]"
                                    onClick={() => setGrupoTooltip(null)}
                                  >
                                    {g.grupo_nome}
                                    <div className="absolute -top-1.5 left-4 w-3 h-3 bg-[#0F2A4E] rotate-45 rounded-sm" />
                                  </div>
                                )}
                              </div>
                            </td>
                            {/* Desktop only */}
                            <td className="hidden sm:table-cell py-2.5 px-2 text-right text-gray-500 whitespace-nowrap"
                              title={`Meta mensal: R$ ${fmt(g.meta_mensal)}`}>
                              R$ {fmt(g.meta_mensal)}
                            </td>
                            <td className="hidden sm:table-cell py-2.5 px-2 text-right text-gray-600 whitespace-nowrap"
                              title={`Pago no mês: R$ ${fmt(g.pago_mes)}`}>
                              R$ {fmt(g.pago_mes)}
                            </td>
                            <td className="hidden sm:table-cell py-2.5 px-2 text-right text-amber-600 whitespace-nowrap"
                              title={`Empenhos liquidados a pagar no período: R$ ${fmt(g.a_pagar_mes)}`}>
                              R$ {fmt(g.a_pagar_mes)}
                            </td>
                            <td className="hidden sm:table-cell py-2.5 px-2 text-right font-bold text-[#0F2A4E] whitespace-nowrap"
                              title={`Total comprometido (pago + a pagar): R$ ${fmt(g.total_mes)}`}>
                              R$ {fmt(g.total_mes)}
                            </td>
                            <td className="hidden sm:table-cell py-2.5 px-2 text-right whitespace-nowrap font-semibold"
                              title={`Execução do mês: ${g.pct_mes.toFixed(2)}%`}
                              style={{ color: cMes.text }}>
                              {g.pct_mes.toFixed(2)}%
                            </td>
                            <td className="hidden sm:table-cell py-2.5 px-2 text-center">
                              <span
                                title={`Farol mês: ${g.pct_mes.toFixed(2)}% da meta mensal\nTotal: R$ ${fmt(g.total_mes)} / Meta: R$ ${fmt(g.meta_mensal)}`}
                                style={{ background: cMes.bg, color: cMes.text }}
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm cursor-help"
                              >●</span>
                            </td>
                            {/* Mobile + Desktop */}
                            <td className="py-2.5 px-2 text-right text-gray-500 whitespace-nowrap"
                              title={`Média mensal da meta: R$ ${fmt(g.media_meta)}`}>
                              R$ {fmt(g.media_meta)}
                            </td>
                            <td className="py-2.5 px-2 text-right text-gray-600 whitespace-nowrap"
                              title={`Média mensal realizada (total Jan→mês ÷ nº meses): R$ ${fmt(g.media_total)}`}>
                              R$ {fmt(g.media_total)}
                            </td>
                            <td className="hidden sm:table-cell py-2.5 px-2 text-right whitespace-nowrap font-semibold"
                              title={`Execução média acumulada: ${g.pct_media.toFixed(2)}%`}
                              style={{ color: cMedia.text }}>
                              {g.pct_media.toFixed(2)}%
                            </td>
                            <td className="py-2.5 pl-2 text-center">
                              <span
                                title={`Farol média: ${g.pct_media.toFixed(2)}% da meta média\nMéd. realizado: R$ ${fmt(g.media_total)} / Méd. meta: R$ ${fmt(g.media_meta)}`}
                                style={{ background: cMedia.bg, color: cMedia.text }}
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm cursor-help"
                              >●</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {(() => {
                      const tot_meta    = farol.grupos.reduce((s, g) => s + g.meta_mensal, 0);
                      const tot_pago    = farol.grupos.reduce((s, g) => s + g.pago_mes,    0);
                      const tot_apagar  = farol.grupos.reduce((s, g) => s + g.a_pagar_mes, 0);
                      const tot_total   = farol.grupos.reduce((s, g) => s + g.total_mes,   0);
                      const tot_mmeta   = farol.grupos.reduce((s, g) => s + g.media_meta,  0);
                      const tot_mtotal  = farol.grupos.reduce((s, g) => s + g.media_total, 0);
                      const pct_mes     = tot_meta   > 0 ? (tot_total  / tot_meta)  * 100 : 0;
                      const pct_media   = tot_mmeta  > 0 ? (tot_mtotal / tot_mmeta) * 100 : 0;
                      const farolCor = (pct: number) =>
                        pct < 85   ? { bg: '#dcfce7', text: '#16a34a' } :
                        pct < 100  ? { bg: '#fef9c3', text: '#ca8a04' } :
                                     { bg: '#fee2e2', text: '#dc2626' };
                      const cM = farolCor(pct_mes);
                      const cA = farolCor(pct_media);
                      return (
                        <tfoot>
                          <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                            <td className="py-2.5 pr-3 font-bold text-[#0F2A4E] text-[12px]">TOTAL</td>
                            {/* Desktop only */}
                            <td className="hidden sm:table-cell py-2.5 px-2 text-right font-bold text-gray-700 whitespace-nowrap text-[12px]"
                              title={`Meta mensal total: R$ ${fmt(tot_meta)}`}>
                              R$ {fmt(tot_meta)}
                            </td>
                            <td className="hidden sm:table-cell py-2.5 px-2 text-right font-bold text-gray-700 whitespace-nowrap text-[12px]"
                              title={`Pago total no mês: R$ ${fmt(tot_pago)}`}>
                              R$ {fmt(tot_pago)}
                            </td>
                            <td className="hidden sm:table-cell py-2.5 px-2 text-right font-bold text-amber-600 whitespace-nowrap text-[12px]"
                              title={`A pagar total: R$ ${fmt(tot_apagar)}`}>
                              R$ {fmt(tot_apagar)}
                            </td>
                            <td className="hidden sm:table-cell py-2.5 px-2 text-right font-bold text-[#0F2A4E] whitespace-nowrap text-[12px]"
                              title={`Total comprometido: R$ ${fmt(tot_total)}`}>
                              R$ {fmt(tot_total)}
                            </td>
                            <td className="hidden sm:table-cell py-2.5 px-2 text-right font-bold whitespace-nowrap text-[12px]"
                              title={`Execução total do mês: ${pct_mes.toFixed(2)}%`}
                              style={{ color: cM.text }}>
                              {pct_mes.toFixed(2)}%
                            </td>
                            <td className="hidden sm:table-cell py-2.5 px-2 text-center">
                              <span
                                title={`Farol mês total: ${pct_mes.toFixed(2)}%`}
                                style={{ background: cM.bg, color: cM.text }}
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm cursor-help"
                              >●</span>
                            </td>
                            {/* Mobile + Desktop */}
                            <td className="py-2.5 px-2 text-right font-bold text-gray-700 whitespace-nowrap text-[12px]"
                              title={`Média meta total: R$ ${fmt(tot_mmeta)}`}>
                              R$ {fmt(tot_mmeta)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-bold text-gray-700 whitespace-nowrap text-[12px]"
                              title={`Média realizada total: R$ ${fmt(tot_mtotal)}`}>
                              R$ {fmt(tot_mtotal)}
                            </td>
                            <td className="hidden sm:table-cell py-2.5 px-2 text-right font-bold whitespace-nowrap text-[12px]"
                              title={`Execução média total: ${pct_media.toFixed(2)}%`}
                              style={{ color: cA.text }}>
                              {pct_media.toFixed(2)}%
                            </td>
                            <td className="py-2.5 pl-2 text-center">
                              <span
                                title={`Farol média total: ${pct_media.toFixed(2)}%`}
                                style={{ background: cA.bg, color: cA.text }}
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm cursor-help"
                              >●</span>
                            </td>
                          </tr>
                        </tfoot>
                      );
                    })()}
                  </table>
                  {/* Legenda */}
                  <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Farol:</span>
                    {[
                      { cor: '#16a34a', bg: '#dcfce7', label: 'Verde < 85%' },
                      { cor: '#ca8a04', bg: '#fef9c3', label: 'Amarelo 85–100%' },
                      { cor: '#dc2626', bg: '#fee2e2', label: 'Vermelho ≥ 100%' },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <span style={{ background: l.bg, color: l.cor }} className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px]">●</span>
                        <span className="text-[10px] text-gray-500">{l.label}</span>
                      </div>
                    ))}
                    <span className="text-[10px] text-gray-300 ml-2">· A Pagar = empenhos liquidados sem pagamento no período</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
                  <Target size={24} className="opacity-20"/>
                  <p className="text-xs">Nenhuma meta cadastrada para {ano}</p>
                </div>
              )}
              </div>
            </motion.div>

            {/* ── BLOCO 3 — Saúde + Metas + Contas ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Saúde 15% */}
              <motion.div {...stagger(5)} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3"
                  style={{ background: 'linear-gradient(90deg, #0F2A4E, #1e4d95)' }}>
                  <div>
                    <h3 className="text-sm font-bold text-white">Índice de Saúde 15%</h3>
                    <p className="text-[11px] text-blue-200">Acumulado {ano}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    pctSaude >= 20 ? 'bg-emerald-100 text-emerald-700' :
                    pctSaude >= 15 ? 'bg-blue-100 text-blue-700' :
                    pctSaude > 0   ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {pctSaude >= 20 ? '✦ Excelente' : pctSaude >= 15 ? '✓ Cumprido' : pctSaude > 0 ? '✕ Déficit' : 'Sem dados'}
                  </span>
                </div>
                <div className="p-5">
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
                </div>
              </motion.div>

              {/* Metas por Subgrupo */}
              <motion.div {...stagger(6)} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3"
                  style={{ background: 'linear-gradient(90deg, #0F2A4E, #1e4d95)' }}>
                  <div>
                    <h3 className="text-sm font-bold text-white">Metas de Despesa</h3>
                    <p className="text-[11px] text-blue-200">Executado vs meta — {ano}</p>
                  </div>
                  <Target size={16} className="text-blue-300"/>
                </div>
                <div className="p-5">
                {metasComExec.length > 0 ? (
                  <div className="space-y-3.5">
                    {metasComExec.map((m, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-gray-600 truncate pr-2 max-w-[160px]">{m.nome}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] text-gray-400">{m.pct.toFixed(2)}%</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              m.pct >= 100 ? 'bg-red-100 text-red-600' :
                              m.pct >= 80  ? 'bg-amber-100 text-amber-600' :
                              'bg-emerald-100 text-emerald-600'
                            }`}
                              title={`Executado: R$ ${fmt(m.executado)}`}>
                              R$ {fmt(m.executado)}
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
                          <span className="text-[9px] text-gray-300">R$ 0,00</span>
                          <span className="text-[9px] text-gray-300" title={`Meta anual: R$ ${fmt(m.meta)}`}>Meta: R$ {fmt(m.meta)}</span>
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
                </div>
              </motion.div>

              {/* Contas a Pagar */}
              <motion.div {...stagger(7)} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3"
                  style={{ background: 'linear-gradient(90deg, #0F2A4E, #1e4d95)' }}>
                  <div>
                    <h3 className="text-sm font-bold text-white">Contas a Pagar</h3>
                    <p className="text-[11px] text-blue-200">
                      {contas?.ultimo_periodo ? `Ref. ${contas.ultimo_periodo}` : 'Último período'}
                    </p>
                  </div>
                  <CreditCard size={16} className="text-blue-300"/>
                </div>

                <div className="p-5">
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
                            <span className="text-[11px] font-semibold text-gray-700 flex-shrink-0" title={`R$ ${fmt(e.total)}`}>R$ {fmt(e.total)}</span>
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
                </div>
              </motion.div>
            </div>

            {/* ── BLOCO 4 — Top Credores + Alertas ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Curva ABC de Credores */}
              <motion.div {...stagger(8)} className="md:col-span-2 lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3"
                  style={{ background: 'linear-gradient(90deg, #0F2A4E, #1e4d95)' }}>
                  <div>
                    <h3 className="text-sm font-bold text-white">Curva ABC — Credores por Despesa</h3>
                    <p className="text-[11px] text-blue-200">Concentração de pagamentos por credor</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(['A','B','C'] as const).map(cl => (
                      <span key={cl} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                        background: cl === 'A' ? '#3b82f620' : cl === 'B' ? '#f59e0b20' : '#ef444420',
                        color: cl === 'A' ? '#3b82f6' : cl === 'B' ? '#f59e0b' : '#ef4444',
                        border: `1px solid ${cl === 'A' ? '#3b82f640' : cl === 'B' ? '#f59e0b40' : '#ef444440'}`,
                      }}>
                        {cl === 'A' ? 'A ≤80%' : cl === 'B' ? 'B ≤95%' : 'C >95%'}
                      </span>
                    ))}
                  </div>
                </div>
                {curvaABC.length > 0 ? (
                  <div className="overflow-auto" style={{ maxHeight: 320 }}>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="sticky top-0 bg-slate-50 border-b border-slate-100">
                          <th className="text-left px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-8">#</th>
                          <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Credor</th>
                          <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Valor</th>
                          <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-16">%</th>
                          <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-32">% Acum.</th>
                          <th className="text-center px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-10">Cl.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {curvaABC.map((c, i) => {
                          const clColor = c.classe === 'A' ? { bg: '#eff6ff', text: '#2563eb', bar: '#3b82f6' }
                                        : c.classe === 'B' ? { bg: '#fffbeb', text: '#d97706', bar: '#f59e0b' }
                                        : { bg: '#fef2f2', text: '#dc2626', bar: '#ef4444' };
                          return (
                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-2 text-[10px] font-bold text-slate-300">{c.rank}</td>
                              <td className="px-3 py-2 font-medium text-slate-700 max-w-[200px] truncate" title={c.nome}>
                                {c.nome}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-[11px] font-semibold text-slate-800">
                                R$ {fmt(c.valor)}
                              </td>
                              <td className="px-3 py-2 text-right text-[10px] text-slate-500">
                                {c.pctIndividual.toFixed(1)}%
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500"
                                      style={{ width: `${Math.min(c.pctAcum, 100)}%`, background: clColor.bar }} />
                                  </div>
                                  <span className="text-[9px] font-mono text-slate-400 w-8 text-right">
                                    {c.pctAcum.toFixed(0)}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
                                  style={{ background: clColor.bg, color: clColor.text }}>
                                  {c.classe}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-44 text-gray-400 text-sm">
                    Nenhuma despesa encontrada
                  </div>
                )}
                {curvaABC.length > 0 && (
                  <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center gap-4">
                    {(['A','B','C'] as const).map(cl => {
                      const items = curvaABC.filter(c => c.classe === cl);
                      const tot = items.reduce((s, c) => s + c.valor, 0);
                      const clColor = cl === 'A' ? '#2563eb' : cl === 'B' ? '#d97706' : '#dc2626';
                      return (
                        <div key={cl} className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold" style={{ color: clColor }}>Classe {cl}:</span>
                          <span className="text-[10px] text-slate-500">{items.length} credor{items.length !== 1 ? 'es' : ''}</span>
                          <span className="text-[10px] font-semibold text-slate-700">· R$ {fmtM(tot)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>

              {/* Alertas do Sistema */}
              <motion.div {...stagger(9)} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3" style={{ background: 'linear-gradient(90deg, #0F2A4E, #1e4d95)' }}>
                  <h3 className="text-sm font-bold text-white">Status do Sistema</h3>
                  <p className="text-[11px] text-blue-200">Indicadores de atenção</p>
                </div>
                <div className="p-5">
                <div className="space-y-2.5">
                  {[
                    { label: 'Receita Importada',  ok: (receita?.totais?.total_registros ?? 0) > 0, val: `${receita?.totais?.total_registros ?? 0} registros` },
                    { label: 'Despesa Importada',  ok: (despesa?.countRegistros ?? 0) > 0,  val: `${despesa?.countRegistros ?? 0} processos` },
                    { label: 'Índice Saúde 15%',   ok: pctSaude >= 15,                       val: pctSaude > 0 ? `${pctSaude.toFixed(2)}%` : 'Sem dados' },
                    { label: 'Contas em Aberto',   ok: totalContas === 0,                    val: totalContas > 0 ? `R$ ${fmt(totalContas)}` : 'Nenhuma' },
                    { label: 'Saldo Positivo',     ok: saldo >= 0,                           val: saldo !== 0 ? `R$ ${fmt(Math.abs(saldo))}` : 'Sem dados' },
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
                </div>
              </motion.div>
            </div>

          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
