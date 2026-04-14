'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const [mode, setMode]         = useState<Mode>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const router                  = useRouter()

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  async function handleEmailAuth() {
    setError(''); setSuccess('')
    if (!email || !password) { setError('Email aur password daalo'); return }
    if (password.length < 6)  { setError('Password kam se kam 6 characters ka hona chahiye'); return }
    setLoading(true)
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      setLoading(false)
      if (error) { setError(error.message); return }
      setSuccess('Confirmation email bheja gaya! Inbox check karo.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) { setError('Email ya password galat hai'); return }
      document.cookie = "vedavoice_ui_auth=1; path=/; max-age=31536000; SameSite=Lax"
      router.push('/settings')
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-primary-container px-6 py-10">
      <div className="w-full max-w-md">

        {/* Glass card */}
        <div className="glass-effect rounded-2xl shadow-2xl p-8 md:p-10 flex flex-col items-center"
          style={{ boxShadow: '0 25px 50px rgba(42,20,180,0.3)' }}>

          {/* Branding */}
          <div className="flex flex-col items-center mb-8">
            <div className="mic-gradient w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ boxShadow: '0 8px 20px rgba(42,20,180,0.3)' }}>
              <span className="material-symbols-outlined text-white text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
            </div>
            <h1 className="font-headline font-extrabold text-3xl tracking-tight text-primary">VedaVoice</h1>
            <p className="text-on-surface-variant font-medium mt-1 text-sm text-center">Payroll & Site Safety, <br/>Managed by Voice & AI Simulation</p>
          </div>

          {/* Mode tabs */}
          <div className="w-full bg-surface-container-low p-1 rounded-full flex mb-8">
            {(['login', 'signup'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess('') }}
                className={`flex-1 py-2.5 rounded-full text-sm font-headline font-bold transition-all
                  ${mode === m
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                {m === 'login' ? 'Login' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Google */}
          <button
            id="google-login-btn"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border
              border-outline-variant py-3.5 px-4 rounded-xl hover:bg-surface-container-low
              transition-colors duration-200 mb-6 disabled:opacity-50"
          >
            {googleLoading ? (
              <span className="text-sm text-on-surface-variant">Redirecting...</span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-19.7 0-1.4-.1-2.2-.4-4.3z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.3 0-9.6-3-11.3-7.4l-6.6 5.1C9.6 39.5 16.3 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.8l6.2 5.2C41 35.4 44 30.1 44 24.3c0-1.4-.1-2.2-.4-4.3z"/>
                </svg>
                <span className="font-label font-bold text-on-surface-variant text-sm">
                  Google ke saath login karein
                </span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="w-full flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-outline-variant opacity-30" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-outline">ya email se</span>
            <div className="flex-1 h-px bg-outline-variant opacity-30" />
          </div>

          {/* Form */}
          <div className="w-full space-y-5">
            <div>
              <label className="text-[11px] font-bold font-label uppercase tracking-wider text-outline block mb-1.5 px-1">
                Email address
              </label>
              <input
                id="email-input"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
                className="w-full bg-surface-container-low rounded-xl py-3.5 px-4
                  text-on-surface placeholder:text-outline/60 outline-none border-none
                  focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5 px-1">
                <label className="text-[11px] font-bold font-label uppercase tracking-wider text-outline">
                  Password
                </label>
                {mode === 'login' && (
                  <button className="text-[11px] font-bold font-label uppercase tracking-wider text-primary">
                    Bhool gaye?
                  </button>
                )}
              </div>
              <input
                id="password-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
                className="w-full bg-surface-container-low rounded-xl py-3.5 px-4
                  text-on-surface placeholder:text-outline/60 outline-none border-none
                  focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
              />
            </div>

            {error   && <p className="text-error text-xs px-1">{error}</p>}
            {success && <p className="text-tertiary text-xs px-1">{success}</p>}

            <button
              id="email-auth-btn"
              onClick={handleEmailAuth}
              disabled={loading}
              className="w-full mic-gradient text-white font-headline font-bold py-4
                rounded-xl disabled:opacity-50 active:scale-95 transition-transform mt-2"
              style={{ boxShadow: '0 8px 20px rgba(42,20,180,0.25)' }}
            >
              {loading
                ? (mode === 'login' ? 'Login ho rahe hain...' : 'Account ban raha hai...')
                : (mode === 'login' ? 'Login Karein' : 'Account Banao')}
            </button>
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-8 flex justify-center gap-8 opacity-40">
          {[
            { icon: 'shield', label: 'Surakshit' },
            { icon: 'bolt',   label: 'Tez'       },
            { icon: 'verified_user', label: 'Bharosemand' },
          ].map(b => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="material-symbols-outlined text-white text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}>{b.icon}</span>
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">{b.label}</span>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}