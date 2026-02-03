
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, RPMItem, ATPItem, PromesItem, CapaianPembelajaran, MATA_PELAJARAN, DIMENSI_PROFIL, SchoolSettings, User } from '../types';
import { Plus, Trash2, Rocket, Sparkles, Loader2, CheckCircle2, Printer, Cloud, FileText, Split, AlertTriangle, FileDown, Wand2, PencilLine, Lock, Brain, Zap, RefreshCw, PenTool, Search, AlertCircle, X, CheckSquare, Square, Cpu, ClipboardList, BookOpen, Edit2, Globe, Activity, LayoutList, Target, ArrowLeft, CalendarDays, AlignLeft, LogIn, LogOut } from 'lucide-react';
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

  const sortedPromesOptions = useMemo(() => {
    if (!currentRpm) return [];
    return promesData
      .filter(p => 
        p.kelas === currentRpm.kelas && 
        p.semester === currentRpm.semester && 
        (p.mataPelajaran || '').trim().toLowerCase() === (currentRpm.mataPelajaran || '').trim().toLowerCase()
      )
      .sort((a, b) => (a.indexOrder || 0) - (b.indexOrder || 0));
  }, [promesData, currentRpm]);

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
    if (!user.apiKey) {
      setMessage({ text: 'API Key Personal Belum Diatur!', type: 'error' });
      return;
    }

    setIsLoadingAI(true);
    try {
      const result = await generateRPMContent(
        rpm.tujuanPembelajaran, rpm.materi, rpm.kelas, rpm.praktikPedagogis || "Aktif", rpm.alokasiWaktu, rpm.jumlahPertemuan || 1, user.apiKey
      );
      if (result) { 
        await updateDoc(doc(db, "rpm", id), { ...result }); 
        setMessage({ text: 'Narasi Deep Learning berhasil disusun!', type: 'success' }); 
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) { 
      setMessage({ text: 'AI Error: Gagal menyusun narasi.', type: 'error' }); 
    } finally { setIsLoadingAI(false); }
  };

  const handleGenerateAsesmenAI = async (id: string) => {
    const rpm = rpmList.find(r => r.id === id);
    if (!rpm || !rpm.tujuanPembelajaran) return;
    if (!user.apiKey) {
      setMessage({ text: 'API Key Personal Belum Diatur!', type: 'error' });
      return;
    }
    
    const hasActivities = (rpm.kegiatanAwal && rpm.kegiatanAwal.length > 20) || 
                          (rpm.kegiatanInti && rpm.kegiatanInti.length > 50);
    
    if (!hasActivities) {
      setMessage({ text: 'Isi rincian langkah kegiatan terlebih dahulu agar asesmen akurat!', type: 'warning' });
      return;
    }

    const context = `TP: ${rpm.tujuanPembelajaran}. Materi: ${rpm.materi}. Langkah Awal: ${rpm.kegiatanAwal}. Langkah Inti: ${rpm.kegiatanInti}. Langkah Penutup: ${rpm.kegiatanPenutup}`.trim();
    setIsLoadingAsesmenAI(true);
    try {
      const result = await generateAssessmentDetails(rpm.tujuanPembelajaran, rpm.materi, rpm.kelas, context, rpm.jumlahPertemuan || 1, user.apiKey);
      if (result && Array.isArray(result)) { 
        await updateDoc(doc(db, "rpm", id), { asesmenTeknik: result }); 
        setMessage({ text: 'Asesmen (Awal, Proses, Akhir) berhasil disusun!', type: 'success' }); 
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) { 
      setMessage({ text: 'Gagal memproses Asesmen AI.', type: 'error' }); 
    } finally { setIsLoadingAsesmenAI(false); }
  };

  const handleRecommendPedagogy = async (id: string) => {
    const rpm = rpmList.find(r => r.id === id);
    if (!rpm || !rpm.tujuanPembelajaran) return;
    if (!user.apiKey) {
      setMessage({ text: 'API Key Personal Belum Diatur!', type: 'error' });
      return;
    }

    setIsLoadingPedagogyAI(true);
    try {
      const result = await recommendPedagogy(rpm.tujuanPembelajaran, "", rpm.materi, rpm.kelas, user.apiKey);
      if (result) { 
        await updateDoc(doc(db, "rpm", id), { praktikPedagogis: result.modelName }); 
        setMessage({ text: `Rekomendasi: ${result.modelName}`, type: 'info' }); 
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) { console.error(err); } finally { setIsLoadingPedagogyAI(false); }
  };

  const handleAddRPM = async () => {
    try {
      await addDoc(collection(db, "rpm"), {
        userId: user.id,
        atpId: '', fase: filterFase, kelas: filterKelas, semester: filterSemester, mataPelajaran: filterMapel,
        tujuanPembelajaran: '', materi: '', subMateri: '', alokasiWaktu: '4 JP', jumlahPertemuan: 1,
        asesmenAwal: '', dimensiProfil: [], praktikPedagogis: '', kemitraan: '',
        lingkunganBelajar: '', pemanfaatanDigital: '', kegiatanAwal: '', kegiatanInti: '', kegiatanPenutup: '', asesmenTeknik: '', materiAjar: '',
        school: user.school
      });
    } catch (e) { setMessage({ text: 'Gagal membuat RPM', type: 'error' }); }
  };

  const updateRPM = async (id: string, field: keyof RPMItem, value: any) => {
    try { await updateDoc(doc(db, "rpm", id), { [field]: value }); } catch (e) { console.error(e); }
  };

  const syncWithPromes = async (id: string, promesId: string) => {
    const promes = promesData.find(p => p.id === promesId);
    if (!promes) return;

    // Ambil Data ATP yang tertaut ke Promes
    const atp = atpData.find(a => a.id === promes.atpId);
    
    let selectedDimensi: string[] = [];
    
    if (atp && atp.dimensiProfilLulusan) {
      const atpDplText = atp.dimensiProfilLulusan.toLowerCase();
      DIMENSI_PROFIL.forEach(dim => {
        const baseName = dim.split(' terhadap')[0].toLowerCase();
        if (atpDplText.includes(baseName)) {
          selectedDimensi.push(dim);
        }
      });
    } else {
      const rawText = (
        (promes.tujuanPembelajaran || '') + ' ' + 
        (promes.materiPokok || '')
      ).toLowerCase();
      
      const mapping = [
        { key: DIMENSI_PROFIL[0], words: ['iman', 'takwa', 'akhlak', 'tuhan', 'agama', 'esa', 'spiritual', 'beriman'] }, 
        { key: DIMENSI_PROFIL[1], words: ['warga', 'negara', 'global', 'bineka', 'sosial', 'toleransi', 'kebinekaan', 'kewargaan'] },       
        { key: DIMENSI_PROFIL[2], words: ['kritis', 'nalar', 'analisis', 'logis', 'evaluasi', 'penalaran', 'bernalar'] },    
        { key: DIMENSI_PROFIL[3], words: ['kreatif', 'karya', 'cipta', 'inovasi', 'ide', 'seni', 'kreativitas'] },                           
        { key: DIMENSI_PROFIL[4], words: ['gotong', 'tim', 'kerjasama', 'bersama', 'berbagi', 'kooperatif', 'kolaborasi'] },          
        { key: DIMENSI_PROFIL[5], words: ['mandiri', 'disiplin', 'tanggung', 'swasembada', 'sendiri', 'kemandirian'] },                           
        { key: DIMENSI_PROFIL[6], words: ['sehat', 'jasmani', 'olahraga', 'mental', 'fisik', 'nutrisi', 'kesehatan'] },                    
        { key: DIMENSI_PROFIL[7], words: ['komunikasi', 'bahasa', 'bicara', 'dialog', 'interaksi', 'presentasi', 'pendengar'] }                    
      ];
      
      mapping.forEach(m => { 
        if (m.words.some(word => rawText.includes(word))) {
          selectedDimensi.push(m.key);
        }
      });
    }

    try {
      await updateDoc(doc(db, "rpm", id), {
        atpId: promes.atpId || '', 
        tujuanPembelajaran: promes.tujuanPembelajaran, 
        materi: promes.materiPokok, 
        subMateri: promes.subMateri || '',
        alokasiWaktu: promes.alokasiWaktu || '4 JP', 
        asesmenAwal: atp?.asesmenAwal || '', 
        dimensiProfil: selectedDimensi
      });
      setMessage({ text: 'Data ATP (DPL) & Program Semester (JP) disinkronkan!', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) { console.error(e); }
  };

  const toggleDimensi = (id: string, dim: string) => {
    if (!currentRpm) return;
    const current = currentRpm.dimensiProfil || [];
    const updated = current.includes(dim) ? current.filter(d => d !== dim) : [...current, dim];
    updateRPM(id, 'dimensiProfil', updated);
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try { 
      await deleteDoc(doc(db, "rpm", deleteConfirmId)); 
      setDeleteConfirmId(null); 
      setMessage({ text: 'Rencana Pembelajaran berhasil dihapus.', type: 'info' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) { console.error(e); }
  };

  const parseAsesmen = (json: any): AsesmenRow[] | null => { 
    if (!json) return null;
    if (Array.isArray(json)) return json.length > 0 ? json : null;
    try { 
      const parsed = JSON.parse(json); 
      return (Array.isArray(parsed) && parsed.length > 0) ? parsed : null; 
    } catch (e) { return null; }
  };

  const updateAsesmenRow = async (id: string, rowIndex: number, field: keyof AsesmenRow, value: any) => {
    if (!currentRpm) return;
    const current = parseAsesmen(currentRpm.asesmenTeknik) || [];
    const updated = [...current];
    updated[rowIndex] = { ...updated[rowIndex], [field]: value };
    await updateRPM(id, 'asesmenTeknik', updated);
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

  const stripFilosofiTags = (text: string) => {
    if (!text) return '';
    return text.replace(/\[Berkesadaran\]|\[Bermakna\]|\[Menggembirakan\]|Berkesadaran\.?|Bermakna\.?|Menggembirakan\.?/gi, '').trim();
  };

  const processFilosofiTags = (content: string, isPrint: boolean = false): { text: string; tags: string[] } => {
    if (!content) return { text: '', tags: [] };
    const mapping = [
      { key: 'Berkesadaran', color: 'bg-blue-50 text-blue-600 border-blue-200', regex: /\[Berkesadaran\]|Berkesadaran\.?/gi },
      { key: 'Bermakna', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', regex: /\[Bermakna\]|Bermakna\.?/gi },
      { key: 'Menggembirakan', color: 'bg-rose-50 text-rose-600 border-rose-200', regex: /\[Menggembirakan\]|Menggembirakan\.?/gi }
    ];
    let processedText = content;
    let foundTags: string[] = [];
    mapping.forEach(m => {
      if (processedText.match(m.regex)) {
        foundTags.push(`<span class="inline-flex items-center px-2 py-0.5 ${m.color} font-black rounded-lg border ${isPrint ? 'text-[7px]' : 'text-[9px]'} uppercase align-middle whitespace-nowrap shadow-sm font-sans">${m.key}</span>`);
        processedText = processedText.replace(m.regex, '').trim();
      }
    });
    return { text: processedText, tags: foundTags };
  };

  const renderListContent = (text: string | undefined, context: { counter: { current: number } }, isPrint: boolean = false, cleanMeetingTags: boolean = false) => {
    if (!text || text === '-' || text.trim() === '') return <div className="text-slate-300 italic">- Belum ada rincian -</div>;
    
    let processedText = text;
    if (cleanMeetingTags) processedText = text.replace(/Pertemuan\s*\d+\s*:?\s*/gi, '');

    processedText = processedText
      .replace(/([^\n])([A-C]\.\s+[A-Za-z\s]{3,})/g, '$1\n$2') 
      .replace(/([^\n])(\d+[\.\)])\s+/g, '$1\n$2 '); 

    const lines = processedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let items: { type: 'header' | 'step', content: string }[] = [];
    lines.forEach(line => {
      const headerMatch = line.match(/^[A-C]\.\s+([A-Za-z\s]{3,})/);
      if (headerMatch) {
        items.push({ type: 'header', content: line.toUpperCase() });
      } else {
        const cleanLine = line.replace(/^(\d+[\.\)])\s+/, '').trim();
        if (cleanLine) items.push({ type: 'step', content: cleanLine });
      }
    });

    if (items.length === 0) return <div className="text-slate-400 italic">Format data tidak dikenali. Harap tekan 'RE-GENERATE'.</div>;

    return (
      <div className="flex flex-col space-y-4 w-full">
        {items.map((item, i) => {
          if (item.type === 'header') return (
            <div key={i} className="mt-8 mb-4 border-l-[8px] border-slate-900 pl-4 py-2 block w-full bg-slate-50/50 rounded-r-xl">
              <span className="font-black text-slate-900 text-[13pt] uppercase tracking-[0.1em]">{item.content}</span>
            </div>
          );
          
          context.counter.current++;
          const processed = processFilosofiTags(item.content, isPrint);
          return (
            <div key={i} className="flex gap-4 items-start break-inside-avoid w-full">
              <div className="shrink-0 pt-0.5">
                <div className={`font-black text-slate-900 ${isPrint ? 'h-7 w-7 text-[10pt]' : 'h-8 w-8 text-[12px]'} bg-slate-100/50 rounded-full flex items-center justify-center border-2 border-slate-200 shadow-sm`}>
                  {context.counter.current}
                </div>
              </div>
              <div className="flex-1 flex flex-col sm:flex-row justify-between items-start gap-3 pr-2">
                <div className={`leading-relaxed text-justify text-slate-900 ${isPrint ? 'text-[11pt]' : 'text-[14px]'} font-medium flex-1`}>
                  {processed.text}
                </div>
                {processed.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 shrink-0 pt-1 justify-end max-w-[150px]" dangerouslySetInnerHTML={{ __html: processed.tags.join('') }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderAsesmenTable = (data: AsesmenRow[], isPrint: boolean = false) => {
    const categories = ['ASESMEN AWAL', 'ASESMEN PROSES', 'ASESMEN AKHIR'];
    
    return (
      <div className="space-y-12">
        {categories.map((catName) => {
          const rows = data.filter(d => (d.kategori || '').toUpperCase().includes(catName.split(' ')[1]));
          if (rows.length === 0) return null;
          
          return (
            <div key={catName} className="space-y-6">
              <div className="flex items-center gap-3 border-b-2 border-black pb-2">
                <h4 className="font-black text-black uppercase text-sm tracking-widest font-sans">{catName}</h4>
              </div>
              <div className="space-y-8">
                {rows.map((row, idx) => (
                  <div key={idx} className="break-inside-avoid">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="bg-slate-100 text-slate-900 px-3 py-1 rounded text-[9px] font-black uppercase border border-slate-300 shadow-sm">{row.teknik}</span>
                      <span className="bg-slate-100 text-slate-900 px-3 py-1 rounded text-[9px] font-black uppercase border border-slate-300 shadow-sm">{row.bentuk}</span>
                    </div>
                    <div className="mb-4">
                      {row.instruksi && <p className={`italic text-slate-600 mb-3 ${isPrint ? 'text-[10pt]' : 'text-[12px]'}`}><b>Instruksi:</b> {row.instruksi}</p>}
                      {row.soalAtauTugas && (
                        <div className="p-4 border-[1.5px] border-slate-400 rounded-2xl bg-slate-50/40 mb-4 font-sans text-[10pt] whitespace-pre-wrap leading-relaxed">
                          <p className="font-black uppercase text-[9px] text-indigo-600 mb-1 tracking-widest">BUTIR INSTRUMEN:</p>
                          {row.soalAtauTugas}
                        </div>
                      )}
                    </div>
                    <table className={`w-full border-collapse border-2 border-black ${isPrint ? 'text-[9.5pt]' : 'text-[11px]'}`}>
                      <thead>
                        <tr className="bg-slate-50 uppercase font-black text-center text-[9px]">
                          <th className="border-2 border-black p-3 w-1/4">ASPEK</th>
                          <th className="border-2 border-black p-3">SB (4)</th>
                          <th className="border-2 border-black p-3">B (3)</th>
                          <th className="border-2 border-black p-3">C (2)</th>
                          <th className="border-2 border-black p-3">PB (1)</th>
                        </tr>
                      </thead>
                      <tbody className="font-medium">
                        {row.rubrikDetail?.map((detail, dIdx) => (
                          <tr key={dIdx}>
                            <td className="border-2 border-black p-3 font-black uppercase bg-slate-50/30">{detail.aspek}</td>
                            <td className="border-2 border-black p-3 text-justify">{detail.level4}</td>
                            <td className="border-2 border-black p-3 text-justify">{detail.level3}</td>
                            <td className="border-2 border-black p-3 text-justify">{detail.level2}</td>
                            <td className="border-2 border-black p-3 text-justify">{detail.level1}</td>
                          </tr>
                        ))}
                      </tbody>
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
      <div className="bg-white min-h-screen text-slate-900 font-sans print:p-0">
        <div className="no-print p-4 flex justify-between bg-slate-900 sticky top-0 z-[100]"><button onClick={() => setIsPrintMode(false)} className="text-white px-6 py-2 rounded-xl text-xs font-black bg-white/10 hover:bg-white/20 transition-all"><ArrowLeft size={16} className="inline mr-2"/> KEMBALI</button><button onClick={() => window.print()} className="bg-rose-600 text-white px-8 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2"><Printer size={16}/> CETAK SEKARANG</button></div>
        
        <div ref={printRef} className="max-w-[21cm] mx-auto p-4 md:p-8 bg-white space-y-6">
          <div className="text-center border-b-[3px] border-black pb-4">
             <h1 className="text-[24pt] font-black uppercase tracking-[0.1em] leading-none mb-2">RENCANA PEMBELAJARAN MENDALAM</h1>
             <h2 className="text-[14pt] font-bold uppercase">{settings.schoolName}</h2>
          </div>

          <div className="flex border-2 border-black overflow-hidden break-inside-avoid">
             <div className="w-12 bg-slate-100 flex items-center justify-center border-r-2 border-black shrink-0">
                <span className="font-black uppercase text-[10px] tracking-[0.3em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>IDENTITAS</span>
             </div>
             <div className="flex-1">
                <table className="w-full text-[11pt] border-collapse uppercase font-bold">
                   <tbody>
                      <tr className="border-b-2 border-black"><td className="p-3 w-48 bg-slate-50 border-r-2 border-black text-[10px] font-black">PENYUSUN / SATUAN</td><td className="p-3">{user.name} / {settings.schoolName}</td></tr>
                      <tr className="border-b-2 border-black"><td className="p-3 w-48 bg-slate-50 border-r-2 border-black text-[10px] font-black">TAHUN / SEMESTER</td><td className="p-3">{activeYear} / {rpm.semester}</td></tr>
                      <tr className="border-b-2 border-black"><td className="p-3 w-48 bg-slate-50 border-r-2 border-black text-[10px] font-black">MATA PELAJARAN</td><td className="p-3">{rpm.mataPelajaran}</td></tr>
                      <tr className="border-b-2 border-black"><td className="p-3 w-48 bg-slate-50 border-r-2 border-black text-[10px] font-black">KELAS / FASE</td><td className="p-3">{rpm.kelas} / {rpm.fase}</td></tr>
                      <tr className="border-b-2 border-black"><td className="p-3 w-48 bg-slate-50 border-r-2 border-black text-[10px] font-black">BAB / TOPIK</td><td className="p-3">{rpm.materi}</td></tr>
                      <tr><td className="p-3 w-48 bg-slate-50 border-r-2 border-black text-[10px] font-black">ALOKASI WAKTU</td><td className="p-3">{rpm.alokasiWaktu} ({rpm.jumlahPertemuan} Pertemuan)</td></tr>
                   </tbody>
                </table>
             </div>
          </div>

          <div className="flex border-2 border-black overflow-hidden break-inside-avoid">
             <div className="w-12 bg-slate-100 flex items-center justify-center border-r-2 border-black shrink-0">
                <span className="font-black uppercase text-[10px] tracking-[0.3em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>IDENTIFIKASI</span>
             </div>
             <div className="flex-1 p-6 space-y-6">
                <div>
                   <p className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">ASESMEN AWAL:</p>
                   <div className="p-5 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/50 font-medium italic text-[11pt] leading-relaxed">
                      {rpm.asesmenAwal || "Melakukan pemetaan awal melalui observasi dan tanya jawab mendalam."}
                   </div>
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-widest">DIMENSI PROFIL LULUSAN (DPL):</p>
                   <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                      {DIMENSI_PROFIL.map((dim) => {
                        const isChecked = rpm.dimensiProfil?.includes(dim);
                        return (
                          <div key={dim} className="flex items-center gap-3">
                             <div className={`w-5 h-5 rounded border-2 border-black flex items-center justify-center ${isChecked ? 'bg-black' : 'bg-white'}`}>
                                {isChecked && <CheckCircle2 size={12} className="text-white" />}
                             </div>
                             <span className={`text-[10pt] font-black uppercase ${isChecked ? 'text-black' : 'text-slate-400'}`}>{dim.split(' terhadap')[0]}</span>
                          </div>
                        );
                      })}
                   </div>
                </div>
             </div>
          </div>

          <div className="flex border-2 border-black overflow-hidden break-inside-avoid">
             <div className="w-12 bg-slate-100 flex items-center justify-center border-r-2 border-black shrink-0">
                <span className="font-black uppercase text-[10px] tracking-[0.3em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>DESAIN</span>
             </div>
             <div className="flex-1 p-6 space-y-6">
                <div>
                   <p className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">TUJUAN PEMBELAJARAN (TP):</p>
                   <div className="p-6 border-[3px] border-blue-600 bg-blue-50/20 rounded-[2.5rem] text-blue-900 font-black text-[13pt] text-center leading-relaxed shadow-sm">
                      {rpm.tujuanPembelajaran}
                   </div>
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">STRATEGI PEDAGOGIS:</p>
                   <div className="p-5 border-2 border-slate-200 rounded-2xl bg-white font-black italic text-[12pt] shadow-sm">
                      {rpm.praktikPedagogis || "Aktif"}
                   </div>
                </div>
                <div className="grid grid-cols-3 gap-8 pt-6 border-t border-slate-100">
                   <div><p className="text-[9px] font-black uppercase text-slate-500 mb-2">KEMITRAAN:</p><p className="text-[10pt] font-bold leading-snug">{stripFilosofiTags(rpm.kemitraan) || '-'}</p></div>
                   <div><p className="text-[9px] font-black uppercase text-slate-500 mb-2">LINGKUNGAN:</p><p className="text-[10pt] font-bold leading-snug">{stripFilosofiTags(rpm.lingkunganBelajar) || '-'}</p></div>
                   <div><p className="text-[9px] font-black uppercase text-slate-500 mb-2">DIGITAL:</p><p className="text-[10pt] font-bold leading-snug">{stripFilosofiTags(rpm.pemanfaatanDigital) || '-'}</p></div>
                </div>
             </div>
          </div>

          {Array.from({ length: count }).map((_, mIdx) => {
            const counter = { current: 0 };
            return (
              <div key={mIdx} className="space-y-10 pt-10">
                <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl w-fit font-black uppercase text-sm tracking-widest shadow-xl">PERTEMUAN {mIdx + 1}</div>
                
                <section>
                   <h3 className="font-black text-blue-900 text-[14pt] mb-6 uppercase tracking-widest border-b-[4px] border-blue-600 inline-block pb-1">I. AWAL</h3>
                   <div className="pl-2">{renderListContent(awalParts[mIdx], { counter }, true, true)}</div>
                </section>

                <section className="relative">
                   <h3 className="font-black text-emerald-900 text-[14pt] mb-6 uppercase tracking-widest border-b-[4px] border-emerald-600 inline-block pb-1">II. INTI</h3>
                   <div className="border-l-[3px] border-dashed border-emerald-200 ml-[13px] pl-7 min-h-[50px]">
                      {renderListContent(intiParts[mIdx], { counter }, true, true)}
                   </div>
                </section>

                <section>
                   <h3 className="font-black text-rose-900 text-[14pt] mb-6 uppercase tracking-widest border-b-[4px] border-rose-600 inline-block pb-1">III. PENUTUP</h3>
                   <div className="pl-2">{renderListContent(penutupParts[mIdx], { counter }, true, true)}</div>
                </section>
              </div>
            );
          })}

          {asesmenData && (
             <div className="border-2 border-black break-inside-avoid mt-20">
                <div className="bg-slate-900 text-white p-4 text-center font-black uppercase text-sm tracking-[0.2em]">STRATEGI ASESMEN & RUBRIK</div>
                <div className="p-8">{renderAsesmenTable(asesmenData, true)}</div>
             </div>
          )}

          <div className="mt-20 grid grid-cols-2 text-center text-[10pt] font-black uppercase font-sans break-inside-avoid px-8">
             <div><p>MENGETAHUI,</p><p>KEPALA SEKOLAH</p><div className="h-24"></div><p className="border-b-[2.5px] border-black inline-block min-w-[240px] mb-1">{settings.principalName}</p><p className="font-normal">NIP. {settings.principalNip}</p></div>
             <div><p>BILATO, {datumDate}</p><p>GURU KELAS/MAPEL</p><div className="h-24"></div><p className="border-b-[2.5px] border-black inline-block min-w-[240px] mb-1">{user.name}</p><p className="font-normal">NIP. {user.nip}</p></div>
          </div>
        </div>
      </div>
    );
  }

  const asesmenData = currentRpm ? parseAsesmen(currentRpm.asesmenTeknik) : null;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative theme-dpl font-sans">
      {message && (<div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all animate-in slide-in-from-right ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}><CheckCircle2 size={20}/><span className="text-sm font-black uppercase tracking-tight">{message.text}</span></div>)}
      
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus RPM</h3>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">
                Hapus rencana pembelajaran ini secara permanen dari database cloud Anda?
              </p>
            </div>
            <div className="p-5 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)} 
                className="flex-1 px-6 py-4 rounded-2xl text-xs font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 transition-all"
              >
                BATAL
              </button>
              <button 
                onClick={executeDelete} 
                className="flex-1 px-6 py-4 rounded-2xl text-xs font-black text-white bg-red-600 hover:bg-red-700 transition-all shadow-xl shadow-red-100"
              >
                YA, HAPUS
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[1200px] max-h-[95vh] rounded-[48px] shadow-2xl overflow-hidden flex flex-col border border-white/20">
            <div className="p-8 bg-white border-b flex justify-between items-center shrink-0">
               <div className="flex items-center gap-4">
                 <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100"><Rocket size={24}/></div>
                 <h3 className="font-black uppercase text-xl tracking-tighter text-slate-900">EDITOR RENCANA PEMBELAJARAN</h3>
               </div>
               <div className="flex gap-3">
                 <button onClick={() => setIsPrintMode(true)} className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-[10px] font-black flex items-center gap-2 transition-all shadow-lg"><Printer size={16}/> PRATINJAU</button>
                 <button onClick={() => setIsEditing(null)} className="px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl text-[10px] font-black transition-all">TUTUP</button>
               </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 no-scrollbar bg-slate-50/30">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">FASE / KELAS</label>
                       <div className="flex gap-1">
                          <div className="flex-1 bg-white border-2 border-slate-100 rounded-2xl p-4 font-black text-[10px] text-indigo-600 text-center">{currentRpm?.fase}</div>
                          <div className="flex-1 bg-white border-2 border-slate-100 rounded-2xl p-4 font-black text-[10px] text-indigo-600 text-center">Kelas {currentRpm?.kelas}</div>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SEMESTER</label>
                       <select 
                          className="w-full bg-indigo-50/50 border-2 border-indigo-100 focus:border-indigo-300 rounded-2xl p-4 font-black text-xs text-indigo-900 outline-none transition-all"
                          value={currentRpm?.semester}
                          onChange={e => updateRPM(isEditing!, 'semester', e.target.value)}
                       >
                          <option value="1">GANJIL (1)</option>
                          <option value="2">GENAP (2)</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PERTEMUAN</label>
                       <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400"><Split size={14}/></div>
                          <input 
                             type="number" min="1" 
                             className="w-full bg-white border-2 border-slate-100 focus:border-indigo-300 rounded-2xl py-4 pl-10 pr-4 font-black text-xs text-slate-800 outline-none transition-all" 
                             value={currentRpm?.jumlahPertemuan || 1} 
                             onChange={e => updateRPM(isEditing!, 'jumlahPertemuan', parseInt(e.target.value) || 1)} 
                          />
                       </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">TUJUAN PEMBELAJARAN (SUMBER: PROMES)</label>
                    <select 
                      className="w-full bg-white border-2 border-slate-100 rounded-2xl p-5 text-xs font-black text-slate-800 outline-none focus:border-indigo-500 shadow-sm" 
                      value={promesData.find(p => p.tujuanPembelajaran === currentRpm?.tujuanPembelajaran)?.id || ''} 
                      onChange={e => syncWithPromes(isEditing!, e.target.value)}
                    >
                      <option value="">-- PILIH TP DARI PROGRAM SEMESTER --</option>
                      {sortedPromesOptions.map(p => (<option key={p.id} value={p.id}>[{p.kodeCP || '-'}] {p.tujuanPembelajaran}</option>))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">STRATEGI PEDAGOGIS</label>
                        <button 
                          onClick={() => handleRecommendPedagogy(isEditing!)} 
                          disabled={isLoadingPedagogyAI}
                          className="flex items-center gap-1 text-[9px] font-black text-indigo-600 uppercase hover:text-indigo-800 transition-all disabled:opacity-50"
                        >
                          {isLoadingPedagogyAI ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12}/>} REKOMENDASI
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><PenTool size={16}/></div>
                        <input 
                          type="text" 
                          placeholder="Misal: Discovery Learning..."
                          className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-xs font-black text-slate-700 outline-none focus:border-indigo-500 shadow-sm" 
                          value={currentRpm?.praktikPedagogis || ''} 
                          onChange={e => updateRPM(isEditing!, 'praktikPedagogis', e.target.value)} 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ALOKASI WAKTU</label>
                      <div className="bg-slate-50/50 border-2 border-slate-100 rounded-2xl p-4 flex flex-col justify-center h-[56px]">
                         <p className="text-xs font-black text-slate-800 leading-none">{currentRpm?.alokasiWaktu || '0 JP'}</p>
                         <p className="text-[10px] font-bold text-indigo-600 uppercase mt-1">Terdistribusi ke {currentRpm?.jumlahPertemuan} pertemuan</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-2 border-slate-100 rounded-[3rem] p-10 flex flex-col shadow-inner">
                   <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">DIMENSI PROFIL (DPL)</h4>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                      {DIMENSI_PROFIL.map((dim, i) => {
                        const isChecked = currentRpm?.dimensiProfil?.includes(dim);
                        return (
                          <button 
                            key={dim} 
                            onClick={() => toggleDimensi(isEditing!, dim)}
                            className="flex items-center gap-4 group text-left transition-all"
                          >
                            <div className={`shrink-0 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110' : 'bg-white border-slate-200 text-transparent group-hover:border-indigo-300'}`}>
                              <CheckCircle2 size={16} />
                            </div>
                            <div>
                               <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">DPL {i+1}</p>
                               <p className={`text-[11px] font-black uppercase transition-all ${isChecked ? 'text-indigo-700' : 'text-slate-400 group-hover:text-slate-600'}`}>{dim.split(' terhadap')[0]}</p>
                            </div>
                          </button>
                        );
                      })}
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
                 <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2 ml-1">
                      <LogIn size={14} className="text-blue-600" />
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">KEGIATAN AWAL (PER PERTEMUAN)</label>
                    </div>
                    <textarea 
                       className="w-full bg-white border-2 border-slate-100 rounded-[2rem] p-6 text-sm font-medium outline-none focus:border-indigo-500 h-40 shadow-sm"
                       value={currentRpm?.kegiatanAwal || ''}
                       onChange={e => updateRPM(isEditing!, 'kegiatanAwal', e.target.value)}
                       placeholder="Gunakan pemisah 'Pertemuan 1:', 'Pertemuan 2:', dst..."
                    />
                 </div>
                 <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2 ml-1">
                      <LogOut size={14} className="text-rose-600" />
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">KEGIATAN PENUTUP (PER PERTEMUAN)</label>
                    </div>
                    <textarea 
                       className="w-full bg-white border-2 border-slate-100 rounded-[2rem] p-6 text-sm font-medium outline-none focus:border-indigo-500 h-40 shadow-sm"
                       value={currentRpm?.kegiatanPenutup || ''}
                       onChange={e => updateRPM(isEditing!, 'kegiatanPenutup', e.target.value)}
                       placeholder="Gunakan pemisah 'Pertemuan 1:', 'Pertemuan 2:', dst..."
                    />
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                 <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">KEMITRAAN</label>
                    <textarea 
                       className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-xs font-bold outline-none focus:border-indigo-500 h-24 resize-none shadow-sm"
                       value={stripFilosofiTags(currentRpm?.kemitraan || '')}
                       onChange={e => updateRPM(isEditing!, 'kemitraan', e.target.value)}
                       placeholder="Misal: Bekerja sama dengan orang tua..."
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">LINGKUNGAN BELAJAR</label>
                    <textarea 
                       className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-xs font-bold outline-none focus:border-indigo-500 h-24 resize-none shadow-sm"
                       value={stripFilosofiTags(currentRpm?.lingkunganBelajar || '')}
                       onChange={e => updateRPM(isEditing!, 'lingkunganBelajar', e.target.value)}
                       placeholder="Misal: Ruang kelas ditata inklusif..."
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PEMANFAATAN DIGITAL</label>
                    <textarea 
                       className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-xs font-bold outline-none focus:border-indigo-500 h-24 resize-none shadow-sm"
                       value={stripFilosofiTags(currentRpm?.pemanfaatanDigital || '')}
                       onChange={e => updateRPM(isEditing!, 'pemanfaatanDigital', e.target.value)}
                       placeholder="Misal: Penggunaan proyektor dan aplikasi kuis..."
                    />
                 </div>
              </div>

              <div className="mt-12 space-y-8 bg-white p-12 rounded-[4rem] border-2 border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none rotate-12">
                   <Cpu size={250} />
                </div>
                <div className="flex items-center justify-between border-b border-slate-50 pb-6 relative z-10">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Sparkles size={20}/></div>
                      <h4 className="font-black text-slate-800 uppercase text-lg tracking-tighter">Narasi Deep Learning (Multi-Pertemuan)</h4>
                   </div>
                   <button 
                      onClick={() => handleGenerateAI(isEditing!)} 
                      disabled={isLoadingAI} 
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-[2.5rem] text-xs font-black shadow-2xl shadow-indigo-100 flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                   >
                      {isLoadingAI ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18}/>} 
                      RE-GENERATE RINCIAN LANGKAH
                   </button>
                </div>
                
                <div className="relative group z-10">
                   <textarea 
                      className="w-full bg-slate-50/30 border-2 border-slate-100 focus:border-indigo-500 rounded-[32px] p-8 text-[14px] min-h-[600px] outline-none font-medium leading-relaxed shadow-inner" 
                      placeholder="AI akan menyusun langkah berdasarkan: 'Pertemuan 1:', 'A. MEMAHAMI', 'B. MENGAPLIKASI', 'C. MEREFLEKSI'..."
                      value={currentRpm?.kegiatanInti || ''} 
                      onChange={e => updateRPM(isEditing!, 'kegiatanInti', e.target.value)} 
                   />
                </div>

                <div className="pt-6 border-t border-slate-50 flex justify-center relative z-10">
                   <button 
                      onClick={() => handleGenerateAsesmenAI(isEditing!)} 
                      disabled={isLoadingAsesmenAI} 
                      className="flex items-center gap-3 bg-white border-2 border-slate-200 text-slate-800 px-10 py-4 rounded-[2rem] text-[10px] font-black hover:bg-slate-50 hover:border-slate-300 transition-all shadow-md disabled:opacity-50"
                   >
                      {isLoadingAsesmenAI ? <Loader2 size={16} className="animate-spin" /> : <LayoutList size={16}/>} 
                      GENERASI ASESMEN PERSONAL (AWAL-PROSES-AKHIR)
                   </button>
                </div>
              </div>

              {asesmenData && (
                <div className="mt-12 space-y-8 bg-white p-12 rounded-[4rem] border-2 border-slate-100 shadow-sm relative overflow-hidden">
                  <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                     <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><ClipboardList size={20}/></div>
                     <h4 className="font-black text-slate-800 uppercase text-lg tracking-tighter">Editor Strategi Asesmen & Rubrik</h4>
                  </div>
                  <div className="space-y-12">
                     {['ASESMEN AWAL', 'ASESMEN PROSES', 'ASESMEN AKHIR'].map(cat => {
                        const catRows = asesmenData.filter(r => (r.kategori || '').toUpperCase().includes(cat.split(' ')[1]));
                        if (catRows.length === 0) return null;
                        return (
                           <div key={cat} className="space-y-6">
                              <h5 className="font-black text-slate-400 text-[11px] uppercase tracking-[0.2em] border-l-4 border-slate-900 pl-3">{cat}</h5>
                              {catRows.map((row, idx) => {
                                 const originalIndex = asesmenData.findIndex(r => r === row);
                                 return (
                                    <div key={idx} className="bg-slate-50/50 p-8 rounded-[32px] border border-slate-100 space-y-6 shadow-inner">
                                       <div className="grid grid-cols-2 gap-6">
                                          <div className="space-y-2">
                                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teknik Asesmen</label>
                                             <input 
                                                className="w-full bg-white border-2 border-slate-100 p-4 rounded-2xl text-xs font-bold outline-none focus:border-indigo-500" 
                                                value={row.teknik} 
                                                onChange={e => updateAsesmenRow(isEditing!, originalIndex, 'teknik', e.target.value)} 
                                             />
                                          </div>
                                          <div className="space-y-2">
                                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bentuk Instrumen</label>
                                             <input 
                                                className="w-full bg-white border-2 border-slate-100 p-4 rounded-2xl text-xs font-bold outline-none focus:border-indigo-500" 
                                                value={row.bentuk} 
                                                onChange={e => updateAsesmenRow(isEditing!, originalIndex, 'bentuk', e.target.value)} 
                                             />
                                          </div>
                                       </div>
                                       <div className="space-y-2">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Butir Soal / Penugasan</label>
                                          <textarea 
                                             className="w-full bg-white border-2 border-slate-100 p-4 rounded-2xl text-[13px] font-medium h-32 outline-none focus:border-indigo-500 leading-relaxed" 
                                             value={row.soalAtauTugas} 
                                             onChange={e => updateAsesmenRow(isEditing!, originalIndex, 'soalAtauTugas', e.target.value)} 
                                             placeholder="AI akan menyusun butir instrumen di sini..."
                                          />
                                       </div>
                                       <div className="space-y-2">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Instruksi Guru</label>
                                          <textarea 
                                             className="w-full bg-white border-2 border-slate-100 p-4 rounded-2xl text-[12px] font-medium h-20 outline-none focus:border-indigo-500 italic" 
                                             value={row.instruksi} 
                                             onChange={e => updateAsesmenRow(isEditing!, originalIndex, 'instruksi', e.target.value)} 
                                             placeholder="Tulis instruksi pelaksanaan asesmen..."
                                          />
                                       </div>
                                    </div>
                                 )
                              })}
                           </div>
                        )
                     })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-6 items-end">
         <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 w-full text-[10px] font-black uppercase tracking-widest">
           <div className="space-y-2">
              <label className="text-slate-400 ml-1">MATA PELAJARAN</label>
              <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-indigo-500" value={filterMapel} onChange={e => setFilterMapel(e.target.value)}>
                {availableMapel.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-slate-400 ml-1">SEMESTER AKTIF</label>
              <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-indigo-500" value={filterSemester} onChange={e => setFilterSemester(e.target.value as any)}>
                <option value="1">Ganjil (1)</option>
                <option value="2">Genap (2)</option>
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-slate-400 ml-1 flex items-center gap-1">KELAS</label>
              <select disabled={isClassLocked} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black outline-none disabled:opacity-50" value={filterKelas} onChange={e => handleKelasChange(e.target.value as Kelas)}>
                {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
              </select>
           </div>
         </div>
         <button onClick={handleAddRPM} className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-[2rem] font-black text-xs shadow-2xl shadow-indigo-100 active:scale-95 transition-all flex items-center gap-3 uppercase tracking-widest"><Plus size={20}/> BUAT RPM MENDALAM</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {loading ? (
          <div className="col-span-full py-40 text-center"><Loader2 size={48} className="animate-spin text-indigo-600 inline-block"/><p className="text-[10px] font-black uppercase tracking-widest mt-6 text-slate-400">Sinkronisasi Cloud...</p></div>
        ) : sortedRPM.length === 0 ? (
          <div className="col-span-full py-40 text-center text-slate-300 font-black uppercase text-sm bg-white border-2 border-dashed border-slate-100 rounded-[64px]">Belum Ada Rencana Pembelajaran</div>
        ) : sortedRPM.map(rpm => (
          <div key={rpm.id} className="bg-white p-12 rounded-[4rem] border-2 border-slate-100 hover:shadow-2xl hover:border-indigo-200 transition-all group overflow-hidden relative">
            <div className="absolute -top-10 -right-10 p-20 bg-indigo-50/50 rounded-full opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 pointer-events-none">
              <Rocket size={80} className="text-indigo-100" />
            </div>
            <div className="flex gap-8 items-start mb-10 relative z-10">
              <div className="p-6 bg-indigo-50 text-indigo-600 rounded-[2.5rem] group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm"><Rocket size={36}/></div>
              <div className="flex-1">
                <h4 className="text-xl font-black text-slate-900 leading-tight uppercase line-clamp-2 mb-4 tracking-tighter">{rpm.tujuanPembelajaran || 'TANPA JUDUL RENCANA'}</h4>
                <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
                  <span className="text-indigo-600 px-4 py-2 bg-indigo-50 rounded-full border border-indigo-100">Semester {rpm.semester}</span>
                  <span className="text-blue-600 px-4 py-2 bg-blue-50 rounded-full border border-blue-100">{rpm.praktikPedagogis || 'Model Belum Diatur'}</span>
                  <span className="text-emerald-600 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">{rpm.jumlahPertemuan} Pertemuan</span>
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-8 border-t border-slate-50 relative z-10">
              <button onClick={() => setIsEditing(rpm.id)} className="flex-1 bg-slate-900 text-white py-5 rounded-[2rem] text-[11px] font-black hover:bg-black shadow-xl active:scale-95 transition-all uppercase tracking-[0.2em]">BUKA EDITOR PERSONAL</button>
              <button onClick={() => setDeleteConfirmId(rpm.id)} className="p-5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-[2rem] transition-all"><Trash2 size={24}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RPMManager;
