
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, LKPDItem, RPMItem, MATA_PELAJARAN, SchoolSettings, User } from '../types';
import { Plus, Trash2, Rocket, Sparkles, Loader2, CheckCircle2, Printer, Cloud, FileText, Split, AlertTriangle, FileDown, Wand2, PencilLine, Lock, Brain, Zap, RefreshCw, PenTool, Search, AlertCircle, X, ArrowRight, Hammer, Download, ArrowLeft, ListTree } from 'lucide-react';
import { generateLKPDContent } from '../services/geminiService';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from '../services/firebase';

interface LKPDManagerProps {
  user: User;
}

const LKPDManager: React.FC<LKPDManagerProps> = ({ user }) => {
  const [lkpdList, setLkpdList] = useState<LKPDItem[]>([]);
  const [rpmList, setRpmList] = useState<RPMItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFase, setFilterFase] = useState<Fase>(Fase.A);
  const [filterKelas, setFilterKelas] = useState<Kelas>('1');
  const [filterSemester, setFilterSemester] = useState<'1' | '2'>('1');
  const [filterMapel, setFilterMapel] = useState<string>(MATA_PELAJARAN[0]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showRpmPicker, setShowRpmPicker] = useState(false);
  const [settings, setSettings] = useState<SchoolSettings>({ schoolName: user.school, address: '-', principalName: '-', principalNip: '-' });
  const [activeYear, setActiveYear] = useState('2024/2025');

  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';
  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || []);

  useEffect(() => {
    if (user.role === 'guru' && user.kelas !== '-' && user.kelas !== 'Multikelas') {
      setFilterKelas(user.kelas as Kelas);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const unsubLkpd = onSnapshot(query(collection(db, "lkpd"), where("userId", "==", user.id)), (snapshot) => {
      setLkpdList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LKPDItem[]);
    });
    const unsubRpm = onSnapshot(query(collection(db, "rpm"), where("userId", "==", user.id)), (snapshot) => {
      setRpmList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RPMItem[]);
      setLoading(false);
    });
    return () => { unsubLkpd(); unsubRpm(); };
  }, [user.id]);

  const handleGenerateAI = async (id: string) => {
    const lkpd = lkpdList.find(l => l.id === id);
    if (!lkpd || !user.apiKey) { alert("API Key diperlukan."); return; }
    const rpm = rpmList.find(r => r.id === lkpd.rpmId);
    if (!rpm) return;

    setIsLoadingAI(true);
    try {
      const result = await generateLKPDContent(user.apiKey, rpm);
      if (result) {
        await updateDoc(doc(db, "lkpd", id), { ...result });
        setMessage({ text: 'Konten LKPD Sinkron AI personal Berhasil!', type: 'success' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) { setMessage({ text: 'AI Gagal.', type: 'error' }); } finally { setIsLoadingAI(false); }
  };

  const updateLKPD = async (id: string, field: keyof LKPDItem, value: any) => {
    try { await updateDoc(doc(db, "lkpd", id), { [field]: value }); } catch (e) { console.error(e); }
  };

  const handleSelectRpm = async (rpm: RPMItem) => {
    try {
      await addDoc(collection(db, "lkpd"), {
        userId: user.id, rpmId: rpm.id, fase: rpm.fase, kelas: rpm.kelas, semester: rpm.semester, mataPelajaran: rpm.mataPelajaran,
        judul: `LKPD: ${rpm.materi}`, tujuanPembelajaran: rpm.tujuanPembelajaran, petunjuk: '1. Berdoalah.\n2. Baca materi.\n3. Kerjakan.',
        alatBahan: '-', materiRingkas: '-', langkahKerja: '-', tugasMandiri: '-', refleksi: '-', jumlahPertemuan: rpm.jumlahPertemuan || 1, school: user.school
      });
      setShowRpmPicker(false);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 pb-20 font-sans">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
         <h2 className="text-xl font-black uppercase">Lembar Kerja Siswa (LKPD)</h2>
         <button onClick={() => setShowRpmPicker(true)} className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-black text-xs shadow-xl uppercase tracking-widest"><Plus size={18} className="inline mr-2"/> BUAT LKPD DARI RPM</button>
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                 <h3 className="font-black uppercase text-sm tracking-widest">Editor LKPD Personal</h3>
                 <div className="flex gap-2">
                    <button onClick={() => handleGenerateAI(isEditing!)} disabled={isLoadingAI} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black flex items-center gap-2">{isLoadingAI ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12}/>} SINKRON AI</button>
                    <button onClick={() => setIsEditing(null)} className="bg-red-600 px-6 py-2 rounded-xl text-[10px] font-black">TUTUP</button>
                 </div>
              </div>
              <div className="p-8 overflow-y-auto space-y-6 no-scrollbar bg-slate-50/50">
                 <textarea className="w-full bg-white border rounded-xl p-4 text-xs font-bold h-40" value={lkpdList.find(l=>l.id===isEditing)?.materiRingkas} onChange={e => updateLKPD(isEditing!, 'materiRingkas', e.target.value)} placeholder="Materi Ringkas..." />
                 <textarea className="w-full bg-white border rounded-xl p-4 text-xs font-bold h-40" value={lkpdList.find(l=>l.id===isEditing)?.tugasMandiri} onChange={e => updateLKPD(isEditing!, 'tugasMandiri', e.target.value)} placeholder="Tugas Mandiri..." />
              </div>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {lkpdList.filter(l => l.kelas === filterKelas).map(lkpd => (
          <div key={lkpd.id} className="bg-white p-8 rounded-[3rem] border group transition-all">
            <h4 className="font-black text-slate-900 uppercase mb-4">{lkpd.judul}</h4>
            <div className="flex gap-2 pt-4 border-t"><button onClick={() => setIsEditing(lkpd.id)} className="flex-1 bg-slate-900 text-white py-3 rounded-xl text-[10px] font-black">EDIT KONTEN</button><button onClick={() => setDeleteConfirmId(lkpd.id)} className="p-3 text-slate-300 hover:text-red-600"><Trash2 size={18}/></button></div>
          </div>
        ))}
      </div>

      {showRpmPicker && (
        <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[40px] p-8 animate-in zoom-in-95">
             <div className="flex justify-between items-center mb-6"><h3 className="font-black uppercase">Pilih RPM Referensi</h3><button onClick={() => setShowRpmPicker(false)}><X size={24}/></button></div>
             <div className="space-y-3">{rpmList.map(r => (<button key={r.id} onClick={() => handleSelectRpm(r)} className="w-full p-4 bg-slate-50 text-left rounded-2xl hover:bg-indigo-50 font-bold uppercase text-[10px]">{r.tujuanPembelajaran}</button>))}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LKPDManager;
