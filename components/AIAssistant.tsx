
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
  errorType?: 'AUTH' | 'MODEL' | 'QUOTA' | 'GENERIC' | 'INVALID_KEY';
  rawError?: string;
}

interface AIAssistantProps {
  user: UserType;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: `Halo Bapak/Ibu ${user.name.split(' ')[0]}, ada yang bisa saya bantu?` }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInstance = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const resetChat = () => {
    chatInstance.current = null;
    setMessages([{ role: 'model', text: `Percakapan direset. Saya siap membantu lagi.` }]);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      if (!chatInstance.current) {
        // FIX: Removed passing of individual user API key to startAIChat
        chatInstance.current = await startAIChat(
          `Anda asisten AI ${user.school}. Guru: ${user.name}.`
        );
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
      setMessages(prev => [...prev, { role: 'model', text: 'Error AI: ' + e.message, isError: true, rawError: e.message }]);
      chatInstance.current = null;
    } finally { setIsLoading(false); }
  };

  if (!isOpen) return (
    <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-2xl hover:scale-110 transition-all z-[100] group"><SparklesIcon size={24} /></button>
  );

  return (
    <div className={`fixed bottom-6 right-6 w-full max-w-[420px] bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col z-[200] transition-all ${isMinimized ? 'h-[72px]' : 'h-[600px] max-h-[85vh]'}`}>
      <div className="p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500 rounded-xl"><SparklesIcon size={18} /></div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest leading-none">Asisten AI</h3>
            <p className="text-[8px] text-indigo-300 font-bold uppercase tracking-tighter">Powered by Gemini</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={resetChat} className="p-2 hover:bg-white/10 rounded-lg text-slate-400"><ClearIcon size={16}/></button>
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400">{isMinimized ? <MaxIcon size={16}/> : <MinIcon size={16}/>}</button>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400"><XIcon size={16} /></button>
        </div>
      </div>
      {!isMinimized && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 no-scrollbar">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-4 rounded-2xl text-[11px] max-w-[90%] shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : (m.isError ? 'bg-rose-50 text-rose-700 border border-rose-200 rounded-tl-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100')}`}>
                   {m.text || '...'}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-white border-t">
            <div className="relative flex items-center">
              <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} disabled={isLoading} placeholder={`Tanya asisten AI...`} className="w-full bg-slate-100 rounded-2xl py-4 pl-5 pr-14 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={handleSendMessage} disabled={!input.trim() || isLoading} className="absolute right-2 p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-50"><SendIcon size={16}/></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIAssistant;
