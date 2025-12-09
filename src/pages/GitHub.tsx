import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { 
  GitCommit, 
  GitPullRequest, 
  GitMerge,
  MessageSquare,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  Settings,
  Loader2
} from 'lucide-react'
import { formatDistanceToNow } from '../lib/utils'

interface GitHubActivity {
  id: string
  type: 'commit' | 'pr' | 'review'
  title: string
  repo: string
  date: string
  url: string
  status?: 'open' | 'merged' | 'closed'
  additions?: number
  deletions?: number
}

interface ActivityResponse {
  commits: GitHubActivity[]
  pullRequests: GitHubActivity[]
  reviews: GitHubActivity[]
  fromCache: boolean
  lastSync: string
}

export function GitHub() {
  const [selectedDate, setSelectedDate] = useState<string>('Last 7 Days')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [activities, setActivities] = useState<GitHubActivity[]>([])
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const dateOptions = ['Today', 'Yesterday', 'This Week', 'Last 7 Days', 'This Month']

  // Calculate 'since' date based on selection
  const getSinceDate = useCallback((option: string): string => {
    const now = new Date()
    switch (option) {
      case 'Today':
        now.setHours(0, 0, 0, 0)
        return now.toISOString()
      case 'Yesterday':
        now.setDate(now.getDate() - 1)
        now.setHours(0, 0, 0, 0)
        return now.toISOString()
      case 'This Week':
        now.setDate(now.getDate() - now.getDay())
        now.setHours(0, 0, 0, 0)
        return now.toISOString()
      case 'Last 7 Days':
        now.setDate(now.getDate() - 7)
        return now.toISOString()
      case 'This Month':
        now.setDate(1)
        now.setHours(0, 0, 0, 0)
        return now.toISOString()
      default:
        now.setHours(0, 0, 0, 0)
        return now.toISOString()
    }
  }, [])

  // Fetch GitHub activity
  const fetchActivity = useCallback(async (forceRefresh = false) => {
    try {
      setError(null)
      const since = getSinceDate(selectedDate)
      const cacheParam = forceRefresh ? '&cache=false' : ''
      
      const response = await fetch(
        `http://localhost:3001/api/github/activity?since=${since}${cacheParam}`
      )
      
      if (!response.ok) {
        if (response.status === 401) {
          setIsConnected(false)
          return
        }
        throw new Error('Failed to fetch activity')
      }
      
      const data: ActivityResponse = await response.json()
      
      // Combine all activities
      const allActivities: GitHubActivity[] = [
        ...data.commits,
        ...data.pullRequests,
        ...data.reviews
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      setActivities(allActivities)
      setLastSync(data.lastSync)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch activity')
    }
  }, [selectedDate, getSinceDate])

  // Check connection status and fetch initial data
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('http://localhost:3001/api/github/status')
        const data = await response.json()
        setIsConnected(data.connected)
        setUsername(data.username)
        
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
    await fetchActivity(true)
    setIsRefreshing(false)
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'commit':
        return <GitCommit size={16} className="text-emerald-400" />
      case 'pr':
        return <GitPullRequest size={16} className="text-violet-400" />
      case 'review':
        return <MessageSquare size={16} className="text-amber-400" />
      default:
        return <AlertCircle size={16} className="text-muted-foreground" />
    }
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
            <Clock size={10} />
            Open
          </span>
        )
      case 'merged':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-400">
            <GitMerge size={10} />
            Merged
          </span>
        )
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400">
            <CheckCircle2 size={10} />
            Closed
          </span>
        )
      default:
        return null
    }
  }

  // Stats summary
  const stats = {
    commits: activities.filter(a => a.type === 'commit').length,
    prs: activities.filter(a => a.type === 'pr').length,
    reviews: activities.filter(a => a.type === 'review').length
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
          <h1 className="text-2xl font-bold text-foreground">GitHub Activity</h1>
          <p className="text-muted-foreground">Connect your GitHub account to track your work</p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised">
            <GitPullRequest size={32} className="text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">GitHub Not Connected</h2>
          <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
            Connect your GitHub account to automatically track commits, pull requests, and code reviews.
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            <Settings size={16} />
            Connect GitHub in Settings
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
          <h1 className="text-2xl font-bold text-foreground">GitHub Activity</h1>
          <p className="text-muted-foreground">
            {username ? `@${username}'s` : 'Your'} coding contributions and reviews
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Last Sync Info */}
          {lastSync && (
            <span className="text-xs text-muted-foreground">
              Synced {formatDistanceToNow(lastSync)}
            </span>
          )}
          
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
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <GitCommit size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.commits}</p>
              <p className="text-xs text-muted-foreground">Commits</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              <GitPullRequest size={20} className="text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.prs}</p>
              <p className="text-xs text-muted-foreground">Pull Requests</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <MessageSquare size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.reviews}</p>
              <p className="text-xs text-muted-foreground">Reviews</p>
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
            <GitCommit size={32} className="mb-4 text-muted-foreground" />
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
                      <p className="font-medium text-foreground truncate">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.repo}</p>
                    </div>
                    {activity.url && (
                      <a
                        href={activity.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(activity.date)}
                    </span>
                    {getStatusBadge(activity.status)}
                    {activity.additions !== undefined && (
                      <span className="text-xs">
                        <span className="text-emerald-400">+{activity.additions}</span>
                        <span className="mx-1 text-muted-foreground">/</span>
                        <span className="text-rose-400">-{activity.deletions}</span>
                      </span>
                    )}
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
