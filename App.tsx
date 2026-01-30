
import React, { useState, useEffect } from 'react';
import { 
  BookOpen, GraduationCap, School, ListTree, LogOut, 
  User as UserIcon, Settings, Users, CalendarDays, FileText, 
  CalendarRange, Rocket, Menu, ChevronRight, Loader2, AlertTriangle,
  BarChart3, LayoutDashboard, Code, BookText, PenTool, ClipboardCheck,
  ClipboardList, ArrowLeft, UserCircle, X, Save, Eye, EyeOff, Sparkles,
  FileCheck, Database
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import CPManager from './components/CPManager';
import AnalisisManager from './components/AnalisisManager';
import ATPManager from './components/ATPManager';
import SettingsManager from './components/SettingsManager';
import UserManager from './components/UserManager';
import HariEfektifManager from './components/HariEfektifManager';
import ProtaManager from './components/ProtaManager';
import PromesManager from './components/PromesManager';
import RPMManager from './components/RPMManager';
import JurnalManager from './components/JurnalManager';
import LKPDManager from './components/LKPDManager';
import EvaluasiManager from './components/EvaluasiManager';
import AsesmenManager from './components/AsesmenManager';
import AIAssistant from './components/AIAssistant';
import LoginPage from './components/LoginPage';
import SchoolSelectionPage from './components/SchoolSelectionPage';
import KeyLockScreen from './components/KeyLockScreen'; // IMPORT KOMPONEN BARU
import { User } from './types';
import { auth, db, onAuthStateChanged, signOut, doc, onSnapshot, getFirebaseInstance } from './services/firebase';

const App: React.FC = () => {
  const [selectedSchool, setSelectedSchool] = useState<string | null>(localStorage.getItem('selected_school'));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<'DASHBOARD' | 'CP' | 'ANALISIS' | 'ATP' | 'SETTING' | 'USER' | 'EFEKTIF' | 'PROTA' | 'PROMES' | 'RPM' | 'LKPD' | 'ASESMEN' | 'EVALUASI' | 'JURNAL'>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (!selectedSchool) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { auth: currentAuth } = getFirebaseInstance();

    const unsubscribe = onAuthStateChanged(currentAuth, async (firebaseUser) => {
      if (firebaseUser) {
        const unsubUser = onSnapshot(doc(db, "users", firebaseUser.uid), (snap) => {
          if (snap.exists()) {
            setUser({ id: firebaseUser.uid, ...snap.data() } as User);
          } else {
            setUser({ 
              id: firebaseUser.uid, 
              username: firebaseUser.email?.split('@')[0] || 'admin', 
              role: 'admin', 
              teacherType: 'kelas',
              name: 'Administrator', 
              nip: '-', 
              kelas: '-', 
              school: selectedSchool,
              mapelDiampu: [] 
            });
          }
          setLoading(false);
        }, (err) => {
          console.error("Firestore Sync Error:", err);
          setLoading(false);
        });
        return () => unsubUser();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [selectedSchool]);

  const handleSelectSchool = (school: string) => {
    localStorage.setItem('selected_school', school);
    setSelectedSchool(school);
    setUser(null);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowLogoutConfirm(false);
    } catch (e) {
      alert('Gagal keluar.');
    }
  };

  const navItems = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: <LayoutDashboard size={20} />, color: 'text-slate-900', bg: 'bg-slate-100' },
    { id: 'EFEKTIF', label: 'Hari Efektif', icon: <CalendarDays size={20} />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'CP', label: 'Capaian Pembelajaran', icon: <BookOpen size={20} />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'ANALISIS', label: 'Analisis CP-TP', icon: <ClipboardList size={20} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'ATP', label: 'Alur Tujuan (ATP)', icon: <ListTree size={20} />, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'PROTA', label: 'Program Tahunan', icon: <FileText size={20} />, color: 'text-violet-600', bg: 'bg-violet-50' },
    { id: 'PROMES', label: 'Program Semester', icon: <CalendarRange size={20} />, color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 'RPM', label: 'RPM (Deep Learning)', icon: <Rocket size={20} />, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { id: 'LKPD', label: 'Lembar Kerja (LKPD)', icon: <PenTool size={20} />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'JURNAL', label: 'Jurnal Harian', icon: <BookText size={20} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'ASESMEN', label: 'Asesmen Sumatif', icon: <FileCheck size={20} />, color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 'EVALUASI', label: 'Evaluasi & Nilai', icon: <ClipboardCheck size={20} />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'USER', label: 'Manajemen User', icon: <Users size={20} />, color: 'text-slate-600', bg: 'bg-slate-100', adminOnly: true },
    { id: 'SETTING', label: 'Pengaturan Sekolah', icon: <Settings size={20} />, color: 'text-slate-700', bg: 'bg-slate-200', adminOnly: true },
  ];

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Menghubungkan ke Cloud Sekolah...</p>
    </div>
  );
  
  if (!selectedSchool) return <SchoolSelectionPage onSelect={handleSelectSchool} />;
  
  if (!user) return (
    <LoginPage 
      school={selectedSchool} 
      onBack={() => { 
        localStorage.removeItem('selected_school'); 
        setSelectedSchool(null); 
      }} 
    />
  );

  // LOGIC GATE: Jika API Key belum diisi, tampilkan KeyLockScreen
  // Pengecualian: Admin tetap bisa masuk tanpa API Key untuk mengelola user jika perlu, 
  // namun di sini kita terapkan ke SEMUA user (termasuk admin) agar sistem seragam.
  if (!user.apiKey || user.apiKey.trim() === '') {
    return <KeyLockScreen user={user} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      <AIAssistant user={user} />

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={40} /></div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Konfirmasi Keluar</h3>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">Apakah Anda yakin ingin keluar dari sistem database {user.school}?</p>
            </div>
            <div className="p-5 bg-slate-50 flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-6 py-4 rounded-2xl text-xs font-black text-slate-500 bg-white border border-slate-200">BATAL</button>
              <button onClick={handleLogout} className="flex-1 px-6 py-4 rounded-2xl text-xs font-black text-white bg-red-600 shadow-xl shadow-red-100">YA, KELUAR</button>
            </div>
          </div>
        </div>
      )}

      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-200 z-50 transition-transform duration-300 lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-8 border-b border-slate-100 shrink-0">
            <div className="flex flex-col gap-4">
              <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-100 w-fit"><School size={28} /></div>
              <div>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Kecamatan Bilato</p>
                <h1 className="text-sm font-black text-slate-900 leading-tight uppercase truncate">{user.school}</h1>
                <div className="flex items-center gap-1.5 mt-2 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full w-fit border border-emerald-100">
                   <Database size={8} />
                   <span className="text-[7px] font-black uppercase tracking-widest">Cloud Account Active</span>
                </div>
              </div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-1 no-scrollbar">
            {navItems.map((item) => {
              if (item.adminOnly && user.role !== 'admin') return null;
              return (
                <button 
                  key={item.id}
                  onClick={() => { setActiveMenu(item.id as any); setIsSidebarOpen(false); }} 
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-xs font-bold transition-all group ${activeMenu === item.id ? `${item.bg} ${item.color} shadow-sm border border-slate-100` : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`${activeMenu === item.id ? item.color : 'text-slate-400 group-hover:text-slate-600'}`}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {activeMenu === item.id && <ChevronRight size={14} />}
                </button>
              );
            })}
          </nav>
          <div className="p-6 border-t border-slate-100 shrink-0">
            <div className="bg-slate-50 rounded-[2rem] p-4 flex items-center gap-3 mb-6 group">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm relative">
                <UserIcon size={24} />
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-[10px] font-black text-slate-900 truncate uppercase">{user.name}</p>
                <div className="flex items-center gap-1">
                  <p className="text-[8px] text-indigo-600 font-black uppercase tracking-tighter">{user.role}</p>
                </div>
              </div>
            </div>
            <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl text-[10px] font-black text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100 uppercase tracking-widest">
              <LogOut size={18} /> Keluar Sistem
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-0 overflow-hidden h-screen">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0 lg:px-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"><Menu size={24} /></button>
            <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <GraduationCap size={18} className="text-indigo-500" />
              <span>Portal</span>
              <ChevronRight size={12} />
              <span className="text-slate-900">
                {navItems.find(i => i.id === activeMenu)?.label}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar p-6 lg:p-10">
          <div className="max-w-7xl mx-auto">
            {activeMenu === 'DASHBOARD' && <Dashboard user={user} onNavigate={(id) => setActiveMenu(id)} />}
            {activeMenu === 'CP' && <CPManager user={user} />}
            {activeMenu === 'ANALISIS' && <AnalisisManager user={user} />}
            {activeMenu === 'ATP' && <ATPManager user={user} />}
            {activeMenu === 'SETTING' && <SettingsManager user={user} />}
            {activeMenu === 'USER' && <UserManager user={user} />}
            {activeMenu === 'EFEKTIF' && <HariEfektifManager user={user} />}
            {activeMenu === 'PROTA' && <ProtaManager user={user} />}
            {activeMenu === 'PROMES' && <PromesManager user={user} />}
            {activeMenu === 'RPM' && <RPMManager user={user} onNavigate={setActiveMenu} />}
            {activeMenu === 'LKPD' && <LKPDManager user={user} />}
            {activeMenu === 'JURNAL' && <JurnalManager user={user} />}
            {activeMenu === 'ASESMEN' && <AsesmenManager user={user} type="sumatif" />}
            {activeMenu === 'EVALUASI' && <EvaluasiManager user={user} />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
