'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Building2, Layers, Plus, Pencil, Trash2, X, Search, Landmark } from 'lucide-react';
import { SearchSelect } from '@/components/SearchSelect';
import type { Setor, Bloco } from '@public-auditor/shared';

interface Secretaria { id: number; nome: string; sigla?: string; }

const API = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface ListResponse {
  rows: Setor[];
  total: number;
  page: number;
  limit: number;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function SetorModal({
  setor, blocos, secretarias, token, onClose, onSaved,
}: {
  setor: Setor | null; blocos: Bloco[]; secretarias: Secretaria[];
  token: string; onClose: () => void; onSaved: () => void;
}) {
  const [descricao, setDescricao] = useState(setor?.descricao ?? '');
  const [fkBloco, setFkBloco] = useState(setor?.fk_bloco?.toString() ?? '');
  const [fkSecretaria, setFkSecretaria] = useState((setor as any)?.fk_secretaria?.toString() ?? '');
  const [palavrasChave, setPalavrasChave] = useState(setor?.palavras_chave ?? '');
  const [numEmpenhos, setNumEmpenhos] = useState((setor as any)?.num_empenhos ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!descricao.trim() || !fkBloco) { setError('Descrição e bloco são obrigatórios'); return; }
    setSaving(true); setError('');
    try {
      const url = setor ? `${API}/setores/${setor.id}` : `${API}/setores`;
      const res = await fetch(url, {
        method: setor ? 'PUT' : 'POST',
        headers: authHeader(token),
        body: JSON.stringify({
          descricao: descricao.trim(),
          fk_bloco: parseInt(fkBloco),
          fk_secretaria: fkSecretaria ? parseInt(fkSecretaria) : null,
          palavras_chave: palavrasChave.trim() || null,
          num_empenhos: numEmpenhos.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao salvar'); setSaving(false); return; }
      onSaved();
    } catch { /* API offline */ }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">{setor ? 'Editar Setor' : 'Novo Setor'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Descrição *</label>
            <input type="text" autoFocus
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: CEREST" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Secretaria</label>
            <SearchSelect
              value={fkSecretaria}
              onChange={(val) => setFkSecretaria(String(val))}
              options={secretarias.map(s => ({ id: s.id, nome: s.sigla ? `${s.sigla} — ${s.nome}` : s.nome }))}
              placeholder="— sem secretaria —"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Bloco *</label>
            <SearchSelect
              value={fkBloco}
              onChange={(val) => setFkBloco(String(val))}
              options={blocos.map(b => ({ id: b.id, nome: b.descricao }))}
              placeholder="Selecione um bloco"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Palavras-chave <span className="font-normal text-gray-400 ml-1">(separadas por vírgula)</span>
            </label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3} value={palavrasChave} onChange={e => setPalavrasChave(e.target.value)}
              placeholder="Ex: HOSPITAL GERAL, H.G.I, HOSP. GERAL ITABERABA" />
            <p className="text-[10px] text-gray-400 mt-1">Usadas para identificar automaticamente o setor no histórico dos pagamentos durante a importação.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Nº Empenhos vinculados <span className="font-normal text-gray-400 ml-1">(separados por vírgula)</span>
            </label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none font-mono"
              rows={2} value={numEmpenhos} onChange={e => setNumEmpenhos(e.target.value)}
              placeholder="Ex: 86, 224, 55" />
            <p className="text-[10px] text-gray-400 mt-1">Pagamentos cujo número de empenho base coincida serão classificados automaticamente neste setor.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SetorPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken ?? '';

  const [setores, setSetores] = useState<Setor[]>([]);
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item: Setor | null }>({ open: false, item: null });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/setores`, { headers: authHeader(token) });
      if (res.ok) {
        const data: ListResponse = await res.json();
        setSetores(data.rows);
      }
    } catch { /* API offline */ }
    setLoading(false);
  }, [token]);

  const loadBlocos = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/setores/blocos/list`, { headers: authHeader(token) });
      if (res.ok) setBlocos(await res.json());
    } catch { /* API offline */ }
  }, [token]);

  const loadSecretarias = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/setores/secretarias/list`, { headers: authHeader(token) });
      if (res.ok) setSecretarias(await res.json());
    } catch { /* API offline */ }
  }, [token]);

  useEffect(() => {
    load();
    loadBlocos();
    loadSecretarias();
  }, [load, loadBlocos, loadSecretarias]);

  async function handleDelete(id: number, descricao: string) {
    if (!confirm(`Excluir o setor "${descricao}"?`)) return;
    try {
      const res = await fetch(`${API}/setores/${id}`, { method: 'DELETE', headers: authHeader(token) });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      load();
    } catch { /* API offline */ }
  }

  const getBlocoNome = (blocoId: number) => {
    return blocos.find((b) => b.id === blocoId)?.descricao || '—';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <Building2 size={20} className="text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cadastro de Setores</h1>
            <p className="text-sm text-gray-500">Organize setores, blocos e palavras-chave para identificação automática</p>
          </div>
        </div>
        <button
          onClick={() => setModal({ open: true, item: null })}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Novo Setor
        </button>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Setor</th>
              <th className="px-4 py-3 text-left">Secretaria</th>
              <th className="px-4 py-3 text-left">Bloco</th>
              <th className="px-4 py-3 text-left">Palavras-chave</th>
              <th className="px-4 py-3 text-left">Empenhos</th>
              <th className="px-4 py-3 text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : setores.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-14 text-center">
                  <Building2 size={32} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">Nenhum setor cadastrado</p>
                  <p className="text-gray-400 text-xs mt-1">Clique em &quot;Novo Setor&quot; para começar</p>
                </td>
              </tr>
            ) : (
              setores.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.descricao}</td>
                  <td className="px-4 py-3">
                    {(s as any).secretaria_nome ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                        <Landmark size={11} />
                        {(s as any).secretaria_nome}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      <Layers size={11} />
                      {getBlocoNome(s.fk_bloco)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.palavras_chave ? (
                      <div className="flex flex-wrap gap-1">
                        {s.palavras_chave.split(',').slice(0, 4).map((kw, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-50 text-orange-600">
                            <Search size={8} />
                            {kw.trim()}
                          </span>
                        ))}
                        {s.palavras_chave.split(',').length > 4 && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                            +{s.palavras_chave.split(',').length - 4}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(s as any).num_empenhos ? (
                      <div className="flex flex-wrap gap-1">
                        {(s as any).num_empenhos.split(',').slice(0, 4).map((emp: string, i: number) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-teal-50 text-teal-700 border border-teal-200">
                            {emp.trim()}
                          </span>
                        ))}
                        {(s as any).num_empenhos.split(',').length > 4 && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                            +{(s as any).num_empenhos.split(',').length - 4}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setModal({ open: true, item: s })}
                        className="p-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id, s.descricao)}
                        className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {setores.length > 0 && (
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400">
            {setores.length} setor{setores.length !== 1 ? 'es' : ''} cadastrado{setores.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {modal.open && (
        <SetorModal
          setor={modal.item}
          blocos={blocos}
          secretarias={secretarias}
          token={token}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => {
            setModal({ open: false, item: null });
            load();
          }}
        />
      )}
    </div>
  );
}
