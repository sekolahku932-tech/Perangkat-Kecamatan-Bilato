
import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles as SparklesIcon, X as XIcon, Send as SendIcon, 
  User as UserIcon, Bot as BotIcon, Loader2 as LoaderIcon, 
  Maximize2 as MaxIcon, Minimize2 as MinIcon, AlertCircle as AlertIcon, 
  RefreshCw as RetryIcon, Trash2 as ClearIcon, Key, AlertTriangle
} from 'lucide-react';
import { startAIChat } from '../services/geminiService';
import { User as UserType } from '../types';

interface Message {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

interface AIAssistantProps {
  user: UserType;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: `Halo Bapak/Ibu ${user.name.split(' ')[0]}, ada yang bisa saya bantu hari ini? (Kuota: Personal)` }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInstance = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    if (!user.apiKey) {
      setMessages(prev => [...prev, { role: 'model', text: 'Sistem Terkunci. Silakan masukkan API Key personal Anda.', isError: true }]);
      return;
    }

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      if (!chatInstance.current) {
        chatInstance.current = await startAIChat(user.apiKey, `Anda asisten AI di ${user.school}. Membantu guru: ${user.name}.`);
      }
      const result = await chatInstance.current.sendMessageStream({ message: userMessage });
      let fullText = '';
      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      for await (const chunk of result) {
        fullText += chunk.text;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].text = fullText;
          return newMessages;
        });
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'model', text: 'Error Layanan Personal: ' + e.message, isError: true }]);
      chatInstance.current = null;
    } finally { setIsLoading(false); }
  };

  if (!isOpen) return (<button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-2xl z-[100]"><SparklesIcon size={24} /></button>);

  return (
    <div className={`fixed bottom-6 right-6 w-full max-w-[420px] bg-white rounded-[32px] shadow-2xl border flex flex-col z-[200] transition-all ${isMinimized ? 'h-[72px]' : 'h-[600px]'}`}>
      <div className="p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3"><SparklesIcon size={18} /><h3 className="text-xs font-black uppercase tracking-widest">Asisten Personal</h3></div>
        <div className="flex gap-1"><button onClick={() => setIsMinimized(!isMinimized)}>{isMinimized ? <MaxIcon size={16}/> : <MinIcon size={16}/>}</button><button onClick={() => setIsOpen(false)}><XIcon size={16} /></button></div>
      </div>
      {!isMinimized && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 no-scrollbar">
            {messages.map((m, i) => (<div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`p-4 rounded-2xl text-[11px] max-w-[90%] shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>{m.text || '...'}</div></div>))}
          </div>
          <div className="p-4 bg-white border-t flex gap-2"><input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} className="flex-1 bg-slate-100 rounded-xl px-4 py-3 text-xs" placeholder="Tanya AI..." /><button onClick={handleSendMessage} disabled={isLoading} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg">{isLoading?<LoaderIcon className="animate-spin" size={16}/>:<SendIcon size={16}/>}</button></div>
        </>
      )}
    </div>
  );
};

export default AIAssistant;
