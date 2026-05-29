import { useAppStore } from '@/hooks/useAppStore'
import { cn } from '@/lib/utils'
import { Loader2, Wifi, WifiOff } from 'lucide-react'

export function PhonePreview() {
  const preview = useAppStore((s) => s.preview)
  const buildPhase = useAppStore((s) => s.buildPhase)

  const isBuilding =
    buildPhase !== 'idle' && buildPhase !== 'done' && buildPhase !== 'failed'

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {isBuilding && (
          <div className="absolute -inset-3 rounded-[52px] border border-accent/30 animate-pulse-ring pointer-events-none" />
        )}

        <div
          className={cn(
            'relative w-[280px] h-[572px] rounded-[44px] border-[3px] overflow-hidden',
            'bg-surface transition-colors duration-500',
            isBuilding
              ? 'border-accent/50'
              : preview.active
                ? 'border-white/20'
                : 'border-border'
          )}
        >
          <div className="absolute top-0 inset-x-0 h-8 bg-black z-10 flex items-center justify-center">
            <div className="w-[90px] h-[22px] bg-black rounded-b-2xl" />
          </div>

          <div className="absolute bottom-0 inset-x-0 h-1 bg-black z-10 flex items-center justify-center pb-1">
            <div className="w-[100px] h-[4px] bg-white/20 rounded-full" />
          </div>

          <div className="absolute inset-0 pt-8 pb-2">
            {preview.active && preview.webUrl ? (
              <iframe
                src={preview.webUrl}
                className="w-full h-full border-0"
                title="App Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            ) : isBuilding ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
                <Loader2 size={28} className="text-accent animate-spin" />
                <span className="text-xs text-text-secondary text-center">
                  Building your app...
                </span>
                <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">
                  {buildPhase}
                </span>
              </div>
            ) : preview.error ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
                <WifiOff size={24} className="text-error" />
                <span className="text-xs text-text-secondary text-center">
                  Preview failed
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
                <Wifi size={24} className="text-text-tertiary" />
                <span className="text-xs text-text-tertiary text-center">
                  Describe an app to get started
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {preview.active && preview.qrDataUrl && (
        <div className="flex flex-col items-center gap-2">
          <img
            src={preview.qrDataUrl}
            alt="Expo QR"
            className="w-24 h-24 rounded-lg"
          />
          <span className="text-[10px] text-text-tertiary">
            Scan with Expo Go
          </span>
        </div>
      )}
    </div>
  )
}
