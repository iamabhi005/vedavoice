'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Transaction, ExtractResult } from '@/types'

export function useLedger(userId?: string) {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)

    // ── Initial fetch ────────────────────────────────────────────────────────
    const fetchTransactions = useCallback(async () => {
        if (!userId) {
            setLoading(false)
            return
        }

        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)

        if (!error && data) setTransactions(data)
        setLoading(false)
    }, [userId])

    useEffect(() => {
        fetchTransactions()
    }, [fetchTransactions])

    // ── Realtime subscription ─────────────────────────────────────────────────
    useEffect(() => {
        if (!userId) return

        const channel = supabase
            .channel(`transactions-${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
                (payload) => {
                    setTransactions(prev => [payload.new as Transaction, ...prev])
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [userId])

    // ── Add confirmed transaction to ledger ───────────────────────────────────
    async function addTransaction(result: ExtractResult, transcript: string, worker_id?: string | null) {
        if (!result.name || !result.amount_int) return null

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not logged in')

        const { data, error } = await supabase
            .from('transactions')
            .insert({
                user_id: user.id,
                worker_id: worker_id || null,
                name: result.name,
                qualifier: result.qualifier || null,
                amount: result.amount_int,
                amount_raw: result.amount_raw,
                unit: result.unit ?? 'INR',
                action: result.action,
                confidence: result.confidence,
                transcript,
                notes: result.notes || null,
            })
            .select()
            .single()

        if (error) throw error
        return data as Transaction
    }

    // ── Save every prediction for retraining later ────────────────────────────
    async function savePrediction(
        result: ExtractResult,
        transcript: string,
        confirmed: boolean,
    ) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('predictions').insert({
            user_id: user.id,
            transcript,
            predicted_name: result.name,
            predicted_amount: result.amount_int,
            predicted_action: result.action,
            confidence: result.confidence,
            is_correct: confirmed,
            raw_output: result.raw,
        })
    }


    // ── Summary stats ─────────────────────────────────────────────────────────
    const totalUdhaar = transactions
        .filter(t => t.action === 'UDHAAR' || t.action === 'ADVANCE' || t.action === 'MATERIAL')
        .reduce((sum, t) => sum + t.amount, 0)

    const today = new Date().toDateString()
    const todayMila = transactions
        .filter(t => (t.action === 'PAYMENT' || t.action === 'RECEIPT') && new Date(t.created_at).toDateString() === today)
        .reduce((sum, t) => sum + t.amount, 0)

    const uniqueCustomers = new Set(transactions.map(t => t.name)).size

    return {
        transactions,
        loading,
        addTransaction,
        savePrediction,
        totalUdhaar,
        todayMila,
        uniqueCustomers,
    }
}