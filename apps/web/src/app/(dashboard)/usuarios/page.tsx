'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  UserCog, Plus, Pencil, Trash2, KeyRound, X, Check,
  ShieldCheck, Eye, Crown, BarChart3, BookOpen, Landmark,
  LayoutDashboard, TrendingDown, TrendingUp, Target, CreditCard,
  ClipboardList, Upload, BarChart2, Tag, Layers, Building2, ChevronDown,
} from 'lucide-react';
import { SearchSelect } from '@/components/SearchSelect';

const API = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface Municipio { id: number; nome: string; uf: string | null; }
interface Entidade { id: number; nome: string; tipo: string; fk_municipio: number; }

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

// ─── Estrutura das permissões ─────────────────────────────────────────────────

interface PermGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  children?: { key: string; label: string }[];
}

const PERM_STRUCTURE: PermGroup[] = [
  {
    key: 'menu.dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={13} />,
  },
  {
    key: 'menu.despesa',
    label: 'Despesa',
    icon: <TrendingDown size={13} />,
  },
  {
    key: 'menu.receita',
    label: 'Receita',
    icon: <TrendingUp size={13} />,
  },
  {
    key: 'menu.saude15',
    label: 'Índice Saúde 15%',
    icon: <ShieldCheck size={13} />,
  },
  {
    key: 'menu.metas',
    label: 'Meta Despesa',
    icon: <Target size={13} />,
  },
  {
    key: 'menu.contas_pagar',
    label: 'Contas a Pagar',
    icon: <CreditCard size={13} />,
  },
  {
    key: 'menu.rel_quadrimestral',
    label: 'Rel. Quadrimestral',
    icon: <ClipboardList size={13} />,
  },
];

const OPER_STRUCTURE: PermGroup[] = [
  {
    key: 'analise',
    label: 'Análise',
    icon: <BarChart2 size={13} />,
    children: [
      { key: 'analise.despesa', label: 'Despesa' },
      { key: 'analise.receita', label: 'Receita' },
    ],
  },
  {
    key: 'importacao',
    label: 'Importação',
    icon: <Upload size={13} />,
    children: [
      { key: 'importacao.despesa', label: 'Despesa' },
      { key: 'importacao.receita', label: 'Receita' },
    ],
  },
  {
    key: 'classificacao',
    label: 'Classificação',
    icon: <Tag size={13} />,
    children: [
      { key: 'classificacao.credores', label: 'Credores' },
      { key: 'classificacao.setores', label: 'Setores' },
    ],
  },
];

