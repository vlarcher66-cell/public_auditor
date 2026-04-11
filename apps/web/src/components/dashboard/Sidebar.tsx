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
  mobileOpen?: boolean;
  onMobileClose?: () => void;
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
  href, icon, label, collapsed, active, onNavigate,
}: {
  href: string; icon: React.ReactNode; label: string; collapsed: boolean; active: boolean; onNavigate?: () => void;
}) {
  const content = (
    <Link
      href={href}
      onClick={onNavigate}
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
            : open
            ? 'text-white/70 border border-transparent'
            : 'text-white/50 hover:bg-white/8 hover:text-white/90 border border-transparent',
        )}
      >
        <span className={cn('transition-colors duration-200', active ? 'text-gold-400' : 'group-hover:text-white/80')}>
          {icon}
        </span>
        <span>{label}</span>
        <ChevronDown
          size={13}
          className={cn('ml-auto transition-transform duration-300 opacity-50', open ? 'rotate-180' : '')}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="ml-3 mb-1 mt-0.5 space-y-0.5 border-l-2 border-gold-500/70 pl-3">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-item ─────────────────────────────────────────────────────────────────

function SubItem({
  href, icon, label, active, groupOpen, onNavigate,
}: {
  href: string; icon: React.ReactNode; label: string; active: boolean; groupOpen?: boolean; onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'group flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150',
        active
          ? 'bg-white/10 text-white'
          : 'text-white/45 hover:bg-white/6 hover:text-white/80',
      )}
    >
      <span className={cn('transition-colors', active ? 'text-gold-400' : groupOpen ? 'text-gold-500/50 group-hover:text-gold-400/80' : 'text-white/30 group-hover:text-white/60')}>
        {icon}
      </span>
      <span className={cn('transition-colors', active ? '' : groupOpen ? 'text-gold-500/50 group-hover:text-gold-400/80' : '')}>{label}</span>
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

