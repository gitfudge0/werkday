import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  change?: {
    value: number
    label: string
  }
  icon?: React.ReactNode
  chart?: React.ReactNode
  className?: string
  variant?: 'default' | 'compact'
}

export function StatCard({
  title,
  value,
  subtitle,
  change,
  icon,
  chart,
  className,
  variant = 'default',
}: StatCardProps) {
  const isPositive = change?.value && change.value >= 0

  // Compact variant has a different, more condensed layout
  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all duration-300 card-glow-hover min-w-0',
          className
        )}
      >
        {/* Header row with icon and view all */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {icon}
              </span>
            )}
            <span className="text-sm font-medium text-foreground truncate">{title}</span>
          </div>
          <button className="flex-shrink-0 ml-2 text-muted-foreground hover:text-primary">
            <ExternalLink size={14} />
          </button>
        </div>

        {/* Value - large and prominent */}
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </p>

        {/* Change indicator - stacked for compact layout */}
        {change && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              className={cn(
                'flex items-center gap-1 text-sm font-medium whitespace-nowrap',
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {isPositive ? (
                <TrendingUp size={12} />
              ) : (
                <TrendingDown size={12} />
              )}
              {isPositive && '+'}
              {change.value}%
            </span>
            <span className="text-xs text-muted-foreground">{change.label}</span>
          </div>
        )}

        {/* Subtle gradient overlay on hover */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>
    )
  }

  // Default variant
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-300 card-glow-hover',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </span>
          )}
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
          <span>View all</span>
          <ExternalLink size={12} />
        </button>
      </div>

      {/* Value */}
      <div className="mt-4">
        <p className="text-3xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {/* Chart area */}
      {chart && <div className="mt-4">{chart}</div>}

      {/* Change indicator */}
      {change && (
        <div className="mt-4 flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1 text-sm font-medium',
              isPositive ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {isPositive ? (
              <TrendingUp size={14} />
            ) : (
              <TrendingDown size={14} />
            )}
            {isPositive && '+'}
            {change.value}%
          </span>
          <span className="text-sm text-muted-foreground">{change.label}</span>
        </div>
      )}

      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </div>
  )
}

interface MiniBarChartProps {
  data: number[]
  color?: string
}

export function MiniBarChart({ data, color = 'bg-primary' }: MiniBarChartProps) {
  const max = Math.max(...data)
  
  return (
    <div className="flex h-16 items-end gap-1">
      {data.map((value, index) => (
        <div
          key={index}
          className={cn('flex-1 rounded-t transition-all duration-300', color)}
          style={{
            height: `${(value / max) * 100}%`,
            opacity: 0.4 + (value / max) * 0.6,
          }}
        />
      ))}
    </div>
  )
}

interface DonutChartProps {
  segments: { value: number; color: string; label?: string }[]
  centerValue?: string
  centerLabel?: string
}

export function DonutChart({ segments, centerValue, centerLabel }: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  let currentAngle = 0

  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
        {segments.map((segment, index) => {
          const percentage = segment.value / total
          const angle = percentage * 360
          const startAngle = currentAngle
          currentAngle += angle

          const startRad = (startAngle * Math.PI) / 180
          const endRad = ((startAngle + angle) * Math.PI) / 180

          const x1 = 50 + 40 * Math.cos(startRad)
          const y1 = 50 + 40 * Math.sin(startRad)
          const x2 = 50 + 40 * Math.cos(endRad)
          const y2 = 50 + 40 * Math.sin(endRad)

          const largeArc = angle > 180 ? 1 : 0

          return (
            <path
              key={index}
              d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={segment.color}
              className="transition-all duration-300 hover:opacity-80"
            />
          )
        })}
        {/* Center hole */}
        <circle cx="50" cy="50" r="28" fill="var(--card)" />
      </svg>
      
      {/* Center text */}
      {(centerValue || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && (
            <span className="text-xl font-bold text-foreground">{centerValue}</span>
          )}
          {centerLabel && (
            <span className="text-xs text-muted-foreground">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