const CONF_STRUCTURE: PermGroup[] = [
  { key: 'cadastros.municipio', label: 'Cad. Município', icon: <Landmark size={13} /> },
  { key: 'cadastros.entidade',  label: 'Cad. Entidade',  icon: <Building2 size={13} /> },
  { key: 'cadastros.usuarios',  label: 'Usuários',       icon: <UserCog size={13} /> },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function Checkbox({ checked, onChange, label, icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; icon?: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
          checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white group-hover:border-blue-400'
        }`}
      >
        {checked && <Check size={10} className="text-white" strokeWidth={3} />}
      </div>
      {icon && <span className="text-gray-400">{icon}</span>}
      <span className="text-xs text-gray-700">{label}</span>
    </label>
  );
}

// ─── Seção de permissões ──────────────────────────────────────────────────────

function PermSection({
  title, icon, perms, checked, onChange,
}: {
  title: string;
  icon: React.ReactNode;
  perms: PermGroup[];
  checked: Set<string>;
  onChange: (key: string, val: boolean) => void;
}) {
  const [open, setOpen] = useState(true);

  // Verifica se todos os filhos de um grupo estão marcados
  function allChildrenChecked(group: PermGroup) {
    return group.children?.every(c => checked.has(c.key)) ?? false;
  }
  function someChildrenChecked(group: PermGroup) {
    return group.children?.some(c => checked.has(c.key)) ?? false;
  }

  function toggleGroup(group: PermGroup, val: boolean) {
    if (group.children) {
      group.children.forEach(c => onChange(c.key, val));
    } else {
      onChange(group.key, val);
    }
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="text-gray-500">{icon}</span>
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex-1 text-left">{title}</span>
        <ChevronDown size={13} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="p-3 space-y-3">
          {perms.map(group => (
            <div key={group.key}>
              {group.children ? (
                <div>
                  {/* Grupo com submenus */}
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      onClick={() => toggleGroup(group, !allChildrenChecked(group))}
                      className={`w-4 h-4 rounded flex items-center justify-center border cursor-pointer transition-all ${
                        allChildrenChecked(group)
                          ? 'bg-blue-600 border-blue-600'
                          : someChildrenChecked(group)
                          ? 'bg-blue-200 border-blue-400'
                          : 'border-gray-300 bg-white hover:border-blue-400'
                      }`}
                    >
                      {allChildrenChecked(group) && <Check size={10} className="text-white" strokeWidth={3} />}
                      {!allChildrenChecked(group) && someChildrenChecked(group) && (
                        <div className="w-2 h-0.5 bg-blue-600 rounded" />
                      )}
                    </div>
                    <span className="text-gray-400">{group.icon}</span>
                    <span className="text-xs font-medium text-gray-700">{group.label}</span>
                  </div>
                  <div className="ml-6 space-y-2 pl-3 border-l border-gray-100">
                    {group.children.map(child => (
                      <Checkbox
                        key={child.key}
                        checked={checked.has(child.key)}
                        onChange={(v) => onChange(child.key, v)}
                        label={child.label}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <Checkbox
                  checked={checked.has(group.key)}
                  onChange={(v) => onChange(group.key, v)}
                  label={group.label}
                  icon={group.icon}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
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
  const [tab, setTab] = useState<'dados' | 'acesso'>('dados');
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState(usuario?.role ?? 'VIEWER');
  const [fkMunicipio, setFkMunicipio] = useState<number | null>(usuario?.fk_municipio ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Permissões e entidades
  const [permChecked, setPermChecked] = useState<Set<string>>(new Set());
  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const [entidadesChecked, setEntidadesChecked] = useState<Set<number>>(new Set());
  const [loadingPerms, setLoadingPerms] = useState(false);

  const rolesDisponiveis = isSuperAdmin ? ROLES : ROLES.filter(r => r.id !== 'SUPER_ADMIN');

  // Carrega entidades do município selecionado
  useEffect(() => {
    const muni = fkMunicipio;
    if (!muni) { setEntidades([]); return; }
    fetch(`${API}/entidades/list?municipioId=${muni}`, { headers: authHeader(token) })
      .then(r => r.ok ? r.json() : [])
      .then(data => setEntidades(Array.isArray(data) ? data : []))
      .catch(() => setEntidades([]));
  }, [fkMunicipio, token]);

  // Se editando, carrega permissões existentes
  useEffect(() => {
    if (!usuario) return;
    setLoadingPerms(true);
    fetch(`${API}/usuarios/${usuario.id}/permissoes`, { headers: authHeader(token) })
      .then(r => r.ok ? r.json() : { permissoes: [], entidades_ids: [] })
      .then(data => {
        setPermChecked(new Set(data.permissoes ?? []));
        setEntidadesChecked(new Set(data.entidades_ids ?? []));
      })
      .catch(() => {})
      .finally(() => setLoadingPerms(false));
  }, [usuario, token]);

  function togglePerm(key: string, val: boolean) {
    setPermChecked(prev => {
      const next = new Set(prev);
      if (val) next.add(key); else next.delete(key);
      return next;
    });
  }

  function toggleEntidade(id: number, val: boolean) {
    setEntidadesChecked(prev => {
      const next = new Set(prev);
      if (val) next.add(id); else next.delete(id);
      return next;
    });
  }

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

      const userId = usuario?.id ?? data.id;

      // Salva permissões
      await fetch(`${API}/usuarios/${userId}/permissoes`, {
        method: 'PUT',
        headers: authHeader(token),
        body: JSON.stringify({
          permissoes: Array.from(permChecked),
          entidades_ids: Array.from(entidadesChecked),
        }),
      });

      onSaved();
    } catch { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-[95vw] md:w-full md:max-w-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="font-semibold text-gray-800">{usuario ? 'Editar Usuário' : 'Novo Usuário'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setTab('dados')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'dados' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Dados do Usuário
          </button>
          <button
            onClick={() => setTab('acesso')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'acesso' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Controle de Acesso
          </button>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto flex-1 p-6">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}

          {tab === 'dados' && (
            <div className="space-y-4">
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
                  <p className="text-xs text-gray-400 mt-1">{ROLES.find(r => r.id === role)?.desc}</p>
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
          )}

          {tab === 'acesso' && (
            <div className="space-y-4">
              {loadingPerms ? (
                <p className="text-sm text-gray-400 text-center py-8">Carregando permissões...</p>
              ) : (
                <>
                  {/* Menu Principal */}
                  <PermSection
                    title="Menu Principal"
                    icon={<LayoutDashboard size={14} />}
                    perms={PERM_STRUCTURE}
                    checked={permChecked}
                    onChange={togglePerm}
                  />

                  {/* Operacional */}
                  <PermSection
                    title="Operacional"
                    icon={<Layers size={14} />}
                    perms={OPER_STRUCTURE}
                    checked={permChecked}
                    onChange={togglePerm}
                  />

                  {/* Configurações */}
                  <PermSection
                    title="Configurações"
                    icon={<UserCog size={14} />}
                    perms={CONF_STRUCTURE}
                    checked={permChecked}
                    onChange={togglePerm}
                  />

                  {/* Entidades acessíveis */}
                  {entidades.length > 0 && (
                    <div className="border rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50">
                        <Building2 size={14} className="text-gray-500" />
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Entidades com Acesso</span>
                      </div>
                      <div className="p-3 space-y-2">
                        {entidades.map(ent => (
                          <Checkbox
                            key={ent.id}
                            checked={entidadesChecked.has(ent.id)}
                            onChange={(v) => toggleEntidade(ent.id, v)}
                            label={ent.nome}
                            icon={<Building2 size={12} />}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {entidades.length === 0 && fkMunicipio && (
                    <p className="text-xs text-gray-400 text-center py-4">Nenhuma entidade cadastrada para este município.</p>
                  )}

                  {!fkMunicipio && isSuperAdmin && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                      Selecione um município na aba "Dados do Usuário" para ver as entidades disponíveis.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center gap-2 px-6 py-4 border-t flex-shrink-0">
          <div className="text-xs text-gray-400">
            {permChecked.size > 0 && `${permChecked.size} permissão${permChecked.size !== 1 ? 'ões' : ''} selecionada${permChecked.size !== 1 ? 's' : ''}`}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
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
    <div className="p-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
      <div className="bg-white rounded-2xl border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
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
