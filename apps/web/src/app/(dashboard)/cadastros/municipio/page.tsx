'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Landmark, Plus, Pencil, Trash2, X, ShieldAlert, ShieldCheck } from 'lucide-react';

const API = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface Municipio {
  id: number;
  nome: string;
  cnpj: string | null;
  uf: string | null;
  ativo: boolean;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function MunicipioModal({
  municipio,
  token,
  onClose,
  onSaved,
}: {
  municipio: Municipio | null;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(municipio?.nome ?? '');
  const [cnpj, setCnpj] = useState(municipio?.cnpj ?? '');
  const [uf, setUf] = useState(municipio?.uf ?? '');
  const [ativo, setAtivo] = useState(municipio?.ativo ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!nome.trim()) { setError('Nome é obrigatório'); return; }
    setSaving(true);
    setError('');
    try {
      const url = municipio ? `${API}/municipios/${municipio.id}` : `${API}/municipios`;
      const res = await fetch(url, {
        method: municipio ? 'PUT' : 'POST',
        headers: authHeader(token),
        body: JSON.stringify({ nome: nome.trim(), cnpj: cnpj.trim() || null, uf: uf.trim() || null, ativo }),
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
          <h2 className="font-semibold text-gray-800">{municipio ? 'Editar Município' : 'Novo Município'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
            <input
              type="text"
              autoFocus
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Prefeitura de Itaberaba"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">CNPJ</label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">UF</label>
              <input
                type="text"
                maxLength={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
                placeholder="BA"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700">Município ativo</span>
          </label>
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

export default function MunicipioPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken ?? '';
  const role = (session as any)?.user?.role ?? '';
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const permissoes: string[] = (session as any)?.user?.permissoes ?? [];
  if (session && !isSuperAdmin && !permissoes.includes('cadastros.municipio')) return <AcessoRestrito />;

  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item: Municipio | null }>({ open: false, item: null });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/municipios`, { headers: authHeader(token) });
      if (res.ok) {
        const data = await res.json();
        setMunicipios(data.rows);
      }
    } catch { /* API offline */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: number, nome: string) {
    if (!confirm(`Excluir o município "${nome}"? Todos os usuários vinculados devem ser removidos primeiro.`)) return;
    try {
      const res = await fetch(`${API}/municipios/${id}`, { method: 'DELETE', headers: authHeader(token) });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      load();
    } catch { /* API offline */ }
  }

  if (role && role !== 'SUPER_ADMIN') {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShieldAlert size={48} className="text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Acesso Restrito</h2>
        <p className="text-gray-500 text-sm">Esta área é exclusiva para administradores do sistema.</p>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Landmark size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cadastro de Municípios</h1>
            <p className="text-sm text-gray-500">Gerenciar clientes do sistema</p>
          </div>
        </div>
        <button
          onClick={() => setModal({ open: true, item: null })}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Novo Município
        </button>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">CNPJ</th>
              <th className="px-4 py-3 text-center w-16">UF</th>
              <th className="px-4 py-3 text-center w-20">Status</th>
              <th className="px-4 py-3 text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-400">Carregando...</td>
              </tr>
            ) : municipios.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center">
                  <Landmark size={32} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">Nenhum município cadastrado</p>
                  <p className="text-gray-400 text-xs mt-1">Clique em "Novo Município" para começar</p>
                </td>
              </tr>
            ) : (
              municipios.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{m.nome}</td>
                  <td className="px-4 py-3 text-gray-500">{m.cnpj || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {m.uf ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {m.uf}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {m.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setModal({ open: true, item: m })}
                        className="p-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id, m.nome)}
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
        {municipios.length > 0 && (
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400">
            {municipios.length} município{municipios.length !== 1 ? 's' : ''} cadastrado{municipios.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {modal.open && (
        <MunicipioModal
          municipio={modal.item}
          token={token}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => { setModal({ open: false, item: null }); load(); }}
        />
      )}
    </div>
  );
}
