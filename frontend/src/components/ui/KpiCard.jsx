import { cn } from '../../lib/utils'

export default function KpiCard({ label, value, sublabel, className }) {
  return (
    <div className={cn('bg-card border border-border rounded-lg p-4', className)}>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">{label}</p>
      <p className="text-2xl font-bold text-card-foreground">{value}</p>
      {sublabel && <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p>}
    </div>
  )
}
