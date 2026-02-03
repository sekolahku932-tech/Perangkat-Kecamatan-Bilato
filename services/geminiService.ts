
import { GoogleGenAI, Type } from "@google/genai";
import { UploadedFile } from "../types";

// Jeda waktu untuk retry
const sleep = (ms: number) => {
  const jitter = Math.random() * 1000;
  return new Promise(resolve => setTimeout(resolve, ms + jitter));
};

/**
 * Inisialisasi AI menggunakan API Key eksklusif dari process.env.API_KEY.
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is not defined in the environment.");
  }
  return new GoogleGenAI({ apiKey });
};

async function callAiWithRetry(fn: () => Promise<any>, retries = 3, delay = 2000): Promise<any> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = error.message?.toLowerCase() || "";
    const isQuotaError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("rate limit");
    
    if (isQuotaError && retries > 0) {
      await sleep(delay);
      return callAiWithRetry(fn, retries - 1, delay * 2);
    }
    
    if (errorMsg.includes("location") || errorMsg.includes("403")) {
      throw new Error("Layanan AI tidak tersedia di wilayah ini (Region Block) atau API Key tidak valid.");
    }
    
    throw error;
  }
}

const cleanAndParseJson = (str: any): any => {
  if (!str || typeof str !== 'string') return str;
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
    if (startIndex === -1 || lastIndex === -1) return JSON.parse(cleaned);
    return JSON.parse(cleaned.substring(startIndex, lastIndex + 1));
  } catch (e) {
    console.error("JSON Parse Error:", e);
    return null;
  }
};

const DPL_LIST = "Keimanan & Takwa, Kewargaan, Penalaran Kritis, Kreativitas, Kolaborasi, Kemandirian, Kesehatan, Komunikasi";

// FIX: Removed customApiKey parameter to strictly follow API key guidelines
export const startAIChat = async (systemInstruction: string) => {
  const ai = getAiClient();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { systemInstruction, temperature: 0.7 },
  });
};

// FIX: Removed customApiKey parameter to strictly follow API key guidelines
export const analyzeDocuments = async (files: UploadedFile[], prompt: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient();
    const fileParts = files.map(file => ({
      inlineData: { data: file.base64.split(',')[1], mimeType: file.type }
    }));
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [...fileParts, { text: prompt }] }
    });
    return response.text || "AI tidak merespon.";
  });
};

// FIX: Removed customApiKey parameter to strictly follow API key guidelines
export const analyzeCPToTP = async (cpContent: string, elemen: string, fase: string, kelas: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
            required: ['materi', 'subMateri', 'tp', 'profilLulusan']
          }
        }
      },
      contents: `Analisis CP Kelas ${kelas}: "${cpContent}". Elemen: "${elemen}". Gunakan DPL: ${DPL_LIST}.`,
    });
    return cleanAndParseJson(response.text);
  });
};

// FIX: Removed customApiKey parameter to strictly follow API key guidelines
export const completeATPDetails = async (tp: string, materi: string, kelas: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
      contents: `Lengkapi ATP untuk TP: ${tp}, Materi: ${materi}. DPL wajib dari: ${DPL_LIST}`,
    });
    return cleanAndParseJson(response.text);
  });
};

// FIX: Removed customApiKey parameter to strictly follow API key guidelines
export const generateRPMContent = async (tp: string, materi: string, kelas: string, model: string, alokasi: string, pertemuan: number) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient();
    const prompt = `Buat Rincian RPM Kelas ${kelas}. TP: ${tp}. Model: ${model}. Pertemuan: ${pertemuan}. Gunakan sintak Deep Learning: Memahami, Mengaplikasi, Merefleksi.`;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
  });
};

// FIX: Removed customApiKey parameter to strictly follow API key guidelines
export const generateJournalNarrative = async (kelas: string, mapel: string, materi: string, refRpm?: any) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient();
    let context = "";
    if (refRpm) {
      context = `Berdasarkan Rincian Kegiatan Inti RPM: "${refRpm.kegiatanInti}". Model: ${refRpm.praktikPedagogis}.`;
    }

    const prompt = `Buat 2-3 kalimat narasi Jurnal Harian Mengajar SD. Kelas: ${kelas}, Mapel: ${mapel}, Materi: ${materi}. ${context} JANGAN gunakan poin-poin. Rangkum rincian langkah inti menjadi deskripsi singkat yang bermakna.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
      contents: prompt,
    });
    return cleanAndParseJson(response.text);
  });
};

// FIX: Removed customApiKey parameter to strictly follow API key guidelines
export const generateAssessmentDetails = async (tp: string, materi: string, context: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: { responseMimeType: "application/json" },
      contents: `Buat strategi asesmen (Awal, Proses, Akhir) untuk TP: ${tp}. Konteks langkah: ${context}`,
    });
    return cleanAndParseJson(response.text);
  });
};

// FIX: Removed customApiKey parameter to strictly follow API key guidelines
export const recommendPedagogy = async (tp: string, materi: string, kelas: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: { responseMimeType: "application/json" },
      contents: `Rekomendasi model pembelajaran mendalam untuk TP: ${tp}`,
    });
    return cleanAndParseJson(response.text);
  });
};

// FIX: Removed customApiKey parameter to strictly follow API key guidelines
export const generateLKPDContent = async (rpm: any) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: { responseMimeType: "application/json" },
      contents: `Buat LKPD berdasarkan RPM ini: ${JSON.stringify(rpm)}`,
    });
    return cleanAndParseJson(response.text);
  });
};

// FIX: Removed customApiKey parameter to strictly follow API key guidelines
export const generateIndikatorSoal = async (item: any) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Buat indikator soal untuk TP: ${item.tujuanPembelajaran}`,
    });
    return response.text || "";
  });
};

// FIX: Removed customApiKey parameter to strictly follow API key guidelines
export const generateButirSoal = async (item: any) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: { responseMimeType: "application/json" },
      contents: `Buat soal berdasarkan indikator: ${item.indikatorSoal}`,
    });
    return cleanAndParseJson(response.text);
  });
};

// FIX: Removed customApiKey parameter to strictly follow API key guidelines
export const generateAiImage = async (prompt: string, kelas: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `Ilustrasi SD Kelas ${kelas}: ${prompt}. Flat vector style.` }] },
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return part.inlineData.data;
    }
    return null;
  });
};
