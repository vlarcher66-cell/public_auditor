'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Shield, BarChart3, FileSearch, TrendingUp, CheckCircle2, Lock } from 'lucide-react';

function DataGrid() {
  const rows = Array.from({ length: 10 });
  const cols = Array.from({ length: 6 });
  const nums = [
    ['00065016,80','00422004,00','00022158,80','00007490,00','00145516,80','00062328,42'],
    ['00470298,83','00234159,46','00072433,50','00026229,85','00070347,45','00042130,72'],
    ['00023992,25','00157351,16','00335295,77','00643366,11','00010084,27','00185088,36'],
    ['00091247,54','00019608,91','00024695,07','00003101,91','00001280,44','00000024,00'],
    ['00079677,39','00048000,20','00002490412','00000052,00','00000008,00','00000017,00'],
    ['00065016,80','00422004,00','00022158,80','00007490,00','00145516,80','00062328,42'],
    ['00470298,83','00234159,46','00072433,50','00026229,85','00070347,45','00042130,72'],
    ['00023992,25','00157351,16','00335295,77','00643366,11','00010084,27','00185088,36'],
    ['00091247,54','00019608,91','00024695,07','00003101,91','00001280,44','00000024,00'],
    ['00079677,39','00048000,20','00002490412','00000052,00','00000008,00','00000017,00'],
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.05, pointerEvents: 'none' }}>
      {rows.map((_, r) => (
        <div key={r} className="landing-fade-row" style={{
          display: 'flex', gap: '48px', padding: '8px 24px',
          animationDelay: `${r * 0.5}s`,
          animationDuration: `${3 + (r % 3)}s`,
        }}>
          {cols.map((_, c) => (
            <span key={c} style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
              color: '#C9A84C', whiteSpace: 'nowrap', minWidth: '100px',
            }}>
              {nums[r]?.[c] ?? '00000000,00'}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Ticker() {
  const items = [
    'FOLHA DE PAGAMENTO', 'DESPESA COM PESSOAL', 'RESTOS A PAGAR',
    'EMPENHO LIQUIDADO', 'FUNDO MUNICIPAL DE SAÚDE', 'EXERCÍCIO 2025',
    'TRANSPARÊNCIA FISCAL', 'LEI DE RESPONSABILIDADE FISCAL',
    'CONTROLE INTERNO', 'AUDITORIA PÚBLICA', 'SIAFIC INTEGRADO',
    'CLASSIFICAÇÃO ORÇAMENTÁRIA',
  ];
  const text = items.join('  ·  ') + '  ·  ' + items.join('  ·  ');
  return (
    <div style={{
      borderTop: '1px solid rgba(201,168,76,0.15)',
      borderBottom: '1px solid rgba(201,168,76,0.15)',
      overflow: 'hidden', padding: '7px 0',
      background: 'rgba(201,168,76,0.03)',
    }}>
      <div className="landing-ticker" style={{
        display: 'inline-block', whiteSpace: 'nowrap',
        fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px',
        color: 'rgba(201,168,76,0.5)', letterSpacing: '0.15em',
      }}>
        {text}
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signIn('credentials', { email, senha, redirect: false });
      if (result?.error) {
        setError('Credenciais inválidas. Verifique e tente novamente.');
      } else {
        router.push('/dashboard-geral');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '6px', color: '#f1f5f9',
    fontSize: '13px', transition: 'all 0.2s',
    boxSizing: 'border-box',
    fontFamily: "'IBM Plex Sans', sans-serif",
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '9px', fontWeight: 700,
    letterSpacing: '0.14em', color: 'rgba(201,168,76,0.65)',
    textTransform: 'uppercase', marginBottom: '6px',
    fontFamily: "'IBM Plex Mono', monospace",
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Email Institucional</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="usuario@prefeitura.gov.br" required
          className="landing-input" style={inputStyle} />
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Senha de Acesso</label>
        <div style={{ position: 'relative' }}>
          <input type={showPassword ? 'text' : 'password'} value={senha}
            onChange={e => setSenha(e.target.value)}
            placeholder="••••••••••" required
            className="landing-input"
            style={{ ...inputStyle, paddingRight: '40px' }} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.3)', padding: 0, display: 'flex',
          }}>
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '6px', padding: '10px 12px', fontSize: '12px',
          color: '#fca5a5', marginBottom: '16px',
        }}>
          {error}
        </div>
      )}
      <button type="submit" disabled={loading} className="landing-btn" style={{
        width: '100%', padding: '13px', background: '#C9A84C',
        border: 'none', borderRadius: '6px',
        cursor: loading ? 'not-allowed' : 'pointer',
        color: '#0a0f1a', fontWeight: 800, fontSize: '11px',
        letterSpacing: '0.12em', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        opacity: loading ? 0.7 : 1,
        boxShadow: '0 4px 16px rgba(201,168,76,0.2)',
        fontFamily: "'IBM Plex Mono', monospace",
      }}>
        {loading
          ? <><Loader2 size={15} style={{ animation: 'landing-spin 1s linear infinite' }} /> Autenticando...</>
          : <><Lock size={14} /> Acessar Sistema</>
        }
      </button>
    </form>
  );
}

