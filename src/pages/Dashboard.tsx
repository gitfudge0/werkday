import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  GitCommit, 
  GitPullRequest, 
  MessageSquare,
  Ticket, 
  ArrowRightLeft,
  Timer,
  StickyNote,
  RefreshCw,
  Loader2,
  ExternalLink,
  TrendingUp,
  FileText,
  Sparkles,
  BarChart3,
  Calendar
} from 'lucide-react'
import { formatDistanceToNow } from '@/lib/utils'
import { ActivityChart, BreakdownChart } from '@/components/charts'

interface DashboardProps {
  serverStatus: 'starting' | 'running' | 'error'
}

interface GitHubActivity {
  id: string
  type: 'commit' | 'pr' | 'review'
  title: string
  repo: string
  date: string
  url: string
}

interface JiraActivity {
  id: string
  type: 'issue' | 'transition' | 'comment' | 'worklog'
  issueKey: string
  issueSummary: string
  date: string
  url: string
  details?: {
    timeSpent?: string
  }
}

interface Note {
  id: string
  title: string
  updatedAt: string
}

interface DailySummary {
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
  aiReportStructured: {
    executiveSummary: string
    highlights: string[]
    nextSteps: string[]
  } | null
  generatedAt: string | null
}

interface HistoryData {
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

export function Dashboard({ serverStatus }: DashboardProps) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [history, setHistory] = useState<HistoryData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  // Calculate date range for last 7 days
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const fromDate = sevenDaysAgo.toISOString().split('T')[0]

  useEffect(() => {
    if (serverStatus === 'running') {
      fetchData()
    }
  }, [serverStatus])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Fetch 7-day summary and history in parallel
      const [summaryRes, historyRes] = await Promise.all([
        fetch(`http://localhost:3001/api/summary/daily?from=${fromDate}&to=${today}`),
        fetch('http://localhost:3001/api/summary/history?days=7')
      ])
      
      if (summaryRes.ok) {
        const data = await summaryRes.json()
        setSummary(data)
      }
      
