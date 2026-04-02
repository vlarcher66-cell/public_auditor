'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import {
  LayoutDashboard, Upload, FileText, LogOut, ChevronRight,
  Building2, Layers, Tag, ChevronDown, UserCog, PanelLeftClose, PanelLeftOpen, Grip, Landmark, CheckCircle, TrendingUp, TrendingDown, BarChart2, ArrowLeftRight, ShieldCheck, Target, Receipt, CreditCard, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Estrutura do menu ────────────────────────────────────────────────────────

const cadastrosItems = [
  { href: '/cadastros/municipio', icon: <Landmark size={16} />, label: 'Cad. Município', superAdminOnly: true },
  { href: '/cadastros/entidade', icon: <Building2 size={16} />, label: 'Cad. Entidade' },
  { href: '/cadastros/secretaria', icon: <Landmark size={16} />, label: 'Cad. Secretaria' },
  { href: '/cadastros/bloco', icon: <Grip size={16} />, label: 'Cad. Bloco' },
  { href: '/cadastros/setor', icon: <Building2 size={16} />, label: 'Cad. Setor' },
  { href: '/cadastros/grupo', icon: <Layers size={16} />, label: 'Cad. Grupo' },
  { href: '/cadastros/subgrupo', icon: <Tag size={16} />, label: 'Cad. Subgrupo' },
];

const classificacaoItems = [
  { href: '/cadastros/credor', icon: <Tag size={14} />, label: 'Credores' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

// ─── Componente de item simples ───────────────────────────────────────────────

function NavItem({
  href, icon, label, collapsed, active,
}: {
  href: string; icon: React.ReactNode; label: string; collapsed: boolean; active: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
        collapsed && 'justify-center px-0',
        active ? 'bg-white/15 text-white shadow-sm' : 'text-white/60 hover:bg-white/10 hover:text-white',
      )}
    >
      <span className={active ? 'text-gold-500' : ''}>{icon}</span>
      {!collapsed && <span>{label}</span>}
      {!collapsed && active && <ChevronRight size={14} className="ml-auto text-gold-500" />}
    </Link>
  );
}

// ─── Componente de grupo expansível ──────────────────────────────────────────

function NavGroup({
  icon, label, collapsed, active, open, onToggle, children,
}: {
  icon: React.ReactNode; label: string; collapsed: boolean;
  active: boolean; open: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        title={label}
        className={cn(
          'flex justify-center items-center px-0 py-2.5 w-full rounded-xl text-sm font-medium transition-all duration-200',
          active ? 'bg-white/15 text-gold-500' : 'text-white/60 hover:bg-white/10 hover:text-white',
        )}
      >
        {icon}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 w-full',
          active ? 'bg-white/15 text-white shadow-sm' : 'text-white/60 hover:bg-white/10 hover:text-white',
        )}
      >
        <span className={active ? 'text-gold-500' : ''}>{icon}</span>
        <span>{label}</span>
        <ChevronDown size={14} className={cn('ml-auto transition-transform duration-200', open ? 'rotate-180' : '')} />
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-white/10 pl-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Sub-item dentro de grupo ─────────────────────────────────────────────────

function SubItem({
  href, icon, label, active,
}: {
  href: string; icon: React.ReactNode; label: string; active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
        active ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white',
      )}
    >
      <span className={active ? 'text-gold-500' : ''}>{icon}</span>
      <span>{label}</span>
      {active && <ChevronRight size={12} className="ml-auto text-gold-500" />}
    </Link>
  );
}

