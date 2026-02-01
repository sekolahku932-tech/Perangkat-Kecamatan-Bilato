
import React, { useState } from 'react';
import { User } from '../types';
import { 
  Save, User as UserIcon, Loader2, Sparkles, 
  Info, ShieldCheck, CheckCircle2, Key, Eye, EyeOff 
} from 'lucide-react';
import { db, doc, updateDoc } from '../services/firebase';

interface ProfileManagerProps {
  user: User;
}

const ProfileManager: React.FC<ProfileManagerProps> = ({ user }) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    nip: user.nip || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await updateDoc(doc(db, "users", user.id), {
        name: formData.name.toUpperCase(),
        nip: formData.nip,
      });
      setMessage({ text: 'Profil Berhasil Diperbarui!', type: 'success' });
    } catch (error: any) {
      console.error(error);
      setMessage({ text: 'Gagal memperbarui profil: ' + error.message, type: 'error' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="bg-white rounded-[48px] shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-10 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50 gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-indigo-600 text-white rounded-[2rem] shadow-xl shadow-indigo-100">
              <UserIcon size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Profil Pengguna</h2>
              <p className="text-xs font-