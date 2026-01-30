
import { Fase, Kelas, Siswa, AsesmenNilai, AsesmenInstrumen, ATPItem, MATA_PELAJARAN, SchoolSettings, User, KisiKisiItem } from '../types';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Trash2, Loader2, Cloud, Printer, CheckCircle2, AlertTriangle, 
  PenTool, BarChart3, Wand2, ChevronRight, FileDown, Sparkles, Lock, Eye, EyeOff, AlertCircle, X, BookText, Square, CheckSquare, Circle, Image as ImageIcon, Download, ArrowLeft, Key
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
  const [hariTanggal, setHariTanggal] = useState('');
  const [waktuPengerjaan, setWaktuPengerjaan] = useState('90 Menit');
  const [tps, setTps] = useState<ATPItem[]>([]);
  const [kisikisi, setKisikisi] = useState<KisiKisiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoadingMap, setAiLoadingMap] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [showAddAsesmenModal, setShowAddAsesmenModal] = useState(false);
  const [modalInputValue, setModalInputValue] = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school,
    address: 'Jl. Trans Sulawesi, Kec. Bilato',
    principalName: 'Nama Kepala Sekolah',
    principalNip: '-'
  });
  const [activeYear, setActiveYear] = useState('2025/2026');

  useEffect(() => {
    if (user.role === 'guru') {
      if (user.kelas !== '-' && user.kelas !== 'Multikelas') {
        setKelas(user.kelas as Kelas);
        updateFaseByKelas(user.kelas as Kelas);
      }
      if (user.mapelDiampu && user.mapelDiampu.length > 0) {
        if (!user.mapelDiampu.includes(mapel)) setMapel(user.mapelDiampu[0]);
      }
    }
  }, [user]);

  const updateFaseByKelas = (kls: Kelas) => {
    if (['1', '2'].includes(kls)) setFase(Fase.A);
    else if (['3', '4'].includes(kls)) setFase(Fase.B);
    else if (['5', '6'].includes(kls)) setFase(Fase.C);
  };

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, "school_settings", user.school), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });
    const unsubYears = onSnapshot(collection(db, "academic_years"), (snap) => {
      const active = snap.docs.find(d => d.data().isActive);
      if (active) setActiveYear(active.data().year);
    });
    return () => { unsubSettings(); unsubYears(); };
  }, [user.school]);

  useEffect(() => {
    setLoading(true);
    const qAtp = query(collection(db, "atp"), where("userId", "==", user.id));
    const unsubAtp = onSnapshot(qAtp, (snapshot) => {
      setTps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ATPItem[]);
    });

    const qKisi = query(collection(db, "kisikisi"), where("userId", "==", user.id));
    const unsubKisi = onSnapshot(qKisi, (snapshot) => {
      setKisikisi(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as KisiKisiItem[]);
      setLoading(false);
    });
    return () => { unsubAtp(); unsubKisi(); };
  }, [user.id]);

  const filteredKisikisi = useMemo(() => {
    return kisikisi.filter(k => 
      k.fase === fase && k.kelas === kelas && k.semester === semester && k.mataPelajaran === mapel &&
      (namaAsesmen === '' || k.namaAsesmen === namaAsesmen)
    ).sort((a, b) => (a.nomorSoal || 0) - (b.nomorSoal || 0));
  }, [kisikisi, fase, kelas, semester, mapel, namaAsesmen]);

  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || []);
  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';

  const availableAsesmenNames = useMemo(() => {
    const names = kisikisi
      .filter(k => k.fase === fase && k.kelas === kelas && k.semester === semester && k.mataPelajaran === mapel)
      .map(k => k.namaAsesmen);
    return Array.from(new Set(names)).sort();
  }, [kisikisi, fase, kelas, semester, mapel]);

  const handleAddKisikisiRow = async (customName?: string) => {
    const nameToUse = customName || namaAsesmen;
    if (!nameToUse) { setShowAddAsesmenModal(true); return; }
    try {
      const nextNo = filteredKisikisi.length > 0 ? Math.max(...filteredKisikisi.map(k => k.nomorSoal)) + 1 : 1;
      await addDoc(collection(db, "kisikisi"), {
        userId: user.id,
        fase, kelas, semester, mataPelajaran: mapel, namaAsesmen: nameToUse,
        elemen: '', cp: '', kompetensi: 'Pengetahuan dan Pemahaman', tpId: '', tujuanPembelajaran: '',
        indikatorSoal: '', jenis: 'Tes', bentukSoal: 'Pilihan Ganda', subBentukSoal: 'Multiple Choice', stimulus: '', soal: '', kunciJawaban: '', nomorSoal: nextNo,
        school: user.school
      });
      if (customName) setNamaAsesmen(nameToUse);
    } catch (e) { console.error(e); }
  };

  const handleCreateNewAsesmen = async () => {
    if (!modalInputValue.trim()) return;
    const newName = modalInputValue.trim().toUpperCase();
    await handleAddKisikisiRow(newName);
    setModalInputValue('');
    setShowAddAsesmenModal(false);
  };

  const updateKisiKisi = async (id: string, field: keyof KisiKisiItem, value: any) => {
    try {
      const updateData: any = { [field]: value };
      if (field === 'tpId') {
        const atp = tps.find(t => t.id === value);
        if (atp) {
          updateData.tujuanPembelajaran = atp.tujuanPembelajaran;
          updateData.elemen = atp.elemen;
          updateData.cp = atp.capaianPembelajaran;
        }
      }
      if (field === 'bentukSoal' && value !== 'Pilihan Ganda Kompleks') {
        updateData.subBentukSoal = '';
      } else if (field === 'bentukSoal' && value === 'Pilihan Ganda Kompleks') {
        updateData.subBentukSoal = 'Multiple Choice';
      }
      
      await updateDoc(doc(db, "kisikisi", id), updateData);
    } catch (e) { console.error(e); }
  };

  const generateIndikatorAI = async (item: KisiKisiItem) => {
    if (!user.apiKey) { setMessage({ text: "API Key Belum Diatur.", type: "warning" }); return; }
    if (!item.tujuanPembelajaran) return;
    setAiLoadingMap(prev => ({ ...prev, [`ind-${item.id}`]: true }));
    try {
      // FIX: Removed individual apiKey argument as it's now handled by process.env
      const indikator = await generateIndikatorSoal(item);
      if (indikator) await updateKisiKisi(item.id, 'indikatorSoal', indikator);
    } catch (e: any) {
      setMessage({ text: "AI Gagal. Periksa API Key.", type: "error" });
    } finally { 
      setAiLoadingMap(prev => ({ ...prev, [`ind-${item.id}`]: false })); 
    }
  };

  const generateSoalAI = async (item: KisiKisiItem) => {
    if (!user.apiKey) { setMessage({ text: "API Key Belum Diatur.", type: "warning" }); return; }
    if (!item.indikatorSoal) return;
    setAiLoadingMap(prev => ({ ...prev, [`soal-${item.id}`]: true }));
    try {
      // FIX: Removed individual apiKey argument as it's now handled by process.env
      const result = await generateButirSoal(item);
      if (result) {
        await updateDoc(doc(db, "kisikisi", item.id), { 
          stimulus: result.stimulus || "",
          soal: result.soal || "", 
          kunciJawaban: result.kunci || "" 
        });
        setMessage({ text: "Soal berhasil disusun!", type: "success" });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (e: any) {
      setMessage({ text: "AI Gagal. Periksa API Key.", type: "error" });
    } finally { 
      setAiLoadingMap(prev => ({ ...prev, [`soal-${item.id}`]: false })); 
    }
  };

  const triggerImageAI = async (item: KisiKisiItem) => {
     if (!user.apiKey) { setMessage({ text: "API Key Belum Diatur.", type: "warning" }); return; }
     if (!item.indikatorSoal) return;
     setAiLoadingMap(prev => ({ ...prev, [`img-${item.id}`]: true }));
     try {
        const context = item.stimulus || item.indikatorSoal;
        // FIX: Removed extra arguments to match function definition (2 expected)
        const base64 = await generateAiImage(context, kelas);
        if (base64) {
           await updateDoc(doc(db, "kisikisi", item.id), { stimulusImage: base64 });
           setMessage({ text: "Gambar AI berhasil disimpan!", type: "success" });
           setTimeout(() => setMessage(null), 3000);
        }
     } catch (e: any) {
        setMessage({ text: "Gagal membuat gambar.", type: "error" });
     } finally {
        setAiLoadingMap(prev => ({ ...prev, [`img-${item.id}`]: false }));
     }
  };

  const renderSoalContent = (content: string, item: KisiKisiItem, isPrint = false, isStimulus = false) => {
    if (!content) return null;
    
    let finalContent = content;

    // TRANSFORMATION 1: Pilihan Ganda Kompleks
    const isStatementType = ['Benar Salah', 'Ya Tidak', 'Setuju Tidak Setuju'].includes(item.subBentukSoal || '');
    if (item.bentukSoal === 'Pilihan Ganda Kompleks' && isStatementType && !content.includes('|')) {
      const headerMap: Record<string, string[]> = {
        'Benar Salah': ['Pernyataan', 'Benar', 'Salah'],
        'Ya Tidak': ['Pernyataan', 'Ya', 'Tidak'],
        'Setuju Tidak Setuju': ['Pernyataan', 'Setuju', 'Tidak Setuju']
      };
      const headers = headerMap[item.subBentukSoal!];
      const lines = content.split('\n');
      let questionPart: string[] = [];
      let statementRows: string[] = [];
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (trimmed.match(/^([A-E0-9]+[\.\)])\s+/i)) {
          const cleanText = trimmed.replace(/^([A-E0-9]+[\.\)])\s*/i, '').trim();
          statementRows.push(`| ${cleanText} | | |`);
        } else {
          if (statementRows.length > 0) {
            statementRows[statementRows.length - 1] = statementRows[statementRows.length - 1].replace(/ \| \| \|$/, ` ${trimmed} | | |`);
          } else {
            questionPart.push(line);
          }
        }
      });
      if (statementRows.length > 0) {
        finalContent = questionPart.join('\n') + '\n\n' + `| ${headers.join(' | ')} |\n` + statementRows.join('\n');
      }
    }

    // TRANSFORMATION 2: Menjodohkan
    if (item.bentukSoal === 'Menjodohkan' && !content.includes('|')) {
       if (content.toUpperCase().includes('KOLOM KIRI') || content.toUpperCase().includes('KOLOM KANAN')) {
          const lines = content.split('\n');
          let leftSide: string[] = [];
          let rightSide: string[] = [];
          let currentSide: 'none' | 'left' | 'right' = 'none';
          let questionHeader: string[] = [];
          
          lines.forEach(line => {
             const trimmed = line.trim();
             if (!trimmed) return;
             if (trimmed.toUpperCase().includes('KOLOM KIRI')) { currentSide = 'left'; return; }
             if (trimmed.toUpperCase().includes('KOLOM KANAN')) { currentSide = 'right'; return; }
             
             if (trimmed.match(/^([A-E0-9]+[\.\)])\s+/i)) {
                const cleanText = trimmed.replace(/^([A-E0-9]+[\.\)])\s*/i, '').trim();
                if (currentSide === 'left') leftSide.push(cleanText);
                else if (currentSide === 'right') rightSide.push(cleanText);
             } else {
                if (currentSide === 'none') questionHeader.push(line);
                else if (currentSide === 'left' && leftSide.length > 0) leftSide[leftSide.length-1] += ' ' + trimmed;
                else if (currentSide === 'right' && rightSide.length > 0) rightSide[rightSide.length-1] += ' ' + trimmed;
             }
          });
          
          if (leftSide.length > 0 || rightSide.length > 0) {
             const maxLen = Math.max(leftSide.length, rightSide.length);
             let tableString = questionHeader.join('\n') + '\n\n| Kolom Kiri | | Kolom Kanan |\n';
             for (let i = 0; i < maxLen; i++) {
                tableString += `| ${leftSide[i] || ''} | | ${rightSide[i] || ''} |\n`;
             }
             finalContent = tableString;
          }
       }
    }

    let preprocessed = finalContent.replace(/([A-E][\.\)])\s/g, '\n$1 ').replace(/(\S)\s*\[\s*\]/g, '$1\n[]').replace(/\[\s?\]/g, 'CHECKBOX_MARKER');
    if (item.bentukSoal === 'Isian' && !isStimulus) {
      if (!preprocessed.includes('....') && !preprocessed.includes('_____')) {
        preprocessed = preprocessed.trim().replace(/[\.\?\!]$/, '') + ' ....................................';
      }
    }

    const lines = preprocessed.split('\n');
    const renderedParts: React.ReactNode[] = [];
    let currentTableRows: string[][] = [];
    let currentParagraphLines: string[] = [];

    const flushParagraph = (key: string) => {
      if (currentParagraphLines.length > 0) {
        const isMultipleChoicePGK = item.bentukSoal === 'Pilihan Ganda Kompleks' && item.subBentukSoal === 'Multiple Choice';
        renderedParts.push(
          <div key={key} className={`whitespace-pre-wrap text-justify leading-relaxed ${item.bentukSoal === 'Isian' ? (isPrint ? 'mb-8' : 'mb-6') : 'mb-4'}`}>
            {currentParagraphLines.map((line, li) => {
              const trimmedLine = line.trim();
              if (!trimmedLine) return null;
              const optionMatch = trimmedLine.match(/^([A-E])[\.\)]\s+(.*)/i);
              if (isMultipleChoicePGK && optionMatch) {
                const [_, label, text] = optionMatch;
                return (
                  <div key={li} className="flex items-start gap-4 mb-3 pl-1 group cursor-pointer">
                    <div className={`shrink-0 border-2 border-black rounded-sm transition-all ${isPrint ? 'w-4 h-4 mt-0.5' : 'w-5 h-5 mt-0.5'} bg-white flex items-center justify-center hover:bg-slate-100`}>
                      <div className="w-2.5 h-2.5 bg-slate-900 rounded-[1px] opacity-0 group-active:opacity-100 transition-opacity"></div>
                    </div>
                    <span className={`${isPrint ? 'text-[10pt]' : 'text-[14px]'} font-black flex-1 text-slate-900`}>{text}</span>
                  </div>
                );
              }
              if (optionMatch && item.bentukSoal === 'Pilihan Ganda') {
                const [_, label, text] = optionMatch;
                return (
                  <div key={li} className="flex items-start gap-3 mb-2 pl-2">
                    <span className={`font-black w-7 shrink-0 text-left ${isPrint ? 'text-[10pt]' : 'text-[14px]'}`}>{label.toUpperCase()}.</span>
                    <span className={`flex-1 ${isPrint ? 'text-[10pt]' : 'text-[14px]'} font-black`}>{text}</span>
                  </div>
                );
              }
              return <div key={li} className="flex items-start gap-2 mb-2"><span className={`${isPrint ? 'text-[10pt]' : 'text-[14px]'} leading-relaxed font-black`}>{line.replace(/CHECKBOX_MARKER|\[\]/g, '').trim()}</span></div>;
            })}
          </div>
        );
        currentParagraphLines = [];
      }
    };

    const flushTable = (key: string) => {
      if (currentTableRows.length > 0) {
        let rows = currentTableRows.map(r => r.filter(c => c !== undefined).map(c => c.trim())).filter(r => !r.some(c => c.match(/^[:\-\s]+$/))).filter(r => r.join('').length > 0);
        if (rows.length === 0) { currentTableRows = []; return; }
        const isMatching = item.bentukSoal === 'Menjodohkan';
        const isGrid = item.bentukSoal === 'Pilihan Ganda Kompleks' && (item.subBentukSoal === 'Grid' || item.subBentukSoal === 'Benar Salah' || item.subBentukSoal === 'Setuju Tidak Setuju' || item.subBentukSoal === 'Ya Tidak');
        
        if (isMatching) {
            let dataRows = rows;
            const firstRowJoined = rows[0].join(' ').toUpperCase();
            if (firstRowJoined.includes('KOLOM') || firstRowJoined.includes('PERNYATAAN')) dataRows = rows.slice(1);
            
            const leftItems = dataRows.map(r => r[0]).filter(Boolean);
            const rightItems = dataRows.map(r => r[2] || r[1] || '').filter(Boolean);
            
            renderedParts.push(
              <div key={key} className="my-10 w-full flex justify-center">
                <div className="flex justify-between w-full max-w-5xl px-4 gap-x-20">
                  <div className="flex-1 space-y-6">
                    {leftItems.map((text, idx) => (
                      <div key={`L-${idx}`} className="flex items-center gap-4 group justify-end">
                        <div className={`flex-1 border-[2px] border-[#cc7066] rounded-[2rem] px-8 py-3 bg-white shadow-sm text-center min-h-[4rem] flex items-center justify-center`}>
                          <span className={`${isPrint ? 'text-[12pt]' : 'text-[18px]'} font-bold text-slate-800 leading-tight`}>{text}</span>
                        </div>
                        <div className="w-5 h-5 bg-[#cc7066] rounded-full shrink-0 shadow-sm border border-white/20"></div>
                      </div>
                    ))}
                  </div>

                  <div className="flex-1 space-y-6">
                    {rightItems.map((text, idx) => (
                      <div key={`R-${idx}`} className="flex items-center gap-4 group">
                        <div className="w-5 h-5 bg-[#cc7066] rounded-full shrink-0 shadow-sm border border-white/20"></div>
                        <div className={`flex-1 border-[2px] border-[#cc7066] rounded-[2rem] px-8 py-3 bg-white shadow-sm text-center min-h-[4rem] flex items-center justify-center`}>
                          <span className={`${isPrint ? 'text-[12pt]' : 'text-[18px]'} font-bold text-slate-800 leading-tight`}>{text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
        } else {
          renderedParts.push(
            <div key={key} className="my-8 overflow-x-auto rounded-[1rem] border-2 border-black shadow-sm overflow-hidden">
                <table className={`border-collapse w-full ${isPrint ? 'text-[10pt]' : 'text-[12px]'} table-fixed`}>
                  <colgroup>
                    <col style={{ width: isGrid ? '64%' : 'auto' }} />
                    {isGrid && rows[0].slice(1).map((_, i) => <col key={i} style={{ width: `${36 / (rows[0].length - 1)}%` }} />)}
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-100">
                      {rows[0].map((cell, i) => (
                        <th key={i} className="border-2 border-black p-3 font-black text-center uppercase tracking-tight text-[11px]">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(1).map((row, ri) => (
                      <tr key={ri} className="hover:bg-slate-50/50 transition-colors">
                        {row.map((cell, ci) => (
                          <td key={ci} className={`border-2 border-black p-3 ${isGrid && ci > 0 ? 'text-center' : 'text-justify'} align-middle`}>
                            {isGrid && ci > 0 ? (
                              <div className="flex justify-center items-center py-2">
                                <div className={`${isPrint ? 'w-5 h-5' : 'w-6 h-6'} border-2 border-black rounded-md bg-white shadow-sm flex items-center justify-center`}>
                                </div>
                              </div>
                            ) : (
                              <div className="min-h-[1.5em] font-black">{cell}</div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          );
        }
        currentTableRows = [];
      }
    };
    lines.forEach((line, index) => {
      if (line.trim().startsWith('|')) { if (currentParagraphLines.length > 0) flushParagraph(`p-${index}`); currentTableRows.push(line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')); } 
      else { if (currentTableRows.length > 0) flushTable(`t-${index}`); if (line.trim().length > 0) currentParagraphLines.push(line); else if (currentParagraphLines.length > 0) flushParagraph(`p-${index}`); }
    });
    flushParagraph('p-final'); flushTable('t-final');
    return <div className="soal-content-container" style={{ width: '100%', lineHeight: '1.6' }}>{renderedParts}</div>;
  };

  const handleExportWord = () => {
    const isKisiKisi = activeTab === 'KISI_KISI';
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${isKisiKisi ? 'Kisi-kisi' : 'Naskah Soal'}</title><style>body { font-family: 'Arial', sans-serif; font-size: 10pt; } table { border-collapse: collapse; width: 100%; margin-bottom: 20px; } th, td { border: 1px solid black; padding: 5px; vertical-align: top; } .kop { text-align: center; border-bottom: 4px double black; padding-bottom: 10px; margin-bottom: 20px; }</style></head><body>`;
    const footer = "</body></html>";
    let contentHtml = isKisiKisi ? `<div class="kop"><h2>PEMERINTAH KABUPATEN GORONTALO</h2><h2>${settings.schoolName}</h2><p><i>${settings.address}</i></p></div><div style="text-align:center"><h1>KISI-KISI ASESMEN</h1><p>TAHUN PELAJARAN ${activeYear}</p></div><table border="1"><tr style="background:#f3f4f6"><th>ELEMEN / CP</th><th>LEVEL</th><th>INDIKATOR</th><th>BENTUK</th><th>TEKS BACAAN & BUTIR SOAL</th><th>KUNCI</th><th>NO</th></tr>${filteredKisikisi.map((item) => `<tr><td><b>${item.elemen}</b><br/><i>${item.cp}</i></td><td align="center">${item.kompetensi === 'Pengetahuan dan Pemahaman' ? 'L1' : item.kompetensi === 'Aplikasi' ? 'L2' : 'L3'}</td><td>${item.indikatorSoal}</td><td align="center">${item.bentukSoal}${item.subBentukSoal ? ' (' + item.subBentukSoal + ')' : ''}</td><td>${item.stimulus ? '<i>' + item.stimulus + '</i><br/><br/>' : ''}${item.soal}</td><td align="center"><b>${item.kunciJawaban}</b></td><td align="center">${item.nomorSoal}</td></tr>`).join('')}</table>` : `<div class="kop"><h2>PEMERINTAH KABUPATEN GORONTALO</h2><h2>${settings.schoolName}</h2><p><i>${settings.address}</i></p></div><div style="text-align:center"><h1>${namaAsesmen}</h1><p>TAHUN PELAJARAN ${activeYear}</p></div><table style="border:1px solid black; width:100%; padding: 10px;"><tr><td>MAPEL: ${mapel}<br/>KELAS: ${kelas}</td><td>NAMA: ...................<br/>HARI: ...................</td></tr></table>${filteredKisikisi.map(item => `<div style="margin-top:15px"><b>${item.nomorSoal}.</b> ${item.soal}</div>`).join('')}`;
    const blob = new Blob(['\ufeff', header + contentHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${isKisiKisi ? 'Kisi_Kisi' : 'Naskah_Soal'}_${mapel.replace(/ /g, '_')}.doc`; link.click();
  };

  const handlePrintAction = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`<html><head><title>${settings.schoolName}</title><script src="https://cdn.tailwindcss.com"></script><style>body { font-family: 'Arial', sans-serif; background: white; padding: 20px; color: black; line-height: 1.6; } @media print { .no-print { display: none !important; } body { padding: 0; } } .break-inside-avoid { page-break-inside: avoid; } table { border-collapse: collapse; width: 100% !important; border: 1.5px solid black; } th, td { border: 1.5px solid black; padding: 6px; }</style></head><body onload="setTimeout(() => { window.print(); window.close(); }, 500)">${content}</body></html>`);
      printWindow.document.close();
    }
  };

  if (isPrintMode) {
    const isKisiKisi = activeTab === 'KISI_KISI';
    return (
      <div className="bg-white min-h-screen text-slate-900 p-8 font-sans print:p-0">
        <div className="no-print mb-8 flex justify-between bg-slate-100 p-4 rounded-2xl border border-slate-200 shadow-xl sticky top-4 z-[100]">
           <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-8 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all"><ArrowLeft size={16}/> KEMBALI</button>
           <div className="flex gap-2">
             <button onClick={handleExportWord} className="bg-blue-600 text-white px-8 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2"><FileDown size={16}/> WORD</button>
             <button onClick={handlePrintAction} className="bg-rose-600 text-white px-8 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2"><Printer size={16}/> CETAK</button>
           </div>
        </div>
        <div ref={printRef} className={`${isKisiKisi ? 'max-w-[29.7cm]' : 'max-w-[21cm]'} mx-auto bg-white p-4`}>
           <div className="text-center mb-2"><p className="text-sm font-bold uppercase tracking-widest leading-none">PEMERINTAH KABUPATEN GORONTALO</p><h2 className="text-2xl font-black uppercase leading-tight mt-1">{settings.schoolName}</h2><p className="text-[10px] font-medium italic mt-1 leading-none">{settings.address}</p></div>
           <div className="border-b-[4px] border-double border-black mb-6 mt-3"></div>
           <div className="text-center mb-8"><h1 className="text-xl font-black uppercase tracking-tight">{isKisiKisi ? 'KISI-KISI ASESMEN' : namaAsesmen}</h1><p className="text-xl font-black uppercase mt-1">TAHUN PELAJARAN {activeYear}</p></div>
           {!isKisiKisi && (
             <div className="border-[1.5px] border-black rounded-[2.5rem] p-8 mb-8">
                <div className="grid grid-cols-2 gap-x-12">
                   <div className="space-y-2 text-[10.5pt]"><div className="flex items-center"><span className="w-32 font-bold">Mata Pelajaran</span><span className="mr-3">:</span><span className="font-black uppercase">{mapel}</span></div><div className="flex items-center"><span className="w-32 font-bold">Fase / Kelas</span><span className="mr-3">:</span><span className="font-black uppercase">{fase} / {kelas}</span></div><div className="flex items-center"><span className="w-32 font-bold">Semester</span><span className="mr-3">:</span><span className="font-black uppercase">{semester === '1' ? 'Ganjil' : 'Genap'}</span></div></div>
                   <div className="space-y-2 text-[10.5pt]"><div className="flex items-center"><span className="w-32 font-bold">Hari / Tanggal</span><span className="mr-3">:</span><div className="flex-1 border-b border-dotted border-black h-4"></div></div><div className="flex items-center"><span className="w-32 font-bold">Waktu</span><span className="mr-3">:</span><span className="font-black uppercase">{waktuPengerjaan}</span></div><div className="flex items-center"><span className="w-32 font-bold">Nama Siswa</span><span className="mr-3">:</span><div className="flex-1 border-b border-dotted border-black h-4"></div></div></div>
                </div>
             </div>
           )}
           {isKisiKisi ? (
              <table className="w-full border-collapse border-2 border-black text-[9pt]">
                <thead><tr className="bg-slate-100 font-black text-center uppercase h-12"><th className="w-48">ELEMEN / CP</th><th className="w-16">LEVEL</th><th className="w-64">INDIKATOR</th><th className="w-24">BENTUK</th><th>TEKS BACAAN & BUTIR SOAL</th><th className="w-20">KUNCI</th><th className="w-12">NO</th></tr></thead>
                <tbody>{filteredKisikisi.map((item) => (<tr key={item.id} className="break-inside-avoid align-top"><td className="p-3 border border-black"><p className="font-black uppercase mb-1 leading-tight">{item.elemen}</p><p className="text-[8pt] italic text-slate-600 leading-tight">{item.cp}</p></td><td className="p-3 border border-black text-center font-bold">{item.kompetensi === 'Pengetahuan dan Pemahaman' ? 'L1' : item.kompetensi === 'Aplikasi' ? 'L2' : 'L3'}</td><td className="p-3 border border-black text-justify leading-tight font-black">{item.indikatorSoal}</td><td className="p-3 border border-black text-center uppercase text-[8pt] font-bold">{item.bentukSoal}{item.subBentukSoal ? <><br/><span className="text-[7pt] text-indigo-600 italic">({item.subBentukSoal})</span></> : ''}</td><td className="p-3 border border-black">{item.stimulus && (<div className="mb-4 p-2 bg-slate-50 border border-slate-200 text-[8.5pt] italic font-black">{renderSoalContent(item.stimulus, item, true, true)}</div>)}<div className="leading-relaxed">{renderSoalContent(item.soal, item, true, false)}</div></td><td className="p-3 border border-black text-center font-black">{item.kunciJawaban}</td><td className="p-3 border border-black text-center font-black">{item.nomorSoal}</td></tr>))}</tbody>
              </table>
           ) : (
              <div className="space-y-10 mt-8">{filteredKisikisi.map((item) => (<div key={item.id} className="break-inside-avoid"><div className="flex gap-4 items-start"><span className="font-black text-lg min-w-[2rem]">{item.nomorSoal}.</span><div className="flex-1 space-y-5">{item.stimulusImage && (<div className="flex justify-center my-6"><img src={item.stimulusImage} className="max-w-[300px] rounded-xl" /></div>)}{item.stimulus && (<div className="p-8 bg-slate-50 border-2 border-black rounded-[2rem] text-[10.5pt] italic text-justify font-black">{renderSoalContent(item.stimulus, item, true, true)}</div>)}<div className="text-slate-900 text-[11pt] font-black leading-relaxed pr-10">{renderSoalContent(item.soal, item, true, false)}</div></div></div></div>))}</div>
           )}
           {isKisiKisi && (
             <div className="mt-16 grid grid-cols-2 text-center text-[10pt] font-black uppercase break-inside-avoid">
               <div><p>Mengetahui,</p><p>Kepala Sekolah</p><div className="h-20"></div><p className="border-b border-black inline-block min-w-[150px]">{settings.principalName}</p></div>
               <div><p>Bilato, ........................</p><p>Guru Mata Pelajaran</p><div className="h-20"></div><p className="border-b border-black inline-block min-w-[150px]">{user.name}</p><p className="mt-1 font-normal tracking-tight uppercase">NIP. {user.nip}</p></div>
             </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {message && (<div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}><CheckCircle2 size={20}/><span>{message.text}</span></div>)}
      {!user.apiKey && (<div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2rem] flex items-center gap-5 shadow-sm"><div className="p-3 bg-white rounded-2xl text-amber-600 shadow-sm"><Key size={24}/></div><div><h3 className="font-black text-amber-800 uppercase text-sm tracking-tight leading-none">Generator AI Sumatif Nonaktif</h3><p className="text-xs text-amber-700 font-bold mt-1">Anda belum memasukkan personal Gemini API Key. Silakan lengkapi di Manajemen User agar AI dapat menyusun butir soal otomatis.</p></div></div>)}
      {showAddAsesmenModal && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4"><div className="bg-white rounded-[40px] shadow-2xl w-full max-md p-8 animate-in zoom-in-95"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black uppercase">Buat Asesmen Baru</h3><button onClick={() => setShowAddAsesmenModal(false)}><X size={24}/></button></div><input className="w-full bg-slate-50 border rounded-2xl p-4 text-sm font-black uppercase focus:ring-2 focus:ring-rose-600" value={modalInputValue} onChange={e => setModalInputValue(e.target.value)} placeholder="NAMA ASESMEN" autoFocus /><button onClick={handleCreateNewAsesmen} className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl mt-4 uppercase">BUAT SEKARANG</button></div></div>)}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200"><div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"><div className="flex items-center gap-4"><div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg"><BarChart3 size={24} /></div><div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200"><button onClick={() => setActiveTab('KISI_KISI')} className={`px-5 py-2 rounded-xl text-[10px] font-black ${activeTab === 'KISI_KISI' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>KISI-KISI</button><button onClick={() => setActiveTab('SOAL')} className={`px-5 py-2 rounded-xl text-[10px] font-black ${activeTab === 'SOAL' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>NASKAH SOAL</button></div></div><div className="flex gap-3"><button onClick={() => setShowAddAsesmenModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all"><Plus size={16}/> BUAT BARU</button><button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg"><Printer size={16}/> PRATINJAU</button></div></div><div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6 p-5 bg-slate-50 rounded-2xl"><div><label className="text-[10px] font-black text-slate-400 block mb-1">FASE</label><select disabled={isClassLocked} className="w-full bg-white border rounded-xl p-2 text-xs font-bold" value={fase} onChange={e => {setFase(e.target.value as Fase); updateFaseByKelas(kelas);}}>{Object.values(Fase).map(f => <option key={f} value={f}>{f}</option>)}</select></div><div><label className="text-[10px] font-black text-slate-400 block mb-1">KELAS</label><select disabled={isClassLocked} className="w-full bg-white border rounded-xl p-2 text-xs font-bold" value={kelas} onChange={e => setKelas(e.target.value as Kelas)}>{['1','2','3','4','5','6'].map(k => <option key={k} value={k}>{k}</option>)}</select></div><div><label className="text-[10px] font-black text-slate-400 block mb-1">MAPEL</label><select className="w-full bg-white border rounded-xl p-2 text-xs font-bold" value={mapel} onChange={e => setMapel(e.target.value)}>{availableMapel.map(m => <option key={m} value={m}>{m}</option>)}</select></div><div className="md:col-span-2"><label className="text-[10px] font-black text-slate-400 block mb-1">ASESMEN</label><select className="w-full bg-white border rounded-xl p-2 text-xs font-bold" value={namaAsesmen} onChange={e => setNamaAsesmen(e.target.value)}><option value="">Pilih Asesmen</option>{availableAsesmenNames.map(n => <option key={n}>{n}</option>)}</select></div></div></div>
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden min-h-[400px]">
        {loading ? (<div className="flex flex-col items-center justify-center py-40 gap-4"><Loader2 size={48} className="animate-spin text-rose-600" /></div>) : activeTab === 'KISI_KISI' ? (
          <div className="overflow-x-auto no-scrollbar"><table className="w-full text-left border-collapse min-w-[1800px] table-fixed"><thead><tr className="bg-slate-900 text-white text-[10px] font-black h-12 uppercase tracking-widest"><th className="px-6 py-2 w-16 text-center border-r border-white/5">Idx</th><th className="px-6 py-2 w-48">Elemen & TP</th><th className="px-6 py-2 w-40 text-center">Level</th><th className="px-6 py-2 w-48 text-center">Bentuk</th><th className="px-6 py-2 w-72">Indikator AI</th><th className="px-6 py-2 w-[700px]">Konten Soal</th><th className="px-6 py-2 w-24 text-center border-l border-white/5">No</th><th className="px-6 py-2 w-16 text-center">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredKisikisi.map((item, idx) => (<tr key={item.id} className="hover:bg-slate-50 align-top transition-colors"><td className="px-6 py-4 text-center font-black text-slate-300">{idx + 1}</td><td className="px-6 py-4"><select className="w-full bg-slate-50 border rounded-lg p-1.5 text-[10px] font-bold" value={item.tpId} onChange={e => updateKisiKisi(item.id, 'tpId', e.target.value)}><option value="">Pilih TP</option>{tps.filter(t => t.kelas === kelas && t.mataPelajaran === mapel).sort((a, b) => (a.indexOrder || 0) - (b.indexOrder || 0)).map(t => <option key={t.id} value={t.id}>[{t.kodeCP || '-'}] {t.tujuanPembelajaran}</option>)}</select></td><td className="px-6 py-4"><select className="w-full bg-indigo-50 border rounded-xl p-2.5 text-[10px] font-black text-indigo-700" value={item.kompetensi} onChange={e => updateKisiKisi(item.id, 'kompetensi', e.target.value as any)}><option value="Pengetahuan dan Pemahaman">L1</option><option value="Aplikasi">L2</option><option value="Penalaran">L3</option></select></td><td className="px-6 py-4">
            <div className="space-y-2">
              <select className="w-full text-[10px] font-bold p-1.5 border rounded-xl bg-slate-50" value={item.bentukSoal} onChange={e => updateKisiKisi(item.id, 'bentukSoal', e.target.value as any)}>
                <option>Pilihan Ganda</option>
                <option>Pilihan Ganda Kompleks</option>
                <option>Menjodohkan</option>
                <option>Isian</option>
                <option>Uraian</option>
              </select>
              {item.bentukSoal === 'Pilihan Ganda Kompleks' && (
                <select className="w-full text-[9px] font-black p-1.5 border rounded-lg bg-indigo-50 text-indigo-700 animate-in slide-in-from-top-1" value={item.subBentukSoal || 'Multiple Choice'} onChange={e => updateKisiKisi(item.id, 'subBentukSoal', e.target.value as any)}>
                  <option value="Multiple Choice">Multiple Choice</option>
                  <option value="Benar Salah">Benar Salah</option>
                  <option value="Setuju Tidak Setuju">Setuju Tidak Setuju</option>
                  <option value="Ya Tidak">Ya Tidak</option>
                  <option value="Grid">Grid / Tabel</option>
                </select>
              )}
            </div>
          </td><td className="px-6 py-4 relative group"><textarea className="w-full bg-white border rounded-xl p-2 text-[10px] font-black italic min-h-[100px]" value={item.indikatorSoal} onChange={e => updateKisiKisi(item.id, 'indikatorSoal', e.target.value)} /><button onClick={() => generateIndikatorAI(item)} disabled={aiLoadingMap[`ind-${item.id}`]} className="absolute bottom-6 right-8 text-indigo-600 bg-white p-1 rounded shadow-sm">{aiLoadingMap[`ind-${item.id}`] ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14}/>}</button></td><td className="px-6 py-4 bg-slate-50/30 relative"><div className="grid grid-cols-2 gap-4 h-full"><div className="flex flex-col"><div className="flex items-center justify-between text-[9px] font-black text-indigo-600 uppercase mb-2"><div className="flex items-center gap-1.5"><BookText size={12}/> Informasi / Teks</div><button onClick={() => triggerImageAI(item)} disabled={aiLoadingMap[`img-${item.id}`]} className="p-1">{aiLoadingMap[`img-${item.id}`] ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12}/>}</button></div><textarea className="w-full bg-white border rounded-xl p-2 text-[10px] font-black italic min-h-[120px]" value={item.stimulus} onChange={e => updateKisiKisi(item.id, 'stimulus', e.target.value)} /></div><div className="space-y-3 flex flex-col"><div><span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Soal & Opsi:</span><textarea className="w-full bg-white border rounded-xl p-2 text-[11px] font-black min-h-[120px]" value={item.soal} onChange={e => updateKisiKisi(item.id, 'soal', e.target.value)} /></div><div className="flex items-center gap-2 mt-auto"><span className="text-[9px] font-black uppercase text-slate-400">Kunci:</span><input className="flex-1 bg-white border rounded-lg p-1.5 text-[10px] font-black text-indigo-600" value={item.kunciJawaban} onChange={e => updateKisiKisi(item.id, 'kunciJawaban', e.target.value)} /></div></div></div><button onClick={() => generateSoalAI(item)} disabled={aiLoadingMap[`soal-${item.id}`]} className="absolute bottom-6 right-4 bg-rose-600 text-white p-2.5 rounded-2xl shadow-xl z-10">{aiLoadingMap[`soal-${item.id}`] ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18}/>}</button></td><td className="px-6 py-4 text-center"><input type="number" className="w-16 text-[12px] text-center font-black p-2 border rounded-xl" value={item.nomorSoal} onChange={e => updateKisiKisi(item.id, 'nomorSoal', parseInt(e.target.value) || 0)} /></td><td className="px-6 py-4 text-center"><button onClick={() => deleteDoc(doc(db, "kisikisi", item.id))} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></td></tr>))}<tr><td colSpan={8} className="p-6"><button onClick={() => handleAddKisikisiRow()} className="w-full py-8 border-2 border-dashed border-slate-200 rounded-[2rem] text-xs font-black text-slate-400 hover:border-indigo-300 transition-all flex flex-col items-center justify-center gap-2"><Plus size={24}/><span>Tambah Baris Butir Soal Baru</span></button></td></tr></tbody></table></div>
        ) : (
          <div className="p-10 bg-slate-50 min-h-[600px]"><div className="max-w-4xl mx-auto"><div className="grid grid-cols-2 gap-4 bg-white p-6 rounded-2xl shadow-sm mb-12"><div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Hari / Tanggal</label><input type="text" className="w-full bg-slate-50 border rounded-xl p-3 text-xs font-bold" value={hariTanggal} onChange={e => setHariTanggal(e.target.value)} /></div><div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Alokasi Waktu</label><input type="text" className="w-full bg-slate-50 border rounded-xl p-3 text-xs font-bold" value={waktuPengerjaan} onChange={e => setWaktuPengerjaan(e.target.value)} /></div></div><div className="space-y-1 bg-white p-1 rounded-2xl shadow-lg border border-slate-200 overflow-hidden"><table className="w-full border-collapse"><thead><tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest h-10"><th className="w-16 px-4 text-center">No</th><th className="px-6 text-left">Naskah Soal & Bacaan</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredKisikisi.map((item) => (<tr key={item.id} className="group hover:bg-slate-50/50 align-top"><td className="py-8 px-4 text-center"><span className="inline-flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl font-black text-lg">{item.nomorSoal}</span></td><td className="py-8 px-6 break-words"><div className="space-y-6">{(item.stimulus || item.stimulusImage) && (<div><p className="font-bold text-[11px] italic text-slate-600 mb-2">Cermatilah teks bacaan atau gambar berikut untuk menjawab soal nomor {item.nomorSoal}:</p><div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-indigo-100 relative mb-6">{item.stimulusImage && (<div className="flex justify-center mb-8"><img src={item.stimulusImage} className="max-w-[400px] rounded-2xl border-4 border-white shadow-2xl" /></div>)}<div className="text-[10.5pt] leading-relaxed text-slate-800 italic font-black">{renderSoalContent(item.stimulus, item, false, true)}</div></div></div>)}<div className="text-slate-900 text-[11pt] font-black leading-relaxed pr-10">{renderSoalContent(item.soal, item, false, false)}</div></div></td></tr>))}</tbody></table></div></div></div>
        )}
      </div>
    </div>
  );
};

export default AsesmenManager;
