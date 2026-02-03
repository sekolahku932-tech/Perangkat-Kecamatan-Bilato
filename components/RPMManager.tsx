
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, RPMItem, ATPItem, PromesItem, CapaianPembelajaran, MATA_PELAJARAN, DIMENSI_PROFIL, SchoolSettings, User } from '../types';
import { Plus, Trash2, Rocket, Sparkles, Loader2, CheckCircle2, Printer, Cloud, FileText, Split, AlertTriangle, FileDown, Wand2, PencilLine, Lock, Brain, Zap, RefreshCw, PenTool, Search, AlertCircle, X, CheckSquare, Square, Cpu, ClipboardList, BookOpen, Edit2, Globe, Activity, LayoutList, Target, ArrowLeft, CalendarDays, AlignLeft, LogIn, LogOut } from 'lucide-react';
import { generateRPMContent, generateAssessmentDetails, recommendPedagogy } from '../services/geminiService';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from '../services/firebase';

interface RubricItem {
  aspek: string; level4: string; level3: string; level2: string; level1: string;
}

interface AsesmenRow {
  kategori: string; teknik: string; bentuk: string; instruksi?: string; soalAtauTugas?: string; rubrikDetail?: RubricItem[];
}

interface RPMManagerProps {
  user: User;
  onNavigate: (menu: any) => void;
}

