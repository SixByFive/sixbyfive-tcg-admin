import * as Notifications from 'expo-notifications'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { adminApi } from '../lib/api'
import { useAuth } from './AuthContext'
import type { ProofQueueItem, ReviewQueueItem, OrderDispute } from '@tcg-admin/types'

export interface AlertCounts {
  proofQueue: number
  reports: number
  reviews: number
  withdrawals: number
  disputes: number
}

const ZERO: AlertCounts = { proofQueue: 0, reports: 0, reviews: 0, withdrawals: 0, disputes: 0 }

const AlertsContext = createContext<AlertCounts>(ZERO)

export function useAlerts() {
  return useContext(AlertsContext)
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

async function fetchCounts(): Promise<AlertCounts> {
  const [proofRes, withdrawalRes, reportRes, reviewRes, disputeRes] = await Promise.allSettled([
    adminApi.getProofQueue(),
    adminApi.getWithdrawals({ status: 'pending', limit: 1 }),
    adminApi.getReportedUsers({ isCleared: false }),
    adminApi.getReviewQueue({ status: 'pending', limit: 50 }),
    adminApi.getOrderDisputes('open'),
  ])

  return {
    proofQueue:  proofRes.status      === 'fulfilled' ? (proofRes.value as ProofQueueItem[]).filter(p => !p.status || p.status === 'pending').length : 0,
    withdrawals: withdrawalRes.status === 'fulfilled' ? (withdrawalRes.value as { total: number }).total : 0,
    reports:     reportRes.status     === 'fulfilled' ? (reportRes.value as { reports: unknown[] }).reports.length : 0,
    reviews:     reviewRes.status     === 'fulfilled' ? (reviewRes.value as ReviewQueueItem[]).filter(r => r.reviewStatus === 'pending').length : 0,
    disputes:    disputeRes.status    === 'fulfilled' ? (disputeRes.value as OrderDispute[]).filter(d => d.status === 'open').length : 0,
  }
}

function buildMessages(prev: AlertCounts, next: AlertCounts): string[] {
  const msgs: string[] = []
  const add = (diff: number, s: string, p: string) => { if (diff > 0) msgs.push(`${diff} new ${diff === 1 ? s : p}`) }
  add(next.proofQueue  - prev.proofQueue,  'proof submission',  'proof submissions')
  add(next.reports     - prev.reports,     'report',            'reports')
  add(next.reviews     - prev.reviews,     'review',            'reviews')
  add(next.withdrawals - prev.withdrawals, 'withdrawal request','withdrawal requests')
  add(next.disputes    - prev.disputes,    'order dispute',     'order disputes')
  return msgs
}

const POLL_MS = 30_000

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [counts, setCounts] = useState<AlertCounts>(ZERO)
  const prevCounts  = useRef<AlertCounts | null>(null)
  const isFirstPoll = useRef(true)
  const appState    = useRef<AppStateStatus>(AppState.currentState)

  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) {
      setCounts(ZERO)
      prevCounts.current  = null
      isFirstPoll.current = true
      return
    }

    const poll = async () => {
      if (appState.current !== 'active') return
      try {
        const next = await fetchCounts()
        setCounts(next)

        if (!isFirstPoll.current && prevCounts.current) {
          const msgs = buildMessages(prevCounts.current, next)
          if (msgs.length > 0) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'TCG Admin — Action Required',
                body: msgs.join(', '),
                sound: true,
              },
              trigger: null,
            })
          }
        }

        isFirstPoll.current = false
        prevCounts.current  = next
      } catch { /* swallow */ }
    }

    poll()
    const timer = setInterval(poll, POLL_MS)

    const sub = AppState.addEventListener('change', next => {
      appState.current = next
      if (next === 'active') poll()
    })

    return () => {
      clearInterval(timer)
      sub.remove()
    }
  }, [user])

  return <AlertsContext.Provider value={counts}>{children}</AlertsContext.Provider>
}
