import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface DayData {
  date: string
  github: number
  jira: number
  notes: number
  total: number
  details: {
    commits: number
    pullRequests: number
    reviews: number
    issues: number
    transitions: number
    comments: number
    worklogs: number
    timeLogged: string | null
  }
}

interface ActivityChartProps {
  data: DayData[]
  height?: number
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null

  const dayData = payload[0]?.payload as DayData
  
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
      <p className="text-sm font-medium text-foreground mb-2">
        {format(parseISO(label), 'EEE, MMM d')}
      </p>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            GitHub
          </span>
          <span className="font-medium text-foreground">{dayData.github}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            JIRA
          </span>
          <span className="font-medium text-foreground">{dayData.jira}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Notes
          </span>
          <span className="font-medium text-foreground">{dayData.notes}</span>
        </div>
        {dayData.details.timeLogged && (
          <div className="pt-1 border-t border-border mt-1">
            <span className="text-muted-foreground">Time logged: </span>
            <span className="font-medium text-foreground">{dayData.details.timeLogged}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function ActivityChart({ data, height = 280 }: ActivityChartProps) {
  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      displayDate: format(parseISO(d.date), 'EEE'),
    }))
  }, [data])

  const maxValue = useMemo(() => {
    const max = Math.max(...data.map(d => d.total))
    return Math.ceil(max / 5) * 5 + 5 // Round up and add padding
  }, [data])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
        No activity data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={chartData}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorGithub" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorJira" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorNotes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="hsl(var(--border))" 
          vertical={false}
        />
        <XAxis
          dataKey="displayDate"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'hsl(var(--border))' }}
        />
        <YAxis
          domain={[0, maxValue]}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          verticalAlign="top"
          height={36}
          formatter={(value) => (
            <span className="text-xs text-muted-foreground capitalize">{value}</span>
          )}
        />
        <Area
          type="monotone"
          dataKey="github"
          stackId="1"
          stroke="#34d399"
          strokeWidth={2}
          fill="url(#colorGithub)"
          name="GitHub"
        />
        <Area
          type="monotone"
          dataKey="jira"
          stackId="1"
          stroke="#60a5fa"
          strokeWidth={2}
          fill="url(#colorJira)"
          name="JIRA"
        />
        <Area
          type="monotone"
          dataKey="notes"
          stackId="1"
          stroke="#fbbf24"
          strokeWidth={2}
          fill="url(#colorNotes)"
          name="Notes"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
