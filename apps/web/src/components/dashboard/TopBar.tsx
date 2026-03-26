'use client';

import { useSession } from 'next-auth/react';
import { Bell, User } from 'lucide-react';

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  const { data: session } = useSession();
  const userName = session?.user?.name || 'Usuário';
  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-20 shadow-sm">
      <div>
        <h1 className="text-lg font-bold text-navy-800">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-400 hover:text-navy-800 transition-colors rounded-lg hover:bg-gray-50">
          <Bell size={18} />
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-gray-100">
          <div className="w-8 h-8 bg-navy-800 rounded-full flex items-center justify-center text-xs font-bold text-gold-500">
            {initials}
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-medium text-gray-700">{userName}</div>
            <div className="text-xs text-gray-400">{(session?.user as any)?.role || 'VIEWER'}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
