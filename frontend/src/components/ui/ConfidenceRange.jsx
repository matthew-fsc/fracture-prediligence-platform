/**
 * ConfidenceRange — displays a score with its conservative/optimistic band
 * and an overall confidence level badge.
 *
 * Props
 * -----
 * score          {number}  Base / midpoint score (0–100)
 * range          {object}  { conservative, base, optimistic }  (all numbers 0–100)
 * level          {string}  "HIGH" | "MEDIUM" | "LOW"
 * factors        {string[]} Human-readable factors (shown in full variant only)
 * variant        {string}  "compact" | "full" (default: "compact")
 * className      {string}  Extra Tailwind classes on the root element
 * showFactors    {boolean} Show factors list (default: false; full variant only)
 * label          {string}  Optional label above the score (full variant only)
 */

import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Level config
// ---------------------------------------------------------------------------
const LEVEL_CONFIG = {
  HIGH:   { label: 'High Confidence',   color: 'text-emerald-400', bg: 'bg-emerald-400/15', bar: 'bg-emerald-400' },
  MEDIUM: { label: 'Medium Confidence', color: 'text-amber-400',   bg: 'bg-amber-400/15',   bar: 'bg-amber-400'   },
  LOW:    { label: 'Low Confidence',    color: 'text-red-400',     bg: 'bg-red-400/15',     bar: 'bg-red-400'     },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LevelBadge({ level, className }) {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.MEDIUM
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold',
      cfg.bg, cfg.color, className
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.bar)} />
      {cfg.label}
    </span>
  )
}

/**
 * Horizontal range bar.  The band is drawn as a filled segment between
 * conservative% and optimistic% of the 0–100 scale, with a tick at base.
 */
function RangeBar({ range, level }) {
  const { conservative, base, optimistic } = range
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.MEDIUM
  const left  = `${conservative}%`
  const width = `${Math.max(optimistic - conservative, 1)}%`
  const tick  = `${base}%`

  return (
    <div className="relative w-full h-2 bg-muted rounded-full overflow-visible my-1">
      {/* band */}
      <div
        className={cn('absolute top-0 h-2 rounded-full opacity-50', cfg.bar)}
        style={{ left, width }}
      />
      {/* base tick */}
      <div
        className={cn('absolute top-[-2px] w-0.5 h-3 rounded-full', cfg.bar)}
        style={{ left: tick, transform: 'translateX(-50%)' }}
      />
      {/* scale labels */}
      <div className="absolute -bottom-4 left-0 text-[10px] text-muted-foreground">0</div>
      <div className="absolute -bottom-4 right-0 text-[10px] text-muted-foreground">100</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compact variant — inline score + range + badge
// ---------------------------------------------------------------------------
function Compact({ score, range, level, className }) {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.MEDIUM
  const { conservative, optimistic } = range

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className={cn('text-sm font-bold tabular-nums', cfg.color)}>
        {score}
        <span className="font-normal text-muted-foreground text-xs ml-1">
          [{conservative}–{optimistic}]
        </span>
      </span>
      <LevelBadge level={level} />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Full variant — score, range bar, factors list
// ---------------------------------------------------------------------------
function Full({ score, range, level, factors, showFactors, label, className }) {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.MEDIUM
  const { conservative, base, optimistic } = range
  const bandWidth = optimistic - conservative

  return (
    <div className={cn('space-y-3', className)}>
      {label && (
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      )}

      {/* Score + badge row */}
      <div className="flex items-baseline gap-3">
        <span className={cn('text-3xl font-bold tabular-nums', cfg.color)}>
          {base}
        </span>
        <div className="flex flex-col gap-0.5">
          <LevelBadge level={level} />
          <span className="text-[11px] text-muted-foreground tabular-nums">
            Range: {conservative}–{optimistic}
            {bandWidth > 0 && (
              <span className="ml-1 text-muted-foreground/60">
                (±{Math.round(bandWidth / 2)} pts)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Range bar */}
      <div className="pb-5">
        <RangeBar range={range} level={level} />
      </div>

      {/* Min / base / max labels */}
      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums -mt-1">
        <span>Conservative: {conservative}</span>
        <span>Base: {base}</span>
        <span>Optimistic: {optimistic}</span>
      </div>

      {/* Factors */}
      {showFactors && factors && factors.length > 0 && (
        <ul className="space-y-1 mt-1">
          {factors.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className={cn('mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full', cfg.bar)} />
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------
export default function ConfidenceRange({
  score,
  range,
  level = 'MEDIUM',
  factors = [],
  variant = 'compact',
  showFactors = false,
  label,
  className,
}) {
  // Normalise range — fall back to score for all three if range not provided
  const safeRange = range ?? { conservative: score, base: score, optimistic: score }

  if (variant === 'full') {
    return (
      <Full
        score={score}
        range={safeRange}
        level={level}
        factors={factors}
        showFactors={showFactors}
        label={label}
        className={className}
      />
    )
  }

  return (
    <Compact
      score={score}
      range={safeRange}
      level={level}
      className={className}
    />
  )
}
