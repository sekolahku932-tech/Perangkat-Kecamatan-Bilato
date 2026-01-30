
import React from 'react';
import { DAFTAR_SEKOLAH } from '../types';
import { School, ArrowRight, MapPin, Building, ShieldCheck, GraduationCap } from 'lucide-react';

interface SchoolSelectionPageProps {
  onSelect: (school: string) => void;
}

const SchoolSelectionPage: React.FC<SchoolSelectionPageProps> = ({ onSelect }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 md:p-12 font-sans">
      <div className="max-w-7xl w-full">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 animate-in fade-in slide-in-from-top-4">
            <ShieldCheck size={14} /> Portal Kurikulum Terpadu
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-none">
            Kecamatan <span className="text-indigo-600">Bilato</span>
          </h1>
          <p className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
            Selamat datang di ekosistem digital Perangkat Pembelajaran. Pilih sekolah Anda untuk memulai administrasi cerdas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in zoom-in-95 duration-1000">
          {DAFTAR_SEKOLAH.map((school, index) => (
            <button
              key={school}
              onClick={() => onSelect(school)}
              className="group bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-2xl hover:border-indigo-500 transition-all text-left flex flex-col justify-between h-72 relative overflow-hidden active:scale-95"
            >
              <div className="absolute -top-12 -right-12 p-16 bg-slate-50 rounded-full opacity-0 group-hover:opacity-100 transition-all group-hover:bg-indigo-50 group-hover:scale-110">
                <Building size={100} className="text-indigo-100" />
              </div>
              
              <div className="relative z-10">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-8 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 group-hover:rotate-6 group-hover:scale-110">
                  <GraduationCap size={32} />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Satuan Pendidikan</p>
                  <h3 className="text-xl font-black text-slate-900 leading-tight uppercase">
                    {school}
                  </h3>
                </div>
              </div>

              <div className="relative z-10 flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                  <MapPin size={12} /> Bilato, Gorontalo
                </div>
                <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center group-hover:bg-indigo-600 transition-all shadow-lg">
                  <ArrowRight size={20} />
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-20 flex flex-col items-center gap-4 opacity-50">
          <div className="h-px w-24 bg-slate-300"></div>
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">
            Pemerintah Kabupaten Gorontalo
          </p>
        </div>
      </div>
    </div>
  );
};

export default SchoolSelectionPage;
