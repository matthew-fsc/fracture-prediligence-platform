import { cn } from '../../lib/utils'

const variants = {
  critical: 'bg-destructive/20 text-destructive',
  high:     'bg-warning/20 text-warning',
  medium:   'bg-muted text-muted-foreground',
  watch:    'bg-warning/20 text-warning',
  adequate: 'bg-primary/20 text-primary',
  strong:   'bg-primary/20 text-primary',
  complete: 'bg-primary/20 text-primary',
}

export default function StatusBadge({ variant = 'medium', children, className }) {
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize', variants[variant] ?? variants.medium, className)}>
      {children}
    </span>
  )
}
