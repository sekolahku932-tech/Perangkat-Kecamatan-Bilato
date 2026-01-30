import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, CapaianPembelajaran, MATA_PELAJARAN, SchoolSettings, User } from '../types';
import { Plus, Edit2, Trash2, Save, X, Loader2, Cloud, AlertTriangle, Eye, EyeOff, Printer, FileDown, AlertCircle, BookOpen, Lock } from 'lucide-react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from '../services/firebase';

interface CPManagerProps {
  user: User;
}

const CPManager: React.FC<CPManagerProps> = ({ user }) => {
  const [cps, setCps] = useState<CapaianPembelajaran[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFase, setFilterFase] = useState<Fase>(Fase.A);
  const [filterMapel, setFilterMapel] = useState<string>(MATA_PELAJARAN[0]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [formData, setFormData] = useState<Partial<CapaianPembelajaran>>({
    fase: Fase.A,
    mataPelajaran: MATA_PELAJARAN[0],
    kode: '',
    elemen: '',
    deskripsi: ''
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school,
    address: '-',
    principalName: '-',
    principalNip: '-'
  });

  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';

  useEffect(() => {
    if (user.role === 'guru') {
      if (user.mapelDiampu && user.mapelDiampu.length > 0) {
        setFilterMapel(user.mapelDiampu[0]);
      }
      
      let targetFase = filterFase;
      if (['1', '2'].includes(user.kelas)) targetFase = Fase.A;
      else if (['3', '4'].includes(user.kelas)) targetFase = Fase.B;
      else if (['5', '6'].includes(user.kelas)) targetFase = Fase.C;
      
      if (isClassLocked) {
        setFilterFase(targetFase);
        setFormData(prev => ({ ...prev, fase: targetFase }));
      }
    }
  }, [user, isClassLocked]);

  useEffect(() => {
    setLoading(true);
    // ISOLASI: Ambil setting spesifik sekolah
    const unsubSettings = onSnapshot(doc(db, "school_settings", user.school), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });

    // ISOLASI: Filter CP berdasarkan sekolah
    const q = query(collection(db, "cps"), where("school", "==", user.school));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CapaianPembelajaran[];
      setCps(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore snapshot error:", error);
      setLoading(false);
    });

    return () => { unsubSettings(); unsubscribe(); };
  }, [user.school]);

  const sortedAndFilteredCps = useMemo(() => {
    return cps
      .filter(cp => cp.fase === filterFase && cp.mataPelajaran === filterMapel)
      .sort((a, b) => (a.kode || '').localeCompare(b.kode || '', undefined, { numeric: true, sensitivity: 'base' }));
  }, [cps, filterFase, filterMapel]);

  const handleAddOrUpdate = async () => {
    if (!formData.kode || !formData.elemen || !formData.deskripsi) return;
    try {
      if (isEditing) {
        await updateDoc(doc(db, "cps", isEditing), { ...formData, fase: filterFase, mataPelajaran: filterMapel, school: user.school });
        setIsEditing(null);
      } else {
        await addDoc(collection(db, "cps"), { 
          fase: filterFase, 
          mataPelajaran: filterMapel, 
          kode: formData.kode, 
          elemen: formData.elemen, 
          deskripsi: formData.deskripsi,
          school: user.school // ISOLASI: Sertakan ID sekolah
        });
      }
      setFormData({ ...formData, kode: '', elemen: '', deskripsi: '' });
    } catch (error) { console.error(error); }
  };

  const startEdit = (cp: CapaianPembelajaran) => { setIsEditing(cp.id); setFormData(cp); };

  const deleteCp = async () => {
    if (!deleteConfirm) return;
    try { await deleteDoc(doc(db, "cps", deleteConfirm)); setDeleteConfirm(null); } catch (error) { console.error(error); }
  };

  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : user.mapelDiampu;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak CP - ${user.school}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Inter', sans-serif; background: white; padding: 40px; }
              @media print { .no-print { display: none !important; } body { padding: 0; } }
              table { border-collapse: collapse; }
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
      <div className="bg-white p-12 min-h-screen text-slate-900 font-serif">
        <div className="no-print fixed top-6 right-6 flex gap-3 z-[300]">
          <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xl hover:bg-black transition-all">
            <EyeOff size={16} /> KEMBALI
          </button>
          <button onClick={handlePrint} className="bg-rose-600 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xl hover:bg-rose-700 transition-all">
            <Printer size={16} /> CETAK PDF
          </button>
        </div>

        <div ref={printRef}>
          <div className="text-center mb-10">
            <h1 className="text-2xl font-black uppercase border-b-4 border-black pb-2 inline-block tracking-tight text-slate-900">Capaian Pembelajaran (CP)</h1>
            <h2 className="text-xl font-bold mt-3 uppercase text-slate-800">{settings.schoolName}</h2>
            <div className="flex justify-center gap-10 mt-6 text-xs font-black uppercase tracking-widest text-slate-600 font-sans">
              <span>MAPEL: {filterMapel}</span>
              <span>FASE: {filterFase}</span>
            </div>
          </div>

          <table className="w-full border-collapse border-2 border-black text-[10px]">
            <thead>
              <tr className="bg-slate-100 h-12 uppercase font-black text-center">
                <th className="border-2 border-black w-10">NO</th>
                <th className="border-2 border-black px-2 w-20">KODE</th>
                <th className="border-2 border-black px-4 text-left w-48">ELEMEN</th>
                <th className="border-2 border-black px-4 text-left">DESKRIPSI CAPAIAN PEMBELAJARAN</th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFilteredCps.length === 0 ? (
                <tr><td colSpan={4} className="border-2 border-black p-10 text-center italic text-slate-400">Belum ada data CP.</td></tr>
              ) : (
                sortedAndFilteredCps.map((cp, idx) => (
                  <tr key={cp.id} className="break-inside-avoid">
                    <td className="border-2 border-black p-3 text-center font-bold">{idx + 1}</td>
                    <td className="border-2 border-black p-3 text-center font-black uppercase">{cp.kode}</td>
                    <td className="border-2 border-black p-3 font-black uppercase leading-tight">{cp.elemen}</td>
                    <td className="border-2 border-black p-3 leading-relaxed text-justify">{cp.deskripsi}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus CP</h3>
              <p className="text-slate-500 font-medium text-sm">Hapus data Capaian Pembelajaran ini dari database sekolah Anda?</p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200">BATAL</button>
              <button onClick={deleteCp} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600">YA, HAPUS</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><BookOpen size={24} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">CAPAIAN PEMBELAJARAN (CP)</h2>
              <p className="text-[10px] text-indigo-600 font-black uppercase mt-1">Database Terpisah: {user.school}</p>
            </div>
          </div>
          <button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black shadow-lg transition-all"><Eye size={18} /> PRATINJAU</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-[24px] border border-slate-100">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1">Fase {isClassLocked && <Lock size={10} className="text-amber-500" />}</label>
            <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100" value={filterFase} disabled={isClassLocked} onChange={(e) => setFilterFase(e.target.value as Fase)}>
              {Object.values(Fase).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Mapel</label><select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={filterMapel} onChange={(e) => setFilterMapel(e.target.value)}>{availableMapel.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
          <div className={`p-6 border-b border-slate-100 flex items-center justify-between transition-colors ${isEditing ? 'bg-amber-50' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isEditing ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                {isEditing ? <Edit2 size={20} /> : <Plus size={20} />}
              </div>
              <h3 className="font-black text-slate-800 uppercase tracking-tight">{isEditing ? 'Edit Data CP' : 'Tambah CP Baru'}</h3>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Kode CP</label><input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 transition-all uppercase" value={formData.kode} onChange={e => setFormData({ ...formData, kode: e.target.value })} placeholder="C1, B2, dst..." /></div>
            <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Elemen</label><input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.elemen} onChange={e => setFormData({ ...formData, elemen: e.target.value })} placeholder="Nama Elemen..." /></div>
            <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Deskripsi CP</label><textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[200px]" value={formData.deskripsi} onChange={e => setFormData({ ...formData, deskripsi: e.target.value })} placeholder="Salin deskripsi CP di sini..." /></div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleAddOrUpdate} className={`flex-1 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest ${isEditing ? 'bg-amber-600' : 'bg-blue-600'}`}>
                <Save size={18} /> {isEditing ? 'UPDATE' : 'SIMPAN'}
              </button>
              {isEditing && <button onClick={() => { setIsEditing(null); setFormData({ ...formData, kode: '', elemen: '', deskripsi: '' }); }} className="bg-slate-100 text-slate-600 p-4 rounded-xl"><X size={18} /></button>}
            </div>
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest h-12">
                    <th className="px-6 py-2 w-16 text-center">No</th>
                    <th className="px-6 py-2 w-24">Kode</th>
                    <th className="px-6 py-2 w-48">Elemen</th>
                    <th className="px-6 py-2">Deskripsi CP</th>
                    <th className="px-6 py-2 w-24 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin inline-block text-blue-600" /></td></tr>
                  ) : sortedAndFilteredCps.length === 0 ? (
                    <tr><td colSpan={5} className="py-32 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">Belum ada data CP untuk {user.school}</td></tr>
                  ) : sortedAndFilteredCps.map((cp, idx) => (
                    <tr key={cp.id} className="group hover:bg-slate-50 transition-colors align-top">
                      <td className="px-6 py-6 text-center font-black text-slate-300">{idx + 1}</td>
                      <td className="px-6 py-6 font-black text-xs text-blue-600 uppercase">{cp.kode}</td>
                      <td className="px-6 py-6 font-black text-xs text-slate-900 uppercase leading-tight">{cp.elemen}</td>
                      <td className="px-6 py-6 text-[11px] leading-relaxed text-slate-600 text-justify italic">"{cp.deskripsi}"</td>
                      <td className="px-6 py-6 text-center">
                        <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(cp)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                          <button onClick={() => setDeleteConfirm(cp.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CPManager;