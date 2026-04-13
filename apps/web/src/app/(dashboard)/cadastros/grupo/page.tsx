'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Layers, Plus, Pencil, Trash2, X, Lock, ShieldCheck } from 'lucide-react';

const API = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface Grupo {
  id: number;
  nome: string;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function GrupoModal({
  grupo,
  token,
  onClose,
  onSaved,
}: {
  grupo: Grupo | null;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(grupo?.nome ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!nome.trim()) { setError('Nome obrigatório'); return; }
    setSaving(true);
    setError('');
    const url = grupo ? `${API}/credores/grupos/${grupo.id}` : `${API}/credores/grupos`;
    try {
      const res = await fetch(url, {
        method: grupo ? 'PUT' : 'POST',
        headers: authHeader(token),
        body: JSON.stringify({ nome: nome.trim() }),
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
          <h2 className="font-semibold text-gray-800">{grupo ? 'Editar Grupo' : 'Novo Grupo de Despesa'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}
          <label className="block text-xs font-medium text-gray-500 mb-1">Nome do Grupo *</label>
          <input
            autoFocus
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Ex: Saúde, Educação, Administração..."
          />
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancelar</button>
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

function AcessoRestrito() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
        <ShieldCheck size={32} className="text-red-400" />
      </div>
      <div>
        <p className="text-lg font-semibold text-gray-700">Acesso Restrito</p>
        <p className="text-sm text-gray-400 mt-1">Você não tem permissão para acessar este cadastro.</p>
      </div>
    </div>
  );
}

export default function GrupoPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken ?? '';
  const role = (session as any)?.user?.role ?? '';
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const permissoes: string[] = (session as any)?.user?.permissoes ?? [];
  if (session && !isSuperAdmin && !permissoes.includes('cadastros.entidade')) return <AcessoRestrito />;

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item: Grupo | null }>({ open: false, item: null });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/credores/grupos`, { headers: authHeader(token) });
      if (res.ok) setGrupos(await res.json());
    } catch { /* API offline */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const PROTEGIDOS = ['RESTOS A PAGAR', 'DESPESAS DO EXERCÍCIO ANTERIOR', 'DESPESAS DO EXERCICIO ANTERIOR'];
  const isProtegido = (nome: string) => PROTEGIDOS.some(p => nome.toUpperCase().includes(p));

  async function handleDelete(id: number, nome: string) {
    if (isProtegido(nome)) {
      alert(`O grupo "${nome}" é protegido pelo sistema e não pode ser excluído.\n\nEle é necessário para o cálculo da Despesa Sintética.`);
      return;
    }
    if (!confirm(`Excluir o grupo "${nome}"?\n\nCredores vinculados perderão o grupo.`)) return;
    try {
      const res = await fetch(`${API}/credores/grupos/${id}`, { method: 'DELETE', headers: authHeader(token) });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      load();
    } catch { /* API offline */ }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Layers size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Grupos de Despesa</h1>
            <p className="text-sm text-gray-500">Categorias para classificação de credores</p>
          </div>
        </div>
        <button
          onClick={() => setModal({ open: true, item: null })}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Novo Grupo
        </button>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Nome do Grupo</th>
              <th className="px-4 py-3 text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={2} className="px-5 py-10 text-center text-gray-400">Carregando...</td></tr>
            ) : grupos.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-5 py-14 text-center">
                  <Layers size={32} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">Nenhum grupo cadastrado</p>
                  <p className="text-gray-400 text-xs mt-1">Clique em "Novo Grupo" para começar</p>
                </td>
              </tr>
            ) : grupos.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    <Layers size={11} />
                    {g.nome}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    {isProtegido(g.nome) ? (
                      <span title="Grupo protegido pelo sistema — não pode ser excluído" className="p-1.5 rounded-lg text-amber-400 cursor-default flex items-center gap-1 text-xs font-medium">
                        <Lock size={14} /> Protegido
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => setModal({ open: true, item: g })}
                          className="p-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(g.id, g.nome)}
                          className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {grupos.length > 0 && (
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400">
            {grupos.length} grupo{grupos.length !== 1 ? 's' : ''} cadastrado{grupos.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {modal.open && (
        <GrupoModal
          grupo={modal.item}
          token={token}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => { setModal({ open: false, item: null }); load(); }}
        />
      )}
    </div>
  );
}
