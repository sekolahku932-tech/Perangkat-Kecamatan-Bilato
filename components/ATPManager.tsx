
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, ATPItem, AnalisisCP, CapaianPembelajaran, MATA_PELAJARAN, DIMENSI_PROFIL, SchoolSettings, User } from '../types';
import { Plus, Trash2, Sparkles, Loader2, Save, Eye, EyeOff, Search, CheckCircle2, X, AlertTriangle, RefreshCcw, Info, ClipboardCopy, Cloud, DownloadCloud, FileDown, Printer, Edit2, Wand2, Lock, ListTree, Copy, AlertCircle, ArrowLeft } from 'lucide-react';
import { completeATPDetails } from '../services/geminiService';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from '../services/firebase';

interface ATPManagerProps {
  user: User;
}

const ATPManager: React.FC<ATPManagerProps> = ({ user }) => {
  const [atpData, setAtpData] = useState<ATPItem[]>([]);
  const [cps, setCps] = useState<CapaianPembelajaran[]>([]);
  const [allAnalisis, setAllAnalisis] = useState<AnalisisCP[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  
  const [filterFase, setFilterFase] = useState<Fase>(Fase.A);
  const [filterKelas, setFilterKelas] = useState<Kelas>('1');
  const [filterMapel, setFilterMapel] = useState<string>(MATA_PELAJARAN[0]);
  
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school,
    address: '-',
    principalName: '-',
    principalNip: '-'
  });

  const [activeYear, setActiveYear] = useState('2024/2025');
  const printRef = useRef<HTMLDivElement>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

    const qAtp = query(collection(db, "atp"), where("userId", "==", user.id));
    const unsubATP = onSnapshot(qAtp, (snap) => {
      setAtpData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ATPItem[]);
    });

    const qCp = query(collection(db, "cps"), where("school", "==", user.school));
    const unsubCp = onSnapshot(qCp, snap => {
      setCps(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CapaianPembelajaran[]);
    });

    const qAnalisis = query(collection(db, "analisis"), where("userId", "==", user.id));
    const unsubAnalisis = onSnapshot(qAnalisis, snap => {
      setAllAnalisis(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AnalisisCP[]);
      setLoading(false);
    });

    return () => { unsubSettings(); unsubYears(); unsubATP(); unsubCp(); unsubAnalisis(); };
  }, [user.school, user.id]);

  const filteredAtp = useMemo(() => {
    const currentMapelNormalized = filterMapel.trim().toLowerCase();
    return atpData
      .filter(item => 
        item.fase === filterFase && 
        item.kelas === filterKelas && 
        (item.mataPelajaran || '').trim().toLowerCase() === currentMapelNormalized
      )
      .sort((a, b) => (a.indexOrder || 0) - (b.indexOrder || 0));
  }, [atpData, filterFase, filterKelas, filterMapel]);

  const handleAIComplete = async (id: string) => {
    const item = atpData.find(i => i.id === id);
    if (!item || !item.tujuanPembelajaran) return;
    if (!user.apiKey) {
      setMessage({ text: 'API Key Personal Belum Diatur!', type: 'error' });
      return;
    }

    setIsProcessingId(id);
    try {
      const suggestions = await completeATPDetails(item.tujuanPembelajaran, item.materi, item.kelas, user.apiKey);
      if (suggestions) {
        await updateDoc(doc(db, "atp", id), {
          alurTujuanPembelajaran: suggestions.alurTujuan,
          alokasiWaktu: suggestions.alokasiWaktu,
          dimensiProfilLulusan: suggestions.dimensiOfProfil,
          asesmenAwal: suggestions.asesmenAwal,
          asesmenProses: suggestions.asesmenProses,
          asesmenAkhir: suggestions.asesmenAkhir,
          sumberBelajar: suggestions.sumberBelajar
        });
        setMessage({ text: 'Detail ATP dilengkapi AI!', type: 'success' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      setMessage({ text: 'Gagal memproses AI.', type: 'error' });
    } finally { setIsProcessingId(null); }
  };

  const handleSyncFromAnalisis = async () => {
    setLoading(true);
    try {
      const sourceAnalisis = allAnalisis
        .filter(a => 
          a.fase === filterFase && 
          a.kelas === filterKelas && 
          (a.mataPelajaran || '').trim().toLowerCase() === filterMapel.trim().toLowerCase()
        )
        .sort((a, b) => (a.indexOrder || 0) - (b.indexOrder || 0));

      if (sourceAnalisis.length === 0) {
        setMessage({ text: 'Tidak ada data Analisis CP Anda.', type: 'error' });
        setLoading(false);
        return;
      }

      let count = 0;
      for (const a of sourceAnalisis) {
        const alreadyExists = atpData.some(atp => 
          atp.tujuanPembelajaran.trim().toLowerCase() === a.tujuanPembelajaran.trim().toLowerCase() && 
          atp.kelas === filterKelas && 
          atp.fase === filterFase
        );

        if (!alreadyExists) {
          const cpInfo = cps.find(cp => cp.id === a.cpId);
          await addDoc(collection(db, "atp"), {
            userId: user.id,
            kodeCP: a.kodeCP || cpInfo?.kode || '-', 
            fase: a.fase,
            kelas: a.kelas,
            mataPelajaran: a.mataPelajaran,
            elemen: cpInfo?.elemen || '-',
            capaianPembelajaran: cpInfo?.deskripsi || '-',
            materi: a.materi,
            subMateri: a.subMateri || '',
            tujuanPembelajaran: a.tujuanPembelajaran,
            alurTujuanPembelajaran: '', 
            alokasiWaktu: '4 JP', 
            dimensiProfilLulusan: a.profilLulusan || '',
            asesmenAwal: '',
            asesmenProses: '',
            asesmenAkhir: '',
            sumberBelajar: '',
            indexOrder: a.indexOrder || 0,
            school: user.school
          });
          count++;
        }
      }
      
      setMessage({ text: `Berhasil sinkron ${count} item ke ATP Anda.`, type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ text: 'Kesalahan sinkronisasi.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const updateField = async (id: string, field: keyof ATPItem, value: any) => {
    try {
      await updateDoc(doc(db, "atp", id), { [field]: value });
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, "atp", deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (e) { console.error(e); }
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak ATP - ${user.school}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Inter', sans-serif; background: white; padding: 20px; font-size: 8pt; }
              @media print { .no-print { display: none !important; } body { padding: 0; } }
              table { border-collapse: collapse; width: 100%; border: 1.5px solid black; }
              th, td { border: 1px solid black; padding: 4px; }
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

  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';
  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || []);

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
            <h1 className="text-xl font-black uppercase border-b-4 border-black pb-2 inline-block">Alur Tujuan Pembelajaran (ATP)</h1>
            <h2 className="text-lg font-bold mt-3 uppercase">{settings.schoolName}</h2>
            <div className="flex justify-center gap-10 mt-6 text-[9px] font-black uppercase font-sans text-slate-500 tracking-widest">
              <span>MAPEL: {filterMapel}</span> <span>FASE/KELAS: {filterFase} / {filterKelas}</span> <span>TAHUN: {activeYear}</span>
            </div>
          </div>

          <table className="w-full border-collapse border-2 border-black text-[8px]">
            <thead>
              <tr className="bg-slate-50">
                <th className="border-2 border-black p-2 w-8">NO</th>
                <th className="border-2 border-black p-2 w-16">KODE</th>
                <th className="border-2 border-black p-2 w-32">ELEMEN / CP</th>
                <th className="border-2 border-black p-2 w-48">TUJUAN PEMBELAJARAN (TP)</th>
                <th className="border-2 border-black p-2 w-56">ALUR TUJUAN PEMBELAJARAN (ATP)</th>
                <th className="border-2 border-black p-2 w-16">MATERI / AW</th>
                <th className="border-2 border-black p-2 w-32">DIMENSI PROFIL LULUSAN</th>
                <th className="border-2 border-black p-2">RENCANA ASESMEN</th>
              </tr>
            </thead>
            <tbody>
              {filteredAtp.map((item, idx) => (
                <tr key={item.id} className="break-inside-avoid align-top">
                  <td className="border-2 border-black p-2 text-center font-bold">{idx + 1}</td>
                  <td className="border-2 border-black p-2 text-center font-black">{item.kodeCP || '-'}</td>
                  <td className="border-2 border-black p-2 leading-tight">
                    <span className="font-black block uppercase mb-1">{item.elemen}</span>
                    <span className="italic text-slate-600 line-clamp-6">{item.capaianPembelajaran}</span>
                  </td>
                  <td className="border-2 border-black p-2 font-bold leading-tight">{item.tujuanPembelajaran}</td>
                  <td className="border-2 border-black p-2 leading-tight italic">{item.alurTujuanPembelajaran}</td>
                  <td className="border-2 border-black p-2 text-center">
                    <span className="block font-black uppercase mb-1">{item.materi}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-bold border border-slate-300">{item.alokasiWaktu}</span>
                  </td>
                  <td className="border-2 border-black p-2 leading-tight text-[7px] font-medium">{item.dimensiProfilLulusan}</td>
                  <td className="border-2 border-black p-2 leading-tight">
                    <p><b>Awal:</b> {item.asesmenAwal}</p>
                    <p><b>Proses:</b> {item.asesmenProses}</p>
                    <p><b>Akhir:</b> {item.asesmenAkhir}</p>
                  </td>
                </tr>
              ))}
              {filteredAtp.length === 0 && (
                <tr><td colSpan={8} className="p-10 text-center italic">Belum ada data ATP.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative">
      {message && (
        <div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all animate-in slide-in-from-right ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 
          message.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
          <span className="text-sm font-black uppercase tracking-tight">{message.text}</span>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} /></div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus ATP</h3>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">Hapus baris ATP ini?</p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 transition-all">BATAL</button>
              <button onClick={handleDelete} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 transition-all shadow-lg">YA, HAPUS</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
           <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><ListTree size={24} /></div>
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">Alur Tujuan Pembelajaran (ATP)</h2>
                <p className="text-[10px] text-blue-600 font-black uppercase mt-1">Sistem Cloud Aktif</p>
              </div>
           </div>
           <div className="flex flex-wrap gap-2">
             <button onClick={handleSyncFromAnalisis} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg">
                <Copy size={16}/> AMBIL DATA ANALISIS CP
             </button>
             <button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black shadow-lg transition-all shadow-lg">
                <Printer size={16}/> PRATINJAU
             </button>
           </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-[24px] border border-slate-100">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1">Fase {isClassLocked && <Lock size={10} className="text-amber-500" />}</label>
            <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100" value={filterFase} disabled={isClassLocked} onChange={(e) => setFilterFase(e.target.value as Fase)}>
              {Object.values(Fase).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1">Kelas</label>
            <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100" value={filterKelas} disabled={isClassLocked} onChange={(e) => handleKelasChange(e.target.value as Kelas)}>
              {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
            </select>
          </div>
          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Mapel</label><select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={filterMapel} onChange={(e) => setFilterMapel(e.target.value)}>{availableMapel.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-xl border border-slate-200 overflow-hidden min-h-[500px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[2200px]">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black h-16 uppercase tracking-widest">
                <th className="px-6 py-4 w-16 text-center border-r border-white/5">No</th>
                <th className="px-6 py-4 w-24 text-center border-r border-white/5">Kode CP</th>
                <th className="px-6 py-4 w-72 border-r border-white/5">Elemen & Capaian (CP)</th>
                <th className="px-6 py-4 w-64 border-r border-white/5">Tujuan Pembelajaran (TP)</th>
                <th className="px-6 py-4 w-80 border-r border-white/5 bg-slate-800">Alur Tujuan (ATP)</th>
                <th className="px-6 py-4 w-48 border-r border-white/5">Materi & AW</th>
                <th className="px-6 py-4 w-64 border-r border-white/5">Dimensi Profil Lulusan</th>
                <th className="px-6 py-4 w-80 border-r border-white/5">Rencana Asesmen</th>
                <th className="px-6 py-4 w-32 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="py-20 text-center"><Loader2 className="animate-spin inline-block text-blue-600" /></td></tr>
              ) : filteredAtp.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-24 text-center text-slate-400 italic font-bold uppercase text-xs">Data ATP kosong.</td></tr>
              ) : (
                filteredAtp.map((item, idx) => (
                  <tr key={item.id} className="align-top group hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-6 text-center font-black text-slate-300">{idx + 1}</td>
                    <td className="px-6 py-6 border-r border-slate-50 text-center">
                       <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black border border-indigo-100 uppercase">
                         {item.kodeCP || '-'}
                       </span>
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50">
                      <div className="font-black text-[10px] text-blue-600 uppercase mb-2">{item.elemen}</div>
                      <div className="text-[10px] text-slate-400 italic leading-relaxed line-clamp-6">{item.capaianPembelajaran}</div>
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50">
                      <textarea className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-900 leading-relaxed resize-none p-0 h-32" value={item.tujuanPembelajaran} onChange={e => updateField(item.id, 'tujuanPembelajaran', e.target.value)} />
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50 bg-blue-50/10">
                      <textarea className="w-full bg-transparent border-none focus:ring-0 text-xs font-medium text-blue-900 leading-relaxed resize-none p-0 h-32" value={item.alurTujuanPembelajaran} onChange={e => updateField(item.id, 'alurTujuanPembelajaran', e.target.value)} placeholder="Tulis rincian alur..." />
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50">
                      <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-black uppercase mb-2" value={item.materi} onChange={e => updateField(item.id, 'materi', e.target.value)} placeholder="Materi" />
                      <div className="flex items-center gap-2">
                        <input 
                          className="w-full bg-slate-900 text-white border-none rounded-lg p-2 text-center text-xs font-black" 
                          value={item.alokasiWaktu} 
                          onChange={e => updateField(item.id, 'alokasiWaktu', e.target.value)} 
                          placeholder="4 JP" 
                        />
                      </div>
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50 relative">
                       <textarea 
                          className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-black text-indigo-700 leading-relaxed resize-none p-0 h-32 italic" 
                          value={item.dimensiProfilLulusan} 
                          onChange={e => updateField(item.id, 'dimensiProfilLulusan', e.target.value)}
                       />
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50 space-y-2">
                       <div><label className="text-[8px] font-black text-slate-400 uppercase">Awal</label><input className="w-full bg-slate-50 border border-slate-100 p-2 rounded text-[10px]" value={item.asesmenAwal} onChange={e => updateField(item.id, 'asesmenAwal', e.target.value)} /></div>
                       <div><label className="text-[8px] font-black text-slate-400 uppercase">Proses</label><input className="w-full bg-slate-50 border border-slate-100 p-2 rounded text-[10px]" value={item.asesmenProses} onChange={e => updateField(item.id, 'asesmenProses', e.target.value)} /></div>
                       <div><label className="text-[8px] font-black text-slate-400 uppercase">Akhir</label><input className="w-full bg-slate-50 border border-slate-100 p-2 rounded text-[10px]" value={item.asesmenAkhir} onChange={e => updateField(item.id, 'asesmenAkhir', e.target.value)} /></div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button title="AI Personal Suggestion" onClick={() => handleAIComplete(item.id)} disabled={isProcessingId === item.id} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 shadow-lg disabled:opacity-50">
                          {isProcessingId === item.id ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                        </button>
                        <button title="Hapus" onClick={() => setDeleteConfirmId(item.id)} className="bg-red-50 text-red-600 p-3 rounded-xl hover:bg-red-600 hover:text-white transition-all">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ATPManager;
