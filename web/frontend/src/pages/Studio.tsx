import { useState } from 'react'
import { Activity, FolderTree, MessageSquare } from 'lucide-react'
import { PhonePreview } from '@/components/PhonePreview'
import { ChatInput } from '@/components/ChatInput'
import { ChatMessages } from '@/components/ChatMessages'
import { AgentPanel } from '@/components/AgentPanel'
import { FileExplorer } from '@/components/FileExplorer'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/hooks/useAppStore'

type RightTab = 'chat' | 'agent' | 'files'

export function Studio() {
  const [rightTab, setRightTab] = useState<RightTab>('chat')
  const actions = useAppStore((s) => s.actions)
  const files = useAppStore((s) => s.files)

  const tabs: Array<{ id: RightTab; icon: typeof Activity; label: string; count?: number }> = [
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
    { id: 'agent', icon: Activity, label: 'Agent', count: actions.length || undefined },
    { id: 'files', icon: FolderTree, label: 'Files', count: files.length || undefined },
  ]

  return (
    <div className="flex h-full">
      {/* Left: Phone Preview */}
      <div className="hidden lg:flex w-[380px] shrink-0 items-center justify-center border-r border-border-subtle bg-black">
        <PhonePreview />
      </div>

      {/* Right: Chat / Agent / Files */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab bar */}
        <div className="flex items-center border-b border-border-subtle shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRightTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2',
                rightTab === tab.id
                  ? 'text-white border-white'
                  : 'text-text-tertiary border-transparent hover:text-text-secondary'
              )}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.count != null && (
                <span className="text-[10px] bg-surface-raised text-text-secondary px-1.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}

          {/* Mobile phone toggle */}
          <div className="lg:hidden ml-auto pr-2">
            <MobilePhoneToggle />
          </div>
        </div>

        {/* Panel content */}
        <div className="flex-1 flex flex-col min-h-0">
          {rightTab === 'chat' && (
            <>
              <ChatMessages />
              <ChatInput />
            </>
          )}
          {rightTab === 'agent' && <AgentPanel />}
          {rightTab === 'files' && <FileExplorer />}
        </div>
      </div>
    </div>
  )
}

function MobilePhoneToggle() {
  const [open, setOpen] = useState(false)
  const preview = useAppStore((s) => s.preview)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
          preview.active
            ? 'bg-success/10 text-success'
            : 'bg-surface-raised text-text-tertiary hover:text-white'
        )}
      >
        <svg width="16" height="22" viewBox="0 0 16 22" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="1" width="14" height="20" rx="3" />
          <line x1="6" y1="18" x2="10" y2="18" strokeLinecap="round" />
        </svg>
        {preview.active && (
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-success rounded-full" />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm"
            >
              Close
            </button>
            <PhonePreview />
          </div>
        </div>
      )}
    </>
  )
}
