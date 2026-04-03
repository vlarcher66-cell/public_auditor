import { LayoutDashboard } from 'lucide-react';

export default function DashboardGeralPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
        style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #e8c84a 100%)' }}
      >
        <LayoutDashboard size={30} className="text-navy-900" />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h1>
        <p className="text-gray-400 text-sm">Em construção — em breve aqui estará o painel geral do sistema.</p>
      </div>
    </div>
  );
}
