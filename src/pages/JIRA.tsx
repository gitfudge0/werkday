import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { 
  Ticket, 
  ArrowRightLeft,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Settings,
  Loader2,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react'
import { formatDistanceToNow } from '../lib/utils'

interface JiraActivity {
  id: string
  type: 'issue' | 'transition' | 'comment' | 'worklog'
  issueKey: string
  issueSummary: string
  project: string
  date: string
  url: string
  details?: {
    fromStatus?: string
    toStatus?: string
    comment?: string
    timeSpent?: string
  }
}

interface ActivityResponse {
  date: string
  issues: JiraActivity[]
  transitions: JiraActivity[]
  summary: {
    issuesWorkedOn: number
    transitionsMade: number
  }
}

export function JIRA() {
  const [selectedDate, setSelectedDate] = useState<string>('Today')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [domain, setDomain] = useState<string | null>(null)
  const [activities, setActivities] = useState<JiraActivity[]>([])
  const [stats, setStats] = useState({ issuesWorkedOn: 0, transitionsMade: 0 })
  const [error, setError] = useState<string | null>(null)
  
  const dateOptions = ['Today', 'Yesterday', 'This Week', 'Last 7 Days']

  // Get date string for API
  const getDateString = useCallback((option: string): string => {
    const now = new Date()
    switch (option) {
      case 'Today':
        return now.toISOString().split('T')[0]
      case 'Yesterday':
        now.setDate(now.getDate() - 1)
        return now.toISOString().split('T')[0]
      case 'This Week':
        // Start of current week (Sunday)
        now.setDate(now.getDate() - now.getDay())
        return now.toISOString().split('T')[0]
      case 'Last 7 Days':
        now.setDate(now.getDate() - 7)
        return now.toISOString().split('T')[0]
      default:
        return now.toISOString().split('T')[0]
    }
  }, [])

  // Fetch JIRA activity
  const fetchActivity = useCallback(async () => {
    try {
      setError(null)
      const date = getDateString(selectedDate)
      
      // For multi-day ranges, we need to fetch each day
      // For now, just fetch the single date (API returns activity for that day)
      const response = await fetch(
        `http://localhost:3001/api/jira/activity?date=${date}`
      )
      
      if (!response.ok) {
        if (response.status === 401) {
          setIsConnected(false)
          return
        }
        throw new Error('Failed to fetch activity')
      }
      
      const data: ActivityResponse = await response.json()
      
      // Combine all activities and sort by date
      const allActivities: JiraActivity[] = [
        ...data.issues,
        ...data.transitions
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      // Remove duplicate issues (keep transitions if they exist for the same issue)
      const seen = new Set<string>()
      const deduped = allActivities.filter(activity => {
        // Always keep transitions
        if (activity.type === 'transition') {
          seen.add(activity.issueKey)
          return true
        }
        // Only keep issues if we haven't seen a transition for it
        if (!seen.has(activity.issueKey)) {
          seen.add(activity.issueKey)
          return true
        }
        return false
      })
      
      setActivities(deduped)
      setStats(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch activity')
    }
  }, [selectedDate, getDateString])

  // Check connection status and fetch initial data
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('http://localhost:3001/api/jira/status')
        const data = await response.json()
        setIsConnected(data.connected)
        setDisplayName(data.displayName)
        setDomain(data.domain)
        
        if (data.connected) {
          await fetchActivity()
        }
      } catch {
        setIsConnected(false)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  // Refetch when date filter changes
  useEffect(() => {
    if (isConnected && !isLoading) {
      fetchActivity()
    }
  }, [selectedDate, isConnected, fetchActivity])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchActivity()
    setIsRefreshing(false)
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'issue':
        return <Ticket size={16} className="text-blue-400" />
      case 'transition':
        return <ArrowRightLeft size={16} className="text-violet-400" />
      case 'comment':
        return <Ticket size={16} className="text-amber-400" />
      case 'worklog':
        return <Clock size={16} className="text-emerald-400" />
      default:
        return <AlertCircle size={16} className="text-muted-foreground" />
    }
  }

  const getActivityDescription = (activity: JiraActivity) => {
    switch (activity.type) {
      case 'transition':
        return (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="rounded bg-surface-raised px-1.5 py-0.5 text-muted-foreground">
              {activity.details?.fromStatus}
            </span>
            <ArrowRight size={12} className="text-muted-foreground" />
            <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-400">
              {activity.details?.toStatus}
            </span>
          </span>
        )
      case 'issue':
        return (
          <span className="text-xs text-muted-foreground">
            Updated
          </span>
        )
      default:
        return null
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="flex h-full items-center justify-center">
          <Loader2 size={32} className="animate-spin text-muted-foreground" />
        </div>
      </main>
    )
  }

  // Not connected state
  if (!isConnected) {
    return (
      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">JIRA Activity</h1>
          <p className="text-muted-foreground">Connect your JIRA account to track your tickets</p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised">
            <Ticket size={32} className="text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">JIRA Not Connected</h2>
          <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
            Connect your JIRA account to automatically track tickets, status changes, and sprint progress.
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            <Settings size={16} />
            Connect JIRA in Settings
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">JIRA Activity</h1>
          <p className="text-muted-foreground">
            {displayName ? `${displayName}'s` : 'Your'} ticket activity
            {domain && <span className="text-xs ml-1">({domain}.atlassian.net)</span>}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Sync
          </button>

          {/* Date Filter */}
          <div className="relative">
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="appearance-none rounded-lg border border-border bg-card px-4 py-2 pr-10 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {dateOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown 
              size={16} 
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" 
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-rose-500/10 p-4 text-sm text-rose-400">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Ticket size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.issuesWorkedOn}</p>
              <p className="text-xs text-muted-foreground">Issues Worked On</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              <ArrowRightLeft size={20} className="text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.transitionsMade}</p>
              <p className="text-xs text-muted-foreground">Status Transitions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold text-foreground">Recent Activity</h2>
        </div>
        
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Ticket size={32} className="mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No activity found for {selectedDate.toLowerCase()}.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Try selecting a different time range.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-4 p-4 transition-colors hover:bg-surface-raised/50">
                <div className="mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-primary">{activity.issueKey}</span>
                        {activity.url && (
                          <a
                            href={activity.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-foreground truncate">{activity.issueSummary}</p>
                      <p className="text-xs text-muted-foreground">{activity.project}</p>
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(activity.date)}
                    </span>
                    {getActivityDescription(activity)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
