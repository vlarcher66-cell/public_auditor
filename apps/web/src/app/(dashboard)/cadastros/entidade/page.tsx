'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Building, Plus, Pencil, Trash2, X, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';
import { SearchSelect } from '@/components/SearchSelect';

const API = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface Municipio { id: number; nome: string; uf: string | null; }
interface Entidade {
  id: number;
  nome: string;
  cnpj?: string;
  tipo: string;
  ativo: boolean;
  fk_municipio: number | null;
  municipio_nome?: string | null;
  sistema_contabil?: string | null;
}

const SISTEMAS = ['FATOR', 'SIAFIC', 'BETHA', 'OUTRO'];

const TIPOS = ['FUNDO', 'PREFEITURA', 'AUTARQUIA', 'CÂMARA', 'OUTROS'];

const tipoColor: Record<string, string> = {
  FUNDO: 'bg-blue-100 text-blue-700',
  PREFEITURA: 'bg-green-100 text-green-700',
  AUTARQUIA: 'bg-purple-100 text-purple-700',
  'CÂMARA': 'bg-amber-100 text-amber-700',
  OUTROS: 'bg-gray-100 text-gray-600',
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function EntidadeModal({ entidade, token, municipios, onClose, onSaved }: {
  entidade: Entidade | null;
  token: string;
  municipios: Municipio[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(entidade?.nome ?? '');
  const [cnpj, setCnpj] = useState(entidade?.cnpj ?? '');
  const [tipo, setTipo] = useState(entidade?.tipo ?? 'FUNDO');
  const [ativo, setAtivo] = useState(entidade?.ativo ?? true);
  const [fkMunicipio, setFkMunicipio] = useState<number | null>(entidade?.fk_municipio ?? null);
  const [sistemaContabil, setSistemaContabil] = useState(entidade?.sistema_contabil ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!nome.trim()) { setError('Nome é obrigatório'); return; }
    if (!fkMunicipio) { setError('Município é obrigatório'); return; }
    setSaving(true); setError('');
    try {
      const url = entidade ? `${API}/entidades/${entidade.id}` : `${API}/entidades`;
      const res = await fetch(url, {
        method: entidade ? 'PUT' : 'POST',
        headers: authHeader(token),
        body: JSON.stringify({ nome: nome.trim(), cnpj: cnpj.trim() || null, tipo, ativo, fk_municipio: fkMunicipio, sistema_contabil: sistemaContabil || null }),
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
          <h2 className="font-semibold text-gray-800">{entidade ? 'Editar Entidade' : 'Nova Entidade'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Município *</label>
            <SearchSelect
              value={fkMunicipio ?? ''}
              onChange={(v) => setFkMunicipio(v ? Number(v) : null)}
              options={municipios.map(m => ({ id: m.id, nome: `${m.nome}${m.uf ? ` (${m.uf})` : ''}` }))}
              placeholder="Selecione o município"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
            <input autoFocus type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Fundo Municipal de Saúde" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">CNPJ</label>
            <input type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo *</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sistema Contábil</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={sistemaContabil} onChange={e => setSistemaContabil(e.target.value)}>
              <option value="">— Não definido —</option>
              {SISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600" />
            <span className="text-sm text-gray-700">Ativo</span>
          </label>
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

export default function EntidadePage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken ?? '';
  const role = (session as any)?.user?.role ?? '';
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const permissoes: string[] = (session as any)?.user?.permissoes ?? [];
  if (session && !isSuperAdmin && !permissoes.includes('cadastros.entidade')) return <AcessoRestrito />;

  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item: Entidade | null }>({ open: false, item: null });
  const [filtroMunicipio, setFiltroMunicipio] = useState<number | ''>('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [resE, resM] = await Promise.all([
        fetch(`${API}/entidades`, { headers: authHeader(token) }),
        fetch(`${API}/municipios/list`, { headers: authHeader(token) }),
      ]);
      if (resE.ok) { const d = await resE.json(); setEntidades(d.rows ?? d); }
      if (resM.ok) setMunicipios(await resM.json());
    } catch { /* offline */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: number, nome: string) {
    if (!confirm(`Excluir a entidade "${nome}"?`)) return;
    try {
      const res = await fetch(`${API}/entidades/${id}`, { method: 'DELETE', headers: authHeader(token) });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      load();
    } catch { /* offline */ }
  }

  const entidadesFiltradas = filtroMunicipio
    ? entidades.filter(e => e.fk_municipio === filtroMunicipio)
    : entidades;

  return (
    <div className="p-3 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Building size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cadastro de Entidades</h1>
            <p className="text-sm text-gray-500">Fundos, prefeituras e órgãos por município</p>
          </div>
        </div>
        <button onClick={() => setModal({ open: true, item: null })}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Nova Entidade
        </button>
      </div>

      {/* Filtro por município */}
      {municipios.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-medium">Filtrar:</span>
          <div className="w-72">
            <SearchSelect
              value={filtroMunicipio}
              onChange={(v) => setFiltroMunicipio(v ? Number(v) : '')}
              options={[{ id: '', nome: 'Todos os municípios' }, ...municipios.map(m => ({ id: m.id, nome: `${m.nome}${m.uf ? ` (${m.uf})` : ''}` }))]}
              placeholder="Todos os municípios"
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Município</th>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">CNPJ</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Sistema</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Carregando...</td></tr>
            ) : entidadesFiltradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-14 text-center">
                  <Building size={32} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">Nenhuma entidade cadastrada</p>
                  <p className="text-gray-400 text-xs mt-1">Clique em "Nova Entidade" para começar</p>
                </td>
              </tr>
            ) : entidadesFiltradas.map(e => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {e.municipio_nome
                    ? <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{e.municipio_nome}</span>
                    : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{e.nome}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{e.cnpj || <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${tipoColor[e.tipo] || tipoColor.OUTROS}`}>
                    {e.tipo}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {e.sistema_contabil
                    ? <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">{e.sistema_contabil}</span>
                    : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {e.ativo
                    ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle size={13} /> Ativo</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-gray-400"><XCircle size={13} /> Inativo</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setModal({ open: true, item: e })}
                      className="p-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors" title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(e.id, e.nome)}
                      className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors" title="Excluir">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entidadesFiltradas.length > 0 && (
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400">
            {entidadesFiltradas.length} entidade{entidadesFiltradas.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {modal.open && (
        <EntidadeModal
          entidade={modal.item}
          token={token}
          municipios={municipios}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => { setModal({ open: false, item: null }); load(); }}
        />
      )}
    </div>
  );
}
