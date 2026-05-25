import { getStoredToken } from './auth-api'
import type { TradeCardEntry, TradePost } from '../types/trade'

type TradesResponse = {
  trades: TradePost[]
}

type CreateTradeResponse = {
  trade: TradePost
}

function requestSignal(timeoutMs: number, existing?: AbortSignal | null): AbortSignal {
  if (existing) return existing
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken()
  const res = await fetch(path, {
    ...options,
    signal: requestSignal(8000, options.signal),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const body = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(body.error ?? 'Log in again to post a trade.')
    }
    throw new Error(body.error ?? `Request failed (${res.status})`)
  }
  return body as T
}

export async function fetchTrades(query = ''): Promise<TradePost[]> {
  const params = new URLSearchParams()
  if (query.trim()) params.set('q', query.trim())
  const suffix = params.toString() ? `?${params.toString()}` : ''
  const data = await apiFetch<TradesResponse>(`/api/trades${suffix}`)
  return data.trades
}

export async function createTrade(payload: {
  offering: TradeCardEntry[]
  note?: string
}): Promise<TradePost> {
  if (!getStoredToken()) {
    throw new Error('Log in to post a trade.')
  }

  const offering = payload.offering.filter((entry) => entry.name.trim())
  if (offering.length === 0) {
    throw new Error('Select at least one card from your collection.')
  }

  const data = await apiFetch<CreateTradeResponse>('/api/trades', {
    method: 'POST',
    body: JSON.stringify({ offering, wanting: [], note: payload.note }),
  })
  return data.trade
}

export async function deleteTrade(id: string): Promise<void> {
  await apiFetch(`/api/trades/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
