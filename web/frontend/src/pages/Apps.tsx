import { useEffect, useState } from 'react'
import { Smartphone, Play, ExternalLink, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAppStore } from '@/hooks/useAppStore'
import { cn, timeAgo } from '@/lib/utils'
import type { Build } from '@/types'

export function Apps() {
  const builds = useAppStore((s) => s.builds)
  const setBuilds = useAppStore((s) => s.setBuilds)
  const [loading, setLoading] = useState(true)
  const [startingPreview, setStartingPreview] = useState<string | null>(null)
  const preview = useAppStore((s) => s.preview)
  const setPreview = useAppStore((s) => s.setPreview)

  useEffect(() => {
    api.builds.list()
      .then((b) => setBuilds(b))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [setBuilds])

  const successfulBuilds = builds.filter((b) => b.ok)

  const handlePreview = async (build: Build) => {
    setStartingPreview(build.id)
    try {
      const res = await api.preview.start(build.slug)
      setPreview({
        active: true,
        slug: build.slug,
        url: res.url,
        webUrl: res.webUrl,
        qrDataUrl: res.qrDataUrl,
      })
    } catch (_e) { /* handled by WS */ }
    setStartingPreview(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="text-text-tertiary animate-spin" />
      </div>
    )
  }

  if (successfulBuilds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
        <Smartphone size={32} className="text-text-tertiary" />
        <p className="text-sm text-text-tertiary text-center">No apps built yet</p>
        <p className="text-xs text-text-tertiary text-center">
          Go to Studio and describe an app to build
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto p-4">
      <h2 className="text-sm font-medium text-text-secondary mb-4">Your Apps</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {successfulBuilds.map((build) => (
          <div
            key={build.id}
            className="rounded-xl border border-border bg-surface-raised p-4 hover:border-border transition-colors group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-white">{build.name || build.slug}</h3>
                <p className="text-[10px] text-text-tertiary mt-0.5">{timeAgo(build.startedAt)}</p>
              </div>
              <span className="text-[10px] text-text-tertiary font-mono">
                {build.screenCount} screens
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePreview(build)}
                disabled={startingPreview === build.id}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  preview.active && preview.slug === build.slug
                    ? 'bg-success/10 text-success'
                    : 'bg-surface-overlay text-text-secondary hover:text-white'
                )}
              >
                {startingPreview === build.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : preview.active && preview.slug === build.slug ? (
                  <ExternalLink size={12} />
                ) : (
                  <Play size={12} />
                )}
                {preview.active && preview.slug === build.slug ? 'Live' : 'Preview'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
