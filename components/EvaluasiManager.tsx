
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Kelas, Siswa, AsesmenNilai, ATPItem, MATA_PELAJARAN, User, SchoolSettings } from '../types';
import { 
  Users, ClipboardCheck, Plus, Trash2, Save, FileDown, 
  Loader2, Cloud, CheckCircle2, AlertTriangle, UserPlus, 
  Search, ListChecks, Download, Edit2, X, Lock, Info, Printer, Eye, EyeOff
} from 'lucide-react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, setDoc } from '../services/firebase';

interface EvaluasiManagerProps {
  user: User;
}

const EvaluasiManager: React.FC<EvaluasiManagerProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'SISWA' | 'NILAI'>('NILAI');
  const [kelas, setKelas] = useState<Kelas>('1');
  const [semester, setSemester] = useState<'1' | '2'>('1');
  const [mapel, setMapel] = useState<string>(MATA_PELAJARAN[1]);
  
  const [students, setStudents] = useState<Siswa[]>([]);
  const [tps, setTps] = useState<ATPItem[]>([]);
  const [scores, setScores] = useState<AsesmenNilai[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrintMode, setIsPrintMode] = useState(false);
  
  const [newStudent, setNewStudent] = useState({ name: '', nis: '' });
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school,
    address: 'Kecamatan Bilato, Kabupaten Gorontalo',
    principalName: 'Nama Kepala Sekolah',
    principalNip: '-'
  });

  const [activeYear, setActiveYear] = useState('2024/2025');
  const printRef = useRef<HTMLDivElement>(null);

  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';
  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || []);

  useEffect(() => {
    if (user.role === 'guru') {
      if (user.kelas !== '-' && user.kelas !== 'Multikelas') {
        setKelas(user.kelas as Kelas);
      }
      if (user.mapelDiampu && user.mapelDiampu.length > 0) {
        if (!user.mapelDiampu.includes(mapel)) {
          setMapel(user.mapelDiampu[0]);
        }
      }
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const unsubSettings = onSnapshot(doc(db, "school_settings", user.school), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });

    const unsubYears = onSnapshot(collection(db, "academic_years"), (snap) => {
      const active = snap.docs.find((d: any) => d.data().isActive);
      if (active) setActiveYear(active.data().year);
    });

    const unsubSiswa = onSnapshot(query(collection(db, "siswa"), where("school", "==", user.school)), (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Siswa[]);
    });

    const unsubAtp = onSnapshot(query(collection(db, "atp"), where("school", "==", user.school)), (snap) => {
      setTps(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ATPItem[]);
    });

    const unsubNilai = onSnapshot(query(collection(db, "nilai"), where("school", "==", user.school)), (snap) => {
      setScores(snap.docs.map(d => ({ id: d.id, ...d.data() })) as AsesmenNilai[]);
      setLoading(false);
    });

    return () => { unsubSettings(); unsubYears(); unsubSiswa(); unsubAtp(); unsubNilai(); };
  }, [user.school]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => s.kelas === kelas).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, kelas]);

  const filteredTps = useMemo(() => {
    return tps.filter(t => t.kelas === kelas && t.mataPelajaran === mapel);
  }, [tps, kelas, mapel]);

  const handleAddStudent = async () => {
    if (!newStudent.name) return;
    try {
      await addDoc(collection(db, "siswa"), {
        name: newStudent.name.toUpperCase(),
        nis: newStudent.nis || '-',
        kelas: kelas,
        school: user.school
      });
      setNewStudent({ name: '', nis: '' });
      setMessage({ text: 'Siswa berhasil ditambahkan', type: 'success' });
    } catch (e) { console.error(e); }
  };

  const handleUpdateScore = async (siswaId: string, tpId: string, value: string) => {
    const nilai = parseInt(value);
    if (isNaN(nilai)) return;
    
    const existing = scores.find(s => s.siswaId === siswaId && s.tpId === tpId);
    try {
      if (existing) {
        await updateDoc(doc(db, "nilai", existing.id), { nilai });
      } else {
        await addDoc(collection(db, "nilai"), {
          siswaId,
          tpId,
          nilai,
          mapel,
          semester,
          school: user.school
        });
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Hapus siswa ini?')) return;
    try {
      await deleteDoc(doc(db, "siswa", id));
      setMessage({ text: 'Siswa dihapus', type: 'info' });
    } catch (e) { console.error(e); }
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak Daftar Nilai - ${settings.schoolName}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Inter', sans-serif; background: white; padding: 40px; }
              @media print { 
                .no-print { display: none !important; }
                body { padding: 0; }
              }
              table { border-collapse: collapse; width: 100%; border: 2px solid black; }
              th, td { border: 1px solid black; padding: 5px; }
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

  const handleExportWord = () => {
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Daftar Nilai</title><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid black; padding: 5px; font-family: 'Arial'; font-size: 9px; vertical-align: middle; } .text-center { text-align: center; } .font-bold { font-weight: bold; } .bg-gray { background-color: #f3f4f6; }</style></head><body>`;
    const footer = "</body></html>";
    let tableHtml = `<div style="text-align:center"><h2 style="margin:0">DAFTAR NILAI ASESMEN</h2><h3 style="margin:5px 0">${settings.schoolName}</h3><p style="font-size:10px">MAPEL: ${mapel} | KELAS: ${kelas} | TAHUN: ${activeYear} | SEMESTER: ${semester}</p></div><br/><table><thead><tr class="bg-gray"><th style="width:30px">NO</th><th style="width:150px">NAMA SISWA</th>${filteredTps.map((_, i) => `<th style="width:40px">TP ${i+1}</th>`).join('')}<th style="width:50px">RATA2</th></tr></thead><tbody>${filteredStudents.map((s, idx) => {
      let total = 0; let count = 0;
      const cells = filteredTps.map(tp => {
        const score = scores.find(sc => sc.siswaId === s.id && sc.tpId === tp.id)?.nilai || 0;
        if (score > 0) { total += score; count++; }
        return `<td class="text-center">${score || '-'}</td>`;
      }).join('');
      const avg = count > 0 ? (total / count).toFixed(1) : '-';
      return `<tr><td class="text-center">${idx + 1}</td><td class="uppercase">${s.name}</td>${cells}<td class="text-center font-bold">${avg}</td></tr>`;
    }).join('')}</tbody></table><br/><div style="font-size: 8px;"><b>Keterangan TP:</b><br/>${filteredTps.map((tp, i) => `TP ${i+1}: ${tp.tujuanPembelajaran}`).join('<br/>')}</div>`;
    const blob = new Blob(['\ufeff', header + tableHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NILAI_${mapel.replace(/ /g, '_')}_KLS${kelas}.doc`;
    link.click();
  };

  if (isPrintMode) {
    return (
      <div className="bg-white p-12 min-h-screen text-slate-900 font-serif">
        <div className="no-print fixed top-6 right-6 flex gap-3 z-[300]">
          <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xl hover:bg-black transition-all"><EyeOff size={16}/> KEMBALI</button>
          <button onClick={handleExportWord} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xl hover:bg-blue-700 transition-all"><FileDown size={16}/> WORD</button>
          <button onClick={handlePrint} className="bg-rose-600 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xl hover:bg-rose-700 transition-all"><Printer size={16}/> CETAK PDF</button>
        </div>

        <div ref={printRef}>
          <div className="text-center mb-10">
            <h1 className="text-2xl font-black uppercase border-b-4 border-black pb-2 inline-block tracking-tight text-slate-900">Daftar Nilai Asesmen</h1>
            <h2 className="text-xl font-bold mt-3 uppercase text-slate-800">{settings.schoolName}</h2>
            <div className="grid grid-cols-2 gap-x-20 mt-8 text-left text-xs font-bold uppercase font-sans">
               <div className="space-y-1">
                 <div className="flex"><span>Mata Pelajaran</span><span className="ml-4 mr-2">:</span><span>{mapel}</span></div>
                 <div className="flex"><span>Fase / Kelas</span><span className="ml-8 mr-2">:</span><span>{kelas}</span></div>
               </div>
               <div className="space-y-1">
                 <div className="flex"><span>Tahun Pelajaran</span><span className="ml-4 mr-2">:</span><span>{activeYear}</span></div>
                 <div className="flex"><span>Semester</span><span className="ml-14 mr-2">:</span><span>{semester === '1' ? '1 (Ganjil)' : '2 (Genap)'}</span></div>
               </div>
            </div>
          </div>

          <table className="w-full border-collapse border-2 border-black text-[10px]">
            <thead>
              <tr className="bg-slate-50 h-12 uppercase font-black text-center">
                <th className="border-2 border-black w-10">NO</th>
                <th className="border-2 border-black px-4 text-left">NAMA LENGKAP SISWA</th>
                {filteredTps.map((_, i) => <th key={i} className="border-2 border-black w-12">TP {i+1}</th>)}
                <th className="border-2 border-black w-16">RATA2</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr><td colSpan={3 + filteredTps.length} className="border-2 border-black p-10 text-center italic text-slate-400">Data siswa kosong.</td></tr>
              ) : (
                filteredStudents.map((siswa, idx) => {
                  let total = 0; let count = 0;
                  return (
                    <tr key={siswa.id} className="break-inside-avoid">
                      <td className="border-2 border-black p-2 text-center font-bold">{idx + 1}</td>
                      <td className="border-2 border-black p-2 uppercase">{siswa.name}</td>
                      {filteredTps.map(tp => {
                        const score = scores.find(s => s.siswaId === siswa.id && s.tpId === tp.id)?.nilai || 0;
                        if (score > 0) { total += score; count++; }
                        return <td key={tp.id} className="border-2 border-black p-2 text-center">{score || '-'}</td>;
                      })}
                      <td className="border-2 border-black p-2 text-center font-black bg-slate-50">
                        {count > 0 ? (total / count).toFixed(1) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="mt-8 p-4 border border-black rounded-lg text-[9px] font-sans">
             <p className="font-black uppercase mb-1 underline">Keterangan Tujuan Pembelajaran (TP):</p>
             <div className="grid grid-cols-2 gap-x-10">
               {filteredTps.map((tp, i) => (
                 <div key={tp.id} className="flex gap-2">
                   <span className="font-bold shrink-0">TP {i+1}:</span>
                   <span className="italic">{tp.tujuanPembelajaran}</span>
                 </div>
               ))}
             </div>
          </div>

          <div className="mt-16 flex justify-between items-start text-xs px-12 font-sans uppercase font-black tracking-tight break-inside-avoid">
             <div className="text-center w-72">
                <p>Mengetahui,</p> <p>Kepala Sekolah</p> <div className="h-24"></div> <p className="border-b border-black inline-block min-w-[200px]">{settings.principalName}</p> <p className="no-underline mt-1 font-normal">NIP. {settings.principalNip}</p>
             </div>
             <div className="text-center w-72">
                <p>Bilato, {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p> <p>Guru Kelas/Mapel</p> <div className="h-24"></div> <p className="border-b border-black inline-block min-w-[200px]">{user?.name || '[Nama Guru]'}</p> <p className="no-underline mt-1 font-normal">NIP. {user?.nip || '...................'}</p>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {message && (
        <div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <CheckCircle2 size={20}/><span className="text-sm font-black uppercase">{message.text}</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between items-center gap-6">
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button onClick={() => setActiveTab('NILAI')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'NILAI' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>INPUT NILAI</button>
          <button onClick={() => setActiveTab('SISWA')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'SISWA' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>KELOLA SISWA</button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
           <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 text-[10px] font-black uppercase">
            <Cloud size={14}/> Cloud Connected
          </div>
          <button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg hover:bg-black transition-all">
            <Eye size={18}/> PRATINJAU CETAK
          </button>
          <button onClick={handleExportWord} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all">
            <Download size={16}/> UNDUH WORD
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6">
         <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1">
              Kelas {isClassLocked && <Lock size={10} className="text-amber-500" />}
            </label>
            <select disabled={isClassLocked} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100 disabled:text-slate-400" value={kelas} onChange={e => setKelas(e.target.value as Kelas)}>
              {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Mata Pelajaran</label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={mapel} onChange={e => setMapel(e.target.value)}>
              {availableMapel.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Semester</label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={semester} onChange={e => setSemester(e.target.value as '1' | '2')}>
              <option value="1">Semester 1 (Ganjil)</option>
              <option value="2">Semester 2 (Genap)</option>
            </select>
          </div>
          <div className="flex flex-col justify-end">
             <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <Users size={18} className="text-indigo-600"/>
                <div>
                   <p className="text-[9px] font-black text-slate-400 uppercase">Total Siswa</p>
                   <p className="text-sm font-black text-slate-800">{filteredStudents.length} Anak</p>
                </div>
             </div>
          </div>
      </div>

      {activeTab === 'NILAI' ? (
        <div className="bg-white rounded-[40px] shadow-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] font-black h-16 uppercase tracking-[0.15em]">
                  <th className="px-6 py-2 w-16 text-center border-r border-white/5">No</th>
                  <th className="px-6 py-2 w-72 border-r border-white/5">Nama Lengkap Siswa</th>
                  {filteredTps.map((tp, i) => (
                    <th key={tp.id} className="px-3 py-2 w-24 text-center border-r border-white/5 group relative cursor-help">
                      <span className="block mb-1">TP {i+1}</span>
                      <div className="absolute z-10 hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 w-64 normal-case text-start font-medium text-[11px] leading-relaxed">
                        {tp.tujuanPembelajaran}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-2 w-24 text-center">Rata-rata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={3 + filteredTps.length} className="py-20 text-center"><Loader2 className="animate-spin inline-block text-indigo-600" /></td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr><td colSpan={3 + filteredTps.length} className="px-6 py-24 text-center text-slate-400 italic font-bold">Belum ada data siswa.</td></tr>
                ) : (
                  filteredStudents.map((siswa, idx) => {
                    let total = 0; let count = 0;
                    return (
                      <tr key={siswa.id} className="group hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-5 text-center font-black text-slate-300 border-r border-slate-50">{idx + 1}</td>
                        <td className="px-6 py-5 border-r border-slate-50">
                           <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{siswa.name}</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">NIS: {siswa.nis}</p>
                        </td>
                        {filteredTps.map(tp => {
                          const scoreObj = scores.find(s => s.siswaId === siswa.id && s.tpId === tp.id);
                          const val = scoreObj?.nilai || 0;
                          if (val > 0) { total += val; count++; }
                          return (
                            <td key={tp.id} className="px-3 py-5 border-r border-slate-50">
                               <input 
                                  type="number" 
                                  className={`w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-xs font-black transition-all outline-none focus:ring-2 focus:ring-indigo-500 ${val > 0 ? (val < 75 ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-indigo-600 bg-indigo-50 border-indigo-100') : 'text-slate-300'}`}
                                  value={val || ''}
                                  placeholder="-"
                                  onChange={e => handleUpdateScore(siswa.id, tp.id, e.target.value)}
                               />
                            </td>
                          );
                        })}
                        <td className="px-6 py-5 text-center bg-slate-50/50">
                           <span className={`text-sm font-black ${count > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                             {count > 0 ? (total / count).toFixed(1) : '-'}
                           </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-1">
              <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden sticky top-24">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                   <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><UserPlus size={20}/></div>
                   <h3 className="font-black text-slate-800 uppercase tracking-tight">Input Siswa Baru</h3>
                </div>
                <div className="p-6 space-y-4">
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nama Lengkap Siswa</label>
                      <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} placeholder="Contoh: AHMAD SUBAGJO" />
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nomor Induk Siswa (NIS)</label>
                      <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={newStudent.nis} onChange={e => setNewStudent({...newStudent, nis: e.target.value})} placeholder="Contoh: 12345" />
                   </div>
                   <button onClick={handleAddStudent} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 mt-2 uppercase text-xs">
                     <Plus size={18}/> TAMBAHKAN SISWA
                   </button>
                </div>
              </div>
           </div>
           <div className="lg:col-span-2">
              <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                   <div className="flex items-center gap-3"><div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Users size={20}/></div><h3 className="font-black text-slate-800 uppercase tracking-tight">Daftar Siswa Kelas {kelas}</h3></div>
                </div>
                <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto no-scrollbar">
                   {filteredStudents.length === 0 ? (
                     <div className="p-20 text-center text-slate-400 italic font-bold">Belum ada siswa yang didaftarkan.</div>
                   ) : (
                     filteredStudents.map((s, i) => (
                       <div key={s.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 font-black flex items-center justify-center text-xs">{i+1}</div>
                             <div><p className="font-black text-slate-900 uppercase">{s.name}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">NIS: {s.nis}</p></div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => handleDeleteStudent(s.id)} className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                          </div>
                       </div>
                     ))
                   )}
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default EvaluasiManager;
