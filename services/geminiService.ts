
import { GoogleGenAI, Type } from "@google/genai";
import { UploadedFile, Kelas } from "../types";

const cleanAndParseJson = (str: any): any => {
  if (str === null || str === undefined) return null;
  if (typeof str !== 'string') return str;
  try {
    let cleaned = str.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
    if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();
    }
    const firstOpen = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIndex = -1;
    let lastIndex = -1;
    if (firstOpen !== -1 && (firstBracket === -1 || firstOpen < firstBracket)) {
      startIndex = firstOpen;
      lastIndex = cleaned.lastIndexOf('}');
    } else if (firstBracket !== -1) {
      startIndex = firstBracket;
      lastIndex = cleaned.lastIndexOf(']');
    }
    if (startIndex === -1 || lastIndex === -1 || lastIndex < startIndex) return JSON.parse(cleaned);
    const jsonPart = cleaned.substring(startIndex, lastIndex + 1);
    return JSON.parse(jsonPart);
  } catch (e: any) {
    console.error("JSON Parse Error:", e);
    return str.startsWith('[') ? [] : {};
  }
};

// FIX: Modified to obtain API key exclusively from process.env.API_KEY
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const DEFAULT_MODEL = 'gemini-3-flash-preview';
const COMPLEX_MODEL = 'gemini-3-pro-preview'; 
const IMAGE_MODEL = 'gemini-2.5-flash-image';

export const startAIChat = async (systemInstruction: string) => {
  const ai = getAiClient();
  return ai.chats.create({
    model: DEFAULT_MODEL,
    config: { systemInstruction, temperature: 0.7 },
  });
};

export const analyzeDocuments = async (files: UploadedFile[], prompt: string) => {
  const ai = getAiClient();
  const fileParts = files.map(file => ({
    inlineData: { data: file.base64.split(',')[1], mimeType: file.type }
  }));
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: { parts: [...fileParts, { text: prompt }] },
    config: { systemInstruction: "Pakar Kurikulum SD Indonesia. Analisis dokumen dengan tajam dan solutif." }
  });
  return response.text || "AI tidak merespon.";
};

export const analyzeCPToTP = async (cpContent: string, elemen: string, fase: string, kelas: string) => {
  const ai = getAiClient();
  const prompt = `Analisis Capaian Pembelajaran (CP) untuk Kelas ${kelas} SD. CP: "${cpContent}" Elemen: "${elemen}"`;

  const response = await ai.models.generateContent({
    model: COMPLEX_MODEL,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            materi: { type: Type.STRING },
            subMateri: { type: Type.STRING },
            tp: { type: Type.STRING },
            profilLulusan: { type: Type.STRING }
          },
          required: ['materi', 'subMateri', 'tp', 'profilLulusan'],
          propertyOrdering: ['materi', 'subMateri', 'tp', 'profilLulusan']
        }
      }
    },
    contents: prompt,
  });
  return cleanAndParseJson(response.text);
};

export const completeATPDetails = async (tp: string, materi: string, kelas: string) => {
  const ai = getAiClient();
  const prompt = `Lengkapi rincian ATP SD Kelas ${kelas}. TP: "${tp}" Materi: "${materi}"`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          alurTujuan: { type: Type.STRING },
          alokasiWaktu: { type: Type.STRING },
          dimensiOfProfil: { type: Type.STRING },
          asesmenAwal: { type: Type.STRING },
          asesmenProses: { type: Type.STRING },
          asesmenAkhir: { type: Type.STRING },
          sumberBelajar: { type: Type.STRING }
        },
        required: ['alurTujuan', 'alokasiWaktu', 'dimensiOfProfil', 'asesmenAwal', 'asesmenProses', 'asesmenAkhir', 'sumberBelajar']
      }
    },
    contents: prompt,
  });
  return cleanAndParseJson(response.text);
};

export const recommendPedagogy = async (tp: string, alurAtp: string, materi: string, kelas: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { modelName: { type: Type.STRING }, reason: { type: Type.STRING } },
        required: ['modelName', 'reason']
      }
    },
    contents: `Rekomendasi model pembelajaran untuk TP: "${tp}"`,
  });
  return cleanAndParseJson(response.text);
};

export const generateRPMContent = async (tp: string, materi: string, kelas: string, praktikPedagogis: string, alokasiWaktu: string, jumlahPertemuan: number = 1) => {
  const ai = getAiClient();
  const prompt = `Susun RPM mendalam untuk ${jumlahPertemuan} pertemuan. 
  TP: "${tp}" 
  Materi: "${materi}" 
  Model: ${praktikPedagogis}. 
  
  ATURAN WAJIB FORMAT & KONTEN:
  1. Daftar Langkah: Gunakan daftar bernomor urut ke bawah (1., 2., 3., dst.). Setiap langkah dipisah Baris Baru (Enter).
  2. Integrasi Filosofi: Setiap poin langkah kegiatan HARUS mengintegrasikan minimal salah satu dari elemen: [Menggembirakan], [Berkesadaran], atau [Bermakna].
  3. POSISI TAG: Letakkan tag filosofi tersebut di AKHIR kalimat langkah kegiatan.
  4. Contoh Format: "1. Guru mengajak siswa bernyanyi bersama untuk membangun suasana ceria [Menggembirakan]."
  5. Bagian INTI: Gunakan sub-label: A. MEMAHAMI, B. MENGAPLIKASI, C. MEREFLEKSI.
  6. Pertemuan: Gunakan label "Pertemuan X:" sebagai pemisah antar pertemuan.`;

  const response = await ai.models.generateContent({
    model: COMPLEX_MODEL,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          kemitraan: { type: Type.STRING },
          lingkunganBelajar: { type: Type.STRING },
          pemanfaatanDigital: { type: Type.STRING },
          kegiatanAwal: { type: Type.STRING, description: "Daftar bernomor dengan tag filosofi di akhir kalimat" },
          kegiatanInti: { type: Type.STRING, description: "Daftar bernomor A,B,C dengan tag filosofi di akhir kalimat" },
          kegiatanPenutup: { type: Type.STRING, description: "Daftar bernomor dengan tag filosofi di akhir kalimat" }
        },
        required: ['kemitraan', 'lingkunganBelajar', 'pemanfaatanDigital', 'kegiatanAwal', 'kegiatanInti', 'kegiatanPenutup']
      }
    },
    contents: prompt,
  });
  return cleanAndParseJson(response.text);
};

