
import { GoogleGenAI, Type } from "@google/genai";
import { UploadedFile, Kelas } from "../types";

// Fungsi untuk memberikan jeda waktu dengan jitter (acak) untuk menghindari tabrakan rate limit
const sleep = (ms: number) => {
  const jitter = Math.random() * 1000;
  return new Promise(resolve => setTimeout(resolve, ms + jitter));
};

/**
 * Fungsi pembungkus untuk memanggil AI dengan logika Retry otomatis yang lebih kuat
 */
async function callAiWithRetry(fn: () => Promise<any>, retries = 4, delay = 3000): Promise<any> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = error.message?.toLowerCase() || "";
    const isQuotaError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("rate limit");
    
    if (isQuotaError && retries > 0) {
      console.warn(`Kuota/Rate Limit tercapai. Mencoba ulang dalam ${delay}ms... (${retries} sisa percobaan)`);
      await sleep(delay);
      return callAiWithRetry(fn, retries - 1, delay * 2); // Exponential backoff
    }
    
    // Jika error karena lokasi (403), berikan pesan yang jelas
    if (errorMsg.includes("location") || errorMsg.includes("403")) {
      throw new Error("Layanan AI tidak tersedia di wilayah server ini (Region Block). Gunakan API Key yang sudah diaktivasi Billing.");
    }
    
    throw error;
  }
}

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

const getAiClient = (personalApiKey?: string) => {
  const apiKey = personalApiKey || process.env.API_KEY;
  if (!apiKey || apiKey.length < 10) throw new Error("KUNCI API PERSONAL TIDAK TERDETEKSI. Harap masukkan kunci di profil.");
  return new GoogleGenAI({ apiKey });
};

const MAIN_MODEL = 'gemini-3-flash-preview';
const IMAGE_MODEL = 'gemini-2.5-flash-image';
const DPL_LIST = "Keimanan & Takwa, Kewargaan, Penalaran Kritis, Kreativitas, Kolaborasi, Kemandirian, Kesehatan, Komunikasi";

const safetySettings = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

// FIX: Changed apiKey to optional to support calls using process.env.API_KEY by default
export const startAIChat = async (systemInstruction: string, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  return ai.chats.create({
    model: MAIN_MODEL,
    config: { systemInstruction, temperature: 0.7, safetySettings },
  });
};

// FIX: Changed apiKey to optional to support calls using process.env.API_KEY by default
export const analyzeDocuments = async (files: UploadedFile[], prompt: string, apiKey?: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient(apiKey);
    const fileParts = files.map(file => ({
      inlineData: { data: file.base64.split(',')[1], mimeType: file.type }
    }));
    const response = await ai.models.generateContent({
      model: MAIN_MODEL,
      contents: { parts: [...fileParts, { text: prompt }] },
      config: { safetySettings }
    });
    return response.text || "AI tidak merespon.";
  });
};

// FIX: Changed apiKey to optional to support calls using process.env.API_KEY by default
export const analyzeCPToTP = async (cpContent: string, elemen: string, fase: string, kelas: string, apiKey?: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient(apiKey);
    const prompt = `Analisis CP Kelas ${kelas}. CP: "${cpContent}". Elemen: "${elemen}". Gunakan Dimensi Profil Lulusan (DPL): ${DPL_LIST}. Kembalikan JSON ARRAY.`;

    const response = await ai.models.generateContent({
      model: MAIN_MODEL,
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
              profilLulusan: { type: Type.STRING, description: "Hanya ambil dari DPL: " + DPL_LIST }
            },
            required: ['materi', 'subMateri', 'tp', 'profilLulusan']
          }
        }
      },
      contents: prompt,
    });
    return cleanAndParseJson(response.text);
  });
};

// FIX: Changed apiKey to optional to support calls using process.env.API_KEY by default
export const completeATPDetails = async (tp: string, materi: string, kelas: string, apiKey?: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: MAIN_MODEL,
      config: {
        safetySettings,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            alurTujuan: { type: Type.STRING },
            alokasiWaktu: { type: Type.STRING },
            dimensiOfProfil: { type: Type.STRING, description: "Hanya ambil dari DPL: " + DPL_LIST },
            asesmenAwal: { type: Type.STRING },
            asesmenProses: { type: Type.STRING },
            asesmenAkhir: { type: Type.STRING },
            sumberBelajar: { type: Type.STRING }
          },
          required: ['alurTujuan', 'alokasiWaktu', 'dimensiOfProfil', 'asesmenAwal', 'asesmenProses', 'asesmenAkhir', 'sumberBelajar']
        }
      },
      contents: `Lengkapi ATP: ${tp}, Materi: ${materi}. Sesuaikan Dimensi Profil Lulusan dengan: ${DPL_LIST}`,
    });
    return cleanAndParseJson(response.text);
  });
};

// FIX: Changed apiKey to optional to support calls using process.env.API_KEY by default
export const recommendPedagogy = async (tp: string, alurAtp: string, materi: string, kelas: string, apiKey?: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: MAIN_MODEL,
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
  });
};

