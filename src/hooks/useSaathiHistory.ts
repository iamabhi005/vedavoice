'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts: number  // unix timestamp
}

export interface ChatSession {
  id: string
  title: string
  ts: number
  messages: ChatMessage[]
}

const MAX_SESSIONS = 15
const MAX_MESSAGES_PER_SESSION = 30
const MAX_CONTEXT_MESSAGES = 15 // Limit context to recent 15 for better LLM focus

function storageKey(userId: string) {
  return `saathi_sessions_v1_${userId}`
}

export function useSaathiHistory(userId?: string | null) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    if (!userId) return
    try {
      const raw = localStorage.getItem(storageKey(userId))
      if (raw) {
        const parsed: ChatSession[] = JSON.parse(raw)
        setSessions(parsed)
        if (parsed.length > 0) setActiveSessionId(parsed[0].id)
      }
    } catch { /* ignore parse errors */ }
    setLoaded(true)
  }, [userId])

  // Persist to localStorage whenever sessions change
  useEffect(() => {
    if (!userId || !loaded) return
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(sessions.slice(-MAX_SESSIONS)))
    } catch { /* storage full or unavailable */ }
  }, [sessions, userId, loaded])

  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || null
  }, [sessions, activeSessionId])

  const createChat = useCallback(() => {
    const newSession: ChatSession = {
      id: Math.random().toString(36).substring(7),
      title: 'Naya Chat',
      ts: Date.now(),
      messages: []
    }
    setSessions(prev => [newSession, ...prev])
    setActiveSessionId(newSession.id)
    return newSession.id
  }, [])

  const addMessage = useCallback((msg: ChatMessage) => {
    setSessions(prev => {
      let targetId = activeSessionId
      let currentSessions = [...prev]
      
      // If no active session, create one automatically
      if (!targetId) {
        const newSession: ChatSession = {
          id: Math.random().toString(36).substring(7),
          title: msg.content.substring(0, 30),
          ts: Date.now(),
          messages: [msg]
        }
        currentSessions = [newSession, ...currentSessions]
        setActiveSessionId(newSession.id)
        return currentSessions
      }

      return currentSessions.map(s => {
        if (s.id !== targetId) return s
        
        // Auto-title if it's the first user message
        let newTitle = s.title
        if (s.messages.length === 0 && msg.role === 'user') {
          newTitle = msg.content.substring(0, 30) + (msg.content.length > 30 ? '...' : '')
        }

        return {
          ...s,
          title: newTitle,
          messages: [...s.messages, msg].slice(-MAX_MESSAGES_PER_SESSION)
        }
      })
    })
  }, [activeSessionId])

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeSessionId === id) setActiveSessionId(null)
  }, [activeSessionId])

  const clearAll = useCallback(() => {
    setSessions([])
    setActiveSessionId(null)
    if (userId) localStorage.removeItem(storageKey(userId))
  }, [userId])

  const getContextWindow = useCallback(() => {
    if (!activeSession) return []
    return activeSession.messages.slice(-MAX_CONTEXT_MESSAGES).map(m => ({
      role: m.role,
      content: m.content
    }))
  }, [activeSession])

  return { 
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
  }
}
