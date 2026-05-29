export type StepKind =
  | 'write'
  | 'cmd'
  | 'think'
  | 'retry'
  | 'repair'
  | 'info'
  | 'read'
  | 'tool'

export interface BuildStartEvent {
  type: 'build:start'
  id: string
  idea: string
  phase: string
}

export interface BuildPhaseEvent {
  type: 'build:phase'
  id: string
  phase: string
}

export interface BuildStepEvent {
  type: 'build:step'
  id: string
  msg: string
  raw?: string
  kind: StepKind
  ts: number
}

export interface BuildTraceEvent {
  type: 'build:trace'
  id: string
  kind: 'raw'
  label: string
  ts: number
}

export interface BuildFileEvent {
  type: 'build:file'
  id: string
  path: string
  lines: number
  size: number
  preview: string
  isNew: boolean
}

export interface BuildDesignEvent {
  type: 'build:design'
  id: string
  screens: unknown[]
  entities: unknown[]
  style: Record<string, unknown>
}

export interface BuildDoneEvent {
  type: 'build:done'
  id: string
  ok: boolean
  phase: string
  duration: number
  screenCount: number
  screenshotCount: number
  errors: string[]
  slug: string
  genResult?: Record<string, unknown>
}

export interface BuildAbortedEvent {
  type: 'build:aborted'
  id: string
}

export interface BuildRestoreEvent {
  type: 'build:restore'
  id: string
  idea: string
  phase: string
  logs: Array<{ msg: string; kind: StepKind; ts: number }>
}

export interface EditStartEvent {
  type: 'edit:start'
  editId: string
  description: string
  slug: string
}

export interface EditStepEvent {
  type: 'edit:step'
  editId: string
  msg: string
  kind: StepKind
}

export interface EditTraceEvent {
  type: 'edit:trace'
  editId: string
  step: number
  tool: string
  path?: string
  pattern?: string
  ok: boolean
  result?: string
  durationMs: number
}

export interface EditDoneEvent {
  type: 'edit:done'
  editId: string
  ok: boolean
  slug?: string
  error?: string
}

export interface ChatTypingEvent {
  type: 'chat:typing'
  sessionId: string
}

export interface ChatDeltaEvent {
  type: 'chat:delta'
  delta: string
  sessionId: string
}

export interface ChatDoneEvent {
  type: 'chat:done'
  sessionId: string
}

export interface PreviewStartingEvent {
  type: 'preview:starting'
  slug: string
}

export interface PreviewReadyEvent {
  type: 'preview:ready'
  slug: string
  url: string
  webUrl: string
  qrDataUrl: string
}

export interface PreviewFailedEvent {
  type: 'preview:failed'
  slug: string
  error: string
}

export interface PreviewStoppedEvent {
  type: 'preview:stopped'
}

export interface SystemMetricsEvent {
  type: 'system:metrics'
  wsClients: number
  activeBuild: boolean
}

export type ServerEvent =
  | BuildStartEvent
  | BuildPhaseEvent
  | BuildStepEvent
  | BuildTraceEvent
  | BuildFileEvent
  | BuildDesignEvent
  | BuildDoneEvent
  | BuildAbortedEvent
  | BuildRestoreEvent
  | EditStartEvent
  | EditStepEvent
  | EditTraceEvent
  | EditDoneEvent
  | ChatTypingEvent
  | ChatDeltaEvent
  | ChatDoneEvent
  | PreviewStartingEvent
  | PreviewReadyEvent
  | PreviewFailedEvent
  | PreviewStoppedEvent
  | SystemMetricsEvent
