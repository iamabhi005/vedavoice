import { ExtractResult } from '@/types'
 
export async function extractFromText(text: string): Promise<ExtractResult> {
  const res = await fetch(`/api/extract?t=${Date.now()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    cache: 'no-store'
  })
 
  if (!res.ok) throw new Error('Extraction failed')
  return res.json()
}