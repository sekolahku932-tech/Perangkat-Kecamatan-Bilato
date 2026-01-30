
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, RPMItem, ATPItem, PromesItem, CapaianPembelajaran, MATA_PELAJARAN, DIMENSI_PROFIL, SchoolSettings, User } from '../types';
import { Plus, Trash2, Rocket, Sparkles, Loader2, CheckCircle2, Printer, Cloud, FileText, Split, AlertTriangle, FileDown, Wand2, PencilLine, Lock, Brain, Zap, RefreshCw, PenTool, Search, AlertCircle, X, CheckSquare, Square, Cpu, ClipboardList, BookOpen, Edit2, Globe, Activity, LayoutList, Target, ArrowLeft } from 'lucide-react';
import { generateRPMContent, generateAssessmentDetails, recommendPedagogy } from '../services/geminiService';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from '../services/firebase';

interface RubricItem {
  aspek: string;
  level4: string;
  level3: string;
  level2: string;
  level1: string;
}

interface AsesmenRow {
  kategori: string;
  teknik: string;
  bentuk: string;
  instruksi?: string;
  soalAtauTugas?: string;
  rubrikDetail?: RubricItem[];
}

interface RPMManagerProps {
  user: User;
  onNavigate: (menu: any) => void;
}

const RPMManager: React.FC<RPMManagerProps> = ({ user, onNavigate }) => {
  const [rpmList, setRpmList] = useState<RPMItem[]>([]);
  const [atpData, setAtpData] = useState<ATPItem[]>([]);
  const [cps, setCps] = useState<CapaianPembelajaran[]>([]);
  const [promesData, setPromesData] = useState<PromesItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterFase, setFilterFase] = useState<Fase>(Fase.A);
  const [filterKelas, setFilterKelas] = useState<Kelas>('1');
  const [filterSemester, setFilterSemester] = useState<'1' | '2'>('1');
  const [filterMapel, setFilterMapel] = useState<string>(MATA_PELAJARAN[0]);
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isLoadingPedagogyAI, setIsLoadingPedagogyAI] = useState(false);
  const [isLoadingAsesmenAI, setIsLoadingAsesmenAI] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school,
    address: '-',
    principalName: '-',
    principalNip: '-'
  });
  
  const [activeYear, setActiveYear] = useState('2024/2025');

  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';
  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || []);

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

    const qRpm = query(collection(db, "rpm"), where("userId", "==", user.id));
    const unsubRpm = onSnapshot(qRpm, (snapshot) => {
      setRpmList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RPMItem[]);
    });

    const qAtp = query(collection(db, "atp"), where("userId", "==", user.id));
    const unsubAtp = onSnapshot(qAtp, (snapshot) => {
      setAtpData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ATPItem[]);
    });

    const qCps = query(collection(db, "cps"), where("school", "==", user.school));
    const unsubCps = onSnapshot(qCps, (snapshot) => {
      setCps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CapaianPembelajaran[]);
    });

    const qPromes = query(collection(db, "promes"), where("userId", "==", user.id));
    const unsubPromes = onSnapshot(qPromes, (snapshot) => {
      setPromesData(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as PromesItem[]);
      setLoading(false);
    });

    return () => { unsubSettings(); unsubYears(); unsubRpm(); unsubAtp(); unsubCps(); unsubPromes(); };
  }, [user.school, user.id]);

  const currentRpm = useMemo(() => {
    if (!isEditing) return null;
    return rpmList.find(r => r.id === isEditing) || null;
  }, [rpmList, isEditing]);

  const sortedAtpOptions = useMemo(() => {
    return atpData
      .filter(a => 
        a.fase === filterFase && 
        a.kelas === filterKelas && 
        (a.mataPelajaran || '').trim().toLowerCase() === filterMapel.trim().toLowerCase()
      )
      .sort((a, b) => (a.indexOrder || 0) - (b.indexOrder || 0));
  }, [atpData, filterFase, filterKelas, filterMapel]);

  const sortedRPM = useMemo(() => {
    return rpmList
      .filter(r => 
        r.fase === filterFase && 
        r.kelas === filterKelas && 
        r.semester === filterSemester && 
        (r.mataPelajaran || '').trim().toLowerCase() === filterMapel.trim().toLowerCase()
      )
      .sort((a, b) => (a.tujuanPembelajaran || '').localeCompare(b.tujuanPembelajaran || ''));
  }, [rpmList, filterFase, filterKelas, filterSemester, filterMapel]);

  const handleGenerateAI = async (id: string) => {
    const rpm = rpmList.find(r => r.id === id);
    if (!rpm || !rpm.tujuanPembelajaran) return;
    if (!user.apiKey) { alert("API Key Personal tidak ditemukan."); return; }

    setIsLoadingAI(true);
    try {
      const result = await generateRPMContent(
        user.apiKey, rpm.tujuanPembelajaran, rpm.materi, rpm.kelas, rpm.praktikPedagogis || "Aktif", rpm.alokasiWaktu, rpm.jumlahPertemuan || 1
      );
      if (result) { 
        await updateDoc(doc(db, "rpm", id), { ...result }); 
        setMessage({ text: 'Narasi RPM disusun menggunakan kuota personal Anda!', type: 'success' }); 
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) { 
      setMessage({ text: 'AI Error: Layanan personal tidak merespon.', type: 'error' }); 
    } finally { setIsLoadingAI(false); }
  };

  const handleGenerateAsesmenAI = async (id: string) => {
    const rpm = rpmList.find(r => r.id === id);
    if (!rpm || !rpm.tujuanPembelajaran) return;
    if (!user.apiKey) { alert("API Key tidak valid."); return; }
    
    const hasActivities = (rpm.kegiatanAwal && rpm.kegiatanAwal.length > 20) || 
                          (rpm.kegiatanInti && rpm.kegiatanInti.length > 50);
    
    if (!hasActivities) {
      setMessage({ text: 'Isi rincian langkah kegiatan terlebih dahulu!', type: 'warning' });
      return;
    }

    const context = `TP: ${rpm.tujuanPembelajaran}. Materi: ${rpm.materi}. Langkah Awal: ${rpm.kegiatanAwal}. Langkah Inti: ${rpm.kegiatanInti}. Langkah Penutup: ${rpm.kegiatanPenutup}`.trim();
    setIsLoadingAsesmenAI(true);
    try {
      const result = await generateAssessmentDetails(user.apiKey, rpm.tujuanPembelajaran, rpm.materi, rpm.kelas, context);
      if (result && Array.isArray(result)) { 
        await updateDoc(doc(db, "rpm", id), { asesmenTeknik: result }); 
        setMessage({ text: 'Asesmen AI personal berhasil disusun!', type: 'success' }); 
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) { 
      setMessage({ text: 'Gagal memproses Asesmen AI.', type: 'error' }); 
    } finally { setIsLoadingAsesmenAI(false); }
  };

  const handleRecommendPedagogy = async (id: string) => {
    const rpm = rpmList.find(r => r.id === id);
    if (!rpm || !rpm.atpId || !user.apiKey) return;
    setIsLoadingPedagogyAI(true);
    try {
      const result = await recommendPedagogy(user.apiKey, rpm.tujuanPembelajaran, "", rpm.materi, rpm.kelas);
      if (result) { 
        await updateDoc(doc(db, "rpm", id), { praktikPedagogis: result.modelName }); 
        setMessage({ text: `Rekomendasi: ${result.modelName}`, type: 'info' }); 
      }
    } catch (err) { console.error(err); } finally { setIsLoadingPedagogyAI(false); }
  };

  const handleAddRPM = async () => {
    try {
      await addDoc(collection(db, "rpm"), {
        userId: user.id,
        atpId: '', fase: filterFase, kelas: filterKelas, semester: filterSemester, mataPelajaran: filterMapel,
        tujuanPembelajaran: '', materi: '', subMateri: '', alokasiWaktu: '', jumlahPertemuan: 1,
        asesmenAwal: '', dimensiProfil: [], praktikPedagogis: '', kemitraan: '',
        lingkunganBelajar: '', pemanfaatanDigital: '', kegiatanAwal: '', kegiatanInti: '', kegiatanPenutup: '', asesmenTeknik: '', materiAjar: '',
        school: user.school
      });
    } catch (e) { setMessage({ text: 'Gagal membuat RPM', type: 'error' }); }
  };

  const updateRPM = async (id: string, field: keyof RPMItem, value: any) => {
    try { await updateDoc(doc(db, "rpm", id), { [field]: value }); } catch (e) { console.error(e); }
  };

  const syncWithATP = async (id: string, atpId: string) => {
    const atp = atpData.find(a => a.id === atpId);
    if (!atp) return;
    const promes = promesData.find(p => p.tujuanPembelajaran === atp.tujuanPembelajaran);
    const selectedDimensi: string[] = [];
    const rawText = ((atp.dimensiProfilLulusan || '') + ' ' + (atp.tujuanPembelajaran || '')).toLowerCase();
    
    // MAPPING UNTUK 8 DIMENSI PROFIL LULUSAN
    const mapping = [
      { key: DIMENSI_PROFIL[0], words: ['keimanan', 'ketakwaan', 'beriman', 'takwa', 'akhlak', 'tuhan', 'esa', 'agama', 'spiritual'] }, 
      { key: DIMENSI_PROFIL[1], words: ['kewargaan', 'kebinekaan', 'global', 'negara', 'warga', 'masyarakat', 'hukum', 'toleransi', 'sosial'] },       
      { key: DIMENSI_PROFIL[2], words: ['penalaran kritis', 'bernalar kritis', 'kritis', 'analisis', 'logis', 'evaluasi', 'argumentasi'] },    
      { key: DIMENSI_PROFIL[3], words: ['kreativitas', 'kreatif', 'karya', 'cipta', 'inovasi', 'ide baru', 'seni'] },                           
      { key: DIMENSI_PROFIL[4], words: ['kolaborasi', 'gotong royong', 'kerjasama', 'tim', 'bersama', 'berbagi', 'kooperatif'] },          
      { key: DIMENSI_PROFIL[5], words: ['kemandirian', 'mandiri', 'sendiri', 'disiplin', 'tanggung jawab', 'swasembada'] },                           
      { key: DIMENSI_PROFIL[6], words: ['kesehatan', 'jasmani', 'sehat', 'olahraga', 'fisik', 'nutrisi', 'higienis', 'mental'] },                    
      { key: DIMENSI_PROFIL[7], words: ['komunikasi', 'bahasa', 'bicara', 'presentasi', 'interaksi', 'dialog', 'diskusi'] }                    
    ];
    
    mapping.forEach(m => { if (m.words.some(word => rawText.includes(word))) selectedDimensi.push(m.key); });

    try {
      await updateDoc(doc(db, "rpm", id), {
        atpId, tujuanPembelajaran: atp.tujuanPembelajaran, materi: atp.materi, subMateri: atp.subMateri,
        alokasiWaktu: promes?.alokasiWaktu || atp.alokasiWaktu, asesmenAwal: atp.asesmenAwal, dimensiProfil: selectedDimensi
      });
      setMessage({ text: 'Data dari ATP personal Anda disinkronkan!', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) { console.error(e); }
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try { await deleteDoc(doc(db, "rpm", deleteConfirmId)); setDeleteConfirmId(null); } catch (e) { console.error(e); }
  };

  const parseAsesmen = (json: any): AsesmenRow[] | null => { 
    if (!json) return null;
    if (Array.isArray(json)) return json.length > 0 ? json : null;
    try { 
      const parsed = JSON.parse(json); 
      return (Array.isArray(parsed) && parsed.length > 0) ? parsed : null; 
    } catch (e) { return null; }
  };

  const splitByMeeting = (text: string, count: number) => {
    if (!text || text === '-') return Array(count).fill('');
    const pattern = /Pertemuan\s*(\d+)\s*:?/gi;
    const parts = text.split(pattern);
    if (parts.length <= 1) {
      const result = Array(count).fill('');
      result[0] = text.trim();
      return result;
    }
    const result = Array(count).fill('');
    for (let i = 1; i < parts.length; i += 2) {
        const mNum = parseInt(parts[i]);
        if (mNum > 0 && mNum <= count) {
            result[mNum - 1] = (parts[i + 1] || '').trim();
        }
    }
    return result;
  };

  const processFilosofiTags = (content: string, isPrint: boolean = false) => {
    if (!content) return content;
    const mapping = [
      { key: 'Berkesadaran', color: 'bg-indigo-50 text-indigo-700 border-indigo-400', regex: /\[Berkesadaran\]|Berkesadaran\.?/gi },
      { key: 'Bermakna', color: 'bg-emerald-50 text-emerald-700 border-emerald-400', regex: /\[Bermakna\]|Bermakna\.?/gi },
      { key: 'Menggembirakan', color: 'bg-rose-50 text-rose-700 border-rose-400', regex: /\[Menggembirakan\]|Menggembirakan\.?/gi }
    ];
    let processedText = content;
    mapping.forEach(m => {
      const badgeHtml = `<span class="inline-flex items-center px-3 py-1 ${m.color} font-black rounded-xl border-[2px] ${isPrint ? 'text-[8px]' : 'text-[10px]'} uppercase align-middle mx-1 whitespace-nowrap shadow-sm font-sans">${m.key}</span>`;
      processedText = processedText.replace(m.regex, badgeHtml);
    });
    return processedText;
  };

  const renderListContent = (text: string | undefined, context: { counter: { current: number } }, isPrint: boolean = false, cleanMeetingTags: boolean = false) => {
    if (!text || text === '-' || text.trim() === '') return '-';
    let processedText = text;
    if (cleanMeetingTags) processedText = text.replace(/Pertemuan\s*\d+\s*:?\s*/gi, '');
    const lines = processedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let items: { type: 'header' | 'step', content: string }[] = [];
    lines.forEach(line => {
      if (line.match(/^[A-C]\.\s+[A-Z\s]{4,}$/i)) items.push({ type: 'header', content: line.toUpperCase() });
      else {
        const cleanLine = line.replace(/^(\d+[\.\)])\s+/, '').trim();
        if (cleanLine) items.push({ type: 'step', content: cleanLine });
      }
    });
    if (items.length === 0) return '-';
    return (
      <div className="flex flex-col space-y-5 w-full">
        {items.map((item, i) => {
          if (item.type === 'header') return (<div key={i} className="mt-6 mb-2 border-l-[8px] border-slate-900 pl-5 bg-slate-100/80 py-2.5 rounded-r-3xl block w-full"><span className="font-black text-slate-900 text-[12px] uppercase tracking-widest">{item.content}</span></div>);
          context.counter.current++;
          return (
            <div key={i} className="flex gap-5 items-start group break-inside-avoid w-full">
              <div className="shrink-0 pt-0.5"><div className={`font-black text-slate-800 ${isPrint ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-[14px]'} bg-white rounded-full flex items-center justify-center border-[2px] border-slate-100`}>{context.counter.current}</div></div>
              <div className="flex-1"><div className={`leading-relaxed text-justify text-slate-800 ${isPrint ? 'text-[10pt]' : 'text-[14px]'} font-semibold`} dangerouslySetInnerHTML={{ __html: processFilosofiTags(item.content, isPrint) }} /></div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderAsesmenTable = (data: AsesmenRow[], isPrint: boolean = false) => {
    const grouped = {
      'ASESMEN AWAL': data.filter(d => (d.kategori || '').toUpperCase().includes('AWAL')),
      'ASESMEN PROSES': data.filter(d => (d.kategori || '').toUpperCase().includes('PROSES')),
      'ASESMEN AKHIR': data.filter(d => (d.kategori || '').toUpperCase().includes('AKHIR')),
    };
    return (
      <div className="space-y-12">
        {Object.entries(grouped).map(([categoryName, rows]) => {
          if (rows.length === 0) return null;
          return (
            <div key={categoryName} className="space-y-6">
              <div className="flex items-center gap-3 border-b-4 border-slate-900 pb-2"><h4 className="font-black text-slate-900 uppercase text-xs tracking-widest font-sans">{categoryName}</h4></div>
              <div className="space-y-8">
                {rows.map((row, idx) => (
                  <div key={idx} className="break-inside-avoid">
                    <div className="flex items-center gap-2 mb-3"><span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[9px] font-black uppercase font-sans">{row.teknik}</span><span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[9px] font-black uppercase font-sans">{row.bentuk}</span></div>
                    <div className="mb-6">{row.instruksi && <p className={`italic text-slate-600 mb-2 ${isPrint ? 'text-[10px]' : 'text-[13px]'}`}><b>Instruksi:</b> {row.instruksi}</p>}{row.soalAtauTugas && (<div className="p-4 border-[1.5px] border-slate-300 rounded-2xl bg-slate-50/50 mb-4 font-sans text-[11px] whitespace-pre-wrap">{row.soalAtauTugas}</div>)}</div>
                    <table className={`w-full border-collapse border-2 border-black ${isPrint ? 'text-[9px]' : 'text-[11px]'}`}>
                      <thead><tr className="bg-slate-100 uppercase font-black text-center"><th className="border-2 border-black p-2 w-1/4">ASPEK</th><th className="border-2 border-black p-2">SB (4)</th><th className="border-2 border-black p-2">B (3)</th><th className="border-2 border-black p-2">C (2)</th><th className="border-2 border-black p-2">PB (1)</th></tr></thead>
                      <tbody>{row.rubrikDetail?.map((detail, dIdx) => (<tr key={dIdx}><td className="border-2 border-black p-2 font-bold uppercase font-sans">{detail.aspek}</td><td className="border-2 border-black p-2">{detail.level4}</td><td className="border-2 border-black p-2">{detail.level3}</td><td className="border-2 border-black p-2">{detail.level2}</td><td className="border-2 border-black p-2">{detail.level1}</td></tr>))}</tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getRPMDate = (rpm: RPMItem) => {
    const matchingPromes = promesData.find(p => p.tujuanPembelajaran === rpm.tujuanPembelajaran);
    if (!matchingPromes || !matchingPromes.bulanPelaksanaan) return new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'});
    const parts = matchingPromes.bulanPelaksanaan.split(',')[0].split('|');
    return `${parts[2] || '..'} ${parts[0] || '..'} ${activeYear.split('/')[matchingPromes.semester === '1' ? 0 : 1]}`;
  };

  if (isPrintMode && isEditing && currentRpm) {
    const rpm = currentRpm;
    const count = rpm.jumlahPertemuan || 1;
    const asesmenData = parseAsesmen(rpm.asesmenTeknik);
    const datumDate = getRPMDate(rpm);
    const awalParts = splitByMeeting(rpm.kegiatanAwal, count);
    const intiParts = splitByMeeting(rpm.kegiatanInti, count);
    const penutupParts = splitByMeeting(rpm.kegiatanPenutup, count);
    return (
      <div className="bg-white min-h-screen text-slate-900 p-8 font-sans print:p-0">
        <div className="no-print mb-8 flex justify-between bg-slate-100 p-4 rounded-2xl border border-slate-200 shadow-xl sticky top-4 z-[100]"><button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-8 py-2 rounded-xl text-xs font-black"><ArrowLeft size={16}/> KEMBALI</button><div className="flex gap-2"><button onClick={() => window.print()} className="bg-rose-600 text-white px-8 py-2 rounded-xl text-xs font-black shadow-lg"><Printer size={16}/> CETAK</button></div></div>
        <div ref={printRef} className="max-w-[21cm] mx-auto bg-white p-4">
          <div className="text-center mb-2 pb-2 border-b-2 border-black"><h1 className="text-xl font-black uppercase tracking-[0.2em]">RENCANA PEMBELAJARAN MENDALAM</h1><h2 className="text-sm font-bold uppercase">{settings.schoolName}</h2></div>
          <div className="mb-6 border-2 border-black"><table className="w-full text-[10.5px] border-collapse"><tbody><tr><td className="p-1.5 w-48 font-bold bg-slate-50 border-r-2 border-black uppercase text-[9px]">Penyusun / Satuan</td><td className="p-1.5 font-bold uppercase">{user.name} / {settings.schoolName}</td></tr><tr><td className="p-1.5 w-48 font-bold bg-slate-50 border-r-2 border-black uppercase text-[9px]">Bab / Topik</td><td className="p-1.5 font-bold uppercase">{rpm.materi}</td></tr></tbody></table></div>
          <div className="flex border-2 border-black mb-6"><div className="flex-1 p-4"><div><p className="font-black text-[9px] uppercase text-slate-500 mb-1">Tujuan Pembelajaran (TP):</p><div className="p-4 border-2 border-blue-600 bg-blue-50/20 rounded-3xl text-blue-900 font-black text-[12px] text-center">{rpm.tujuanPembelajaran}</div></div></div></div>
          <div className="flex border-2 border-black break-inside-avoid"><div className="flex-1">
               {Array.from({ length: count }).map((_, mIdx) => {
                 const counter = { current: 0 };
                 return (
                  <div key={mIdx} className="p-5 space-y-6 border-b-2 last:border-b-0 border-black break-inside-avoid">
                    <div className="bg-slate-900 text-white px-6 py-1 inline-block text-[10px] font-black uppercase tracking-widest rounded-full">PERTEMUAN {mIdx + 1}</div>
                    <div className="space-y-8">
                       <section><p className="font-black text-blue-900 text-[12px] mb-3 uppercase tracking-widest border-b-2 border-blue-100 inline-block">I. AWAL</p><div>{renderListContent(awalParts[mIdx], { counter }, true, true)}</div></section>
                       <section><p className="font-black text-emerald-900 text-[12px] mb-3 uppercase tracking-widest border-b-2 border-emerald-100 inline-block">II. INTI</p><div>{renderListContent(intiParts[mIdx], { counter }, true, true)}</div></section>
                       <section><p className="font-black text-rose-900 text-[12px] mb-3 uppercase tracking-widest border-b-2 border-rose-100 inline-block">III. PENUTUP</p><div>{renderListContent(penutupParts[mIdx], { counter }, true, true)}</div></section>
                    </div>
                  </div>
                 );
               })}
          </div></div>
          {asesmenData && <div className="mt-6 border-2 border-black break-inside-avoid"><div className="bg-slate-900 text-white p-3 text-center font-black uppercase text-xs tracking-widest">STRATEGI ASESMEN</div><div className="p-8 space-y-12">{renderAsesmenTable(asesmenData, true)}</div></div>}
          <div className="mt-12 grid grid-cols-2 text-center text-[10.5px] font-black uppercase break-inside-avoid px-8"><div><p>KEPALA SEKOLAH</p><div className="h-20"></div><p className="border-b border-black inline-block min-w-[180px]">{settings.principalName}</p></div><div><p>BILATO, {datumDate}</p><p>GURU KELAS/MAPEL</p><div className="h-20"></div><p className="border-b border-black inline-block min-w-[180px]">{user.name}</p></div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative theme-dpl font-sans">
      {message && (<div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all animate-in slide-in-from-right ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}><CheckCircle2 size={20}/><span className="text-sm font-black uppercase tracking-tight">{message.text}</span></div>)}
      
      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl max-h-[95vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-white/20">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-3"><div className="p-2 bg-cyan-500 rounded-xl shadow-lg"><Rocket size={20}/></div><h3 className="font-black uppercase text-sm tracking-widest">Editor RPM Mendalam</h3></div>
               <div className="flex gap-2">
                 <button onClick={() => setIsPrintMode(true)} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-black flex items-center gap-2 transition-all"><Printer size={14}/> PRATINJAU</button>
                 <button onClick={() => setIsEditing(null)} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-2xl text-[10px] font-black transition-all">TUTUP</button>
               </div>
            </div>
            <div className="p-8 overflow-y-auto space-y-10 no-scrollbar bg-slate-50/50">
              {isLoadingAI && (<div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center gap-6 animate-in fade-in"><Loader2 size={48} className="animate-spin text-cyan-600"/><p className="text-sm font-black text-slate-900 uppercase">Mengolah Narasi Personal Anda...</p></div>)}
              {currentRpm ? (
                <>
                  <div className="space-y-6 bg-white p-8 rounded-[3rem] border border-slate-200">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Tujuan Pembelajaran dari ATP Personal</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-800 outline-none" value={currentRpm?.atpId} onChange={e => syncWithATP(isEditing!, e.target.value)}>
                      <option value="">-- PILIH TP PERSONAL --</option>
                      {sortedAtpOptions.map(a => (<option key={a.id} value={a.id}>[{a.kodeCP || '-'}] {a.tujuanPembelajaran}</option>))}
                    </select>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 flex justify-between items-center">Sintaks Model<button onClick={() => handleRecommendPedagogy(isEditing!)} className="text-indigo-600"><Wand2 size={12}/></button></label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black text-slate-700 outline-none" value={currentRpm?.praktikPedagogis || ''} onChange={e => updateRPM(isEditing!, 'praktikPedagogis', e.target.value)} /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Pertemuan</label><input type="number" min="1" className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs font-black text-indigo-700 outline-none" value={currentRpm?.jumlahPertemuan || 1} onChange={e => updateRPM(isEditing!, 'jumlahPertemuan', parseInt(e.target.value) || 1)} /></div>
                    </div>
                  </div>
                  <div className="space-y-8 bg-white p-10 rounded-[4rem] border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4"><h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Rincian Naratif Deep Learning</h4><button onClick={() => handleGenerateAI(isEditing!)} disabled={isLoadingAI} className="bg-cyan-600 text-white px-10 py-4 rounded-[2rem] text-xs font-black shadow-xl">{isLoadingAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16}/>} SUSUN NARASI (KUOTA PERSONAL)</button></div>
                    <textarea className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 text-[13px] min-h-[400px] focus:ring-4 focus:ring-emerald-500/10 outline-none font-medium leading-relaxed" value={currentRpm?.kegiatanInti || ''} onChange={e => updateRPM(isEditing!, 'kegiatanInti', e.target.value)} />
                    <button onClick={() => handleGenerateAsesmenAI(isEditing!)} disabled={isLoadingAsesmenAI} className="w-full flex items-center justify-center gap-3 bg-indigo-600 text-white py-4 rounded-[2rem] text-xs font-black shadow-xl">{isLoadingAsesmenAI ? <Loader2 size={16} className="animate-spin" /> : <LayoutList size={16}/>} SUSUN ASESMEN SINKRON (PERSONAL AI)</button>
                  </div>
                </>
              ) : (<div className="p-20 text-center"><Loader2 className="animate-spin inline-block" /></div>)}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-4 items-end">
         <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full text-xs font-black uppercase">
           <div><label className="text-slate-400 mb-2 block">Mapel</label><select className="w-full bg-slate-50 border rounded-2xl p-4" value={filterMapel} onChange={e => setFilterMapel(e.target.value)}>{availableMapel.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
           <div><label className="text-slate-400 mb-2 block">Semester</label><select className="w-full bg-slate-50 border rounded-2xl p-4" value={filterSemester} onChange={e => setFilterSemester(e.target.value as any)}><option value="1">1 (Ganjil)</option><option value="2">2 (Genap)</option></select></div>
           <div><label className="text-slate-400 mb-2 block">Kelas</label><select disabled={isClassLocked} className="w-full bg-slate-50 border rounded-2xl p-4" value={filterKelas} onChange={e => handleKelasChange(e.target.value as Kelas)}>{['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}</select></div>
         </div>
         <button onClick={handleAddRPM} className="bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-xs shadow-xl"><Plus size={18} className="inline mr-2"/> BUAT RPM BARU</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (<div className="col-span-full py-40 text-center"><Loader2 size={48} className="animate-spin text-blue-600 inline-block"/><p className="text-xs font-black uppercase mt-4">Memuat Basis Cloud Personal...</p></div>) : sortedRPM.length === 0 ? (<div className="col-span-full py-40 text-center text-slate-400 font-black uppercase text-sm bg-white border-2 border-dashed rounded-[48px]">Belum Ada RPM</div>) : sortedRPM.map(rpm => (
          <div key={rpm.id} className="bg-white p-10 rounded-[3rem] border border-slate-200 hover:shadow-2xl transition-all group overflow-hidden">
            <div className="flex gap-6 items-start mb-8"><div className="p-5 bg-cyan-100 text-cyan-700 rounded-[2rem] group-hover:bg-cyan-600 group-hover:text-white transition-all"><Rocket size={32}/></div><div className="flex-1"><h4 className="text-base font-black text-slate-900 leading-tight uppercase line-clamp-2 mb-3">{rpm.tujuanPembelajaran || 'TANPA JUDUL'}</h4><div className="flex flex-wrap gap-2 text-[10px] font-black uppercase"><span className="text-indigo-600 px-3 py-1 bg-indigo-50 rounded-full">SEM {rpm.semester}</span><span className="text-blue-600 px-3 py-1 bg-blue-50 rounded-full">{rpm.praktikPedagogis}</span></div></div></div>
            <div className="flex gap-3 pt-6 border-t border-slate-50"><button onClick={() => setIsEditing(rpm.id)} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl text-[11px] font-black hover:bg-black shadow-lg">EDIT & GENERATE AI</button><button onClick={() => setDeleteConfirmId(rpm.id)} className="p-4 text-slate-300 hover:text-red-600 rounded-2xl"><Trash2 size={20}/></button></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RPMManager;
