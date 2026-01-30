
import { GoogleGenAI, Type } from "@google/genai";
import { UploadedFile, Kelas } from "../types";

// Fungsi untuk memberikan jeda waktu (untuk menghindari rate limit)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
  if (!apiKey || apiKey.length < 10) throw new Error("KUNCI API TIDAK VALID. Masukkan API Key di Profil.");
  return new GoogleGenAI({ apiKey });
};

// MENGGUNAKAN MODEL GEMINI 3 (REKOMENDASI TERBARU)
const FLASH_MODEL = 'gemini-3-flash-preview';
const PRO_MODEL = 'gemini-3-pro-preview';
const DPL_LIST = "Keimanan dan Ketakwaan terhadap Tuhan YME, Kewargaan, Penalaran Kritis, Kreativitas, Kolaborasi, Kemandirian, Kesehatan, Komunikasi";

const safetySettings = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

export const startAIChat = async (apiKey: string, systemInstruction: string) => {
  const ai = getAiClient(apiKey);
  return ai.chats.create({
    model: FLASH_MODEL,
    config: { systemInstruction, temperature: 0.7, safetySettings },
  });
};

export const analyzeDocuments = async (apiKey: string, files: UploadedFile[], prompt: string) => {
  try {
    const ai = getAiClient(apiKey);
    const fileParts = files.map(file => ({
      inlineData: { data: file.base64.split(',')[1], mimeType: file.type }
    }));
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: { parts: [...fileParts, { text: prompt }] },
      config: { safetySettings }
    });
    return response.text || "AI tidak merespon.";
  } catch (error: any) {
    throw new Error(error.message || "Gagal menghubungi Gemini.");
  }
};

export const analyzeCPToTP = async (apiKey: string, cpContent: string, elemen: string, fase: string, kelas: string) => {
  try {
    const ai = getAiClient(apiKey);
    const prompt = `Analisis CP Kelas ${kelas}. CP: "${cpContent}". Elemen: "${elemen}". Gunakan DPL: ${DPL_LIST}. Kembalikan JSON ARRAY.`;

    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      config: {
        safetySettings,
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
            required: ['materi', 'subMateri', 'tp', 'profilLulusan']
          }
        }
      },
      contents: prompt,
    });
    return cleanAndParseJson(response.text);
  } catch (error: any) {
    const msg = error.message || "";
    if (msg.includes("429")) throw new Error("Limit Quota Tercapai. Gunakan API Key yang sudah diaktivasi Billing atau tunggu beberapa saat.");
    if (msg.includes("location")) throw new Error("Lokasi Server tidak didukung oleh API Key ini.");
    throw new Error(msg || "Kesalahan teknis Gemini.");
  }
};

export const completeATPDetails = async (apiKey: string, tp: string, materi: string, kelas: string) => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      config: {
        safetySettings,
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
      contents: `Lengkapi ATP: ${tp}, Materi: ${materi}`,
    });
    return cleanAndParseJson(response.text);
  } catch (error: any) { throw new Error("Gagal melengkapi detail ATP."); }
};

export const recommendPedagogy = async (apiKey: string, tp: string, alurAtp: string, materi: string, kelas: string) => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      config: {
        safetySettings,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { modelName: { type: Type.STRING }, reason: { type: Type.STRING } },
          required: ['modelName', 'reason']
        }
      },
      contents: `Rekomendasi model untuk: ${tp}`,
    });
    return cleanAndParseJson(response.text);
  } catch (e) { return null; }
};

export const generateRPMContent = async (apiKey: string, tp: string, materi: string, kelas: string, praktikPedagogis: string, alokasiWaktu: string, jumlahPertemuan: number = 1) => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      config: { 
        safetySettings,
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
      contents: `Susun RPM ${jumlahPertemuan} pertemuan: ${tp}`,
    });
    return cleanAndParseJson(response.text);
  } catch (error: any) { throw new Error("Gagal menyusun narasi RPM."); }
};

export const generateJournalNarrative = async (apiKey: string, kelas: string, mapel: string, materi: string, refRpm?: any) => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      config: {
        safetySettings,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { detail_kegiatan: { type: Type.STRING }, pedagogik: { type: Type.STRING } },
          required: ['detail_kegiatan', 'pedagogik']
        }
      },
      contents: `Buat narasi jurnal: Kelas ${kelas}, ${materi}`,
    });
    return cleanAndParseJson(response.text);
  } catch (e) { return null; }
};

export const generateAssessmentDetails = async (apiKey: string, tp: string, materi: string, kelas: string, stepsContext: string) => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      config: { 
        safetySettings,
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
      contents: `Asesmen untuk: ${tp}`,
    });
    return cleanAndParseJson(response.text);
  } catch (e) { return null; }
};

export const generateLKPDContent = async (apiKey: string, rpm: any) => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      config: { 
        safetySettings,
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
      contents: `LKPD untuk: ${rpm.tujuanPembelajaran}`,
    });
    return cleanAndParseJson(response.text);
  } catch (e) { return null; }
};

export const generateIndikatorSoal = async (apiKey: string, item: any) => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      config: { safetySettings },
      contents: `Buat indikator soal untuk: ${item.tujuanPembelajaran}`
    });
    return response.text || "";
  } catch (e) { return ""; }
};

export const generateButirSoal = async (apiKey: string, item: any) => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      config: {
        safetySettings,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { stimulus: { type: Type.STRING }, soal: { type: Type.STRING }, kunci: { type: Type.STRING } },
          required: ["soal", "kunci"]
        }
      },
      contents: `Buat soal untuk indikator: ${item.indikatorSoal}`,
    });
    return cleanAndParseJson(response.text);
  } catch (e) { return null; }
};

export const generateAiImage = async (apiKey: string, prompt: string, kelas: string) => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `Ilustrasi SD Kelas ${kelas}: ${prompt}. Flat vector style.` }] },
      config: { imageConfig: { aspectRatio: "1:1" } },
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return part.inlineData.data;
    }
    return null;
  } catch (error) { return null; }
};
