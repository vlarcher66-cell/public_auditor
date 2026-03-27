'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { UserCog, Plus, Pencil, Trash2, KeyRound, X, Check, ShieldCheck, Eye } from 'lucide-react';
import { SearchSelect } from '@/components/SearchSelect';

const API = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface Usuario {
  id: number;
  nome: string;
  email: string;
  role: 'ADMIN' | 'VIEWER';
  ativo: boolean;
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

// ─── Modal Usuário ────────────────────────────────────────────────────────────

function UsuarioModal({
  usuario, token, onClose, onSaved,
}: {
  usuario: Usuario | null;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'VIEWER'>(usuario?.role ?? 'VIEWER');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!nome.trim() || !email.trim()) { setError('Nome e email são obrigatórios'); return; }
    if (!usuario && !senha) { setError('Senha obrigatória para novo usuário'); return; }
    setSaving(true); setError('');
    try {
      const url = usuario ? `${API}/usuarios/${usuario.id}` : `${API}/usuarios`;
      const body: any = { nome, email, role };
      if (!usuario) body.senha = senha;
      const res = await fetch(url, { method: usuario ? 'PUT' : 'POST', headers: authHeader(token), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao salvar'); setSaving(false); return; }
      onSaved();
    } catch { /* API offline */ }
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Perfil</label>
            <SearchSelect
              value={role}
              onChange={(val) => setRole(val as any)}
              options={[{ id: 'ADMIN', nome: 'Administrador' }, { id: 'VIEWER', nome: 'Visualizador' }]}
              placeholder="Selecione o perfil"
              required
            />
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

// ─── Modal Senha ──────────────────────────────────────────────────────────────

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

// ─── Página ───────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken ?? '';

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ type: 'usuario' | 'senha'; item: Usuario | null } | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/usuarios`, { headers: authHeader(token) });
      if (res.ok) setUsuarios(await res.json());
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
    setTimeout(() => setSaved(false), 2000);
    load();
  }

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

      {/* Tabela */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Perfil</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Último Acesso</th>
              <th className="px-4 py-3 text-center w-32">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Carregando...</td></tr>
            ) : usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.nome}</td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">{u.email}</td>
                <td className="px-4 py-3">
                  {u.role === 'ADMIN'
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700"><ShieldCheck size={11} /> Admin</span>
                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><Eye size={11} /> Visualizador</span>}
                </td>
                <td className="px-4 py-3">
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
        {usuarios.length > 0 && (
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400">
            {usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {modal?.type === 'usuario' && (
        <UsuarioModal usuario={modal.item} token={token} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {modal?.type === 'senha' && modal.item && (
        <SenhaModal usuario={modal.item} token={token} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
