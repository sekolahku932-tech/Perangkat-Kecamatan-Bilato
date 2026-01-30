
import React, { useState, useEffect } from 'react';
import { SchoolSettings, AcademicYear, User } from '../types';
import { Save, Plus, Trash2, Building2, Calendar, AlertTriangle, Loader2, Cloud, Sparkles, Key, Eye, EyeOff, Info, GraduationCap, CalendarPlus } from 'lucide-react';
import { db, collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc, query, where } from '../services/firebase';

interface SettingsManagerProps {
  user: User;
}

const SettingsManager: React.FC<SettingsManagerProps> = ({ user }) => {
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school, address: '', principalName: '', principalNip: ''
  });

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [newYearInput, setNewYearInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAddingYear, setIsAddingYear] = useState(false);

  useEffect(() => {
    setLoading(true);
    // ISOLASI: Pengaturan Identitas Sekolah per ID Sekolah
    const unsubSettings = onSnapshot(doc(db, "school_settings", user.school), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });

    // ISOLASI: Tahun pelajaran disaring berdasarkan sekolah
    const qYears = query(collection(db, "academic_years"), where("school", "==", user.school));
    const unsubYears = onSnapshot(qYears, (snap) => {
      const yearList = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as AcademicYear[];
      setYears(yearList.sort((a, b) => b.year.localeCompare(a.year)));
      setLoading(false);
    });

    return () => { unsubSettings(); unsubYears(); };
  }, [user.school]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, "school_settings", user.school), {
        ...settings,
        school: user.school
      });
      alert('Identitas sekolah diperbarui!');
    } catch (error) {
      alert('Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddYear = async () => {
    if (!newYearInput.trim()) return;
    if (!/^\d{4}\/\d{4}$/.test(newYearInput)) {
      alert('Format tahun pelajaran harus YYYY/YYYY (Contoh: 2024/2025)');
      return;
    }

    setIsAddingYear(true);
    try {
      await addDoc(collection(db, "academic_years"), {
        year: newYearInput,
        isActive: false,
        school: user.school
      });
      setNewYearInput('');
      alert('Tahun pelajaran ditambahkan!');
    } catch (error) {
      alert('Gagal menambahkan tahun pelajaran.');
    } finally {
      setIsAddingYear(false);
    }
  };

  const handleToggleYear = async (id: string, currentStatus: boolean) => {
    try {
      // Nonaktifkan semua tahun pelajaran lain di sekolah yang sama
      const updates = years.map(y => updateDoc(doc(db, "academic_years", y.id), { isActive: false }));
      await Promise.all(updates);
      
      // Aktifkan yang dipilih
      await updateDoc(doc(db, "academic_years", id), { isActive: !currentStatus });
    } catch (e) { 
      console.error(e); 
      alert('Gagal mengubah status tahun pelajaran.');
    }
  };

  const handleDeleteYear = async (id: string, isActive: boolean) => {
    if (isActive) {
      alert('Tidak dapat menghapus tahun pelajaran yang sedang aktif!');
      return;
    }
    if (confirm('Hapus tahun pelajaran ini?')) {
      try {
        await deleteDoc(doc(db, "academic_years", id));
      } catch (e) {
        alert('Gagal menghapus.');
      }
    }
  };

  if (loading) {
    return (
      <div className="py-40 flex flex-col items-center justify-center gap-4 text-slate-400">
        <Loader2 size={48} className="animate-spin text-blue-600" />
        <p className="font-black text-xs uppercase tracking-widest">Sinkronisasi Pengaturan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card 1: Identitas Sekolah */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden h-fit">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Building2 size={20} />
              </div>
              <h3 className="font-black text-slate-800 uppercase tracking-tight">Identitas {user.school}</h3>
            </div>
          </div>
          <form onSubmit={handleSaveSettings} className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Nama Satuan Pendidikan</label>
              <input type="text" disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black text-slate-400" value={user.school} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Alamat Lengkap</label>
              <textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none min-h-[80px]" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Nama Kepala Sekolah</label>
                <input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold uppercase" value={settings.principalName} onChange={e => setSettings({...settings, principalName: e.target.value.toUpperCase()})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">NIP Kepala Sekolah</label>
                <input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold" value={settings.principalNip} onChange={e => setSettings({...settings, principalNip: e.target.value})} />
              </div>
            </div>
            <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} SIMPAN PERUBAHAN
            </button>
          </form>
        </div>

        {/* Card 2: Tahun Pelajaran */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden h-fit">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <Calendar size={20} />
            </div>
            <h3 className="font-black text-slate-800 uppercase tracking-tight">Tahun Pelajaran (Cloud)</h3>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Form Tambah Tahun */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Tambah Tahun Baru</label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <CalendarPlus className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Contoh: 2025/2026" 
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                    value={newYearInput}
                    onChange={e => setNewYearInput(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleAddYear}
                  disabled={isAddingYear || !newYearInput}
                  className="bg-slate-900 hover:bg-black text-white px-6 rounded-xl text-xs font-black transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isAddingYear ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />} TAMBAH
                </button>
              </div>
            </div>

            {/* List Tahun */}
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-3">Tahun Pelajaran</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {years.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">Belum ada tahun pelajaran.</td></tr>
                  ) : years.map(y => (
                    <tr key={y.id} className={y.isActive ? 'bg-amber-50/30' : ''}>
                      <td className="px-4 py-4"><span className="text-sm font-bold text-slate-700">{y.year}</span></td>
                      <td className="px-4 py-4 text-center">
                        <button 
                          onClick={() => handleToggleYear(y.id, y.isActive)}
                          className={`${y.isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'} border px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all`}
                        >
                          {y.isActive ? 'AKTIF' : 'AKTIFKAN'}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button 
                          onClick={() => handleDeleteYear(y.id, y.isActive)}
                          className="p-2 text-slate-300 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3 text-blue-600">
               <Info size={18} className="shrink-0 mt-0.5"/>
               <div>
                  <p className="text-[10px] font-black uppercase mb-1">Penting</p>
                  <p className="text-[10px] font-medium leading-relaxed uppercase">Pengaktifan tahun pelajaran akan menentukan data mana yang muncul pada dashboard dan modul perangkat ajar lainnya.</p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsManager;
