
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, PromesItem, ProtaItem, ATPItem, CapaianPembelajaran, MATA_PELAJARAN, SchoolSettings, AcademicYear, EventKalender, JadwalItem, User } from '../types';
import { Plus, Trash2, Save, Eye, EyeOff, Copy, AlertCircle, CheckCircle2, CalendarRange, Clock, Zap, CalendarDays, ClipboardCheck, Cloud, Loader2, FileDown, Printer, AlertTriangle, X, Lock, ArrowLeft } from 'lucide-react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from '../services/firebase';

interface ExtendedPromesItem extends PromesItem {
  isAsesmen?: boolean;
}

interface PromesManagerProps {
  user: User;
}

const PromesManager: React.FC<PromesManagerProps> = ({ user }) => {
  const [promesData, setPromesData] = useState<ExtendedPromesItem[]>([]);
  const [protaData, setProtaData] = useState<ProtaItem[]>([]);
  const [atpData, setAtpData] = useState<ATPItem[]>([]);
  const [cps, setCps] = useState<CapaianPembelajaran[]>([]);
  const [events, setEvents] = useState<EventKalender[]>([]);
  const [jadwal, setJadwal] = useState<JadwalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterFase, setFilterFase] = useState<Fase>(Fase.A);
  const [filterKelas, setFilterKelas] = useState<Kelas>('1');
  const [filterSemester, setFilterSemester] = useState<'1' | '2'>('1');
  const [filterMapel, setFilterMapel] = useState<string>(MATA_PELAJARAN[0]);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [activeYear, setActiveYear] = useState('2025/2026');
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school,
    address: 'Kecamatan Bilato, Kabupaten Gorontalo',
    principalName: 'Nama Kepala Sekolah',
    principalNip: '-'
  });

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

    // ISOLASI PROMES PERSONAL
    const qPromes = query(collection(db, "promes"), where("userId", "==", user.id));
    const unsubPromes = onSnapshot(qPromes, (snapshot) => {
      setPromesData(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as ExtendedPromesItem[]);
    });

    // ISOLASI PROTA PERSONAL
    const qProta = query(collection(db, "prota"), where("userId", "==", user.id));
    const unsubProta = onSnapshot(qProta, (snapshot) => {
      setProtaData(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as ProtaItem[]);
    });

    // ISOLASI ATP PERSONAL
    const qAtp = query(collection(db, "atp"), where("userId", "==", user.id));
    const unsubAtp = onSnapshot(qAtp, (snapshot) => {
      setAtpData(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as ATPItem[]);
    });

    const unsubCps = onSnapshot(query(collection(db, "cps"), where("school", "==", user.school)), (snapshot) => {
      setCps(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as CapaianPembelajaran[]);
    });

    const unsubJadwal = onSnapshot(query(collection(db, "jadwal_pelajaran"), where("school", "==", user.school)), (snapshot) => {
      setJadwal(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as JadwalItem[]);
    });

    const unsubEvents = onSnapshot(query(collection(db, "kalender_events"), where("school", "==", user.school)), (snapshot) => {
      setEvents(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as EventKalender[]);
      setLoading(false);
    });

    return () => {
      unsubSettings(); unsubYears(); unsubPromes(); unsubProta(); unsubAtp(); unsubCps(); unsubJadwal(); unsubEvents();
    };
  }, [user.school, user.id]);

  const sortedPromes = useMemo(() => {
    const rawFiltered = promesData.filter(item => 
      item.fase === filterFase && 
      item.kelas === filterKelas && 
      item.semester === filterSemester && 
      (item.mataPelajaran || '').trim().toLowerCase() === filterMapel.trim().toLowerCase()
    );

    return rawFiltered.sort((a, b) => (a.indexOrder || 0) - (b.indexOrder || 0));
  }, [promesData, filterFase, filterKelas, filterSemester, filterMapel]);

  const teachingDays = useMemo(() => {
    const info: string[] = [];
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    days.forEach(day => {
      const count = jadwal.filter(j => j.kelas === filterKelas && j.mapel === filterMapel && j.hari === day).length;
      if (count > 0) info.push(day);
    });
    return info;
  }, [jadwal, filterKelas, filterMapel]);

  const dailyScheduleInfo = useMemo(() => {
    const info: Record<string, number> = {};
    teachingDays.forEach(day => {
      info[day] = jadwal.filter(j => j.kelas === filterKelas && j.mapel === filterMapel && j.hari === day).length;
    });
    return info;
  }, [jadwal, filterKelas, filterMapel, teachingDays]);

  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || []);

  const BULAN_LIST = filterSemester === '1' 
    ? ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    : ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak PROMES - ${settings.schoolName}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Times New Roman', serif; background: white; padding: 10px; font-size: 8pt; }
              @media print { .no-print { display: none !important; } body { padding: 0; } }
              table { border-collapse: collapse; width: 100%; border: 1.5px solid black; }
              th, td { border: 1px solid black; padding: 2px; }
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
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>PROMES</title><style>body { font-family: 'Times New Roman', serif; } table { border-collapse: collapse; width: 100%; margin-top: 10px; } th, td { border: 1px solid black; padding: 3px; font-size: 8pt; vertical-align: middle; } .text-center { text-align: center; } .bg-gray { background-color: #f3f4f6; }</style></head><body>`;
    const footer = "</body></html>";
    let tableHtml = `<div style="text-align:center"><h2 style="margin:0; font-size: 14pt;">PROGRAM SEMESTER (PROMES)</h2><h3 style="margin:5px 0; font-size: 12pt;">${settings.schoolName}</h3><p style="font-size:9pt">Tahun Pelajaran: ${activeYear} | Semester: ${filterSemester}</p></div><br/><table><thead><tr class="bg-gray"><th rowspan="2" style="width:25pt">NO</th><th rowspan="2" style="width:40pt">KODE</th><th rowspan="2">TUJUAN PEMBELAJARAN</th><th rowspan="2" style="width:120pt">MATERI</th><th rowspan="2" style="width:25pt">JP</th>${BULAN_LIST.map(bulan => `<th colspan="5" class="text-center"><b>${bulan.toUpperCase()}</b></th>`).join('')}</tr><tr class="bg-gray">${BULAN_LIST.map(() => [1, 2, 3, 4, 5].map(w => `<th style="width:15pt" class="text-center">${w}</th>`).join('')).join('')}</tr></thead><tbody>${sortedPromes.map((item, idx) => `<tr><td class="text-center">${idx + 1}</td><td class="text-center font-bold">${item.kodeCP || '-'}</td><td>${item.tujuanPembelajaran}</td><td><b>${item.materiPokok}</b></td><td class="text-center"><b>${item.alokasiWaktu}</b></td>${BULAN_LIST.map(bulan => ([1, 2, 3, 4, 5].map(w => {const hasDates = item.bulanPelaksanaan?.includes(`${bulan}|${w}|`); if (hasDates) {const dates = item.bulanPelaksanaan.split(',').filter(d => d.startsWith(`${bulan}|${w}|`)).map(d => d.split('|')[2]).join(','); return `<td class="text-center" style="background-color: #1e293b; color: white; font-weight: bold; font-size: 6pt;">${dates}</td>`;} return `<td></td>`;}).join(''))).join('')}</tr>`).join('')}</tbody></table>`;
    const blob = new Blob(['\ufeff', header + tableHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PROMES_${filterMapel}_Kls${filterKelas}.doc`;
    link.click();
  };

  const handleSequentialSync = async () => {
    if (teachingDays.length === 0) {
      setMessage({ text: 'Jadwal mengajar Anda belum diatur di menu Hari Efektif!', type: 'error' });
      return;
    }
    const startYear = parseInt(activeYear.split('/')[0]);
    const endYear = parseInt(activeYear.split('/')[1]);
    let startDate, endDate;
    if (filterSemester === '1') {
      startDate = new Date(startYear, 6, 1);
      endDate = new Date(startYear, 11, 31);
    } else {
      startDate = new Date(endYear, 0, 1);
      endDate = new Date(endYear, 5, 30);
    }

    const effectiveSlots: { month: string; week: number; day: number; jp: number }[] = [];
    let current = new Date(startDate);
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    while (current <= endDate) {
      const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][current.getDay()];
      const isTeachingDay = teachingDays.includes(dayName);
      
      const year = current.getFullYear();
      const monthStr = String(current.getMonth() + 1).padStart(2, '0');
      const dayStr = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      const hasBlockingEvent = events.some(e => e.date === dateStr);

      if (isTeachingDay && !hasBlockingEvent) {
        effectiveSlots.push({
          month: monthNames[current.getMonth()],
          week: Math.ceil(current.getDate() / 7),
          day: current.getDate(),
          jp: dailyScheduleInfo[dayName]
        });
      }
      current.setDate(current.getDate() + 1);
    }

    let slotIdx = 0;
    for (const item of sortedPromes) {
      const targetJP = parseFloat(item.alokasiWaktu.replace(',', '.')) || 0;
      let remainingJP = targetJP;
      const assignedDates: string[] = [];
      const resultJadwal: Record<string, number[]> = {};

      while (remainingJP > 0 && slotIdx < effectiveSlots.length) {
        const slot = effectiveSlots[slotIdx];
        if (!resultJadwal[slot.month]) resultJadwal[slot.month] = [];
        if (!resultJadwal[slot.month].includes(slot.week)) resultJadwal[slot.month].push(slot.week);
        assignedDates.push(`${slot.month}|${slot.week}|${slot.day}`);
        remainingJP -= slot.jp;
        slotIdx++;
      }
      await updateDoc(doc(db, "promes", item.id), { 
        jadwalMingguan: resultJadwal, 
        bulanPelaksanaan: assignedDates.join(',') 
      });
    }
    setMessage({ text: 'Sinkronisasi Jadwal Personal (Melewati Agenda Sekolah) Berhasil!', type: 'success' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddRow = async (type: 'TP' | 'ASESMEN') => {
    const currentMaxOrder = sortedPromes.length > 0 ? Math.max(...sortedPromes.map(a => a.indexOrder || 0)) : 0;
    await addDoc(collection(db, "promes"), {
      userId: user.id,
      atpId: '', 
      kodeCP: '',
      fase: filterFase, kelas: filterKelas, semester: filterSemester, mataPelajaran: filterMapel,
      materiPokok: type === 'ASESMEN' ? 'ASESMEN SUMATIF' : '', subMateri: '',
      tujuanPembelajaran: type === 'ASESMEN' ? 'Evaluasi pencapaian kompetensi' : '',
      alokasiWaktu: type === 'ASESMEN' ? '2' : '4', bulanPelaksanaan: '', jadwalMingguan: {}, keterangan: '', isAsesmen: type === 'ASESMEN',
      indexOrder: currentMaxOrder + 1,
      school: user.school
    });
  };

  const importFromProta = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "prota"), where("userId", "==", user.id), where("fase", "==", filterFase), where("kelas", "==", filterKelas), where("semester", "==", filterSemester), where("mataPelajaran", "==", filterMapel));
      const snap = await getDocs(q);
      if (snap.empty) {
        setMessage({ text: 'Data PROTA Personal Anda tidak ditemukan!', type: 'error' });
        setLoading(false); return;
      }
      let count = 0;
      for (const d of snap.docs) {
        const p = d.data() as ProtaItem;
        const isDuplicate = promesData.some(item => item.atpId === p.atpId && item.atpId !== '');
        
        if (!isDuplicate) {
          await addDoc(collection(db, "promes"), {
            userId: user.id,
            atpId: p.atpId || '', // MENERUSKAN TAUTAN ATP UNTUK SINKRONISASI OTOMATIS
            kodeCP: p.kodeCP || '-', 
            fase: filterFase, kelas: filterKelas, semester: filterSemester, mataPelajaran: filterMapel,
            materiPokok: p.materiPokok, subMateri: p.subMateri, tujuanPembelajaran: p.tujuanPembelajaran,
            alokasiWaktu: p.jp, bulanPelaksanaan: '', jadwalMingguan: {}, keterangan: '', isAsesmen: false,
            indexOrder: p.indexOrder || 0,
            school: user.school
          });
          count++;
        }
      }
      setMessage({ text: `Berhasil mengimpor ${count} data dari Prota Personal Anda (Data tertaut ke ATP).`, type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) { setMessage({ text: 'Gagal impor data.', type: 'error' }); } finally { setLoading(false); }
  };

  const updateField = async (id: string, field: keyof ExtendedPromesItem, value: any) => {
    try { await updateDoc(doc(db, "promes", id), { [field]: value }); } catch (e) { console.error(e); }
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, "promes", deleteConfirmId));
      setDeleteConfirmId(null);
      setMessage({ text: 'Item terhapus dari cloud personal Anda', type: 'success' });
    } catch (e) { setMessage({ text: 'Gagal menghapus data', type: 'error' }); }
  };

  const renderDatesInCell = (item: ExtendedPromesItem, month: string, week: number) => {
    if (!item.bulanPelaksanaan) return null;
    const allDates = item.bulanPelaksanaan.split(',');
    const cellDates = allDates.filter(d => d.startsWith(`${month}|${week}|`)).map(d => d.split('|')[2]);
    if (cellDates.length === 0) return null;
    return (
      <div className="flex flex-wrap justify-center gap-1">
        {cellDates.map(date => (
          <span key={date} className={`px-1 rounded text-[9px] font-black ${item.isAsesmen ? 'bg-amber-100 text-amber-900' : 'bg-white/20 text-white'}`}>{date}</span>
        ))}
      </div>
    );
  };

  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';

  if (isPrintMode) {
    return (
      <div className="bg-white p-8 md:p-12 min-h-screen text-slate-900 font-serif">
        <div className="no-print fixed top-6 right-6 flex gap-3 z-[200]">
          <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xl hover:bg-black transition-all">
            <ArrowLeft size={16} /> KEMBALI
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
            <h1 className="text-xl font-black uppercase border-b-4 border-black pb-2 inline-block">Program Semester (PROMES)</h1>
            <h2 className="text-lg font-bold mt-3 uppercase">{settings.schoolName}</h2>
            <div className="flex justify-center gap-10 mt-6 text-[9px] font-black uppercase font-sans text-slate-500 tracking-widest">
              <span>MAPEL: {filterMapel}</span> <span>KELAS: {filterKelas}</span> <span>FASE: {filterFase}</span> <span>SEMESTER: {filterSemester}</span>
            </div>
          </div>
          <table className="w-full border-collapse border-2 border-black text-[9px]">
            <thead>
              <tr className="bg-slate-50">
                <th rowSpan={2} className="border-2 border-black px-1 py-2 w-8">NO</th>
                <th rowSpan={2} className="border-2 border-black px-1 py-2 w-14">KODE</th>
                <th rowSpan={2} className="border-2 border-black px-2 py-2 text-left">TUJUAN PEMBELAJARAN (TP)</th>
                <th rowSpan={2} className="border-2 border-black px-2 py-2 w-40 text-left">MATERI POKOK</th>
                <th rowSpan={2} className="border-2 border-black px-1 py-2 w-10 text-center">JP</th>
                {BULAN_LIST.map(bulan => <th key={bulan} colSpan={5} className="border-2 border-black px-1 py-1 text-center font-black uppercase tracking-widest bg-slate-50">{bulan}</th>)}
              </tr>
              <tr className="bg-slate-50">
                {BULAN_LIST.map(bulan => [1,2,3,4,5].map(w => <th key={`${bulan}-${w}`} className="border-2 border-black w-6 text-center text-[7px]">{w}</th>))}
              </tr>
            </thead>
            <tbody>
              {sortedPromes.map((item, idx) => (
                <tr key={item.id} className="break-inside-avoid">
                  <td className="border-2 border-black px-1 py-2 text-center font-bold">{idx + 1}</td>
                  <td className="border-2 border-black px-1 py-2 text-center font-black uppercase bg-slate-50/50">{item.kodeCP || '-'}</td>
                  <td className="border-2 border-black px-2 py-2 leading-relaxed text-justify">{item.tujuanPembelajaran}</td>
                  <td className="border-2 border-black px-2 py-2 font-bold">{item.materiPokok}</td>
                  <td className="border-2 border-black px-1 py-2 text-center font-black">{item.alokasiWaktu}</td>
                  {BULAN_LIST.map(bulan => [1,2,3,4,5].map(w => {
                    const allDates = item.bulanPelaksanaan?.split(',') || [];
                    const dates = allDates.filter(d => d.startsWith(`${bulan}|${w}|`)).map(d => d.split('|')[2]).join(',');
                    return (
                      <td key={`${bulan}-${w}`} className={`border-2 border-black text-center text-[7px] font-black ${dates ? 'bg-slate-900 text-white' : ''}`}>
                        {dates}
                      </td>
                    );
                  }))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-16 flex justify-between items-start text-[10px] px-12 font-sans uppercase font-black tracking-tighter">
            <div className="text-center w-72"><p>Mengetahui,</p> <p>Kepala Sekolah</p> <div className="h-24"></div> <p className="border-b border-black inline-block min-w-[180px]">{settings.principalName}</p> <p className="no-underline mt-1 font-normal">NIP. {settings.principalNip}</p></div>
            <div className="text-center w-72"><p>Bilato, {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p> <p>Guru Kelas/Mapel</p> <div className="h-24"></div> <p className="border-b border-black inline-block min-w-[180px]">{user?.name || '[Nama Guru]'}</p> <p className="no-underline mt-1 font-normal">NIP. {user?.nip || '...................'}</p></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative">
      {message && (
        <div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all animate-in slide-in-from-right ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 
          message.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' : 
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
          <span className="text-sm font-black uppercase tracking-tight">{message.text}</span>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} /></div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus Item?</h3>
              <p className="text-slate-500 font-medium text-sm">Hapus baris ini dari database personal?</p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200">BATAL</button>
              <button onClick={executeDelete} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600">HAPUS</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl"><Clock size={20}/></div>
          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hari Mengajar</h4>
            <p className="text-xs font-bold text-slate-800">{teachingDays.length > 0 ? teachingDays.join(', ') : 'Belum ada jadwal'}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><CalendarDays size={20}/></div>
          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tahun Ajaran</h4>
            <p className="text-xs font-bold text-slate-800">{activeYear} - Sem {filterSemester}</p>
          </div>
        </div>
        <div className="bg-white p-2 rounded-3xl border-2 border-rose-600">
          <button onClick={handleSequentialSync} className="w-full h-full flex items-center justify-center gap-3 bg-rose-600 text-white rounded-2xl py-3 text-xs font-black shadow-lg hover:bg-rose-700 transition-all"><Zap size={16} /> SINKRON JADWAL PERSONAL</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => handleAddRow('TP')} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-indigo-700 transition-all"><Plus size={16} /> TP BARU</button>
            <button onClick={() => handleAddRow('ASESMEN')} className="bg-amber-500 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-amber-600 transition-all"><AlertCircle size={16} /> ASESMEN BARU</button>
            <button onClick={importFromProta} disabled={loading} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-emerald-700 shadow-xl transition-all disabled:opacity-50">{loading ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />} AMBIL PROTA PERSONAL</button>
          </div>
          <div className="flex items-center gap-3">
             <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase border border-blue-100 flex items-center gap-2"><Cloud size={14}/> Database Cloud Aktif</div>
             <button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-6 py-3 rounded-2xl text-xs font-black hover:bg-black shadow-lg flex items-center gap-2 transition-all"><Eye size={18} /> PRATINJAU CETAK</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8 p-6 bg-slate-50 rounded-[24px] border border-slate-100">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1">
              Fase {isClassLocked && <Lock size={10} className="text-amber-500" />}
            </label>
            <select 
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100" 
              value={filterFase} 
              disabled={isClassLocked}
              onChange={(e) => setFilterFase(e.target.value as Fase)}
            >
              {Object.values(Fase).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1">
              Kelas {isClassLocked && <Lock size={10} className="text-amber-500" />}
            </label>
            <select 
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100" 
              value={filterKelas} 
              disabled={isClassLocked}
              onChange={(e) => handleKelasChange(e.target.value as Kelas)}
            >
              {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Semester</label>
            <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={filterSemester} onChange={(e) => setFilterSemester(e.target.value as '1' | '2')}>
              <option value="1">Ganjil (1)</option>
              <option value="2">Genap (2)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Mapel</label>
            <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={filterMapel} onChange={(e) => setFilterMapel(e.target.value)}>
              {(user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || [])).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1700px]">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black h-16 uppercase tracking-widest">
                <th rowSpan={2} className="px-6 py-2 w-16 text-center border-r border-white/5">No</th>
                <th rowSpan={2} className="px-6 py-2 w-28 text-center border-r border-white/5">Kode CP</th>
                <th rowSpan={2} className="px-6 py-2 border-r border-white/5">Tujuan Pembelajaran</th>
                <th rowSpan={2} className="px-6 py-2 w-56 border-r border-white/5">Materi Pokok</th>
                <th rowSpan={2} className="px-4 py-2 w-16 text-center border-r border-white/5">JP</th>
                {BULAN_LIST.map(bulan => <th key={bulan} colSpan={5} className="px-2 py-2 text-center border-r border-white/5 border-b border-white/10 uppercase tracking-widest">{bulan}</th>)}
                <th rowSpan={2} className="px-6 py-2 w-20 text-center">Aksi</th>
              </tr>
              <tr className="bg-slate-800 text-white text-[8px] font-black h-10">
                {BULAN_LIST.map(bulan => [1,2,3,4,5].map(w => <th key={`${bulan}-${w}`} className="w-8 text-center border-r border-white/5">{w}</th>))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={36} className="px-6 py-28 text-center"><Loader2 size={40} className="animate-spin inline-block text-rose-600 mb-4"/><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Memuat Database Personal...</p></td></tr>
              ) : sortedPromes.length === 0 ? (
                <tr><td colSpan={36} className="px-6 py-28 text-center text-slate-400 italic font-bold">Data Kosong. Gunakan tombol "Ambil Prota Personal".</td></tr>
              ) : (
                sortedPromes.map((item, idx) => (
                  <tr key={item.id} className={`group hover:bg-slate-50/50 transition-colors align-top ${item.isAsesmen ? 'bg-amber-50/20' : ''}`}>
                    <td className="px-6 py-6 text-center font-black text-slate-300 border-r border-slate-50">{idx + 1}</td>
                    <td className="px-6 py-6 border-r border-slate-50">
                       <input className="w-full bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-[10px] font-black text-indigo-700 text-center uppercase outline-none" value={item.kodeCP} onChange={e => updateField(item.id, 'kodeCP', e.target.value.toUpperCase())} placeholder="KODE" />
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50"><textarea className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-medium text-slate-700 leading-relaxed resize-none p-0 h-24" value={item.tujuanPembelajaran} onChange={e => updateField(item.id, 'tujuanPembelajaran', e.target.value)} /></td>
                    <td className="px-6 py-6 border-r border-slate-50"><textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] font-black text-slate-900 leading-tight resize-none h-20 uppercase" value={item.materiPokok} onChange={e => updateField(item.id, 'materiPokok', e.target.value)} /></td>
                    <td className="px-4 py-6 border-r border-slate-50"><input className="w-full bg-blue-50 border border-blue-100 rounded-xl text-center text-xs font-black text-blue-600 p-2 outline-none" value={item.alokasiWaktu} onChange={e => updateField(item.id, 'alokasiWaktu', e.target.value)} /></td>
                    {BULAN_LIST.map(bulan => [1,2,3,4,5].map(w => {
                       const isScheduled = item.bulanPelaksanaan?.includes(`${bulan}|${w}|`);
                       return (
                         <td key={`${bulan}-${w}`} className={`border-r border-slate-50 text-center transition-all ${isScheduled ? (item.isAsesmen ? 'bg-amber-400/80 shadow-inner' : 'bg-slate-800 shadow-lg') : 'group-hover:bg-slate-100/50'}`}>
                           {renderDatesInCell(item, bulan, w)}
                         </td>
                       );
                    }))}
                    <td className="px-6 py-6 text-center"><button onClick={() => setDeleteConfirmId(item.id)} className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-sm"><Trash2 size={18} /></button></td>
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

export default PromesManager;
