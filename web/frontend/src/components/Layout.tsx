import { type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Smartphone, Grid3X3, Clock, User } from 'lucide-react'
import { useAppStore } from '@/hooks/useAppStore'
import { cn } from '@/lib/utils'

const tabs = [
  { id: '/', icon: Smartphone, label: 'Studio' },
  { id: '/apps', icon: Grid3X3, label: 'Apps' },
  { id: '/history', icon: Clock, label: 'History' },
  { id: '/profile', icon: User, label: 'You' },
] as const

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const connected = useAppStore((s) => s.connected)
  const buildPhase = useAppStore((s) => s.buildPhase)

  const isBuilding = buildPhase !== 'idle' && buildPhase !== 'done' && buildPhase !== 'failed'

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 h-11 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              connected
                ? isBuilding
                  ? 'bg-accent animate-pulse'
                  : 'bg-success'
                : 'bg-error'
            )}
          />
          <span className="text-xs text-text-secondary font-medium tracking-wide uppercase">
            {isBuilding ? buildPhase : connected ? 'ready' : 'offline'}
          </span>
        </div>
        <span className="text-xs font-mono text-text-tertiary">factory</span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>

      <nav className="shrink-0 border-t border-border flex items-center justify-around h-14 bg-surface pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const active = location.pathname === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1 px-4 transition-colors',
                active ? 'text-white' : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              <tab.icon size={20} strokeWidth={active ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
