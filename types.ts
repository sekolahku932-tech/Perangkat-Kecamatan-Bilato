
export enum Fase {
  A = 'Fase A',
  B = 'Fase B',
  C = 'Fase C'
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  ANALISIS = 'ANALISIS',
  GENERATOR = 'GENERATOR',
  DOKUMEN = 'DOKUMEN'
}

export type Kelas = '1' | '2' | '3' | '4' | '5' | '6';

export type Role = 'admin' | 'guru';

export type TeacherType = 'kelas' | 'mapel';

export interface User {
  id: string;
  username: string;
  password?: string;
  role: Role;
  teacherType: TeacherType;
  name: string;
  nip: string;
  kelas: string;
  school: string;
  mapelDiampu: string[];
  apiKey?: string;
}

export interface Siswa {
  id: string;
  nis: string;
  name: string;
  kelas: Kelas;
  school: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  base64: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

export interface AsesmenNilai {
  id: string;
  userId: string;
  siswaId: string;
  tpId: string;
  nilai: number;
  catatan?: string;
  school: string;
}

export interface AsesmenInstrumen {
  id: string;
  userId: string;
  fase: Fase;
  kelas: Kelas;
  mataPelajaran: string;
  tpId: string;
  tujuanPembelajaran: string;
  rubrik: string;
  school: string;
}

export interface JurnalItem {
  id: string;
  userId: string;
  userName: string;
  tahunPelajaran: string;
  kelas: Kelas;
  school: string;
  tanggal: string;
  mataPelajaran: string;
  materi: string;
  detailKegiatan: string;
  praktikPedagogis: string;
  absenSiswa?: string;
  catatanKejadian?: string;
}

export interface KisiKisiItem {
  id: string;
  userId: string;
  fase: Fase;
  kelas: Kelas;
  semester: '1' | '2';
  mataPelajaran: string;
  namaAsesmen: string;
  elemen: string;
  cp: string;
  kompetensi: 'Pengetahuan dan Pemahaman' | 'Aplikasi' | 'Penalaran';
  tpId: string;
  tujuanPembelajaran: string;
  indikatorSoal: string;
  jenis: 'Tes' | 'Non Tes';
  bentukSoal: string;
  subBentukSoal?: 'Multiple Choice' | 'Benar Salah' | 'Setuju Tidak Setuju' | 'Ya Tidak' | 'Grid';
  stimulus: string;
  stimulusImage?: string; 
  soal: string;
  kunciJawaban: string;
  nomorSoal: number;
  school: string;
}

export interface SchoolSettings {
  schoolName: string;
  address: string;
  principalName: string;
  principalNip: string;
}

export interface AcademicYear {
  id: string;
  year: string;
  isActive: boolean;
}

export interface HariEfektif {
  id: string;
  kelas: Kelas;
  school: string;
  semester: 1 | 2;
  bulan: string;
  jumlahMinggu: number;
  mingguTidakEfektif: number;
  keterangan: string;
}

export interface EventKalender {
  id: string;
  date: string;
  title: string;
  type: 'libur' | 'ujian' | 'kegiatan' | 'penting';
  description?: string;
}

export interface JadwalItem {
  id: string;
  hari: string;
  jamKe: number;
  mapel: string;
  kelas: Kelas;
  school: string;
}

export interface CapaianPembelajaran {
  id: string;
  fase: Fase;
  mataPelajaran: string;
  kode: string;
  elemen: string;
  deskripsi: string;
}

export interface AnalisisCP {
  id: string;
  userId: string;
  cpId: string;
  kodeCP: string;
  fase: Fase;
  kelas: Kelas;
  mataPelajaran: string;
  materi: string;
  subMateri: string;
  tujuanPembelajaran: string;
  profilLulusan: string; 
  indexOrder: number;
  school: string;
}

export interface ATPItem {
  id: string;
  userId: string;
  kodeCP: string; 
  fase: Fase;
  kelas: Kelas;
  mataPelajaran: string;
  elemen: string;
  capaianPembelajaran: string;
  materi: string;
  subMateri: string;
  tujuanPembelajaran: string;
  alurTujuanPembelajaran: string;
  alokasiWaktu: string;
  dimensiProfilLulusan: string;
  asesmenAwal: string;
  asesmenProses: string;
  asesmenAkhir: string;
  sumberBelajar: string;
  indexOrder: number;
  school: string;
}

export interface ProtaItem {
  id: string;
  userId: string;
  atpId?: string; // Menghubungkan ke ATP
  kodeCP: string; 
  fase: Fase;
  kelas: Kelas;
  mataPelajaran: string;
  tujuanPembelajaran: string;
  materiPokok: string;
  subMateri: string;
  jp: string;
  semester: '1' | '2';
  indexOrder: number;
  school: string;
}

export interface PromesItem {
  id: string;
  userId: string;
  atpId?: string; // Menghubungkan ke ATP
  kodeCP: string; 
  fase: Fase;
  kelas: Kelas;
  semester: '1' | '2';
  mataPelajaran: string;
  materiPokok: string;
  subMateri: string;
  tujuanPembelajaran: string;
  alokasiWaktu: string;
  bulanPelaksanaan: string;
  jadwalMingguan: Record<string, number[]>;
  keterangan: string;
  indexOrder?: number;
  school: string;
}

export interface RPMItem {
  id: string;
  userId: string;
  atpId: string;
  fase: Fase;
  kelas: Kelas;
  semester: '1' | '2';
  mataPelajaran: string;
  tujuanPembelajaran: string;
  materi: string;
  subMateri: string;
  alokasiWaktu: string;
  jumlahPertemuan: number;
  asesmenAwal: string;
  dimensiProfil: string[];
  praktikPedagogis: string;
  kemitraan: string;
  environment?: string;
  lingkunganBelajar: string;
  pemanfaatanDigital: string;
  kegiatanAwal: string;
  kegiatanInti: string;
  kegiatanPenutup: string;
  asesmenTeknik: string;
  materiAjar: string;
  school: string;
}

export interface LKPDItem {
  id: string;
  userId: string;
  rpmId: string;
  fase: Fase;
  kelas: Kelas;
  semester: '1' | '2';
  mataPelajaran: string;
  judul: string;
  tujuanPembelajaran: string;
  petunjuk: string;
  alatBahan: string;
  materiRingkas: string;
  langkahKerja: string;
  tugasMandiri: string;
  refleksi: string;
  jumlahPertemuan: number;
  school: string;
}

export const DAFTAR_SEKOLAH = [
  'SD NEGERI 1 BILATO',
  'SD NEGERI 2 BILATO',
  'SD NEGERI 3 BILATO',
  'SD NEGERI 4 BILATO',
  'SD NEGERI 5 BILATO',
  'SD NEGERI 6 BILATO',
  'SD NEGERI 7 BILATO',
  'SD NEGERI 8 BILATO'
];

export const MATA_PELAJARAN = [
  'Pendidikan Agama dan Budi Pekerti',
  'Pendidikan Pancasilan',
  'Bahasa Indonesia',
  'Matematika',
  'IPAS',
  'Seni dan Budaya',
  'PJOK',
  'Bahasa Inggris',
  'Koding dan KA',
  'Mulok',
  'Kokurikuler'
];

export const SEMUA_AKTIVITAS = [
  ...MATA_PELAJARAN,
  'Istirahat',
  'Upacara/Apel'
];

export const DIMENSI_PROFIL = [
  'Keimanan dan Ketakwaan terhadap Tuhan YME',
  'Kewargaan',
  'Penalaran Kritis',
  'Kreativitas',
  'Kolaborasi',
  'Kemandirian',
  'Kesehatan',
  'Komunikasi'
];
