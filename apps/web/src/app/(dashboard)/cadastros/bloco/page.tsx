'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Grip, Plus, Pencil, Trash2, X } from 'lucide-react';
import type { Bloco } from '@public-auditor/shared';

const API = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface ListResponse {
  rows: Bloco[];
  total: number;
  page: number;
  limit: number;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function BlocoModal({
  bloco,
  token,
  onClose,
  onSaved,
}: {
  bloco: Bloco | null;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [descricao, setDescricao] = useState(bloco?.descricao ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!descricao.trim()) { setError('Descrição é obrigatória'); return; }
    setSaving(true);
    setError('');
    try {
      const url = bloco ? `${API}/blocos/${bloco.id}` : `${API}/blocos`;
      const res = await fetch(url, {
        method: bloco ? 'PUT' : 'POST',
        headers: authHeader(token),
        body: JSON.stringify({ descricao: descricao.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao salvar'); setSaving(false); return; }
      onSaved();
    } catch { /* API offline */ }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">{bloco ? 'Editar Bloco' : 'Novo Bloco'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Descrição *</label>
            <input
              type="text"
              autoFocus
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Ex: MÉDIA E ALTA COMPLEXIDADE"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BlocoPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken ?? '';

  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item: Bloco | null }>({ open: false, item: null });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/blocos`, { headers: authHeader(token) });
      if (res.ok) {
        const data: ListResponse = await res.json();
        setBlocos(data.rows);
      }
    } catch { /* API offline */ }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: number, descricao: string) {
    if (!confirm(`Excluir o bloco "${descricao}"?`)) return;
    try {
      const res = await fetch(`${API}/blocos/${id}`, { method: 'DELETE', headers: authHeader(token) });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      load();
    } catch { /* API offline */ }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Grip size={20} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cadastro de Blocos</h1>
            <p className="text-sm text-gray-500">Categorize seus setores por blocos</p>
          </div>
        </div>
        <button
          onClick={() => setModal({ open: true, item: null })}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Novo Bloco
        </button>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Nome do Bloco</th>
              <th className="px-4 py-3 text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={2} className="px-5 py-10 text-center text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : blocos.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-5 py-14 text-center">
                  <Grip size={32} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">Nenhum bloco cadastrado</p>
                  <p className="text-gray-400 text-xs mt-1">Clique em "Novo Bloco" para começar</p>
                </td>
              </tr>
            ) : (
              blocos.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      <Grip size={11} />
                      {b.descricao}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setModal({ open: true, item: b })}
                        className="p-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(b.id, b.descricao)}
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
        {blocos.length > 0 && (
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400">
            {blocos.length} bloco{blocos.length !== 1 ? 's' : ''} cadastrado{blocos.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {modal.open && (
        <BlocoModal
          bloco={modal.item}
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
