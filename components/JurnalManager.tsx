
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Kelas, JurnalItem, MATA_PELAJARAN, SchoolSettings, AcademicYear, User, PromesItem, RPMItem } from '../types';
import { 
  Plus, Trash2, Loader2, Cloud, Printer, CheckCircle2, AlertTriangle, 
  Wand2, Search, BookText, FileDown, RefreshCw,
  Sparkles, AlertCircle, Info, Lock, CalendarDays, BookOpen, User as UserIcon, X, ArrowLeft, ChevronRight, PenTool
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
    address: 'Kecamatan Bilato, Kabupaten Gorontalo',
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
    return jurnals.filter(j => {
      const date = new Date(j.tanggal);
      const month = date.getMonth() + 1; // 1-12
      // Filter SMT 1: Juli(7) - Des(12), SMT 2: Jan(1) - Juni(6)
      const isCorrectSemester = selectedSemester === '1' 
        ? (month >= 7 && month <= 12) 
        : (month >= 1 && month <= 6);
      
      return j.tahunPelajaran === activeYear && j.kelas === selectedKelas && isCorrectSemester;
    }).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
  }, [jurnals, activeYear, selectedKelas, selectedSemester]);

  const handleGenerateNarrative = async (item: JurnalItem) => {
    setIsLoadingAI(item.id);
    try {
      const refRpm = rpmData.find(r => 
        (r.materi.trim().toLowerCase() === item.materi.trim().toLowerCase() || r.tujuanPembelajaran.trim().toLowerCase().includes(item.materi.trim().toLowerCase())) && 
        r.mataPelajaran === item.mataPelajaran
      );
      
      const result = await generateJournalNarrative(item.kelas, item.mataPelajaran, item.materi, refRpm);
      if (result) {
        await updateDoc(doc(db, "jurnal_harian", item.id), {
          detailKegiatan: result.detail_kegiatan,
          praktikPedagogis: result.pedagogik || refRpm?.praktikPedagogis || item.praktikPedagogis
        });
        setMessage({ text: 'Narasi diringkas AI dari RPM!', type: 'success' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (e: any) { 
      setMessage({ text: 'Gagal memproses AI.', type: 'error' }); 
    } finally { 
      setIsLoadingAI(null); 
    }
  };

  const updateJurnal = async (id: string, field: keyof JurnalItem, value: any) => {
    try { await updateDoc(doc(db, "jurnal_harian", id), { [field]: value }); } catch (e) { console.error(e); }
  };

  const handleSyncFromPromes = async () => {
    if (!activeYear) {
      setMessage({ text: 'Tahun Pelajaran belum aktif!', type: 'warning' });
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
      
      // Filter Promes sesuai pilihan di UI Jurnal
      const filteredPromes = promesData.filter(p => 
        p.userId === user.id && 
        p.kelas === selectedKelas && 
        p.semester === selectedSemester && 
        p.bulanPelaksanaan
      );

      if (filteredPromes.length === 0) {
        setMessage({ text: 'Data Prosem tidak ditemukan untuk filter ini!', type: 'warning' });
        setIsSyncingPromes(false);
        return;
      }

      for (const p of filteredPromes) {
        const dateEntries = p.bulanPelaksanaan.split(',');
        for (const entry of dateEntries) {
          const parts = entry.split('|');
          if (parts.length < 3) continue;
          
          const bulan = parts[0];
          const tanggal = parts[2];
          
          const monthIndex = monthMap[bulan];
          const year = monthIndex >= 6 ? yearStart : yearEnd;
          const formattedDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(tanggal).padStart(2, '0')}`;
          
          const isDuplicate = jurnals.some(j => 
            j.tanggal === formattedDate && 
            j.mataPelajaran === p.mataPelajaran && 
            j.kelas === selectedKelas
          );

          if (!isDuplicate) {
            // Temukan RPM terkait untuk mengambil Model Pembelajaran & Kegiatan
            const refRpm = rpmData.find(r => 
               r.tujuanPembelajaran === p.tujuanPembelajaran && 
               r.mataPelajaran === p.mataPelajaran &&
               r.kelas === p.kelas
            );

            await addDoc(collection(db, "jurnal_harian"), {
              userId: user.id, 
              userName: user.name, 
              tahunPelajaran: activeYear, 
              kelas: selectedKelas, 
              school: user.school,
              tanggal: formattedDate, 
              mataPelajaran: p.mataPelajaran, 
              materi: p.materiPokok || 'Evaluasi Pembelajaran',
              detailKegiatan: refRpm ? `Melaksanakan KBM: ${refRpm.materi}. (Gunakan tombol AI untuk merangkum rincian langkah).` : `Melaksanakan KBM mata pelajaran ${p.mataPelajaran} dengan topik ${p.materiPokok || 'Evaluasi'}.`, 
              praktikPedagogis: refRpm?.praktikPedagogis || 'Pembelajaran Aktif', 
              absenSiswa: '', 
              catatanKejadian: ''
            });
            count++;
          }
        }
      }
      setMessage({ text: `Berhasil sinkron ${count} log kegiatan (Tertaut RPM)!`, type: 'success' });
    } catch (err) { 
      console.error(err); 
      setMessage({ text: 'Terjadi kesalahan sinkronisasi.', type: 'error' });
    } finally { 
      setIsSyncingPromes(false); 
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleAddManual = async () => {
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
        praktikPedagogis: '',
        absenSiswa: '',
        catatanKejadian: ''
      });
    } catch (e) { console.error(e); }
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try { 
      await deleteDoc(doc(db, "jurnal_harian", deleteConfirmId)); 
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
            <title>Jurnal Harian - ${user.name}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Inter', sans-serif; background: white; padding: 20px; font-size: 9pt; color: black; }
              @media print { .no-print { display: none !important; } body { padding: 0; } }
              table { border-collapse: collapse; width: 100% !important; border: 1.5px solid black; }
              th, td { border: 1px solid black; padding: 6px; vertical-align: top; }
              .break-inside-avoid { page-break-inside: avoid; }
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
      <div className="bg-white min-h-screen text-slate-900 font-sans print:p-0">
        <div className="no-print p-4 flex justify-between bg-slate-900 sticky top-0 z-[100]">
          <button onClick={() => setIsPrintMode(false)} className="text-white px-6 py-2 rounded-xl text-xs font-black bg-white/10 hover:bg-white/20 transition-all flex items-center gap-2">
            <ArrowLeft size={16}/> KEMBALI KE EDITOR
          </button>
          <button onClick={handlePrint} className="bg-rose-600 text-white px-8 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2">
            <Printer size={16}/> CETAK PDF SEKARANG
          </button>
        </div>
        
        <div ref={printRef} className="max-w-[29.7cm] mx-auto p-10 bg-white space-y-8">
           <div className="text-center border-b-[3px] border-black pb-4">
              <h1 className="text-[20pt] font-black uppercase tracking-tight leading-none mb-2">JURNAL HARIAN MENGAJAR GURU</h1>
              <h2 className="text-[12pt] font-bold uppercase">{settings.schoolName}</h2>
           </div>

           <div className="grid grid-cols-2 gap-8 text-[10pt] font-bold uppercase">
              <div className="space-y-1">
                 <p>NAMA GURU : {user.name}</p>
                 <p>NIP : {user.nip}</p>
                 <p>SATUAN PENDIDIKAN : {settings.schoolName}</p>
              </div>
              <div className="space-y-1 text-right">
                 <p>TAHUN PELAJARAN : {activeYear}</p>
                 <p>KELAS : {selectedKelas}</p>
                 <p>SEMESTER : {selectedSemester}</p>
              </div>
           </div>

           <table className="w-full text-[9pt]">
              <thead>
                 <tr className="bg-slate-100 uppercase font-black text-center">
                    <th className="w-10">NO</th>
                    <th className="w-32">HARI / TANGGAL</th>
                    <th className="w-40">MATA PELAJARAN</th>
                    <th className="w-64">MATERI PEMBELAJARAN</th>
                    <th>DETAIL KEGIATAN & MODEL (RPM)</th>
                    <th className="w-24">PARAF GURU</th>
                 </tr>
              </thead>
              <tbody>
                 {filteredJurnals.length === 0 ? (
                   <tr><td colSpan={6} className="p-10 text-center italic text-slate-400">Belum ada catatan jurnal untuk filter ini.</td></tr>
                 ) : (
                   filteredJurnals.map((item, idx) => {
                     const tgl = new Date(item.tanggal);
                     const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][tgl.getDay()];
                     const tglIndo = tgl.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                     
                     return (
                       <tr key={item.id} className="break-inside-avoid">
                          <td className="text-center font-bold">{idx + 1}</td>
                          <td className="font-bold">{hari},<br/>{tglIndo}</td>
                          <td className="font-black uppercase">{item.mataPelajaran}</td>
                          <td className="uppercase font-bold text-xs">{item.materi}</td>
                          <td className="text-justify leading-relaxed">
                             <p className="font-medium mb-1">{item.detailKegiatan}</p>
                             <p className="text-[8pt] font-black italic text-indigo-700">Model Pembelajaran: {item.praktikPedagogis}</p>
                          </td>
                          <td className="text-center h-20 align-middle">
                             {/* Kolom Paraf Sengaja Dikosongkan untuk Tanda Tangan Basah */}
                          </td>
                       </tr>
                     );
                   })
                 )}
              </tbody>
           </table>

           <div className="mt-16 grid grid-cols-2 text-center text-[10pt] font-black uppercase font-sans break-inside-avoid">
              <div>
                 <p>Mengetahui,</p>
                 <p>Kepala Sekolah</p>
                 <div className="h-24"></div>
                 <p className="border-b-[2.5px] border-black inline-block min-w-[220px] mb-1">{settings.principalName}</p>
                 <p className="font-normal no-underline">NIP. {settings.principalNip}</p>
              </div>
              <div>
                 <p>Bilato, ........................</p>
                 <p>Guru Kelas / Mata Pelajaran</p>
                 <div className="h-24"></div>
                 <p className="border-b-[2.5px] border-black inline-block min-w-[220px] mb-1">{user.name}</p>
                 <p className="font-normal no-underline">NIP. {user.nip}</p>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 font-sans">
      {message && (<div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}><CheckCircle2 size={20}/> <span className="text-sm font-black uppercase tracking-tight">{message.text}</span></div>)}
      
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-sm p-8 text-center animate-in zoom-in-95"><div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} /></div><h3 className="text-xl font-black uppercase mb-2">Hapus Log?</h3><p className="text-slate-500 text-sm mb-6">Tindakan ini tidak dapat dibatalkan.</p><div className="flex gap-3"><button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 rounded-xl font-black text-slate-500 bg-slate-50 border">BATAL</button><button onClick={executeDelete} className="flex-1 py-3 rounded-xl font-black text-white bg-red-600 shadow-lg">HAPUS</button></div></div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col xl:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg"><BookText size={24} /></div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 leading-none">Jurnal Harian Mengajar</h2>
            <p className="text-[10px] text-emerald-600 font-black uppercase mt-1">Sinkronisasi Rencana & Realisasi (RPM Terintegrasi)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
           <button onClick={handleAddManual} className="bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-slate-200 transition-all"><Plus size={16}/> TAMBAH MANUAL</button>
           <button onClick={handleSyncFromPromes} disabled={isSyncingPromes} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">
             {isSyncingPromes ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>} SINKRON PROSEM & RPM
           </button>
           <button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black transition-all shadow-lg"><Printer size={16}/> PRATINJAU & CETAK</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1">Pilih Kelas {isClassLocked && <Lock size={10} className="text-amber-500" />}</label>
            <select disabled={isClassLocked} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100" value={selectedKelas} onChange={e => setSelectedKelas(e.target.value as Kelas)}>
              {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Semester Aktif</label>
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
               <button onClick={() => setSelectedSemester('1')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${selectedSemester === '1' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>GANJIL (1)</button>
               <button onClick={() => setSelectedSemester('2')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${selectedSemester === '2' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>GENAP (2)</button>
            </div>
          </div>
          <div className="w-full md:w-64">
             <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Tahun Pelajaran</label>
             <div className="bg-indigo-50 text-indigo-700 p-3 rounded-xl border border-indigo-100 text-sm font-black text-center uppercase">{activeYear || 'Belum Diatur'}</div>
          </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-xl border border-slate-200 overflow-hidden min-h-[500px]">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1500px]">
               <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black h-16 uppercase tracking-widest">
                     <th className="px-6 py-2 w-16 text-center border-r border-white/5">No</th>
                     <th className="px-6 py-2 w-56 border-r border-white/5">Tanggal & Mata Pelajaran</th>
                     <th className="px-6 py-2 w-64 border-r border-white/5">Materi Pokok</th>
                     <th className="px-6 py-2 border-r border-white/5 bg-slate-800">Detail Kegiatan (Rangkuman RPM)</th>
                     <th className="px-6 py-2 w-48 border-r border-white/5">Paraf & Absensi</th>
                     <th className="px-6 py-2 w-20 text-center">Aksi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredJurnals.length === 0 ? (
                    <tr><td colSpan={6} className="py-40 text-center"><div className="flex flex-col items-center gap-4 text-slate-300"><CalendarDays size={48} /><p className="font-black uppercase text-xs tracking-widest">Belum ada log kegiatan. Klik 'Sinkron Prosem' untuk otomatisasi.</p></div></td></tr>
                  ) : filteredJurnals.map((item, idx) => (
                    <tr key={item.id} className="group hover:bg-slate-50 transition-colors align-top">
                       <td className="px-6 py-8 text-center font-black text-slate-300 border-r border-slate-50">{idx + 1}</td>
                       <td className="px-6 py-6 space-y-2 border-r border-slate-50">
                          <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500" value={item.tanggal} onChange={e => updateJurnal(item.id, 'tanggal', e.target.value)} />
                          <select className="w-full bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-[10px] font-black text-indigo-700 outline-none" value={item.mataPelajaran} onChange={e => updateJurnal(item.id, 'mataPelajaran', e.target.value)}>
                             {MATA_PELAJARAN.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                       </td>
                       <td className="px-6 py-6 border-r border-slate-50">
                          <textarea className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[11px] font-black uppercase h-24 resize-none outline-none focus:border-indigo-500 shadow-sm" value={item.materi} onChange={e => updateJurnal(item.id, 'materi', e.target.value)} placeholder="Materi..." />
                       </td>
                       <td className="px-6 py-6 relative group/cell border-r border-slate-50">
                          <textarea className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-medium h-40 leading-relaxed resize-none p-0" value={item.detailKegiatan} onChange={e => updateJurnal(item.id, 'detailKegiatan', e.target.value)} placeholder="Tulis rincian pelaksanaan pembelajaran atau gunakan AI untuk meringkas dari RPM..." />
                          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-50">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Model Pembelajaran:</span>
                             <input className="flex-1 bg-slate-50 border-none rounded p-1 text-[10px] font-bold text-indigo-600" value={item.praktikPedagogis} onChange={e => updateJurnal(item.id, 'praktikPedagogis', e.target.value)} placeholder="Ambil dari RPM..." />
                          </div>
                          <button onClick={() => handleGenerateNarrative(item)} disabled={isLoadingAI === item.id} className="absolute bottom-6 right-6 p-2.5 bg-indigo-600 text-white rounded-xl shadow-xl opacity-0 group-hover/cell:opacity-100 transition-all hover:scale-110 active:scale-95 disabled:opacity-50">
                             {isLoadingAI === item.id ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                          </button>
                       </td>
                       <td className="px-6 py-6 space-y-3 border-r border-slate-50">
                          <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50/50 mb-3">
                             <PenTool size={20} className="text-slate-300 mb-1" />
                             <p className="text-[8px] font-black text-slate-400 uppercase">Kolom Paraf</p>
                          </div>
                          <div>
                             <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Absensi/Catatan</label>
                             <textarea className="w-full bg-white border border-slate-100 rounded p-2 text-[10px] font-medium h-20 resize-none outline-none focus:border-indigo-500" value={item.absenSiswa} onChange={e => updateJurnal(item.id, 'absenSiswa', e.target.value)} placeholder="Siswa tidak hadir / Kejadian..." />
                          </div>
                       </td>
                       <td className="px-6 py-6 text-center">
                          <button onClick={() => setDeleteConfirmId(item.id)} className="p-3 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={20} /></button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default JurnalManager;
