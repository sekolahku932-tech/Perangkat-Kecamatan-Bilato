
import { Fase, Kelas, Siswa, AsesmenNilai, AsesmenInstrumen, ATPItem, MATA_PELAJARAN, SchoolSettings, User, KisiKisiItem } from '../types';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Trash2, Loader2, Cloud, Printer, CheckCircle2, AlertTriangle, 
  PenTool, BarChart3, Wand2, ChevronRight, FileDown, Sparkles, Lock, Eye, EyeOff, AlertCircle, X, BookText, Square, CheckSquare, Circle, ImageIcon, Download, ArrowLeft, Key
} from 'lucide-react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from '../services/firebase';
import { generateIndikatorSoal, generateButirSoal, generateAiImage } from '../services/geminiService';

interface AsesmenManagerProps {
  type: 'formatif' | 'sumatif';
  user: User;
}

const AsesmenManager: React.FC<AsesmenManagerProps> = ({ type, user }) => {
  const [activeTab, setActiveTab] = useState<'KISI_KISI' | 'SOAL'>('KISI_KISI');
  const [fase, setFase] = useState<Fase>(Fase.A);
  const [kelas, setKelas] = useState<Kelas>('1');
  const [semester, setSemester] = useState<'1' | '2'>('1');
  const [mapel, setMapel] = useState<string>(MATA_PELAJARAN[1]);
  const [namaAsesmen, setNamaAsesmen] = useState<string>('SUMATIF AKHIR SEMESTER');
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [tps, setTps] = useState<ATPItem[]>([]);
  const [kisikisi, setKisikisi] = useState<KisiKisiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoadingMap, setAiLoadingMap] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [showAddAsesmenModal, setShowAddAsesmenModal] = useState(false);
  const [modalInputValue, setModalInputValue] = useState('');
  
  const [settings, setSettings] = useState<SchoolSettings>({ schoolName: user.school, address: '-', principalName: '-', principalNip: '-' });
  const [activeYear, setActiveYear] = useState('2025/2026');

  useEffect(() => {
    if (user.role === 'guru' && user.kelas !== '-' && user.kelas !== 'Multikelas') {
      setKelas(user.kelas as Kelas);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const unsubKisi = onSnapshot(query(collection(db, "kisikisi"), where("userId", "==", user.id)), (snapshot) => {
      setKisikisi(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as KisiKisiItem[]);
      setLoading(false);
    });
    const unsubAtp = onSnapshot(query(collection(db, "atp"), where("userId", "==", user.id)), (snapshot) => {
      setTps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ATPItem[]);
    });
    return () => { unsubKisi(); unsubAtp(); };
  }, [user.id]);

  const generateIndikatorAI = async (item: KisiKisiItem) => {
    if (!item.tujuanPembelajaran) return;
    if (!user.apiKey) return;

    setAiLoadingMap(prev => ({ ...prev, [`ind-${item.id}`]: true }));
    try {
      const indikator = await generateIndikatorSoal(item, user.apiKey);
      if (indikator) await updateDoc(doc(db, "kisikisi", item.id), { indikatorSoal: indikator });
    } catch (e: any) { setMessage({ text: "AI Gagal Memproses.", type: "error" }); } finally { 
      setAiLoadingMap(prev => ({ ...prev, [`ind-${item.id}`]: false })); 
    }
  };

  const generateSoalAI = async (item: KisiKisiItem) => {
    if (!item.indikatorSoal) return;
    if (!user.apiKey) return;

    setAiLoadingMap(prev => ({ ...prev, [`soal-${item.id}`]: true }));
    try {
      const result = await generateButirSoal(item, user.apiKey);
      if (result) {
        await updateDoc(doc(db, "kisikisi", item.id), { 
          stimulus: result.stimulus || "",
          soal: result.soal || "", 
          kunciJawaban: result.kunci || "" 
        });
        setMessage({ text: "Soal disusun menggunakan sistem AI!", type: "success" });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (e: any) { setMessage({ text: "AI Gagal.", type: "error" }); } finally { 
      setAiLoadingMap(prev => ({ ...prev, [`soal-${item.id}`]: false })); 
    }
  };

  const triggerImageAI = async (item: KisiKisiItem) => {
     if (!user.apiKey) return;
     setAiLoadingMap(prev => ({ ...prev, [`img-${item.id}`]: true }));
     try {
        const context = item.stimulus || item.indikatorSoal;
        const base64 = await generateAiImage(context, kelas, user.apiKey);
        if (base64) await updateDoc(doc(db, "kisikisi", item.id), { stimulusImage: base64 });
     } catch (e) { console.error(e); } finally {
        setAiLoadingMap(prev => ({ ...prev, [`img-${item.id}`]: false }));
     }
  };

  const filteredKisikisi = useMemo(() => {
    return kisikisi.filter(k => k.fase === fase && k.kelas === kelas && k.semester === semester && k.mataPelajaran === mapel && (namaAsesmen === '' || k.namaAsesmen === namaAsesmen)).sort((a, b) => (a.nomorSoal || 0) - (b.nomorSoal || 0));
  }, [kisikisi, fase, kelas, semester, mapel, namaAsesmen]);

  const handleAddKisikisiRow = async (customName?: string) => {
    const nameToUse = customName || namaAsesmen;
    if (!nameToUse) { setShowAddAsesmenModal(true); return; }
    try {
      const nextNo = filteredKisikisi.length > 0 ? Math.max(...filteredKisikisi.map(k => k.nomorSoal)) + 1 : 1;
      await addDoc(collection(db, "kisikisi"), {
        userId: user.id, fase, kelas, semester, mataPelajaran: mapel, namaAsesmen: nameToUse,
        elemen: '', cp: '', kompetensi: 'Pengetahuan dan Pemahaman', tpId: '', tujuanPembelajaran: '',
        indikatorSoal: '', jenis: 'Tes', bentukSoal: 'Pilihan Ganda', stimulus: '', soal: '', kunciJawaban: '', nomorSoal: nextNo, school: user.school
      });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 pb-20 font-sans">
      {message && (<div className={`fixed top-24 right-8 z-[100] px-6 py-4 rounded-2xl shadow-xl border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{message.text}</div>)}
      
      <div className="bg-white p-6 rounded-3xl shadow-sm border flex justify-between items-center">
         <div className="flex gap-4 items-center"><div className="p-3 bg-rose-600 text-white rounded-2xl"><BarChart3 size={24}/></div><h2 className="text-xl font-black uppercase">Bank Soal & Kisi-kisi Personal</h2></div>
         <button onClick={() => setShowAddAsesmenModal(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase">ASESMEN BARU</button>
      </div>

      <div className="bg-white rounded-3xl shadow-xl overflow-hidden min-h-[400px]">
        <table className="w-full text-left border-collapse min-w-[1200px]">
           <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest h-12">
              <tr><th className="px-6 py-2 w-16">No</th><th>Elemen & TP</th><th className="w-64">Indikator AI</th><th className="w-96">Konten Soal</th><th className="w-16">Aksi</th></tr>
           </thead>
           <tbody className="divide-y">
              {filteredKisikisi.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50 align-top transition-all">
                   <td className="px-6 py-6 text-center font-black text-slate-300">{item.nomorSoal}</td>
                   <td className="px-6 py-6"><select className="w-full bg-slate-50 border p-2 text-[10px] font-bold" value={item.tpId} onChange={e => updateDoc(doc(db,"kisikisi",item.id),{tpId:e.target.value})}><option value="">Pilih TP</option>{tps.map(t=>(<option key={t.id} value={t.id}>{t.tujuanPembelajaran}</option>))}</select></td>
                   <td className="px-6 py-6 relative"><textarea className="w-full border p-2 text-[10px] h-24" value={item.indikatorSoal} onChange={e => updateDoc(doc(db,"kisikisi",item.id),{indikatorSoal:e.target.value})} /><button onClick={()=>generateIndikatorAI(item)} className="absolute bottom-8 right-8 text-indigo-600">{aiLoadingMap[`ind-${item.id}`]?<Loader2 size={14} className="animate-spin"/>:<Sparkles size={14}/>}</button></td>
                   <td className="px-6 py-6 bg-slate-50/30 relative"><textarea className="w-full border p-2 text-[11px] h-32" value={item.soal} onChange={e => updateDoc(doc(db,"kisikisi",item.id),{soal:e.target.value})} /><button onClick={()=>generateSoalAI(item)} className="absolute bottom-8 right-4 bg-rose-600 text-white p-2.5 rounded-2xl shadow-xl">{aiLoadingMap[`soal-${item.id}`]?<Loader2 size={18} className="animate-spin"/>:<Wand2 size={18}/>}</button></td>
                   <td className="px-6 py-6 text-center"><button onClick={()=>deleteDoc(doc(db,"kisikisi",item.id))} className="text-red-400"><Trash2 size={16}/></button></td>
                </tr>
              ))}
           </tbody>
        </table>
      </div>
    </div>
  );
};

export default AsesmenManager;
