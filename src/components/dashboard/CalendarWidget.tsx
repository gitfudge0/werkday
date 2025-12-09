import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'

interface CalendarWidgetProps {
  className?: string
}

export function CalendarWidget({ className }: CalendarWidgetProps) {
  const today = new Date()
  const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  
  // Generate days for current week view
  const getDaysOfWeek = () => {
    const days = []
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 4) // Start from Thursday for demo
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      days.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.getDate(),
        isToday: date.toDateString() === today.toDateString(),
        hasEvent: [27, 28, 29].includes(date.getDate()),
      })
    }
    return days
  }

  const days = getDaysOfWeek()

  const events = [
    {
      title: 'Review Sprint Tasks',
      description: 'Check progress on current sprint...',
      time: '09:00 AM',
      attendees: 3,
    },
    {
      title: 'Team Standup',
      description: 'Daily sync with the team',
      time: '10:45 AM',
      attendees: 5,
    },
  ]

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">{currentMonth}</h3>
        <div className="flex items-center gap-1">
          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-raised hover:text-foreground">
            <ChevronLeft size={16} />
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-raised hover:text-foreground">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Week view */}
      <div className="mt-4 grid grid-cols-7 gap-1">
        {days.map((day, idx) => (
          <div key={idx} className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">{day.day}</span>
            <button
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors',
                day.isToday
                  ? 'bg-primary text-white'
                  : day.hasEvent
                  ? 'bg-primary/20 text-primary hover:bg-primary/30'
                  : 'text-foreground hover:bg-surface-raised'
              )}
            >
              {day.date}
            </button>
          </div>
        ))}
      </div>

      {/* Events */}
      <div className="mt-5 space-y-3">
        {events.map((event, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-border bg-surface p-3 transition-colors hover:border-primary/30"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-medium text-foreground">{event.title}</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">{event.description}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex -space-x-2">
                {Array.from({ length: event.attendees }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full border-2 border-card text-xs font-medium text-white',
                      ['bg-violet-500', 'bg-pink-500', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500'][i % 5]
                    )}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{event.time}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add event button */}
      <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary/30 py-2.5 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary/5">
        <Plus size={16} />
        <span>Create Activity</span>
      </button>
    </div>
  )
}
