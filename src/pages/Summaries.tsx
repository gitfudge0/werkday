import { useState, useEffect } from 'react'
import { DateRange } from 'react-day-picker'
import { jsPDF } from 'jspdf'
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
  Clock,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Download
} from 'lucide-react'
import { formatDistanceToNow } from '@/lib/utils'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { useToast } from '@/components/ui/toast'

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
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasOpenRouter, setHasOpenRouter] = useState(false)
  const { showToast } = useToast()

  // Format date for API (YYYY-MM-DD) - using local timezone
  const formatDateForApi = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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

  const downloadPDF = async () => {
    if (!dateRange?.from) return
    
    setIsDownloading(true)
    setError(null)
    
    try {
      const fromDate = formatDateForApi(dateRange.from)
      const toDate = dateRange.to ? formatDateForApi(dateRange.to) : fromDate
      
      // Fetch detailed report from API
      const response = await fetch('http://localhost:3001/api/summary/generate-detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromDate, to: toDate })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate report')
      }
      
      const report = await response.json()
      
      // Generate PDF - Infographic Style
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 12
      const contentWidth = pageWidth - margin * 2
      let y = 0
      
      // Color palette - Clean blue/gray theme like the reference
      const colors = {
        primary: { r: 66, g: 133, b: 183 },      // Steel blue
        accent: { r: 192, g: 169, b: 131 },       // Warm tan/gold
        github: { r: 66, g: 133, b: 183 },        // Steel blue
        jira: { r: 192, g: 169, b: 131 },         // Tan
        notes: { r: 140, g: 140, b: 140 },        // Gray
        dark: { r: 51, g: 51, b: 51 },
        gray: { r: 120, g: 120, b: 120 },
        lightGray: { r: 230, g: 230, b: 230 },
        veryLightGray: { r: 245, g: 245, b: 245 },
        white: { r: 255, g: 255, b: 255 },
        headerBg: { r: 66, g: 133, b: 183 },
      }
      
      // Helper functions
      const setColor = (color: { r: number; g: number; b: number }) => {
        doc.setTextColor(color.r, color.g, color.b)
      }
      
      const setFill = (color: { r: number; g: number; b: number }) => {
        doc.setFillColor(color.r, color.g, color.b)
      }
      
      const setDraw = (color: { r: number; g: number; b: number }) => {
        doc.setDrawColor(color.r, color.g, color.b)
      }
      
      // Draw percentage circle (like the 35%, 34%, 31% in reference)
      const drawPercentCircle = (cx: number, cy: number, radius: number, percent: number, color: { r: number; g: number; b: number }, label: string) => {
        // Background circle
        setFill(colors.veryLightGray)
        doc.circle(cx, cy, radius, 'F')
        
        // Draw arc for percentage
        if (percent > 0) {
          const startAngle = -90
          const endAngle = startAngle + (percent / 100) * 360
          
          setFill(color)
          setDraw(color)
          doc.setLineWidth(3)
          
          // Draw arc segments
          const segments = Math.ceil(percent / 2)
          for (let i = 0; i < segments; i++) {
            const angle1 = (startAngle + (i / segments) * (endAngle - startAngle)) * Math.PI / 180
            const angle2 = (startAngle + ((i + 1) / segments) * (endAngle - startAngle)) * Math.PI / 180
            
            const x1 = cx + Math.cos(angle1) * (radius - 1.5)
            const y1 = cy + Math.sin(angle1) * (radius - 1.5)
            const x2 = cx + Math.cos(angle2) * (radius - 1.5)
            const y2 = cy + Math.sin(angle2) * (radius - 1.5)
            
            doc.line(x1, y1, x2, y2)
          }
        }
        
        // Center percentage text
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        setColor(colors.dark)
        doc.text(`${Math.round(percent)}%`, cx, cy + 2, { align: 'center' })
        
        // Label below
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        setColor(colors.gray)
        const labelLines = doc.splitTextToSize(label, radius * 2.5)
        doc.text(labelLines, cx, cy + radius + 5, { align: 'center' })
      }
      
      // Draw horizontal bar chart (like the industry chart in reference)
      const drawHorizontalBar = (x: number, barY: number, maxWidth: number, value: number, maxValue: number, color: { r: number; g: number; b: number }, label: string, showValue = true) => {
        const barHeight = 8
        const barWidth = maxValue > 0 ? (value / maxValue) * maxWidth : 0
        
        // Label on left
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        setColor(colors.dark)
        doc.text(label, x - 2, barY + 6, { align: 'right' })
        
        // Bar
        setFill(color)
        if (barWidth > 0) {
          doc.rect(x, barY, Math.max(barWidth, 2), barHeight, 'F')
        }
        
        // Value at end of bar
        if (showValue && value > 0) {
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          setColor(colors.dark)
          doc.text(value.toString(), x + barWidth + 3, barY + 6)
        }
      }
      
      // Draw big stat number (like +20 JOBS in reference)
      const drawBigStat = (x: number, statY: number, value: string, label: string, color: { r: number; g: number; b: number }, sublabel?: string) => {
        doc.setFontSize(28)
        doc.setFont('helvetica', 'bold')
        setColor(color)
        doc.text(value, x, statY, { align: 'center' })
        
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        setColor(colors.gray)
        doc.text(label.toUpperCase(), x, statY + 8, { align: 'center' })
        
        if (sublabel) {
          doc.setFontSize(6)
          doc.text(sublabel, x, statY + 13, { align: 'center' })
        }
      }
      
      const checkPageBreak = (needed: number) => {
        if (y + needed > pageHeight - 15) {
          doc.addPage()
          y = 15
          return true
        }
        return false
      }
      
      // === HEADER ===
      setFill(colors.headerBg)
      doc.rect(0, 0, pageWidth, 28, 'F')
      
      // Logo/Brand area (small circle like GE logo)
      setFill(colors.white)
      doc.circle(margin + 8, 14, 6, 'F')
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      setColor(colors.headerBg)
      doc.text('W', margin + 8, 16, { align: 'center' })
      
      // Title
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      setColor(colors.white)
      doc.text('WORK ACTIVITY BY THE NUMBERS', margin + 20, 16)
      
      y = 32
      
      // Subtitle / date info
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      setColor(colors.gray)
      doc.text(`Report Period: ${report.dateRange}  |  Generated: ${new Date(report.generatedAt).toLocaleDateString()}`, margin, y)
      
      y = 42
      
      // === TOP STATS ROW (like +20 JOBS / -2000 JOBS) ===
      const statWidth = contentWidth / 4
      
      // Draw section title
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      setColor(colors.primary)
      doc.text('Activity Overview', margin, y)
      
      y += 8
      
      // Big stats
      const stats = [
        { value: report.metrics.totalActivities.toString(), label: 'Total Activities', color: colors.primary },
        { value: report.metrics.githubTotal.toString(), label: 'GitHub', color: colors.github },
        { value: report.metrics.jiraTotal.toString(), label: 'JIRA', color: colors.jira },
        { value: report.metrics.notesTotal.toString(), label: 'Notes', color: colors.notes },
      ]
      
      stats.forEach((stat, i) => {
        const x = margin + statWidth * i + statWidth / 2
        drawBigStat(x, y + 12, stat.value, stat.label, stat.color)
      })
      
      y += 35
      
      // Divider line
      setDraw(colors.lightGray)
      doc.setLineWidth(0.5)
      doc.line(margin, y, pageWidth - margin, y)
      
      y += 8
      
      // === TWO COLUMN LAYOUT ===
      const colWidth = (contentWidth - 10) / 2
      const leftCol = margin
      const rightCol = margin + colWidth + 10
      
      // LEFT COLUMN: Activity Distribution (percentage circles)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      setColor(colors.primary)
      doc.text('Activity Distribution', leftCol, y)
      
      // RIGHT COLUMN: GitHub Breakdown (bar chart)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      setColor(colors.primary)
      doc.text('GitHub Breakdown by Type', rightCol, y)
      
      y += 8
      
      // Percentage circles (left column)
      const total = report.metrics.totalActivities || 1
      const githubPct = (report.metrics.githubTotal / total) * 100
      const jiraPct = (report.metrics.jiraTotal / total) * 100
      const notesPct = (report.metrics.notesTotal / total) * 100
      
      const circleRadius = 15
      const circleY = y + circleRadius + 5
      const circleSpacing = colWidth / 3
      
      drawPercentCircle(leftCol + circleSpacing * 0.5, circleY, circleRadius, githubPct, colors.github, 'GitHub')
      drawPercentCircle(leftCol + circleSpacing * 1.5, circleY, circleRadius, jiraPct, colors.jira, 'JIRA')
      drawPercentCircle(leftCol + circleSpacing * 2.5, circleY, circleRadius, notesPct, colors.notes, 'Notes')
      
      // Bar charts (right column)
      const barStartX = rightCol + 45
      const barMaxWidth = colWidth - 55
      let barY = y + 5
      
      const githubMax = Math.max(
        report.githubSection.commits.length,
        report.githubSection.pullRequests.length,
        report.githubSection.reviews.length,
        1
      )
      
      drawHorizontalBar(barStartX, barY, barMaxWidth, report.githubSection.commits.length, githubMax, colors.github, 'Commits')
      barY += 14
      drawHorizontalBar(barStartX, barY, barMaxWidth, report.githubSection.pullRequests.length, githubMax, colors.accent, 'Pull Requests')
      barY += 14
      drawHorizontalBar(barStartX, barY, barMaxWidth, report.githubSection.reviews.length, githubMax, colors.notes, 'Reviews')
      
      y = Math.max(circleY + circleRadius + 15, barY + 15)
      
      // === JIRA BREAKDOWN ===
      checkPageBreak(50)
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      setColor(colors.accent)
      doc.text('JIRA Activity Breakdown', leftCol, y)
      
      y += 8
      
      const jiraBarStartX = leftCol + 50
      const jiraBarMaxWidth = contentWidth - 60
      
      const jiraMax = Math.max(
        report.jiraSection.issues.length,
        report.jiraSection.transitions.length,
        report.jiraSection.worklogs.length,
        1
      )
      
      drawHorizontalBar(jiraBarStartX, y, jiraBarMaxWidth, report.jiraSection.issues.length, jiraMax, colors.jira, 'Issues')
      y += 14
      drawHorizontalBar(jiraBarStartX, y, jiraBarMaxWidth, report.jiraSection.transitions.length, jiraMax, colors.accent, 'Transitions')
      y += 14
      drawHorizontalBar(jiraBarStartX, y, jiraBarMaxWidth, report.jiraSection.worklogs.length, jiraMax, colors.notes, 'Worklogs')
      
      if (report.metrics.timeLogged) {
        y += 10
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        setColor(colors.gray)
        doc.text(`Time Logged: ${report.metrics.timeLogged}`, leftCol, y)
      }
      
      y += 15
      
      // Divider
      setDraw(colors.lightGray)
      doc.line(margin, y, pageWidth - margin, y)
      y += 10
      
      // === EXECUTIVE SUMMARY ===
      checkPageBreak(50)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      setColor(colors.primary)
      doc.text('Executive Summary', leftCol, y)
      
      y += 6
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      setColor(colors.dark)
      const summaryLines = doc.splitTextToSize(report.executiveSummary, contentWidth)
      doc.text(summaryLines, leftCol, y)
      y += summaryLines.length * 4 + 8
      
      // === KEY HIGHLIGHTS ===
      if (report.highlights && report.highlights.length > 0) {
        checkPageBreak(40)
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        setColor(colors.github)
        doc.text('Key Highlights', leftCol, y)
        
        y += 6
        
        report.highlights.forEach((highlight: string) => {
          checkPageBreak(12)
          
          // Bullet
          setFill(colors.github)
          doc.circle(leftCol + 2, y + 1, 1.5, 'F')
          
          // Text
          doc.setFontSize(8)
          doc.setFont('helvetica', 'normal')
          setColor(colors.dark)
          const lines = doc.splitTextToSize(highlight, contentWidth - 10)
          doc.text(lines, leftCol + 8, y + 2)
          y += lines.length * 4 + 3
        })
        
        y += 5
      }
      
      // === NEXT STEPS ===
      if (report.nextSteps && report.nextSteps.length > 0) {
        checkPageBreak(40)
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        setColor(colors.accent)
        doc.text('Recommended Next Steps', leftCol, y)
        
        y += 6
        
        report.nextSteps.forEach((step: string, index: number) => {
          checkPageBreak(12)
          
          // Number
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          setColor(colors.accent)
          doc.text(`${index + 1}.`, leftCol, y + 2)
          
          // Text
          doc.setFont('helvetica', 'normal')
          setColor(colors.dark)
          const lines = doc.splitTextToSize(step, contentWidth - 10)
          doc.text(lines, leftCol + 8, y + 2)
          y += lines.length * 4 + 3
        })
        
        y += 5
      }
      
      // === PAGE 2: DETAILED ACTIVITY ===
      doc.addPage()
      y = 15
      
      // Page 2 Header
      setFill(colors.headerBg)
      doc.rect(0, 0, pageWidth, 12, 'F')
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      setColor(colors.white)
      doc.text('DETAILED ACTIVITY LOG', margin, 8)
      
      y = 20
      
      // GitHub Details
      if (report.githubSection.commits.length > 0 || report.githubSection.pullRequests.length > 0) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        setColor(colors.github)
        doc.text('GitHub Activity', margin, y)
        y += 5
        
        // Commits
        if (report.githubSection.commits.length > 0) {
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          setColor(colors.dark)
          doc.text(`Commits (${report.githubSection.commits.length})`, margin, y)
          y += 4
          
          report.githubSection.commits.slice(0, 10).forEach((commit: { title: string; repo: string }) => {
            checkPageBreak(8)
            doc.setFontSize(7)
            doc.setFont('helvetica', 'normal')
            setColor(colors.gray)
            const title = commit.title.length > 70 ? commit.title.substring(0, 70) + '...' : commit.title
            doc.text(`• ${title}`, margin + 3, y)
            doc.setFontSize(6)
            doc.text(commit.repo, pageWidth - margin - doc.getTextWidth(commit.repo), y)
            y += 4
          })
          y += 4
        }
        
        // PRs
        if (report.githubSection.pullRequests.length > 0) {
          checkPageBreak(15)
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          setColor(colors.dark)
          doc.text(`Pull Requests (${report.githubSection.pullRequests.length})`, margin, y)
          y += 4
          
          report.githubSection.pullRequests.slice(0, 5).forEach((pr: { title: string; status: string }) => {
            checkPageBreak(8)
            doc.setFontSize(7)
            doc.setFont('helvetica', 'normal')
            setColor(colors.gray)
            const title = pr.title.length > 60 ? pr.title.substring(0, 60) + '...' : pr.title
            doc.text(`• ${title} [${pr.status}]`, margin + 3, y)
            y += 4
          })
          y += 4
        }
        
        y += 5
      }
      
      // JIRA Details
      if (report.jiraSection.issues.length > 0) {
        checkPageBreak(30)
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        setColor(colors.jira)
        doc.text('JIRA Activity', margin, y)
        y += 5
        
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        setColor(colors.dark)
        doc.text(`Issues (${report.jiraSection.issues.length})`, margin, y)
        y += 4
        
        report.jiraSection.issues.slice(0, 10).forEach((issue: { key: string; summary: string }) => {
          checkPageBreak(8)
          doc.setFontSize(7)
          doc.setFont('helvetica', 'bold')
          setColor(colors.jira)
          doc.text(issue.key, margin + 3, y)
          doc.setFont('helvetica', 'normal')
          setColor(colors.gray)
          const summary = issue.summary.length > 55 ? issue.summary.substring(0, 55) + '...' : issue.summary
          doc.text(summary, margin + 22, y)
          y += 4
        })
        
        y += 5
      }
      
      // === CONCLUSION ===
      checkPageBreak(30)
      
      setDraw(colors.lightGray)
      doc.line(margin, y, pageWidth - margin, y)
      y += 8
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      setColor(colors.primary)
      doc.text('Conclusion', margin, y)
      y += 5
      
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      setColor(colors.dark)
      const conclusionLines = doc.splitTextToSize(report.conclusion, contentWidth)
      doc.text(conclusionLines, margin, y)
      
      // === FOOTER ON ALL PAGES ===
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        
        // Footer line
        setDraw(colors.lightGray)
        doc.setLineWidth(0.3)
        doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10)
        
        // Footer text
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        setColor(colors.gray)
        doc.text('Generated by Werkday', margin, pageHeight - 5)
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 15, pageHeight - 5)
      }
      
      // Download
      const filename = `werkday-report-${fromDate}${toDate !== fromDate ? `-to-${toDate}` : ''}.pdf`
      doc.save(filename)
      
      // Show success toast
      showToast(`Report downloaded: ${filename}`, 'success')
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate PDF'
      setError(message)
      showToast(message, 'error')
    } finally {
      setIsDownloading(false)
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
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">AI-powered summary of your work activity</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Download PDF Button */}
          <button
            onClick={downloadPDF}
            disabled={isDownloading || totalActivity === 0 || !hasOpenRouter}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed"
            title={!hasOpenRouter ? 'Configure OpenRouter API key to generate PDF reports' : totalActivity === 0 ? 'No activity to export' : 'Download detailed PDF report'}
          >
            {isDownloading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {isDownloading ? 'Generating...' : 'Download PDF'}
          </button>

          {/* Sync Button */}
          <button
            onClick={syncData}
            disabled={isSyncing}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised disabled:opacity-50"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>

          {/* Date Range Picker */}
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
          />
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
