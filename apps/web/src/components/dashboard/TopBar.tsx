'use client';

import { useSession } from 'next-auth/react';
import { Bell, ChevronDown, Building2, MapPin, Menu, CalendarCheck } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useMunicipioEntidade, Municipio, Entidade } from '@/contexts/MunicipioEntidadeContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { apiRequest } from '@/lib/api';

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

interface TopBarProps {
  title: string;
  subtitle?: string;
}

// ─── Badge de tipo de entidade ────────────────────────────────────────────────
function EntidadeTipoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    PREFEITURA: { bg: '#e0eaff', color: '#1e4d95', label: 'PREFEITURA' },
    FUNDO:      { bg: '#dcfce7', color: '#16a34a', label: 'FUNDO' },
    AUTARQUIA:  { bg: '#fef3c7', color: '#d97706', label: 'AUTARQUIA' },
  };
  const s = map[tipo] ?? { bg: '#f1f5f9', color: '#64748b', label: tipo };
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px',
      background: s.bg, color: s.color, letterSpacing: '0.04em',
    }}>
      {s.label}
    </span>
  );
}

// ─── Dropdown genérico ────────────────────────────────────────────────────────
function SeletorDropdown<T extends { id: number; nome: string }>({
  valor, opcoes, onChange, placeholder, icon, extraBadge,
}: {
  valor: T | null;
  opcoes: T[];
  onChange: (v: T) => void;
  placeholder: string;
  icon: React.ReactNode;
  extraBadge?: (item: T) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0',
          background: '#f8fafc', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
          color: '#0F2A4E', transition: 'all 0.15s', minWidth: '160px',
          boxShadow: open ? '0 0 0 3px rgba(15,42,78,0.08)' : 'none',
        }}
      >
        <span style={{ color: '#C9A84C' }}>{icon}</span>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {valor ? valor.nome : placeholder}
        </span>
        <ChevronDown size={14} style={{ color: '#94a3b8', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999,
          background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)', minWidth: '220px', overflow: 'hidden',
        }}>

          {opcoes.map(op => (
            <button
              key={op.id}
              onClick={() => { onChange(op); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: '8px',
                background: valor?.id === op.id ? '#f0f4ff' : 'transparent',
                border: 'none', cursor: 'pointer', fontSize: '13px',
                fontWeight: valor?.id === op.id ? 700 : 400,
                color: valor?.id === op.id ? '#0F2A4E' : '#374151',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <span style={{ flex: 1 }}>{op.nome}</span>
              {extraBadge?.(op)}
              {valor?.id === op.id && <span style={{ color: '#C9A84C', fontSize: '10px' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TopBar principal ─────────────────────────────────────────────────────────
export default function TopBar({ title, subtitle }: TopBarProps) {
  const { data: session } = useSession();
  const userName = session?.user?.name || 'Usuário';
  const role     = (session?.user as any)?.role as string || 'VIEWER';
  const initials = userName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();

  const { openMobileSidebar } = useSidebar();
  const [ctxOpen, setCtxOpen] = useState(false);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const {
    municipios, entidades,
    municipioSelecionado, entidadeSelecionada,
    setMunicipioSelecionado, setEntidadeSelecionada,
    podeEscolherMunicipio, podeEscolherEntidade,
    loading,
  } = useMunicipioEntidade();

  const [mesFechado, setMesFechado] = useState<number>(0);
  const token = (session as any)?.accessToken as string | undefined;

  useEffect(() => {
    if (!token || !entidadeSelecionada) return;
    const ano = new Date().getFullYear();
    const params: Record<string, string> = { ano: String(ano) };
    if (entidadeSelecionada?.id) params.entidadeId = String(entidadeSelecionada.id);
    apiRequest<{ porMes: { mes: number; total: number }[] }>('/pagamentos/summary', { token, params })
      .then(data => {
        const ult = (data?.porMes ?? [])
          .filter((m: any) => Number(m.total) > 0)
          .reduce((max: number, m: any) => Math.max(max, Number(m.mes)), 0);
        setMesFechado(ult);
      })
      .catch(() => {});
  }, [token, entidadeSelecionada]); // eslint-disable-line

  return (
    <header style={{
      height: '64px', background: '#fff', borderBottom: '1px solid #f1f5f9',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 12px', position: 'sticky', top: 0, zIndex: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Lado esquerdo: hamburger (mobile) + título */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Hamburger — visível apenas em mobile */}
        <button
          onClick={openMobileSidebar}
          className="md:hidden"
          style={{
            padding: '8px', color: '#0F2A4E', background: 'none',
            border: 'none', cursor: 'pointer', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#0F2A4E', margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{subtitle}</p>}
        </div>
      </div>

      {/* Seletores de contexto — ocultos em mobile */}
      {!loading && (
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: '8px' }}>

          {/* Município — só SUPER_ADMIN vê o dropdown */}
          {podeEscolherMunicipio ? (
            <SeletorDropdown<Municipio>
              valor={municipioSelecionado}
              opcoes={municipios}
              onChange={setMunicipioSelecionado}
              placeholder="Selecione o município"
              icon={<MapPin size={14} />}
            />
          ) : municipioSelecionado ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '10px',
              background: '#f8fafc', border: '1.5px solid #e2e8f0',
              fontSize: '13px', fontWeight: 600, color: '#0F2A4E',
            }}>
              <MapPin size={14} style={{ color: '#C9A84C' }} />
              {municipioSelecionado.nome}
            </div>
          ) : null}

          {/* Separador */}
          {municipioSelecionado && <span style={{ color: '#e2e8f0', fontSize: '18px' }}>›</span>}

          {/* Entidade — SUPER_ADMIN e GESTOR veem dropdown */}
          {podeEscolherEntidade ? (
            <SeletorDropdown<Entidade>
              valor={entidadeSelecionada}
              opcoes={entidades}
              onChange={setEntidadeSelecionada}
              placeholder="Selecione a entidade"
              icon={<Building2 size={14} />}
              extraBadge={(e) => <EntidadeTipoBadge tipo={e.tipo} />}
            />
          ) : entidadeSelecionada ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '10px',
              background: '#f8fafc', border: '1.5px solid #e2e8f0',
              fontSize: '13px', fontWeight: 600, color: '#0F2A4E',
            }}>
              <Building2 size={14} style={{ color: '#C9A84C' }} />
              {entidadeSelecionada.nome}
              <EntidadeTipoBadge tipo={entidadeSelecionada.tipo} />
            </div>
          ) : null}
          {/* Badge mês fechado */}
          {mesFechado > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '10px',
              background: '#f8fafc', border: '1.5px solid #e2e8f0',
              fontSize: '13px', fontWeight: 600, color: '#0F2A4E',
              whiteSpace: 'nowrap',
            }}>
              <CalendarCheck size={14} style={{ color: '#C9A84C' }} />
              Fechado até {MESES_ABREV[mesFechado - 1]}/{new Date().getFullYear()}
            </div>
          )}
        </div>
      )}

      {/* Usuário */}
      <div ref={ctxRef} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Botão de contexto — visível apenas no mobile */}
        {!loading && (
          <button
            onClick={() => setCtxOpen(v => !v)}
            className="md:hidden"
            style={{
              padding: '7px', color: ctxOpen ? '#0F2A4E' : '#9ca3af',
              background: ctxOpen ? '#f0f4ff' : 'none',
              border: '1.5px solid ' + (ctxOpen ? '#c7d7f8' : 'transparent'),
              cursor: 'pointer', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Building2 size={18} />
          </button>
        )}

        <button style={{
          position: 'relative', padding: '8px', color: '#9ca3af',
          background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px',
        }}>
          <Bell size={18} />
        </button>

        {/* Painel de contexto mobile */}
        {ctxOpen && !loading && (
          <div className="md:hidden fixed top-[64px] left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-lg p-4 flex flex-col gap-3">
            {/* Município */}
            {podeEscolherMunicipio ? (
              <SeletorDropdown<Municipio>
                valor={municipioSelecionado}
                opcoes={municipios}
                onChange={setMunicipioSelecionado}
                placeholder="Selecione o município"
                icon={<MapPin size={14} />}
              />
            ) : municipioSelecionado ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '10px',
                background: '#f8fafc', border: '1.5px solid #e2e8f0',
                fontSize: '13px', fontWeight: 600, color: '#0F2A4E',
              }}>
                <MapPin size={14} style={{ color: '#C9A84C' }} />
                {municipioSelecionado.nome}
              </div>
            ) : null}

            {/* Entidade */}
            {podeEscolherEntidade ? (
              <SeletorDropdown<Entidade>
                valor={entidadeSelecionada}
                opcoes={entidades}
                onChange={setEntidadeSelecionada}
                placeholder="Selecione a entidade"
                icon={<Building2 size={14} />}
                extraBadge={(e) => <EntidadeTipoBadge tipo={e.tipo} />}
              />
            ) : entidadeSelecionada ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '10px',
                background: '#f8fafc', border: '1.5px solid #e2e8f0',
                fontSize: '13px', fontWeight: 600, color: '#0F2A4E',
              }}>
                <Building2 size={14} style={{ color: '#C9A84C' }} />
                {entidadeSelecionada.nome}
                <EntidadeTipoBadge tipo={entidadeSelecionada.tipo} />
              </div>
            ) : null}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '16px', borderLeft: '1px solid #f1f5f9' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: '#0F2A4E', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700, color: '#C9A84C',
          }}>
            {initials}
          </div>
          <div className="hidden md:block">
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{userName}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{role}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
