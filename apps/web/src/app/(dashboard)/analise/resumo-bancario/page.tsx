'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Landmark, TrendingUp, TrendingDown, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import TopBar from '@/components/dashboard/TopBar';
import { useMunicipioEntidade } from '@/contexts/MunicipioEntidadeContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface ResumoPeriodo {
  periodo_ref: string;
  ano: number;
  mes: number;
  entidade_id: number;
  entidade_nome: string;
  saldo_anterior: number;
  creditos: number;
  debitos: number;
  saldo_atual: number;
}

interface DetalheRow {
  id: number;
  num_ordem: string;
  nome_conta: string;
  saldo_anterior: number;
  creditos: number;
  debitos: number;
  saldo_atual: number;
  periodo_ref: string;
  entidade_nome: string;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function labelPeriodo(ref: string) {
  const [ano, mes] = ref.split('-');
  return `${MESES[parseInt(mes) - 1]}/${ano}`;
}

export default function ResumoBancarioPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const { entidadeSelecionada, municipioSelecionado } = useMunicipioEntidade();

  const [resumos, setResumos]           = useState<ResumoPeriodo[]>([]);
  const [detalhes, setDetalhes]         = useState<DetalheRow[]>([]);
  const [periodoSelecionado, setPeriodo] = useState<string>('');
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [loading, setLoading]           = useState(false);

