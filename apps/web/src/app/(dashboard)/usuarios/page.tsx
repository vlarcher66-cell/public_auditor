'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  UserCog, Plus, Pencil, Trash2, KeyRound, X, Check,
  ShieldCheck, Eye, Crown, BarChart3, BookOpen, Landmark,
} from 'lucide-react';
import { SearchSelect } from '@/components/SearchSelect';

const API = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface Municipio { id: number; nome: string; uf: string | null; }

interface Usuario {
  id: number;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  fk_municipio: number | null;
  fk_entidade: number | null;
  municipio_nome: string | null;
  entidade_nome: string | null;
  ultimo_acesso: string | null;
  criado_em: string;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ROLES = [
  { id: 'SUPER_ADMIN', nome: '👑 Super Admin', desc: 'Acesso total a todos os municípios' },
  { id: 'GESTOR',      nome: '🏛️ Gestor',      desc: 'Prefeito/Secretário — vê todo o município' },
  { id: 'CONTADOR',    nome: '📊 Contador',    desc: 'Importação e classificação' },
  { id: 'AUDITOR',     nome: '🔍 Auditor',     desc: 'Somente leitura + relatórios' },
  { id: 'VEREADOR',    nome: '📋 Vereador',    desc: 'Dashboard do município, só leitura' },
  { id: 'VIEWER',      nome: '👁️ Visualizador', desc: 'Somente dashboard da entidade' },
];

function roleBadge(role: string) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    SUPER_ADMIN: { label: 'Super Admin', cls: 'bg-purple-100 text-purple-700', icon: <Crown size={11} /> },
    GESTOR:      { label: 'Gestor',      cls: 'bg-indigo-100 text-indigo-700', icon: <Landmark size={11} /> },
    CONTADOR:    { label: 'Contador',    cls: 'bg-blue-100 text-blue-700',     icon: <BarChart3 size={11} /> },
    AUDITOR:     { label: 'Auditor',     cls: 'bg-amber-100 text-amber-700',   icon: <ShieldCheck size={11} /> },
    VEREADOR:    { label: 'Vereador',    cls: 'bg-teal-100 text-teal-700',     icon: <BookOpen size={11} /> },
    VIEWER:      { label: 'Visualizador',cls: 'bg-gray-100 text-gray-600',     icon: <Eye size={11} /> },
  };
  const r = map[role] ?? { label: role, cls: 'bg-gray-100 text-gray-500', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${r.cls}`}>
      {r.icon} {r.label}
    </span>
  );
}

// ─── Modal Usuário ─────────────────────────────────────────────────────────────

function UsuarioModal({
  usuario, token, isSuperAdmin, municipios, onClose, onSaved,
}: {
  usuario: Usuario | null;
  token: string;
  isSuperAdmin: boolean;
  municipios: Municipio[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState(usuario?.role ?? 'VIEWER');
  const [fkMunicipio, setFkMunicipio] = useState<number | null>(usuario?.fk_municipio ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const rolesDisponiveis = isSuperAdmin ? ROLES : ROLES.filter(r => r.id !== 'SUPER_ADMIN');

  async function handleSave() {
    if (!nome.trim() || !email.trim()) { setError('Nome e email são obrigatórios'); return; }
    if (!usuario && !senha) { setError('Senha obrigatória para novo usuário'); return; }
    setSaving(true); setError('');
    try {
      const url = usuario ? `${API}/usuarios/${usuario.id}` : `${API}/usuarios`;
      const body: any = { nome, email, role };
      if (!usuario) body.senha = senha;
      if (isSuperAdmin) body.fk_municipio = fkMunicipio;
      const res = await fetch(url, { method: usuario ? 'PUT' : 'POST', headers: authHeader(token), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao salvar'); setSaving(false); return; }
      onSaved();
    } catch { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">{usuario ? 'Editar Usuário' : 'Novo Usuário'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
            <input autoFocus className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
            <input type="email" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@prefeitura.gov.br" />
          </div>

          {!usuario && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Senha *</label>
              <input type="password" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Perfil *</label>
            <SearchSelect
              value={role}
              onChange={(val) => setRole(val as string)}
              options={rolesDisponiveis.map(r => ({ id: r.id, nome: r.nome }))}
              placeholder="Selecione o perfil"
              required
            />
            {role && (
              <p className="text-xs text-gray-400 mt-1">
                {ROLES.find(r => r.id === role)?.desc}
              </p>
            )}
          </div>

          {isSuperAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Município</label>
              <SearchSelect
                value={fkMunicipio ?? ''}
                onChange={(val) => setFkMunicipio(val ? Number(val) : null)}
                options={[{ id: '', nome: '— Nenhum (Super Admin global) —' }, ...municipios.map(m => ({ id: m.id, nome: `${m.nome}${m.uf ? ` (${m.uf})` : ''}` }))]}
                placeholder="Selecione o município"
              />
            </div>
          )}
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

// ─── Modal Senha ───────────────────────────────────────────────────────────────

function SenhaModal({ usuario, token, onClose, onSaved }: { usuario: Usuario; token: string; onClose: () => void; onSaved: () => void }) {
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (senha.length < 6) { setError('Senha deve ter ao menos 6 caracteres'); return; }
    if (senha !== confirma) { setError('Senhas não conferem'); return; }
    setSaving(true); setError('');
    const res = await fetch(`${API}/usuarios/${usuario.id}/senha`, {
      method: 'PATCH', headers: authHeader(token), body: JSON.stringify({ senha }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Erro'); setSaving(false); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Alterar Senha</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-500">Usuário: <span className="font-medium text-gray-700">{usuario.nome}</span></p>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nova Senha *</label>
            <input autoFocus type="password" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar Senha *</label>
            <input type="password" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={confirma} onChange={(e) => setConfirma(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()} placeholder="Repita a senha" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Salvando...' : 'Alterar Senha'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken ?? '';
  const role = (session as any)?.user?.role ?? '';
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ type: 'usuario' | 'senha'; item: Usuario | null } | null>(null);
  const [saved, setSaved] = useState(false);
  const [filtroMunicipio, setFiltroMunicipio] = useState<number | ''>('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [resU, resM] = await Promise.all([
        fetch(`${API}/usuarios`, { headers: authHeader(token) }),
        fetch(`${API}/municipios/list`, { headers: authHeader(token) }),
      ]);
      if (resU.ok) setUsuarios(await resU.json());
      if (resM.ok) setMunicipios(await resM.json());
    } catch { /* API offline */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(u: Usuario) {
    if (!confirm(`Excluir o usuário "${u.nome}"?`)) return;
    try {
      await fetch(`${API}/usuarios/${u.id}`, { method: 'DELETE', headers: authHeader(token) });
      load();
    } catch { /* API offline */ }
  }

  async function handleToggleAtivo(u: Usuario) {
    try {
      await fetch(`${API}/usuarios/${u.id}`, {
        method: 'PUT', headers: authHeader(token),
        body: JSON.stringify({ ativo: !u.ativo }),
      });
      load();
    } catch { /* API offline */ }
  }

  function handleSaved() {
    setModal(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    load();
  }

  const usuariosFiltrados = filtroMunicipio
    ? usuarios.filter(u => u.fk_municipio === filtroMunicipio)
    : usuarios;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <UserCog size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Gestão de Usuários</h1>
            <p className="text-sm text-gray-500">Controle de acesso ao sistema</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
              <Check size={13} /> Salvo com sucesso
            </span>
          )}
          <button
            onClick={() => setModal({ type: 'usuario', item: null })}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} /> Novo Usuário
          </button>
        </div>
      </div>

      {/* Filtro por município (só SUPER_ADMIN) */}
      {isSuperAdmin && municipios.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-medium">Filtrar por município:</span>
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

      {/* Tabela */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Perfil</th>
              {isSuperAdmin && <th className="px-4 py-3 text-left">Município</th>}
              <th className="px-4 py-3 text-center w-20">Status</th>
              <th className="px-4 py-3 text-left">Último Acesso</th>
              <th className="px-4 py-3 text-center w-28">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-10 text-center text-gray-400">Carregando...</td></tr>
            ) : usuariosFiltrados.length === 0 ? (
              <tr><td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-14 text-center text-gray-400">Nenhum usuário encontrado</td></tr>
            ) : usuariosFiltrados.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.nome}</td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">{u.email}</td>
                <td className="px-4 py-3">{roleBadge(u.role)}</td>
                {isSuperAdmin && (
                  <td className="px-4 py-3">
                    {u.municipio_nome ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700">
                        <Landmark size={10} /> {u.municipio_nome}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Global</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleToggleAtivo(u)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${u.ativo ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{formatDate(u.ultimo_acesso)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setModal({ type: 'usuario', item: u })}
                      className="p-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors" title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setModal({ type: 'senha', item: u })}
                      className="p-1.5 rounded-lg hover:bg-amber-50 hover:text-amber-600 text-gray-400 transition-colors" title="Alterar senha">
                      <KeyRound size={14} />
                    </button>
                    <button onClick={() => handleDelete(u)}
                      className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors" title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {usuariosFiltrados.length > 0 && (
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400">
            {usuariosFiltrados.length} usuário{usuariosFiltrados.length !== 1 ? 's' : ''}
            {filtroMunicipio ? ` em ${municipios.find(m => m.id === filtroMunicipio)?.nome}` : ' no total'}
          </div>
        )}
      </div>

      {modal?.type === 'usuario' && (
        <UsuarioModal
          usuario={modal.item}
          token={token}
          isSuperAdmin={isSuperAdmin}
          municipios={municipios}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {modal?.type === 'senha' && modal.item && (
        <SenhaModal usuario={modal.item} token={token} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
