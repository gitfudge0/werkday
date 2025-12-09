import { useState, useEffect } from 'react'
import { 
  FileText, 
  Sparkles, 
  Calendar,
  GitCommit,
  GitPullRequest,
  MessageSquare,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ExternalLink
} from 'lucide-react'
import { cn, formatDistanceToNow } from '@/lib/utils'

interface Activity {
  id: string
  type: 'commit' | 'pr' | 'review'
  title: string
  repo: string
  date: string
  url: string
  status?: 'open' | 'closed' | 'merged'
}

interface DailySummary {
  date: string
  generatedAt: string | null
  commits: number
  pullRequests: number
  reviews: number
  aiSummary: string | null
  activities: Activity[]
}

export function Summaries() {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasOpenRouter, setHasOpenRouter] = useState(false)

  useEffect(() => {
    // Check if OpenRouter is configured
    const checkConfig = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/config')
        if (response.ok) {
          const config = await response.json()
          setHasOpenRouter(!!config.openrouter?.apiKey && config.openrouter.apiKey !== '***' || !!config.openrouter?.apiKey)
        }
      } catch (error) {
        console.error('Failed to check config:', error)
      }
    }
    checkConfig()
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [selectedDate])

  const fetchSummary = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`http://localhost:3001/api/summary/daily?date=${selectedDate}`)
      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      } else {
        setError('Failed to fetch summary')
      }
    } catch (error) {
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  const generateSummary = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      // First, make sure we have fresh activity data
      await fetch(`http://localhost:3001/api/github/activity?since=${selectedDate}T00:00:00Z&cache=false`)
      
      // Then generate the summary
      const response = await fetch('http://localhost:3001/api/summary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate })
      })
      
      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      } else {
        setError('Failed to generate summary')
      }
    } catch (error) {
      setError('Failed to connect to server')
    } finally {
      setIsGenerating(false)
    }
  }

  const changeDate = (days: number) => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + days)
    // Don't go into the future
    if (date <= new Date()) {
      setSelectedDate(date.toISOString().split('T')[0])
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (dateStr === today.toISOString().split('T')[0]) {
      return 'Today'
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday'
    }
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    })
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'commit': return <GitCommit size={14} className="text-emerald-400" />
      case 'pr': return <GitPullRequest size={14} className="text-violet-400" />
      case 'review': return <MessageSquare size={14} className="text-amber-400" />
      default: return null
    }
  }

  const totalActivity = summary ? summary.commits + summary.pullRequests + summary.reviews : 0
  const isToday = selectedDate === new Date().toISOString().split('T')[0]

  return (
    <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Summaries</h1>
          <p className="text-muted-foreground">AI-powered summaries of your work activity</p>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => changeDate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
        >
          <ChevronLeft size={20} />
        </button>
        
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2">
          <Calendar size={18} className="text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">{formatDate(selectedDate)}</p>
            <p className="text-xs text-muted-foreground">{selectedDate}</p>
          </div>
        </div>
        
        <button
          onClick={() => changeDate(1)}
          disabled={isToday}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-30 disabled:hover:bg-card disabled:hover:text-muted-foreground"
        >
          <ChevronRight size={20} />
        </button>

        <input
          type="date"
          value={selectedDate}
          max={new Date().toISOString().split('T')[0]}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-rose-500/10 p-4 text-sm text-rose-400">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Summary Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Summary */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                    <Sparkles size={20} className="text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">AI Summary</h3>
                    {summary?.generatedAt && (
                      <p className="text-xs text-muted-foreground">
                        Generated {formatDistanceToNow(summary.generatedAt)}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={generateSummary}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} />
                      {summary?.generatedAt ? 'Regenerate' : 'Generate'}
                    </>
                  )}
                </button>
              </div>

              {summary?.aiSummary ? (
                <div className="rounded-lg bg-surface-raised p-4">
                  <p className="text-sm leading-relaxed text-foreground">{summary.aiSummary}</p>
                </div>
              ) : totalActivity === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <FileText size={32} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No activity found for this day
                  </p>
                </div>
              ) : !hasOpenRouter ? (
                <div className="rounded-lg bg-amber-500/10 p-4">
                  <p className="text-sm text-amber-400">
                    Configure OpenRouter in Settings to generate AI summaries
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <Sparkles size={32} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">
                    {totalActivity} activities found. Click "Generate" to create an AI summary.
                  </p>
                </div>
              )}
            </div>

            {/* Activity List */}
            {summary && summary.activities.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 font-semibold text-foreground">Activity Details</h3>
                <div className="space-y-2">
                  {summary.activities.map((activity) => (
                    <a
                      key={activity.id}
                      href={activity.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-surface-raised"
                    >
                      <div className="mt-0.5">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary">
                          {activity.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{activity.repo}</span>
                          <span>•</span>
                          <span>{formatDistanceToNow(activity.date)}</span>
                          {activity.status && (
                            <>
                              <span>•</span>
                              <span className={cn(
                                'capitalize',
                                activity.status === 'merged' && 'text-violet-400',
                                activity.status === 'open' && 'text-emerald-400',
                                activity.status === 'closed' && 'text-muted-foreground'
                              )}>
                                {activity.status}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <ExternalLink size={14} className="mt-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stats Sidebar */}
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">Activity Breakdown</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                      <GitCommit size={16} className="text-emerald-400" />
                    </div>
                    <span className="text-sm text-muted-foreground">Commits</span>
                  </div>
                  <span className="text-lg font-semibold text-foreground">{summary?.commits || 0}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                      <GitPullRequest size={16} className="text-violet-400" />
                    </div>
                    <span className="text-sm text-muted-foreground">Pull Requests</span>
                  </div>
                  <span className="text-lg font-semibold text-foreground">{summary?.pullRequests || 0}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                      <MessageSquare size={16} className="text-amber-400" />
                    </div>
                    <span className="text-sm text-muted-foreground">Code Reviews</span>
                  </div>
                  <span className="text-lg font-semibold text-foreground">{summary?.reviews || 0}</span>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Total Activity</span>
                    <span className="text-lg font-bold text-primary">{totalActivity}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                  className="w-full rounded-lg border border-border px-4 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-surface-raised"
                >
                  Jump to Today
                </button>
                <button
                  onClick={() => {
                    const yesterday = new Date()
                    yesterday.setDate(yesterday.getDate() - 1)
                    setSelectedDate(yesterday.toISOString().split('T')[0])
                  }}
                  className="w-full rounded-lg border border-border px-4 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-surface-raised"
                >
                  Jump to Yesterday
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
