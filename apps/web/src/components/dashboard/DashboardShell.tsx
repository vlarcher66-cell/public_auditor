'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import Sidebar from './Sidebar';
import { MunicipioEntidadeProvider } from '@/contexts/MunicipioEntidadeContext';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';

const TIMEOUT_MS = 5 * 60 * 1000;   // 5 minutos
const WARNING_MS = 1 * 60 * 1000;   // aviso 1 minuto antes

// Componente interno que consome o SidebarContext
function ShellInner({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const { mobileOpen, closeMobileSidebar } = useSidebar();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doLogout = useCallback(() => {
    signOut({ callbackUrl: '/' });
  }, []);

  const resetTimers = useCallback(() => {
    if (timeoutRef.current)  clearTimeout(timeoutRef.current);
    if (warningRef.current)  clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowWarning(false);
    setCountdown(60);

    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(60);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, TIMEOUT_MS - WARNING_MS);

    timeoutRef.current = setTimeout(doLogout, TIMEOUT_MS);
  }, [doLogout]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimers, { passive: true }));
    resetTimers();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimers));
      if (timeoutRef.current)  clearTimeout(timeoutRef.current);
      if (warningRef.current)  clearTimeout(warningRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [resetTimers]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar — desktop: sempre visível; mobile: drawer overlay */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobileSidebar}
      />

      {/* Overlay escuro ao abrir sidebar no mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      <main
        className={`flex-1 min-h-screen overflow-x-auto transition-all duration-300 ${
          collapsed ? 'md:ml-[68px]' : 'md:ml-[240px]'
        }`}
      >
        {children}
      </main>

      {/* Modal de aviso de inatividade */}
      {showWarning && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '32px 36px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxWidth: '360px', width: '100%',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏱</div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F2A4E', marginBottom: '8px' }}>
              Sessão prestes a expirar
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', lineHeight: 1.5 }}>
              Por inatividade, você será desconectado em{' '}
              <strong style={{ color: countdown <= 10 ? '#ef4444' : '#0F2A4E' }}>{countdown}s</strong>.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={resetTimers}
                style={{
                  padding: '9px 22px', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
                  background: '#0F2A4E', color: '#fff', border: 'none', cursor: 'pointer',
                }}
              >
                Continuar sessão
              </button>
              <button
                onClick={doLogout}
                style={{
                  padding: '9px 22px', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
                  background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer',
                }}
              >
                Sair agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <MunicipioEntidadeProvider>
        <ShellInner>{children}</ShellInner>
      </MunicipioEntidadeProvider>
    </SidebarProvider>
  );
}
