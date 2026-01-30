
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Kelas, JurnalItem, MATA_PELAJARAN, SchoolSettings, AcademicYear, User, PromesItem, RPMItem } from '../types';
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

  const handleGenerateNarrative = async (item: JurnalItem) => {
    if (!user.apiKey) { alert("Aktivasi API Key diperlukan."); return; }
    setIsLoadingAI(item.id);
    try {
      const refRpm = rpmData.find(r => r.materi.trim() === item.materi.trim() && r.mataPelajaran === item.mataPelajaran);
      const result = await generateJournalNarrative(user.apiKey, item.kelas, item.mataPelajaran, item.materi, refRpm);
      if (result) {
        await updateDoc(doc(db, "jurnal_harian", item.id), {
          detailKegiatan: result.detail_kegiatan,
          praktikPedagogis: result.pedagogik
        });
        setMessage({ text: 'Narasi diringkas AI dari RPM Personal Anda!', type: 'success' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (e: any) { setMessage({ text: 'Gagal memproses AI.', type: 'error' }); } 
    finally { setIsLoadingAI(null); }
  };

  const updateJurnal = async (id: string, field: keyof JurnalItem, value: any) => {
    try { await updateDoc(doc(db, "jurnal_harian", id), { [field]: value }); } catch (e) { console.error(e); }
  };

  const handleSyncFromPromes = async () => {
    if (!activeYear) return;
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
      const filteredPromes = promesData.filter(p => p.userId === user.id && p.kelas === selectedKelas && p.semester === selectedSemester && p.bulanPelaksanaan);
      for (const p of filteredPromes) {
        const dateEntries = p.bulanPelaksanaan.split(',');
        for (const entry of dateEntries) {
          const [bulan, minggu, tanggal] = entry.split('|');
          if (!bulan || !tanggal) continue;
          const monthIndex = monthMap[bulan];
          const year = monthIndex >= 6 ? yearStart : yearEnd;
          const formattedDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(tanggal).padStart(2, '0')}`;
          const isDuplicate = jurnals.some(j => j.tanggal === formattedDate && j.mataPelajaran === p.mataPelajaran && j.kelas === selectedKelas);
          if (!isDuplicate) {
            await addDoc(collection(db, "jurnal_harian"), {
              userId: user.id, userName: user.name, tahunPelajaran: activeYear, kelas: selectedKelas, school: user.school,
              tanggal: formattedDate, mataPelajaran: p.mataPelajaran, materi: p.materiPokok,
              detailKegiatan: `Melaksanakan pembelajaran ${p.materiPokok}.`, praktikPedagogis: 'Aktif', absenSiswa: '', catatanKejadian: ''
            });
            count++;
          }
        }
      }
      setMessage({ text: `Berhasil sinkron ${count} log!`, type: 'success' });
    } catch (err) { console.error(err); } finally { setIsSyncingPromes(false); }
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try { await deleteDoc(doc(db, "jurnal_harian", deleteConfirmId)); setDeleteConfirmId(null); } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 font-sans">
      {message && (<div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}><CheckCircle2 size={20}/><span>{message.text}</span></div>)}
      
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-sm p-8 text-center animate-in zoom-in-95"><div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} /></div><h3 className="text-xl font-black uppercase mb-2">Hapus Log?</h3><div className="p-4 bg-slate-50 flex gap-3"><button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 rounded-xl font-black text-slate-500 bg-white">BATAL</button><button onClick={executeDelete} className="flex-1 py-3 rounded-xl font-black text-white bg-red-600">HAPUS</button></div></div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col xl:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4"><div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg"><BookText size={24} /></div><h2 className="text-xl font-black uppercase">Jurnal Harian Mengajar</h2></div>
        <div className="flex flex-wrap items-center gap-3">
           <button onClick={handleSyncFromPromes} disabled={isSyncingPromes} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg">SINKRON PROSEM</button>
           <button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black">PRATINJAU</button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-xl border border-slate-200 overflow-hidden">
         <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[1500px]">
            <thead><tr className="bg-slate-900 text-white text-[10px] font-black h-16 uppercase tracking-widest">
               <th className="px-6 py-2 w-16 text-center">No</th><th className="px-6 py-2 w-48">Tanggal & Mapel</th><th>Materi</th><th className="w-[600px]">Summary AI</th><th className="px-6 py-2 w-20">Aksi</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
               {filteredJurnals.map((item, idx) => (
                 <tr key={item.id} className="group hover:bg-slate-50 transition-colors align-top">
                    <td className="px-6 py-8 text-center font-black text-slate-300">{idx + 1}</td>
                    <td className="px-6 py-6 space-y-2"><input type="date" className="w-full bg-slate-50 border p-2 text-xs font-black" value={item.tanggal} onChange={e => updateJurnal(item.id, 'tanggal', e.target.value)} /><select className="w-full bg-indigo-50 border p-2 text-[10px] font-black" value={item.mataPelajaran} onChange={e => updateJurnal(item.id, 'mataPelajaran', e.target.value)}>{MATA_PELAJARAN.map(m => <option key={m} value={m}>{m}</option>)}</select></td>
                    <td className="px-6 py-6"><textarea className="w-full bg-slate-50 border p-3 text-xs font-black uppercase h-24" value={item.materi} onChange={e => updateJurnal(item.id, 'materi', e.target.value)} /></td>
                    <td className="px-6 py-6 relative group/cell">
                       <textarea className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-medium h-40" value={item.detailKegiatan} onChange={e => updateJurnal(item.id, 'detailKegiatan', e.target.value)} placeholder="Tulis rincian..." />
                       <button onClick={() => handleGenerateNarrative(item)} disabled={isLoadingAI === item.id} className="absolute bottom-4 right-4 p-2 bg-indigo-600 text-white rounded-xl shadow-lg opacity-0 group-hover/cell:opacity-100">{isLoadingAI === item.id ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}</button>
                    </td>
                    <td className="px-6 py-6 text-center"><button onClick={() => setDeleteConfirmId(item.id)} className="text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button></td>
                 </tr>
               ))}
            </tbody>
         </table></div>
      </div>
    </div>
  );
};

export default JurnalManager;