const RPMManager: React.FC<RPMManagerProps> = ({ user, onNavigate }) => {
  const [rpmList, setRpmList] = useState<RPMItem[]>([]);
  const [atpData, setAtpData] = useState<ATPItem[]>([]);
  const [promesData, setPromesData] = useState<PromesItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterKelas, setFilterKelas] = useState<Kelas>('1');
  const [filterSemester, setFilterSemester] = useState<'1' | '2'>('1');
  const [filterMapel, setFilterMapel] = useState<string>(MATA_PELAJARAN[0]);
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isLoadingAsesmenAI, setIsLoadingAsesmenAI] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<SchoolSettings>({ schoolName: user.school, address: '-', principalName: '-', principalNip: '-' });
  const [activeYear, setActiveYear] = useState('2024/2025');

  useEffect(() => {
    if (!user?.school) return;
    setLoading(true);
    
    const qRpm = query(collection(db, "rpm"), where("userId", "==", user.id));
    const unsubRpm = onSnapshot(qRpm, (snap) => {
      setRpmList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RPMItem[]);
    });

    const qAtp = query(collection(db, "atp"), where("userId", "==", user.id));
    const unsubAtp = onSnapshot(qAtp, (snap) => {
      setAtpData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ATPItem[]);
    });

    const qPromes = query(collection(db, "promes"), where("userId", "==", user.id));
    const unsubPromes = onSnapshot(qPromes, (snap) => {
      setPromesData(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as PromesItem[]);
      setLoading(false);
    });

    onSnapshot(doc(db, "school_settings", user.school), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });

    return () => { unsubRpm(); unsubAtp(); unsubPromes(); };
  }, [user]);

  const currentRpm = useMemo(() => isEditing ? rpmList.find(r => r.id === isEditing) : null, [rpmList, isEditing]);

  const syncWithPromes = async (id: string, promesId: string) => {
    const promes = promesData.find(p => p.id === promesId);
    if (!promes) return;
    const atp = atpData.find(a => a.id === promes.atpId);

    try {
      await updateDoc(doc(db, "rpm", id), {
        atpId: promes.atpId || '',
        tujuanPembelajaran: promes.tujuanPembelajaran,
        materi: promes.materiPokok,
        subMateri: promes.subMateri || '',
        // KRUSIAL: JP Mengikuti data dari Promes/ATP
        alokasiWaktu: promes.alokasiWaktu || atp?.alokasiWaktu || '4 JP',
        asesmenAwal: atp?.asesmenAwal || '',
        dimensiProfil: atp?.dimensiProfilLulusan ? [atp.dimensiProfilLulusan] : []
      });
      setMessage({ text: 'Data JP & Materi disinkronkan dari Program Semester!', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) { console.error(e); }
  };

  const handleGenerateAI = async (id: string) => {
    const rpm = rpmList.find(r => r.id === id);
    if (!rpm || !rpm.tujuanPembelajaran) return;
    setIsLoadingAI(true);
    try {
      const result = await generateRPMContent(rpm.tujuanPembelajaran, rpm.materi, rpm.kelas, rpm.praktikPedagogis || "Aktif", rpm.alokasiWaktu, rpm.jumlahPertemuan || 1);
      if (result) await updateDoc(doc(db, "rpm", id), { ...result });
    } catch (err) { setMessage({ text: 'Gagal memproses AI. Periksa API Key.', type: 'error' }); } finally { setIsLoadingAI(false); }
  };

  const sortedRPM = useMemo(() => {
    return rpmList.filter(r => r.kelas === filterKelas && r.semester === filterSemester && (r.mataPelajaran || '').toLowerCase() === filterMapel.toLowerCase())
      .sort((a, b) => (a.tujuanPembelajaran || '').localeCompare(b.tujuanPembelajaran || ''));
  }, [rpmList, filterKelas, filterSemester, filterMapel]);

  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {message && (<div className={`fixed top-24 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl border transition-all ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{message.text}</div>)}
      
      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-6 items-end">
         <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-[10px] font-black uppercase">
           <div><label className="text-slate-400 ml-1">MAPEL</label><select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-indigo-500" value={filterMapel} onChange={e => setFilterMapel(e.target.value)}>{(user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || [])).map(m => <option key={m} value={m}>{m}</option>)}</select></div>
           <div><label className="text-slate-400 ml-1">SEMESTER</label><select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-indigo-500" value={filterSemester} onChange={e => setFilterSemester(e.target.value as any)}><option value="1">Ganjil (1)</option><option value="2">Genap (2)</option></select></div>
           <div><label className="text-slate-400 ml-1">KELAS</label><select disabled={isClassLocked} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black outline-none disabled:opacity-50" value={filterKelas} onChange={e => setFilterKelas(e.target.value as Kelas)}>{['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}</select></div>
         </div>
         <button onClick={async () => {
           await addDoc(collection(db, "rpm"), { userId: user.id, kelas: filterKelas, semester: filterSemester, mataPelajaran: filterMapel, tujuanPembelajaran: '', materi: '', alokasiWaktu: '4 JP', jumlahPertemuan: 1, school: user.school });
         }} className="bg-indigo-600 text-white px-12 py-5 rounded-[2rem] font-black text-xs shadow-xl flex items-center gap-3 uppercase"><Plus size={20}/> Buat RPM Baru</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {loading ? (<div className="col-span-full py-20 text-center"><Loader2 size={48} className="animate-spin text-indigo-600 inline-block"/></div>) : 
        sortedRPM.map(rpm => (
          <div key={rpm.id} className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 hover:shadow-2xl transition-all group overflow-hidden relative">
            <div className="flex gap-8 items-start mb-10 relative z-10">
              <div className="p-6 bg-indigo-50 text-indigo-600 rounded-[2.5rem] group-hover:bg-indigo-600 group-hover:text-white transition-all"><Rocket size={36}/></div>
              <div className="flex-1">
                <h4 className="text-xl font-black text-slate-900 leading-tight uppercase line-clamp-2 mb-4">{rpm.tujuanPembelajaran || 'JUDUL RENCANA KOSONG'}</h4>
                <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase">
                  <span className="text-indigo-600 px-4 py-2 bg-indigo-50 rounded-full border border-indigo-100">{rpm.alokasiWaktu || '0 JP'}</span>
                  <span className="text-emerald-600 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">{rpm.jumlahPertemuan} Pertemuan</span>
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-8 border-t border-slate-50 relative z-10">
              <button onClick={() => setIsEditing(rpm.id)} className="flex-1 bg-slate-900 text-white py-5 rounded-[2rem] text-[11px] font-black hover:bg-black uppercase">Buka Editor</button>
              <button onClick={() => deleteDoc(doc(db, "rpm", rpm.id))} className="p-5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-[2rem] transition-all"><Trash2 size={24}/></button>
            </div>
          </div>
        ))}
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[48px] shadow-2xl overflow-hidden flex flex-col">
              <div className="p-8 border-b flex justify-between items-center bg-white">
                 <h3 className="font-black uppercase text-xl">Rencana Pembelajaran Mendalam</h3>
                 <button onClick={() => setIsEditing(null)} className="px-6 py-2 bg-red-50 text-red-600 rounded-xl font-black text-xs uppercase">Tutup</button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 bg-slate-50/30 space-y-8">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sumber Program Semester (Menentukan JP & Materi)</label>
                    <select 
                      className="w-full bg-white border-2 border-slate-100 rounded-2xl p-5 text-xs font-black outline-none focus:border-indigo-500" 
                      value={promesData.find(p => p.tujuanPembelajaran === currentRpm?.tujuanPembelajaran)?.id || ''} 
                      onChange={e => syncWithPromes(isEditing!, e.target.value)}
                    >
                      <option value="">-- PILIH TUJUAN PEMBELAJARAN DARI PROMES --</option>
                      {promesData.filter(p => p.kelas === currentRpm?.kelas && p.mataPelajaran === currentRpm?.mataPelajaran).map(p => (<option key={p.id} value={p.id}>[{p.alokasiWaktu}] {p.tujuanPembelajaran}</option>))}
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div><label className="text-[10px] font-black text-slate-400 block mb-2 uppercase">Alokasi Waktu (JP)</label><input className="w-full bg-slate-100 border-none rounded-xl p-4 font-black text-xs text-indigo-600" value={currentRpm?.alokasiWaktu} disabled /></div>
                    <div><label className="text-[10px] font-black text-slate-400 block mb-2 uppercase">Jumlah Pertemuan</label><input type="number" className="w-full bg-white border border-slate-200 rounded-xl p-4 font-black text-xs" value={currentRpm?.jumlahPertemuan} onChange={e => updateDoc(doc(db,"rpm",isEditing!), {jumlahPertemuan: parseInt(e.target.value) || 1})} /></div>
                 </div>
                 <div className="pt-6 border-t flex flex-col items-center gap-6">
                    <button onClick={() => handleGenerateAI(isEditing!)} disabled={isLoadingAI} className="bg-indigo-600 text-white px-10 py-5 rounded-full font-black text-xs flex items-center gap-3 uppercase shadow-2xl">
                       {isLoadingAI ? <Loader2 className="animate-spin" size={20}/> : <Sparkles size={20}/>} Generate Rincian Deep Learning
                    </button>
                    <textarea 
                      className="w-full bg-white border border-slate-200 rounded-[2rem] p-8 text-sm font-medium h-96 leading-relaxed shadow-inner" 
                      value={currentRpm?.kegiatanInti} 
                      onChange={e => updateDoc(doc(db,"rpm",isEditing!), {kegiatanInti: e.target.value})} 
                      placeholder="Gunakan Tombol Generate di atas untuk menyusun narasi..."
                    />
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RPMManager;
