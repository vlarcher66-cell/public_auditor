import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'GestorPublico — Sistema de Gestão Municipal',
  description: 'Plataforma de auditoria e gestão de pagamentos para prefeituras e secretarias',
  keywords: ['prefeitura', 'gestão pública', 'auditoria', 'transparência'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
