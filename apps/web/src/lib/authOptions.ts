import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        senha: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.senha) return null;

        try {
          const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          const res = await fetch(`${apiUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: credentials.email, senha: credentials.senha }),
          });

          if (!res.ok) return null;

          const data = await res.json();

          return {
            id: String(data.user.id),
            name: data.user.nome,
            email: data.user.email,
            role: data.user.role,
            fk_municipio: data.user.fk_municipio ?? null,
            fk_entidade: data.user.fk_entidade ?? null,
            permissoes: data.user.permissoes ?? [],
            entidades_ids: data.user.entidades_ids ?? [],
            accessToken: data.token,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role         = (user as any).role;
        token.accessToken  = (user as any).accessToken;
        token.fk_municipio = (user as any).fk_municipio ?? null;
        token.fk_entidade  = (user as any).fk_entidade  ?? null;
        token.permissoes   = (user as any).permissoes   ?? [];
        token.entidades_ids = (user as any).entidades_ids ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).role          = token.role;
      (session.user as any).fk_municipio  = token.fk_municipio ?? null;
      (session.user as any).fk_entidade   = token.fk_entidade  ?? null;
      (session.user as any).permissoes    = token.permissoes    ?? [];
      (session.user as any).entidades_ids = token.entidades_ids ?? [];
      (session as any).accessToken        = token.accessToken;
      return session;
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
