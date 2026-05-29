import type { User, Build } from '@/types'

const BASE = ''

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || res.statusText)
  }
  return res.json()
}

export const api = {
  auth: {
    me: () => request<{ user: User | null }>('/api/auth/me'),
    signup: (email: string, password: string, name?: string) =>
      request<{ user: User }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),
    login: (email: string, password: string) =>
      request<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () =>
      request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  },

  chat: {
    send: (message: string, sessionId?: string) =>
      request<{
        reply: string
        sessionId: string
        buildStarted?: boolean
        buildId?: string
        editStarted?: boolean
      }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
        headers: {
          'Content-Type': 'application/json',
          ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
        },
      }),
  },

  builds: {
    list: () => request<Build[]>('/api/builds'),
    get: (id: string) => request<Build>(`/api/builds/${id}`),
    start: (description: string) =>
      request<{ id: string }>('/api/build', {
        method: 'POST',
        body: JSON.stringify({ description }),
      }),
    abort: (id: string) =>
      request<{ ok: boolean }>(`/api/builds/${id}/abort`, { method: 'POST' }),
    screenshots: (id: string) =>
      request<Array<{ index: number; name: string; url: string }>>(
        `/api/builds/${id}/screenshots`
      ),
  },

  apps: {
    list: () => request<Build[]>('/api/builds').then(builds =>
      builds.filter(b => b.ok)
    ),
  },

  preview: {
    start: (slug: string) =>
      request<{ url: string; webUrl: string; qrDataUrl: string }>(
        '/api/preview/start',
        { method: 'POST', body: JSON.stringify({ slug }) }
      ),
    stop: () =>
      request<{ ok: boolean }>('/api/preview/stop', { method: 'POST' }),
    status: () =>
      request<{
        active: boolean
        slug?: string
        url?: string
        webUrl?: string
        qrDataUrl?: string
      }>('/api/preview/status'),
  },

  session: {
    get: () =>
      request<{ sessionId: string; appSlug: string; editInProgress: boolean }>(
        '/api/session'
      ),
  },
}