      if (historyRes.ok) {
        const data = await historyRes.json()
        setHistory(data.history || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const syncData = async () => {
    setIsSyncing(true)
    try {
      // Sync last 7 days of data
      await Promise.all([
        fetch(`http://localhost:3001/api/github/activity?since=${fromDate}T00:00:00&cache=false`),
        fetch('http://localhost:3001/api/jira/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: fromDate, to: today })
        })
      ])
      await fetchData()
    } catch (error) {
      console.error('Failed to sync:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  // Calculate totals from 7-day summary
  const totalGitHub = summary ? summary.github.commits + summary.github.pullRequests + summary.github.reviews : 0
  const totalJira = summary ? summary.jira.issuesWorkedOn + summary.jira.transitions + summary.jira.comments + summary.jira.worklogs : 0
  const totalNotes = summary?.notes.count || 0
  const totalActivity = totalGitHub + totalJira + totalNotes

  // Use history for detailed breakdown by type
  const weekTotals = history.reduce((acc, day) => ({
    commits: acc.commits + day.details.commits,
    pullRequests: acc.pullRequests + day.details.pullRequests,
    reviews: acc.reviews + day.details.reviews,
    issues: acc.issues + day.details.issues,
    transitions: acc.transitions + day.details.transitions,
    comments: acc.comments + day.details.comments,
    worklogs: acc.worklogs + day.details.worklogs,
  }), {
    commits: 0, pullRequests: 0, reviews: 0,
    issues: 0, transitions: 0, comments: 0, worklogs: 0
  })

  // Recent activities from 7-day summary (combined and sorted)
  const recentActivities = summary ? [
    ...summary.github.activities.slice(0, 10).map(a => ({ ...a, source: 'github' as const })),
    ...summary.jira.activities.slice(0, 10).map(a => ({ ...a, source: 'jira' as const })),
    ...summary.notes.items.slice(0, 5).map(n => ({ 
      id: n.id, 
      title: n.title, 
      date: n.updatedAt, 
      source: 'notes' as const,
      type: 'note' as const
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8) : []

  const getActivityIcon = (activity: typeof recentActivities[0]) => {
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
    }
    return <StickyNote size={14} className="text-amber-400" />
  }

  if (serverStatus !== 'running') {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {serverStatus === 'starting' ? 'Starting server...' : 'Server error'}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        <button
          onClick={syncData}
          disabled={isSyncing}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised disabled:opacity-50"
        >
          {isSyncing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          {isSyncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stats Row - Last 7 Days */}
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Calendar size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalActivity}</p>
                  <p className="text-xs text-muted-foreground">Last 7 Days</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <GitCommit size={20} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalGitHub}</p>
                  <p className="text-xs text-muted-foreground">GitHub</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {weekTotals.commits} commits, {weekTotals.pullRequests} PRs
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Ticket size={20} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalJira}</p>
                  <p className="text-xs text-muted-foreground">JIRA</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {weekTotals.issues} issues, {weekTotals.transitions} transitions
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <StickyNote size={20} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalNotes}</p>
                  <p className="text-xs text-muted-foreground">Notes</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            {/* Activity Trend Chart */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <BarChart3 size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Activity Trend</h3>
                      <p className="text-xs text-muted-foreground">Last 7 days</p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <ActivityChart data={history} height={280} />
                </div>
              </div>
            </div>

            {/* Breakdown Chart */}
            <div>
              <div className="rounded-2xl border border-border bg-card h-full">
                <div className="flex items-center gap-3 border-b border-border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                    <Sparkles size={20} className="text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Week Breakdown</h3>
                    <p className="text-xs text-muted-foreground">By activity type</p>
                  </div>
                </div>
                <div className="p-4">
                  <BreakdownChart
                    github={{
                      commits: weekTotals.commits,
                      pullRequests: weekTotals.pullRequests,
                      reviews: weekTotals.reviews
                    }}
                    jira={{
                      issues: weekTotals.issues,
                      transitions: weekTotals.transitions,
                      comments: weekTotals.comments,
                      worklogs: weekTotals.worklogs
                    }}
                    notes={totalNotes}
                    height={240}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: AI Summary + Recent Activity */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* AI Summary Card */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                      <FileText size={20} className="text-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Today's Summary</h3>
                      {summary?.generatedAt && (
                        <p className="text-xs text-muted-foreground">
                          Generated {formatDistanceToNow(summary.generatedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/reports')}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <FileText size={14} />
                    View Reports
                  </button>
                </div>

                <div className="p-5">
                  {summary?.aiReportStructured ? (
                    <div className="space-y-4">
                      <p className="text-sm text-foreground leading-relaxed">
                        {summary.aiReportStructured.executiveSummary}
                      </p>
                      {summary.aiReportStructured.highlights.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Key Highlights</p>
                          <ul className="space-y-1">
                            {summary.aiReportStructured.highlights.slice(0, 3).map((highlight, index) => (
                              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-emerald-400">•</span>
                                <span>{highlight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : totalActivity === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FileText size={32} className="mb-3 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground mb-1">No activity yet today</p>
                      <p className="text-xs text-muted-foreground">
                        Click Sync to fetch your latest GitHub and JIRA activity.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Sparkles size={32} className="mb-3 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground mb-1">{totalActivity} activities</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Generate an AI summary in the Reports page.
                      </p>
                      <button
                        onClick={() => navigate('/reports')}
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                      >
                        <Sparkles size={14} />
                        Generate Report
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <div className="rounded-2xl border border-border bg-card h-full">
                <div className="border-b border-border p-4">
                  <h3 className="font-semibold text-foreground">Recent Activity</h3>
                  <p className="text-xs text-muted-foreground">Today</p>
                </div>

                {recentActivities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <TrendingUp size={24} className="mb-2 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">No activities yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {recentActivities.map((activity) => (
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
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(activity.date)}
                          </p>
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
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
