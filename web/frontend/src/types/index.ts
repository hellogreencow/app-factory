export * from './events'

export interface User {
  id: string
  email: string
  name?: string
  tier: 'free' | 'premium' | 'genius'
  credits: number
}

export interface AppRecord {
  id: string
  slug: string
  name: string
  description?: string
  status: string
  screenCount: number
  createdAt: string
  updatedAt?: string
}

export interface Build {
  id: string
  name?: string
  slug: string
  phase: string
  ok: boolean
  startedAt: string
  duration?: number
  screenCount: number
  screenshotCount: number
  errors: string[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
  streaming?: boolean
}

export interface ChatSession {
  sessionId: string
  lastMessage: string
  messageCount: number
  lastActive: string
}

export interface AgentAction {
  id: string
  msg: string
  kind: import('./events').StepKind
  ts: number
  file?: {
    path: string
    lines: number
    preview: string
    isNew: boolean
  }
  trace?: {
    tool: string
    path?: string
    ok: boolean
    durationMs: number
    result?: string
  }
}

export interface PreviewState {
  active: boolean
  slug?: string
  url?: string
  webUrl?: string
  qrDataUrl?: string
  loading?: boolean
  error?: string
}

export type BuildPhase =
  | 'idle'
  | 'scaffold'
  | 'design'
  | 'generate'
  | 'repair'
  | 'taste'
  | 'qa'
  | 'screenshots'
  | 'done'
  | 'failed'