export default function Sidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session as any)?.user?.role ?? '';
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isGestor = role === 'GESTOR';
  const userName = (session as any)?.user?.name ?? '';
  const permissoes: string[] = (session as any)?.user?.permissoes ?? [];

  // SUPER_ADMIN, ADMIN e GESTOR têm acesso total; outros dependem das permissões
  const fullAccess = isSuperAdmin || isGestor;
  function hasPerm(key: string) { return fullAccess || permissoes.includes(key); }

  const isImportacaoActive = pathname === '/importacao' || pathname === '/importacao-receita' || pathname === '/importacao-transf-bancaria' || pathname === '/importacao-empenhos' || pathname === '/importacao-resumo-bancario';
  const isAnaliseActive = pathname === '/pagamentos' || pathname === '/receitas/listagem' || pathname === '/analise/despesa-a-pagar' || pathname === '/analise/resumo-bancario';
  const isCadastrosActive = pathname.startsWith('/cadastros');
  const isClassificacaoActive = pathname === '/cadastros/credor' || pathname.startsWith('/cadastros/credor/') || pathname === '/analise/credores-a-pagar';

  const defaultOpen = isImportacaoActive ? 'importacao'
    : isAnaliseActive ? 'analise'
    : isCadastrosActive ? 'cadastros'
    : isClassificacaoActive ? 'classificacao'
    : null;
  const [openGroup, setOpenGroup] = useState<string | null>(defaultOpen);

  // No mobile o drawer sempre mostra expandido, independente do estado collapsed do desktop
  const effectiveCollapsed = mobileOpen ? false : collapsed;
  // Fecha o drawer ao navegar no mobile
  const handleNav = mobileOpen ? onMobileClose : undefined;

  function toggleGroup(name: string) {
    setOpenGroup(prev => prev === name ? null : name);
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-screen fixed left-0 top-0 z-50 transition-all duration-300 w-[240px]',
        // Desktop: sempre visível, largura baseada em collapsed
        collapsed ? 'md:w-[68px]' : 'md:w-[240px]',
        // Mobile: drawer — fora da tela por padrão, desliza quando mobileOpen
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}
      style={{
        background: 'linear-gradient(180deg, #0c2240 0%, #0F2A4E 40%, #0a1e38 100%)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.35), inset -1px 0 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className={cn(
        'flex items-center border-b border-white/8 flex-shrink-0',
        collapsed && !mobileOpen ? 'justify-center py-4 px-0' : 'gap-3 px-4 py-4',
      )}>
        {/* Logo mark */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md"
          style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #e8c84a 100%)' }}
        >
          <Building2 size={15} className="text-navy-900" />
        </div>

        {(!collapsed || mobileOpen) && (
          <>
            <div className="flex-1 overflow-hidden">
              <div className="font-bold text-[13px] text-white leading-tight tracking-tight">GestorPublico</div>
              <div className="text-[10px] text-white/35 tracking-wide">Gestão Municipal</div>
            </div>
            {/* Mobile: botão fechar; Desktop: botão recolher */}
            <button
              onClick={mobileOpen ? onMobileClose : onToggle}
              title={mobileOpen ? 'Fechar menu' : 'Recolher menu'}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-white/25 hover:text-white/70 hover:bg-white/8 transition-all duration-150"
            >
              <PanelLeftClose size={14} />
            </button>
          </>
        )}
      </div>

      {/* Botão expandir quando colapsado (apenas desktop) */}
      {collapsed && !mobileOpen && (
        <button
          onClick={onToggle}
          title="Expandir menu"
          className="flex-shrink-0 flex justify-center py-2.5 text-white/25 hover:text-white/60 transition-colors border-b border-white/8 md:flex hidden"
        >
          <PanelLeftOpen size={14} />
        </button>
      )}

      {/* ── Navegação ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden space-y-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

        <SectionLabel label="Principal" collapsed={effectiveCollapsed} />

        {hasPerm('menu.dashboard') && <NavItem href="/dashboard-geral" icon={<LayoutDashboard size={16} />} label="Dashboard" collapsed={effectiveCollapsed} active={pathname === '/dashboard-geral'} onNavigate={handleNav} />}
        {hasPerm('menu.despesa') && <NavItem href="/despesa" icon={<TrendingDown size={16} />} label="Despesa" collapsed={effectiveCollapsed} active={pathname === '/despesa'} onNavigate={handleNav} />}
        {hasPerm('menu.receita') && <NavItem href="/receitas" icon={<TrendingUp size={16} />} label="Receita" collapsed={effectiveCollapsed} active={pathname === '/receitas'} onNavigate={handleNav} />}
        {hasPerm('menu.saude15') && <NavItem href="/saude-15" icon={<ShieldCheck size={16} />} label="Índice Saúde 15%" collapsed={effectiveCollapsed} active={pathname === '/saude-15'} onNavigate={handleNav} />}
        {hasPerm('menu.metas') && <NavItem href="/metas" icon={<Target size={16} />} label="Meta Despesa" collapsed={effectiveCollapsed} active={pathname === '/metas'} onNavigate={handleNav} />}
        {hasPerm('menu.contas_pagar') && <NavItem href="/contas-a-pagar" icon={<CreditCard size={16} />} label="Contas a Pagar" collapsed={effectiveCollapsed} active={pathname === '/contas-a-pagar'} onNavigate={handleNav} />}
        {hasPerm('menu.rel_quadrimestral') && <NavItem href="/relatorio-saude" icon={<ClipboardList size={16} />} label="Rel. Quadrimestral" collapsed={effectiveCollapsed} active={pathname === '/relatorio-saude'} onNavigate={handleNav} />}

        {/* Operacional — só mostra se tiver pelo menos uma permissão */}
        {(hasPerm('analise.despesa') || hasPerm('analise.receita') || hasPerm('importacao.despesa') || hasPerm('importacao.receita') || hasPerm('classificacao.credores') || hasPerm('classificacao.setores')) && (
          <SectionLabel label="Operacional" collapsed={effectiveCollapsed} />
        )}

        {/* Análise */}
        {(hasPerm('analise.despesa') || hasPerm('analise.receita')) && (
          <NavGroup
            icon={<BarChart2 size={16} />}
            label="Análise"
            collapsed={effectiveCollapsed}
            active={isAnaliseActive}
            open={openGroup === 'analise'}
            onToggle={() => toggleGroup('analise')}
          >
            {hasPerm('analise.despesa') && <SubItem href="/pagamentos" icon={<TrendingDown size={13} />} label="Despesa" active={pathname === '/pagamentos'} groupOpen={openGroup === 'analise'} onNavigate={handleNav} />}
            {hasPerm('analise.receita') && <SubItem href="/receitas/listagem" icon={<TrendingUp size={13} />} label="Receita" active={pathname === '/receitas/listagem'} groupOpen={openGroup === 'analise'} onNavigate={handleNav} />}
            {hasPerm('analise.despesa') && <SubItem href="/analise/despesa-a-pagar" icon={<Receipt size={13} />} label="Despesa a Pagar" active={pathname === '/analise/despesa-a-pagar'} groupOpen={openGroup === 'analise'} onNavigate={handleNav} />}
            {hasPerm('analise.despesa') && <SubItem href="/analise/resumo-bancario" icon={<Landmark size={13} />} label="Resumo Bancário" active={pathname === '/analise/resumo-bancario'} groupOpen={openGroup === 'analise'} onNavigate={handleNav} />}
          </NavGroup>
        )}

        {/* Importação */}
        {(hasPerm('importacao.despesa') || hasPerm('importacao.receita')) && (
          <NavGroup
            icon={<Upload size={16} />}
            label="Importação"
            collapsed={effectiveCollapsed}
            active={isImportacaoActive}
            open={openGroup === 'importacao'}
            onToggle={() => toggleGroup('importacao')}
          >
            {hasPerm('importacao.despesa') && <SubItem href="/importacao" icon={<TrendingDown size={13} />} label="Despesa" active={pathname === '/importacao'} groupOpen={openGroup === 'importacao'} onNavigate={handleNav} />}
            {hasPerm('importacao.receita') && <SubItem href="/importacao-receita" icon={<TrendingUp size={13} />} label="Receita" active={pathname === '/importacao-receita'} groupOpen={openGroup === 'importacao'} onNavigate={handleNav} />}
            {hasPerm('importacao.despesa') && <SubItem href="/importacao-transf-bancaria" icon={<ArrowLeftRight size={13} />} label="Transf. Bancária" active={pathname === '/importacao-transf-bancaria'} groupOpen={openGroup === 'importacao'} onNavigate={handleNav} />}
            {hasPerm('importacao.despesa') && <SubItem href="/importacao-empenhos" icon={<Receipt size={13} />} label="Empenhos Liq." active={pathname === '/importacao-empenhos'} groupOpen={openGroup === 'importacao'} onNavigate={handleNav} />}
            {hasPerm('importacao.despesa') && <SubItem href="/importacao-resumo-bancario" icon={<Landmark size={13} />} label="Resumo Bancário" active={pathname === '/importacao-resumo-bancario'} groupOpen={openGroup === 'importacao'} onNavigate={handleNav} />}
          </NavGroup>
        )}

        {/* Classificação */}
        {(hasPerm('classificacao.credores') || hasPerm('classificacao.setores')) && (
          <NavGroup
            icon={<Tag size={16} />}
            label="Classificação"
            collapsed={effectiveCollapsed}
            active={isClassificacaoActive}
            open={openGroup === 'classificacao'}
            onToggle={() => toggleGroup('classificacao')}
          >
            {hasPerm('classificacao.credores') && classificacaoItems.map(item => (
              <SubItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={pathname === item.href} groupOpen={openGroup === 'classificacao'} onNavigate={handleNav} />
            ))}
            {hasPerm('classificacao.credores') && (
              <SubItem href="/analise/credores-a-pagar" icon={<Tag size={13} />} label="Credores a Pagar" active={pathname === '/analise/credores-a-pagar'} groupOpen={openGroup === 'classificacao'} onNavigate={handleNav} />
            )}
            {hasPerm('classificacao.credores') && (
              <button
                onClick={() => router.push(`/cadastros/credor?conf=diarias&t=${Date.now()}`)}
                className="group flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium w-full text-white/45 hover:bg-white/6 hover:text-white/80 transition-all duration-150"
              >
                <CheckCircle size={13} className="text-white/30 group-hover:text-white/60 transition-colors" />
                <span>Conf. Diárias</span>
              </button>
            )}
            {hasPerm('classificacao.credores') && (
              <button
                onClick={() => router.push(`/cadastros/credor?conf=pessoal&t=${Date.now()}`)}
                className="group flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium w-full text-white/45 hover:bg-white/6 hover:text-white/80 transition-all duration-150"
              >
                <CheckCircle size={13} className="text-white/30 group-hover:text-white/60 transition-colors" />
                <span>Conf. Pessoal</span>
              </button>
            )}
          </NavGroup>
        )}

        {(hasPerm('cadastros.municipio') || hasPerm('cadastros.entidade') || hasPerm('cadastros.usuarios')) && (
          <SectionLabel label="Configurações" collapsed={effectiveCollapsed} />
        )}

        {/* Cadastros — filtra por permissão */}
        {(hasPerm('cadastros.municipio') || hasPerm('cadastros.entidade')) && (() => {
          const visibleItems = cadastrosItems.filter(item => {
            if (item.superAdminOnly && !isSuperAdmin) return false;
            if (item.href === '/cadastros/municipio') return hasPerm('cadastros.municipio');
            return hasPerm('cadastros.entidade');
          });
          if (visibleItems.length === 0) return null;
          return effectiveCollapsed ? (
            visibleItems.map((item) => {
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
                onClick={() => toggleGroup('cadastros')}
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
                  className={cn('ml-auto transition-transform duration-300 opacity-50', openGroup === 'cadastros' ? 'rotate-180 opacity-80' : '')}
                />
              </button>
              <div
                className={cn(
                  'overflow-hidden transition-all duration-300 ease-in-out',
                  openGroup === 'cadastros' ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
                )}
              >
                <div className="ml-3 mt-1 mb-1 space-y-0.5 border-l border-white/8 pl-3">
                  {visibleItems.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <SubItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={active} groupOpen={openGroup === 'cadastros'} onNavigate={handleNav} />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Usuários — dentro do nav, junto com Configurações */}
        {hasPerm('cadastros.usuarios') && (
          <NavItem
            href="/usuarios"
            icon={<UserCog size={16} />}
            label="Usuários"
            collapsed={effectiveCollapsed}
            active={pathname.startsWith('/usuarios')}
          onNavigate={handleNav}
          />
        )}

      </nav>

      {/* ── Rodapé — só botão Sair ────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-white/8 px-2 py-2" style={{ background: 'linear-gradient(180deg, #0F2A4E 0%, #0a1e38 100%)' }}>
        {effectiveCollapsed ? (
          <CollapsedTooltip label="Sair">
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex justify-center items-center w-10 mx-auto py-2 rounded-xl text-white/35 hover:bg-red-500/15 hover:text-red-400 transition-all duration-200 border border-transparent"
            >
              <LogOut size={16} />
            </button>
          </CollapsedTooltip>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="group flex items-center gap-3 px-3 py-2 w-full rounded-xl text-sm text-white/40 hover:bg-red-500/12 hover:text-red-400 transition-all duration-200 border border-transparent hover:border-red-500/15"
          >
            <LogOut size={16} className="group-hover:text-red-400 transition-colors" />
            <span>Sair</span>
          </button>
        )}
      </div>
    </aside>
  );
}
