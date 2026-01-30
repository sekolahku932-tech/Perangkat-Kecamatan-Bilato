import React, { useState } from 'react';
/* FIX: Changed CheckCircle to CheckCircle2 to match icon usage on line 170 */
import { School, Lock, User as UserIcon, LogIn, AlertCircle, Loader2, Database, CheckCircle2, ArrowLeft, ShieldAlert, Settings } from 'lucide-react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, db, doc, setDoc, getDoc, signOut, isSchoolConfigured } from '../services/firebase';

interface LoginPageProps {
  school: string;
  onBack: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ school, onBack }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const getSchoolSlug = (name: string) => {
    const match = name.match(/(\d+)/);
    return match ? `sdn${match[0]}` : 'admin';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // VALIDASI KRITIS: Apakah API Key untuk sekolah ini sudah diisi?
    if (!isSchoolConfigured(school)) {
      setError(`Kredensial Cloud untuk ${school} belum diatur. Harap masukkan API Key sekolah ini di file services/firebase.ts.`);
      return;
    }

    setLoading(true);
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError('Username dan Password wajib diisi.');
      setLoading(false);
      return;
    }

    const slug = getSchoolSlug(school);
    const email = `${cleanUsername}.${slug}@bilato.sch.id`;
    
    let finalAuthPassword = cleanPassword;
    // Logika khusus untuk administrator awal (admin/admin atau admin/123456)
    if (cleanUsername === 'admin') {
      if (cleanPassword === 'admin') {
        finalAuthPassword = 'adminadmin'; // Memenuhi syarat 6 karakter Firebase
      } else if (cleanPassword === '123456') {
        finalAuthPassword = '123456';
      }
    } else if (finalAuthPassword.length < 6) {
      finalAuthPassword = finalAuthPassword.padEnd(6, '0');
    }
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, finalAuthPassword);
      const userSnap = await getDoc(doc(db, "users", userCredential.user.uid));
      
      if (userSnap.exists()) {
        /* FIX: Cast userData to any to avoid "unknown" type error when accessing 'school' property */
        const userData = userSnap.data() as any;
        if (userData.school !== school) {
          await signOut(auth);
          setError(`Akses ditolak. Akun ini terdaftar di database ${userData.school}.`);
          setLoading(false);
          return;
        }
      } else if (cleanUsername === 'admin') {
        await setDoc(doc(db, "users", userCredential.user.uid), {
          username: 'admin',
          role: 'admin',
          name: `Administrator ${school}`,
          school: school,
          nip: '-',
          kelas: '-',
          teacherType: 'kelas',
          mapelDiampu: []
        });
      }

      setSuccess('Masuk Berhasil! Mempersiapkan sistem...');
    } catch (err: any) {
      // Inisialisasi otomatis jika database kosong dan menggunakan password default admin/123456
      if ((err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') && 
          cleanUsername === 'admin' && (cleanPassword === 'admin' || cleanPassword === '123456')) {
        try {
          const newUser = await createUserWithEmailAndPassword(auth, email, finalAuthPassword);
          await setDoc(doc(db, "users", newUser.user.uid), {
            username: 'admin',
            role: 'admin',
            name: `Administrator ${school}`,
            school: school,
            nip: '-',
            kelas: '-',
            teacherType: 'kelas',
            mapelDiampu: []
          });
          setSuccess(`Inisialisasi database ${school} berhasil!`);
        } catch (createErr: any) {
          setError('Gagal inisialisasi database: ' + createErr.message);
        }
      } else {
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setError('Password salah atau akun tidak ditemukan di database sekolah ini.');
        } else if (err.code === 'auth/api-key-not-valid') {
          setError('API Key Firebase tidak valid. Harap periksa kembali konfigurasi di services/firebase.ts.');
        } else {
          setError('Gagal masuk: ' + (err.message || 'Kendala koneksi cloud'));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden text-slate-900">
      <div className="absolute top-0 right-0 p-20 opacity-5 pointer-events-none">
        <School size={500} className="text-indigo-600" />
      </div>

      <div className="max-w-md w-full relative z-10">
        <button 
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={16} /> Kembali ke Pilihan Sekolah
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-5 bg-indigo-600 text-white rounded-3xl shadow-2xl mb-6 animate-in zoom-in duration-700">
            <School size={48} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-tight">{school}</h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">Sistem Kurikulum Terpisah (Multi-Account)</p>
        </div>

        <div className="bg-white rounded-[48px] shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-8 duration-700">
          <div className="p-10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Login Portal</h2>
              {!isSchoolConfigured(school) ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[9px] font-black uppercase animate-pulse">
                  <ShieldAlert size={10} /> Config Missing
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase">
                  <Database size={10} /> Cloud Ready
                </div>
              )}
            </div>
            
            {error && (
              <div className="mb-6 p-4 rounded-2xl flex items-start gap-3 bg-red-50 border border-red-100 text-red-600 animate-in shake duration-500">
                <AlertCircle size={20} className="shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-bold leading-tight">{error}</p>
                  {!isSchoolConfigured(school) && (
                    <p className="text-[10px] font-medium opacity-80">Cari baris '{school}' di file services/firebase.ts dan ganti 'PASTE_API_KEY...' dengan kode asli.</p>
                  )}
                </div>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3 text-emerald-600 animate-in fade-in">
                <CheckCircle2 size={20} className="shrink-0" />
                <p className="text-sm font-bold">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400">
                    <UserIcon size={18} />
                  </div>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-3xl py-4 pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-bold transition-all placeholder:text-slate-300"
                    placeholder="Contoh: admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-3xl py-4 pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-bold transition-all placeholder:text-slate-300"
                    placeholder="123456"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-3xl shadow-xl shadow-slate-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4 text-xs tracking-widest uppercase disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin"/> : <LogIn size={18} />}
                {loading ? 'MENUNGGU CLOUD...' : 'MASUK KE SISTEM'}
              </button>
            </form>
          </div>
          
          <div className="bg-slate-50 p-6 border-t border-slate-100 text-center">
             <div className="flex items-center justify-center gap-2 text-slate-400">
               <Settings size={12} />
               <p className="text-[9px] font-black uppercase tracking-[0.3em]">
                 ISOLATED ACCOUNT INSTANCE v2.1
               </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;