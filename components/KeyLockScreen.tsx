
import React, { useState } from 'react';
import { ShieldAlert, Key, Lock, Loader2, CheckCircle2, Sparkles, ArrowRight, ShieldCheck, Info } from 'lucide-react';
import { db, doc, updateDoc } from '../services/firebase';
import { User } from '../types';

interface KeyLockScreenProps {
  user: User;
}

const KeyLockScreen: React.FC<KeyLockScreenProps> = ({ user }) => {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanKey = apiKey.trim();
    
    if (!cleanKey.startsWith('AIza')) {
      setError('Format API Key tidak valid. Kunci Gemini biasanya dimulai dengan "AIza...".');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Simpan kunci ke profil user di Firestore
      // App.tsx akan mendeteksi perubahan ini secara otomatis melalui onSnapshot
      await updateDoc(doc(db, "users", user.id), {
        apiKey: cleanKey
      });
      
      setSuccess(true);
      // Tidak menggunakan reload() agar tidak terjadi error 404
      // Layar akan tertutup otomatis saat state user di App.tsx berubah
    } catch (err: any) {
      setError('Gagal menyimpan kunci keamanan: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-[500] flex items-center justify-center p-6 overflow-y-auto">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden">
        <div className="grid grid-cols-6 gap-10 rotate-12 scale-150">
          {Array.from({ length: 24 }).map((_, i) => (
            <Lock key={i} size={120} className="text-slate-900" />
          ))}
        </div>
      </div>

      <div className="max-w-xl w-full relative">
        <div className="bg-white rounded-[48px] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-500">
          <div className="p-10 md:p-14">
            <div className="flex justify-center mb-10">
              <div className="relative">
                <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center text-white shadow-2xl transition-all duration-700 ${success ? 'bg-emerald-500 shadow-emerald-200 rotate-[360deg]' : 'bg-indigo-600 shadow-indigo-200'}`}>
                  {success ? <ShieldCheck size={48} className="animate-in zoom-in" /> : <Lock size={48} />}
                </div>
                {!success && (
                  <div className="absolute -top-4 -right-4 w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg animate-bounce">
                    <Key size={24} />
                  </div>
                )}
              </div>
            </div>

            <div className="text-center mb-10">
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-tight mb-3">
                {success ? 'Akses Terbuka' : 'Sistem Terkunci'}
              </h2>
              <p className="text-slate-500 font-medium text-sm leading-relaxed px-4">
                {success 
                  ? 'Kunci Anda telah divalidasi. Mengalihkan ke Dashboard...'
                  : <>Halo <span className="text-indigo-600 font-bold">{user.name}</span>, akses ke Dashboard {user.school} memerlukan <span className="font-bold">Personal API Key</span> sebagai kunci enkripsi AI.</>
                }
              </p>
            </div>

            {error && (
              <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-600 animate-in shake">
                <ShieldAlert size={20} className="shrink-0" />
                <p className="text-xs font-bold leading-tight">{error}</p>
              </div>
            )}

            {success ? (
              <div className="flex flex-col items-center py-6 animate-in fade-in">
                <div className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-full font-black text-xs uppercase tracking-widest border border-emerald-100">
                  <Loader2 size={16} className="animate-spin" /> Sinkronisasi Cloud...
                </div>
              </div>
            ) : (
              <form onSubmit={handleUnlock} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-[0.2em]">
                    Masukkan Gemini API Key
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400">
                      <Key size={18} />
                    </div>
                    <input
                      type="password"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-3xl py-5 pl-12 pr-4 text-slate-900 focus:ring-4 focus:ring-indigo-500/10 outline-none font-mono text-sm transition-all placeholder:text-slate-300"
                      placeholder="AIzaSyB-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !apiKey}
                  className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-[2rem] shadow-xl shadow-slate-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-xs tracking-[0.2em] uppercase disabled:opacity-50"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
                  AKTIFKAN AKSES SISTEM
                </button>
              </form>
            )}

            <div className="mt-12 pt-8 border-t border-slate-100 flex items-start gap-4">
               <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Info size={16}/></div>
               <div className="space-y-1">
                 <p className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Penting</p>
                 <p className="text-[9px] text-slate-400 font-medium leading-relaxed uppercase">
                   Gunakan API Key dari Google AI Studio. Kunci ini hanya disimpan di profil Anda untuk keperluan modul AI personal.
                 </p>
               </div>
            </div>
          </div>
          
          <div className="bg-slate-50 p-6 flex items-center justify-center gap-2">
             <Sparkles size={14} className="text-indigo-400" />
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">
               SECURITY GATE v4.1 - SDN BILATO
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyLockScreen;
