import { Bell, Building2, ChevronDown, Search } from 'lucide-react'
import { kpis } from '../../lib/mockData'
import { fmtM } from '../../lib/utils'

export default function Header({ liveScores }) {
  const drs = liveScores?.drs?.base ?? kpis.drs
  const ev  = liveScores?.enterprise_value?.midpoint ?? null
  return (
    <header className="h-14 border-b border-border bg-card/60 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-40 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors text-xs font-medium text-card-foreground">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="max-w-[140px] truncate">Meridian Consulting Group</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
        <span className="text-xs text-muted-foreground font-medium">{drs}/100 Readiness</span>
        {ev !== null && ev > 0
          ? <span className="text-xs font-semibold text-primary">{fmtM(ev)} EV</span>
          : <span className="text-xs font-semibold text-primary">No EV data</span>
        }
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground w-48">
          <Search className="w-3.5 h-3.5" />
          <span>Search metrics, reports...</span>
        </div>
        <button className="relative p-1.5 rounded-md hover:bg-muted/50">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
            3
          </span>
        </button>
        <div className="flex items-center gap-2 pl-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold">
            U
          </div>
          <div>
            <p className="text-[11px] font-medium text-card-foreground leading-tight">Advisor</p>
            <p className="text-[9px] text-muted-foreground leading-tight">CEPA Advisor</p>
          </div>
        </div>
      </div>
    </header>
  )
}
