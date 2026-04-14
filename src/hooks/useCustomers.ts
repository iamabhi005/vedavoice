'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Customer, Transaction, UnitType } from '@/types'

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading]     = useState(true) 

  useEffect(() => {
    async function fetchCustomers() {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error || !data) { setLoading(false); return }

      // Group transactions by name
      const grouped: Record<string, Transaction[]> = {}
      for (const txn of data) {
        const key = txn.name.toLowerCase().trim()
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(txn)
      }

      // Build customer summaries
      const summaries: Customer[] = Object.entries(grouped).map(([, txns]) => {
        const net_balance = txns
          .filter(t => t.unit !== 'days' && t.unit !== 'day' as Exclude<UnitType, 'days'>)
          .reduce((acc, t) => {
            if (t.action === 'UDHAAR' || t.action === 'ADVANCE' || t.action === 'MATERIAL') {
              return acc - t.amount;
            }
            if (t.action === 'PAYMENT' || t.action === 'RECEIPT') {
              return acc + t.amount;
            }
            return acc;
          }, 0)

        const total_udhaar = txns.filter(t => t.action === 'UDHAAR' || t.action === 'ADVANCE').reduce((s, t) => s + t.amount, 0)
        const total_payment = txns.filter(t => t.action === 'PAYMENT' || t.action === 'RECEIPT').reduce((s, t) => s + t.amount, 0)

        return {
          name:          txns[0].name,
          total_udhaar,
          total_payment,
          net_balance,
          last_txn:      txns[0].created_at,
          txn_count:     txns.length,
        }
      })

      // Sort by highest net balance (most owed first or lowest net balance if logic requires)
      // We sort by magnitude of net balance or just txns.length for now since 
      // contractor owes worker means net_balance is negative.
      // Let's sort by absolute net balance
      summaries.sort((a, b) => Math.abs(b.net_balance) - Math.abs(a.net_balance))
      setCustomers(summaries)
      setLoading(false)
    }

    fetchCustomers()
  }, [])

  return { customers, loading }
}