import { getStoredToken } from './auth-api'
import type { TradeCardEntry, TradePost } from '../types/trade'

type TradesResponse = {
  trades: TradePost[]
}

type CreateTradeResponse = {
  trade: TradePost
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken()
  const res = await fetch(path, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(8000),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const body = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) {
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
  const data = await apiFetch<CreateTradeResponse>('/api/trades', {
    method: 'POST',
    body: JSON.stringify({ offering: payload.offering, wanting: [], note: payload.note }),
  })
  return data.trade
}

export async function deleteTrade(id: string): Promise<void> {
  await apiFetch(`/api/trades/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
