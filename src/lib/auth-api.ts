import type { GameSave } from '../types/game'

const TOKEN_KEY = 'manastack-auth-token'

export type AuthUser = {
  id: string
  email: string
  username: string | null
}

type AuthResponse = {
  token: string
  user: AuthUser
}

type CloudSaveResponse = {
  save: GameSave | null
  updatedAt?: number
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(8000),
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const body = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`)
  }
  return body as T
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export async function signUp(
  email: string,
  username: string,
  password: string,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, username, password }),
  })
}

export async function logIn(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const data = await apiFetch<{ user: AuthUser }>('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data.user
}

export async function fetchCloudSave(
  token: string,
): Promise<{ save: GameSave | null; updatedAt: number }> {
  const data = await apiFetch<CloudSaveResponse>('/api/save', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return { save: data.save, updatedAt: data.updatedAt ?? 0 }
}

export async function uploadCloudSave(token: string, save: GameSave): Promise<void> {
  await apiFetch('/api/save', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ save, updatedAt: save.updatedAt ?? Date.now() }),
  })
}
