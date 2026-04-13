'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Tag, Layers, Plus, Pencil, Trash2, X, Link2, Link2Off, ShieldCheck } from 'lucide-react';
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
  grupo_nome: string;
}

interface RegraEmpenho {
  id: number;
  num_empenho_base: string;
  fk_credor: number;
  fk_grupo: number | null;
  fk_subgrupo: number | null;
  grupo_nome: string | null;
  subgrupo_nome: string | null;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function SubgrupoModal({
  subgrupo, grupos, token, onClose, onSaved,
}: {
  subgrupo: Subgrupo | null;
  grupos: Grupo[];
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(subgrupo?.nome ?? '');
  const [fkGrupo, setFkGrupo] = useState<number | ''>(subgrupo?.fk_grupo ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!nome.trim() || !fkGrupo) { setError('Nome e grupo são obrigatórios'); return; }
    setSaving(true);
    setError('');
    try {
      const url = subgrupo ? `${API}/credores/subgrupos/${subgrupo.id}` : `${API}/credores/subgrupos`;
      const res = await fetch(url, {
        method: subgrupo ? 'PUT' : 'POST',
        headers: authHeader(token),
        body: JSON.stringify({ nome: nome.trim(), fk_grupo: fkGrupo }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao salvar'); setSaving(false); return; }
      onSaved();
    } catch (err: any) {
      setError('Erro de conexão com a API');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">{subgrupo ? 'Editar Subgrupo' : 'Novo Subgrupo'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Grupo de Despesa *</label>
            <SearchSelect
              value={fkGrupo}
              onChange={(val) => setFkGrupo(val === '' ? '' : Number(val))}
              options={grupos}
              placeholder="Selecione o grupo..."
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome do Subgrupo *</label>
            <input
              autoFocus
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Ex: Medicamentos, Materiais, Serviços..."
            />
          </div>
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

export default function SubgrupoPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken ?? '';
  const role = (session as any)?.user?.role ?? '';
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const permissoes: string[] = (session as any)?.user?.permissoes ?? [];
  if (session && !isSuperAdmin && !permissoes.includes('cadastros.entidade')) return <AcessoRestrito />;

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [subgrupos, setSubgrupos] = useState<Subgrupo[]>([]);
  const [regras, setRegras] = useState<RegraEmpenho[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterGrupo, setFilterGrupo] = useState('');
  const [modal, setModal] = useState<{ open: boolean; item: Subgrupo | null }>({ open: false, item: null });

  const loadGrupos = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/credores/grupos`, { headers: authHeader(token) });
      if (res.ok) setGrupos(await res.json());
    } catch { /* API offline */ }
  }, [token]);

  const loadSubgrupos = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = filterGrupo ? `?grupoId=${filterGrupo}` : '';
      const res = await fetch(`${API}/credores/subgrupos${params}`, { headers: authHeader(token) });
      if (res.ok) setSubgrupos(await res.json());
    } catch { /* API offline */ }
    setLoading(false);
  }, [token, filterGrupo]);

  const loadRegras = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/regras-empenho`, { headers: authHeader(token) });
      if (res.ok) setRegras(await res.json());
    } catch { /* API offline */ }
  }, [token]);

  useEffect(() => { loadGrupos(); }, [loadGrupos]);
  useEffect(() => { loadSubgrupos(); }, [loadSubgrupos]);
  useEffect(() => { loadRegras(); }, [loadRegras]);

  async function handleDelete(id: number, nome: string) {
    if (!confirm(`Excluir o subgrupo "${nome}"?`)) return;
    try {
      await fetch(`${API}/credores/subgrupos/${id}`, { method: 'DELETE', headers: authHeader(token) });
      loadSubgrupos();
    } catch { /* API offline */ }
  }

  async function handleDeleteRegra(id: number, empenho: string) {
    if (!confirm(`Remover vínculo do empenho ${empenho}?`)) return;
    try {
      await fetch(`${API}/regras-empenho/${id}`, { method: 'DELETE', headers: authHeader(token) });
      loadRegras();
    } catch { /* API offline */ }
  }

  const displayed = filterGrupo
    ? subgrupos.filter((s) => String(s.fk_grupo) === filterGrupo)
    : subgrupos;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Tag size={20} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Subgrupos</h1>
            <p className="text-sm text-gray-500">Subcategorias vinculadas aos grupos de despesa</p>
          </div>
        </div>
        <button
          onClick={() => setModal({ open: true, item: null })}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Novo Subgrupo
        </button>
      </div>

      <div className="bg-white rounded-2xl border">
        <div className="px-3 py-2 border-b bg-gray-50">
          <SearchSelect
            value={filterGrupo}
            onChange={(val) => setFilterGrupo(String(val))}
            options={grupos}
            placeholder="Todos os grupos"
            className="w-56"
          />
        </div>

        <div className="overflow-x-auto rounded-b-2xl">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Subgrupo</th>
              <th className="px-4 py-3 text-left">Grupo de Despesa</th>
              <th className="px-4 py-3 text-left">Empenhos Vinculados</th>
              <th className="px-4 py-3 text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">Carregando...</td></tr>
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-14 text-center">
                  <Tag size={32} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">Nenhum subgrupo cadastrado</p>
                  {grupos.length === 0 && (
                    <p className="text-gray-400 text-xs mt-1">Crie primeiro um Grupo de Despesa</p>
                  )}
                </td>
              </tr>
            ) : displayed.map((s) => {
              const regrasDoSubgrupo = regras.filter((r) => r.fk_subgrupo === s.id);
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.nome}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      <Layers size={11} />
                      {s.grupo_nome}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {regrasDoSubgrupo.length === 0 ? (
                      <span className="text-xs text-gray-300 flex items-center gap-1">
                        <Link2Off size={11} /> nenhum
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {regrasDoSubgrupo.map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-violet-50 text-violet-700 border border-violet-200"
                          >
                            <Link2 size={9} />
                            {r.num_empenho_base}
                            <button
                              onClick={() => handleDeleteRegra(r.id, r.num_empenho_base)}
                              className="ml-0.5 hover:text-red-500 transition-colors"
                              title="Remover vínculo"
                            >
                              <X size={9} />
                            </button>
                          </span>
                        ))}
                      </div>
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
                        onClick={() => handleDelete(s.id, s.nome)}
                        className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {displayed.length > 0 && (
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400">
            {displayed.length} subgrupo{displayed.length !== 1 ? 's' : ''} cadastrado{displayed.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {modal.open && (
        <SubgrupoModal
          subgrupo={modal.item}
          grupos={grupos}
          token={token}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => { setModal({ open: false, item: null }); loadSubgrupos(); }}
        />
      )}
    </div>
  );
}
