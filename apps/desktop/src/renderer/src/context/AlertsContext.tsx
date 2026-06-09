import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { useAuth } from './AuthContext'
import type { ProofQueueItem, ReviewQueueItem, OrderDispute } from '@tcg-admin/types'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AlertCounts {
  proofQueue: number
  reports: number
  reviews: number
  withdrawals: number
  disputes: number
}

const ZERO: AlertCounts = { proofQueue: 0, reports: 0, reviews: 0, withdrawals: 0, disputes: 0 }

interface AlertsContextValue {
  counts: AlertCounts
  lastUpdated: Date | null
}

// ── Context ────────────────────────────────────────────────────────────────────

const AlertsContext = createContext<AlertsContextValue>({ counts: ZERO, lastUpdated: null })

export function useAlerts(): AlertsContextValue {
  return useContext(AlertsContext)
}

// ── Config ─────────────────────────────────────────────────────────────────────

const POLL_MS = 30_000
const NTFY_SERVER = import.meta.env.VITE_NTFY_SERVER || 'https://ntfy.sh'
const NTFY_TOPIC  = import.meta.env.VITE_NTFY_TOPIC  || ''

// ── Notification helpers ───────────────────────────────────────────────────────

async function sendNtfy(title: string, body: string): Promise<void> {
  if (!NTFY_TOPIC) return
  try {
    await fetch(`${NTFY_SERVER}/${encodeURIComponent(NTFY_TOPIC)}`, {
      method: 'POST',
      headers: { Title: title, Priority: 'high', Tags: 'warning,bell' },
      body,
    })
  } catch { /* best-effort */ }
}

function showDesktopNotification(title: string, body: string): void {
  try {
    window.electron?.ipcRenderer?.send('show-notification', { title, body })
  } catch { /* best-effort */ }
}

// ── Count fetcher ──────────────────────────────────────────────────────────────

async function fetchCounts(): Promise<AlertCounts> {
  const [proofRes, withdrawalRes, reportRes, reviewRes, disputeRes] = await Promise.allSettled([
    adminApi.getProofQueue(),
    adminApi.getWithdrawals({ status: 'pending', limit: 1 }),
    adminApi.getReportedUsers({ isCleared: false }),
    adminApi.getReviewQueue({ status: 'pending', limit: 50 }),
    adminApi.getOrderDisputes('open'),
  ])

  const proofQueue = proofRes.status === 'fulfilled'
    ? (proofRes.value as ProofQueueItem[]).filter(p => !p.status || p.status === 'pending').length
    : 0

  const withdrawals = withdrawalRes.status === 'fulfilled'
    ? (withdrawalRes.value as { total: number }).total
    : 0

  const reports = reportRes.status === 'fulfilled'
    ? (reportRes.value as { reports: unknown[] }).reports.length
    : 0

  const reviews = reviewRes.status === 'fulfilled'
    ? (reviewRes.value as ReviewQueueItem[]).filter(r => r.reviewStatus === 'pending').length
    : 0

  const disputes = disputeRes.status === 'fulfilled'
    ? (disputeRes.value as OrderDispute[]).filter(d => d.status === 'open').length
    : 0

  return { proofQueue, withdrawals, reports, reviews, disputes }
}

// ── Diff → human messages ──────────────────────────────────────────────────────

function buildMessages(prev: AlertCounts, next: AlertCounts): string[] {
  const msgs: string[] = []
  const add = (diff: number, singular: string, plural: string) => {
    if (diff > 0) msgs.push(`${diff} new ${diff === 1 ? singular : plural}`)
  }
  add(next.proofQueue - prev.proofQueue, 'proof submission', 'proof submissions')
  add(next.reports    - prev.reports,    'report',           'reports')
  add(next.reviews    - prev.reviews,    'review',           'reviews')
  add(next.withdrawals - prev.withdrawals, 'withdrawal request', 'withdrawal requests')
  add(next.disputes   - prev.disputes,   'order dispute',    'order disputes')
  return msgs
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function AlertsProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const { user } = useAuth()
  const [counts, setCounts]           = useState<AlertCounts>(ZERO)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const prevCounts  = useRef<AlertCounts | null>(null)
  const isFirstPoll = useRef(true)

  const poll = useCallback(async () => {
    if (!user) return
    try {
      const next = await fetchCounts()
      setCounts(next)
      setLastUpdated(new Date())

      if (!isFirstPoll.current && prevCounts.current) {
        const msgs = buildMessages(prevCounts.current, next)
        if (msgs.length > 0) {
          const title = 'TCG Admin — Action Required'
          const body  = msgs.join(', ')
          showDesktopNotification(title, body)
          void sendNtfy(title, body)
        }
      }

      isFirstPoll.current = false
      prevCounts.current  = next
    } catch { /* swallow poll errors — network blip, token expiry, etc. */ }
  }, [user])

  useEffect(() => {
    if (!user) {
      setCounts(ZERO)
      prevCounts.current  = null
      isFirstPoll.current = true
      return
    }
    void poll()
    const timer = setInterval(() => void poll(), POLL_MS)
    return () => clearInterval(timer)
  }, [user, poll])

  return (
    <AlertsContext.Provider value={{ counts, lastUpdated }}>
      {children}
    </AlertsContext.Provider>
  )
}
