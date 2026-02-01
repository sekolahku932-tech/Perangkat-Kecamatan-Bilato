
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // FIX: Removed apiKey check and parameter as per guidelines
  const handleSendMessage = async () => {
    if (!input.trim() || isAnalyzing) return;

    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: new Date() };
    setChatHistory(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setIsAnalyzing(true);

    try {
      const response = await analyzeDocuments(files, currentInput);
      const aiMsg: ChatMessage = { role: 'model', content: response, timestamp: new Date() };
      setChatHistory(prev => [...prev, aiMsg]);
    } catch (error: any) {
      const errorMsg: ChatMessage = { role: 'model', content: "Gagal memproses AI menggunakan sistem cloud.", timestamp: new Date() };
      setChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    // Explicitly cast to File[] to resolve type errors in some TS environments
    (Array.from(selectedFiles) as File[]).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFiles(prev => [...prev, { id: Math.random().toString(36), name: file.name, size: file.size, type: file.type, base64: ev.target?.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 font-sans">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-[32px] border">
          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer hover:bg-indigo-50/30 transition-all">
            <ImageIcon size={24} className="mx-auto mb-2 text-slate-400"/>
            <p className="text-[10px] font-black uppercase">Pilih Dokumen</p>
            <input type="file" className="hidden" multiple ref={fileInputRef} onChange={handleFileUpload} />
          </div>
          <div className="mt-8 space-y-2">{files.map(f=>(<div key={f.id} className="flex justify-between p-2 bg-slate-50 rounded-lg text-[9px] font-bold"><span>{f.name}</span><button onClick={()=>setFiles(prev=>prev.filter(x=>x.id!==f.id))}><X size={12}/></button></div>))}</div>
        </div>
      </div>
      <div className="lg:col-span-3">
        <div className="bg-white rounded-[48px] border overflow-hidden flex flex-col h-[650px]">
           <div className="p-6 bg-slate-50 border-b font-black uppercase text-xs">Asisten Dokumen (Sistem Cloud Aktif)</div>
           <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
              {chatHistory.map((msg, i) => (<div key={i} className={`flex ${msg.role==='user'?'justify-end':'justify-start'}`}><div className={`p-5 rounded-3xl text-sm leading-relaxed ${msg.role==='user'?'bg-indigo-600 text-white':'bg-slate-50 border'}`}>{msg.content}</div></div>))}
              <div ref={chatEndRef} />
           </div>
           <div className="p-6 bg-slate-50 border-t flex gap-3"><input type="text" className="flex-1 bg-white border rounded-[2rem] px-6 py-4 text-sm" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSendMessage()} placeholder="Tanyakan dokumen ini..." /><button onClick={handleSendMessage} className="bg-indigo-600 text-white p-4 rounded-full">{isAnalyzing?<Loader2 className="animate-spin"/>:<Send size={20}/>}</button></div>
        </div>
      </div>
    </div>
  );
};

export default DocumentManager;
