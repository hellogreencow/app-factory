import { useEffect, useRef, useState } from 'react'
import {
  FileText,
  Terminal,
  Brain,
  RefreshCw,
  Wrench,
  BookOpen,
  Hammer,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useAppStore } from '@/hooks/useAppStore'
import { cn, formatDuration } from '@/lib/utils'
import type { StepKind } from '@/types/events'
import type { AgentAction } from '@/types'

const kindConfig: Record<StepKind, { icon: typeof FileText; color: string; label: string }> = {
  write: { icon: FileText, color: 'text-success', label: 'Write' },
  cmd: { icon: Terminal, color: 'text-accent', label: 'Run' },
  think: { icon: Brain, color: 'text-purple-400', label: 'Think' },
  retry: { icon: RefreshCw, color: 'text-warning', label: 'Retry' },
  repair: { icon: Wrench, color: 'text-orange-400', label: 'Repair' },
  read: { icon: BookOpen, color: 'text-cyan-400', label: 'Read' },
  tool: { icon: Hammer, color: 'text-blue-400', label: 'Tool' },
  info: { icon: Info, color: 'text-text-secondary', label: 'Info' },
}

function ActionRow({ action }: { action: AgentAction }) {
  const [expanded, setExpanded] = useState(false)
  const config = kindConfig[action.kind] || kindConfig.info
  const Icon = config.icon
  const hasDetail = action.file || action.trace

  return (
    <div className="group">
      <button
        onClick={() => hasDetail && setExpanded(!expanded)}
        className={cn(
          'w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors',
          hasDetail && 'hover:bg-surface-raised cursor-pointer',
          !hasDetail && 'cursor-default'
        )}
      >
        <Icon size={13} className={cn('shrink-0 mt-0.5', config.color)} />
        <span className="flex-1 text-xs text-text-secondary leading-relaxed truncate">
          {action.msg}
        </span>
        {hasDetail && (
          expanded
            ? <ChevronDown size={12} className="shrink-0 mt-0.5 text-text-tertiary" />
            : <ChevronRight size={12} className="shrink-0 mt-0.5 text-text-tertiary" />
        )}
      </button>
      {expanded && action.file && (
        <div className="mx-3 mb-2 rounded-lg bg-black border border-border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle">
            <span className="text-[10px] font-mono text-text-tertiary truncate">
              {action.file.path}
            </span>
            <span className="text-[10px] text-text-tertiary shrink-0 ml-2">
              {action.file.lines} lines
            </span>
          </div>
          <pre className="px-3 py-2 text-[11px] font-mono text-text-secondary overflow-x-auto leading-relaxed max-h-48 overflow-y-auto">
            {action.file.preview}
          </pre>
        </div>
      )}
      {expanded && action.trace && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-black border border-border">
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className={action.trace.ok ? 'text-success' : 'text-error'}>
              {action.trace.ok ? 'OK' : 'FAIL'}
            </span>
            <span className="text-text-tertiary">{action.trace.tool}</span>
            {action.trace.path && (
              <span className="text-text-secondary truncate">{action.trace.path}</span>
            )}
            <span className="text-text-tertiary ml-auto">{action.trace.durationMs}ms</span>
          </div>
          {action.trace.result && (
            <pre className="mt-1.5 text-[10px] font-mono text-text-tertiary max-h-24 overflow-y-auto">
              {action.trace.result}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export function AgentPanel() {
  const actions = useAppStore((s) => s.actions)
  const buildPhase = useAppStore((s) => s.buildPhase)
  const buildTimer = useAppStore((s) => s.buildTimer)
  const buildResult = useAppStore((s) => s.buildResult)
  const endRef = useRef<HTMLDivElement>(null)
  const setBuildState = useAppStore((s) => s.setBuildState)

  const isBuilding =
    buildPhase !== 'idle' && buildPhase !== 'done' && buildPhase !== 'failed'

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [actions.length])

  useEffect(() => {
    if (!isBuilding) return
    const iv = setInterval(() => {
      setBuildState({ buildTimer: useAppStore.getState().buildTimer + 1 })
    }, 1000)
    return () => clearInterval(iv)
  }, [isBuilding, setBuildState])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-secondary">Agent</span>
          {isBuilding && (
            <span className="text-[10px] font-mono text-accent">
              {formatDuration(buildTimer)}
            </span>
          )}
        </div>
        {buildResult && (
          <span
            className={cn(
              'text-[10px] font-medium px-2 py-0.5 rounded-full',
              buildResult.ok
                ? 'bg-success/10 text-success'
                : 'bg-error/10 text-error'
            )}
          >
            {buildResult.ok
              ? `${buildResult.screenCount} screens in ${formatDuration(buildResult.duration)}`
              : 'failed'}
          </span>
        )}
        {actions.length > 0 && (
          <span className="text-[10px] text-text-tertiary">{actions.length} steps</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {actions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-text-tertiary">No agent activity yet</p>
          </div>
        ) : (
          <div className="py-1">
            {actions.map((action) => (
              <ActionRow key={action.id} action={action} />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>
    </div>
  )
}
