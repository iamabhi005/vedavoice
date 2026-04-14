import { supabase } from '@/lib/supabase'

export async function buildSaathiContext(userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Fetch with user filter (if RLS is eventually strict)
  // BUT if RLS is disabled (as instructed), this will fetch everything correctly.
  const [{ data: workers }, { data: transactions }, { data: attendance }] = await Promise.all([
    supabase.from('workers').select('*').eq('user_id', userId),
    supabase.from('transactions').select('*').eq('user_id', userId)
      .gte('created_at', weekAgo).order('created_at', { ascending: false }),
    supabase.from('attendance').select('*').eq('user_id', userId).gte('date', weekAgo)
  ])

  // Fallback: If ZERO workers found for this ID but there are workers in the table, 
  // it might be a session/sync issue. We warn and try to proceed globally if RLS is off.
  if (!workers || workers.length === 0) {
    const { count } = await supabase.from('workers').select('*', { count: 'exact', head: true });
    if (count && count > 0) {
       console.warn(`[Saathi] No workers for ID ${userId}, but ${count} exist globally. Sync needed!`);
    }
  }

  const w = workers || []
  const t = transactions || []
  const a = attendance || []

  const workerSummaries = w.map(worker => {
    const txns = t.filter(tx => tx.worker_id === worker.id || tx.name === worker.name)
    const att = a.filter(x => x.worker_id === worker.id)

    const advances = txns.filter(tx => tx.action === 'ADVANCE').reduce((s, tx) => s + tx.amount, 0)
    const payments = txns.filter(tx => tx.action === 'PAYMENT').reduce((s, tx) => s + tx.amount, 0)
    const daysWorked = att.reduce((s, x) =>
      s + (x.status === 'present' ? 1 : x.status === 'half' ? 0.5 : 0), 0)
    const wagesEarned = daysWorked * (worker.daily_rate || 0)
    const netDue = wagesEarned - advances - payments

    const todayAtt = a.find(x => x.worker_id === worker.id && x.date === today)

    return [
      `- ${worker.name}${worker.qualifier ? ` (${worker.qualifier})` : ''}:`,
      `  Rate: ₹${worker.daily_rate ?? '?'}/day,`,
      `  Days this week: ${daysWorked},`,
      `  Wages earned: ₹${wagesEarned},`,
      `  Advances taken: ₹${advances},`,
      `  Already paid: ₹${payments},`,
      `  Net wages due: ₹${netDue},`,
      `  Today's status: ${todayAtt?.status ?? 'not marked'}`
    ].join(' ')
  })

  const todayPresent = a
    .filter(x => x.date === today && x.status === 'present')
    .map(x => w.find(wk => wk.id === x.worker_id)?.name ?? 'Unknown')

  const todayHalf = a
    .filter(x => x.date === today && x.status === 'half')
    .map(x => w.find(wk => wk.id === x.worker_id)?.name ?? 'Unknown')

  const totalMaterials = t.filter(tx => tx.action === 'MATERIAL').reduce((s, tx) => s + tx.amount, 0)
  const totalReceipts = t.filter(tx => tx.action === 'RECEIPT').reduce((s, tx) => s + tx.amount, 0)
  const totalAdvances = t.filter(tx => tx.action === 'ADVANCE').reduce((s, tx) => s + tx.amount, 0)
  const totalPayments = t.filter(tx => tx.action === 'PAYMENT').reduce((s, tx) => s + tx.amount, 0)

  return `
=== SITE DATA (Last 7 days) ===
Today's Date: ${today}

WORKERS (${w.length} registered):
${workerSummaries.join('\n')}

TODAY'S ATTENDANCE:
${todayPresent.length > 0 ? `Present: ${todayPresent.join(', ')}` : 'Present: (none marked yet)'}
${todayHalf.length > 0 ? `Half Day: ${todayHalf.join(', ')}` : ''}

WEEKLY FINANCIAL SUMMARY:
Total advances given: ₹${totalAdvances}
Total wages paid out: ₹${totalPayments}
Total materials spent: ₹${totalMaterials}
Total receipts from builder: ₹${totalReceipts}
Net cash flow: ₹${totalReceipts - totalPayments - totalMaterials}

Total transactions this week: ${t.length}
=== END OF SITE DATA ===
`
}