export const generateJournalNarrative = async (kelas: string, mapel: string, materi: string, refRpm?: any) => {
  const ai = getAiClient();
  const contextPrompt = `Tulis narasi log jurnal harian mengajar Kelas ${kelas}, Mapel ${mapel}, Materi ${materi}.`;
  
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { 
          detail_kegiatan: { type: Type.STRING }, 
          pedagogik: { type: Type.STRING } 
        },
        required: ['detail_kegiatan', 'pedagogik']
      }
    },
    contents: contextPrompt,
  });
  return cleanAndParseJson(response.text);
};

export const generateAssessmentDetails = async (tp: string, materi: string, kelas: string, stepsContext: string) => {
  const ai = getAiClient();
  const prompt = `Berdasarkan Konteks Langkah Pembelajaran berikut: "${stepsContext}", susunlah instrumen asesmen yang sinkron untuk TP: "${tp}".
  
  ATURAN WAJIB:
  1. Anda HARUS menghasilkan minimal satu item untuk masing-masing kategori berikut: "Asesmen Awal", "Asesmen Proses", dan "Asesmen Akhir".
  2. Gunakan label kategori PERSIS seperti aturan nomor 1 (Asesmen Awal, Asesmen Proses, Asesmen Akhir).
  3. Rubrik Detail harus memiliki minimal 3 aspek penilaian.`;

  const response = await ai.models.generateContent({
    model: COMPLEX_MODEL,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            kategori: { type: Type.STRING, description: "Wajib: Asesmen Awal, Asesmen Proses, atau Asesmen Akhir" },
            teknik: { type: Type.STRING },
            bentuk: { type: Type.STRING },
            instruksi: { type: Type.STRING },
            soalAtauTugas: { type: Type.STRING },
            rubrikDetail: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  aspek: { type: Type.STRING },
                  level4: { type: Type.STRING },
                  level3: { type: Type.STRING },
                  level2: { type: Type.STRING },
                  level1: { type: Type.STRING }
                },
                required: ['aspek', 'level4', 'level3', 'level2', 'level1']
              }
            }
          },
          required: ['kategori', 'teknik', 'bentuk', 'instruksi', 'soalAtauTugas', 'rubrikDetail'],
          propertyOrdering: ['kategori', 'teknik', 'bentuk', 'instruksi', 'soalAtauTugas', 'rubrikDetail']
        }
      }
    },
    contents: prompt,
  });
  return cleanAndParseJson(response.text);
};

export const generateLKPDContent = async (rpm: any) => {
  const ai = getAiClient();
  const prompt = `Susun LKPD sinkron RPM. 
  TP: "${rpm.tujuanPembelajaran}" 
  MATERI: "${rpm.materi}"
  
  Gunakan format daftar bernomor vertikal (1., 2., 3.) untuk instruksi tugas agar mudah dibaca siswa.`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          petunjuk: { type: Type.STRING },
          alatBelajar: { type: Type.STRING },
          materiRingkas: { type: Type.STRING },
          langkahKerja: { type: Type.STRING },
          tugasMandiri: { type: Type.STRING },
          refleksi: { type: Type.STRING }
        },
        required: ['petunjuk', 'alatBelajar', 'materiRingkas', 'langkahKerja', 'tugasMandiri', 'refleksi']
      }
    },
    contents: prompt,
  });
  return cleanAndParseJson(response.text);
};

export const generateIndikatorSoal = async (item: any) => {
  const ai = getAiClient();
  const prompt = `Buat 1 baris indikator soal AKM Kelas ${item.kelas} TP: "${item.tujuanPembelajaran}".`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt
  });
  return response.text || "";
};

export const generateButirSoal = async (item: any) => {
  const ai = getAiClient();
  const prompt = `Susun butir soal Kelas ${item.kelas}. Indikator: "${item.indikatorSoal}". Bentuk: ${item.bentukSoal}`;

  const response = await ai.models.generateContent({
    model: COMPLEX_MODEL,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          stimulus: { type: Type.STRING },
          soal: { type: Type.STRING },
          kunci: { type: Type.STRING }
        },
        required: ["soal", "kunci"]
      }
    },
    contents: prompt,
  });
  return cleanAndParseJson(response.text);
};

export const generateAiImage = async (context: string, kelas: Kelas) => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      config: { imageConfig: { aspectRatio: "1:1" } },
      contents: { parts: [{ text: `Flat education clipart SD Kelas ${kelas}: ${context.substring(0, 100)}` }] },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (e) { console.error(e); }
  return null;
};
