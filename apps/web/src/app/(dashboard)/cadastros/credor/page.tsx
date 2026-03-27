'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Users, Search, ExternalLink, Check, Loader2, FileText, X, AlertTriangle, Trash2, Layers } from 'lucide-react';
import Link from 'next/link';
import { SearchSelect } from '@/components/SearchSelect';

const API = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface Grupo {
  id: number;
  nome: string;
}

interface Subgrupo {
  id: number;
  nome: string;
  fk_grupo: number;
}

interface Credor {
  id: number;
  nome: string;
  cnpj_cpf: string;
  tipo_doc: string;
  fk_grupo: number | null;
  grupo_nome: string | null;
  fk_subgrupo: number | null;
  subgrupo_nome: string | null;
  historico: string | null;
  precisa_reclassificacao: boolean;
  detalhar_no_pagamento: boolean;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ─── Modal de Histórico ───────────────────────────────────────────────────────

function HistoricoModal({
  credor,
  grupos,
  subgrupos,
  token,
  onClose,
  onSaved,
}: {
  credor: Credor;
  grupos: Grupo[];
  subgrupos: Subgrupo[];
  token: string;
  onClose: () => void;
  onSaved: (novoHistorico: string, grupoId: number | null, subgrupoId: number | null, grupoNome: string | null, subgrupoNome: string | null) => void;
}) {
  const [texto, setTexto] = useState(credor.historico ?? '');
  const [grupoId, setGrupoId] = useState<string>(credor.fk_grupo ? String(credor.fk_grupo) : '');
  const [subgrupoId, setSubgrupoId] = useState<string>(credor.fk_subgrupo ? String(credor.fk_subgrupo) : '');
  const [saving, setSaving] = useState(false);
  const [classificacao, setClassificacao] = useState<{
    elemento: string; fonte: string; tipo_empenho: string; entidade: string;
    ano: number; qtd: number; total: number; ultimo_pagamento: string;
  }[]>([]);
  const [loadingClass, setLoadingClass] = useState(false);

  useEffect(() => {
    async function fetchClass() {
      setLoadingClass(true);
      try {
        const res = await fetch(`${API}/credores/${credor.id}/classificacao`, { headers: authHeader(token) });
        if (res.ok) setClassificacao(await res.json());
      } catch { /* offline */ }
      setLoadingClass(false);
    }
    fetchClass();
  }, [credor.id, token]);

  const subgruposFiltrados = subgrupos.filter(s => String(s.fk_grupo) === grupoId);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`${API}/credores/${credor.id}`, {
        method: 'PUT',
        headers: authHeader(token),
        body: JSON.stringify({
          fk_grupo: grupoId ? Number(grupoId) : null,
          fk_subgrupo: subgrupoId ? Number(subgrupoId) : null,
          historico: texto.trim() || null,
        }),
      });
      const gNome = grupos.find(g => String(g.id) === grupoId)?.nome ?? null;
      const sNome = subgruposFiltrados.find(s => String(s.id) === subgrupoId)?.nome ?? null;
      onSaved(texto.trim(), grupoId ? Number(grupoId) : null, subgrupoId ? Number(subgrupoId) : null, gNome, sNome);
      onClose();
    } catch { /* API offline */ }
    setSaving(false);
  }

  const charCount = texto.length;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">

        {/* Header com gradiente */}
        <div style={{ background: 'linear-gradient(135deg, #0F2A4E 0%, #1a3a6b 60%, #0F2A4E 100%)' }} className="px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.4)' }}>
                <FileText size={18} color="#C9A84C" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base leading-tight">{credor.nome}</h2>
                <p className="text-xs mt-0.5" style={{ color: '#93c5fd' }}>Histórico / Anotações do Credor</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors mt-0.5"><X size={18} /></button>
          </div>

          {/* Chips de info */}
          <div className="flex flex-wrap gap-2 mt-4">
            {credor.cnpj_cpf && (
              <span className="text-xs px-2.5 py-1 rounded-full font-mono" style={{ background: 'rgba(255,255,255,0.1)', color: '#e2e8f0' }}>
                {credor.tipo_doc === 'CPF' ? 'CPF' : 'CNPJ'}: {credor.cnpj_cpf}
              </span>
            )}
            {credor.grupo_nome ? (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(30,77,149,0.4)', color: '#93c5fd' }}>
                {credor.grupo_nome}
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(234,88,12,0.3)', color: '#fdba74' }}>
                Sem grupo
              </span>
            )}
            {credor.subgrupo_nome && (
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(201,168,76,0.2)', color: '#fde68a' }}>
                {credor.subgrupo_nome}
              </span>
            )}
            {credor.precisa_reclassificacao && (
              <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: 'rgba(234,88,12,0.3)', color: '#fdba74' }}>
                <AlertTriangle size={10} /> Reclassificação pendente
              </span>
            )}
          </div>
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-4">

          {/* Classificação */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Classificação</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Grupo</label>
                <select
                  value={grupoId}
                  onChange={e => { setGrupoId(e.target.value); setSubgrupoId(''); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white text-gray-700"
                  style={{ '--tw-ring-color': '#1e4d95' } as React.CSSProperties}
                >
                  <option value="">— Sem grupo —</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Subgrupo</label>
                <select
                  value={subgrupoId}
                  onChange={e => setSubgrupoId(e.target.value)}
                  disabled={!grupoId || subgruposFiltrados.length === 0}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white text-gray-700 disabled:bg-gray-50 disabled:text-gray-400"
                  style={{ '--tw-ring-color': '#1e4d95' } as React.CSSProperties}
                >
                  <option value="">— Sem subgrupo —</option>
                  {subgruposFiltrados.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-100" />

          <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Anotações &amp; Observações
          </label>
          <textarea
            autoFocus
            rows={7}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none leading-relaxed text-gray-700"
            style={{ '--tw-ring-color': '#1e4d95' } as React.CSSProperties}
            placeholder="Ex: Fornecedor habitual de medicamentos. Contrato vigente até 12/2025. Pagamentos sempre no 5º dia útil..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-gray-400">Este campo é usado na classificação automática por histórico.</p>
            <span className={`text-xs font-mono ${charCount > 400 ? 'text-orange-500' : 'text-gray-400'}`}>{charCount} car.</span>
          </div>
          </div>

        </div>

        {/* Classificação Contábil */}
        <div className="px-6 pb-4">
          <div className="border-t border-dashed border-gray-100 mb-4" />
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Classificação Contábil</label>
            {loadingClass && <Loader2 size={12} className="animate-spin text-gray-400" />}
          </div>
          {!loadingClass && classificacao.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Nenhum pagamento encontrado para este credor.</p>
          ) : (
            <div style={{ maxHeight: '200px', overflowY: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: '#0F2A4E' }}>
                    {['Ano','Elemento','Fonte','Tipo','Entidade','Qtd','Total'].map(h => (
                      <th key={h} style={{ padding: '7px 8px', color: '#e2e8f0', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: h === 'Total' ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classificacao.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbff' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0F2A4E', whiteSpace: 'nowrap' }}>{r.ano}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#1e4d95', whiteSpace: 'nowrap' }}>{r.elemento}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#64748b', whiteSpace: 'nowrap' }}>{r.fonte}</td>
                      <td style={{ padding: '6px 8px', color: '#475569', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.tipo_empenho}>{r.tipo_empenho}</td>
                      <td style={{ padding: '6px 8px', color: '#475569', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.entidade}>{r.entidade}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b' }}>{r.qtd}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {Number(r.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Check size={11} className="text-green-500" /> Salvo automaticamente no próximo login
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 font-medium transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm rounded-lg text-white font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
              style={{ background: saving ? '#94a3b8' : '#0F2A4E' }}
            >
              {saving ? <><Loader2 size={13} className="animate-spin" /> Salvando...</> : <><Check size={13} /> Salvar</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Modal Confirmação Limpar Credores ────────────────────────────────────────

function LimparCredoresModal({
  token,
  onClose,
  onDone,
}: {
  token: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const CONFIRM_WORD = 'LIMPAR';

  async function handleDelete() {
    if (confirmText !== CONFIRM_WORD) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`${API}/credores`, {
        method: 'DELETE',
        headers: authHeader(token),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Erro ao excluir');
        setDeleting(false);
        return;
      }
      onDone();
      onClose();
    } catch {
      setError('API indisponível');
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <Trash2 size={18} className="text-red-600" />
            </div>
            <h2 className="font-semibold text-gray-800">Limpar todos os credores</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-1">
            <p className="font-semibold">⚠️ Atenção: esta ação é irreversível!</p>
            <p>Todos os credores serão permanentemente excluídos. Os pagamentos importados serão mantidos.</p>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Digite <span className="font-bold text-red-600">{CONFIRM_WORD}</span> para confirmar:
            </label>
            <input
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 font-mono tracking-widest"
              placeholder={CONFIRM_WORD}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancelar</button>
          <button
            onClick={handleDelete}
            disabled={confirmText !== CONFIRM_WORD || deleting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 size={14} />
            {deleting ? 'Excluindo...' : 'Limpar tudo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Linha com dropdowns inline ───────────────────────────────────────────────

function CredorRow({
  credor,
  grupos,
  subgrupos,
  token,
  onSaved,
  onOpenHistorico,
}: {
  credor: Credor;
  grupos: Grupo[];
  subgrupos: Subgrupo[];
  token: string;
  onSaved: () => void;
  onOpenHistorico: (c: Credor) => void;
}) {
  const [fkGrupo, setFkGrupo] = useState<number | ''>(credor.fk_grupo ?? '');
  const [fkSubgrupo, setFkSubgrupo] = useState<number | ''>(credor.fk_subgrupo ?? '');
  const [detalhar, setDetalhar] = useState(!!credor.detalhar_no_pagamento);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const subgruposFiltrados = subgrupos.filter((s) => s.fk_grupo === Number(fkGrupo));

  async function save(grupoVal: number | '', subgrupoVal: number | '', detalharVal?: boolean) {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`${API}/credores/${credor.id}`, {
        method: 'PUT',
        headers: authHeader(token),
        body: JSON.stringify({
          fk_grupo: grupoVal || null,
          fk_subgrupo: subgrupoVal || null,
          ...(detalharVal !== undefined && { detalhar_no_pagamento: detalharVal }),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onSaved();
    } catch { /* API offline */ }
    setSaving(false);
  }

  function handleGrupoChange(val: number | '') {
    setFkGrupo(val);
    setFkSubgrupo('');
    save(val, '');
  }

  function handleSubgrupoChange(val: number | '') {
    setFkSubgrupo(val);
    save(fkGrupo, val);
  }

  function handleDetalharToggle() {
    const next = !detalhar;
    setDetalhar(next);
    save(fkGrupo, fkSubgrupo, next);
  }

  return (
    <tr className={`border-b transition-colors ${!!credor.precisa_reclassificacao ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-50'}`}>
      <td className="px-3 py-2 font-medium text-gray-900 max-w-[220px]">
        <div className="truncate" title={credor.nome}>{credor.nome}</div>
        {!!credor.precisa_reclassificacao && (
          <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-orange-200 text-orange-800">
            <AlertTriangle size={10} /> Nova classif. necessária
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <SearchSelect
          value={fkGrupo}
          onChange={(val) => handleGrupoChange(val === '' ? '' : Number(val))}
          options={grupos}
          placeholder="sem grupo"
        />
      </td>
      <td className="px-3 py-2">
        <SearchSelect
          value={fkSubgrupo}
          onChange={(val) => handleSubgrupoChange(val === '' ? '' : Number(val))}
          options={subgruposFiltrados}
          placeholder="sem subgrupo"
          disabled={!fkGrupo || subgruposFiltrados.length === 0}
        />
      </td>
      {/* Histórico preview */}
      <td className="px-3 py-2 max-w-[220px]">
        <button
          onClick={() => onOpenHistorico(credor)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors group w-full text-left"
          title={credor.historico ?? 'Adicionar histórico'}
        >
          <FileText size={13} className={credor.historico ? 'text-blue-500' : 'text-gray-300 group-hover:text-blue-400'} />
          <span className="truncate">
            {credor.historico
              ? <span className="text-gray-600">{credor.historico}</span>
              : <span className="text-gray-300 italic">adicionar...</span>
            }
          </span>
        </button>
      </td>
      {/* Toggle detalhar por pagamento */}
      <td className="px-3 py-2 text-center">
        <button
          onClick={handleDetalharToggle}
          title={detalhar ? 'Classificando por pagamento — clique para desativar' : 'Ativar classificação por pagamento'}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
            detalhar
              ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          <Layers size={12} />
          {detalhar ? 'Por pag.' : 'Padrão'}
        </button>
      </td>
      <td className="px-3 py-2 text-center w-8">
        {saving && <Loader2 size={14} className="animate-spin text-blue-400 mx-auto" />}
        {saved && !saving && <Check size={14} className="text-emerald-500 mx-auto" />}
      </td>
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CredorPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken ?? '';

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [subgrupos, setSubgrupos] = useState<Subgrupo[]>([]);
  const [credores, setCredores] = useState<Credor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterGrupo, setFilterGrupo] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, semGrupo: 0, semSubgrupo: 0 });
  const [cardFilter, setCardFilter] = useState<'semGrupo' | 'semSubgrupo' | null>(null);
  const [historicoModal, setHistoricoModal] = useState<Credor | null>(null);
  const [showLimparModal, setShowLimparModal] = useState(false);
  const [classificandoDiarias, setClassificandoDiarias] = useState(false);
  const [diariasResult, setDiariasResult] = useState<number | null>(null);

  const LIMIT = 50;

  const loadGrupos = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/credores/grupos`, { headers: authHeader(token) });
      if (res.ok) setGrupos(await res.json());
    } catch { /* API offline */ }
  }, [token]);

  const loadSubgrupos = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/credores/subgrupos`, { headers: authHeader(token) });
      if (res.ok) setSubgrupos(await res.json());
    } catch { /* API offline */ }
  }, [token]);

  const loadCredores = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set('search', search);
      if (filterGrupo) params.set('grupoId', filterGrupo);
      if (cardFilter === 'semGrupo') params.set('semGrupo', '1');
      if (cardFilter === 'semSubgrupo') params.set('semSubgrupo', '1');
      const res = await fetch(`${API}/credores?${params}`, { headers: authHeader(token) });
      if (res.ok) {
        const data = await res.json();
        setCredores(data.rows);
        setTotal(data.total);
      }
    } catch { /* API offline */ }
    setLoading(false);
  }, [token, page, search, filterGrupo, cardFilter]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/credores/stats`, { headers: authHeader(token) });
      if (res.ok) setStats(await res.json());
    } catch { /* API offline */ }
  }, [token]);

  useEffect(() => { loadGrupos(); loadSubgrupos(); loadStats(); }, [loadGrupos, loadSubgrupos, loadStats]);
  useEffect(() => { loadCredores(); }, [loadCredores]);

  const totalPages = Math.ceil(total / LIMIT);

  async function handleAutoClassificarDiarias() {
    setClassificandoDiarias(true);
    setDiariasResult(null);
    try {
      const res = await fetch(`${API}/credores/auto-classificar-diarias`, {
        method: 'POST',
        headers: authHeader(token),
      });
      if (res.ok) {
        const data = await res.json();
        setDiariasResult(data.updated);
        if (data.updated > 0) { loadCredores(); loadStats(); }
      }
    } catch { /* API offline */ }
    setClassificandoDiarias(false);
  }

  function handleHistoricoSaved(credorId: number, novoHistorico: string, grupoId: number | null, subgrupoId: number | null, grupoNome: string | null, subgrupoNome: string | null) {
    const saeDaLista =
      (cardFilter === 'semGrupo' && grupoId !== null) ||
      (cardFilter === 'semSubgrupo' && subgrupoId !== null);

    if (saeDaLista) {
      setCredores(prev => prev.filter(c => c.id !== credorId));
    } else {
      setCredores(prev => prev.map(c => c.id === credorId ? {
        ...c,
        historico: novoHistorico || null,
        fk_grupo: grupoId,
        grupo_nome: grupoNome,
        fk_subgrupo: subgrupoId,
        subgrupo_nome: subgrupoNome,
      } : c));
    }
    loadStats();
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Users size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Credores</h1>
            <p className="text-sm text-gray-500">Cadastrados automaticamente na importação</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/cadastros/grupo" className="flex items-center gap-1.5 px-3 py-2 text-xs border rounded-xl hover:bg-gray-50 text-gray-600">
            <ExternalLink size={13} /> Cad. Despesa
          </Link>
          <Link href="/cadastros/subgrupo" className="flex items-center gap-1.5 px-3 py-2 text-xs border rounded-xl hover:bg-gray-50 text-gray-600">
            <ExternalLink size={13} /> Cad. Subgrupo
          </Link>
          <button
            onClick={handleAutoClassificarDiarias}
            disabled={classificandoDiarias}
            className="flex items-center gap-1.5 px-3 py-2 text-xs border border-amber-300 rounded-xl hover:bg-amber-50 text-amber-700 transition-colors disabled:opacity-60"
          >
            {classificandoDiarias
              ? <Loader2 size={13} className="animate-spin" />
              : <Check size={13} />}
            Auto-classificar Diárias
            {diariasResult !== null && (
              <span className="ml-1 bg-amber-200 text-amber-800 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                {diariasResult}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowLimparModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs border border-red-200 rounded-xl hover:bg-red-50 text-red-600 transition-colors"
          >
            <Trash2 size={13} /> Limpar credores
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {/* Total — clica e limpa filtro de card */}
        <button
          onClick={() => { setCardFilter(null); setPage(1); }}
          className={`text-left rounded-xl border p-4 transition-all ${cardFilter === null ? 'bg-[#0F2A4E] border-[#0F2A4E] shadow-md' : 'bg-white hover:border-[#0F2A4E] hover:shadow-sm'}`}
        >
          <p className={`text-xs font-medium ${cardFilter === null ? 'text-blue-200' : 'text-gray-500'}`}>Total de Credores</p>
          <p className={`text-2xl font-bold mt-1 ${cardFilter === null ? 'text-white' : 'text-gray-900'}`}>{stats.total}</p>
          <p className={`text-xs mt-1 ${cardFilter === null ? 'text-blue-300' : 'text-gray-400'}`}>Cadastrados via importação</p>
        </button>

        {/* Sem Grupo */}
        <button
          onClick={() => { setCardFilter(cardFilter === 'semGrupo' ? null : 'semGrupo'); setPage(1); }}
          className={`text-left rounded-xl border p-4 transition-all ${cardFilter === 'semGrupo' ? 'bg-orange-500 border-orange-500 shadow-md' : 'bg-white hover:border-orange-400 hover:shadow-sm'}`}
        >
          <p className={`text-xs font-medium ${cardFilter === 'semGrupo' ? 'text-orange-100' : 'text-gray-500'}`}>Sem Grupo</p>
          <p className={`text-2xl font-bold mt-1 ${cardFilter === 'semGrupo' ? 'text-white' : 'text-orange-500'}`}>{stats.semGrupo}</p>
          <p className={`text-xs mt-1 ${cardFilter === 'semGrupo' ? 'text-orange-100' : 'text-gray-400'}`}>Aguardando classificação</p>
        </button>

        {/* Sem Subgrupo */}
        <button
          onClick={() => { setCardFilter(cardFilter === 'semSubgrupo' ? null : 'semSubgrupo'); setPage(1); }}
          className={`text-left rounded-xl border p-4 transition-all ${
            cardFilter === 'semSubgrupo'
              ? 'bg-purple-700 border-purple-700 shadow-md'
              : stats.semSubgrupo > 0
              ? 'bg-purple-50 border-purple-200 hover:border-purple-400 hover:shadow-sm'
              : 'bg-white hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          <p className={`text-xs font-medium flex items-center gap-1 ${cardFilter === 'semSubgrupo' ? 'text-purple-100' : 'text-gray-500'}`}>
            {stats.semSubgrupo > 0 && <Layers size={11} className={cardFilter === 'semSubgrupo' ? 'text-purple-200' : 'text-purple-500'} />}
            Sem Subgrupo
          </p>
          <p className={`text-2xl font-bold mt-1 ${cardFilter === 'semSubgrupo' ? 'text-white' : stats.semSubgrupo > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
            {stats.semSubgrupo}
          </p>
          <p className={`text-xs mt-1 ${cardFilter === 'semSubgrupo' ? 'text-purple-100' : 'text-gray-400'}`}>Com grupo, sem subgrupo definido</p>
        </button>

        {/* Grupos Cadastrados — apenas visual, sem filtro */}
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Grupos Cadastrados</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{grupos.length}</p>
          <p className="text-xs text-gray-400 mt-1">Disponíveis para uso</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border">
        {/* Busca + filtro */}
        <div className="p-4 border-b flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Buscar por nome ou CNPJ/CPF..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-56 shrink-0">
            <SearchSelect
              value={filterGrupo}
              onChange={(val) => { setFilterGrupo(val === '' ? '' : String(val)); setPage(1); }}
              options={grupos}
              placeholder="Todos os grupos"
            />
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-visible rounded-b-2xl">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Credor</th>
                <th className="px-3 py-2 text-left w-48">Grupo</th>
                <th className="px-3 py-2 text-left w-52">Subgrupo</th>
                <th className="px-3 py-2 text-left">Histórico</th>
                <th className="px-3 py-2 text-center text-indigo-600 w-20" title="Classificar cada pagamento individualmente">
                  <Layers size={13} className="mx-auto" />
                </th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Carregando...</td></tr>
              ) : credores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <Users size={32} className="mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-400 text-sm">Nenhum credor encontrado</p>
                    <p className="text-gray-400 text-xs mt-1">Os credores são cadastrados automaticamente ao importar um relatório</p>
                  </td>
                </tr>
              ) : credores.map((c) => (
                <CredorRow
                  key={c.id}
                  credor={c}
                  grupos={grupos}
                  subgrupos={subgrupos}
                  token={token}
                  onSaved={loadStats}
                  onOpenHistorico={setHistoricoModal}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t text-sm text-gray-500">
            <span>{total} credores no total</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50">Anterior</button>
              <span className="text-xs">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50">Próximo</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de histórico */}
      {historicoModal && (
        <HistoricoModal
          credor={historicoModal}
          grupos={grupos}
          subgrupos={subgrupos}
          token={token}
          onClose={() => setHistoricoModal(null)}
          onSaved={(novo, gId, sId, gNome, sNome) => handleHistoricoSaved(historicoModal.id, novo, gId, sId, gNome, sNome)}
        />
      )}

      {/* Modal limpar credores */}
      {showLimparModal && (
        <LimparCredoresModal
          token={token}
          onClose={() => setShowLimparModal(false)}
          onDone={() => { loadCredores(); loadStats(); }}
        />
      )}
    </div>
  );
}
