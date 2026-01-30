
import React, { useState, useEffect, useMemo } from 'react';
import { User, MATA_PELAJARAN } from '../types';
import { 
  Trash2, Edit2, Save, X, Users, UserCheck, 
  AlertTriangle, Loader2, Search, CheckSquare, Square, Key, Eye, EyeOff
} from 'lucide-react';
import { db, registerAuth, collection, onSnapshot, doc, setDoc, deleteDoc, createUserWithEmailAndPassword, signOut } from '../services/firebase';

interface UserManagerProps {
  user: User;
}

const UserManager: React.FC<UserManagerProps> = ({ user }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState<Partial<User>>({
    username: '',
    password: '',
    role: 'guru',
    teacherType: 'kelas',
    name: '',
    nip: '',
    kelas: '',
    school: user.school,
    mapelDiampu: []
  });
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const userList = snap.docs.map(d => ({ id: d.id, ...d.data() })) as User[];
      setUsers(userList);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const getSchoolSlug = (name: string) => {
    const match = name.match(/(\d+)/);
    return match ? `sdn${match[0]}` : 'admin';
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.school === user.school && (
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [users, searchTerm, user.school]);

  const handleSave = async () => {
    const cleanUsername = formData.username?.trim().toLowerCase();
    const cleanPassword = formData.password?.trim();
    const cleanName = formData.name?.trim();

    if (!cleanUsername || !cleanName || (!isEditing && !cleanPassword)) {
      alert('Mohon lengkapi Username, Password, dan Nama!');
      return;
    }

    setIsSaving(true);
    try {
      const slug = getSchoolSlug(user.school);
      let email = "";
      
      if (cleanUsername === 'admin') {
         email = `admin.${slug}@bilato.sch.id`;
      } else {
         email = `${cleanUsername}.${slug}@bilato.sch.id`;
      }

      let userPwd = cleanPassword || '';
      if (!isEditing && userPwd.length < 6) {
        userPwd = userPwd + userPwd;
      }

      const userPayload = {
        username: cleanUsername,
        role: formData.role || 'guru',
        teacherType: formData.teacherType || 'kelas',
        name: cleanName,
        nip: formData.nip?.trim() || '-',
        kelas: formData.kelas?.trim() || '-',
        school: user.school, 
        mapelDiampu: formData.mapelDiampu || []
      };

      if (isEditing) {
        await setDoc(doc(db, "users", isEditing), userPayload, { merge: true });
        setIsEditing(null);
        alert('Data Guru berhasil diperbarui!');
      } else {
        const userCredential = await createUserWithEmailAndPassword(registerAuth, email, userPwd);
        const firebaseUid = userCredential.user.uid;
        await setDoc(doc(db, "users", firebaseUid), userPayload);
        await signOut(registerAuth);
        alert(`Berhasil mendaftarkan @${cleanUsername} di ${user.school}`);
      }
      resetForm();
    } catch (error: any) {
      console.error("Registration Error:", error);
      let errorMsg = error.message;
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = "Username sudah digunakan di sekolah ini atau sekolah lain.";
      }
      alert('Gagal: ' + errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      role: 'guru',
      teacherType: 'kelas',
      name: '',
      nip: '',
      kelas: '',
      school: user.school,
      mapelDiampu: []
    });
    setIsEditing(null);
  };

  const startEdit = (u: User) => {
    setIsEditing(u.id);
    setFormData({ ...u, password: 'HIDDEN' });
  };

  const toggleMapel = (m: string) => {
    const current = formData.mapelDiampu || [];
    if (current.includes(m)) {
      setFormData({ ...formData, mapelDiampu: current.filter(item => item !== m) });
    } else {
      setFormData({ ...formData, mapelDiampu: [...current, m] });
    }
  };

  const executeDeleteUser = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, "users", deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (e) {
      alert('Gagal menghapus data dari database.');
    }
  };

  if (loading) {
    return (
      <div className="py-40 flex flex-col items-center justify-center gap-4 text-slate-400">
        <Loader2 size={48} className="animate-spin text-indigo-600" />
        <p className="font-black text-xs uppercase tracking-widest">Sinkronisasi Database Guru...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} /></div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus Pengguna</h3>
              <p className="text-slate-500 font-medium text-sm">Hapus data profil dari database Cloud?</p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200">BATAL</button>
              <button onClick={executeDeleteUser} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600">HAPUS</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1">
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden sticky top-24">
            <div className={`p-8 border-b border-slate-100 flex items-center gap-4 transition-colors ${isEditing ? 'bg-amber-50' : 'bg-slate-50'}`}>
              <div className={`p-3 rounded-2xl ${isEditing ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                {isEditing ? <Edit2 size={24} /> : <UserCheck size={24} />}
              </div>
              <h3 className="font-black text-slate-800 uppercase tracking-tight">
                {isEditing ? 'Edit Profil' : 'Daftar Guru'}
              </h3>
            </div>
            <div className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1">Username</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-600" value={formData.username} disabled={!!isEditing} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="guru.sdn" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1">Password</label>
                  <input type="password" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-600" value={isEditing ? '********' : formData.password} disabled={!!isEditing} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Min 6 Karakter" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1">Nama Lengkap</label>
                <input className="w-full border border-slate-200 rounded-2xl p-3.5 text-sm font-semibold outline-none uppercase focus:ring-2 focus:ring-indigo-600" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1">NIP</label>
                  <input className="w-full border border-slate-200 rounded-2xl p-3.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-600" value={formData.nip} onChange={e => setFormData({...formData, nip: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1">Penempatan</label>
                  <select className="w-full border border-slate-200 rounded-2xl p-3.5 text-sm font-semibold outline-none bg-white focus:ring-2 focus:ring-indigo-600" value={formData.kelas || ''} onChange={e => setFormData({...formData, kelas: e.target.value})}>
                    <option value="">-- KELAS --</option>
                    {['1','2','3','4','5','6','-','Multikelas'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 ml-1">Mapel Diampu</label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {MATA_PELAJARAN.map(m => {
                    const isChecked = (formData.mapelDiampu || []).includes(m);
                    return (
                      <button key={m} onClick={() => toggleMapel(m)} className={`flex items-center gap-3 p-3.5 rounded-2xl border text-[11px] font-bold transition-all text-left ${isChecked ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}>
                        {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                        <span className="truncate">{m}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button onClick={handleSave} disabled={isSaving} className={`flex-1 text-white font-black py-4 rounded-3xl shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-widest ${isEditing ? 'bg-amber-600' : 'bg-indigo-600'}`}>
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {isEditing ? 'UPDATE PROFIL' : 'DAFTARKAN GURU'}
                </button>
                {isEditing && (
                  <button onClick={resetForm} className="bg-slate-100 text-slate-600 p-4 rounded-3xl transition-all"><X size={18} /></button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-2xl shadow-sm"><Users size={24} className="text-indigo-600"/></div>
                <h3 className="font-black text-slate-800 uppercase tracking-tight">Database Guru {user.school}</h3>
              </div>
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="bg-white border border-slate-200 rounded-3xl py-3 pl-12 pr-6 text-xs font-bold w-full md:w-72 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" placeholder="Cari Guru..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest h-14">
                    <th className="px-8 py-2">Informasi Profil</th>
                    <th className="px-8 py-2">Tugas & Kelas</th>
                    <th className="px-8 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="group hover:bg-slate-50/50 transition-colors align-top">
                      <td className="px-8 py-6">
                        <div className="font-black text-sm uppercase text-slate-900 leading-none mb-1">{u.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">@{u.username} • NIP: {u.nip}</div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase">
                          Kelas {u.kelas}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(u)} className="p-2.5 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Edit2 size={18} /></button>
                          <button onClick={() => setDeleteConfirmId(u.id)} className="p-2.5 text-red-600 bg-red-50 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={18} /></button>
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

export default UserManager;
