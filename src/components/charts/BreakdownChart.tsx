import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface BreakdownChartProps {
  github: {
    commits: number
    pullRequests: number
    reviews: number
  }
  jira: {
    issues: number
    transitions: number
    comments: number
    worklogs: number
  }
  notes: number
  height?: number
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload
  
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-foreground">{data.name}</p>
      <p className="text-xs text-muted-foreground">{data.value} activities</p>
    </div>
  )
}

export function BreakdownChart({ github, jira, notes, height = 200 }: BreakdownChartProps) {
  const data = useMemo(() => {
    const items = [
      { name: 'Commits', value: github.commits, color: '#34d399', category: 'github' },
      { name: 'PRs', value: github.pullRequests, color: '#10b981', category: 'github' },
      { name: 'Reviews', value: github.reviews, color: '#059669', category: 'github' },
      { name: 'Issues', value: jira.issues, color: '#60a5fa', category: 'jira' },
      { name: 'Transitions', value: jira.transitions, color: '#3b82f6', category: 'jira' },
      { name: 'Comments', value: jira.comments, color: '#2563eb', category: 'jira' },
      { name: 'Worklogs', value: jira.worklogs, color: '#1d4ed8', category: 'jira' },
      { name: 'Notes', value: notes, color: '#fbbf24', category: 'notes' },
    ].filter(item => item.value > 0)

    return items
  }, [github, jira, notes])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        No activity breakdown available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
      >
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="hsl(var(--border))" 
          horizontal={false}
        />
        <XAxis 
          type="number"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'hsl(var(--border))' }}
        />
        <YAxis 
          type="category" 
          dataKey="name" 
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
