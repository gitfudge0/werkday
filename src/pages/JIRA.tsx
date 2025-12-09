import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { 
  Ticket, 
  ArrowRightLeft,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Settings,
  Loader2,
  ArrowRight,
  CalendarIcon,
  MessageSquare,
  Timer
} from 'lucide-react'
import { formatDistanceToNow } from '../lib/utils'
import { Calendar } from '../components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'

interface JiraActivity {
  id: string
  type: 'issue' | 'transition' | 'comment' | 'worklog'
  issueKey: string
  issueSummary: string
  project: string
  date: string
  url: string
  author?: string
  details?: {
    fromStatus?: string
    toStatus?: string
    comment?: string
    timeSpent?: string
    timeSpentSeconds?: number
    commentBody?: string
  }
}

interface ActivityResponse {
  date: string
  synced: boolean
  syncedAt: string | null
  issues: JiraActivity[]
  transitions: JiraActivity[]
  comments: JiraActivity[]
  worklogs: JiraActivity[]
  summary: {
    issuesWorkedOn: number
    transitionsMade: number
    commentsMade: number
    worklogsAdded: number
    totalTimeLogged: string | null
  }
}

export function JIRA() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isSynced, setIsSynced] = useState(false)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [domain, setDomain] = useState<string | null>(null)
  const [activities, setActivities] = useState<JiraActivity[]>([])
  const [stats, setStats] = useState({ 
    issuesWorkedOn: 0, 
    transitionsMade: 0,
    commentsMade: 0,
    worklogsAdded: 0,
    totalTimeLogged: null as string | null
  })
  const [error, setError] = useState<string | null>(null)

  // Format date for API (YYYY-MM-DD) - using local timezone
  const formatDateForApi = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Format date for display
  const formatDateForDisplay = (date: Date): string => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return format(date, 'MMM d, yyyy')
  }

  // Fetch JIRA activity from local cache (does NOT call JIRA API)
  const fetchActivity = useCallback(async () => {
    try {
      setError(null)
      const dateStr = formatDateForApi(selectedDate)
      
      const response = await fetch(
        `http://localhost:3001/api/jira/activity?date=${dateStr}`
      )
      
      if (!response.ok) {
        if (response.status === 401) {
          setIsConnected(false)
          return
        }
        throw new Error('Failed to fetch activity')
      }
      
      const data: ActivityResponse = await response.json()
      
      setIsSynced(data.synced)
      setSyncedAt(data.syncedAt)
      
      if (!data.synced) {
        // No data synced for this date
        setActivities([])
        setStats({
          issuesWorkedOn: 0,
          transitionsMade: 0,
          commentsMade: 0,
          worklogsAdded: 0,
          totalTimeLogged: null
        })
        return
      }
      
      // Combine all activities and sort by date
      const allActivities: JiraActivity[] = [
        ...data.issues,
        ...data.transitions,
        ...data.comments,
        ...data.worklogs
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      // Remove duplicate issues (keep other activity types if they exist for the same issue)
      const seen = new Set<string>()
      const deduped = allActivities.filter(activity => {
        // Always keep transitions, comments, worklogs
        if (activity.type !== 'issue') {
          seen.add(activity.issueKey)
          return true
        }
        // Only keep issues if we haven't seen any other activity for it
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
  }, [selectedDate])

  // Sync JIRA activity from JIRA API and save to local cache
  const syncActivity = useCallback(async () => {
    try {
      setError(null)
      setIsSyncing(true)
      const dateStr = formatDateForApi(selectedDate)
      
      const response = await fetch(
        'http://localhost:3001/api/jira/sync',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateStr })
        }
      )
      
      if (!response.ok) {
        if (response.status === 401) {
          setIsConnected(false)
          return
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to sync activity')
      }
      
      const data: ActivityResponse = await response.json()
      
      setIsSynced(data.synced)
      setSyncedAt(data.syncedAt)
      
      // Combine all activities and sort by date
      const allActivities: JiraActivity[] = [
        ...data.issues,
        ...data.transitions,
        ...data.comments,
        ...data.worklogs
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      // Remove duplicate issues (keep other activity types if they exist for the same issue)
      const seen = new Set<string>()
      const deduped = allActivities.filter(activity => {
        // Always keep transitions, comments, worklogs
        if (activity.type !== 'issue') {
          seen.add(activity.issueKey)
          return true
        }
        // Only keep issues if we haven't seen any other activity for it
        if (!seen.has(activity.issueKey)) {
          seen.add(activity.issueKey)
          return true
        }
        return false
      })
      
      setActivities(deduped)
      setStats(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync activity')
    } finally {
      setIsSyncing(false)
    }
  }, [selectedDate])

  // Check connection status and fetch initial data from cache
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

  // Read from cache when date changes (does NOT call JIRA API)
  useEffect(() => {
    if (isConnected && !isLoading) {
      fetchActivity()
    }
  }, [selectedDate, isConnected, fetchActivity])

  const handleSync = async () => {
    await syncActivity()
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      setIsCalendarOpen(false)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'issue':
        return <Ticket size={16} className="text-blue-400" />
      case 'transition':
        return <ArrowRightLeft size={16} className="text-violet-400" />
      case 'comment':
        return <MessageSquare size={16} className="text-amber-400" />
      case 'worklog':
        return <Timer size={16} className="text-emerald-400" />
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
      case 'comment':
        return (
          <span className="text-xs text-muted-foreground">
            {activity.details?.commentBody ? (
              <span className="line-clamp-2 italic">"{activity.details.commentBody}"</span>
            ) : (
              'Added a comment'
            )}
          </span>
        )
      case 'worklog':
        return (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400">
              {activity.details?.timeSpent || 'Time logged'}
            </span>
            {activity.details?.commentBody && (
              <span className="text-muted-foreground truncate max-w-[200px]">
                - {activity.details.commentBody}
              </span>
            )}
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
          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised disabled:opacity-50"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>

          {/* Date Picker */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <CalendarIcon size={16} className="text-muted-foreground" />
                {formatDateForDisplay(selectedDate)}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                key={isCalendarOpen ? 'open' : 'closed'}
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                defaultMonth={selectedDate}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
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
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <MessageSquare size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.commentsMade}</p>
              <p className="text-xs text-muted-foreground">Comments Made</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Timer size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {stats.totalTimeLogged || '0h'}
              </p>
              <p className="text-xs text-muted-foreground">Time Logged</p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Activity for {formatDateForDisplay(selectedDate)}</h2>
            {syncedAt && (
              <span className="text-xs text-muted-foreground">
                Synced {formatDistanceToNow(syncedAt)}
              </span>
            )}
          </div>
        </div>
        
        {!isSynced ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <RefreshCw size={32} className="mb-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground mb-1">
              No data synced for {formatDateForDisplay(selectedDate).toLowerCase()}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Click the button below to fetch your JIRA activity for this date.
            </p>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Ticket size={32} className="mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No activity found for {formatDateForDisplay(selectedDate).toLowerCase()}.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              You didn't make any changes to JIRA tickets on this date.
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