export default function HeroSection() {
  const features = [
    { icon: <FileSearch size={18} />, code: '01', title: 'Importação ETL', desc: 'Processa relatórios XLSX e PDF do SIAFIC com validação automática e detecção de inconsistências.' },
    { icon: <BarChart3 size={18} />, code: '02', title: 'Dashboards Analíticos', desc: 'Despesa sintética e analítica por grupo, subgrupo, secretaria e credor com evolução mensal.' },
    { icon: <Shield size={18} />, code: '03', title: 'Auditoria Completa', desc: 'Rastreabilidade de cada pagamento: histórico, empenho, setor, fonte de recurso e DEA/RP.' },
    { icon: <TrendingUp size={18} />, code: '04', title: 'Classificação Inteligente', desc: 'Classifica credores e despesas automaticamente por palavras-chave e regras configuráveis.' },
  ];

  const stats = [
    { value: 'R$ 2,49M', label: 'Processados/mês', sub: '+245 processos' },
    { value: '100%', label: 'Auditável', sub: 'Rastreabilidade total' },
    { value: 'ETL', label: 'Automatizado', sub: 'PDF · XLSX · SIAFIC' },
  ];

  const checks = ['LRF Conforme', 'SIAFIC Integrado', 'Dados Criptografados', 'Auditoria Completa'];

  return (
    <>
      {/* ── HERO ── */}
      <section style={{
        minHeight: '100vh', background: '#080d18', position: 'relative',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}>
        <DataGrid />

        {/* Glows */}
        <div style={{ position: 'absolute', top: '-200px', left: '-200px', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-100px', right: '-100px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(30,77,149,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Top bar */}
        <div style={{
          position: 'relative', zIndex: 10,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '14px 48px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', background: '#C9A84C', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="#0a0f1a">
                <path d="M12 2L2 7v3h20V7L12 2zM4 12v7h3v-7H4zm5 0v7h3v-7H9zm5 0v7h3v-7h-3zm5 0v7h2v-7h-2zM2 21h20v2H2v-2z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: '13px', color: '#f1f5f9', letterSpacing: '0.08em' }}>GESTORPUBLICO</div>
              <div style={{ fontSize: '9px', color: 'rgba(201,168,76,0.55)', letterSpacing: '0.15em', fontFamily: "'IBM Plex Mono', monospace" }}>SISTEMA MUNICIPAL · v1.0</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="landing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.1em' }}>SISTEMA OPERACIONAL</span>
          </div>
        </div>

        <Ticker />

        {/* Main content */}
        <div style={{ flex: 1, position: 'relative', zIndex: 10, padding: '56px 48px 72px', display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '72px', alignItems: 'center', width: '100%', maxWidth: '1200px', margin: '0 auto', flexWrap: 'wrap' }}>

            {/* LEFT */}
            <div style={{ flex: 1, minWidth: '300px' }}>
              <div className="landing-reveal landing-d1" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                border: '1px solid rgba(201,168,76,0.25)', borderRadius: '4px',
                padding: '5px 12px', marginBottom: '28px',
                background: 'rgba(201,168,76,0.04)',
              }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(201,168,76,0.5)', letterSpacing: '0.15em' }}>DECRETO MUNICIPAL Nº 001/2025</span>
                <div style={{ width: '1px', height: '10px', background: 'rgba(201,168,76,0.25)' }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(201,168,76,0.65)', letterSpacing: '0.1em' }}>SISTEMA OFICIAL</span>
              </div>

              <h1 className="landing-reveal landing-d2" style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 'clamp(34px, 4.5vw, 60px)', fontWeight: 900,
                lineHeight: 1.05, color: '#f8fafc', margin: '0 0 6px 0', letterSpacing: '-0.02em',
              }}>
                Gestão Pública
              </h1>
              <div className="landing-reveal landing-d3 landing-shimmer-text" style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 'clamp(34px, 4.5vw, 60px)', fontWeight: 900,
                lineHeight: 1.05, margin: '0 0 24px 0', display: 'block', letterSpacing: '-0.02em',
              }}>
                com Precisão Cirúrgica
              </div>

              <p className="landing-reveal landing-d4" style={{
                fontSize: '14px', color: 'rgba(248,250,252,0.5)',
                lineHeight: 1.75, maxWidth: '460px', margin: '0 0 40px 0',
              }}>
                Plataforma de auditoria financeira para prefeituras. Importe relatórios,
                classifique despesas, audite credores e acompanhe a execução orçamentária
                — com conformidade à Lei de Responsabilidade Fiscal.
              </p>

              {/* Stats */}
              <div className="landing-reveal landing-d5" style={{ display: 'flex', marginBottom: '40px' }}>
                {stats.map((s, i) => (
                  <div key={i} style={{
                    padding: '16px 24px',
                    borderLeft: '1px solid rgba(201,168,76,0.25)',
                    borderRight: i === stats.length - 1 ? '1px solid rgba(201,168,76,0.25)' : undefined,
                  }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 700, color: '#C9A84C', lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '4px', fontWeight: 600, letterSpacing: '0.05em' }}>{s.label}</div>
                    <div style={{ fontSize: '9px', color: 'rgba(201,168,76,0.45)', marginTop: '2px', fontFamily: "'IBM Plex Mono', monospace" }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Trust marks */}
              <div className="landing-reveal landing-d6" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {checks.map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={12} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — Login */}
            <div className="landing-reveal-right landing-d3" style={{ width: '380px', flexShrink: 0, maxWidth: '100%' }}>
              <div className="landing-card-glow" style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: '12px', overflow: 'hidden',
                backdropFilter: 'blur(20px)',
              }}>
                {/* Card header */}
                <div style={{
                  padding: '22px 26px 18px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(201,168,76,0.03)',
                  display: 'flex', alignItems: 'center', gap: '14px',
                }}>
                  <div style={{ width: '38px', height: '38px', background: '#C9A84C', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Lock size={17} color="#0a0f1a" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '14px' }}>Acesso Restrito</div>
                    <div style={{ fontSize: '9px', color: 'rgba(201,168,76,0.55)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', marginTop: '2px' }}>
                      ÁREA EXCLUSIVA — SERVIDORES MUNICIPAIS
                    </div>
                  </div>
                </div>

                <div style={{ padding: '26px' }}>
                  <LoginForm />
                  <div style={{
                    marginTop: '18px', paddingTop: '14px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em' }}>
                      CONEXÃO SEGURA · TLS 1.3 · AES-256
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '9px', color: 'rgba(255,255,255,0.15)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em' }}>
                GESTORPUBLICO © 2026 · VERSÃO 1.0.0
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{
        background: '#0d1220', padding: '88px 48px',
        fontFamily: "'IBM Plex Sans', sans-serif",
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '56px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '14px' }}>
              ── Módulos do Sistema
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 700, color: '#f1f5f9', margin: 0, lineHeight: 1.1 }}>
                Controle financeiro<br />
                <em style={{ color: '#C9A84C', fontStyle: 'italic' }}>de ponta a ponta</em>
              </h2>
              <p style={{ maxWidth: '340px', fontSize: '13px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, margin: 0 }}>
                Cada módulo desenhado para o fluxo real de trabalho das secretarias municipais brasileiras.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden' }}>
            {features.map((f) => (
              <div key={f.code} className="landing-feature" style={{ padding: '32px 28px', background: '#0d1220' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
                  <div style={{ width: '40px', height: '40px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.18)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A84C' }}>
                    {f.icon}
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,0.12)', letterSpacing: '0.08em' }}>{f.code}</span>
                </div>
                <h3 style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '14px', margin: '0 0 8px 0' }}>{f.title}</h3>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#080d18', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '24px 48px', fontFamily: "'IBM Plex Mono', monospace" }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '20px', height: '20px', background: '#C9A84C', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="#0a0f1a">
                <path d="M12 2L2 7v3h20V7L12 2zM4 12v7h3v-7H4zm5 0v7h3v-7H9zm5 0v7h3v-7h-3zm5 0v7h2v-7h-2zM2 21h20v2H2v-2z"/>
              </svg>
            </div>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em' }}>GESTORPUBLICO · SISTEMA DE GESTÃO MUNICIPAL</span>
          </div>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.12)', letterSpacing: '0.08em' }}>© 2026 · TODOS OS DIREITOS RESERVADOS</span>
        </div>
      </footer>
    </>
  );
}
