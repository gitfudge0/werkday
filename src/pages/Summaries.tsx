import { useState, useEffect } from 'react'
import { format, addDays, differenceInDays } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { 
  FileText, 
  Sparkles, 
  GitCommit,
  GitPullRequest,
  MessageSquare,
  Loader2,
  AlertCircle,
  ExternalLink,
  Ticket,
  ArrowRightLeft,
  Timer,
  StickyNote,
  CalendarIcon,
  Clock,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  RefreshCw
} from 'lucide-react'
import { formatDistanceToNow } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface GitHubActivity {
  id: string
  type: 'commit' | 'pr' | 'review'
  title: string
  repo: string
  date: string
  url: string
  status?: 'open' | 'closed' | 'merged'
}

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
    timeSpent?: string
    commentBody?: string
  }
}

interface Note {
  id: string
  title: string
  content: string
  updatedAt: string
}

interface DailySummary {
  date: string
  generatedAt: string | null
  github: {
    commits: number
    pullRequests: number
    reviews: number
    activities: GitHubActivity[]
  }
  jira: {
    issuesWorkedOn: number
    transitions: number
    comments: number
    worklogs: number
    timeLogged: string | null
    activities: JiraActivity[]
  }
  notes: {
    count: number
    items: Note[]
  }
  aiReport: string | null
  aiReportStructured: {
    executiveSummary: string
    highlights: string[]
    nextSteps: string[]
  } | null
}

