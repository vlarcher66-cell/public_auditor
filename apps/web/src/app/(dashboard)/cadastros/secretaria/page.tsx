'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Landmark, Plus, Pencil, Trash2, X, CheckCircle, XCircle } from 'lucide-react';
import { SearchSelect } from '@/components/SearchSelect';

const API = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface Entidade { id: number; nome: string; }
interface Secretaria {
  id: number; nome: string; sigla?: string;
  fk_entidade: number; entidade_nome?: string; ativo: boolean;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function SecretariaModal({ secretaria, entidades, token, onClose, onSaved }: {
  secretaria: Secretaria | null; entidades: Entidade[]; token: string; onClose: () => void; onSaved: () => void;
}) {
  const [nome, setNome] = useState(secretaria?.nome ?? '');
  const [sigla, setSigla] = useState(secretaria?.sigla ?? '');
  const [fkEntidade, setFkEntidade] = useState(secretaria?.fk_entidade?.toString() ?? '');
  const [ativo, setAtivo] = useState(secretaria?.ativo ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!nome.trim() || !fkEntidade) { setError('Nome e entidade são obrigatórios'); return; }
    setSaving(true); setError('');
    try {
      const url = secretaria ? `${API}/secretarias/${secretaria.id}` : `${API}/secretarias`;
      const res = await fetch(url, {
        method: secretaria ? 'PUT' : 'POST',
        headers: authHeader(token),
        body: JSON.stringify({ nome: nome.trim(), sigla: sigla.trim() || null, fk_entidade: parseInt(fkEntidade), ativo }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao salvar'); setSaving(false); return; }
      onSaved();
    } catch { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">{secretaria ? 'Editar Secretaria' : 'Nova Secretaria'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Entidade *</label>
            <SearchSelect
              value={fkEntidade}
              onChange={(val) => setFkEntidade(String(val))}
              options={entidades}
              placeholder="Selecione uma entidade"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
            <input autoFocus type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Secretaria Municipal de Saúde" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sigla</label>
            <input type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={sigla} onChange={e => setSigla(e.target.value)} placeholder="Ex: SMS" maxLength={20} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="ativo" checked={ativo} onChange={e => setAtivo(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600" />
            <label htmlFor="ativo" className="text-sm text-gray-700">Ativa</label>
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

export default function SecretariaPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken ?? '';
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item: Secretaria | null }>({ open: false, item: null });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/secretarias`, { headers: authHeader(token) });
      if (res.ok) { const d = await res.json(); setSecretarias(d.rows ?? d); }
    } catch { /* offline */ }
    setLoading(false);
  }, [token]);

  const loadEntidades = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/secretarias/entidades/list`, { headers: authHeader(token) });
      if (res.ok) setEntidades(await res.json());
    } catch { /* offline */ }
  }, [token]);

  useEffect(() => { load(); loadEntidades(); }, [load, loadEntidades]);

  async function handleDelete(id: number, nome: string) {
    if (!confirm(`Excluir a secretaria "${nome}"?`)) return;
    try {
      const res = await fetch(`${API}/secretarias/${id}`, { method: 'DELETE', headers: authHeader(token) });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      load();
    } catch { /* offline */ }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Landmark size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cadastro de Secretarias</h1>
            <p className="text-sm text-gray-500">Vincule secretarias às entidades e organize os setores</p>
          </div>
        </div>
        <button onClick={() => setModal({ open: true, item: null })}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Nova Secretaria
        </button>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Sigla</th>
              <th className="px-4 py-3 text-left">Entidade</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">Carregando...</td></tr>
            ) : secretarias.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center">
                  <Landmark size={32} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">Nenhuma secretaria cadastrada</p>
                  <p className="text-gray-400 text-xs mt-1">Clique em &quot;Nova Secretaria&quot; para começar</p>
                </td>
              </tr>
            ) : secretarias.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{s.nome}</td>
                <td className="px-4 py-3">
                  {s.sigla
                    ? <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-700">{s.sigla}</span>
                    : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{s.entidade_nome || '—'}</td>
                <td className="px-4 py-3 text-center">
                  {s.ativo
                    ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle size={13} /> Ativa</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-gray-400"><XCircle size={13} /> Inativa</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setModal({ open: true, item: s })}
                      className="p-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors" title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(s.id, s.nome)}
                      className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors" title="Excluir">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {secretarias.length > 0 && (
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400">
            {secretarias.length} secretaria{secretarias.length !== 1 ? 's' : ''} cadastrada{secretarias.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {modal.open && (
        <SecretariaModal secretaria={modal.item} entidades={entidades} token={token}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => { setModal({ open: false, item: null }); load(); }} />
      )}
    </div>
  );
}
