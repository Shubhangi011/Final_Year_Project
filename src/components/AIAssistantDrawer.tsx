import React, { useState } from 'react';
import { MessageSquareText, Send, X } from 'lucide-react';
import { api, extractErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

export function AIAssistantDrawer() {
  const { user, language } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Array<{ sender: 'user' | 'assistant'; text: string; suggestions?: string[] }>>([
    {
      sender: 'assistant',
      text:
        language === 'mr'
          ? 'नमस्कार! मी कौशलसेतू एआय मार्गदर्शक आहे. प्रोफाईल सुधारणा, प्रतिष्ठा स्कोर, कौशल्य चाचणी किंवा कामाच्या संधींबद्दल विचारा.'
          : language === 'hi'
          ? 'नमस्ते! मैं कौशलसेतु एआई सहायक हूँ। प्रोफ़ाइल सुधारने, प्रतिष्ठा स्कोर, कौशल परीक्षा या काम के अवसरों के बारे में पूछें।'
          : 'Namaste! I am your KaushalSetu Career & Hiring Assistant. Ask me how to improve your profile, understand your reputation score, identify missing trade skills, or draft a job requirement.',
      suggestions: [
        'How is my reputation score calculated?',
        'Which skills increase my daily wage?',
        'How does Fair Opportunity Mode work?',
      ],
    },
  ]);

  if (!user) return null;

  const handleSend = async (customPrompt?: string) => {
    const msg = (customPrompt ?? input).trim();
    if (!msg || busy) return;
    setInput('');
    setHistory((prev) => [...prev, { sender: 'user', text: msg }]);
    setBusy(true);
    try {
      const { data } = await api.post('/ai/assistant', { message: msg, language });
      setHistory((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: data.reply,
          suggestions: data.suggestions,
        },
      ]);
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        { sender: 'assistant', text: extractErrorMessage(err) },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 left-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium shadow-md transition-colors cursor-pointer"
        >
          <MessageSquareText className="w-4 h-4" />
          <span>KaushalSetu Guide</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 left-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)] bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-navy-900 text-white">
            <div>
              <div className="text-sm font-semibold">KaushalSetu Guidance Assistant</div>
              <div className="text-xs text-slate-300">Multilingual Career & Hiring Coach</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close Assistant"
              className="p-1 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 h-72 overflow-y-auto bg-slate-50 text-sm">
            {history.map((item, idx) => (
              <div key={idx} className={item.sender === 'user' ? 'text-right' : 'text-left'}>
                <div
                  className={`inline-block px-3.5 py-2.5 rounded-lg max-w-[90%] text-left leading-relaxed ${
                    item.sender === 'user'
                      ? 'bg-navy-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-800'
                  }`}
                >
                  {item.text}
                </div>
                {item.suggestions && item.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSend(s)}
                        className="text-xs px-2.5 py-1 rounded bg-slate-200/80 hover:bg-slate-300 text-slate-800 transition-colors cursor-pointer"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="text-xs text-slate-500">Analyzing platform context...</div>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 p-3 bg-white border-t border-slate-200"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask in English, मराठी, or हिंदी..."
              className="flex-1 text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
            <button
              type="submit"
              disabled={busy}
              aria-label="Send message"
              className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
