
import React, { useState, useEffect } from 'react';
import { 
  BookOpen, ListTree, FileText, CalendarRange, Rocket, Users, GraduationCap, 
  LayoutDashboard, Cloud, CheckCircle2, ArrowRight, School as SchoolIcon, FileCheck, ClipboardList,
  Loader2
} from 'lucide-react';
import { db, collection, onSnapshot, query, where } from '../services/firebase';
import { User } from '../types';

interface DashboardProps {
  user: User;
  onNavigate: (menu: any) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {
  const [stats, setStats] = useState({
    cp: 0, analisis: 0, atp: 0, prota: 0, promes: 0, rpm: 0, siswa: 0, users: 0, kisikisi: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.school) return;

    const collections = [
      { key: 'cp', name: 'cps' },
      { key: 'analisis', name: 'analisis' },
      { key: 'atp', name: 'atp' },
      { key: 'prota', name: 'prota' },
      { key: 'promes', name: 'promes' },
      { key: 'rpm', name: 'rpm' },
      { key: 'siswa', name: 'siswa' },
      { key: 'users', name: 'users' },
      { key: 'kisikisi', name: 'kisikisi' }
    ];

    const unsubscribes = collections.map(coll => {
      // Filter wajib di level server agar tidak kena Permission Denied
      const q = query(collection(db, coll.name), where("school", "==", user.school));
      
      return onSnapshot(q, (snap) => {
        let docs = snap.docs;
        
        // Filter personal tambahan untuk Non-Admin
        if (user.role !== 'admin' && !['users', 'siswa', 'cps'].includes(coll.name)) {
          docs = docs.filter(d => d.data().userId === user.id);
        }

        setStats(prev => ({ ...prev, [coll.key]: docs.length }));
        setLoading(false);
      }, (err) => {
        console.error(`Dashboard Error for ${coll.name}:`, err.message);
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [user]);

  const statCards = [
    { id: 'CP', label: 'Capaian Pembelajaran', count: stats.cp, icon: <BookOpen />, color: 'blue' },
    { id: 'ANALISIS', label: 'Analisis CP-TP', count: stats.analisis, icon: <ClipboardList />, color: 'emerald' },
    { id: 'ATP', label: 'Alur Tujuan (ATP)', count: stats.atp, icon: <ListTree />, color: 'amber' },
    { id: 'PROTA', label: 'Program Tahunan', count: stats.prota, icon: <FileText />, color: 'violet' },
    { id: 'PROMES', label: 'Program Semester', count: stats.promes, icon: <CalendarRange />, color: 'rose' },
    { id: 'RPM', label: 'RPM Mendalam', count: stats.rpm, icon: <Rocket />, color: 'cyan' },
    { id: 'ASESMEN', label: 'Asesmen Sumatif', count: stats.kisikisi, icon: <FileCheck />, color: 'rose' },
    { id: 'USER', label: 'Basis Guru', count: stats.users, icon: <Users />, color: 'slate', adminOnly: true },
  ].filter(card => !card.adminOnly || user.role === 'admin');

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100 ring-blue-500',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 ring-emerald-500',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 ring-amber-500',
    violet: 'bg-violet-50 text-violet-600 border-violet-100 ring-violet-500',
    rose: 'bg-rose-50 text-rose-600 border-rose-100 ring-rose-500',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100 ring-cyan-500',
    slate: 'bg-slate-50 text-slate-600 border-slate-100 ring-slate-500',
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="bg-slate-900 rounded-[48px] p-10 md:p-14 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-10 scale-150 rotate-12"><SchoolIcon size={250} /></div>
        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <div className="px-4 py-1.5 bg-indigo-500 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Cloud size={12} /> Cloud Active</div>
            <div className="px-4 py-1.5 bg-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><CheckCircle2 size={12} /> {user.role === 'admin' ? 'Administrator' : `Guru ${user.school}`}</div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight tracking-tighter">Halo, <span className="text-indigo-400">{user.name.split(' ')[0]}!</span></h1>
          <p className="text-slate-400 text-base md:text-lg font-medium mb-10 max-w-2xl">
            {user.role === 'admin' ? `Kelola infrastruktur kurikulum ${user.school} dalam satu pusat kendali.` : `Perangkat ajar Anda tersimpan aman di server cloud ${user.school}.`}
          </p>
          <button onClick={() => onNavigate('JURNAL')} className="bg-white text-slate-900 px-8 py-4 rounded-3xl text-xs font-black hover:bg-indigo-50 transition-all flex items-center gap-3 shadow-xl uppercase">Isi Jurnal Harian <ArrowRight size={18} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex justify-center"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>
        ) : statCards.map((card) => (
          <button key={card.id} onClick={() => onNavigate(card.id)} className={`p-8 rounded-[40px] border transition-all hover:scale-[1.02] active:scale-95 group text-left shadow-sm hover:shadow-2xl ${colorMap[card.color]}`}>
            <div className="flex justify-between items-start mb-8">
              <div className="p-4 rounded-2xl bg-white shadow-sm">{React.cloneElement(card.icon as React.ReactElement<any>, { size: 28 })}</div>
              <ArrowRight className="opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" size={20} />
            </div>
            <div>
              <p className="text-4xl font-black mb-2 tracking-tight">{card.count}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">{card.label}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
