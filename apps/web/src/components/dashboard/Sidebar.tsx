'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, Upload, FileText, LogOut, ChevronRight,
  Building2, Layers, Tag, ChevronDown, UserCog, PanelLeftClose, PanelLeftOpen, Grip, Landmark, CheckCircle, TrendingUp, TrendingDown, BarChart2, ArrowLeftRight, ShieldCheck, Target, Receipt, CreditCard, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Estrutura do menu ────────────────────────────────────────────────────────

const cadastrosItems = [
  { href: '/cadastros/municipio', icon: <Landmark size={15} />, label: 'Cad. Município', superAdminOnly: true },
  { href: '/cadastros/entidade', icon: <Building2 size={15} />, label: 'Cad. Entidade' },
  { href: '/cadastros/secretaria', icon: <Landmark size={15} />, label: 'Cad. Secretaria' },
  { href: '/cadastros/bloco', icon: <Grip size={15} />, label: 'Cad. Bloco' },
  { href: '/cadastros/setor', icon: <Building2 size={15} />, label: 'Cad. Setor' },
  { href: '/cadastros/grupo', icon: <Layers size={15} />, label: 'Cad. Grupo' },
  { href: '/cadastros/subgrupo', icon: <Tag size={15} />, label: 'Cad. Subgrupo' },
];

const classificacaoItems = [
  { href: '/cadastros/credor', icon: <Tag size={13} />, label: 'Credores' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

// ─── Tooltip para modo colapsado ──────────────────────────────────────────────

function CollapsedTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => {
        if (ref.current) setTop(ref.current.getBoundingClientRect().top + ref.current.offsetHeight / 2);
        setVisible(true);
      }}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ top: top - 14, left: 68 }}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-gold-500 rounded-full opacity-80" />
            <span className="bg-navy-900 border border-white/10 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
              {label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Item simples ─────────────────────────────────────────────────────────────

function NavItem({
  href, icon, label, collapsed, active,
}: {
  href: string; icon: React.ReactNode; label: string; collapsed: boolean; active: boolean;
}) {
  const content = (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
        collapsed && 'justify-center px-0 w-10 mx-auto',
        active
          ? 'bg-gradient-to-r from-gold-500/20 to-gold-500/5 text-white border border-gold-500/20'
          : 'text-white/50 hover:bg-white/8 hover:text-white/90 border border-transparent',
      )}
    >
      <span className={cn('transition-colors duration-200', active ? 'text-gold-400' : 'group-hover:text-white/80')}>
        {icon}
      </span>
      {!collapsed && <span>{label}</span>}
      {!collapsed && active && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gold-400 shadow-[0_0_6px_rgba(201,168,76,0.6)]" />
      )}
    </Link>
  );

  if (collapsed) return <CollapsedTooltip label={label}>{content}</CollapsedTooltip>;
  return content;
}

// ─── Grupo expansível ─────────────────────────────────────────────────────────

function NavGroup({
  icon, label, collapsed, active, open, onToggle, children,
}: {
  icon: React.ReactNode; label: string; collapsed: boolean;
  active: boolean; open: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  if (collapsed) {
    return (
      <CollapsedTooltip label={label}>
        <button
          onClick={onToggle}
          className={cn(
            'flex justify-center items-center w-10 mx-auto py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
            active
              ? 'bg-gradient-to-r from-gold-500/20 to-gold-500/5 text-gold-400 border border-gold-500/20'
              : 'text-white/50 hover:bg-white/8 hover:text-white/90 border border-transparent',
          )}
        >
          {icon}
        </button>
      </CollapsedTooltip>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 w-full',
          active
            ? 'bg-gradient-to-r from-gold-500/20 to-gold-500/5 text-white border border-gold-500/20'
            : 'text-white/50 hover:bg-white/8 hover:text-white/90 border border-transparent',
        )}
      >
        <span className={cn('transition-colors duration-200', active ? 'text-gold-400' : 'group-hover:text-white/80')}>
          {icon}
        </span>
        <span>{label}</span>
        <ChevronDown
          size={13}
          className={cn('ml-auto transition-transform duration-300 opacity-50', open ? 'rotate-180 opacity-80' : '')}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="ml-3 mt-1 mb-1 space-y-0.5 border-l border-white/8 pl-3">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-item ─────────────────────────────────────────────────────────────────

function SubItem({
  href, icon, label, active,
}: {
  href: string; icon: React.ReactNode; label: string; active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150',
        active
          ? 'bg-white/10 text-white'
          : 'text-white/45 hover:bg-white/6 hover:text-white/80',
      )}
    >
      <span className={cn('transition-colors', active ? 'text-gold-400' : 'text-white/30 group-hover:text-white/60')}>
        {icon}
      </span>
      <span>{label}</span>
      {active && <span className="ml-auto w-1 h-1 rounded-full bg-gold-400 opacity-80" />}
    </Link>
  );
}

