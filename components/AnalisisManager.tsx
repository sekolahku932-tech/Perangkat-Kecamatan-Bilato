
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, CapaianPembelajaran, AnalisisCP, MATA_PELAJARAN, SchoolSettings, User } from '../types';
import { Plus, Trash2, Sparkles, Loader2, Eye, EyeOff, BrainCircuit, Cloud, AlertTriangle, X, FileDown, Printer, Lock, AlertCircle, ListChecks, Info, BookOpen, CheckCircle2, Key, ArrowLeft } from 'lucide-react';
import { analyzeCPToTP } from '../services/geminiService';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from '../services/firebase';

interface AnalisisManagerProps {
  user: User;
}

const AnalisisManager: React.FC<AnalisisManagerProps> = ({ user }) => {
  const [cps, setCps] = useState<CapaianPembelajaran[]>([]);
  const [analisis, setAnalisis] = useState<AnalisisCP[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterFase, setFilterFase] = useState<Fase>(Fase.A);
  const [filterKelas, setFilterKelas] = useState<Kelas>('1');
  const [filterMapel, setFilterMapel] = useState<string>(MATA_PELAJARAN[0]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school,
    address: '-',
    principalName: '-',
    principalNip: '-'
  });

  const [activeYear, setActiveYear] = useState('2024/2025');
  const printRef = useRef<HTMLDivElement>(null);

  const isClassLocked = user.role === 'guru' && (user.teacherType === 'kelas' || (!user.teacherType && user.kelas !== '-' && user.kelas !== 'Multikelas'));

  useEffect(() => {
    if (user.role === 'guru') {
      if (user.kelas !== '-' && user.kelas !== 'Multikelas') {
        setFilterKelas(user.kelas as Kelas);
        updateFaseByKelas(user.kelas as Kelas);
      }
      if (user.mapelDiampu && user.mapelDiampu.length > 0) {
        if (!user.mapelDiampu.includes(filterMapel)) {
          setFilterMapel(user.mapelDiampu[0]);
        }
      }
    }
  }, [user]);

  const updateFaseByKelas = (kls: Kelas) => {
    if (['1', '2'].includes(kls)) setFilterFase(Fase.A);
    else if (['3', '4'].includes(kls)) setFilterFase(Fase.B);
    else if (['5', '6'].includes(kls)) setFilterFase(Fase.C);
  };

  const handleKelasChange = (kls: Kelas) => {
    setFilterKelas(kls);
    updateFaseByKelas(kls);
  };

  useEffect(() => {
    setLoading(true);
    const unsubSettings = onSnapshot(doc(db, "school_settings", user.school), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });

    const unsubYears = onSnapshot(collection(db, "academic_years"), (snap) => {
      const active = snap.docs.find((d: any) => d.data().isActive);
      if (active) setActiveYear(active.data().year);
    });

    const qCp = query(collection(db, "cps"), where("school", "==", user.school));
    const unsubCp = onSnapshot(qCp, snap => {
      setCps(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CapaianPembelajaran[]);
    });

    const qAnalisis = query(collection(db, "analisis"), where("userId", "==", user.id));
    const unsubAnalisis = onSnapshot(qAnalisis, snap => {
      setAnalisis(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AnalisisCP[]);
      setLoading(false);
    });
    return () => { unsubSettings(); unsubYears(); unsubCp(); unsubAnalisis(); };
  }, [user.school, user.id]);

  const filteredAnalisis = useMemo(() => {
    const currentMapelNormalized = (filterMapel || '').trim().toLowerCase();
    return analisis
      .filter(a => a.fase === filterFase && a.kelas === filterKelas && a.mataPelajaran.trim().toLowerCase() === currentMapelNormalized)
      .sort((a, b) => (a.indexOrder || 0) - (b.indexOrder || 0));
  }, [analisis, filterFase, filterKelas, filterMapel]);

  const filteredCps = useMemo(() => {
    const currentMapelNormalized = (filterMapel || '').trim().toLowerCase();
    return cps
      .filter(cp => cp.fase === filterFase && cp.mataPelajaran.trim().toLowerCase() === currentMapelNormalized)
      .sort((a, b) => (a.kode || '').localeCompare(b.kode || '', undefined, { numeric: true, sensitivity: 'base' }));
  }, [cps, filterFase, filterMapel]);

  const handleAnalyze = async (cp: CapaianPembelajaran) => {
    if (!user.apiKey) {
      setMessage({ text: 'API Key Personal Belum Diatur!', type: 'error' });
      return;
    }

    setIsAnalyzing(true);
    try {
      const results = await analyzeCPToTP(cp.deskripsi, cp.elemen, cp.fase, filterKelas, user.apiKey);
      if (results && Array.isArray(results)) {
        let lastOrder = filteredAnalisis.length > 0 ? Math.max(...filteredAnalisis.map(a => a.indexOrder || 0)) : 0;
        for (const res of results) {
          lastOrder++;
          await addDoc(collection(db, "analisis"), {
            userId: user.id,
            cpId: cp.id,
            kodeCP: cp.kode, 
            fase: filterFase,
            kelas: filterKelas,
            mataPelajaran: filterMapel,
            materi: res.materi,
            subMateri: res.subMateri || '',
            tujuanPembelajaran: res.tp,
            profilLulusan: res.profilLulusan || '', 
            indexOrder: lastOrder,
            school: user.school
          });
        }
        setMessage({ text: 'Analisis Berhasil!', type: 'success' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      const detail = error.message || "";
      let userFriendlyMsg = detail;
      if (detail.includes("429")) userFriendlyMsg = "KUOTA PENUH. Silakan tunggu 1 menit.";
      if (detail.includes("location")) userFriendlyMsg = "REGION DIBLOKIR. Wilayah server tidak didukung.";
      if (detail.includes("403")) userFriendlyMsg = "API KEY ERROR. Periksa konfigurasi API_KEY.";
      
      setMessage({ text: `AI: ${userFriendlyMsg}`, type: 'error' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak Analisis CP - ${user.school}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Inter', sans-serif; background: white; padding: 40px; font-size: 10pt; }
              @media print { .no-print { display: none !important; } body { padding: 0; } }
              table { border-collapse: collapse; width: 100%; border: 1.5px solid black; }
              th, td { border: 1px solid black; padding: 8px; }
            </style>
          </head>
          <body onload="setTimeout(() => { window.print(); window.close(); }, 500)">
            ${content}
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (isPrintMode) {
    return (
      <div className="bg-white p-8 md:p-12 min-h-screen text-slate-900 font-serif">
        <div className="no-print fixed top-6 right-6 flex gap-3 z-[200]">
          <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xl hover:bg-black transition-all">
            <ArrowLeft size={16} /> KEMBALI
          </button>
          <button onClick={handlePrint} className="bg-rose-600 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xl hover:bg-rose-700 transition-all">
            <Printer size={16} /> CETAK PDF
          </button>
        </div>

        <div ref={printRef}>
          <div className="text-center mb-10">
            <h1 className="text-xl font-black uppercase border-b-4 border-black pb-2 inline-block">Analisis CP Menjadi TP</h1>
            <h2 className="text-lg font-bold mt-3 uppercase">{settings.schoolName}</h2>
            <div className="flex justify-center gap-10 mt-6 text-[9px] font-black uppercase font-sans text-slate-500 tracking-widest">
              <span>MAPEL: {filterMapel}</span> <span>KELAS: {filterKelas}</span> <span>TAHUN: {activeYear}</span>
            </div>
          </div>

          <table className="w-full border-collapse border-2 border-black text-[10px]">
            <thead>
              <tr className="bg-slate-50">
                <th className="border-2 border-black px-2 py-3 w-10 text-center">NO</th>
                <th className="border-2 border-black px-2 py-3 w-16 text-center">KODE</th>
                <th className="border-2 border-black px-3 py-3 text-left w-64">CAPAIAN PEMBELAJARAN (CP)</th>
                <th className="border-2 border-black px-3 py-3 text-left w-48">MATERI & DIMENSI PROFIL</th>
                <th className="border-2 border-black px-3 py-3 text-left">TUJUAN PEMBELAJARAN (TP) - TERURAI</th>
              </tr>
            </thead>
            <tbody>
              {filteredAnalisis.map((item, idx) => {
                const cpData = cps.find(c => c.id === item.cpId);
                return (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className="border-2 border-black p-3 text-center font-bold">{idx + 1}</td>
                    <td className="border-2 border-black p-3 text-center font-black uppercase">{item.kodeCP || cpData?.kode || '-'}</td>
                    <td className="border-2 border-black p-3 text-justify leading-relaxed italic text-slate-600">
                      <span className="font-black text-slate-900 not-italic block mb-1">[{cpData?.kode || '-'}] {cpData?.elemen || '-'}</span>
                      "{cpData?.deskripsi || '-'}"
                    </td>
                    <td className="border-2 border-black p-3 font-black uppercase">
                       <p className="mb-2">{item.materi}</p>
                       <p className="text-[8px] text-blue-600 italic">DPL: {item.profilLulusan || '-'}</p>
                    </td>
                    <td className="border-2 border-black p-3 leading-relaxed font-medium">{item.tujuanPembelajaran}</td>
                  </tr>
                );
              })}
              {filteredAnalisis.length === 0 && (
                <tr><td colSpan={5} className="p-10 text-center italic text-slate-400">Data analisis kosong untuk filter ini.</td></tr>
              )}
            </tbody>
          </table>

          <div className="mt-16 flex justify-between items-start text-[10px] px-12 font-sans uppercase font-black tracking-tighter">
            <div className="text-center w-72"><p>Mengetahui,</p> <p>Kepala Sekolah</p> <div className="h-24"></div> <p className="border-b border-black inline-block min-w-[200px]">{settings.principalName}</p> <p className="no-underline mt-1 font-normal">NIP. {settings.principalNip}</p></div>
            <div className="text-center w-72"><p>Bilato, {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p> <p>Guru Kelas/Mapel</p> <div className="h-24"></div> <p className="border-b border-black inline-block min-w-[200px]">{user?.name || '[Nama Guru]'}</p> <p className="no-underline mt-1 font-normal">NIP. {user?.nip || '...................'}</p></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {message && (
        <div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 
          message.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 
          'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
          <span className="text-sm font-black uppercase tracking-tight">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-2 opacity-50 hover:opacity-100"><X size={14}/></button>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg"><BrainCircuit size={24} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">ANALISIS CP-TP CERDAS</h2>
              <p className="text-[10px] text-emerald-600 font-black uppercase mt-1">Sistem Cloud Aktif</p>
            </div>
          </div>
          <button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black shadow-lg transition-all"><Eye size={18} /> PRATINJAU</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-[24px] border border-slate-100">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1">Fase {isClassLocked && <Lock size={10} className="text-amber-500" />}</label>
            <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100" value={filterFase} disabled={isClassLocked} onChange={(e) => setFilterFase(e.target.value as Fase)}>
              {Object.values(Fase).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1">Pilih Kelas</label>
            <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100" value={filterKelas} disabled={isClassLocked} onChange={(e) => handleKelasChange(e.target.value as Kelas)}>
              {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
            </select>
          </div>
          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Mapel</label><select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={filterMapel} onChange={(e) => setFilterMapel(e.target.value)}>{(user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || [])).map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 bg-slate-900 text-white flex items-center gap-3">
             <Sparkles size={20} className="text-emerald-400"/>
             <h3 className="text-xs font-black uppercase tracking-widest">CP Untuk Dianalisis</h3>
          </div>
          <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="py-20 text-center"><Loader2 className="animate-spin inline-block text-slate-300" size={32}/></div>
            ) : filteredCps.length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Belum ada CP di sekolah ini.</p>
              </div>
            ) : filteredCps.map(cp => (
              <div key={cp.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex justify-between items-start gap-2">
                  <span className="bg-white border border-slate-200 px-2 py-1 rounded text-[9px] font-black text-slate-500 uppercase">{cp.kode}</span>
                  <h4 className="text-[10px] font-black text-slate-800 uppercase text-right leading-tight">{cp.elemen}</h4>
                </div>
                <p className="text-[11px] font-medium leading-relaxed text-slate-600 line-clamp-4 italic">"{cp.deskripsi}"</p>
                <button 
                  onClick={() => handleAnalyze(cp)} 
                  disabled={isAnalyzing} 
                  className={`w-full font-black py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white`}
                >
                  {isAnalyzing ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} ANALISIS RUMUSAN TP
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
               <div className="flex items-center gap-3">
                 <ListChecks size={20} className="text-emerald-600"/>
                 <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Hasil Analisis TP Terurai ({filteredAnalisis.length})</h3>
               </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest h-12">
                    <th className="px-6 py-2 w-[5%] text-center border-r border-white/5">No</th>
                    <th className="px-6 py-2 w-[10%] border-r border-white/5">Kode CP</th>
                    <th className="px-6 py-2 w-[25%] border-r border-white/5">Materi & Dimensi Profil</th>
                    <th className="px-6 py-2 w-[50%]">Tujuan Pembelajaran (Kompetensi + Konten)</th>
                    <th className="px-6 py-2 w-[10%] text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAnalisis.length === 0 ? (
                    <tr><td colSpan={5} className="py-32 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">Belum ada hasil analisis untuk sekolah ini</td></tr>
                  ) : filteredAnalisis.map((item, idx) => {
                    return (
                      <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors align-top">
                        <td className="px-6 py-6 text-center font-black text-slate-300 border-r border-slate-50">{idx + 1}</td>
                        <td className="px-6 py-6 border-r border-slate-50">
                           <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black border border-indigo-100 uppercase">
                             {item.kodeCP || '-'}
                           </span>
                        </td>
                        <td className="px-6 py-6 space-y-3 border-r border-slate-50">
                           <div>
                             <label className="text-[8px] font-black text-slate-400 block uppercase mb-1">Materi Pokok</label>
                             <textarea className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-[10px] font-black text-emerald-800 uppercase resize-none h-16 outline-none" value={item.materi} onChange={e => updateDoc(doc(db, "analisis", item.id), { materi: e.target.value })} />
                           </div>
                           <div>
                             <label className="text-[8px] font-black text-slate-400 block uppercase mb-1">Dimensi Profil Lulusan (DPL)</label>
                             <textarea className="w-full bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-[9px] font-bold text-blue-700 italic resize-none h-16 outline-none" value={item.profilLulusan} onChange={e => updateDoc(doc(db, "analisis", item.id), { profilLulusan: e.target.value })} />
                           </div>
                        </td>
                        <td className="px-6 py-6">
                           <label className="text-[8px] font-black text-slate-400 block uppercase mb-1">Rumusan TP Rinci</label>
                           <textarea className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 leading-relaxed resize-none p-0 h-32" value={item.tujuanPembelajaran} onChange={e => updateDoc(doc(db, "analisis", item.id), { tujuanPembelajaran: e.target.value })} />
                        </td>
                        <td className="px-6 py-6 text-center">
                          <button onClick={() => deleteDoc(doc(db, "analisis", item.id))} className="p-2 text-slate-300 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalisisManager;
