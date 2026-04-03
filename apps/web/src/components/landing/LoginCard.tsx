'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoginCard() {
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
      const result = await signIn('credentials', {
        email,
        senha,
        redirect: false,
      });

      if (result?.error) {
        setError('Email ou senha inválidos. Verifique suas credenciais.');
      } else {
        router.push('/dashboard-geral');
      }
    } catch {
      setError('Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-navy-800 rounded-2xl mb-4 shadow-lg">
          <svg viewBox="0 0 40 40" className="w-9 h-9 fill-gold-500" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 2L3 12v4h34v-4L20 2zM5 18v14h6V18H5zm8 0v14h6V18h-6zm8 0v14h6V18h-8zm10 0v14h4V18h-4zM3 34h34v4H3v-4z" fill="#C9A84C"/>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-navy-800">Bem-vindo</h2>
        <p className="text-gray-500 text-sm mt-1">Acesse o sistema de gestão pública</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Email institucional
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@prefeitura.gov.br"
            required
            className={cn(
              'w-full px-4 py-3 rounded-xl border text-gray-900',
              'focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent',
              'transition-all duration-200',
              'border-gray-200 bg-gray-50 placeholder-gray-400',
            )}
          />
        </div>

        {/* Senha */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Senha
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              required
              className={cn(
                'w-full px-4 py-3 pr-12 rounded-xl border text-gray-900',
                'focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent',
                'transition-all duration-200',
                'border-gray-200 bg-gray-50 placeholder-gray-400',
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className={cn(
            'w-full py-3.5 px-6 rounded-xl font-semibold text-white',
            'bg-gold-500 hover:bg-gold-600 active:bg-gold-700',
            'focus:outline-none focus:ring-2 focus:ring-gold-400 focus:ring-offset-2',
            'transition-all duration-200 shadow-md hover:shadow-lg',
            'flex items-center justify-center gap-2',
            loading && 'opacity-70 cursor-not-allowed',
          )}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Entrando...
            </>
          ) : (
            <>
              <LogIn size={18} />
              Entrar no Sistema
            </>
          )}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-6">
        Sistema de Gestão Pública • Versão 1.0
      </p>
    </div>
  );
}
