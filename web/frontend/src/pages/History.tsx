import { useEffect, useState } from 'react'
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAppStore } from '@/hooks/useAppStore'
import { cn, timeAgo, formatDuration } from '@/lib/utils'

export function History() {
  const builds = useAppStore((s) => s.builds)
  const setBuilds = useAppStore((s) => s.setBuilds)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.builds.list()
      .then((b) => setBuilds(b))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [setBuilds])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="text-text-tertiary animate-spin" />
      </div>
    )
  }

  if (builds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
        <Clock size={32} className="text-text-tertiary" />
        <p className="text-sm text-text-tertiary text-center">No build history</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto p-4">
      <h2 className="text-sm font-medium text-text-secondary mb-4">Build History</h2>
      <div className="space-y-2">
        {builds.map((build) => (
          <div
            key={build.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border-subtle hover:border-border transition-colors"
          >
            {build.ok ? (
              <CheckCircle size={16} className="text-success shrink-0" />
            ) : (
              <XCircle size={16} className="text-error shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{build.name || build.slug}</p>
              <p className="text-[10px] text-text-tertiary">
                {timeAgo(build.startedAt)}
                {build.duration ? ` -- ${formatDuration(build.duration)}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full',
                build.ok ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
              )}>
                {build.ok ? `${build.screenCount} screens` : 'failed'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