// FIX: Changed apiKey to optional to support calls using process.env.API_KEY by default
export const generateRPMContent = async (tp: string, materi: string, kelas: string, praktikPedagogis: string, alokasiWaktu: string, jumlahPertemuan: number = 1, apiKey?: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient(apiKey);
    const prompt = `
      Susun Rencana Pembelajaran Mendalam (RPM) SD Kelas ${kelas}.
      TP: ${tp}
      Materi: ${materi}
      Model: ${praktikPedagogis}
      Jumlah Pertemuan: ${jumlahPertemuan}

      INSTRUKSI FORMAT OUTPUT (WAJIB):
      1. Jika Jumlah Pertemuan > 1, bagi narasi per pertemuan dengan label "Pertemuan 1:", "Pertemuan 2:", dst di baris baru.
      2. Bagian KEGIATAN INTI harus menggunakan Sintak Deep Learning:
         A. MEMAHAMI
         B. MENGAPLIKASI
         C. MEREFLEKSI
      3. SETIAP LANGKAH HARUS DI BARIS BARU (Gunakan newline \\n).
      4. Gunakan penomoran "1. ", "2. ", "3. " untuk butir kegiatan.
      5. JANGAN menuliskan kegiatan dalam satu paragraf panjang. Satu langkah = satu baris baru.
      6. Akhiri setiap butir langkah pada bagian KEGIATAN (Awal, Inti, Penutup) dengan salah satu tag filosofi: [Berkesadaran], [Bermakna], atau [Menggembirakan].
      7. PENTING: Untuk bagian Kemitraan, Lingkungan Belajar, dan Digital, JANGAN GUNAKAN tag filosofi ([Bermakna], dll) sama sekali. Tulis narasi deskriptif saja.
    `;

    const response = await ai.models.generateContent({
      model: MAIN_MODEL,
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
      contents: prompt,
    });
    return cleanAndParseJson(response.text);
  });
};

// FIX: Changed apiKey to optional to support calls using process.env.API_KEY by default
export const generateJournalNarrative = async (kelas: string, mapel: string, materi: string, refRpm: any, apiKey?: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient(apiKey);
    let rpmContext = "";
    if (refRpm) {
      rpmContext = `Kegiatan Inti dari RPM: ${refRpm.kegiatanInti}. Model: ${refRpm.praktikPedagogis}.`;
    }

    const prompt = `
      Buat narasi ringkas untuk Jurnal Harian Mengajar SD.
      Kelas: ${kelas}
      Mata Pelajaran: ${mapel}
      Materi: ${materi}
      ${rpmContext ? `Referensi Kegiatan: ${rpmContext}` : ''}

      INSTRUKSI:
      1. Jika ada referensi Kegiatan Inti, buatlah RANGKUMAN dari kegiatan tersebut menjadi 2-3 kalimat efektif.
      2. Jangan gunakan poin-poin (bullet points).
      3. Jika ada model pembelajaran di referensi, gunakan model tersebut.
    `;

    const response = await ai.models.generateContent({
      model: MAIN_MODEL,
      config: {
        safetySettings,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { 
            detail_kegiatan: { type: Type.STRING, description: "Rangkuman deskriptif pelaksanaan pembelajaran." }, 
            pedagogik: { type: Type.STRING, description: "Model atau strategi yang digunakan." } 
          },
          required: ['detail_kegiatan', 'pedagogik']
        }
      },
      contents: prompt,
    });
    return cleanAndParseJson(response.text);
  });
};

// FIX: Changed apiKey to optional to support calls using process.env.API_KEY by default
export const generateAssessmentDetails = async (tp: string, materi: string, kelas: string, stepsContext: string, jumlahPertemuan: number = 1, apiKey?: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient(apiKey);
    const prompt = `
      Buat Strategi Asesmen Lengkap untuk TP: ${tp}
      Materi: ${materi}
      Konteks Langkah Pembelajaran (${jumlahPertemuan} Pertemuan): ${stepsContext}
      
      INSTRUKSI KATEGORI WAJIB:
      Anda HARUS menghasilkan rincian instrumen untuk 3 kategori berikut secara eksklusif:
      1. "ASESMEN AWAL": Berisi teknik diagnosis kesiapan siswa.
      2. "ASESMEN PROSES": Berisi teknik penilaian formatif selama KBM berlangsung.
      3. "ASESMEN AKHIR": Berisi teknik penilaian sumatif untuk mengukur ketercapaian TP.

      Pastikan setiap objek dalam array hasil memiliki property 'kategori' dengan salah satu dari 3 nilai di atas.
    `;

    const response = await ai.models.generateContent({
      model: MAIN_MODEL,
      config: { 
        safetySettings,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              kategori: { type: Type.STRING, description: "Hanya boleh: ASESMEN AWAL, ASESMEN PROSES, atau ASESMEN AKHIR" },
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
      contents: prompt,
    });
    return cleanAndParseJson(response.text);
  });
};

// FIX: Changed apiKey to optional to support calls using process.env.API_KEY by default
export const generateLKPDContent = async (rpm: any, apiKey?: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: MAIN_MODEL,
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
  });
};

// FIX: Changed apiKey to optional to support calls using process.env.API_KEY by default
export const generateIndikatorSoal = async (item: any, apiKey?: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: MAIN_MODEL,
      config: { safetySettings },
      contents: `Buat indikator soal untuk: ${item.tujuanPembelajaran}`
    });
    return response.text || "";
  });
};

// FIX: Changed apiKey to optional to support calls using process.env.API_KEY by default
export const generateButirSoal = async (item: any, apiKey?: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: MAIN_MODEL,
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
  });
};

// FIX: Changed apiKey to optional to support calls using process.env.API_KEY by default
export const generateAiImage = async (prompt: string, kelas: string, apiKey?: string) => {
  return callAiWithRetry(async () => {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts: [{ text: `Ilustrasi SD Kelas ${kelas}: ${prompt}. Flat vector style.` }] },
      config: { imageConfig: { aspectRatio: "1:1" } },
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return part.inlineData.data;
    }
    return null;
  });
};
