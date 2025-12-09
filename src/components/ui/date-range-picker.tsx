import { useState } from 'react'
import { format, addDays, differenceInDays } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

interface DateRangePickerProps {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  align?: 'start' | 'center' | 'end'
}

export function DateRangePicker({ value, onChange, align = 'end' }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSelectingRange, setIsSelectingRange] = useState(false)

  // Format date range for display
  const formatDateRangeForDisplay = (range: DateRange | undefined): string => {
    if (!range?.from) return 'Select dates'
    
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const formatSingleDate = (date: Date): string => {
      if (date.toDateString() === today.toDateString()) {
        return 'Today'
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday'
      }
      return format(date, 'MMM d')
    }
    
    if (!range.to || range.from.toDateString() === range.to.toDateString()) {
      // Single date
      if (range.from.toDateString() === today.toDateString()) {
        return 'Today'
      } else if (range.from.toDateString() === yesterday.toDateString()) {
        return 'Yesterday'
      }
      return format(range.from, 'MMM d, yyyy')
    }
    
    // Date range
    return `${formatSingleDate(range.from)} - ${formatSingleDate(range.to)}`
  }

  // Get number of days in range
  const getDaysInRange = (): number => {
    if (!value?.from) return 0
    if (!value.to || value.from.toDateString() === value.to.toDateString()) {
      return 1
    }
    return differenceInDays(value.to, value.from) + 1
  }

  const handleDateSelect = (range: DateRange | undefined) => {
    onChange(range)
    
    // Track if we're in the middle of selecting a range
    if (!isSelectingRange && range?.from) {
      // First click - start selecting
      setIsSelectingRange(true)
    } else if (isSelectingRange && range?.from && range?.to) {
      // Second click - range complete, close popover
      setIsSelectingRange(false)
      setIsOpen(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      setIsSelectingRange(false)
    }
  }

  const setPreset = (from: Date, to: Date) => {
    onChange({ from, to })
    setIsSelectingRange(false)
    setIsOpen(false)
  }

  const daysInRange = getDaysInRange()

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <CalendarIcon size={16} className="text-muted-foreground" />
          {formatDateRangeForDisplay(value)}
          {daysInRange > 1 && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
              {daysInRange} days
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          key={isOpen ? 'open' : 'closed'}
          mode="range"
          selected={value}
          onSelect={handleDateSelect}
          defaultMonth={value?.from}
          disabled={(date) => date > new Date()}
          numberOfMonths={2}
          initialFocus
        />
        <div className="border-t border-border p-3 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => {
                const today = new Date()
                setPreset(today, today)
              }}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
            >
              Today
            </button>
            <button
              onClick={() => {
                const today = new Date()
                const weekAgo = addDays(today, -6)
                setPreset(weekAgo, today)
              }}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
            >
              Last 7 days
            </button>
            <button
              onClick={() => {
                const today = new Date()
                const monthAgo = addDays(today, -29)
                setPreset(monthAgo, today)
              }}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
            >
              Last 30 days
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
