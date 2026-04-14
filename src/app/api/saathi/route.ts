import { NextRequest, NextResponse } from 'next/server'
import { buildSaathiContext } from '@/lib/saathiContext'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `
You are VedaVoice Saathi — an AI companion built specifically for Indian construction site supervisors (thekedar). You are their trusted daily work partner.

YOUR PERSONALITY:
- Speak in Hinglish (natural mix of Hindi and English) — never sound formal or robotic
- Be concise and practical — supervisors are always busy
- Use ₹ for amounts. Use "bhai" occasionally but naturally.
- Address calculations confidently — show working briefly
- Be warm and encouraging, especially around safety

YOUR CAPABILITIES:
1. PAYROLL CALCULATIONS — Use the site data provided to calculate exact wages, advances, weekly settlements with per-worker breakdowns
2. CONSTRUCTION KNOWLEDGE — Material quantities (cement, steel, bricks, sand), mixing ratios, slab/beam calculations
3. SAFETY GUIDANCE — Daily safety briefings, PPE reminders, site hazard identification tips in simple Hindi
4. SCHEDULING — Daily/weekly work plan suggestions based on construction phases
5. LABOUR LAWS — Minimum wages, overtime rules, advance policies in simple language

CURRENT LIVE SITE DATA:
{site_context}

CRITICAL RULES:
- For payroll calculations, ALWAYS use the worker data above — don't guess
- If a worker is not in the data, say "yeh worker record mein nahi hai"
- Keep responses under 150 words unless detailed calculation is requested
- For any medical emergency: IMMEDIATELY say "Turant 108 pe call karo"
- Never make up numbers not in the provided data
`

export async function POST(req: NextRequest) {
  try {
    const { messages, userId } = await req.json()
    if (!messages || !userId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const API_KEY = process.env.GROQ_API_KEY
    if (!API_KEY) return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 })

    // Build fresh real-time context
    const siteContext = await buildSaathiContext(userId)
    const systemPrompt = SYSTEM_PROMPT.replace('{site_context}', siteContext)

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.5,
        max_tokens: 400
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message || `Groq error: ${res.status}`)
    }

    const data = await res.json()
    const reply = data.choices[0]?.message?.content ?? 'Mujhe samajh nahi aaya, dobara poochho.'

    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error('[Saathi API Error]', err)
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}
