import React, { useState, useRef } from 'react';
import { UploadedFile, ChatMessage, User } from '../types';
import { 
  FileUp, Trash2, Send, Bot, User as UserIcon, Loader2, 
  FileText, Image as ImageIcon, Sparkles, MessageSquare, 
  X, CheckCircle2, AlertCircle, Cloud, Key
} from 'lucide-react';
import { analyzeDocuments } from '../services/geminiService';

interface DocumentManagerProps {
  user: User;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({ user }) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'warning' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    Array.from(selectedFiles as FileList).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newFile: UploadedFile = {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          size: file.size,
          type: file.type,
          base64: base64,
        };
        setFiles((prev) => [...prev, newFile]);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isAnalyzing) return;
    
    if (!user.apiKey) {
      const errorMsg: ChatMessage = { role: 'model', content: "⚠️ Konfigurasi Diperlukan: Silakan isi API Key Anda di menu Manajemen User agar analisis ini menggunakan kuota personal Anda.", timestamp: new Date() };
      setChatHistory(prev => [...prev, errorMsg]);
      return;
    }

    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: new Date() };
    setChatHistory(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setIsAnalyzing(true);

    try {
      // FIX: Removed individual apiKey argument as it's now handled by process.env in geminiService
      const response = await analyzeDocuments(files, currentInput);
      const aiMsg: ChatMessage = { role: 'model', content: response, timestamp: new Date() };
      setChatHistory(prev => [...prev, aiMsg]);
    } catch (error: any) {
      console.error(error);
      let errMsg = "Maaf, terjadi kesalahan saat menganalisis dokumen.";
      const errorMsg: ChatMessage = { role: 'model', content: errMsg, timestamp: new Date() };
      setChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-1 space-y-6">
        {!user.apiKey && (
          <div className="bg-rose-50 border-2 border-rose-200 p-6 rounded-[2rem] flex items-start gap-4">
            <Key size={24} className="text-rose-600 shrink-0"/>
            <div>
              <p className="text-[10px] font-black text-rose-800 uppercase leading-tight">API Key Belum Diatur</p>
              <p className="text-[8px] text-rose-700 font-bold mt-1 uppercase">Silakan lengkapi di profil agar AI aktif.</p>
            </div>
          </div>
        )}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><FileUp size={20}/></div>
             <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Unggah Bahan</h3>
          </div>
          
          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
               <ImageIcon size={24} className="text-slate-400 group-hover:text-indigo-500"/>
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Klik untuk Memilih</p>
            <p className="text-[8px] text-slate-400 mt-2">PDF, JPG, PNG (Max 5MB)</p>
            <input type="file" className="hidden" multiple ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf" />
          </div>
          
          <div className="mt-8 space-y-3">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">File Terpilih ({files.length})</h4>
            {files.length === 0 ? (
              <div className="py-10 text-center opacity-30">
                 <FileText size={32} className="mx-auto mb-2"/>
                 <p className="text-[10px] italic">Belum ada file</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                {files.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl group">
                    <div className="flex items-center gap-3 overflow-hidden">
                       <div className="p-2 bg-white rounded-lg text-indigo-500 shadow-sm">
                          {file.type.includes('image') ? <ImageIcon size={14}/> : <FileText size={14}/>}
                       </div>
                       <div className="overflow-hidden">
                          <p className="text-[10px] font-bold text-slate-700 truncate">{file.name}</p>
                          <p className="text-[8px] text-slate-400 uppercase font-black">{formatSize(file.size)}</p>
                       </div>
                    </div>
                    <button onClick={() => removeFile(file.id)} className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors"><X size={14}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-3">
        <div className="bg-white rounded-[48px] shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[650px]">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm"><MessageSquare size={18} className="text-indigo-600"/></div>
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Ruang Analisis Kurikulum</h3>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar bg-white">
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-40">
                 <Bot size={64} className="text-slate-300"/>
                 <div className="max-w-xs">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Asisten Dokumen</p>
                    <p className="text-[10px] font-medium leading-relaxed">Tanyakan apapun terkait file yang Anda unggah. AI dapat menganalisis teks, CP, RPP, atau gambar tugas siswa.</p>
                 </div>
              </div>
            ) : (
              chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {msg.role === 'user' ? <UserIcon size={18}/> : <Bot size={18}/>}
                    </div>
                    <div className={`p-5 rounded-3xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100'}`}>
                       <div className="whitespace-pre-wrap">{msg.content}</div>
                       <p className={`text-[8px] mt-3 font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-indigo-300' : 'text-slate-400'}`}>
                         {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </p>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100">
             <div className="relative flex items-center">
                <input 
                  type="text" 
                  className="w-full bg-white border border-slate-200 rounded-[2rem] py-4 pl-6 pr-16 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                  placeholder="Ketik pertanyaan atau instruksi analisis..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  disabled={isAnalyzing}
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isAnalyzing}
                  className="absolute right-2 p-2.5 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
                >
                  {isAnalyzing ? <Loader2 size={18} className="animate-spin"/> : <Send size={18} />}
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentManager;