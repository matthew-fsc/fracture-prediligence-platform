import { X, Zap } from 'lucide-react'

export default function DemoBanner({ onClaim, onDismiss, spotsRemaining }) {
  return (
    <div className="bg-card border-b border-border flex items-center justify-between px-4 py-2 gap-3 flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Zap className="w-3.5 h-3.5 text-warning flex-shrink-0" />
        <p className="text-[12px] text-muted-foreground leading-tight">
          You're viewing a live demo —{' '}
          <span className="text-card-foreground font-medium">
            {spotsRemaining != null ? spotsRemaining : 20} Founding Advisor spots
          </span>{' '}
          available at{' '}
          <span className="text-warning font-semibold">$179/mo</span>
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onClaim}
          className="px-3 py-1 rounded-md text-[11px] font-semibold bg-warning/10 border border-warning/30 text-warning hover:bg-warning/20 transition-colors"
        >
          Request a License
        </button>
        <button
          onClick={onDismiss}
          title="Dismiss"
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-card-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
