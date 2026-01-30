
import React from 'react';
import { AppView } from '../types';
import { Database, ShieldCheck } from 'lucide-react';

interface SidebarProps {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  school?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, school }) => {
  const navItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: '📊' },
    { id: AppView.ANALISIS, label: 'Analisis Dokumen', icon: '📄' },
    { id: AppView.GENERATOR, label: 'Generator Perangkat', icon: '✨' },
  ];

  const getDbNode = () => {
    if (!school) return 'DEFAULT';
    const match = school.match(/(\d+)/);
    return match ? `SDN-${match[0]}` : 'MAIN';
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
          <span>🎓</span> EduGenie
        </h1>
        <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full w-fit">
           <Database size={10} />
           <span className="text-[8px] font-black uppercase tracking-widest">Isolated Node: {getDbNode()}</span>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeView === item.id
                ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="bg-indigo-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={14} className="opacity-80" />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-90">Cloud Sovereignty</p>
          </div>
          <p className="text-[9px] opacity-75 leading-tight">Data sekolah Anda terisolasi secara fisik untuk performa maksimal.</p>
          <button className="mt-3 w-full bg-white/20 hover:bg-white/30 py-2 rounded-lg text-[10px] font-black uppercase transition-colors">
            Cek Status Server
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