// ─── Separador de seção ───────────────────────────────────────────────────────

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="mx-auto w-6 h-px bg-white/10 my-2" />;
  }
  return (
    <div className="flex items-center gap-2 px-3 mb-2 mt-4">
      <span className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.12em]">{label}</span>
      <div className="flex-1 h-px bg-white/8" />
    </div>
  );
}

// ─── Sidebar principal ────────────────────────────────────────────────────────

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session as any)?.user?.role ?? '';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const userName = (session as any)?.user?.name ?? '';

  const isImportacaoActive = pathname === '/importacao' || pathname === '/importacao-receita' || pathname === '/importacao-transf-bancaria' || pathname === '/importacao-empenhos';
  const isAnaliseActive = pathname === '/pagamentos' || pathname === '/receitas/listagem' || pathname === '/analise/despesa-a-pagar';
  const isCadastrosActive = pathname.startsWith('/cadastros');
  const isClassificacaoActive = pathname === '/cadastros/credor' || pathname.startsWith('/cadastros/credor/');

  const [importacaoOpen, setImportacaoOpen] = useState(isImportacaoActive);
  const [analiseOpen, setAnaliseOpen] = useState(isAnaliseActive);
  const [cadastrosOpen, setCadastrosOpen] = useState(isCadastrosActive);
  const [classificacaoOpen, setClassificacaoOpen] = useState(isClassificacaoActive);

  return (
    <aside
      className={cn(
        'flex flex-col min-h-screen fixed left-0 top-0 z-30 transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[240px]',
      )}
      style={{
        background: 'linear-gradient(180deg, #0c2240 0%, #0F2A4E 40%, #0a1e38 100%)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.35), inset -1px 0 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className={cn(
        'flex items-center border-b border-white/8 flex-shrink-0',
        collapsed ? 'justify-center py-4 px-0' : 'gap-3 px-4 py-4',
      )}>
        {/* Logo mark */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md"
          style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #e8c84a 100%)' }}
        >
          <Building2 size={15} className="text-navy-900" />
        </div>

        {!collapsed && (
          <>
            <div className="flex-1 overflow-hidden">
              <div className="font-bold text-[13px] text-white leading-tight tracking-tight">GestorPublico</div>
              <div className="text-[10px] text-white/35 tracking-wide">Gestão Municipal</div>
            </div>
            <button
              onClick={onToggle}
              title="Recolher menu"
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-white/25 hover:text-white/70 hover:bg-white/8 transition-all duration-150"
            >
              <PanelLeftClose size={14} />
            </button>
          </>
        )}
      </div>

      {/* Botão expandir quando colapsado */}
      {collapsed && (
        <button
          onClick={onToggle}
          title="Expandir menu"
          className="flex justify-center py-2.5 text-white/25 hover:text-white/60 transition-colors border-b border-white/8"
        >
          <PanelLeftOpen size={14} />
        </button>
      )}

      {/* ── Navegação ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden space-y-0.5 scrollbar-thin">

        <SectionLabel label="Principal" collapsed={collapsed} />

        <NavItem href="/dashboard-geral" icon={<LayoutDashboard size={16} />} label="Dashboard" collapsed={collapsed} active={pathname === '/dashboard-geral'} />
        <NavItem href="/despesa" icon={<TrendingDown size={16} />} label="Despesa" collapsed={collapsed} active={pathname === '/despesa'} />
        <NavItem href="/receitas" icon={<TrendingUp size={16} />} label="Receita" collapsed={collapsed} active={pathname === '/receitas'} />
        <NavItem href="/saude-15" icon={<ShieldCheck size={16} />} label="Índice Saúde 15%" collapsed={collapsed} active={pathname === '/saude-15'} />
        <NavItem href="/metas" icon={<Target size={16} />} label="Metas por Subgrupo" collapsed={collapsed} active={pathname === '/metas'} />
        <NavItem href="/contas-a-pagar" icon={<CreditCard size={16} />} label="Contas a Pagar" collapsed={collapsed} active={pathname === '/contas-a-pagar'} />
        <NavItem href="/relatorio-saude" icon={<ClipboardList size={16} />} label="Rel. Quadrimestral" collapsed={collapsed} active={pathname === '/relatorio-saude'} />

        <SectionLabel label="Operacional" collapsed={collapsed} />

        {/* Análise */}
        <NavGroup
          icon={<BarChart2 size={16} />}
          label="Análise"
          collapsed={collapsed}
          active={isAnaliseActive}
          open={analiseOpen}
          onToggle={() => setAnaliseOpen(v => !v)}
        >
          <SubItem href="/pagamentos" icon={<TrendingDown size={13} />} label="Despesa" active={pathname === '/pagamentos'} />
          <SubItem href="/receitas/listagem" icon={<TrendingUp size={13} />} label="Receita" active={pathname === '/receitas/listagem'} />
          <SubItem href="/analise/despesa-a-pagar" icon={<Receipt size={13} />} label="Despesa a Pagar" active={pathname === '/analise/despesa-a-pagar'} />
        </NavGroup>

        {/* Importação */}
        <NavGroup
          icon={<Upload size={16} />}
          label="Importação"
          collapsed={collapsed}
          active={isImportacaoActive}
          open={importacaoOpen}
          onToggle={() => setImportacaoOpen(v => !v)}
        >
          <SubItem href="/importacao" icon={<TrendingDown size={13} />} label="Despesa" active={pathname === '/importacao'} />
          <SubItem href="/importacao-receita" icon={<TrendingUp size={13} />} label="Receita" active={pathname === '/importacao-receita'} />
          <SubItem href="/importacao-transf-bancaria" icon={<ArrowLeftRight size={13} />} label="Transf. Bancária" active={pathname === '/importacao-transf-bancaria'} />
          <SubItem href="/importacao-empenhos" icon={<Receipt size={13} />} label="Empenhos Liq." active={pathname === '/importacao-empenhos'} />
        </NavGroup>

        {/* Classificação */}
        <NavGroup
          icon={<Tag size={16} />}
          label="Classificação"
          collapsed={collapsed}
          active={isClassificacaoActive}
          open={classificacaoOpen}
          onToggle={() => setClassificacaoOpen(v => !v)}
        >
          {classificacaoItems.map(item => (
            <SubItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={pathname === item.href} />
          ))}
          <button
            onClick={() => router.push(`/cadastros/credor?conf=diarias&t=${Date.now()}`)}
            className="group flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium w-full text-white/45 hover:bg-white/6 hover:text-white/80 transition-all duration-150"
          >
            <CheckCircle size={13} className="text-white/30 group-hover:text-white/60 transition-colors" />
            <span>Conf. Diárias</span>
          </button>
          <button
            onClick={() => router.push(`/cadastros/credor?conf=pessoal&t=${Date.now()}`)}
            className="group flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium w-full text-white/45 hover:bg-white/6 hover:text-white/80 transition-all duration-150"
          >
            <CheckCircle size={13} className="text-white/30 group-hover:text-white/60 transition-colors" />
            <span>Conf. Pessoal</span>
          </button>
        </NavGroup>

        <SectionLabel label="Configurações" collapsed={collapsed} />

        {/* Cadastros */}
        {collapsed ? (
          cadastrosItems
            .filter(item => !item.superAdminOnly || isSuperAdmin)
            .map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <CollapsedTooltip key={item.href} label={item.label}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex justify-center items-center w-10 mx-auto py-2.5 rounded-xl transition-all duration-200',
                      active
                        ? 'bg-gradient-to-r from-gold-500/20 to-gold-500/5 text-gold-400 border border-gold-500/20'
                        : 'text-white/45 hover:bg-white/8 hover:text-white/80 border border-transparent',
                    )}
                  >
                    {item.icon}
                  </Link>
                </CollapsedTooltip>
              );
            })
        ) : (
          <div>
            <button
              onClick={() => setCadastrosOpen(v => !v)}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 w-full',
                isCadastrosActive
                  ? 'bg-gradient-to-r from-gold-500/20 to-gold-500/5 text-white border border-gold-500/20'
                  : 'text-white/50 hover:bg-white/8 hover:text-white/90 border border-transparent',
              )}
            >
              <span className={cn('transition-colors', isCadastrosActive ? 'text-gold-400' : 'group-hover:text-white/80')}>
                <Layers size={16} />
              </span>
              <span>Cadastros</span>
              <ChevronDown
                size={13}
                className={cn('ml-auto transition-transform duration-300 opacity-50', cadastrosOpen ? 'rotate-180 opacity-80' : '')}
              />
            </button>
            <div
              className={cn(
                'overflow-hidden transition-all duration-300 ease-in-out',
                cadastrosOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
              )}
            >
              <div className="ml-3 mt-1 mb-1 space-y-0.5 border-l border-white/8 pl-3">
                {cadastrosItems
                  .filter(item => !item.superAdminOnly || isSuperAdmin)
                  .map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <SubItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={active} />
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── Rodapé ────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-white/8 px-2 py-3 space-y-0.5">
        <NavItem
          href="/usuarios"
          icon={<UserCog size={16} />}
          label="Usuários"
          collapsed={collapsed}
          active={pathname.startsWith('/usuarios')}
        />

        {/* Sair */}
        {collapsed ? (
          <CollapsedTooltip label="Sair">
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex justify-center items-center w-10 mx-auto py-2.5 rounded-xl text-white/35 hover:bg-red-500/15 hover:text-red-400 transition-all duration-200 border border-transparent"
            >
              <LogOut size={16} />
            </button>
          </CollapsedTooltip>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="group flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm text-white/40 hover:bg-red-500/12 hover:text-red-400 transition-all duration-200 border border-transparent hover:border-red-500/15"
          >
            <LogOut size={16} className="group-hover:text-red-400 transition-colors" />
            <span>Sair</span>
          </button>
        )}
      </div>
    </aside>
  );
}
