'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import {
  LayoutDashboard, Upload, FileText, LogOut, ChevronRight,
  Building2, Layers, Tag, ChevronDown, UserCog, PanelLeftClose, PanelLeftOpen, Grip, Landmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { href: '/importacao', icon: <Upload size={18} />, label: 'Importação' },
  { href: '/pagamentos', icon: <FileText size={18} />, label: 'Pagamentos' },
  { href: '/cadastros/credor', icon: <Tag size={18} />, label: 'Classificação' },
];

const cadastrosItems = [
  { href: '/cadastros/entidade', icon: <Building2 size={16} />, label: 'Cad. Entidade' },
  { href: '/cadastros/secretaria', icon: <Landmark size={16} />, label: 'Cad. Secretaria' },
  { href: '/cadastros/bloco', icon: <Grip size={16} />, label: 'Cad. Bloco' },
  { href: '/cadastros/setor', icon: <Building2 size={16} />, label: 'Cad. Setor' },
  { href: '/cadastros/grupo', icon: <Layers size={16} />, label: 'Cad. Grupo' },
  { href: '/cadastros/subgrupo', icon: <Tag size={16} />, label: 'Cad. Subgrupo' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const cadastrosActive = pathname.startsWith('/cadastros');
  const [cadastrosOpen, setCadastrosOpen] = useState(cadastrosActive);

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

      {/* Botão expandir (só aparece colapsado) */}
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
      <nav className="flex-1 px-2 py-4 space-y-1">
        {!collapsed && (
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-3">Menu</p>
        )}

        {navItems.slice(0, 3).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                collapsed && 'justify-center px-0',
                active ? 'bg-white/15 text-white shadow-sm' : 'text-white/60 hover:bg-white/10 hover:text-white',
              )}
            >
              <span className={active ? 'text-gold-500' : ''}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && active && <ChevronRight size={14} className="ml-auto text-gold-500" />}
            </Link>
          );
        })}

        {/* Classificação */}
        <Link
          href="/cadastros/credor"
          title={collapsed ? 'Classificação' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
            collapsed && 'justify-center px-0',
            (pathname === '/cadastros/credor' || pathname.startsWith('/cadastros/credor/')) ? 'bg-white/15 text-white shadow-sm' : 'text-white/60 hover:bg-white/10 hover:text-white',
          )}
        >
          <span className={(pathname === '/cadastros/credor' || pathname.startsWith('/cadastros/credor/')) ? 'text-gold-500' : ''}><Tag size={18} /></span>
          {!collapsed && <span>Classificação</span>}
          {!collapsed && (pathname === '/cadastros/credor' || pathname.startsWith('/cadastros/credor/')) && <ChevronRight size={14} className="ml-auto text-gold-500" />}
        </Link>

        {/* Cadastros section */}
        <div className="pt-2">
          {!collapsed && (
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-3 mt-2">Cadastros</p>
          )}

          {collapsed ? (
            // No modo colapsado mostra os itens de cadastro direto com ícone
            cadastrosItems.map((item) => {
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
                onClick={() => setCadastrosOpen((v) => !v)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 w-full',
                  cadastrosActive ? 'bg-white/15 text-white shadow-sm' : 'text-white/60 hover:bg-white/10 hover:text-white',
                )}
              >
                <span className={cadastrosActive ? 'text-gold-500' : ''}><Layers size={18} /></span>
                <span>Cadastros</span>
                <ChevronDown
                  size={14}
                  className={cn('ml-auto transition-transform duration-200', cadastrosOpen ? 'rotate-180' : '')}
                />
              </button>
              {cadastrosOpen && (
                <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
                  {cadastrosItems.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                          active ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white',
                        )}
                      >
                        <span className={active ? 'text-gold-500' : ''}>{item.icon}</span>
                        <span>{item.label}</span>
                        {active && <ChevronRight size={12} className="ml-auto text-gold-500" />}
                      </Link>
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
        <Link
          href="/usuarios"
          title={collapsed ? 'Usuários' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
            collapsed && 'justify-center px-0',
            pathname.startsWith('/usuarios') ? 'bg-white/15 text-white shadow-sm' : 'text-white/60 hover:bg-white/10 hover:text-white',
          )}
        >
          <span className={pathname.startsWith('/usuarios') ? 'text-gold-500' : ''}><UserCog size={18} /></span>
          {!collapsed && <span>Usuários</span>}
          {!collapsed && pathname.startsWith('/usuarios') && <ChevronRight size={14} className="ml-auto text-gold-500" />}
        </Link>
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
