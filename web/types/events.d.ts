export type StepKind = 'write' | 'cmd' | 'think' | 'retry' | 'repair' | 'info' | 'read' | 'tool';

export interface BuildStepEvent {
  type: 'build:step';
  id: string;
  msg: string;
  raw?: string;
  kind: StepKind;
  ts: number;
}

export interface BuildTraceEvent {
  type: 'build:trace';
  id: string;
  kind: 'raw';
  label: string;
  ts: number;
}

export interface EditTraceEvent {
  type: 'edit:trace';
  editId: string;
  step: number;
  tool: string;
  path: string | null;
  pattern: string | null;
  ok: boolean;
  result: string;
  durationMs: number;
}

export interface SystemMetricsEvent {
  type: 'system:metrics';
  wsClients: number;
  queueDepth: number;
  queuedMessages: number;
  sentMessages: number;
  flushes: number;
  lastFlushMs: number;
  fileEvents: number;
  stepEvents: number;
  traceEvents: number;
  activeBuild: boolean;
  activeEdits: number;
  ts: number;
}

