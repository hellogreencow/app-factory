import { create } from 'zustand'
import type {
  ChatMessage,
  AgentAction,
  PreviewState,
  BuildPhase,
  User,
  Build,
} from '@/types'
import type { ServerEvent, StepKind } from '@/types/events'

let actionCounter = 0
let msgCounter = 0

interface FileEntry {
  path: string
  lines: number
  preview: string
  isNew: boolean
  ts: number
}

interface AppState {
  user: User | null
  setUser: (u: User | null) => void

  sessionId: string | null
  setSessionId: (id: string) => void

  messages: ChatMessage[]
  addMessage: (role: 'user' | 'assistant', content: string) => string
  updateMessage: (id: string, update: Partial<ChatMessage>) => void
  appendDelta: (delta: string) => void
  streamingMsgId: string | null
  setStreamingMsgId: (id: string | null) => void

  actions: AgentAction[]
  addAction: (msg: string, kind: StepKind, extra?: Partial<AgentAction>) => void
  clearActions: () => void

  files: FileEntry[]
  addFile: (f: Omit<FileEntry, 'ts'>) => void
  clearFiles: () => void
  selectedFile: string | null
  setSelectedFile: (path: string | null) => void

  buildId: string | null
  buildPhase: BuildPhase
  buildIdea: string | null
  buildTimer: number
  setBuildState: (s: Partial<Pick<AppState, 'buildId' | 'buildPhase' | 'buildIdea' | 'buildTimer'>>) => void
  buildResult: { ok: boolean; duration: number; screenCount: number; errors: string[] } | null
  setBuildResult: (r: AppState['buildResult']) => void

  preview: PreviewState
  setPreview: (p: Partial<PreviewState>) => void

  builds: Build[]
  setBuilds: (b: Build[]) => void

  connected: boolean
  setConnected: (c: boolean) => void