// ─── Sidebar principal ────────────────────────────────────────────────────────

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session as any)?.user?.role ?? '';
  const isSuperAdmin = role === 'SUPER_ADMIN';

  // Estados dos grupos
  const isDashboardActive = pathname === '/dashboard' || pathname === '/receitas' || pathname === '/saude-15' || pathname === '/metas' || pathname === '/contas-a-pagar' || pathname === '/relatorio-saude';
  const isImportacaoActive = pathname === '/importacao' || pathname === '/importacao-receita' || pathname === '/importacao-transf-bancaria' || pathname === '/importacao-empenhos';
  const isAnaliseActive = pathname === '/pagamentos' || pathname === '/receitas/listagem' || pathname === '/analise/despesa-a-pagar';
  const isCadastrosActive = pathname.startsWith('/cadastros');
  const isClassificacaoActive = pathname === '/cadastros/credor' || pathname.startsWith('/cadastros/credor/');

  const [dashboardOpen, setDashboardOpen] = useState(isDashboardActive);
  const [importacaoOpen, setImportacaoOpen] = useState(isImportacaoActive);
  const [analiseOpen, setAnaliseOpen] = useState(isAnaliseActive);
  const [cadastrosOpen, setCadastrosOpen] = useState(isCadastrosActive);
  const [classificacaoOpen, setClassificacaoOpen] = useState(isClassificacaoActive);

  return (
    <aside
      className={cn(
        'bg-navy-800 text-white flex flex-col min-h-screen fixed left-0 top-0 z-30 shadow-xl transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo + botão toggle */}
      <div className="px-3 py-4 border-b border-white/10 flex items-center justify-between gap-2">
        <div className={cn('flex items-center gap-3 overflow-hidden', collapsed && 'justify-center w-full')}>
          <div className="w-9 h-9 bg-gold-500 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <Building2 size={18} className="text-navy-800" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="font-bold text-sm leading-tight whitespace-nowrap">GestorPublico</div>
              <div className="text-xs text-white/50 whitespace-nowrap">Gestão Municipal</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={onToggle}
            title="Recolher menu"
            className="flex-shrink-0 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* Botão expandir (colapsado) */}
      {collapsed && (
        <div className="flex justify-center py-2 border-b border-white/10">
          <button
            onClick={onToggle}
            title="Expandir menu"
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <PanelLeftOpen size={16} />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-3">Menu</p>
        )}

        {/* ── Dashboard (Receita / Despesa) ─────────────────────────────── */}
        <NavGroup
          icon={<LayoutDashboard size={18} />}
          label="Dashboard"
          collapsed={collapsed}
          active={isDashboardActive}
          open={dashboardOpen}
          onToggle={() => setDashboardOpen(v => !v)}
        >
          <SubItem
            href="/dashboard"
            icon={<TrendingDown size={14} />}
            label="Despesa"
            active={pathname === '/dashboard'}
          />
          <SubItem
            href="/receitas"
            icon={<TrendingUp size={14} />}
            label="Receita"
            active={pathname === '/receitas'}
          />
          <SubItem
            href="/saude-15"
            icon={<ShieldCheck size={14} />}
            label="Índice Saúde 15%"
            active={pathname === '/saude-15'}
          />
          <SubItem
            href="/metas"
            icon={<Target size={14} />}
            label="Metas por Subgrupo"
            active={pathname === '/metas'}
          />
          <SubItem
            href="/contas-a-pagar"
            icon={<CreditCard size={14} />}
            label="Contas a Pagar"
            active={pathname === '/contas-a-pagar'}
          />
          <SubItem
            href="/relatorio-saude"
            icon={<ClipboardList size={14} />}
            label="Rel. Quadrimestral"
            active={pathname === '/relatorio-saude'}
          />
        </NavGroup>

        {/* ── Importação (Despesa / Receita) ────────────────────────────── */}
        <NavGroup
          icon={<Upload size={18} />}
          label="Importação"
          collapsed={collapsed}
          active={isImportacaoActive}
          open={importacaoOpen}
          onToggle={() => setImportacaoOpen(v => !v)}
        >
          <SubItem
            href="/importacao"
            icon={<TrendingDown size={14} />}
            label="Despesa"
            active={pathname === '/importacao'}
          />
          <SubItem
            href="/importacao-receita"
            icon={<TrendingUp size={14} />}
            label="Receita"
            active={pathname === '/importacao-receita'}
          />
          <SubItem
            href="/importacao-transf-bancaria"
            icon={<ArrowLeftRight size={14} />}
            label="Transf. Bancária"
            active={pathname === '/importacao-transf-bancaria'}
          />
          <SubItem
            href="/importacao-empenhos"
            icon={<Receipt size={14} />}
            label="Empenhos Liq."
            active={pathname === '/importacao-empenhos'}
          />
        </NavGroup>

        {/* ── Análise (Pagamentos / Receitas) ───────────────────────────── */}
        <NavGroup
          icon={<BarChart2 size={18} />}
          label="Análise"
          collapsed={collapsed}
          active={isAnaliseActive}
          open={analiseOpen}
          onToggle={() => setAnaliseOpen(v => !v)}
        >
          <SubItem
            href="/pagamentos"
            icon={<TrendingDown size={14} />}
            label="Despesa"
            active={pathname === '/pagamentos'}
          />
          <SubItem
            href="/receitas/listagem"
            icon={<TrendingUp size={14} />}
            label="Receita"
            active={pathname === '/receitas/listagem'}
          />
          <SubItem
            href="/analise/despesa-a-pagar"
            icon={<Receipt size={14} />}
            label="Despesa a Pagar"
            active={pathname === '/analise/despesa-a-pagar'}
          />
        </NavGroup>

        {/* ── Classificação ─────────────────────────────────────────────── */}
        <NavGroup
          icon={<Tag size={18} />}
          label="Classificação"
          collapsed={collapsed}
          active={isClassificacaoActive}
          open={classificacaoOpen}
          onToggle={() => setClassificacaoOpen(v => !v)}
        >
          {classificacaoItems.map(item => (
            <SubItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={pathname === item.href}
            />
          ))}
          <button
            onClick={() => router.push(`/cadastros/credor?conf=diarias&t=${Date.now()}`)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <CheckCircle size={14} />
            <span>Conf. Diárias</span>
          </button>
          <button
            onClick={() => router.push(`/cadastros/credor?conf=pessoal&t=${Date.now()}`)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <CheckCircle size={14} />
            <span>Conf. Pessoal</span>
          </button>
        </NavGroup>

        {/* ── Cadastros ─────────────────────────────────────────────────── */}
        <div className="pt-2">
          {!collapsed && (
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-2 mt-1">Configurações</p>
          )}

          {collapsed ? (
            cadastrosItems
              .filter(item => !item.superAdminOnly || isSuperAdmin)
              .map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={cn(
                      'flex justify-center items-center px-0 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                      active ? 'bg-white/15 text-gold-500' : 'text-white/60 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    {item.icon}
                  </Link>
                );
              })
          ) : (
            <>
              <button
                onClick={() => setCadastrosOpen(v => !v)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 w-full',
                  isCadastrosActive ? 'bg-white/15 text-white shadow-sm' : 'text-white/60 hover:bg-white/10 hover:text-white',
                )}
              >
                <span className={isCadastrosActive ? 'text-gold-500' : ''}><Layers size={18} /></span>
                <span>Cadastros</span>
                <ChevronDown size={14} className={cn('ml-auto transition-transform duration-200', cadastrosOpen ? 'rotate-180' : '')} />
              </button>
              {cadastrosOpen && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                  {cadastrosItems
                    .filter(item => !item.superAdminOnly || isSuperAdmin)
                    .map((item) => {
                      const active = pathname === item.href || pathname.startsWith(item.href + '/');
                      return (
                        <SubItem
                          key={item.href}
                          href={item.href}
                          icon={item.icon}
                          label={item.label}
                          active={active}
                        />
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>
      </nav>

      {/* Rodapé */}
      <div className="px-2 pb-4 border-t border-white/10 pt-3 space-y-1">
        <NavItem
          href="/usuarios"
          icon={<UserCog size={18} />}
          label="Usuários"
          collapsed={collapsed}
          active={pathname.startsWith('/usuarios')}
        />
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          title={collapsed ? 'Sair' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm text-white/60 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200',
            collapsed && 'justify-center px-0',
          )}
        >
          <LogOut size={18} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
