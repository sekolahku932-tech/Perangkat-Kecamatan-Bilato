
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

const getAiClient = (apiKey: string) => {
  if (!apiKey || apiKey.length < 10) throw new Error("API Key Personal tidak valid atau belum diisi di Profil.");
  return new GoogleGenAI({ apiKey });
};

// Menggunakan model yang lebih stabil untuk produksi jika Preview bermasalah
const DEFAULT_MODEL = 'gemini-2.0-flash'; 
const COMPLEX_MODEL = 'gemini-2.0-flash'; 
const IMAGE_MODEL = 'gemini-2.5-flash-image';

const DPL_LIST = "Keimanan dan Ketakwaan terhadap Tuhan YME, Kewargaan, Penalaran Kritis, Kreativitas, Kolaborasi, Kemandirian, Kesehatan, Komunikasi";

export const startAIChat = async (apiKey: string, systemInstruction: string) => {
  const ai = getAiClient(apiKey);
  return ai.chats.create({
    model: DEFAULT_MODEL,
    config: { systemInstruction, temperature: 0.7 },
  });
};

export const analyzeDocuments = async (apiKey: string, files: UploadedFile[], prompt: string) => {
  try {
    const ai = getAiClient(apiKey);
    const fileParts = files.map(file => ({
      inlineData: { data: file.base64.split(',')[1], mimeType: file.type }
    }));
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: { parts: [...fileParts, { text: prompt }] },
      config: { systemInstruction: "Pakar Kurikulum SD Indonesia. Analisis dokumen dengan tajam dan solutif." }
    });
    return response.text || "AI tidak memberikan respon.";
  } catch (error: any) {
    throw new Error(error.message || "Gagal menghubungi server Gemini.");
  }
};

export const analyzeCPToTP = async (apiKey: string, cpContent: string, elemen: string, fase: string, kelas: string) => {
  try {
    const ai = getAiClient(apiKey);
    const prompt = `Analisis Capaian Pembelajaran (CP) untuk Kelas ${kelas} SD. 
    CP: "${cpContent}" 
    Elemen: "${elemen}"
    
    TUGAS: Pecah menjadi TP (Tujuan Pembelajaran) dan tentukan Dimensi Profil Lulusan (DPL) yang relevan.
    WAJIB GUNAKAN DPL DARI DAFTAR INI SAJA: ${DPL_LIST}.`;

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
              profilLulusan: { type: Type.STRING, description: `Pilih dari: ${DPL_LIST}` }
            },
            required: ['materi', 'subMateri', 'tp', 'profilLulusan'],
            propertyOrdering: ['materi', 'subMateri', 'tp', 'profilLulusan']
          }
        }
      },
      contents: prompt,
    });
    return cleanAndParseJson(response.text);
  } catch (error: any) {
    throw new Error(error.message || "Kesalahan pada layanan AI Gemini.");
  }
};

export const completeATPDetails = async (apiKey: string, tp: string, materi: string, kelas: string) => {
  try {
    const ai = getAiClient(apiKey);
    const prompt = `Lengkapi rincian ATP SD Kelas ${kelas}. 
    TP: "${tp}" 
    Materi: "${materi}"
    Pada bagian dimensiOfProfil, pilih Dimensi Profil Lulusan (DPL) yang paling sesuai dari daftar: ${DPL_LIST}.`;

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
  } catch (error: any) {
    throw new Error(error.message || "Gagal melengkapi detail ATP.");
  }
};

export const recommendPedagogy = async (apiKey: string, tp: string, alurAtp: string, materi: string, kelas: string) => {
  try {
    const ai = getAiClient(apiKey);
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
  } catch (error: any) { return null; }
};

export const generateRPMContent = async (apiKey: string, tp: string, materi: string, kelas: string, praktikPedagogis: string, alokasiWaktu: string, jumlahPertemuan: number = 1) => {
  try {
    const ai = getAiClient(apiKey);
    const prompt = `Susun RPM mendalam untuk ${jumlahPertemuan} pertemuan. 
    TP: "${tp}" 
    Materi: "${materi}" 
    Model: ${praktikPedagogis}. 
    ATURAN: Berikan output dalam JSON yang rapi.`;

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
            kegiatanAwal: { type: Type.STRING },
            kegiatanInti: { type: Type.STRING },
            kegiatanPenutup: { type: Type.STRING }
          },
          required: ['kemitraan', 'lingkunganBelajar', 'pemanfaatanDigital', 'kegiatanAwal', 'kegiatanInti', 'kegiatanPenutup']
        }
      },
      contents: prompt,
    });
    return cleanAndParseJson(response.text);
  } catch (error: any) {
    throw new Error(error.message || "Gagal menyusun RPM.");
  }
};

export const generateJournalNarrative = async (apiKey: string, kelas: string, mapel: string, materi: string, refRpm?: any) => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { detail_kegiatan: { type: Type.STRING }, pedagogik: { type: Type.STRING } },
          required: ['detail_kegiatan', 'pedagogik']
        }
      },
      contents: `Narasi jurnal harian Kelas ${kelas}, Materi ${materi}`,
    });
    return cleanAndParseJson(response.text);
  } catch (error: any) { return null; }
};

export const generateAssessmentDetails = async (apiKey: string, tp: string, materi: string, kelas: string, stepsContext: string) => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: COMPLEX_MODEL,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              kategori: { type: Type.STRING },
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
            required: ['kategori', 'teknik', 'bentuk', 'instruksi', 'soalAtauTugas', 'rubrikDetail']
          }
        }
      },
      contents: `Susun asesmen untuk TP: ${tp}`,
    });
    return cleanAndParseJson(response.text);
  } catch (error: any) { return null; }
};

export const generateLKPDContent = async (apiKey: string, rpm: any) => {
  try {
    const ai = getAiClient(apiKey);
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
      contents: `LKPD untuk ${rpm.tujuanPembelajaran}`,
    });
    return cleanAndParseJson(response.text);
  } catch (error: any) { return null; }
};

export const generateIndikatorSoal = async (apiKey: string, item: any) => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Indikator soal AKM Kelas ${item.kelas} TP: "${item.tujuanPembelajaran}"`
    });
    return response.text || "";
  } catch (error: any) { return ""; }
};

export const generateButirSoal = async (apiKey: string, item: any) => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: COMPLEX_MODEL,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { stimulus: { type: Type.STRING }, soal: { type: Type.STRING }, kunci: { type: Type.STRING } },
          required: ["soal", "kunci"]
        }
      },
      contents: `Soal AKM: ${item.indikatorSoal}`,
    });
    return cleanAndParseJson(response.text);
  } catch (error: any) { return null; }
};

export const generateAiImage = async (apiKey: string, context: string, kelas: string) => {
  try {
    const ai = getAiClient(apiKey);
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