  handleEvent: (event: ServerEvent) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  setUser: (u) => set({ user: u }),

  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),

  messages: [],
  streamingMsgId: null,
  setStreamingMsgId: (id) => set({ streamingMsgId: id }),

  addMessage: (role, content) => {
    const id = `msg-${++msgCounter}-${Date.now()}`
    set((s) => ({
      messages: [...s.messages, { id, role, content, ts: Date.now() }],
    }))
    return id
  },

  updateMessage: (id, update) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...update } : m)),
    })),

  appendDelta: (delta) => {
    const { streamingMsgId } = get()
    if (!streamingMsgId) return
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === streamingMsgId
          ? { ...m, content: m.content + delta }
          : m
      ),
    }))
  },

  actions: [],
  addAction: (msg, kind, extra) =>
    set((s) => ({
      actions: [
        ...s.actions,
        {
          id: `act-${++actionCounter}`,
          msg,
          kind,
          ts: Date.now(),
          ...extra,
        },
      ],
    })),
  clearActions: () => set({ actions: [] }),

  files: [],
  addFile: (f) =>
    set((s) => {
      const existing = s.files.findIndex((e) => e.path === f.path)
      const entry = { ...f, ts: Date.now() }
      if (existing >= 0) {
        const updated = [...s.files]
        updated[existing] = entry
        return { files: updated }
      }
      return { files: [...s.files, entry] }
    }),
  clearFiles: () => set({ files: [] }),
  selectedFile: null,
  setSelectedFile: (path) => set({ selectedFile: path }),

  buildId: null,
  buildPhase: 'idle',
  buildIdea: null,
  buildTimer: 0,
  setBuildState: (s) => set(s),
  buildResult: null,
  setBuildResult: (r) => set({ buildResult: r }),

  preview: { active: false },
  setPreview: (p) => set((s) => ({ preview: { ...s.preview, ...p } })),

  builds: [],
  setBuilds: (b) => set({ builds: b }),

  connected: false,
  setConnected: (c) => set({ connected: c }),

  handleEvent: (event: ServerEvent) => {
    const store = get()

    switch (event.type) {
      case 'build:start':
        set({
          buildId: event.id,
          buildPhase: event.phase as BuildPhase,
          buildIdea: event.idea,
          buildTimer: 0,
          buildResult: null,
          actions: [],
          files: [],
        })
        store.addAction(`Building: ${event.idea}`, 'think')
        break

      case 'build:restore':
        set({
          buildId: event.id,
          buildPhase: event.phase as BuildPhase,
          buildIdea: event.idea,
          buildTimer: 0,
          buildResult: null,
        })
        event.logs?.forEach((l) => store.addAction(l.msg, l.kind))
        break

      case 'build:phase':
        set({ buildPhase: event.phase as BuildPhase })
        store.addAction(`Phase: ${event.phase}`, 'info')
        break

      case 'build:step':
        store.addAction(event.msg, event.kind)
        break

      case 'build:trace':
        store.addAction(event.label, 'info')
        break

      case 'build:file':
        store.addFile({
          path: event.path,
          lines: event.lines,
          preview: event.preview,
          isNew: event.isNew,
        })
        store.addAction(`${event.isNew ? 'Created' : 'Updated'}: ${event.path}`, 'write', {
          file: {
            path: event.path,
            lines: event.lines,
            preview: event.preview,
            isNew: event.isNew,
          },
        })
        break

      case 'build:design':
        store.addAction(
          `Design: ${(event.screens as Array<{name?: string}>)?.length || 0} screens`,
          'think'
        )
        break

      case 'build:done':
        set({
          buildPhase: event.ok ? 'done' : 'failed',
          buildResult: {
            ok: event.ok,
            duration: event.duration,
            screenCount: event.screenCount,
            errors: event.errors,
          },
        })
        store.addAction(
          event.ok
            ? `Done in ${Math.round(event.duration)}s -- ${event.screenCount} screens`
            : `Failed: ${event.errors?.[0] || 'unknown error'}`,
          event.ok ? 'info' : 'retry'
        )
        break

      case 'build:aborted':
        set({ buildPhase: 'failed', buildResult: { ok: false, duration: 0, screenCount: 0, errors: ['Aborted'] } })
        store.addAction('Build aborted', 'info')
        break

      case 'edit:start':
        store.addAction(`Editing: ${event.description}`, 'think')
        break

      case 'edit:step':
        store.addAction(event.msg, event.kind)
        break

      case 'edit:trace':
        store.addAction(
          `${event.tool}${event.path ? ` ${event.path}` : ''} (${event.durationMs}ms)`,
          event.ok ? 'tool' : 'retry',
          { trace: { tool: event.tool, path: event.path, ok: event.ok, durationMs: event.durationMs, result: event.result } }
        )
        break

      case 'edit:done':
        store.addAction(
          event.ok ? 'Edit complete' : `Edit failed: ${event.error || 'unknown'}`,
          event.ok ? 'info' : 'retry'
        )
        break

      case 'chat:typing': {
        const id = store.addMessage('assistant', '')
        set({ streamingMsgId: id })
        store.updateMessage(id, { streaming: true })
        break
      }

      case 'chat:delta': {
        const cleaned = event.delta
          .replace(/\[BUILD:[^\]]*\]/g, '')
          .replace(/\[EDIT:[^\]]*\]/g, '')
        store.appendDelta(cleaned)
        break
      }

      case 'chat:done': {
        const { streamingMsgId: sid } = get()
        if (sid) {
          store.updateMessage(sid, { streaming: false })
          set({ streamingMsgId: null })
        }
        break
      }

      case 'preview:starting':
        set({ preview: { active: false, slug: event.slug, loading: true } })
        break

      case 'preview:ready':
        set({
          preview: {
            active: true,
            slug: event.slug,
            url: event.url,
            webUrl: event.webUrl,
            qrDataUrl: event.qrDataUrl,
            loading: false,
          },
        })
        break

      case 'preview:failed':
        set({
          preview: { active: false, slug: event.slug, error: event.error, loading: false },
        })
        break

      case 'preview:stopped':
        set({ preview: { active: false } })
        break

      case 'system:metrics':
        break
    }
  },
}))
