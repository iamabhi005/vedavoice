'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSaathiHistory, ChatMessage, ChatSession } from '@/hooks/useSaathiHistory'

const STARTER_PROMPTS = [
  'Is hafte kitna paisa dena hai?',
  'Aaj ka safety briefing kya hona chahiye?',
  '10x15 ka slab — cement kitna chahiye?',
  'Sabse zyada advance kisne liya hai?',
  'Kal ka kaam schedule karo',
  'Minimum wage kya hai construction mein?'
]

export default function SaathiPage() {
  const auth = useAuth()
  const { 
    sessions, 
    activeSession, 
    activeSessionId, 
    setActiveSessionId,
    createChat,
    addMessage, 
    deleteSession,
    clearAll, 
    getContextWindow, 
    loaded 
  } = useSaathiHistory(auth?.id)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages, loading])

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || !auth?.id || loading) return

    const userMsg: ChatMessage = { role: 'user', content: userText, ts: Date.now() }
    addMessage(userMsg)
    setInput('')
    setLoading(true)

    try {
      const contextWindow = getContextWindow()
      const res = await fetch('/api/saathi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: auth.id,
          messages: [...contextWindow, { role: 'user', content: userText }]
        })
      })
      const data = await res.json()
      const reply = data.reply || 'Kuch problem aayi.'
      addMessage({ role: 'assistant', content: reply, ts: Date.now() })
    } catch {
      addMessage({ role: 'assistant', content: '⚠️ Network error. Dobara try karo.', ts: Date.now() })
    } finally {
      setLoading(false)
    }
  }, [auth?.id, loading, addMessage, getContextWindow])

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.lang = 'hi-IN'
    r.interimResults = false
    r.onstart = () => setIsListening(true)
    r.onend = () => setIsListening(false)
    r.onresult = (e: any) => sendMessage(e.results[0][0].transcript)
    r.start()
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateHeader = (ts: number) => {
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toLocaleDateString() === today.toLocaleDateString()) return 'Aaj';
    if (date.toLocaleDateString() === yesterday.toLocaleDateString()) return 'Kal (Yesterday)';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const groupSessionsByDate = () => {
    const groups: Record<string, ChatSession[]> = {
      'Aaj': [],
      'Kal': [],
      'Purana': []
    }
    const today = new Date().toLocaleDateString()
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString()

    sessions.forEach(s => {
      const d = new Date(s.ts).toLocaleDateString()
      if (d === today) groups['Aaj'].push(s)
      else if (d === yesterday) groups['Kal'].push(s)
      else groups['Purana'].push(s)
    })
    return groups
  }

  if (!loaded) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const sessionGroups = groupSessionsByDate()

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      
      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-indigo-950 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col border-r border-white/10`}>
        <div className="p-4 border-b border-white/10">
          <button 
            onClick={() => { createChat(); setSidebarOpen(false); }}
            className="w-full h-11 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 font-medium text-sm"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            Naya Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {Object.entries(sessionGroups).map(([group, sList]) => sList.length > 0 && (
            <div key={group}>
              <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest px-3 mb-2">{group}</h3>
              <div className="space-y-1">
                {sList.map(s => (
                  <div key={s.id} className="group relative">
                    <button
                      onClick={() => { setActiveSessionId(s.id); setSidebarOpen(false); }}
                      className={`w-full p-3 text-left rounded-lg text-sm transition-all flex items-center gap-3 pr-10
                        ${activeSessionId === s.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 font-medium' : 'text-indigo-200 hover:bg-white/5 hover:text-white'}`}
                    >
                      <span className="material-symbols-outlined text-lg opacity-70">chat_bubble</span>
                      <span className="truncate">{s.title}</span>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-1 py-1 text-indigo-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/10 bg-indigo-950/50">
          <button 
            onClick={clearAll}
            className="w-full flex items-center gap-2 text-indigo-400 hover:text-white text-xs px-2 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">delete_forever</span>
            Sab Delete Karein
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full bg-surface relative min-w-0">
        
        {/* Header */}
        <header className="h-16 bg-white border-b border-outline-variant/20 flex items-center justify-between px-4 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-on-surface hover:bg-surface-container rounded-full transition-colors">
              <span className="material-symbols-outlined">menu_open</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-lg leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div>
                <h1 className="text-sm font-headline font-bold text-on-surface leading-tight">Saathi</h1>
                <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Active Context
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Chat window */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-40">
          
          {(activeSession?.messages.length === 0 || !activeSession) && (
            <div className="flex flex-col items-center text-center mt-6 mb-2">
              <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6 shadow-sm border border-indigo-100">
                <span className="material-symbols-outlined text-indigo-600 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <h2 className="font-headline font-bold text-2xl text-on-surface">Namaste, Thekedar Ji! 🙏</h2>
              <p className="text-on-surface-variant text-sm mt-2 max-w-xs leading-relaxed">
                Site planning, calculation ya worker payroll — kuch bhi poocho. Main aapka AI Saathi hun.
              </p>

              <div className="flex flex-wrap gap-2 justify-center mt-10 max-w-lg">
                {STARTER_PROMPTS.map(p => (
                  <button key={p} onClick={() => sendMessage(p)}
                    className="px-4 py-2 bg-white border border-outline-variant/30 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-600 transition-all active:scale-95 shadow-sm">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSession?.messages.map((m, i) => {
            const prevMsg = i > 0 ? activeSession.messages[i - 1] : null
            const showDate = !prevMsg || new Date(m.ts).toLocaleDateString() !== new Date(prevMsg.ts).toLocaleDateString()

            return (
              <div key={i} className="flex flex-col gap-6">
                {showDate && (
                  <div className="flex justify-center my-2">
                    <div className="bg-surface-container-high/40 px-3 py-1 rounded-full border border-outline-variant/10 text-[10px] font-bold text-outline uppercase tracking-[0.2em]">
                      {formatDateHeader(m.ts)}
                    </div>
                  </div>
                )}
                
                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-3`}>
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-indigo-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                    </div>
                  )}
                  <div className="max-w-[85%] sm:max-w-[70%]">
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed
                      ${m.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md'
                        : 'bg-white border border-outline-variant/20 text-on-surface rounded-tl-sm shadow-sm'}`}>
                      {m.content}
                    </div>
                    {m.ts && (
                      <p className={`text-[10px] text-outline mt-1.5 font-medium ${m.role === 'user' ? 'text-right' : 'text-left ml-1'}`}>
                        {formatTime(m.ts)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="flex justify-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-indigo-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div className="bg-white border border-outline-variant/20 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
          <div className="max-w-2xl mx-auto flex gap-2 items-end pointer-events-auto">
            <button onClick={startVoice} disabled={isListening || loading}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all border
                ${isListening ? 'bg-red-500 border-red-400 animate-pulse text-white' : 'bg-surface-container-low border-outline-variant/20 text-indigo-600 hover:bg-indigo-50'}`}>
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
            </button>
            <div className="flex-1 relative">
              <input ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
                placeholder="Kuch bhi poocho..."
                className="w-full bg-white border border-outline-variant/30 rounded-2xl py-4 pl-4 pr-14 text-sm text-on-surface outline-none focus:ring-4 focus:ring-primary/10 placeholder:text-outline/60 shadow-lg" />
              <button 
                onClick={() => sendMessage(input)} 
                disabled={!input.trim() || loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center disabled:opacity-40 active:scale-90 transition-transform shadow-md"
              >
                <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
