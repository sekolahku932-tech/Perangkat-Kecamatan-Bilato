
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Kelas, JurnalItem, MATA_PELAJARAN, SchoolSettings, AcademicYear, User, PromesItem, RPMItem } from '../types';
// FIX: Added ArrowLeft to imports
import { 
  Plus, Trash2, Loader2, Cloud, Printer, CheckCircle2, AlertTriangle, 
  Wand2, Search, BookText, FileDown, RefreshCw,
  Sparkles, AlertCircle, Info, Lock, CalendarDays, BookOpen, User as UserIcon, X, ArrowLeft
} from 'lucide-react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from '../services/firebase';
import { generateJournalNarrative } from '../services/geminiService';

interface JurnalManagerProps {
  user: User;
}

const JurnalManager: React.FC<JurnalManagerProps> = ({ user }) => {
  const [jurnals, setJurnals] = useState<JurnalItem[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [rpmData, setRpmData] = useState<RPMItem[]>([]);
  const [promesData, setPromesData] = useState<PromesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeYear, setActiveYear] = useState('');
  const [selectedKelas, setSelectedKelas] = useState<Kelas>('1');
  const [selectedSemester, setSelectedSemester] = useState<'1' | '2'>('1');
  
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState<string | null>(null);
  const [isSyncingPromes, setIsSyncingPromes] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school,
    address: 'Jl. Trans Sulawesi, Kec. Bilato',
    principalName: 'Nama Kepala Sekolah',
    principalNip: '-'
  });

  const printRef = useRef<HTMLDivElement>(null);

  const isClassLocked = user.role === 'guru' && (user.teacherType === 'kelas' || (!user.teacherType && user.kelas !== '-' && user.kelas !== 'Multikelas'));

  useEffect(() => {
    if (user.role === 'guru') {
      if (user.kelas !== '-' && user.kelas !== 'Multikelas') {
        setSelectedKelas(user.kelas as Kelas);
      }
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const unsubSettings = onSnapshot(doc(db, "school_settings", user.school), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });

    const unsubYears = onSnapshot(collection(db, "academic_years"), (snap) => {
      const yearList = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AcademicYear[];
      setYears(yearList.filter(y => (y as any).school === user.school));
      const active = yearList.find(y => y.isActive && (y as any).school === user.school);
      if (active) setActiveYear(active.year);
    });

    const qJurnal = query(collection(db, "jurnal_harian"), where("userId", "==", user.id));
    const unsubJurnal = onSnapshot(qJurnal, (snapshot) => {
      setJurnals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as JurnalItem[]);
      setLoading(false);
    });

    const qRpm = query(collection(db, "rpm"), where("userId", "==", user.id));
    const unsubRpm = onSnapshot(qRpm, (snapshot) => {
      setRpmData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RPMItem[]);
    });

    const qPromes = query(collection(db, "promes"), where("userId", "==", user.id));
    const unsubPromes = onSnapshot(qPromes, (snapshot) => {
      setPromesData(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as PromesItem[]);
    });

    return () => { unsubSettings(); unsubYears(); unsubJurnal(); unsubRpm(); unsubPromes(); };
  }, [user.id, user.school]);

  const filteredJurnals = useMemo(() => {
    return jurnals
      .filter(j => j.tahunPelajaran === activeYear && j.kelas === selectedKelas)
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
  }, [jurnals, activeYear, selectedKelas]);

  const handleAddRow = async () => {
    try {
      await addDoc(collection(db, "jurnal_harian"), {
        userId: user.id,
        userName: user.name,
        tahunPelajaran: activeYear,
        kelas: selectedKelas,
        school: user.school,
        tanggal: new Date().toISOString().split('T')[0],
        mataPelajaran: MATA_PELAJARAN[0],
        materi: '',
        detailKegiatan: '',
        praktikPedagogis: 'Aktif',
        absenSiswa: '',
        catatanKejadian: ''
      });
    } catch (e) { console.error(e); }
  };

  const handleSyncFromPromes = async () => {
    if (!activeYear) {
      setMessage({ text: 'Tahun Pelajaran aktif tidak ditemukan!', type: 'error' });
      return;
    }
    setIsSyncingPromes(true);
    let count = 0;
    try {
      const monthMap: Record<string, number> = {
        'Januari': 0, 'Februari': 1, 'Maret': 2, 'April': 3, 'Mei': 4, 'Juni': 5,
        'Juli': 6, 'Agustus': 7, 'September': 8, 'Oktober': 9, 'November': 10, 'Desember': 11
      };
      const yearParts = activeYear.split('/');
      const yearStart = parseInt(yearParts[0]);
      const yearEnd = parseInt(yearParts[1]) || yearStart + 1;
      
      const filteredPromes = promesData.filter(p => 
        p.userId === user.id && p.kelas === selectedKelas && p.semester === selectedSemester && p.bulanPelaksanaan
      );
      
      if (filteredPromes.length === 0) {
        setMessage({ text: 'Tidak ada data Prosem Anda untuk disinkronkan.', type: 'warning' });
        setIsSyncingPromes(false);
        return;
      }

      for (const p of filteredPromes) {
        const matchingRpm = rpmData.find(r => 
          r.materi.toLowerCase().trim() === p.materiPokok.toLowerCase().trim() && 
          r.mataPelajaran === p.mataPelajaran
        );

        const dateEntries = p.bulanPelaksanaan.split(',');
        for (const entry of dateEntries) {
          const [bulan, minggu, tanggal] = entry.split('|');
          if (!bulan || !tanggal) continue;
          const monthIndex = monthMap[bulan];
          const year = monthIndex >= 6 ? yearStart : yearEnd;
          const formattedDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(tanggal).padStart(2, '0')}`;
          
          const isDuplicate = jurnals.some(j => 
            j.tanggal === formattedDate && j.mataPelajaran === p.mataPelajaran && j.materi === p.materiPokok && j.kelas === selectedKelas
          );

          if (!isDuplicate) {
            let detail = `Melaksanakan pembelajaran materi ${p.materiPokok} sesuai Program Semester.`;
            let model = 'Aktif';

            if (matchingRpm) {
              model = matchingRpm.praktikPedagogis || 'Aktif';
              const cleanAwal = matchingRpm.kegiatanAwal.replace(/Pertemuan \d+:/gi, '').substring(0, 150);
              const cleanInti = matchingRpm.kegiatanInti.replace(/Pertemuan \d+:/gi, '').substring(0, 300);
              detail = `Langkah Awal: ${cleanAwal}... \nLangkah Inti: ${cleanInti}... \nLangkah Penutup: Melakukan refleksi dan evaluasi hasil belajar.`;
            }

            await addDoc(collection(db, "jurnal_harian"), {
              userId: user.id, userName: user.name, tahunPelajaran: activeYear, kelas: selectedKelas, school: user.school,
              tanggal: formattedDate, mataPelajaran: p.mataPelajaran, materi: p.materiPokok,
              detailKegiatan: detail,
              praktikPedagogis: model, 
              absenSiswa: '', catatanKejadian: ''
            });
            count++;
          }
        }
      }
      setMessage({ text: `Berhasil sinkron ${count} log. Detail kegiatan & metode disinkronkan dari RPM Anda.`, type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Gagal sinkronisasi data.', type: 'error' });
    } finally {
      setIsSyncingPromes(false);
    }
  };

  const updateJurnal = async (id: string, field: keyof JurnalItem, value: any) => {
    try { await updateDoc(doc(db, "jurnal_harian", id), { [field]: value }); } catch (e) { console.error(e); }
  };

  const handleGenerateNarrative = async (item: JurnalItem) => {
    setIsLoadingAI(item.id);
    try {
      const refRpm = rpmData.find(r => r.materi.trim() === item.materi.trim() && r.mataPelajaran === item.mataPelajaran);
      const result = await generateJournalNarrative(item.kelas, item.mataPelajaran, item.materi, refRpm);
      if (result) {
        await updateDoc(doc(db, "jurnal_harian", item.id), {
          detailKegiatan: result.detail_kegiatan,
          praktikPedagogis: result.pedagogik
        });
        setMessage({ text: 'Narasi diringkas dari RPM Anda oleh AI!', type: 'success' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (e: any) { setMessage({ text: 'Gagal memanggil AI.', type: 'error' }); } 
    finally { setIsLoadingAI(null); }
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak Jurnal Harian</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body { font-family: 'Arial', sans-serif; padding: 20px; font-size: 8.5pt; color: black; }
              table { border-collapse: collapse; width: 100%; border: 1.5px solid black; }
              th, td { border: 1px solid black; padding: 6px; }
              th { background-color: #f3f4f6; text-transform: uppercase; font-weight: bold; }
              @media print { .no-print { display: none !important; } }
              .text-center { text-align: center; }
              .text-justify { text-align: justify; }
            </style>
          </head>
          <body onload="window.print(); window.close();">${content}</body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleExportWord = () => {
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Jurnal Harian</title><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid black; padding: 5px; font-family: 'Arial'; font-size: 9px; } .text-center { text-align: center; }</style></head><body>`;
    const footer = "</body></html>";
    let contentHtml = `<div style="text-align:center"><h1>JURNAL HARIAN MENGAJAR GURU</h1><h2>${settings.schoolName}</h2><p>Tahun Pelajaran: ${activeYear} | Kelas: ${selectedKelas}</p></div><br/>
    <table><thead><tr><th>TANGGAL</th><th>MATA PELAJARAN</th><th>MATERI POKOK</th><th>DETAIL KEGIATAN PEMBELAJARAN</th><th>MODEL/METODE</th><th>ABSENSI</th></tr></thead><tbody>
    ${filteredJurnals.map(j => `<tr><td class="text-center">${new Date(j.tanggal).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'})}</td><td>${j.mataPelajaran}</td><td><b>${j.materi}</b></td><td>${j.detailKegiatan}</td><td>${j.praktikPedagogis}</td><td>${j.absenSiswa || '-'}</td></tr>`).join('')}</tbody></table>`;
    const blob = new Blob(['\ufeff', header + contentHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `Jurnal_${selectedKelas}_${activeYear.replace('/','-')}.doc`; link.click();
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try { await deleteDoc(doc(db, "jurnal_harian", deleteConfirmId)); setDeleteConfirmId(null); } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {message && (<div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all animate-in slide-in-from-right ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}><CheckCircle2 size={20}/><span className="text-sm font-black uppercase tracking-tight">{message.text}</span></div>)}
      
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center"><div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} /></div><h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus Log Jurnal</h3><p className="text-slate-500 font-medium text-sm leading-relaxed">Hapus log jurnal ini dari cloud Anda?</p></div>
            <div className="p-4 bg-slate-50 flex gap-3"><button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 transition-all">BATAL</button><button onClick={executeDelete} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 transition-all shadow-lg">HAPUS</button></div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col xl:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg"><BookText size={24} /></div>
           <div>
             <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">Jurnal Harian Mengajar</h2>
             <p className="text-[10px] text-emerald-600 font-black uppercase mt-1">Status: Sinkronisasi Cloud Personal</p>
           </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
           <button onClick={handleSyncFromPromes} disabled={isSyncingPromes} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-50">
             {isSyncingPromes ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16}/>} SINKRON PROSEM & RPM
           </button>
           <button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black shadow-lg transition-all"><Printer size={16}/> PRATINJAU</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6">
         <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1">Kelas {isClassLocked && <Lock size={10} className="text-amber-500" />}</label>
            <select disabled={isClassLocked} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100 disabled:text-slate-400" value={selectedKelas} onChange={e => setSelectedKelas(e.target.value as Kelas)}>
              {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Tahun Pelajaran</label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={activeYear} onChange={e => setActiveYear(e.target.value)}>
              {years.map(y => <option key={y.id} value={y.year}>{y.year}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Periode Sinkronisasi</label>
            <select className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl p-3 text-sm font-black outline-none" value={selectedSemester} onChange={e => setSelectedSemester(e.target.value as any)}>
              <option value="1">Ganjil (Sem 1)</option>
              <option value="2">Genap (Sem 2)</option>
            </select>
          </div>
          <div className="flex flex-col justify-end">
             <button onClick={handleAddRow} className="bg-slate-900 text-white px-6 py-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg shadow-slate-100 uppercase tracking-widest">
               <Plus size={18}/> TAMBAH LOG MANUAL
             </button>
          </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-xl border border-slate-200 overflow-hidden">
         <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1500px]">
               <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black h-16 uppercase tracking-widest">
                     <th className="px-6 py-2 w-16 text-center border-r border-white/5">No</th>
                     <th className="px-6 py-2 w-48 border-r border-white/5">Waktu & Mapel</th>
                     <th className="px-6 py-2 w-64 border-r border-white/5">Materi Pokok</th>
                     <th className="px-6 py-2 border-r border-white/5">Rincian Kegiatan (Summary)</th>
                     <th className="px-6 py-2 w-48 border-r border-white/5">Model / Metode</th>
                     <th className="px-6 py-2 w-32 border-r border-white/5">Kehadiran</th>
                     <th className="px-6 py-2 w-20 text-center">Aksi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={7} className="py-32 text-center"><Loader2 size={48} className="animate-spin inline-block text-emerald-600 mb-4"/><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Menghubungkan ke Cloud...</p></td></tr>
                  ) : filteredJurnals.length === 0 ? (
                    <tr><td colSpan={7} className="py-32 text-center text-slate-400 italic font-bold uppercase text-xs">Jurnal kosong. Gunakan fitur "Sinkron Prosem & RPM" untuk mengotomatisasi pengisian jurnal.</td></tr>
                  ) : (
                    filteredJurnals.map((item, idx) => (
                      <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors align-top">
                        <td className="px-6 py-8 text-center font-black text-slate-300 border-r border-slate-50">{idx + 1}</td>
                        <td className="px-6 py-6 border-r border-slate-50 space-y-3">
                           <div><label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Tanggal</label><input type="date" className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-black outline-none" value={item.tanggal} onChange={e => updateJurnal(item.id, 'tanggal', e.target.value)} /></div>
                           <div><label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Mata Pelajaran</label><select className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg p-2 text-[10px] font-black outline-none" value={item.mataPelajaran} onChange={e => updateJurnal(item.id, 'mataPelajaran', e.target.value)}>{MATA_PELAJARAN.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                        </td>
                        <td className="px-6 py-6 border-r border-slate-50"><textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-black text-slate-900 leading-tight resize-none h-24 uppercase outline-none focus:ring-2 focus:ring-indigo-500" value={item.materi} onChange={e => updateJurnal(item.id, 'materi', e.target.value)} placeholder="Tulis materi pokok..." /></td>
                        <td className="px-6 py-6 border-r border-slate-50 relative group/cell">
                           <textarea className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-medium text-slate-700 leading-relaxed resize-none p-0 h-40 outline-none" value={item.detailKegiatan} onChange={e => updateJurnal(item.id, 'detailKegiatan', e.target.value)} placeholder="Deskripsikan apa yang terjadi di kelas..." />
                           <button onClick={() => handleGenerateNarrative(item)} disabled={isLoadingAI === item.id || !item.materi} title="Ringkas narasi dengan AI" className={`absolute bottom-4 right-4 p-2 bg-indigo-600 text-white rounded-xl shadow-lg transition-all opacity-0 group-hover/cell:opacity-100 active:scale-95 disabled:opacity-30 ${isLoadingAI === item.id ? 'animate-pulse' : ''}`}>
                             {isLoadingAI === item.id ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                           </button>
                        </td>
                        <td className="px-6 py-6 border-r border-slate-50"><input className="w-full bg-white border border-slate-200 rounded-lg p-3 text-[10px] font-bold text-slate-600 uppercase outline-none focus:ring-2 focus:ring-indigo-500" value={item.praktikPedagogis} onChange={e => updateJurnal(item.id, 'praktikPedagogis', e.target.value)} placeholder="Model/Metode" /></td>
                        <td className="px-6 py-6 border-r border-slate-50 space-y-2">
                           <input className="w-full bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-[10px] font-black text-emerald-700 outline-none" value={item.absenSiswa} onChange={e => updateJurnal(item.id, 'absenSiswa', e.target.value)} placeholder="Hadir Semua" />
                           <textarea className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-[9px] font-bold text-slate-400 h-16 outline-none" value={item.catatanKejadian} onChange={e => updateJurnal(item.id, 'catatanKejadian', e.target.value)} placeholder="Catatan Khusus (Opsional)" />
                        </td>
                        <td className="px-6 py-6 text-center"><button onClick={() => setDeleteConfirmId(item.id)} className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button></td>
                      </tr>
                    ))
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {isPrintMode && (
        <div className="fixed inset-0 bg-white z-[300] overflow-y-auto p-12 font-serif text-black">
          <div className="no-print mb-10 flex justify-between bg-slate-100 p-4 rounded-2xl border border-slate-200 font-sans shadow-xl sticky top-0">
             <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-10 py-3 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black transition-all">
                <ArrowLeft size={16}/> KEMBALI KE EDITOR
             </button>
             <div className="flex gap-3">
                <button onClick={handleExportWord} className="bg-blue-600 text-white px-8 py-3 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-blue-700 shadow-lg"><FileDown size={18}/> WORD</button>
                <button onClick={handlePrint} className="bg-rose-600 text-white px-8 py-3 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-rose-700 shadow-lg"><Printer size={18}/> CETAK PDF</button>
             </div>
          </div>
          <div ref={printRef} className="max-w-[29.7cm] mx-auto">
             <div className="text-center mb-8 border-b-4 border-double border-black pb-4">
                <h1 className="text-2xl font-black uppercase tracking-widest leading-none">JURNAL HARIAN MENGAJAR GURU</h1>
                <h2 className="text-xl font-bold mt-2 uppercase">{settings.schoolName}</h2>
                <div className="flex justify-center gap-12 mt-6 text-[10px] font-black uppercase font-sans">
                   <div className="flex"><span>KELAS</span><span className="mx-2">:</span><span>{selectedKelas}</span></div>
                   <div className="flex"><span>TAHUN PELAJARAN</span><span className="mx-2">:</span><span>{activeYear}</span></div>
                   <div className="flex"><span>GURU</span><span className="mx-2">:</span><span>{user.name}</span></div>
                </div>
             </div>
             
             <table className="w-full border-collapse border-2 border-black text-[9px] font-sans">
                <thead>
                   <tr className="bg-slate-50 uppercase font-black text-center h-12">
                      <th className="w-8">NO</th>
                      <th className="w-24">HARI / TANGGAL</th>
                      <th className="w-32">MATA PELAJARAN</th>
                      <th className="w-48">MATERI POKOK</th>
                      <th>RINGKASAN KEGIATAN PEMBELAJARAN</th>
                      <th className="w-24">MODEL/METODE</th>
                      <th className="w-24">ABSENSI / CATATAN</th>
                   </tr>
                </thead>
                <tbody>
                   {filteredJurnals.length === 0 ? (
                     <tr><td colSpan={7} className="p-10 text-center italic text-slate-400">Belum ada data jurnal yang dicatat.</td></tr>
                   ) : (
                     filteredJurnals.map((j, i) => (
                       <tr key={j.id} className="break-inside-avoid">
                          <td className="text-center p-2 font-bold">{i+1}</td>
                          <td className="text-center p-2 font-bold uppercase">{new Date(j.tanggal).toLocaleDateString('id-ID', {weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'})}</td>
                          <td className="p-2 font-black uppercase leading-tight">{j.mataPelajaran}</td>
                          <td className="p-2 font-black uppercase leading-tight">{j.materi}</td>
                          <td className="p-2 text-justify leading-relaxed">{j.detailKegiatan}</td>
                          <td className="p-2 text-center font-bold uppercase">{j.praktikPedagogis}</td>
                          <td className="p-2 text-[8px] italic leading-tight">
                             <p className="font-black text-emerald-800 not-italic mb-1 underline">Absensi: {j.absenSiswa || '-'}</p>
                             {j.catatanKejadian}
                          </td>
                       </tr>
                     ))
                   )}
                </tbody>
             </table>

             <div className="mt-16 grid grid-cols-2 text-center text-[10px] font-black uppercase font-sans break-inside-avoid px-20">
                <div>
                   <p>Mengetahui,</p>
                   <p>Kepala Sekolah</p>
                   <div className="h-24"></div>
                   <p className="border-b-2 border-black inline-block min-w-[200px]">{settings.principalName}</p>
                   <p className="mt-1 font-normal tracking-tight">NIP. {settings.principalNip}</p>
                </div>
                <div>
                   <p>Bilato, {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
                   <p>Guru Kelas / Mata Pelajaran</p>
                   <div className="h-24"></div>
                   <p className="border-b-2 border-black inline-block min-w-[200px]">{user.name}</p>
                   <p className="mt-1 font-normal tracking-tight">NIP. {user.nip}</p>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JurnalManager;