export function Summaries() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date()
  })
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isSelectingRange, setIsSelectingRange] = useState(false)
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasOpenRouter, setHasOpenRouter] = useState(false)

  // Format date for API (YYYY-MM-DD) - using local timezone
  const formatDateForApi = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

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
      return format(range.from, 'EEEE, MMMM d, yyyy')
    }
    
    // Date range
    return `${formatSingleDate(range.from)} - ${formatSingleDate(range.to)}`
  }

  // Get number of days in range
  const getDaysInRange = (): number => {
    if (!dateRange?.from) return 0
    if (!dateRange.to || dateRange.from.toDateString() === dateRange.to.toDateString()) {
      return 1
    }
    return differenceInDays(dateRange.to, dateRange.from) + 1
  }

  useEffect(() => {
    // Check if OpenRouter is configured
    const checkConfig = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/config')
        if (response.ok) {
          const config = await response.json()
          setHasOpenRouter(!!config.openrouter?.apiKey)
        }
      } catch (error) {
        console.error('Failed to check config:', error)
      }
    }
    checkConfig()
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [dateRange])

  const fetchSummary = async () => {
    if (!dateRange?.from) return
    
    setIsLoading(true)
    setError(null)
    try {
      const fromDate = formatDateForApi(dateRange.from)
      const toDate = dateRange.to ? formatDateForApi(dateRange.to) : fromDate
      const response = await fetch(`http://localhost:3001/api/summary/daily?from=${fromDate}&to=${toDate}`)
      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      } else {
        setError('Failed to fetch summary')
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  const generateSummary = async () => {
    if (!dateRange?.from) return
    
    setIsGenerating(true)
    setError(null)
    try {
      const fromDate = formatDateForApi(dateRange.from)
      const toDate = dateRange.to ? formatDateForApi(dateRange.to) : fromDate
      const response = await fetch('http://localhost:3001/api/summary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromDate, to: toDate })
      })
      
      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      } else {
        setError('Failed to generate summary')
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setIsGenerating(false)
    }
  }

  const syncData = async () => {
    if (!dateRange?.from) return
    
    setIsSyncing(true)
    setError(null)
    try {
      const fromDate = formatDateForApi(dateRange.from)
      const toDate = dateRange.to ? formatDateForApi(dateRange.to) : fromDate
      
      // Sync GitHub and JIRA in parallel
      const [githubRes, jiraRes] = await Promise.all([
        fetch(`http://localhost:3001/api/github/activity?since=${fromDate}T00:00:00&cache=false`),
        fetch('http://localhost:3001/api/jira/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: fromDate, to: toDate })
        })
      ])
      
      if (!githubRes.ok || !jiraRes.ok) {
        const errors = []
        if (!githubRes.ok) errors.push('GitHub')
        if (!jiraRes.ok) errors.push('JIRA')
        setError(`Failed to sync: ${errors.join(', ')}`)
      } else {
        // Refresh the summary after syncing
        await fetchSummary()
      }
    } catch {
      setError('Failed to sync data')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDateSelect = (range: DateRange | undefined) => {
    setDateRange(range)
    
    // Track if we're in the middle of selecting a range
    if (!isSelectingRange && range?.from) {
      // First click - start selecting
      setIsSelectingRange(true)
    } else if (isSelectingRange && range?.from && range?.to) {
      // Second click - range complete, close popover
      setIsSelectingRange(false)
      setIsCalendarOpen(false)
    }
  }

  // Reset selecting state when calendar opens
  const handleCalendarOpenChange = (open: boolean) => {
    setIsCalendarOpen(open)
    if (open) {
      setIsSelectingRange(false)
    }
  }

  // Calculate totals
  const totalGitHub = summary ? summary.github.commits + summary.github.pullRequests + summary.github.reviews : 0
  const totalJira = summary ? summary.jira.issuesWorkedOn + summary.jira.transitions + summary.jira.comments + summary.jira.worklogs : 0
  const totalNotes = summary?.notes.count || 0
  const totalActivity = totalGitHub + totalJira + totalNotes

  // Combine all activities for timeline
  const allActivities = summary ? [
    ...summary.github.activities.map(a => ({ ...a, source: 'github' as const })),
    ...summary.jira.activities.map(a => ({ ...a, source: 'jira' as const })),
    ...summary.notes.items.map(n => ({ 
      id: n.id, 
      title: n.title, 
      date: n.updatedAt, 
      source: 'notes' as const,
      type: 'note' as const
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : []

  const getActivityIcon = (activity: typeof allActivities[0]) => {
    if (activity.source === 'github') {
      const ghActivity = activity as GitHubActivity & { source: 'github' }
      switch (ghActivity.type) {
        case 'commit': return <GitCommit size={14} className="text-emerald-400" />
        case 'pr': return <GitPullRequest size={14} className="text-violet-400" />
        case 'review': return <MessageSquare size={14} className="text-amber-400" />
      }
    } else if (activity.source === 'jira') {
      const jiraActivity = activity as JiraActivity & { source: 'jira' }
      switch (jiraActivity.type) {
        case 'issue': return <Ticket size={14} className="text-blue-400" />
        case 'transition': return <ArrowRightLeft size={14} className="text-violet-400" />
        case 'comment': return <MessageSquare size={14} className="text-amber-400" />
        case 'worklog': return <Timer size={14} className="text-emerald-400" />
      }
    } else {
      return <StickyNote size={14} className="text-amber-400" />
    }
  }

  const getSourceBadge = (source: 'github' | 'jira' | 'notes') => {
    switch (source) {
      case 'github':
        return <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">GitHub</span>
      case 'jira':
        return <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">JIRA</span>
      case 'notes':
        return <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">Notes</span>
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Report</h1>
          <p className="text-muted-foreground">AI-powered summary of your work activity</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Date Range Picker */}
          <Popover open={isCalendarOpen} onOpenChange={handleCalendarOpenChange}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-primary/50">
                <CalendarIcon size={16} className="text-muted-foreground" />
                {formatDateRangeForDisplay(dateRange)}
                {getDaysInRange() > 1 && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                    {getDaysInRange()} days
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                key={isCalendarOpen ? 'open' : 'closed'}
                mode="range"
                selected={dateRange}
                onSelect={handleDateSelect}
                defaultMonth={dateRange?.from}
                disabled={(date) => date > new Date()}
                numberOfMonths={2}
                initialFocus
              />
              <div className="border-t border-border p-3 flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const today = new Date()
                      setDateRange({ from: today, to: today })
                      setIsSelectingRange(false)
                      setIsCalendarOpen(false)
                    }}
                    className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date()
                      const weekAgo = addDays(today, -6)
                      setDateRange({ from: weekAgo, to: today })
                      setIsSelectingRange(false)
                      setIsCalendarOpen(false)
                    }}
                    className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                  >
                    Last 7 days
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date()
                      const monthAgo = addDays(today, -29)
                      setDateRange({ from: monthAgo, to: today })
                      setIsSelectingRange(false)
                      setIsCalendarOpen(false)
                    }}
                    className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                  >
                    Last 30 days
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
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
        <>
          {/* Metrics Dashboard */}
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Activity */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingUp size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalActivity}</p>
                  <p className="text-xs text-muted-foreground">Total Activities</p>
                </div>
              </div>
            </div>

            {/* GitHub */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <GitCommit size={20} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalGitHub}</p>
                  <p className="text-xs text-muted-foreground">GitHub Actions</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{summary?.github.commits || 0} commits</span>
                <span>{summary?.github.pullRequests || 0} PRs</span>
                <span>{summary?.github.reviews || 0} reviews</span>
              </div>
            </div>

            {/* JIRA */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Ticket size={20} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalJira}</p>
                  <p className="text-xs text-muted-foreground">JIRA Actions</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{summary?.jira.issuesWorkedOn || 0} issues</span>
                {summary?.jira.timeLogged && <span>{summary.jira.timeLogged} logged</span>}
              </div>
            </div>

            {/* Notes */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <StickyNote size={20} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalNotes}</p>
                  <p className="text-xs text-muted-foreground">Notes Updated</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* AI Report - Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                      <Sparkles size={20} className="text-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">AI Report</h3>
                      {summary?.generatedAt && (
                        <p className="text-xs text-muted-foreground">
                          Generated {formatDistanceToNow(summary.generatedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={generateSummary}
                    disabled={isGenerating || isSyncing || totalActivity === 0 || !hasOpenRouter}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    title={summary?.generatedAt ? 'Regenerate Report' : 'Generate Report'}
                  >
                    {isGenerating ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Sparkles size={18} />
                    )}
                  </button>
                </div>

                <div className="p-5">
                  {summary?.aiReportStructured ? (
                    <div className="space-y-6">
                      {/* Executive Summary */}
                      <div className="flex gap-4">
                        <div className="w-32 shrink-0">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Summary</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {summary.aiReportStructured.executiveSummary}
                        </p>
                      </div>

                      {/* Highlights */}
                      {summary.aiReportStructured.highlights.length > 0 && (
                        <div className="flex gap-4">
                          <div className="w-32 shrink-0">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Highlights</span>
                          </div>
                          <ul className="space-y-2 flex-1">
                            {summary.aiReportStructured.highlights.map((highlight, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                                <span>{highlight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Next Steps */}
                      {summary.aiReportStructured.nextSteps.length > 0 && (
                        <div className="flex gap-4">
                          <div className="w-32 shrink-0">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Next Steps</span>
                          </div>
                          <ul className="space-y-2 flex-1">
                            {summary.aiReportStructured.nextSteps.map((step, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <ArrowRight size={16} className="text-violet-400 shrink-0 mt-0.5" />
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : totalActivity === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText size={32} className="mb-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground mb-1">No activity for this period</p>
                      <p className="text-xs text-muted-foreground">
                        Sync your GitHub and JIRA data to see activity here.
                      </p>
                    </div>
                  ) : !hasOpenRouter ? (
                    <div className="rounded-lg bg-amber-500/10 p-4">
                      <p className="text-sm text-amber-400">
                        Configure OpenRouter API key in Settings to generate AI reports.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Sparkles size={32} className="mb-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground mb-1">
                        {totalActivity} activities found
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Click the sparkle icon above to generate an AI-powered summary.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Activity Timeline - Sidebar */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border p-4">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">Activity Timeline</h3>
                  </div>
                  <button
                    onClick={syncData}
                    disabled={isSyncing}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-50"
                    title="Sync GitHub & JIRA"
                  >
                    {isSyncing ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <RefreshCw size={18} />
                    )}
                  </button>
                </div>

                {allActivities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <Clock size={24} className="mb-2 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">No activities yet</p>
                  </div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                    <div className="divide-y divide-border">
                      {allActivities.slice(0, 20).map((activity) => (
                        <div
                          key={`${activity.source}-${activity.id}`}
                          className="flex items-start gap-3 p-3 transition-colors hover:bg-surface-raised/50"
                        >
                          <div className="mt-0.5">
                            {getActivityIcon(activity)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">
                              {activity.source === 'jira' 
                                ? (activity as JiraActivity).issueSummary || (activity as JiraActivity).issueKey
                                : activity.title
                              }
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(activity.date)}
                              </span>
                              {getSourceBadge(activity.source)}
                            </div>
                          </div>
                          {activity.source !== 'notes' && 'url' in activity && activity.url && (
                            <a
                              href={activity.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
