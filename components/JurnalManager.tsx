
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Kelas, JurnalItem, MATA_PELAJARAN, SchoolSettings, AcademicYear, User, PromesItem, RPMItem } from '../types';
import { 
  Plus, Trash2, Loader2, Cloud, Printer, CheckCircle2, AlertTriangle, 
  RefreshCw,
  Sparkles, BookText, ArrowLeft
} from 'lucide-react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from '../services/firebase';
import { generateJournalNarrative } from '../services/geminiService';

interface JurnalManagerProps {
  user: User;
}

const JurnalManager: React.FC<JurnalManagerProps> = ({ user }) => {
  const [jurnals, setJurnals] = useState<JurnalItem[]>([]);
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

    const qYears = query(collection(db, "academic_years"), where("school", "==", user.school));
    const unsubYears = onSnapshot(qYears, (snap) => {
      const yearList = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AcademicYear[];
      const active = yearList.find(y => y.isActive);
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
      const month = date.getMonth() + 1;
      const isCorrectSemester = selectedSemester === '1' 
        ? (month >= 7 && month <= 12) 
        : (month >= 1 && month <= 6);
      
      return j.tahunPelajaran === activeYear && j.kelas === selectedKelas && isCorrectSemester;
    }).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
  }, [jurnals, activeYear, selectedKelas, selectedSemester]);

  // FIX: Strictly using environment-based API key by removing user.apiKey param
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
        setMessage({ text: 'Rangkuman RPM Berhasil Disusun AI!', type: 'success' });
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
      
      const filteredPromes = promesData.filter(p => 
        p.userId === user.id && p.kelas === selectedKelas && p.semester === selectedSemester && p.bulanPelaksanaan
      );

      if (filteredPromes.length === 0) {
        setMessage({ text: 'Data Prosem tidak ditemukan!', type: 'warning' });
        setIsSyncingPromes(false); return;
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
          
          const isDuplicate = jurnals.some(j => j.tanggal === formattedDate && j.mataPelajaran === p.mataPelajaran && j.kelas === selectedKelas);

          if (!isDuplicate) {
            const refRpm = rpmData.find(r => r.tujuanPembelajaran === p.tujuanPembelajaran && r.mataPelajaran === p.mataPelajaran);

            await addDoc(collection(db, "jurnal_harian"), {
              userId: user.id, userName: user.name, tahunPelajaran: activeYear, kelas: selectedKelas, school: user.school,
              tanggal: formattedDate, mataPelajaran: p.mataPelajaran, materi: p.materiPokok || 'Evaluasi Pembelajaran',
              detailKegiatan: refRpm ? `KBM: ${refRpm.materi}. (Klik ikon Sparkles untuk merangkum rincian langkah).` : `KBM ${p.mataPelajaran}: ${p.materiPokok}.`, 
              praktikPedagogis: refRpm?.praktikPedagogis || 'Aktif', 
              absenSiswa: '', catatanKejadian: ''
            });
            count++;
          }
        }
      }
      setMessage({ text: `Sync Berhasil: ${count} log baru!`, type: 'success' });
    } catch (err) { 
      setMessage({ text: 'Gagal sinkronisasi data.', type: 'error' });
    } finally { 
      setIsSyncingPromes(false); setTimeout(() => setMessage(null), 3000);
    }
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
          <body onload="setTimeout(() => { window.print(); window.close(); }, 500)">${content}</body>
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
            <ArrowLeft size={16}/> KEMBALI
          </button>
          <button onClick={handlePrint} className="bg-rose-600 text-white px-8 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2">
            <Printer size={16}/> CETAK SEKARANG
          </button>
        </div>
        <div ref={printRef} className="max-w-[29.7cm] mx-auto p-10 bg-white space-y-8">
           <div className="text-center border-b-[3px] border-black pb-4">
              <h1 className="text-[20pt] font-black uppercase tracking-tight leading-none mb-2">JURNAL HARIAN MENGAJAR GURU</h1>
              <h2 className="text-[12pt] font-bold uppercase">{settings.schoolName}</h2>
           </div>
           <div className="grid grid-cols-2 gap-8 text-[10pt] font-bold uppercase">
              <div className="space-y-1"><p>NAMA GURU : {user.name}</p><p>NIP : {user.nip}</p><p>SATUAN PENDIDIKAN : {settings.schoolName}</p></div>
              <div className="space-y-1 text-right"><p>TAHUN PELAJARAN : {activeYear}</p><p>KELAS : {selectedKelas}</p><p>SEMESTER : {selectedSemester}</p></div>
           </div>
           <table className="w-full text-[9pt]">
              <thead>
                 <tr className="bg-slate-100 uppercase font-black text-center">
                    <th className="w-10">NO</th><th className="w-32">HARI / TANGGAL</th><th className="w-40">MATA PELAJARAN</th><th className="w-64">MATERI</th><th>DETAIL KEGIATAN & MODEL (RPM)</th><th className="w-28">PARAF GURU</th>
                 </tr>
              </thead>
              <tbody>
                 {filteredJurnals.map((item, idx) => {
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
                             <p className="text-[8pt] font-black italic text-indigo-700">Model: {item.praktikPedagogis}</p>
                          </td>
                          <td className="h-20"></td>
                       </tr>
                     );
                 })}
              </tbody>
           </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 font-sans">
      {message && (<div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}><CheckCircle2 size={20}/> <span className="text-sm font-black uppercase tracking-tight">{message.text}</span></div>)}
      
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col xl:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg"><BookText size={24} /></div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 leading-none">Jurnal Harian Mengajar</h2>
            <p className="text-[10px] text-emerald-600 font-black uppercase mt-1">Sinkronisasi RPM & Realisasi</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
           <button onClick={handleSyncFromPromes} disabled={isSyncingPromes} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all">
             {isSyncingPromes ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>} SINKRON PROSEM & RPM
           </button>
           <button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black transition-all shadow-lg"><Printer size={16}/> PRATINJAU CETAK</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1">Pilih Kelas</label>
            <select disabled={isClassLocked} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100" value={selectedKelas} onChange={e => setSelectedKelas(e.target.value as Kelas)}>
              {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Semester</label>
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
               <button onClick={() => setSelectedSemester('1')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${selectedSemester === '1' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>GANJIL</button>
               <button onClick={() => setSelectedSemester('2')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${selectedSemester === '2' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>GENAP</button>
            </div>
          </div>
          <div className="w-full md:w-64">
             <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Tahun Pelajaran</label>
             <div className="bg-indigo-50 text-indigo-700 p-3 rounded-xl border border-indigo-100 text-sm font-black text-center uppercase">{activeYear || 'Belum Diatur'}</div>
          </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-xl border border-slate-200 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1500px]">
               <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black h-16 uppercase tracking-widest">
                     <th className="px-6 py-2 w-16 text-center border-r border-white/5">No</th>
                     <th className="px-6 py-2 w-56 border-r border-white/5">Tanggal & Mapel</th>
                     <th className="px-6 py-2 w-64 border-r border-white/5">Materi</th>
                     <th className="px-6 py-2 border-r border-white/5 bg-slate-800">Rangkuman Kegiatan (Inti RPM)</th>
                     <th className="px-6 py-2 w-20 text-center">Aksi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredJurnals.length === 0 ? (
                    <tr><td colSpan={5} className="py-40 text-center"><p className="font-black uppercase text-xs tracking-widest text-slate-300">Belum ada log kegiatan.</p></td></tr>
                  ) : filteredJurnals.map((item, idx) => (
                    <tr key={item.id} className="group hover:bg-slate-50 transition-colors align-top">
                       <td className="px-6 py-8 text-center font-black text-slate-300 border-r border-slate-50">{idx + 1}</td>
                       <td className="px-6 py-6 space-y-2 border-r border-slate-50">
                          <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-black outline-none" value={item.tanggal} onChange={e => updateJurnal(item.id, 'tanggal', e.target.value)} />
                          <div className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[9px] font-black rounded uppercase border border-indigo-100">{item.mataPelajaran}</div>
                       </td>
                       <td className="px-6 py-6 border-r border-slate-50">
                          <textarea className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[10px] font-black uppercase h-20 resize-none outline-none focus:border-indigo-500 shadow-sm" value={item.materi} onChange={e => updateJurnal(item.id, 'materi', e.target.value)} />
                       </td>
                       <td className="px-6 py-6 relative group/cell border-r border-slate-50">
                          <textarea className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-medium h-36 leading-relaxed resize-none p-0" value={item.detailKegiatan} onChange={e => updateJurnal(item.id, 'detailKegiatan', e.target.value)} placeholder="Gunakan Sparkles untuk merangkum rincian dari RPM..." />
                          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-50">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Model Pembelajaran:</span>
                             <input className="flex-1 bg-slate-50 border-none rounded p-1 text-[9px] font-bold text-indigo-600" value={item.praktikPedagogis} onChange={e => updateJurnal(item.id, 'praktikPedagogis', e.target.value)} placeholder="Ambil dari RPM..." />
                          </div>
                          <button onClick={() => handleGenerateNarrative(item)} disabled={isLoadingAI === item.id} className="absolute bottom-6 right-6 p-2.5 bg-indigo-600 text-white rounded-xl shadow-xl opacity-0 group-hover/cell:opacity-100 transition-all hover:scale-110 active:scale-95">
                             {isLoadingAI === item.id ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                          </button>
                       </td>
                       <td className="px-6 py-6 text-center">
                          <button onClick={() => { if(confirm('Hapus log?')) deleteDoc(doc(db, "jurnal_harian", item.id)) }} className="p-3 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
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
