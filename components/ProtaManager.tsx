
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, ProtaItem, MATA_PELAJARAN, ATPItem, CapaianPembelajaran, SchoolSettings, User } from '../types';
import { Plus, Trash2, Save, Eye, EyeOff, Copy, AlertCircle, CheckCircle2, Cloud, Loader2, AlertTriangle, FileDown, Printer, Lock, BookOpen, Calculator, CalendarDays } from 'lucide-react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from '../services/firebase';

interface ProtaManagerProps {
  user: User;
}

const ProtaManager: React.FC<ProtaManagerProps> = ({ user }) => {
  const [protaData, setProtaData] = useState<ProtaItem[]>([]);
  const [atpData, setAtpData] = useState<ATPItem[]>([]);
  const [cps, setCps] = useState<CapaianPembelajaran[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filterFase, setFilterFase] = useState<Fase>(Fase.A);
  const [filterKelas, setFilterKelas] = useState<Kelas>('1');
  const [filterMapel, setFilterMapel] = useState<string>(MATA_PELAJARAN[0]);
  
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school,
    address: 'Kecamatan Bilato, Kabupaten Gorontalo',
    principalName: 'Nama Kepala Sekolah',
    principalNip: '-'
  });

  const [activeYear, setActiveYear] = useState('..../....');

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

    // ISOLASI PROTA PERSONAL GURU
    const qProta = query(collection(db, "prota"), where("userId", "==", user.id));
    const unsubscribeProta = onSnapshot(qProta, (snapshot) => {
      setProtaData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ProtaItem[]);
    });

    // ISOLASI ATP PERSONAL GURU
    const qAtp = query(collection(db, "atp"), where("userId", "==", user.id));
    const unsubscribeAtp = onSnapshot(qAtp, (snapshot) => {
      setAtpData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ATPItem[]);
    });

    const qCp = query(collection(db, "cps"), where("school", "==", user.school));
    const unsubscribeCp = onSnapshot(qCp, (snapshot) => {
      setCps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CapaianPembelajaran[]);
      setLoading(false);
    });

    return () => { unsubSettings(); unsubYears(); unsubscribeProta(); unsubscribeAtp(); unsubscribeCp(); };
  }, [user.school, user.id]);

  const filteredProta = useMemo(() => {
    const currentMapelNormalized = filterMapel.trim().toLowerCase();
    const rawFiltered = protaData.filter(item => 
      item.fase === filterFase && 
      item.kelas === filterKelas && 
      (item.mataPelajaran || '').trim().toLowerCase() === currentMapelNormalized
    );

    return rawFiltered.sort((a, b) => (a.indexOrder || 0) - (b.indexOrder || 0));
  }, [protaData, filterFase, filterKelas, filterMapel]);

  // Perhitungan JP per Semester
  const stats = useMemo(() => {
    const s1 = filteredProta.filter(i => i.semester === '1').reduce((acc, curr) => {
      if (!curr.jp) return acc;
      const val = parseFloat(curr.jp.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      return acc + val;
    }, 0);

    const s2 = filteredProta.filter(i => i.semester === '2').reduce((acc, curr) => {
      if (!curr.jp) return acc;
      const val = parseFloat(curr.jp.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      return acc + val;
    }, 0);

    return { s1, s2, total: s1 + s2 };
  }, [filteredProta]);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak PROTA - ${settings.schoolName}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Inter', sans-serif; background: white; padding: 20px; font-size: 10pt; }
              @media print { .no-print { display: none !important; } body { padding: 0; } }
              table { border-collapse: collapse; width: 100%; border: 1.5px solid black; }
              th, td { border: 1px solid black; padding: 5px; }
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

  const handleExportWord = () => {
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>PROTA</title><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid black; padding: 8px; font-family: 'Arial'; font-size: 11px; } .text-center { text-align: center; } .font-bold { font-weight: bold; }</style></head><body>`;
    const footer = "</body></html>";
    let tableHtml = `<div style="text-align:center"><h2 style="margin:0">PROGRAM TAHUNAN (PROTA)</h2><h3 style="margin:5px 0">${settings.schoolName}</h3><p style="font-size:10px">MAPEL: ${filterMapel} | KELAS: ${filterKelas} | TAHUN: ${activeYear}</p></div><br/>
    <table>
      <thead>
        <tr style="background-color: #f3f4f6">
          <th style="width:30px">NO</th>
          <th style="width:50px">KODE CP</th>
          <th style="width:80px">SEM</th>
          <th>TUJUAN PEMBELAJARAN</th>
          <th style="width:150px">MATERI POKOK</th>
          <th style="width:40px">JP</th>
        </tr>
      </thead>
      <tbody>
        ${filteredProta.map((item, idx) => `<tr><td class="text-center">${idx + 1}</td><td class="text-center font-bold">${item.kodeCP || '-'}</td><td class="text-center">${item.semester === '1' ? 'GANJIL' : 'GENAP'}</td><td>${item.tujuanPembelajaran}</td><td>${item.materiPokok}</td><td class="text-center">${item.jp}</td></tr>`).join('')}
        <tr style="background-color: #f9fafb"><td colspan="5" style="text-align:right"><b>TOTAL JP SEMESTER 1 (GANJIL)</b></td><td class="text-center"><b>${stats.s1} JP</b></td></tr>
        <tr style="background-color: #f9fafb"><td colspan="5" style="text-align:right"><b>TOTAL JP SEMESTER 2 (GENAP)</b></td><td class="text-center"><b>${stats.s2} JP</b></td></tr>
        <tr style="background-color: #f3f4f6"><td colspan="5" style="text-align:right; font-weight:bold">TOTAL ALOKASI WAKTU TAHUNAN</td><td class="text-center" style="font-weight:bold">${stats.total} JP</td></tr>
      </tbody>
    </table>`;
    const blob = new Blob(['\ufeff', header + tableHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PROTA_${filterMapel}_Kls${filterKelas}.doc`;
    link.click();
  };

  const handleAddRow = async () => {
    const currentMaxOrder = filteredProta.length > 0 ? Math.max(...filteredProta.map(a => a.indexOrder || 0)) : 0;
    try {
      await addDoc(collection(db, "prota"), {
        userId: user.id,
        kodeCP: '',
        atpId: '', 
        fase: filterFase, kelas: filterKelas, mataPelajaran: filterMapel,
        tujuanPembelajaran: '', materiPokok: '', subMateri: '', jp: '4 JP', semester: '1',
        indexOrder: currentMaxOrder + 1,
        school: user.school
      });
    } catch (e) { console.error(e); }
  };

  const updateField = async (id: string, field: keyof ProtaItem, value: any) => {
    try {
      await updateDoc(doc(db, "prota", id), { [field]: value });
    } catch (e) { console.error(e); }
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, "prota", deleteConfirmId));
      setDeleteConfirmId(null);
      setMessage({ text: 'Data dihapus dari database Anda', type: 'info' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) { setMessage({ text: 'Gagal menghapus data', type: 'error' }); }
  };

  const importFromATP = async () => {
    setLoading(true);
    try {
      const sortedAtpReference = atpData
        .filter(a => 
          a.fase === filterFase && 
          a.kelas === filterKelas && 
          (a.mataPelajaran || '').trim().toLowerCase() === filterMapel.trim().toLowerCase()
        )
        .sort((a, b) => (a.indexOrder || 0) - (b.indexOrder || 0));

      if (sortedAtpReference.length === 0) {
        setMessage({ text: `Data ATP Anda untuk ${filterMapel} Kelas ${filterKelas} tidak ditemukan. Silakan isi ATP Anda terlebih dahulu.`, type: 'error' });
        setLoading(false);
        return;
      }
      
      let count = 0;
      for (const a of sortedAtpReference) {
        const isDuplicate = protaData.some(p => p.atpId === a.id);
        
        if (!isDuplicate) {
          await addDoc(collection(db, "prota"), {
            userId: user.id,
            atpId: a.id, 
            kodeCP: a.kodeCP || '-', 
            fase: filterFase, 
            kelas: filterKelas, 
            mataPelajaran: filterMapel,
            tujuanPembelajaran: a.tujuanPembelajaran, 
            materiPokok: a.materi, 
            subMateri: a.subMateri || '', 
            jp: a.alokasiWaktu || '4 JP', 
            semester: '1', 
            indexOrder: a.indexOrder || 0,
            school: user.school
          });
          count++;
        }
      }
      
      if (count > 0) {
        setMessage({ text: `Sinkronisasi Personal Berhasil: ${count} TP diimpor dan ditautkan ke ATP.`, type: 'success' });
      } else {
        setMessage({ text: `Seluruh data ATP Anda sudah ada di Prota.`, type: 'info' });
      }
      
      setTimeout(() => setMessage(null), 3000);
    } catch (err) { 
      console.error(err);
      setMessage({ text: 'Gagal sinkronisasi data personal.', type: 'error' }); 
    } 
    finally { setLoading(false); }
  };

  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';

  if (isPrintMode) {
    return (
      <div className="bg-white p-8 md:p-12 min-h-screen text-slate-900 font-serif">
        <div className="no-print fixed top-6 right-6 flex gap-3 z-[200]">
          <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xl hover:bg-black transition-all">
            <EyeOff size={16} /> KEMBALI
          </button>
          <button onClick={handleExportWord} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xl hover:bg-blue-700 transition-all">
            <FileDown size={16} /> WORD
          </button>
          <button onClick={handlePrint} className="bg-rose-600 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xl hover:bg-rose-700 transition-all">
            <Printer size={16} /> CETAK PDF
          </button>
        </div>
        
        <div ref={printRef}>
          <div className="text-center mb-10">
            <h1 className="text-xl font-black uppercase border-b-4 border-black pb-2 inline-block">Program Tahun (PROTA)</h1>
            <h2 className="text-lg font-bold mt-3 uppercase">{settings.schoolName}</h2>
            <div className="flex justify-center gap-10 mt-6 text-[9px] font-black uppercase font-sans text-slate-500 tracking-widest">
              <span>MAPEL: {filterMapel}</span> <span>KELAS: {filterKelas}</span> <span>FASE: {filterFase}</span>
            </div>
          </div>
          <table className="w-full border-collapse border-2 border-black text-[10px]">
            <thead>
              <tr className="bg-slate-50">
                <th className="border-2 border-black px-2 py-3 w-10">NO</th>
                <th className="border-2 border-black px-2 py-3 w-16 text-center">KODE</th>
                <th className="border-2 border-black px-2 py-3 w-20">SEM</th>
                <th className="border-2 border-black px-3 py-3 text-left">TUJUAN PEMBELAJARAN (TP)</th>
                <th className="border-2 border-black px-3 py-3 w-40 text-left">MATERI POKOK</th>
                <th className="border-2 border-black px-2 py-3 w-16 text-center">JP</th>
              </tr>
            </thead>
            <tbody>
              {filteredProta.map((item, idx) => (
                <tr key={item.id}>
                  <td className="border-2 border-black px-2 py-3 text-center font-bold">{idx + 1}</td>
                  <td className="border-2 border-black px-2 py-3 text-center font-black uppercase">{item.kodeCP || '-'}</td>
                  <td className="border-2 border-black px-2 py-3 text-center font-bold uppercase">{item.semester === '1' ? 'GANJIL' : 'GENAP'}</td>
                  <td className="border-2 border-black px-3 py-3 leading-relaxed">{item.tujuanPembelajaran}</td>
                  <td className="border-2 border-black px-3 py-3 font-bold">{item.materiPokok}</td>
                  <td className="border-2 border-black px-2 py-3 text-center font-black">{item.jp}</td>
                </tr>
              ))}
              <tr className="bg-slate-50/50">
                <td colSpan={5} className="border-2 border-black px-4 py-2 text-right font-bold uppercase">Total JP Semester 1 (Ganjil)</td>
                <td className="border-2 border-black px-2 py-2 text-center font-black">{stats.s1} JP</td>
              </tr>
              <tr className="bg-slate-50/50">
                <td colSpan={5} className="border-2 border-black px-4 py-2 text-right font-bold uppercase">Total JP Semester 2 (Genap)</td>
                <td className="border-2 border-black px-2 py-2 text-center font-black">{stats.s2} JP</td>
              </tr>
              <tr className="bg-slate-50 font-black text-lg">
                <td colSpan={5} className="border-2 border-black px-4 py-4 text-right uppercase tracking-wider">TOTAL ALOKASI WAKTU TAHUNAN</td>
                <td className="border-2 border-black px-2 py-4 text-center">{stats.total} JP</td>
              </tr>
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
        <div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
          {message.type === 'success' ? <CheckCircle2 size={20}/> : <Cloud size={20}/>}
          <span className="text-sm font-black uppercase tracking-tight">{message.text}</span>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center"><div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} /></div><h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus Prota</h3><p className="text-slate-500 font-medium text-sm">Hapus baris ini dari database Anda?</p></div>
            <div className="p-4 bg-slate-50 flex gap-3"><button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 transition-all">BATAL</button><button onClick={executeDelete} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 transition-all shadow-lg">HAPUS</button></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-5 group hover:border-indigo-500 transition-all">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
            <Calculator size={24}/>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total JP SMT 1</p>
            <p className="text-2xl font-black text-slate-900">{stats.s1} <span className="text-xs text-slate-400">Jam</span></p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-5 group hover:border-violet-500 transition-all">
          <div className="p-4 bg-violet-50 text-violet-600 rounded-2xl group-hover:bg-violet-600 group-hover:text-white transition-all">
            <Calculator size={24}/>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total JP SMT 2</p>
            <p className="text-2xl font-black text-slate-900">{stats.s2} <span className="text-xs text-slate-400">Jam</span></p>
          </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-[32px] shadow-xl flex items-center gap-5 border border-slate-800">
          <div className="p-4 bg-white/10 text-white rounded-2xl">
            <CalendarDays size={24}/>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Alokasi Tahunan</p>
            <p className="text-2xl font-black text-white">{stats.total} <span className="text-xs text-white/40">JP</span></p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div className="flex flex-wrap gap-3">
            <button onClick={handleAddRow} className="bg-violet-600 text-white px-6 py-3 rounded-2xl text-xs font-black flex items-center gap-2 hover:bg-violet-700 shadow-xl shadow-violet-100 transition-all"><Plus size={18} /> TAMBAH BARIS</button>
            <button onClick={importFromATP} disabled={loading} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-xs font-black flex items-center gap-2 hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all disabled:opacity-50 tracking-tight">
               {loading ? <Loader2 size={18} className="animate-spin" /> : <Copy size={18} />} SINKRON ATP PERSONAL
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase border border-blue-100 flex items-center gap-2"><Cloud size={14}/> Database Cloud Aktif</div>
            <button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-6 py-3 rounded-2xl text-xs font-black hover:bg-black shadow-lg flex items-center gap-2"><Eye size={18} /> PRATINJAU CETAK</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 p-6 bg-slate-50 rounded-[24px] border border-slate-100">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1">
              Fase {isClassLocked && <Lock size={10} className="text-amber-500" />}
            </label>
            <select 
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100 disabled:text-slate-400" 
              value={filterFase} 
              disabled={isClassLocked}
              onChange={(e) => setFilterFase(e.target.value as Fase)}
            >
              {Object.values(Fase).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1">
              Pilih Kelas {isClassLocked && <Lock size={10} className="text-amber-500" />}
            </label>
            <select 
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100 disabled:text-slate-400" 
              value={filterKelas} 
              disabled={isClassLocked}
              onChange={(e) => handleKelasChange(e.target.value as Kelas)}
            >
              {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
            </select>
          </div>
          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Mapel</label><select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={filterMapel} onChange={(e) => setFilterMapel(e.target.value)}>{(user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || [])).map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-xl border border-slate-200 overflow-hidden min-h-[500px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-black h-16 uppercase tracking-[0.15em]">
                <th className="px-6 py-2 w-20 text-center border-r border-white/5">No</th>
                <th className="px-6 py-2 w-32 text-center border-r border-white/5">Kode CP</th>
                <th className="px-6 py-2 w-48 text-center border-r border-white/5">Semester</th>
                <th className="px-6 py-2 border-r border-white/5">Tujuan Pembelajaran (TP)</th>
                <th className="px-6 py-2 w-72 border-r border-white/5">Materi Pokok</th>
                <th className="px-6 py-2 w-28 text-center border-r border-white/5">Alokasi JP</th>
                <th className="px-6 py-2 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-28 text-center"><Loader2 size={40} className="animate-spin inline-block text-violet-600 mb-4"/><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Memuat Database Personal...</p></td></tr>
              ) : filteredProta.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-28 text-center text-slate-400 italic font-bold uppercase text-[10px] tracking-widest">Data Kosong. Gunakan tombol "Sinkron ATP Personal" untuk menarik data Anda.</td></tr>
              ) : (
                filteredProta.map((item, idx) => (
                  <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors align-top">
                    <td className="px-6 py-6 text-center font-black text-slate-300 border-r border-slate-50">{idx + 1}</td>
                    <td className="px-6 py-6 border-r border-slate-50 text-center">
                       <input className="w-full bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-[11px] font-black text-indigo-700 text-center uppercase outline-none focus:ring-2 focus:ring-indigo-500" value={item.kodeCP} onChange={e => updateField(item.id, 'kodeCP', e.target.value.toUpperCase())} placeholder="KODE" />
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50">
                      <select 
                        className="w-full bg-violet-50 border border-violet-100 rounded-xl p-3 text-[11px] font-black text-violet-700 outline-none focus:ring-2 focus:ring-violet-500 transition-all" 
                        value={item.semester} 
                        onChange={e => updateField(item.id, 'semester', e.target.value)}
                      >
                        <option value="1">GANJIL (SEM 1)</option>
                        <option value="2">GENAP (SEM 2)</option>
                      </select>
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50"><textarea className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 leading-relaxed resize-none p-0 h-28" value={item.tujuanPembelajaran} onChange={e => updateField(item.id, 'tujuanPembelajaran', e.target.value)} /></td>
                    <td className="px-6 py-6 border-r border-slate-50"><textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-black text-slate-900 leading-tight resize-none h-20" value={item.materiPokok} onChange={e => updateField(item.id, 'materiPokok', e.target.value)} /></td>
                    <td className="px-6 py-6 border-r border-slate-50"><input className="w-full bg-blue-50 border border-blue-100 rounded-xl text-center text-sm font-black text-blue-600 p-3 outline-none" value={item.jp} onChange={e => updateField(item.id, 'jp', e.target.value)} placeholder="4 JP" /></td>
                    <td className="px-6 py-6 text-center"><button onClick={() => setDeleteConfirmId(item.id)} className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"><Trash2 size={20} /></button></td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredProta.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-black">
                <tr className="text-slate-500 text-xs tracking-widest uppercase">
                  <td colSpan={5} className="px-10 py-3 text-right border-b border-slate-100">Jumlah JP Semester 1 (Ganjil)</td>
                  <td className="px-6 py-3 text-center border-x border-slate-100 bg-indigo-50/30 text-indigo-600 font-black">{stats.s1} JP</td>
                  <td className="border-b border-slate-100"></td>
                </tr>
                <tr className="text-slate-500 text-xs tracking-widest uppercase">
                  <td colSpan={5} className="px-10 py-3 text-right border-b border-slate-100">Jumlah JP Semester 2 (Genap)</td>
                  <td className="px-6 py-3 text-center border-x border-slate-100 bg-violet-50/30 text-violet-600 font-black">{stats.s2} JP</td>
                  <td className="border-b border-slate-100"></td>
                </tr>
                <tr className="bg-slate-100 shadow-inner">
                  <td colSpan={5} className="px-10 py-6 text-right uppercase text-xs tracking-widest text-slate-800">Total Alokasi Waktu Tahunan</td>
                  <td className="px-6 py-6 text-center text-xl text-slate-900 bg-white border-x border-slate-200 ring-2 ring-indigo-500 ring-inset">{stats.total} <span className="text-xs text-slate-400">JP</span></td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProtaManager;
