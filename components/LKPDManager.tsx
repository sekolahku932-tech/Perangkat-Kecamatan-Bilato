
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, LKPDItem, RPMItem, MATA_PELAJARAN, SchoolSettings, User } from '../types';
import { Plus, Trash2, Rocket, Sparkles, Loader2, CheckCircle2, Printer, Cloud, FileText, Split, AlertTriangle, FileDown, Wand2, PencilLine, Lock, Brain, Zap, RefreshCw, PenTool, Search, AlertCircle, X, ArrowRight, Hammer, Download, ArrowLeft, ListTree, Eye, EyeOff, Info } from 'lucide-react';
import { generateLKPDContent } from '../services/geminiService';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from '../services/firebase';

interface LKPDManagerProps {
  user: User;
}

const LKPDManager: React.FC<LKPDManagerProps> = ({ user }) => {
  const [lkpdList, setLkpdList] = useState<LKPDItem[]>([]);
  const [rpmList, setRpmList] = useState<RPMItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [filterKelas, setFilterKelas] = useState<Kelas>('1');
  const [filterMapel, setFilterMapel] = useState<string>(MATA_PELAJARAN[0]);
  const [filterSemester, setFilterSemester] = useState<'1' | '2'>('1');
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showRpmPicker, setShowRpmPicker] = useState(false);
  
  const [settings, setSettings] = useState<SchoolSettings>({ 
    schoolName: user.school, 
    address: '-', 
    principalName: '-', 
    principalNip: '-' 
  });
  
  const [activeYear, setActiveYear] = useState('2024/2025');
  const printRef = useRef<HTMLDivElement>(null);

  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';
  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || []);

  useEffect(() => {
    if (user.role === 'guru') {
      if (user.kelas !== '-' && user.kelas !== 'Multikelas') {
        setFilterKelas(user.kelas as Kelas);
      }
      if (user.mapelDiampu && user.mapelDiampu.length > 0) {
        setFilterMapel(user.mapelDiampu[0]);
      }
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const unsubSettings = onSnapshot(doc(db, "school_settings", user.school), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });
    
    const unsubYears = onSnapshot(collection(db, "academic_years"), (snap) => {
      const active = snap.docs.find((d: any) => d.data().isActive && d.data().school === user.school);
      if (active) setActiveYear(active.data().year);
    });

    const unsubLkpd = onSnapshot(query(collection(db, "lkpd"), where("userId", "==", user.id)), (snapshot) => {
      setLkpdList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LKPDItem[]);
    });
    
    const unsubRpm = onSnapshot(query(collection(db, "rpm"), where("userId", "==", user.id)), (snapshot) => {
      setRpmList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RPMItem[]);
      setLoading(false);
    });
    
    return () => { unsubSettings(); unsubYears(); unsubLkpd(); unsubRpm(); };
  }, [user.id, user.school]);

  const filteredLkpdList = useMemo(() => {
    return lkpdList.filter(l => 
      l.kelas === filterKelas && 
      (l.mataPelajaran || '').trim().toLowerCase() === filterMapel.trim().toLowerCase() &&
      l.semester === filterSemester
    );
  }, [lkpdList, filterKelas, filterMapel, filterSemester]);

  const availableRpmOptions = useMemo(() => {
    const currentMapelNormalized = filterMapel.trim().toLowerCase();
    return rpmList.filter(r => 
      r.kelas === filterKelas && 
      (r.mataPelajaran || '').trim().toLowerCase() === currentMapelNormalized && 
      r.semester === filterSemester
    );
  }, [rpmList, filterKelas, filterMapel, filterSemester]);

  const currentLkpd = useMemo(() => {
    const id = isEditing || printingId;
    if (!id) return null;
    return lkpdList.find(l => l.id === id) || null;
  }, [lkpdList, isEditing, printingId]);

  const handleGenerateAI = async (id: string) => {
    const lkpd = lkpdList.find(l => l.id === id);
    if (!lkpd) return;
    const rpm = rpmList.find(r => r.id === lkpd.rpmId);
    if (!rpm) return;
    if (!user.apiKey) {
      setMessage({ text: 'API Key Personal Belum Diatur!', type: 'error' });
      return;
    }

    setIsLoadingAI(true);
    try {
      const result = await generateLKPDContent(rpm, user.apiKey);
      if (result) {
        await updateDoc(doc(db, "lkpd", id), { ...result });
        setMessage({ text: 'Konten LKPD Sinkron AI Berhasil!', type: 'success' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) { 
      setMessage({ text: 'AI Gagal.', type: 'error' }); 
    } finally { 
      setIsLoadingAI(false); 
    }
  };

  const updateLKPD = async (id: string, field: keyof LKPDItem, value: any) => {
    try { await updateDoc(doc(db, "lkpd", id), { [field]: value }); } catch (e) { console.error(e); }
  };

  const handleSelectRpm = async (rpm: RPMItem) => {
    try {
      await addDoc(collection(db, "lkpd"), {
        userId: user.id, 
        rpmId: rpm.id, 
        fase: rpm.fase, 
        kelas: rpm.kelas, 
        semester: rpm.semester, 
        mataPelajaran: rpm.mataPelajaran,
        judul: `Lembar Kerja: ${rpm.materi}`, 
        tujuanPembelajaran: rpm.tujuanPembelajaran, 
        petunjuk: '1. Berdoalah sebelum mengerjakan.\n2. Baca materi ringkas dengan teliti.\n3. Kerjakan tugas sesuai langkah-langkah.',
        alatBahan: '-', 
        materiRingkas: '-', 
        langkahKerja: '-', 
        tugasMandiri: '-', 
        refleksi: '-', 
        jumlahPertemuan: rpm.jumlahPertemuan || 1, 
        school: user.school
      });
      setShowRpmPicker(false);
      setMessage({ text: 'LKPD baru berhasil dibuat!', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) { console.error(e); }
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try { 
      await deleteDoc(doc(db, "lkpd", deleteConfirmId)); 
      setDeleteConfirmId(null); 
      setMessage({ text: 'LKPD dihapus.', type: 'info' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) { console.error(e); }
  };

  const handlePrintAction = () => {
    window.print();
  };

  const openPreview = (id: string) => {
    setPrintingId(id);
    setIsPrintMode(true);
  };

  if (isPrintMode && currentLkpd) {
    const lkpd = currentLkpd;
    return (
      <div className="bg-white min-h-screen text-slate-900 font-sans print:p-0">
        <div className="no-print p-4 flex justify-between bg-slate-900 sticky top-0 z-[100]">
          <button 
            onClick={() => { setIsPrintMode(false); setPrintingId(null); }} 
            className="text-white px-6 py-2 rounded-xl text-xs font-black bg-white/10 hover:bg-white/20 transition-all flex items-center gap-2"
          >
            <ArrowLeft size={16}/> KEMBALI
          </button>
          <button 
            onClick={handlePrintAction} 
            className="bg-rose-600 text-white px-8 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2"
          >
            <Printer size={16}/> CETAK SEKARANG
          </button>
        </div>
        
        <div ref={printRef} className="max-w-[21cm] mx-auto p-8 md:p-12 bg-white space-y-8">
          <div className="text-center border-b-[3px] border-black pb-4">
             <h1 className="text-[22pt] font-black uppercase tracking-tight leading-none mb-2">LEMBAR KERJA PESERTA DIDIK (LKPD)</h1>
             <h2 className="text-[14pt] font-bold uppercase">{settings.schoolName}</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 border-2 border-black p-4 text-[10pt] font-bold uppercase">
            <div className="space-y-1">
              <p>MATA PELAJARAN : {lkpd.mataPelajaran}</p>
              <p>KELAS / FASE : {lkpd.kelas} / {lkpd.fase}</p>
              <p>SEMESTER : {lkpd.semester}</p>
            </div>
            <div className="space-y-1">
              <p>TAHUN PELAJARAN : {activeYear}</p>
              <p>JUDUL : {lkpd.judul}</p>
              <p>NAMA SISWA : ............................</p>
            </div>
          </div>

          <div className="space-y-6">
            <section className="break-inside-avoid">
              <h3 className="font-black text-indigo-900 text-sm uppercase border-b-2 border-indigo-100 pb-1 mb-3">A. TUJUAN PEMBELAJARAN</h3>
              <p className="text-[11pt] leading-relaxed italic">{lkpd.tujuanPembelajaran}</p>
            </section>

            <section className="break-inside-avoid">
              <h3 className="font-black text-indigo-900 text-sm uppercase border-b-2 border-indigo-100 pb-1 mb-3">B. PETUNJUK KERJA</h3>
              <div className="text-[11pt] leading-relaxed whitespace-pre-line pl-4 border-l-4 border-slate-100">{lkpd.petunjuk}</div>
            </section>

            <section className="break-inside-avoid">
              <h3 className="font-black text-indigo-900 text-sm uppercase border-b-2 border-indigo-100 pb-1 mb-3">C. RINGKASAN MATERI</h3>
              <div className="text-[11pt] leading-relaxed whitespace-pre-line text-justify pl-4 border-l-4 border-slate-100">{lkpd.materiRingkas}</div>
            </section>

            <section className="break-inside-avoid">
              <h3 className="font-black text-indigo-900 text-sm uppercase border-b-2 border-indigo-100 pb-1 mb-3">D. TUGAS MANDIRI / KELOMPOK</h3>
              <div className="p-6 border-2 border-slate-900 rounded-3xl bg-slate-50/30 text-[11pt] leading-relaxed whitespace-pre-line min-h-[300px]">
                {lkpd.tugasMandiri}
              </div>
            </section>

            <section className="break-inside-avoid">
              <h3 className="font-black text-indigo-900 text-sm uppercase border-b-2 border-indigo-100 pb-1 mb-3">E. REFLEKSI</h3>
              <div className="text-[11pt] leading-relaxed whitespace-pre-line italic pl-4 border-l-4 border-slate-100">{lkpd.refleksi}</div>
            </section>
          </div>

          <div className="mt-16 grid grid-cols-2 text-center text-[10pt] font-black uppercase font-sans break-inside-avoid">
             <div>
                <p>Mengetahui,</p>
                <p>Orang Tua/Wali</p>
                <div className="h-20"></div>
                <p className="border-b border-black inline-block min-w-[180px]">( ................................ )</p>
             </div>
             <div>
                <p>Bilato, ........................</p>
                <p>Guru Kelas / Mata Pelajaran</p>
                <div className="h-20"></div>
                <p className="border-b border-black inline-block min-w-[180px]">{user.name}</p>
                <p className="mt-1 font-normal uppercase tracking-tight">NIP. {user.nip}</p>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative font-sans">
      {message && (
        <div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all animate-in slide-in-from-right ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <CheckCircle2 size={20}/>
          <span className="text-sm font-black uppercase tracking-tight">{message.text}</span>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} /></div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus LKPD</h3>
              <p className="text-slate-500 font-medium text-sm">Hapus lembar kerja ini dari database personal?</p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 transition-all">BATAL</button>
              <button onClick={executeDelete} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 transition-all shadow-lg">YA, HAPUS</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-6 items-end">
         <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 w-full text-[10px] font-black uppercase tracking-widest">
           <div className="space-y-2">
              <label className="text-slate-400 ml-1">MAPEL</label>
              <select 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-indigo-500" 
                value={filterMapel} 
                onChange={e => setFilterMapel(e.target.value)}
              >
                {availableMapel.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-slate-400 ml-1">SEMESTER</label>
              <select 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-indigo-500" 
                value={filterSemester} 
                onChange={e => setFilterSemester(e.target.value as '1' | '2')}
              >
                <option value="1">Ganjil (1)</option>
                <option value="2">Genap (2)</option>
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-slate-400 ml-1">KELAS</label>
              <select 
                disabled={isClassLocked} 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-indigo-500 disabled:opacity-50" 
                value={filterKelas} 
                onChange={e => setFilterKelas(e.target.value as Kelas)}
              >
                {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
              </select>
           </div>
           <div className="flex flex-col justify-center h-[58px]">
              <div className="px-4 py-2 bg-indigo-50 rounded-xl text-indigo-600 font-black text-[9px] text-center border border-indigo-100">
                 {filteredLkpdList.length} DOKUMEN
              </div>
           </div>
         </div>
         <button 
           onClick={() => setShowRpmPicker(true)} 
           className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-[2rem] font-black text-xs shadow-2xl shadow-indigo-100 active:scale-95 transition-all flex items-center gap-3 uppercase tracking-widest"
         >
           <Plus size={20}/> BUAT LKPD DARI RPM
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {loading ? (
          <div className="col-span-full py-40 text-center">
            <Loader2 size={48} className="animate-spin text-indigo-600 inline-block"/>
            <p className="text-[10px] font-black uppercase tracking-widest mt-6 text-slate-400">Sinkronisasi Cloud...</p>
          </div>
        ) : filteredLkpdList.length === 0 ? (
          <div className="col-span-full py-40 text-center text-slate-300 font-black uppercase text-sm bg-white border-2 border-dashed border-slate-100 rounded-[64px]">
            Belum Ada Lembar Kerja untuk Filter Ini
          </div>
        ) : filteredLkpdList.map(lkpd => (
          <div key={lkpd.id} className="bg-white p-10 rounded-[4rem] border-2 border-slate-100 hover:shadow-2xl hover:border-indigo-200 transition-all group overflow-hidden relative">
            <div className="absolute -top-10 -right-10 p-20 bg-indigo-50/50 rounded-full opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 pointer-events-none">
              <PencilLine size={80} className="text-indigo-100" />
            </div>
            
            <div className="flex gap-8 items-start mb-8 relative z-10">
              <div className="p-6 bg-emerald-50 text-emerald-600 rounded-[2.5rem] group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                <FileText size={36}/>
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-black text-slate-900 leading-tight uppercase line-clamp-2 mb-4 tracking-tighter">{lkpd.judul}</h4>
                <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
                  <span className="text-indigo-600 px-4 py-2 bg-indigo-50 rounded-full border border-indigo-100">{lkpd.mataPelajaran}</span>
                  <span className="text-emerald-600 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">Semester {lkpd.semester}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-8 border-t border-slate-50 relative z-10">
              <button 
                onClick={() => setIsEditing(lkpd.id)} 
                className="flex-1 bg-slate-900 text-white py-5 rounded-[2rem] text-[11px] font-black hover:bg-black shadow-xl active:scale-95 transition-all uppercase tracking-[0.2em]"
              >
                EDIT KONTEN
              </button>
              <button 
                onClick={() => openPreview(lkpd.id)} 
                className="p-5 bg-indigo-50 text-indigo-600 rounded-[2rem] hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                title="Pratinjau LKPD"
              >
                <Eye size={24}/>
              </button>
              <button 
                onClick={() => setDeleteConfirmId(lkpd.id)} 
                className="p-5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-[2rem] transition-all"
              >
                <Trash2 size={24}/></button>
            </div>
          </div>
        ))}
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-6xl max-h-[95vh] rounded-[48px] shadow-2xl overflow-hidden flex flex-col border border-white/20">
              <div className="p-8 bg-white border-b flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-4">
                   <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-100"><PenTool size={24}/></div>
                   <h3 className="font-black uppercase text-xl tracking-tighter text-slate-900">EDITOR LEMBAR KERJA</h3>
                 </div>
                 <div className="flex gap-3">
                    <button 
                      onClick={() => handleGenerateAI(isEditing!)} 
                      disabled={isLoadingAI} 
                      className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black flex items-center gap-3 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isLoadingAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16}/>} SINKRONISASI AI
                    </button>
                    <button 
                      onClick={() => { setIsEditing(null); openPreview(isEditing!); }} 
                      className="bg-slate-800 text-white px-8 py-3 rounded-2xl text-[10px] font-black hover:bg-black transition-all flex items-center gap-2"
                    >
                      <Eye size={16}/> PRATINJAU
                    </button>
                    <button 
                      onClick={() => setIsEditing(null)} 
                      className="bg-red-50 hover:bg-red-100 text-red-600 px-6 py-3 rounded-2xl text-[10px] font-black transition-all"
                    >
                      BATAL
                    </button>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto p-10 no-scrollbar bg-slate-50/30">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Judul LKPD</label>
                          <input 
                            className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-sm font-black outline-none focus:border-indigo-500 shadow-sm" 
                            value={currentLkpd?.judul} 
                            onChange={e => updateLKPD(isEditing!, 'judul', e.target.value)} 
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Petunjuk Belajar</label>
                          <textarea 
                             className="w-full bg-white border-2 border-slate-100 rounded-[2rem] p-6 text-sm font-medium h-48 outline-none focus:border-indigo-500 shadow-sm" 
                             value={currentLkpd?.petunjuk} 
                             onChange={e => updateLKPD(isEditing!, 'petunjuk', e.target.value)} 
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alat & Bahan</label>
                          <textarea 
                             className="w-full bg-white border-2 border-slate-100 rounded-[2rem] p-6 text-sm font-medium h-32 outline-none focus:border-indigo-500 shadow-sm" 
                             value={currentLkpd?.alatBahan} 
                             onChange={e => updateLKPD(isEditing!, 'alatBahan', e.target.value)} 
                          />
                       </div>
                    </div>
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ringkasan Materi (Uraian Konsep)</label>
                          <textarea 
                             className="w-full bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 text-sm font-medium h-[400px] outline-none focus:border-indigo-500 shadow-sm leading-relaxed" 
                             value={currentLkpd?.materiRingkas} 
                             onChange={e => updateLKPD(isEditing!, 'materiRingkas', e.target.value)} 
                             placeholder="Tulis ringkasan materi di sini..."
                          />
                       </div>
                    </div>
                 </div>
                 
                 <div className="mt-8 space-y-6">
                    <div className="space-y-2">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tugas Utama (Mandiri/Kelompok)</label>
                       <textarea 
                          className="w-full bg-white border-2 border-indigo-100 rounded-[3rem] p-10 text-base font-medium h-[500px] outline-none focus:border-indigo-500 shadow-lg leading-relaxed" 
                          value={currentLkpd?.tugasMandiri} 
                          onChange={e => updateLKPD(isEditing!, 'tugasMandiri', e.target.value)} 
                          placeholder="Susun butir pertanyaan atau instruksi tugas di sini..."
                       />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                       <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Langkah Kerja</label>
                          <textarea 
                             className="w-full bg-white border-2 border-slate-100 rounded-[2rem] p-6 text-sm font-medium h-40 outline-none focus:border-indigo-500 shadow-sm" 
                             value={currentLkpd?.langkahKerja} 
                             onChange={e => updateLKPD(isEditing!, 'langkahKerja', e.target.value)} 
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pertanyaan Refleksi</label>
                          <textarea 
                             className="w-full bg-white border-2 border-slate-100 rounded-[2rem] p-6 text-sm font-medium h-40 outline-none focus:border-indigo-500 shadow-sm italic" 
                             value={currentLkpd?.refleksi} 
                             onChange={e => updateLKPD(isEditing!, 'refleksi', e.target.value)} 
                          />
                       </div>
                    </div>
                 </div>
                 
                 <div className="mt-10 p-10 bg-indigo-600 rounded-[3rem] text-white flex items-center justify-between shadow-2xl">
                    <div className="flex items-center gap-6">
                       <div className="p-5 bg-white/20 rounded-[2rem]"><Rocket size={40}/></div>
                       <div>
                          <h4 className="text-xl font-black uppercase tracking-tight">Siap Untuk Dicetak?</h4>
                          <p className="text-sm opacity-80 font-medium">Pastikan seluruh konten sudah sesuai dengan RPM Anda.</p>
                       </div>
                    </div>
                    <button 
                      onClick={() => { setIsEditing(null); openPreview(isEditing!); }} 
                      className="bg-white text-indigo-600 px-12 py-5 rounded-[2rem] font-black text-xs shadow-xl active:scale-95 transition-all uppercase tracking-widest"
                    >
                       SIMPAN & PRATINJAU
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showRpmPicker && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
             <div className="p-8 border-b flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                   <ListTree className="text-indigo-600" size={24}/>
                   <h3 className="font-black uppercase tracking-widest text-slate-800">Pilih RPM Referensi</h3>
                </div>
                <button onClick={() => setShowRpmPicker(false)} className="p-3 bg-white border rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all">
                   <X size={24}/>
                </button>
             </div>
             <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4 no-scrollbar">
                {availableRpmOptions.length === 0 ? (
                   <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 font-bold uppercase text-xs">Tidak ada RPM yang ditemukan di kelas, mapel, dan semester ini.</p>
                   </div>
                ) : availableRpmOptions.map(r => (
                   <button 
                      key={r.id} 
                      onClick={() => handleSelectRpm(r)} 
                      className="w-full p-6 bg-white border-2 border-slate-100 text-left rounded-3xl hover:bg-indigo-50 hover:border-indigo-200 transition-all group flex justify-between items-center"
                   >
                      <div className="flex-1">
                         <div className="flex items-center gap-2 mb-2">
                            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[9px] font-black uppercase">{r.mataPelajaran}</span>
                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-black uppercase">Fase {r.fase}</span>
                         </div>
                         <p className="font-black text-slate-800 uppercase text-sm leading-tight">{r.tujuanPembelajaran}</p>
                      </div>
                      <ArrowRight className="text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all" size={24}/>
                   </button>
                ))}
             </div>
             <div className="p-8 bg-slate-50 border-t flex justify-between items-center">
                <div className="flex items-center gap-2 text-slate-400">
                   <Info size={16}/>
                   <p className="text-[10px] font-bold uppercase">Membuat LKPD akan menautkan materi dari RPM secara permanen.</p>
                </div>
                <button 
                  onClick={() => setShowRpmPicker(false)} 
                  className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest"
                >
                   BATAL
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LKPDManager;