  const ctxParams: Record<string, string> = {};
  if (entidadeSelecionada?.id) ctxParams.entidadeId = String(entidadeSelecionada.id);
  else if (municipioSelecionado?.id) ctxParams.municipioId = String(municipioSelecionado.id);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams(ctxParams);
    fetch(`${API_URL}/api/resumo-bancario?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: ResumoPeriodo[]) => {
        setResumos(data);
        if (data.length > 0) setPeriodo(data[data.length - 1].periodo_ref);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, entidadeSelecionada, municipioSelecionado]); // eslint-disable-line

  useEffect(() => {
    if (!token || !periodoSelecionado) return;
    const params = new URLSearchParams({ ...ctxParams, periodoRef: periodoSelecionado });
    fetch(`${API_URL}/api/resumo-bancario/detalhado?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setDetalhes)
      .catch(() => {});
  }, [token, periodoSelecionado, entidadeSelecionada, municipioSelecionado]); // eslint-disable-line

  // Agrupa por período para o gráfico
  const periodos = [...new Set(resumos.map(r => r.periodo_ref))].sort();
  const chartData = periodos.map(p => {
    const rows = resumos.filter(r => r.periodo_ref === p);
    return {
      periodo: labelPeriodo(p),
      saldo_atual:    rows.reduce((s, r) => s + r.saldo_atual, 0),
      creditos:       rows.reduce((s, r) => s + r.creditos, 0),
      debitos:        rows.reduce((s, r) => s + r.debitos, 0),
    };
  });

  const ultimoPeriodo = resumos.filter(r => r.periodo_ref === periodoSelecionado);
  const totalSaldoAtual    = ultimoPeriodo.reduce((s, r) => s + r.saldo_atual, 0);
  const totalCreditos      = ultimoPeriodo.reduce((s, r) => s + r.creditos, 0);
  const totalDebitos       = ultimoPeriodo.reduce((s, r) => s + r.debitos, 0);
  const totalSaldoAnterior = ultimoPeriodo.reduce((s, r) => s + r.saldo_anterior, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar title="Resumo Bancário" subtitle="Evolução do saldo bancário por entidade ao longo do tempo" />

      <div className="px-4 py-5 md:px-8 space-y-5">

        {/* KPIs do período selecionado */}
        {periodoSelecionado && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Saldo Anterior', value: totalSaldoAnterior, icon: <Landmark size={16} className="text-gray-400" />, color: '#eff6ff', border: '#bfdbfe' },
              { label: 'Créditos',       value: totalCreditos,      icon: <TrendingUp size={16} className="text-emerald-400" />, color: '#ecfdf5', border: '#a7f3d0' },
              { label: 'Débitos',        value: totalDebitos,       icon: <TrendingDown size={16} className="text-red-400" />, color: '#fef2f2', border: '#fecaca' },
              { label: 'Saldo Atual',    value: totalSaldoAtual,    icon: <DollarSign size={16} className="text-cyan-400" />, color: '#ecfeff', border: '#a5f3fc' },
            ].map((k, i) => (
              <div key={i} style={{ background: k.color, border: `1px solid ${k.border}`, borderRadius: '14px', padding: '14px 16px' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{k.label}</span>
                  {k.icon}
                </div>
                <span className="text-lg font-black text-[#0F2A4E]">R$ {fmt(k.value)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Selector de período */}
        {periodos.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-gray-500">Período:</span>
            <div className="flex gap-2 flex-wrap">
              {periodos.map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    periodoSelecionado === p
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-cyan-50 hover:text-cyan-700'
                  }`}
                >
                  {labelPeriodo(p)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Gráfico evolução */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Evolução do Saldo Bancário</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCred" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `R$ ${fmt(v)}`} />
                <Legend />
                <Area type="monotone" dataKey="saldo_atual" name="Saldo Atual" stroke="#0891b2" fill="url(#gradSaldo)" strokeWidth={2} dot={{ r: 4 }} />
                <Area type="monotone" dataKey="creditos"    name="Créditos"    stroke="#10b981" fill="url(#gradCred)"  strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabela detalhada */}
        {periodoSelecionado && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowDetalhes(v => !v)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-700">
                Detalhamento por conta — {labelPeriodo(periodoSelecionado)}
                <span className="ml-2 text-xs font-normal text-gray-400">({detalhes.length} contas)</span>
              </span>
              {showDetalhes ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>

            {showDetalhes && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-y border-gray-100">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-gray-500 font-semibold">Nº Ordem</th>
                      <th className="px-4 py-2.5 text-left text-gray-500 font-semibold">Conta</th>
                      <th className="px-4 py-2.5 text-right text-gray-500 font-semibold">Saldo Anterior</th>
                      <th className="px-4 py-2.5 text-right text-gray-500 font-semibold">Créditos</th>
                      <th className="px-4 py-2.5 text-right text-gray-500 font-semibold">Débitos</th>
                      <th className="px-4 py-2.5 text-right text-gray-500 font-semibold">Saldo Atual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={6} className="py-10 text-center text-gray-400">Carregando...</td></tr>
                    ) : detalhes.length === 0 ? (
                      <tr><td colSpan={6} className="py-10 text-center text-gray-400">Nenhum dado para este período.</td></tr>
                    ) : detalhes.map(row => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-400 font-mono">{row.num_ordem || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-800 font-medium max-w-[300px] truncate">{row.nome_conta}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{row.saldo_anterior != null ? `R$ ${fmt(row.saldo_anterior)}` : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">{row.creditos != null ? `R$ ${fmt(row.creditos)}` : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-red-500 font-medium">{row.debitos != null ? `R$ ${fmt(row.debitos)}` : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-cyan-700 font-bold">{row.saldo_atual != null ? `R$ ${fmt(row.saldo_atual)}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  {detalhes.length > 0 && (
                    <tfoot className="bg-slate-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">Total</td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-700">R$ {fmt(detalhes.reduce((s, r) => s + (r.saldo_anterior ?? 0), 0))}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-600">R$ {fmt(detalhes.reduce((s, r) => s + (r.creditos ?? 0), 0))}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-red-500">R$ {fmt(detalhes.reduce((s, r) => s + (r.debitos ?? 0), 0))}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-cyan-700">R$ {fmt(detalhes.reduce((s, r) => s + (r.saldo_atual ?? 0), 0))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}

        {!loading && resumos.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <Landmark size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 text-sm">Nenhum resumo bancário importado ainda.</p>
            <p className="text-gray-300 text-xs mt-1">Importe o relatório em Importação → Resumo Bancário.</p>
          </div>
        )}
      </div>
    </div>
  );
}
