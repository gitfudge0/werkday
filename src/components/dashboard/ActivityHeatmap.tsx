import { cn } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'

interface ActivityHeatmapProps {
  className?: string
}

export function ActivityHeatmap({ className }: ActivityHeatmapProps) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

  const getLevelColor = (level: number) => {
    const colors = [
      'bg-surface-raised',           // 0 - no activity
      'bg-primary/20',               // 1 - low
      'bg-primary/40',               // 2 - medium
      'bg-primary/70',               // 3 - high
      'bg-primary',                  // 4 - best
    ]
    return colors[level] || colors[0]
  }

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Weekly Engagement</h3>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
          <span>View all</span>
          <ExternalLink size={12} />
        </button>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-surface-raised" />
          <span className="text-xs text-muted-foreground">Low</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-primary/40" />
          <span className="text-xs text-muted-foreground">Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-primary/70" />
          <span className="text-xs text-muted-foreground">High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-primary" />
          <span className="text-xs text-muted-foreground">Best</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="mt-4">
        {/* Week labels */}
        <div className="mb-2 flex">
          <div className="w-10" /> {/* Spacer for day labels */}
          <div className="grid flex-1 grid-cols-12 gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="text-center text-xs text-muted-foreground">
                {18 + i}
              </span>
            ))}
          </div>
        </div>

        {/* Grid rows */}
        <div className="space-y-1">
          {days.map((day) => (
            <div key={day} className="flex items-center gap-2">
              <span className="w-8 text-xs text-muted-foreground">{day}</span>
              <div className="grid flex-1 grid-cols-12 gap-1">
                {Array.from({ length: 12 }).map((_, weekIndex) => {
                  const level = Math.floor(Math.random() * 5)
                  return (
                    <div
                      key={weekIndex}
                      className={cn(
                        'aspect-square rounded transition-all duration-200 hover:ring-2 hover:ring-primary/50',
                        getLevelColor(level)
                      )}
                      title={`${day}, Week ${weekIndex + 18}: Level ${level}`}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
