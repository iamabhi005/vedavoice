import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const text = body.text || ""

    console.log("\n[API] 🎙️ Received Voice Text =>", text);

    if (!text) {
      console.log("[API] ❌ No text provided in body.");
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    const API_KEY = process.env.GROQ_API_KEY
    if (!API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not set in environment' }, { status: 500 })
    }

    const SYSTEM_PROMPT = `
You are an entity extractor for a Hindi/Hinglish voice ledger app used by Indian contractors, vendors, and informal workers.
The output MUST be a strict JSON object.

Extract from the user's spoken text:
- name: person's name (string)
- qualifier: any nickname or identifier attached to the name like "Chhota", "UP wala", "Electrician" (string or null). Example: "UP wala Ramesh aaya aaj" -> name: "Ramesh", qualifier: "UP wala".
- amount: total money amount as integer or float (e.g. deduce arithmetic if deductions are mentioned, handle "teen sau" = 300)
- unit: "INR" for money transactions, or "days" for ATTENDANCE log (1 for full day, 0.5 for half day).
- action: One of the following EXACT actions:
  - UDHAAR: gave credit/goods to someone (customer owes you)
  - PAYMENT: paid out wages/settlement to a worker
  - ADVANCE: gave a loan/advance to a worker (to recover later)
  - RECEIPT: received money from builder or client (money came IN to you)
  - MATERIAL: paid for materials — cement, sand, transport, tools
  - ATTENDANCE: marked someone's presence for the day
- notes: exact reason, deductions, partial context, etc (string or null)

Return ONLY valid JSON. No explanation.

Examples:
Input: "Raju ka 300 advance diya lekin 50 khaane mein kaata"
Output: {"name": "Raju", "amount": 250, "unit": "INR", "action": "ADVANCE", "notes": "50 deducted for food"}

Input: "aakshant ko 500 rupaye payment kiye pr 50 uske late hone ke kate"
Output: {"name": "Aakshant", "amount": 450, "unit": "INR", "action": "PAYMENT", "notes": "50 deducted for being late"}

Input: "Seema ne 200 wapas kiya"
Output: {"name": "Seema", "amount": 200, "unit": "INR", "action": "RECEIPT", "notes": "returned money"}

Input: "Ramesh poora din aaya"
Output: {"name": "Ramesh", "amount": 1, "unit": "days", "action": "ATTENDANCE", "notes": "Full day"}

Input: "Raja aaj half day aaya"
Output: {"name": "Raja", "amount": 0.5, "unit": "days", "action": "ATTENDANCE", "notes": "Half day"}
`

    let resultText = "";
    let retries = 3;

    while (retries > 0) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile", // Llama 3.3 70B runs on Groq LPUs extremely fast
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: text }
            ],
            response_format: { type: "json_object" }, // Guarantees JSON output natively
            temperature: 0
          })
        })

        if (!groqRes.ok) {
           const errData = await groqRes.json().catch(() => null);
           throw new Error(errData?.error?.message || `Groq API Error: ${groqRes.status}`);
        }

        const data = await groqRes.json();
        resultText = data.choices[0].message.content;
        break;
      } catch (err: any) {
        if (retries > 1) {
          console.log(`[API] ⚠️ Groq API issue. Retrying in 1.5s... (${retries - 1} left)`, err.message);
          await new Promise(r => setTimeout(r, 1500));
          retries--;
        } else {
          throw err;
        }
      }
    }

    if (!resultText) {
       return NextResponse.json({ error: 'Failed to extract entities' }, { status: 500 })
    }

    const parsed = JSON.parse(resultText)
    
    console.log("[API] ✨ Groq Output Parse Success =>", parsed);

    // Map the output to match our ExtractResult type
    const mappedToFrontend = {
      name: parsed.name ?? null,
      qualifier: parsed.qualifier ?? null,
      amount_int: parsed.amount ?? null,
      amount_raw: null,
      unit: parsed.unit ?? 'INR',
      action: parsed.action ?? 'UNKNOWN',
      notes: parsed.notes ?? null,
      confidence: 0.99, // Llama3 doesn't return probabilities in standard JSON mode
      raw: [parsed]
    }

    return NextResponse.json(mappedToFrontend)
  } catch (error: any) {
    console.error("Extraction error:", error)
    return NextResponse.json({ error: 'Backend error' }, { status: 502 })
  }
}