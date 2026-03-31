'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { Download, X, ChevronLeft, ChevronRight, SlidersHorizontal, Search, Layers, Check, Loader2, FileText, Tag, ChevronUp, ChevronDown, Building2, Hash, DollarSign, SplitSquareHorizontal, Plus, Trash2, ScrollText, BarChart2, LayoutGrid, Receipt, BookMarked, Settings2, Link2, Link2Off } from 'lucide-react';
import TopBar from '@/components/dashboard/TopBar';
import { SearchSelect } from '@/components/SearchSelect';
import { apiRequest } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { OrdemPagamento } from '@public-auditor/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Grupo { id: number; nome: string; }
interface Subgrupo { id: number; nome: string; fk_grupo: number; }
interface Setor { id: number; descricao: string; fk_bloco: number; palavras_chave?: string | null; num_empenhos?: string | null; }

interface PagamentosResponse {
  rows: OrdemPagamento[];
  total: number;
  page: number;
  limit: number;
}

// ─── Fonte recurso badge ──────────────────────────────────────────────────────

function FonteBadge({ codigo }: { codigo?: string | null }) {
  if (!codigo) return <span style={{ color: '#cbd5e1' }}>—</span>;
  const palettes: Record<string, { bg: string; color: string; border: string }> = {
    '15000000': { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    '15001002': { bg: '#dbeafe', color: '#1e3a8a', border: '#93c5fd' },
    '16000000': { bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
    '16040000': { bg: '#fefce8', color: '#854d0e', border: '#fde68a' },
    '16050000': { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },
    '16210000': { bg: '#fdf4ff', color: '#7e22ce', border: '#d8b4fe' },
    '16310000': { bg: '#f0fdfa', color: '#0f766e', border: '#5eead4' },
  };
  const p = palettes[String(codigo).trim()] ?? { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' };
  return (
    <span
      title={codigo}
      style={{
        display: 'inline-block', padding: '2px 7px', borderRadius: '5px',
        fontWeight: 600, fontSize: '10px', fontFamily: 'ui-monospace, monospace',
        background: p.bg, color: p.color, border: `1px solid ${p.border}`,
        whiteSpace: 'nowrap', letterSpacing: '0.02em',
      }}
    >
      {codigo}
    </span>
  );
}

// ─── Tipo badge ───────────────────────────────────────────────────────────────

function TipoBadge({ tipo }: { tipo?: string }) {
  if (!tipo) return <span className="text-gray-300 text-xs">—</span>;
  const styles: Record<string, string> = {
    OR: 'bg-blue-100 text-blue-700',
    RP: 'bg-amber-100 text-amber-700',
    DEA: 'bg-red-100 text-red-700',
  };
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold', styles[tipo] || 'bg-gray-100 text-gray-500')}>
      {tipo}
    </span>
  );
}

// ─── Setor auto-detect helper ─────────────────────────────────────────────────

type SetorMatch = { setor: Setor; via: 'descricao' | 'keyword' | 'empenho' } | null;

function detectSetor(
  historico: string | null | undefined,
  setores: Setor[],
  numEmpenhoBase?: string | null,
): SetorMatch {
  const sorted = [...setores].sort((a, b) => b.descricao.length - a.descricao.length);

  if (historico) {
    const h = historico.toUpperCase();

    // 1. Por nome do setor no histórico
    for (const s of sorted) {
      if (h.includes(s.descricao.toUpperCase())) return { setor: s, via: 'descricao' };
    }

    // 2. Por palavra-chave
    for (const s of sorted) {
      if (s.palavras_chave) {
        const keywords = s.palavras_chave.split(',').map((k) => k.trim().toUpperCase()).filter(Boolean);
        if (keywords.some((kw) => h.includes(kw))) return { setor: s, via: 'keyword' };
      }
    }
  }

  // 3. Por número de empenho base
  if (numEmpenhoBase?.trim()) {
    const base = numEmpenhoBase.trim();
    for (const s of sorted) {
      if (s.num_empenhos) {
        const empenhos = s.num_empenhos.split(',').map((e) => e.trim()).filter(Boolean);
        if (empenhos.includes(base)) return { setor: s, via: 'empenho' };
      }
    }
  }

  return null;
}

// ─── Modal classificar setor + palavra-chave ──────────────────────────────────

function SetorClassificarModal({
  row, setores, token, onSaved, onClose,
}: {
  row: OrdemPagamento;
  setores: Setor[];
  token: string;
  onSaved: (setorId: number, setorNome: string) => void;
  onClose: () => void;
}) {
  const [setorId, setSetorId] = useState<number | ''>('');
  const [keyword, setKeyword] = useState('');
  const [addEmpenho, setAddEmpenho] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!setorId) return;
    setSaving(true);
    try {
      // 1. Classifica o pagamento
      await fetch(`${API_URL}/api/pagamentos/${row.id}/classificar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fk_setor_pag: setorId }),
      });

      const setor = setores.find((s) => s.id === Number(setorId));
      const body: Record<string, string> = {};

      // 2. Palavra-chave
      if (keyword.trim()) {
        const atual = setor?.palavras_chave || '';
        const novas = [...new Set([...atual.split(',').map((k) => k.trim()).filter(Boolean), keyword.trim().toUpperCase()])].join(', ');
        body.palavras_chave = novas;
        if (setor) setor.palavras_chave = novas;
      }

      // 3. Número do empenho base
      if (addEmpenho && row.num_empenho_base?.trim()) {
        const atual = setor?.num_empenhos || '';
        const novos = [...new Set([...atual.split(',').map((e) => e.trim()).filter(Boolean), row.num_empenho_base.trim()])].join(', ');
        body.num_empenhos = novos;
        if (setor) setor.num_empenhos = novos;
      }

      if (Object.keys(body).length > 0) {
        await fetch(`${API_URL}/api/setores/${setorId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      setSaved(true);
      const nome = setor?.descricao ?? '';
      onSaved(Number(setorId), nome);
      setTimeout(onClose, 700);
    } catch { /* API offline */ }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Settings2 size={15} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Classificar Setor</p>
              <p className="text-xs text-gray-400 truncate max-w-[300px]">{row.credor_nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Histórico completo */}
          {row.historico && (
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">Histórico da Despesa</p>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{row.historico}</p>
            </div>
          )}

          {/* Classificação Orçamentária */}
          {(row.unidade_orcamentaria || row.acao || row.elemento_despesa || row.fonte_recurso) && (
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Classificação Orçamentária</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {row.unidade_orcamentaria && (
                  <div><p className="text-[10px] text-gray-400">Unid. Orçamentária</p>
                  <p className="text-xs font-mono font-medium text-gray-700">{row.unidade_orcamentaria}</p></div>
                )}
                {row.acao && (
                  <div><p className="text-[10px] text-gray-400">Ação</p>
                  <p className="text-xs font-mono font-medium text-gray-700">{row.acao}</p></div>
                )}
                {row.elemento_despesa && (
                  <div><p className="text-[10px] text-gray-400">Elemento de Despesa</p>
                  <p className="text-xs font-mono font-medium text-gray-700">{row.elemento_despesa}</p></div>
                )}
                {row.fonte_recurso && (
                  <div><p className="text-[10px] text-gray-400 mb-0.5">Fonte de Recurso</p>
                  <FonteBadge codigo={row.fonte_recurso} /></div>
                )}
                {(row as any).sub_elemento && (
                  <div><p className="text-[10px] text-gray-400">Sub-elemento</p>
                  <p className="text-xs font-mono font-medium text-gray-700">{(row as any).sub_elemento}</p></div>
                )}
              </div>
            </div>
          )}

          {/* Select do setor */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Setor *</label>
            <select
              autoFocus
              value={setorId}
              onChange={(e) => setSetorId(e.target.value ? Number(e.target.value) : '')}
              className="w-full text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— selecione um setor —</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.descricao}</option>)}
            </select>
          </div>

          {/* Empenho base — vínculo direto */}
          {row.num_empenho_base && (
            <label className="flex items-start gap-3 cursor-pointer bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
              <input
                type="checkbox"
                checked={addEmpenho}
                onChange={(e) => setAddEmpenho(e.target.checked)}
                className="mt-0.5 accent-teal-600"
              />
              <div>
                <p className="text-xs font-medium text-teal-800">
                  Vincular empenho <span className="font-mono bg-teal-100 px-1.5 py-0.5 rounded">{row.num_empenho_base}</span> ao setor
                </p>
                <p className="text-[10px] text-teal-600 mt-0.5">
                  Próximos pagamentos deste empenho serão classificados automaticamente.
                </p>
              </div>
            </label>
          )}

          {/* Palavra-chave */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Palavra-chave para auto-classificar futuramente
              <span className="ml-1 text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Ex: MEDFASP, COELBA, EMBASA..."
              className="w-full text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {keyword.trim() && (
              <p className="text-[10px] text-blue-500 mt-1">Será adicionada ao cadastro do setor selecionado.</p>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!setorId || saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Classificar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Setor cell ───────────────────────────────────────────────────────────────

function SetorCell({
  row, setores, token, onSaved,
}: {
  row: OrdemPagamento;
  setores: Setor[];
  token: string;
  onSaved: (id: number, fkSetor: number | null, setorNome: string | null) => void;
}) {
  const [fkSetor, setFkSetor] = useState<number | ''>(row.fk_setor_pag ?? '');
  const [showClassificarModal, setShowClassificarModal] = useState(false);

  // Determina matchVia inicial: se já salvo, re-detecta para saber a origem
  function resolveInitialVia(): 'descricao' | 'keyword' | 'empenho' | 'manual' | null {
    if (!row.fk_setor_pag) return null;
    const match = detectSetor(row.historico, setores, row.num_empenho_base);
    if (match && match.setor.id === row.fk_setor_pag) return match.via;
    return 'manual';
  }

  const [matchVia, setMatchVia] = useState<'descricao' | 'keyword' | 'empenho' | 'manual' | null>(resolveInitialVia);
  const [saving, setSaving] = useState(false);
  const autoSaved = useRef(false);

  // Auto-detect on mount if no setor assigned
  useEffect(() => {
    if (row.fk_setor_pag || autoSaved.current) return;
    const match = detectSetor(row.historico, setores, row.num_empenho_base);
    if (match) {
      autoSaved.current = true;
      setFkSetor(match.setor.id);
      setMatchVia(match.via);
      // Auto-save
      fetch(`${API_URL}/api/pagamentos/${row.id}/classificar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fk_setor_pag: match.setor.id }),
      }).then(() => {
        onSaved(row.id, match.setor.id, match.setor.descricao);
      }).catch(() => { /* API offline */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChange(val: number | '') {
    setFkSetor(val);
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/pagamentos/${row.id}/classificar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fk_setor_pag: val || null }),
      });
    } catch { /* API offline */ }
    setSaving(false);
    const setor = setores.find((s) => s.id === Number(val));
    onSaved(row.id, val ? Number(val) : null, setor?.descricao ?? null);
  }

  const setorNome = setores.find((s) => s.id === Number(fkSetor))?.descricao;

  // Color scheme based on match type
  // Verde escuro = empenho | Verde = nome do setor | Amarelo = palavra-chave | Vermelho = manual
  const badgeColors = matchVia === 'empenho'
    ? 'bg-teal-100 text-teal-700'
    : matchVia === 'descricao'
      ? 'bg-emerald-100 text-emerald-700'
      : matchVia === 'keyword'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700'; // manual

  // If already assigned (either from DB or auto-detect), show badge
  if (fkSetor && setorNome) {
    return (
      <td className="px-3 py-2.5" style={{ borderRight: '1px solid #f0f4fb' }}>
        <div className="flex items-center gap-1">
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap', badgeColors)}>
            <Building2 size={9} />
            {setorNome}
          </span>
          {saving && <Loader2 size={10} className="animate-spin text-gray-400" />}
          <button
            onClick={() => handleChange('')}
            className="text-gray-300 hover:text-red-400 transition-colors"
            title="Limpar setor"
          >
            <X size={10} />
          </button>
        </div>
      </td>
    );
  }

  // No match — show dropdown with red tint + classify button
  return (
    <>
      <td className="px-3 py-2.5" style={{ borderRight: '1px solid #f0f4fb' }}>
        <div className="flex items-center gap-1">
          <select
            value={fkSetor}
            onChange={(e) => { handleChange(e.target.value ? Number(e.target.value) : ''); if (e.target.value) setMatchVia('manual'); }}
            className="text-[10px] border border-red-200 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-400 bg-red-50 text-red-600 min-w-[80px]"
          >
            <option value="">— setor —</option>
            {setores.map((s) => <option key={s.id} value={s.id}>{s.descricao}</option>)}
          </select>
          {saving
            ? <Loader2 size={10} className="animate-spin text-red-400" />
            : (
              <button
                onClick={() => setShowClassificarModal(true)}
                title="Classificar setor e adicionar palavra-chave"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '5px', border: 'none', background: 'none', cursor: 'pointer', color: '#f87171', flexShrink: 0, padding: 0, transition: 'all 0.12s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fee2e2'; (e.currentTarget as HTMLButtonElement).style.color = '#dc2626'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; }}
              >
                <Settings2 size={12} />
              </button>
            )
          }
        </div>
      </td>
      {showClassificarModal && (
        <SetorClassificarModal
          row={row}
          setores={setores}
          token={token}
          onClose={() => setShowClassificarModal(false)}
          onSaved={(id, nome) => {
            setFkSetor(id);
            setMatchVia('manual');
            setShowClassificarModal(false);
            onSaved(row.id, id, nome);
          }}
        />
      )}
    </>
  );
}

// ─── Célula de classificação inline ──────────────────────────────────────────

function ClassificacaoCell({
  row, grupos, subgrupos, token, onSaved,
}: {
  row: OrdemPagamento;
  grupos: Grupo[];
  subgrupos: Subgrupo[];
  token: string;
  onSaved: (id: number, grupoNome: string | null, subgrupoNome: string | null, fkGrupo: number | null, fkSubgrupo: number | null) => void;
}) {
  const [fkGrupo, setFkGrupo] = useState<number | ''>(row.fk_grupo_pag ?? '');
  const [fkSubgrupo, setFkSubgrupo] = useState<number | ''>(row.fk_subgrupo_pag ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const subsFiltrados = subgrupos.filter((s) => s.fk_grupo === Number(fkGrupo));

  async function save(g: number | '', s: number | '') {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`${API_URL}/api/pagamentos/${row.id}/classificar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fk_grupo_pag: g || null, fk_subgrupo_pag: s || null }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      const grupoNome = grupos.find((gr) => gr.id === Number(g))?.nome ?? null;
      const subgrupoNome = subsFiltrados.find((sb) => sb.id === Number(s))?.nome ?? null;
      onSaved(row.id, grupoNome, subgrupoNome, g ? Number(g) : null, s ? Number(s) : null);
    } catch { /* API offline */ }
    setSaving(false);
  }

  function handleGrupo(val: number | string | '') {
    const v = val === '' ? '' : Number(val);
    setFkGrupo(v);
    setFkSubgrupo('');
    save(v, '');
  }

  function handleSubgrupo(val: number | string | '') {
    const v = val === '' ? '' : Number(val);
    setFkSubgrupo(v);
    save(fkGrupo, v);
  }

  return (
    <>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Layers size={11} className="text-indigo-400 shrink-0" />
          <SearchSelect
            value={fkGrupo}
            onChange={handleGrupo}
            options={grupos}
            placeholder="sem grupo"
          />
        </div>
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <SearchSelect
            value={fkSubgrupo}
            onChange={handleSubgrupo}
            options={subsFiltrados}
            placeholder="sem subgrupo"
            disabled={!fkGrupo || subsFiltrados.length === 0}
          />
          {saving && <Loader2 size={12} className="animate-spin text-indigo-400 shrink-0" />}
          {saved && !saving && <Check size={12} className="text-emerald-500 shrink-0" />}
        </div>
      </td>
    </>
  );
}

// ─── Modal regra de empenho ───────────────────────────────────────────────────

function RegraEmpenhoModal({
  row, grupos, subgrupos, token, onClose, onSaved,
}: {
  row: OrdemPagamento;
  grupos: Grupo[];
  subgrupos: Subgrupo[];
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const empenhoBase = (row as any).num_empenho_base || row.num_empenho;
  const credorId = (row as any).fk_credor;

  const [fkGrupo, setFkGrupo] = useState<number | ''>(row.fk_grupo_pag ?? '');
  const [fkSubgrupo, setFkSubgrupo] = useState<number | ''>(row.fk_subgrupo_pag ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [regraExistente, setRegraExistente] = useState<any>(null);
  const [loadingRegra, setLoadingRegra] = useState(true);
  const [deletando, setDeletando] = useState(false);

  const subsFiltrados = subgrupos.filter((s) => s.fk_grupo === Number(fkGrupo));

  useEffect(() => {
    if (!credorId || !empenhoBase) { setLoadingRegra(false); return; }
    fetch(`${API_URL}/api/regras-empenho?fk_credor=${credorId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: any[]) => {
        const regra = Array.isArray(data) ? data.find((r) => r.num_empenho_base === String(empenhoBase)) : null;
        setRegraExistente(regra ?? null);
        if (regra) {
          setFkGrupo(regra.fk_grupo ?? '');
          setFkSubgrupo(regra.fk_subgrupo ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setLoadingRegra(false));
  }, [credorId, empenhoBase, token]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/regras-empenho`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          num_empenho_base: empenhoBase,
          fk_credor: credorId,
          fk_pagamento: row.id,
          fk_grupo: fkGrupo || null,
          fk_subgrupo: fkSubgrupo || null,
        }),
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); onSaved(); onClose(); }, 1200);
    } catch { /* offline */ }
    setSaving(false);
  }

  async function handleDelete() {
    if (!regraExistente) return;
    if (!confirm(`Remover regra do empenho ${empenhoBase}?`)) return;
    setDeletando(true);
    try {
      await fetch(`${API_URL}/api/regras-empenho/${regraExistente.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      onSaved();
      onClose();
    } catch { /* offline */ }
    setDeletando(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-violet-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
              <Link2 size={15} className="text-violet-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">Regra por Empenho</h3>
              <p className="text-[11px] text-gray-400">Empenho base: <span className="font-mono font-medium text-gray-600">{empenhoBase}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loadingRegra ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={18} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {regraExistente ? (
                <div className="flex items-center justify-between px-3 py-2.5 bg-violet-50 rounded-xl border border-violet-200">
                  <div className="flex items-center gap-2">
                    <Link2 size={13} className="text-violet-500 shrink-0" />
                    <div>
                      <p className="text-[11px] text-violet-500 uppercase font-medium tracking-wide">Regra ativa</p>
                      <p className="text-xs font-semibold text-violet-800">
                        {regraExistente.grupo_nome || '—'}
                        {regraExistente.subgrupo_nome && <span className="font-normal text-violet-600"> / {regraExistente.subgrupo_nome}</span>}
                      </p>
                    </div>
                  </div>
                  <button onClick={handleDelete} disabled={deletando}
                    className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600 border border-red-200 hover:border-red-300 px-2 py-1 rounded-lg bg-white transition-colors">
                    <Link2Off size={11} />
                    {deletando ? '...' : 'Desvincular'}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Link2Off size={12} />
                  Nenhuma regra ativa para o empenho <span className="font-mono font-medium text-gray-600">{empenhoBase}</span>
                </p>
              )}

              <div className="border-t pt-3">
                <p className="text-xs text-gray-500 mb-3">
                  {regraExistente ? 'Trocar para outro grupo/subgrupo:' : 'Vincular empenho ao grupo/subgrupo:'}
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Grupo</label>
                    <select value={fkGrupo} onChange={(e) => { setFkGrupo(e.target.value ? Number(e.target.value) : ''); setFkSubgrupo(''); }}
                      className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                      <option value="">— sem grupo —</option>
                      {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Subgrupo</label>
                    <select value={fkSubgrupo} onChange={(e) => setFkSubgrupo(e.target.value ? Number(e.target.value) : '')}
                      disabled={!fkGrupo || subsFiltrados.length === 0}
                      className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white disabled:opacity-40">
                      <option value="">— sem subgrupo —</option>
                      {subsFiltrados.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50">
          <div>
            {regraExistente && (
              <button onClick={handleDelete} disabled={deletando}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors">
                <Link2Off size={12} />
                {deletando ? 'Removendo...' : 'Remover regra'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-100">Cancelar</button>
            <button onClick={handleSave} disabled={saving || saved || !fkGrupo}
              className={`px-3 py-1.5 text-xs rounded-lg text-white font-medium flex items-center gap-1.5 transition-colors ${saved ? 'bg-emerald-500' : 'bg-violet-600 hover:bg-violet-700 disabled:opacity-50'}`}>
              {saving ? <Loader2 size={11} className="animate-spin" /> : saved ? <Check size={11} /> : <Link2 size={11} />}
              {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar regra'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de detalhe do histórico ───────────────────────────────────────────

function HistoricoDetalheModal({
  row, grupos, subgrupos, token, onClose, onClassificado,
}: {
  row: OrdemPagamento;
  grupos: Grupo[];
  subgrupos: Subgrupo[];
  token: string;
  onClose: () => void;
  onClassificado: (id: number, grupoNome: string | null, subgrupoNome: string | null, fkGrupo: number | null, fkSubgrupo: number | null) => void;
}) {
  const [fkGrupo, setFkGrupo] = useState<number | ''>(row.fk_grupo_pag ?? '');
  const [fkSubgrupo, setFkSubgrupo] = useState<number | ''>(row.fk_subgrupo_pag ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showRegraEmpenho, setShowRegraEmpenho] = useState(false);

  const subsFiltrados = subgrupos.filter((s) => s.fk_grupo === Number(fkGrupo));
  const temOverride = !!(row.fk_grupo_pag);
  const empenhoBaseParaVinculo = (row as any).num_empenho_base || row.num_empenho || null;
  const podeVincularEmpenho = !!(empenhoBaseParaVinculo && (row.detalhar_no_pagamento == true || Number(row.detalhar_no_pagamento) === 1));

  async function save(g: number | '', s: number | '') {
    setSaving(true);
    setSaved(false);
    const subs = subgrupos.filter((sb) => sb.fk_grupo === Number(g));
    try {
      await fetch(`${API_URL}/api/pagamentos/${row.id}/classificar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fk_grupo_pag: g || null, fk_subgrupo_pag: s || null }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      const grupoNome = grupos.find((gr) => gr.id === Number(g))?.nome ?? null;
      const subgrupoNome = subs.find((sb) => sb.id === Number(s))?.nome ?? null;
      onClassificado(row.id, grupoNome, subgrupoNome, g ? Number(g) : null, s ? Number(s) : null);
    } catch { /* API offline */ }
    setSaving(false);
  }

  function handleGrupo(val: number | '') {
    setFkGrupo(val);
    setFkSubgrupo('');
    save(val, '');
  }

  function handleSubgrupo(val: number | '') {
    setFkSubgrupo(val);
    save(fkGrupo, val);
  }

  function handleLimparOverride() {
    setFkGrupo('');
    setFkSubgrupo('');
    save('', '');
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-slate-50 to-white rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText size={16} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm tracking-tight">{row.credor_nome}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDate(row.data_pagamento)} · Emp. {row.num_empenho}
                {row.num_processo && <> · Proc. <span className="font-mono">{row.num_processo}</span></>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        {/* Corpo: duas colunas */}
        <div className="flex divide-x divide-gray-100">

          {/* Coluna esquerda — Histórico + Classificação Orçamentária */}
          <div className="flex-1 min-w-0 flex flex-col divide-y divide-gray-100">
            <div className="px-5 py-4">
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <ScrollText size={13} className="text-blue-500" />
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Histórico da Despesa</p>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {row.historico || <span className="text-gray-400 italic">Sem histórico registrado</span>}
              </p>
            </div>
            <div className="px-5 py-3 bg-slate-50 flex-1">
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <LayoutGrid size={13} className="text-indigo-500" />
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Classificação Orçamentária</p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                {row.data_liquidacao && (
                  <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">Data Liquidação</p>
                  <p className="text-xs font-mono font-medium text-gray-700">{formatDate(row.data_liquidacao)}</p></div>
                )}
                {row.unidade_orcamentaria && (
                  <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">Unid. Orçamentária</p>
                  <p className="text-xs font-mono font-medium text-gray-700">{row.unidade_orcamentaria}</p></div>
                )}
                {row.acao && (
                  <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">Ação</p>
                  <p className="text-xs font-mono font-medium text-gray-700">{row.acao}</p></div>
                )}
                {row.elemento_despesa && (
                  <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">Elemento de Despesa</p>
                  <p className="text-xs font-mono font-medium text-gray-700">{row.elemento_despesa}</p></div>
                )}
                {row.fonte_recurso && (
                  <div><p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Fonte de Recurso</p>
                  <FonteBadge codigo={row.fonte_recurso} /></div>
                )}
                {(row as any).sub_elemento && (
                  <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">Sub-elemento</p>
                  <p className="text-xs font-mono font-medium text-gray-700">{(row as any).sub_elemento}</p></div>
                )}
                {(row as any).periodo_inicio && (
                  <div className="col-span-2"><p className="text-[10px] text-gray-400 uppercase tracking-wider">Período</p>
                  <p className="text-xs font-mono font-medium text-gray-700">
                    {formatDate((row as any).periodo_inicio)} → {formatDate((row as any).periodo_fim)}
                  </p></div>
                )}
              </div>
            </div>
          </div>

          {/* Coluna direita — Valores + Reclassificação */}
          <div className="w-64 shrink-0 flex flex-col divide-y divide-gray-100">

            {/* Valores */}
            <div className="px-5 py-4 bg-slate-50">
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <BarChart2 size={13} className="text-emerald-500" />
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Valores</p>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-400">Valor Bruto</span>
                  <span className="text-sm font-bold text-gray-800">{formatCurrency(row.valor_bruto)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-400">Desconto / Retido</span>
                  <span className="text-sm font-semibold text-red-500">− {formatCurrency(row.valor_retido)}</span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-500 font-medium">Valor Líquido</span>
                  <span className="text-base font-bold text-emerald-700">{formatCurrency(row.valor_liquido)}</span>
                </div>
                {row.valor_pessoal > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-gray-400">Valor Pessoal</span>
                    <span className="text-sm font-semibold text-gray-600">{formatCurrency(row.valor_pessoal)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dados do empenho */}
            <div className="px-5 py-3">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <Receipt size={13} className="text-amber-500" />
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Empenho</p>
              </div>
              <div className="space-y-2">
                {row.data_empenho && (
                  <div className="flex justify-between">
                    <span className="text-[10px] text-gray-400 uppercase">Data Emp.</span>
                    <span className="text-xs font-mono font-medium text-gray-600">{formatDate(row.data_empenho)}</span>
                  </div>
                )}
                {row.tipo_empenho && (
                  <div className="flex justify-between">
                    <span className="text-[10px] text-gray-400 uppercase">Tipo</span>
                    <span className="text-xs font-mono font-medium text-gray-600">{row.tipo_empenho}</span>
                  </div>
                )}
                {row.reduzido && (
                  <div className="flex justify-between">
                    <span className="text-[10px] text-gray-400 uppercase">Reduzido</span>
                    <span className="text-xs font-mono font-medium text-gray-600">{row.reduzido}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Reclassificação */}
            <div className="px-5 py-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center justify-center gap-1.5 w-full">
                  <BookMarked size={13} className="text-violet-500" />
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Reclassificação</p>
                </div>
                {temOverride && (
                  <button onClick={handleLimparOverride} className="text-xs text-red-400 hover:text-red-600 transition-colors">Limpar</button>
                )}
              </div>
              {(row.grupo_nome || row.subgrupo_nome) && (
                <div className="mb-2.5 flex flex-wrap gap-1">
                  {row.grupo_nome && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">{row.grupo_nome}</span>}
                  {row.subgrupo_nome && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">{row.subgrupo_nome}</span>}
                </div>
              )}
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Grupo</label>
                  <select value={fkGrupo} onChange={(e) => handleGrupo(e.target.value ? Number(e.target.value) : '')}
                    className="w-full text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">— sem grupo —</option>
                    {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Subgrupo</label>
                  <select value={fkSubgrupo} onChange={(e) => handleSubgrupo(e.target.value ? Number(e.target.value) : '')}
                    disabled={!fkGrupo || subsFiltrados.length === 0}
                    className="w-full text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-40">
                    <option value="">— sem subgrupo —</option>
                    {subsFiltrados.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
                {podeVincularEmpenho && (
                  <button
                    onClick={() => setShowRegraEmpenho(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 transition-colors text-left mt-1"
                  >
                    <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
                      <Link2 size={13} className="text-violet-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-violet-800">
                        Vincular empenho <span className="font-mono bg-violet-100 px-1 rounded">{empenhoBaseParaVinculo}</span> a este grupo/subgrupo
                      </p>
                      <p className="text-[10px] text-violet-500 mt-0.5">Próximos pagamentos serão classificados automaticamente.</p>
                    </div>
                  </button>
                )}
              </div>
              {(saving || saved) && (
                <div className={`mt-2 flex items-center gap-1.5 text-xs ${saved ? 'text-emerald-600' : 'text-blue-500'}`}>
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  {saving ? 'Salvando...' : 'Salvo!'}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {showRegraEmpenho && (
        <RegraEmpenhoModal
          row={row}
          grupos={grupos}
          subgrupos={subgrupos}
          token={token}
          onClose={() => setShowRegraEmpenho(false)}
          onSaved={() => setShowRegraEmpenho(false)}
        />
      )}
    </div>
  );
}

// ─── Sortable header ─────────────────────────────────────────────────────────

function SortTh({
  label, col, sortBy, sortDir, onSort, align = 'center', className = '',
}: {
  label: string; col: string; sortBy: string; sortDir: string;
  onSort: (col: string) => void; align?: 'left' | 'center' | 'right'; className?: string;
}) {
  const active = sortBy === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={cn(
        'px-3 py-3 text-xs font-semibold whitespace-nowrap cursor-pointer select-none transition-colors hover:text-blue-600',
        active ? 'text-blue-600' : 'text-gray-500',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <ChevronDown size={10} className="opacity-30" />
        )}
      </span>
    </th>
  );
}

// ─── Rateio Modal ─────────────────────────────────────────────────────────────

interface RateioItemLocal {
  fk_grupo: number | '';
  fk_subgrupo: number | '';
  grupo_nome?: string;
  subgrupo_nome?: string;
  valor: string;
  valorDisplay?: string;
  autoFilled?: boolean;
}

function RateioModal({
  pagamento, grupos, subgrupos, token, onClose, onSaved,
}: {
  pagamento: OrdemPagamento;
  grupos: Grupo[];
  subgrupos: Subgrupo[];
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [itens, setItens] = useState<RateioItemLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // DEA/RP: grupo travado
  const tipoRelatorio = (pagamento as any).tipo_relatorio as string;
  const isDeaOuRp = tipoRelatorio === 'DEA' || tipoRelatorio === 'RP';
  const grupoTravado = isDeaOuRp
    ? grupos.find(g =>
        tipoRelatorio === 'DEA'
          ? g.nome.toUpperCase().includes('EXERC') && g.nome.toUpperCase().includes('ANTERIOR')
          : g.nome.toUpperCase().includes('RESTOS A PAGAR')
      ) ?? null
    : null;
  // Subgrupos normais (sem prefixo DEA/RP) para exibir no select quando DEA/RP
  const subgruposNormais = isDeaOuRp
    ? subgrupos.filter(s => !s.nome.startsWith('DEA - ') && !s.nome.startsWith('RP - '))
    : subgrupos;

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    const credorId = (pagamento as any).fk_credor;
    const empenhoBase = (pagamento as any).num_empenho_base || pagamento.num_empenho;
    const setorId = (pagamento as any).fk_setor_pag;

    // Carrega rateio existente e template em paralelo
    Promise.all([
      fetch(`${API_URL}/api/pagamentos/${pagamento.id}/rateio`, { headers }).then(r => r.ok ? r.json() : []),
      credorId && empenhoBase
        ? fetch(`${API_URL}/api/pagamentos/rateio-template?credorId=${credorId}&empenhoBase=${encodeURIComponent(empenhoBase)}&setorId=${setorId || ''}`, { headers }).then(r => r.ok ? r.json() : [])
        : Promise.resolve([]),
    ]).then(([rateioData, templateData]) => {
      if (rateioData.length > 0) {
        // Tem rateio salvo — carrega com valores
        setItens(rateioData.map((d: any) => ({
          fk_grupo: d.fk_grupo ?? '',
          fk_subgrupo: d.fk_subgrupo ?? '',
          valor: String(d.valor),
          valorDisplay: Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        })));
      } else {
        // Sem rateio salvo — começa com apenas uma linha vazia
        setItens([{ 
          fk_grupo: grupoTravado ? grupoTravado.id : '',
          fk_subgrupo: '',
          valor: '',
          valorDisplay: '',
          autoFilled: false,
        }]);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addItem() {
    setItens((prev) => [...prev, {
      fk_grupo: grupoTravado ? grupoTravado.id : '',
      fk_subgrupo: '',
      valor: '',
      valorDisplay: '',
      autoFilled: false,
    }]);
  }

  function removeItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof RateioItemLocal, value: string | number | '') {
    setItens((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === 'fk_grupo') { updated.fk_subgrupo = ''; updated.subgrupo_nome = ''; }
      return updated;
    }));
  }

  // Filtra itens pela busca (grupo ou subgrupo)
  const itensFiltrados = search.trim()
    ? itens.map((item, idx) => ({ item, idx })).filter(({ item }) => {
        const grupoNome = grupos.find(g => g.id === Number(item.fk_grupo))?.nome ?? item.grupo_nome ?? '';
        const subNome = subgrupos.find(s => s.id === Number(item.fk_subgrupo))?.nome ?? item.subgrupo_nome ?? '';
        const q = search.toLowerCase();
        return grupoNome.toLowerCase().includes(q) || subNome.toLowerCase().includes(q);
      })
    : itens.map((item, idx) => ({ item, idx }));

  // Detecta se há qualquer combinação grupo+subgrupo duplicada na lista
  const temDuplicados = itens.some((item, idx) =>
    item.fk_grupo !== '' && item.fk_subgrupo !== '' && itens.some((other, otherIdx) =>
      otherIdx !== idx &&
      other.fk_grupo === item.fk_grupo &&
      other.fk_subgrupo === item.fk_subgrupo &&
      other.fk_subgrupo !== '',
    ),
  );

  // Soma apenas itens com valor
  const soma = itens.reduce((acc, item) => acc + (parseFloat(item.valor) || 0), 0);
  const total = Number(pagamento.valor_bruto);
  const restante = total - soma;
  const ok = Math.abs(restante) < 0.01;

  async function handleSave() {
    const itensComValor = itens.filter(i => parseFloat(i.valor) > 0);
    if (itensComValor.length > 0 && !ok) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/pagamentos/${pagamento.id}/rateio`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: itens.map((item) => ({
            fk_grupo: item.fk_grupo || null,
            fk_subgrupo: item.fk_subgrupo || null,
            valor: parseFloat(item.valor) || 0,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erro ao salvar');
        setSaving(false);
        return;
      }
      setSaving(false);
      setSalvo(true);
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1800);
    } catch {
      setError('Erro ao salvar rateio');
      setSaving(false);
    }
  }

  function formatCurrencyInput(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    const num = parseInt(digits, 10) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatCurrencyValue(value: number): string {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parseCurrencyInput(formatted: string): string {
    const clean = formatted.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? '0' : String(num);
  }

  function handleValorChange(idx: number, raw: string) {
    const formatted = formatCurrencyInput(raw);
    const numeric = parseCurrencyInput(formatted);

    setItens((prev) => {
      const updated = prev.map((item, i) => i === idx
        ? { ...item, valor: numeric, valorDisplay: formatted, autoFilled: false }
        : item
      );

      if (!formatted.trim()) {
        return updated.map((item, i) => i > idx && item.autoFilled
          ? { ...item, valor: '', valorDisplay: '', autoFilled: false }
          : item
        );
      }

      const laterManual = updated.slice(idx + 1).some((item) => item.valorDisplay?.trim() && !item.autoFilled);
      if (laterManual) return updated;

      const nextAutoIndex = updated.findIndex((item, i) => i > idx && (!item.valorDisplay?.trim() || item.autoFilled));
      const sumBeforeNext = updated.slice(0, nextAutoIndex === -1 ? updated.length : nextAutoIndex)
        .reduce((acc, item) => acc + (parseFloat(item.valor) || 0), 0);
      const remainder = total - sumBeforeNext;

      if (nextAutoIndex === -1) {
        if (remainder > 0) {
          return [
            ...updated,
            {
              fk_grupo: grupoTravado ? grupoTravado.id : '',
              fk_subgrupo: '',
              valor: String(remainder),
              valorDisplay: formatCurrencyValue(remainder),
              autoFilled: true,
            },
          ];
        }
        return updated;
      }

      if (remainder < 0) return updated;

      updated[nextAutoIndex] = {
        ...updated[nextAutoIndex],
        valor: String(remainder),
        valorDisplay: formatCurrencyValue(remainder),
        autoFilled: true,
      };

      return updated;
    });
  }

  return (
    <>
    {salvo && typeof window !== 'undefined' && createPortal(
      <>
      <style>{`@keyframes slideInRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div style={{
        position: 'fixed', bottom: '28px', right: '28px', zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: '10px',
        background: '#f0fdf4', border: '1.5px solid #86efac',
        borderRadius: '12px', padding: '12px 18px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        animation: 'slideInRight 0.25s ease',
      }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Check size={15} color="#fff" strokeWidth={3} />
        </div>
        <div>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#15803d', margin: 0 }}>Rateio salvo com sucesso!</p>
          <p style={{ fontSize: '11px', color: '#4ade80', margin: 0 }}>Os grupos foram registrados e o template atualizado.</p>
        </div>
      </div>
      </>,
      document.body,
    )}
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
              <SplitSquareHorizontal size={16} className="text-violet-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Rateio de Pagamento</h2>
              <p className="text-xs text-gray-400 mt-1">
                {pagamento.credor_nome} · Emp. {pagamento.num_empenho} · Vlr. Bruto: <span className="font-semibold text-gray-600">R$ {fmt(total)}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {/* Barra de busca */}
        {!loading && itens.length > 3 && (
          <div className="px-6 pt-4 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por grupo ou subgrupo..."
                className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50"
              />
            </div>
          </div>
        )}

        {/* Body */}
        {/* Tabela de itens */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={24} className="animate-spin mr-2" /> Carregando...
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 w-8">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Grupo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Subgrupo</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 w-44">Valor (R$)</th>
                  <th className="px-2 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {itensFiltrados.length === 0 && search && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">Nenhum item para &quot;{search}&quot;</td></tr>
                )}
                {itensFiltrados.map(({ item, idx }) => {
                  // DEA/RP: mostra subgrupos normais (sem prefixo); backend cria o prefixado ao salvar
                  const subsFiltrados = isDeaOuRp
                    ? subgruposNormais
                    : subgrupos.filter((s) => s.fk_grupo === Number(item.fk_grupo));
                  const temValor = parseFloat(item.valor) > 0;
                  // Detecta combinação duplicada (mesmo grupo+subgrupo em outro item)
                  const isDuplicado = item.fk_grupo !== '' && itens.some((other, otherIdx) =>
                    otherIdx !== idx &&
                    other.fk_grupo === item.fk_grupo &&
                    other.fk_subgrupo === item.fk_subgrupo,
                  );
                  return (
                    <tr key={idx} className={isDuplicado ? 'bg-red-50' : temValor ? 'bg-violet-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-2 text-xs font-medium">
                        {isDuplicado
                          ? <span className="text-red-500 font-bold" title="Combinação duplicada">!</span>
                          : <span className="text-gray-400">{idx + 1}</span>}
                      </td>
                      <td className="px-2 py-2">
                        {isDeaOuRp && grupoTravado ? (
                          <div className="text-xs font-semibold px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-center gap-1">
                            <span>🔒</span> {grupoTravado.nome}
                          </div>
                        ) : (
                          <SearchSelect
                            value={item.fk_grupo}
                            onChange={(v) => updateItem(idx, 'fk_grupo', v === '' ? '' : Number(v))}
                            options={grupos}
                            placeholder="— sem grupo —"
                          />
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div>
                          <SearchSelect
                            value={item.fk_subgrupo}
                            onChange={(v) => updateItem(idx, 'fk_subgrupo', v === '' ? '' : Number(v))}
                            options={subsFiltrados}
                            placeholder="— sem subgrupo —"
                            disabled={!item.fk_grupo || subsFiltrados.length === 0}
                          />
                          {isDuplicado && (
                            <p className="text-[10px] text-red-500 mt-0.5 px-1">Combinação já existe</p>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                          {(() => {
                            // Calcular restante até este item (soma dos anteriores)
                            const somaAnterior = itensFiltrados.slice(0, itensFiltrados.findIndex(x => x.idx === idx))
                              .reduce((acc, x) => acc + (parseFloat(x.item.valor) || 0), 0);
                            const sugestaoRestante = total - somaAnterior;
                            const placeholderSugestao = sugestaoRestante > 0
                              ? fmt(sugestaoRestante)
                              : '0,00';
                            return (
                              <input
                                type="text"
                                inputMode="numeric"
                                value={item.valorDisplay ?? ''}
                                onChange={(e) => handleValorChange(idx, e.target.value)}
                                placeholder={placeholderSugestao}
                                className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-2 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-violet-400 font-medium bg-white"
                              />
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => removeItem(idx)}
                          className="p-1 rounded hover:bg-red-100 hover:text-red-500 text-gray-300 transition-colors"
                          title="Remover"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="px-4 py-2">
                    <button
                      onClick={addItem}
                      className="flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-800 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus size={14} /> Adicionar item
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 shrink-0 space-y-3 bg-gray-50">
          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-200">{error}</p>}
          <div className={`flex items-center justify-between text-sm font-medium rounded-lg px-4 py-3 ${ok && soma > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : soma > total ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
            <span>Total: <strong>R$ {fmt(total)}</strong></span>
            <span>
              {ok && soma > 0
                ? <span className="flex items-center gap-1 font-semibold"><Check size={14} /> Totalmente alocado</span>
                : soma === 0
                  ? <span className="text-blue-500">Nenhum valor alocado ainda</span>
                  : <span>Alocado: <strong>R$ {fmt(soma)}</strong> · Restante: <strong className={restante < 0 ? 'text-red-600' : ''}>R$ {fmt(Math.abs(restante))}</strong>{restante < 0 ? ' ⚠ excede' : ''}</span>}
            </span>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (itens.some(i => parseFloat(i.valor) > 0) && !ok) || temDuplicados}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              title={temDuplicados ? 'Remova os itens duplicados antes de salvar' : undefined}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Salvar Rateio
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// ─── EMPTY_FILTERS ───────────────────────────────────────────────────────────

const MESES = [
  { id: '01', nome: 'Janeiro' },
  { id: '02', nome: 'Fevereiro' },
  { id: '03', nome: 'Março' },
  { id: '04', nome: 'Abril' },
  { id: '05', nome: 'Maio' },
  { id: '06', nome: 'Junho' },
  { id: '07', nome: 'Julho' },
  { id: '08', nome: 'Agosto' },
  { id: '09', nome: 'Setembro' },
  { id: '10', nome: 'Outubro' },
  { id: '11', nome: 'Novembro' },
  { id: '12', nome: 'Dezembro' },
];

const EMPTY_FILTERS = {
  tipoRelatorio: '',
  mes: '',
  ano: '',
  numEmpenho: '',
  numProcesso: '',
  credorSearch: '',
  grupoId: '',
  subgrupoId: '',
  setorId: '',
  valorBruto: '',
  semSetor: '',
  semGrupo: '',
  semSubgrupo: '',
};

// ─── Main page ───────────────────────────────────────────────────────────────

export default function PagamentosPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string;

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [autoClassificando, setAutoClassificando] = useState(false);
  const [autoClassifResult, setAutoClassifResult] = useState<{ atualizados: number; sem_match: number } | null>(null);
  const [classificandoDiarias, setClassificandoDiarias] = useState(false);
  const [diariasResult, setDiariasResult] = useState<number | null>(null);
  const [rows, setRows] = useState<OrdemPagamento[]>([]);
  const [modalRow, setModalRow] = useState<OrdemPagamento | null>(null);
  const [rateioRow, setRateioRow] = useState<OrdemPagamento | null>(null);
  const [sortBy, setSortBy] = useState('data_pagamento');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  }

  const refreshStats = useCallback(() => {
    if (!token) return;
    fetch(`${API_URL}/api/pagamentos/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok && r.json()).then(d => d && setStats(d));
  }, [token]);

  function handleClassificacaoSaved(id: number, grupoNome: string | null, subgrupoNome: string | null, fkGrupo: number | null, fkSubgrupo: number | null) {
    setRows((prev) => prev.map((r) =>
      r.id === id ? { ...r, grupo_pag_nome: grupoNome, subgrupo_pag_nome: subgrupoNome, fk_grupo_pag: fkGrupo, fk_subgrupo_pag: fkSubgrupo } : r,
    ));
    refreshStats();
  }

  function handleSetorSaved(id: number, fkSetor: number | null, setorNome: string | null) {
    setRows((prev) => prev.map((r) =>
      r.id === id ? { ...r, fk_setor_pag: fkSetor, setor_nome: setorNome } : r,
    ));
    refreshStats();
  }

  function handleRateioSaved() {
    setRateioRow(null);
    load();
  }

  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [subgrupos, setSubgrupos] = useState<Subgrupo[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [stats, setStats] = useState<{ totalProcessos: number; valorTotal: number; semSetor: number; semGrupo: number; semSubgrupo: number } | null>(null);

  const subgruposFiltrados = filters.grupoId
    ? subgrupos.filter((s) => s.fk_grupo === Number(filters.grupoId))
    : subgrupos;

  const activeFilters = Object.values(filters).filter(Boolean).length;

  function setFilter(key: keyof typeof EMPTY_FILTERS, value: string) {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'grupoId') next.subgrupoId = '';
      return next;
    });
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const filterParams: Record<string, string> = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (!v) return;
      if (k === 'mes' || k === 'ano') return; // tratados abaixo
      if (k === 'valorBruto') { filterParams['valorBrutoMin'] = v; filterParams['valorBrutoMax'] = v; return; }
      filterParams[k] = v;
    });
    // Converter mes+ano em dataInicio/dataFim
    if (filters.mes && filters.ano) {
      const lastDay = new Date(Number(filters.ano), Number(filters.mes), 0).getDate();
      filterParams['dataInicio'] = `${filters.ano}-${filters.mes}-01`;
      filterParams['dataFim'] = `${filters.ano}-${filters.mes}-${lastDay}`;
    } else if (filters.ano) {
      filterParams['dataInicio'] = `${filters.ano}-01-01`;
      filterParams['dataFim'] = `${filters.ano}-12-31`;
    } else if (filters.mes) {
      const ano = new Date().getFullYear();
      const lastDay = new Date(ano, Number(filters.mes), 0).getDate();
      filterParams['dataInicio'] = `${ano}-${filters.mes}-01`;
      filterParams['dataFim'] = `${ano}-${filters.mes}-${lastDay}`;
    }
    const params: Record<string, string | number> = { page, limit, sortBy, sortDir, ...filterParams };
    try {
      const [data, statsData] = await Promise.all([
        apiRequest('/pagamentos', { token, params }),
        fetch(`${API_URL}/api/pagamentos/stats?${new URLSearchParams(filterParams)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.ok ? r.json() : null),
      ]);
      setRows((data as PagamentosResponse).rows);
      setTotal((data as PagamentosResponse).total);
      if (statsData) setStats(statsData);
    } catch {
      /* API offline */
    } finally {
      setLoading(false);
    }
  }, [token, page, limit, filters, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };
    fetch(`${API_URL}/api/credores/grupos`, { headers: h })
      .then(r => r.ok && r.json())
      .then(d => d && setGrupos(d))
      .catch(() => console.error('Erro ao carregar grupos'));
    fetch(`${API_URL}/api/credores/subgrupos`, { headers: h })
      .then(r => r.ok && r.json())
      .then(d => d && setSubgrupos(d))
      .catch(() => console.error('Erro ao carregar subgrupos'));
    fetch(`${API_URL}/api/setores`, { headers: h })
      .then(r => r.ok && r.json())
      .then(d => {
        if (d?.rows) setSetores(d.rows);
        else if (Array.isArray(d)) setSetores(d);
      })
      .catch(() => console.error('Erro ao carregar setores'));
  }, [token]);

  const totalPages = Math.ceil(total / limit);

  const handleExport = () => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    ).toString();
    const a = document.createElement('a');
    a.href = `${API_URL}/api/pagamentos/export?${qs}`;
    a.setAttribute('download', 'processos_pagos.xlsx');
    a.click();
  };

  async function handleAutoClassificarDiarias() {
    setClassificandoDiarias(true);
    setDiariasResult(null);
    try {
      const res = await fetch(`${API_URL}/api/pagamentos/auto-classificar-diarias`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDiariasResult(data.updated);
      load();
    } catch { /* API offline */ }
    setClassificandoDiarias(false);
  }

  async function handleAutoClassificar() {
    if (!confirm('Isso vai classificar automaticamente todos os pagamentos sem setor usando palavras-chave dos setores cadastrados.\n\nContinuar?')) return;
    setAutoClassificando(true);
    setAutoClassifResult(null);
    try {
      const res = await fetch(`${API_URL}/api/pagamentos/auto-classificar-setores`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAutoClassifResult({ atualizados: data.atualizados, sem_match: data.sem_match });
      load(); // recarrega a tabela
    } catch { /* API offline */ }
    setAutoClassificando(false);
  }

  const COL_SPAN = 11;

  return (
    <div>
      <TopBar
        title="Processos Pagos"
        subtitle={`${total} registros encontrados`}
      />
      <div className="p-4 space-y-4">

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
              showFilters ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
            )}
          >
            <SlidersHorizontal size={15} />
            Filtros
            {activeFilters > 0 && (
              <span className="ml-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFilters}</span>
            )}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-600 border border-gray-200 hover:border-gray-300 transition-all"
          >
            <Download size={15} />
            Exportar XLSX
          </button>
          <button
            onClick={handleAutoClassificar}
            disabled={autoClassificando}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
              autoClassificando
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300',
            )}
            title="Classifica automaticamente os pagamentos sem setor usando palavras-chave dos setores cadastrados"
          >
            {autoClassificando
              ? <><Loader2 size={15} className="animate-spin" /> Classificando...</>
              : <><Building2 size={15} /> Auto-classificar Setores</>}
          </button>
          {autoClassifResult && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              <Check size={12} />
              {autoClassifResult.atualizados} classificados · {autoClassifResult.sem_match} sem match
              <button onClick={() => setAutoClassifResult(null)} className="ml-1 text-emerald-400 hover:text-emerald-700">
                <X size={11} />
              </button>
            </span>
          )}
          <button
            onClick={handleAutoClassificarDiarias}
            disabled={classificandoDiarias}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
              classificandoDiarias
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50 hover:border-amber-300',
            )}
            title="Classifica automaticamente pagamentos com elemento 3.3.90.14 como Despesa com Diárias"
          >
            {classificandoDiarias
              ? <><Loader2 size={15} className="animate-spin" /> Classificando...</>
              : <><BarChart2 size={15} /> Auto-classificar Diárias</>}
          </button>
          {diariasResult !== null && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
              <Check size={12} />
              {diariasResult} pagamento(s) classificado(s)
              <button onClick={() => setDiariasResult(null)} className="ml-1 text-amber-400 hover:text-amber-700">
                <X size={11} />
              </button>
            </span>
          )}
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors">
              <X size={13} /> Limpar filtros
            </button>
          )}
        </div>

        {/* Cards de resumo */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <Hash size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Total Processos</p>
                <p className="text-lg font-bold text-gray-800">{stats.totalProcessos.toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <DollarSign size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Valor Total</p>
                <p className="text-lg font-bold text-gray-800">{formatCurrency(stats.valorTotal)}</p>
              </div>
            </div>
            <button
              onClick={() => { setFilters({ ...EMPTY_FILTERS, semSetor: filters.semSetor === '1' ? '' : '1' }); setPage(1); }}
              className={cn('rounded-2xl border shadow-sm p-4 flex items-center gap-3 text-left transition-all', filters.semSetor === '1' ? 'bg-red-50 border-red-300 ring-2 ring-red-200' : 'bg-white border-gray-100 hover:border-red-200 hover:bg-red-50')}
            >
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <Building2 size={18} className="text-red-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Setor s/ Class.</p>
                <p className="text-lg font-bold text-gray-800">{stats.semSetor.toLocaleString('pt-BR')}</p>
              </div>
            </button>
            <button
              onClick={() => { setFilters({ ...EMPTY_FILTERS, semGrupo: filters.semGrupo === '1' ? '' : '1' }); setPage(1); }}
              className={cn('rounded-2xl border shadow-sm p-4 flex items-center gap-3 text-left transition-all', filters.semGrupo === '1' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200' : 'bg-white border-gray-100 hover:border-amber-200 hover:bg-amber-50')}
            >
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <Layers size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Grupo s/ Class.</p>
                <p className="text-lg font-bold text-gray-800">{stats.semGrupo.toLocaleString('pt-BR')}</p>
              </div>
            </button>
            <button
              onClick={() => { setFilters({ ...EMPTY_FILTERS, semSubgrupo: filters.semSubgrupo === '1' ? '' : '1' }); setPage(1); }}
              className={cn('rounded-2xl border shadow-sm p-4 flex items-center gap-3 text-left transition-all', filters.semSubgrupo === '1' ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-200' : 'bg-white border-gray-100 hover:border-purple-200 hover:bg-purple-50')}
            >
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
                <Tag size={18} className="text-purple-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Subgrupo s/ Class.</p>
                <p className="text-lg font-bold text-gray-800">{stats.semSubgrupo.toLocaleString('pt-BR')}</p>
              </div>
            </button>
          </div>
        )}

        {/* Filtros */}
        {showFilters && (
          <div className="bg-blue-50/50 rounded-2xl border border-blue-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal size={14} className="text-blue-500" />
              <span className="text-sm font-semibold text-blue-700">Filtros Ativos</span>
              {Object.values(filters).some(v => v !== '') && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">
                  {Object.values(filters).filter(v => v !== '').length}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4">

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <SearchSelect
                  value={filters.tipoRelatorio}
                  onChange={(v) => setFilter('tipoRelatorio', String(v))}
                  options={[
                    { id: 'OR', nome: 'OR — Orçamentário' },
                    { id: 'RP', nome: 'RP — Restos a Pagar' },
                    { id: 'DEA', nome: 'DEA — Exercício Anterior' },
                  ]}
                  placeholder="Todos"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Mês</label>
                <SearchSelect
                  value={filters.mes}
                  onChange={(v) => setFilter('mes', String(v))}
                  options={MESES}
                  placeholder="Todos os meses"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Ano</label>
                <SearchSelect
                  value={filters.ano}
                  onChange={(v) => setFilter('ano', String(v))}
                  options={[2023, 2024, 2025, 2026].map((y) => ({ id: String(y), nome: String(y) }))}
                  placeholder="Todos os anos"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nº Empenho</label>
                <input type="text" value={filters.numEmpenho} onChange={(e) => setFilter('numEmpenho', e.target.value)}
                  placeholder="Ex: 288"
                  className="w-full text-sm px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Credor</label>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={filters.credorSearch} onChange={(e) => setFilter('credorSearch', e.target.value)}
                    placeholder="Nome ou CNPJ..."
                    className="w-full text-sm pl-7 pr-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Grupo</label>
                <SearchSelect
                  value={filters.grupoId}
                  onChange={(v) => setFilter('grupoId', String(v))}
                  options={grupos}
                  placeholder="Todos"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Subgrupo</label>
                <SearchSelect
                  value={filters.subgrupoId}
                  onChange={(v) => setFilter('subgrupoId', String(v))}
                  options={subgruposFiltrados}
                  placeholder="Todos"
                  disabled={!filters.grupoId}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Setor</label>
                <SearchSelect
                  value={filters.setorId}
                  onChange={(v) => setFilter('setorId', String(v))}
                  options={setores.map((s) => ({ id: s.id, nome: s.descricao }))}
                  placeholder="Todos"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Valor (R$)</label>
                <input type="number" min="0" step="0.01" value={filters.valorBruto} onChange={(e) => setFilter('valorBruto', e.target.value)}
                  placeholder="Ex: 1500.00"
                  className="w-full text-sm px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>

            </div>
          </div>
        )}

        {/* Tabela */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e8edf5', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', fontSize: '12px', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
              <colgroup>
                <col style={{ width: '52px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '60px' }} />
                <col style={{ width: '145px' }} />
                <col style={{ width: '44px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '155px' }} />
                <col style={{ width: '155px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '108px' }} />
                <col style={{ width: '44px' }} />
              </colgroup>
              <thead>
                <tr style={{ background: '#f4f6fb', borderBottom: '2px solid #e2e8f4' }}>
                  <SortTh label="Tipo" col="tipo_relatorio" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Data Pag." col="data_pagamento" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Emp." col="num_empenho" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Credor" col="credor" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Histórico" col="historico" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Setor" col="setor" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <th style={{ padding: '11px 14px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', borderRight: '1px solid #e8edf5' }}>Grupo</th>
                  <th style={{ padding: '11px 14px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', borderRight: '1px solid #e8edf5' }}>Subgrupo</th>
                  <th style={{ padding: '11px 14px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', borderRight: '1px solid #e8edf5' }}>Fonte</th>
                  <SortTh label="Vlr. Bruto" col="valor_bruto" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="center" />
                  <th style={{ padding: '11px 8px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em' }}>R</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={COL_SPAN} style={{ textAlign: 'center', padding: '64px 0', color: '#94a3b8' }}>
                      <Search size={28} className="mx-auto mb-3 opacity-30 animate-pulse" />
                      Buscando registros...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={COL_SPAN} style={{ textAlign: 'center', padding: '64px 0', color: '#94a3b8', fontSize: '12px' }}>Nenhum registro encontrado.</td>
                  </tr>
                ) : rows.map((r, i) => {
                  const detalhar = !!r.detalhar_no_pagamento;
                  const temOverride = !!r.fk_grupo_pag;
                  const temRegra = !!(r as any).regra_empenho_id && !temOverride;
                  const temRateio = !!(r as any).has_rateio && !temOverride && !temRegra;
                  const grupoExibido = r.grupo_pag_nome ?? (r as any).grupo_regra_nome ?? r.grupo_nome;
                  const subgrupoExibido = r.subgrupo_pag_nome ?? (r as any).subgrupo_regra_nome ?? r.subgrupo_nome;
                  const rowBg = detalhar ? 'rgba(238,242,255,0.5)' : '#fff';
                  const rowBgHover = detalhar ? '#eef2ff' : '#f8faff';
                  return (
                    <tr key={r.id ?? i}
                      style={{ borderBottom: '1px solid #f0f4fb', background: rowBg, transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = rowBgHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                    >
                      {/* Tipo */}
                      <td style={{ padding: '9px 8px', textAlign: 'center', borderRight: '1px solid #f0f4fb' }}>
                        <TipoBadge tipo={r.tipo_relatorio} />
                      </td>
                      {/* Data Pag. */}
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap', color: '#334155', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid #f0f4fb', textAlign: 'center' }}>
                        {formatDate(r.data_pagamento)}
                      </td>
                      {/* Nº Empenho */}
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap', fontFamily: 'ui-monospace, monospace', color: '#475569', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid #f0f4fb', textAlign: 'center' }}>
                        {r.num_empenho}
                      </td>
                      {/* Credor */}
                      <td style={{ padding: '9px 14px', borderRight: '1px solid #f0f4fb' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                          {detalhar && <Layers size={10} style={{ color: '#818cf8', flexShrink: 0, marginTop: '2px' }} aria-label="Classificação por pagamento" />}
                          <span style={{ fontWeight: 500, color: '#0f172a', lineHeight: 1.35 }}>{r.credor_nome}</span>
                        </div>
                      </td>
                      {/* Histórico */}
                      <td style={{ padding: '9px 14px', textAlign: 'center', borderRight: '1px solid #f0f4fb' }}>
                        <button onClick={() => setModalRow(r)} title={r.historico || 'Ver detalhes'}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '7px', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'all 0.12s', padding: 0 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#eff6ff'; (e.currentTarget as HTMLButtonElement).style.color = '#3b82f6'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                        >
                          <FileText size={14} />
                        </button>
                      </td>
                      {/* Setor */}
                      <SetorCell row={r} setores={setores} token={token} onSaved={handleSetorSaved} />
                      {/* Grupo / Subgrupo */}
                      {detalhar ? (
                        <ClassificacaoCell row={r} grupos={grupos} subgrupos={subgrupos} token={token} onSaved={handleClassificacaoSaved} />
                      ) : (
                        <>
                          <td style={{ padding: '8px 14px', borderRight: '1px solid #f0f4fb', width: '155px', textAlign: 'center' }}>
                            {temRateio ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 600,
                                background: '#fdf4ff', color: '#7e22ce', border: '1px solid #e9d5ff',
                              }}>
                                <SplitSquareHorizontal size={10} />
                                Rateado
                              </span>
                            ) : grupoExibido ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                {temOverride && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} title="Reclassificado manualmente" />}
                                {temRegra && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8b5cf6', flexShrink: 0 }} title="Classificado por regra de empenho" />}
                                <span style={{
                                  display: 'inline-block', padding: '2px 7px', borderRadius: '5px',
                                  fontWeight: 500, lineHeight: 1.5, wordBreak: 'break-word',
                                  background: temOverride ? '#dbeafe' : temRegra ? '#ede9fe' : '#eff6ff',
                                  color: temOverride ? '#1e40af' : temRegra ? '#5b21b6' : '#1d4ed8',
                                  border: `1px solid ${temOverride ? '#bfdbfe' : temRegra ? '#ddd6fe' : '#bfdbfe'}`,
                                  fontSize: '11px',
                                }}>{grupoExibido}</span>
                              </div>
                            ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 14px', borderRight: '1px solid #f0f4fb', width: '155px', textAlign: 'center' }}>
                            {temRateio ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 600,
                                background: '#fdf4ff', color: '#7e22ce', border: '1px solid #e9d5ff',
                              }}>
                                <SplitSquareHorizontal size={10} />
                                Rateado
                              </span>
                            ) : subgrupoExibido ? (
                              <span style={{
                                display: 'inline-block', padding: '2px 7px', borderRadius: '5px',
                                fontWeight: 500, lineHeight: 1.5, wordBreak: 'break-word',
                                background: temOverride ? '#ede9fe' : temRegra ? '#ede9fe' : '#f5f3ff',
                                color: temOverride ? '#5b21b6' : temRegra ? '#5b21b6' : '#6d28d9',
                                border: `1px solid ${temOverride ? '#ddd6fe' : temRegra ? '#ddd6fe' : '#ede9fe'}`,
                                fontSize: '11px',
                              }}>{subgrupoExibido}</span>
                            ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                        </>
                      )}
                      {/* Fonte */}
                      <td style={{ padding: '8px 14px', borderRight: '1px solid #f0f4fb', textAlign: 'center' }}>
                        <FonteBadge codigo={r.fonte_recurso} />
                      </td>
                      {/* Valor */}
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap', fontWeight: 600, color: '#0f172a', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid #f0f4fb' }}>
                        {formatCurrency(r.valor_bruto)}
                      </td>
                      {/* Rateio */}
                      <td style={{ padding: '9px 6px', textAlign: 'center' }}>
                        <button onClick={() => setRateioRow(r)} title="Rateio"
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '7px', border: 'none', background: 'none', cursor: 'pointer', color: '#cbd5e1', transition: 'all 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#cbd5e1'; }}
                        >
                          <SplitSquareHorizontal size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="px-6 py-4 border-t border-gray-50 flex items-center justify-between gap-4">
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {total > 0 ? `${total} registros • página ${page} de ${Math.max(1, totalPages)}` : ''}
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Por página:</span>
                <select
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                  className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  <ChevronLeft size={15} />
                </button>
                <span className="text-xs text-gray-500 min-w-[50px] text-center font-medium">{page} / {Math.max(1, totalPages)}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Modal de detalhe do histórico */}
      {modalRow && (
        <HistoricoDetalheModal
          row={modalRow}
          grupos={grupos}
          subgrupos={subgrupos}
          token={token}
          onClose={() => setModalRow(null)}
          onClassificado={(id, g, s, fg, fs) => {
            handleClassificacaoSaved(id, g, s, fg, fs);
            setModalRow((prev) => prev ? { ...prev, grupo_pag_nome: g, subgrupo_pag_nome: s, fk_grupo_pag: fg, fk_subgrupo_pag: fs } : null);
          }}
        />
      )}

      {/* Modal de rateio */}
      {rateioRow && (
        <RateioModal
          pagamento={rateioRow}
          grupos={grupos}
          subgrupos={subgrupos}
          token={token}
          onClose={() => setRateioRow(null)}
          onSaved={handleRateioSaved}
        />
      )}

    </div>
  );
}
