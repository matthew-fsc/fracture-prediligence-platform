import { cn } from '../../lib/utils'

export default function ProgressBar({ value, className, color = 'bg-primary' }) {
  return (
    <div className={cn('w-full bg-muted rounded-full h-1.5', className)}>
      <div
        className={cn('h-1.5 rounded-full transition-all', color)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
