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
      
      // Generate PDF
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 15
      const maxWidth = pageWidth - margin * 2
      let y = 0
      
      // Color palette
      const colors = {
        primary: { r: 79, g: 70, b: 229 },      // Indigo
        github: { r: 16, g: 185, b: 129 },      // Emerald
        jira: { r: 59, g: 130, b: 246 },        // Blue
        notes: { r: 245, g: 158, b: 11 },       // Amber
        dark: { r: 31, g: 41, b: 55 },
        gray: { r: 107, g: 114, b: 128 },
        lightGray: { r: 243, g: 244, b: 246 },
        white: { r: 255, g: 255, b: 255 },
      }
      
      // Helper functions
      const setColor = (color: { r: number; g: number; b: number }) => {
        doc.setTextColor(color.r, color.g, color.b)
      }
      
      const setFillColor = (color: { r: number; g: number; b: number }) => {
        doc.setFillColor(color.r, color.g, color.b)
      }
      
      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - 20) {
          doc.addPage()
          y = 20
          return true
        }
        return false
      }
      
      // Draw donut chart
      const drawDonutChart = (centerX: number, centerY: number, radius: number, data: Array<{ value: number; color: { r: number; g: number; b: number }; label: string }>) => {
        const total = data.reduce((sum, d) => sum + d.value, 0)
        if (total === 0) return
        
        let startAngle = -Math.PI / 2
        const innerRadius = radius * 0.6
        
        data.forEach(item => {
          if (item.value === 0) return
          const sliceAngle = (item.value / total) * 2 * Math.PI
          const endAngle = startAngle + sliceAngle
          
          // Draw arc segment
          setFillColor(item.color)
          doc.setDrawColor(255, 255, 255)
          doc.setLineWidth(1)
          
          // Create path for donut segment
          const segments = 50
          const points: [number, number][] = []
          
          // Outer arc
          for (let i = 0; i <= segments; i++) {
            const angle = startAngle + (sliceAngle * i / segments)
            points.push([
              centerX + Math.cos(angle) * radius,
              centerY + Math.sin(angle) * radius
            ])
          }
          
          // Inner arc (reverse)
          for (let i = segments; i >= 0; i--) {
            const angle = startAngle + (sliceAngle * i / segments)
            points.push([
              centerX + Math.cos(angle) * innerRadius,
              centerY + Math.sin(angle) * innerRadius
            ])
          }
          
          // Draw as filled polygon
          if (points.length > 2) {
            doc.setFillColor(item.color.r, item.color.g, item.color.b)
            const firstPoint = points[0]
            doc.moveTo(firstPoint[0], firstPoint[1])
            points.slice(1).forEach(p => doc.lineTo(p[0], p[1]))
            doc.fill()
          }
          
          startAngle = endAngle
        })
        
        // Center text - total
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        setColor(colors.dark)
        doc.text(total.toString(), centerX, centerY + 2, { align: 'center' })
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        setColor(colors.gray)
        doc.text('activities', centerX, centerY + 7, { align: 'center' })
      }
      
      // Draw horizontal bar
      const drawBar = (x: number, barY: number, width: number, height: number, value: number, maxValue: number, color: { r: number; g: number; b: number }, label: string, showValue = true) => {
        // Background bar
        setFillColor(colors.lightGray)
        doc.roundedRect(x, barY, width, height, 2, 2, 'F')
        
        // Value bar
        const barWidth = maxValue > 0 ? (value / maxValue) * width : 0
        if (barWidth > 0) {
          setFillColor(color)
          doc.roundedRect(x, barY, Math.max(barWidth, 4), height, 2, 2, 'F')
        }
        
        // Label
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        setColor(colors.dark)
        doc.text(label, x, barY - 2)
        
        // Value
        if (showValue) {
          doc.setFont('helvetica', 'bold')
          doc.text(value.toString(), x + width + 5, barY + height - 1)
        }
      }
      
      // === PAGE 1: Header & Executive Summary ===
      
      // Header background
      setFillColor(colors.primary)
      doc.rect(0, 0, pageWidth, 45, 'F')
      
      // Title
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      setColor(colors.white)
      doc.text(report.title, margin, 22)
      
      // Subtitle
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`${report.dateRange}  •  Generated ${new Date(report.generatedAt).toLocaleDateString()}`, margin, 34)
      
      y = 55
      
      // === Metrics Cards Row ===
      const cardWidth = (maxWidth - 15) / 4
      const cardHeight = 35
      const cardY = y
      
      // Card backgrounds
      const cards = [
        { label: 'Total', value: report.metrics.totalActivities, color: colors.primary },
        { label: 'GitHub', value: report.metrics.githubTotal, color: colors.github },
        { label: 'JIRA', value: report.metrics.jiraTotal, color: colors.jira },
        { label: 'Notes', value: report.metrics.notesTotal, color: colors.notes },
      ]
      
      cards.forEach((card, i) => {
        const cardX = margin + i * (cardWidth + 5)
        
        // Card background
        setFillColor(colors.lightGray)
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, 'F')
        
        // Colored left border
        setFillColor(card.color)
        doc.roundedRect(cardX, cardY, 4, cardHeight, 2, 2, 'F')
        
        // Value
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        setColor(colors.dark)
        doc.text(card.value.toString(), cardX + 12, cardY + 15)
        
        // Label
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        setColor(colors.gray)
        doc.text(card.label, cardX + 12, cardY + 25)
      })
      
      y = cardY + cardHeight + 15
      
      // === Charts Section ===
      // Donut chart on left, bar charts on right
      const chartSectionY = y
      
      // Donut chart
      const donutData = [
        { value: report.metrics.githubTotal, color: colors.github, label: 'GitHub' },
        { value: report.metrics.jiraTotal, color: colors.jira, label: 'JIRA' },
        { value: report.metrics.notesTotal, color: colors.notes, label: 'Notes' },
      ]
      
      drawDonutChart(margin + 35, chartSectionY + 30, 25, donutData)
      
      // Legend below donut
      let legendY = chartSectionY + 62
      donutData.forEach(item => {
        setFillColor(item.color)
        doc.circle(margin + 15, legendY, 3, 'F')
        doc.setFontSize(8)
        setColor(colors.dark)
        doc.text(`${item.label}: ${item.value}`, margin + 22, legendY + 2)
        legendY += 10
      })
      
      // Bar charts on right side
      const barX = margin + 85
      const barWidth = maxWidth - 90
      let barY = chartSectionY + 5
      
      // GitHub breakdown
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      setColor(colors.github)
      doc.text('GitHub Breakdown', barX, barY)
      barY += 8
      
      const githubMax = Math.max(
        report.githubSection.commits.length,
        report.githubSection.pullRequests.length,
        report.githubSection.reviews.length,
        1
      )
      
      drawBar(barX, barY, barWidth, 6, report.githubSection.commits.length, githubMax, colors.github, 'Commits')
      barY += 15
      drawBar(barX, barY, barWidth, 6, report.githubSection.pullRequests.length, githubMax, { r: 124, g: 58, b: 237 }, 'Pull Requests')
      barY += 15
      drawBar(barX, barY, barWidth, 6, report.githubSection.reviews.length, githubMax, { r: 217, g: 119, b: 6 }, 'Reviews')
      barY += 20
      
      // JIRA breakdown
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      setColor(colors.jira)
      doc.text('JIRA Breakdown', barX, barY)
      barY += 8
      
      const jiraMax = Math.max(
        report.jiraSection.issues.length,
        report.jiraSection.transitions.length,
        report.jiraSection.worklogs.length,
        1
      )
      
      drawBar(barX, barY, barWidth, 6, report.jiraSection.issues.length, jiraMax, colors.jira, 'Issues')
      barY += 15
      drawBar(barX, barY, barWidth, 6, report.jiraSection.transitions.length, jiraMax, { r: 124, g: 58, b: 237 }, 'Transitions')
      barY += 15
      drawBar(barX, barY, barWidth, 6, report.jiraSection.worklogs.length, jiraMax, colors.github, 'Worklogs')
      
      y = Math.max(legendY, barY) + 15
      
      // === Executive Summary Section ===
      checkPageBreak(60)
      
      // Section header
      setFillColor(colors.primary)
      doc.roundedRect(margin, y, maxWidth, 8, 2, 2, 'F')
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      setColor(colors.white)
      doc.text('EXECUTIVE SUMMARY', margin + 5, y + 6)
      y += 15
      
      // Summary text in a box
      setFillColor({ r: 249, g: 250, b: 251 })
      const summaryLines = doc.splitTextToSize(report.executiveSummary, maxWidth - 16)
      const summaryHeight = summaryLines.length * 5 + 12
      doc.roundedRect(margin, y, maxWidth, summaryHeight, 3, 3, 'F')
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      setColor(colors.dark)
      doc.text(summaryLines, margin + 8, y + 10)
      y += summaryHeight + 10
      
      // === Key Highlights ===
      if (report.highlights && report.highlights.length > 0) {
        checkPageBreak(50)
        
        setFillColor(colors.github)
        doc.roundedRect(margin, y, maxWidth, 8, 2, 2, 'F')
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        setColor(colors.white)
        doc.text('KEY HIGHLIGHTS', margin + 5, y + 6)
        y += 15
        
        report.highlights.forEach((highlight: string, index: number) => {
          checkPageBreak(15)
          
          // Numbered circle
          setFillColor(colors.github)
          doc.circle(margin + 5, y + 2, 4, 'F')
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          setColor(colors.white)
          doc.text((index + 1).toString(), margin + 5, y + 4, { align: 'center' })
          
          // Highlight text
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          setColor(colors.dark)
          const lines = doc.splitTextToSize(highlight, maxWidth - 20)
          doc.text(lines, margin + 15, y + 3)
          y += lines.length * 5 + 6
        })
        
        y += 5
      }
      
      // === Next Steps ===
      if (report.nextSteps && report.nextSteps.length > 0) {
        checkPageBreak(50)
        
        setFillColor(colors.primary)
        doc.roundedRect(margin, y, maxWidth, 8, 2, 2, 'F')
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        setColor(colors.white)
        doc.text('RECOMMENDED NEXT STEPS', margin + 5, y + 6)
        y += 15
        
        report.nextSteps.forEach((step: string, index: number) => {
          checkPageBreak(15)
          
          // Arrow indicator
          setFillColor(colors.primary)
          doc.triangle(margin + 3, y, margin + 8, y + 3, margin + 3, y + 6, 'F')
          
          // Step text
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          setColor(colors.dark)
          const lines = doc.splitTextToSize(step, maxWidth - 20)
          doc.text(lines, margin + 15, y + 4)
          y += lines.length * 5 + 6
        })
        
        y += 5
      }
      
      // === Detailed Activity (new page) ===
      doc.addPage()
      y = 20
      
      // GitHub Details
      if (report.metrics.githubTotal > 0) {
        setFillColor(colors.github)
        doc.roundedRect(margin, y, maxWidth, 8, 2, 2, 'F')
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        setColor(colors.white)
        doc.text('GITHUB ACTIVITY DETAILS', margin + 5, y + 6)
        y += 12
        
        // Summary text
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        setColor(colors.gray)
        const ghSummaryLines = doc.splitTextToSize(report.githubSection.summary, maxWidth)
        doc.text(ghSummaryLines, margin, y + 4)
        y += ghSummaryLines.length * 4 + 8
        
        // Commits
        if (report.githubSection.commits.length > 0) {
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          setColor(colors.github)
          doc.text(`Commits (${report.githubSection.commits.length})`, margin, y)
          y += 5
          
          report.githubSection.commits.slice(0, 8).forEach((commit: { title: string; repo: string }) => {
            checkPageBreak(10)
            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            setColor(colors.dark)
            const title = commit.title.length > 60 ? commit.title.substring(0, 60) + '...' : commit.title
            doc.text(`• ${title}`, margin + 3, y)
            setColor(colors.gray)
            doc.text(commit.repo, margin + maxWidth - doc.getTextWidth(commit.repo), y)
            y += 5
          })
          y += 5
        }
        
        // PRs
        if (report.githubSection.pullRequests.length > 0) {
          checkPageBreak(20)
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          setColor({ r: 124, g: 58, b: 237 })
          doc.text(`Pull Requests (${report.githubSection.pullRequests.length})`, margin, y)
          y += 5
          
          report.githubSection.pullRequests.slice(0, 5).forEach((pr: { title: string; repo: string; status: string }) => {
            checkPageBreak(10)
            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            setColor(colors.dark)
            const title = pr.title.length > 50 ? pr.title.substring(0, 50) + '...' : pr.title
            doc.text(`• ${title} [${pr.status}]`, margin + 3, y)
            y += 5
          })
          y += 5
        }
        
        y += 5
      }
      
      // JIRA Details
      if (report.metrics.jiraTotal > 0) {
        checkPageBreak(40)
        
        setFillColor(colors.jira)
        doc.roundedRect(margin, y, maxWidth, 8, 2, 2, 'F')
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        setColor(colors.white)
        doc.text('JIRA ACTIVITY DETAILS', margin + 5, y + 6)
        y += 12
        
        // Summary text
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        setColor(colors.gray)
        const jiraSummaryLines = doc.splitTextToSize(report.jiraSection.summary, maxWidth)
        doc.text(jiraSummaryLines, margin, y + 4)
        y += jiraSummaryLines.length * 4 + 8
        
        // Issues
        if (report.jiraSection.issues.length > 0) {
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          setColor(colors.jira)
          doc.text(`Issues Worked On (${report.jiraSection.issues.length})`, margin, y)
          y += 5
          
          report.jiraSection.issues.slice(0, 8).forEach((issue: { key: string; summary: string }) => {
            checkPageBreak(10)
            doc.setFontSize(8)
            doc.setFont('helvetica', 'bold')
            setColor(colors.jira)
            doc.text(issue.key, margin + 3, y)
            doc.setFont('helvetica', 'normal')
            setColor(colors.dark)
            const summary = issue.summary.length > 50 ? issue.summary.substring(0, 50) + '...' : issue.summary
            doc.text(summary, margin + 25, y)
            y += 5
          })
          y += 5
        }
        
        // Transitions
        if (report.jiraSection.transitions.length > 0) {
          checkPageBreak(20)
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          setColor({ r: 124, g: 58, b: 237 })
          doc.text(`Status Changes (${report.jiraSection.transitions.length})`, margin, y)
          y += 5
          
          report.jiraSection.transitions.slice(0, 5).forEach((t: { key: string; from: string; to: string }) => {
            checkPageBreak(10)
            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            setColor(colors.dark)
            doc.text(`• ${t.key}: ${t.from} → ${t.to}`, margin + 3, y)
            y += 5
          })
          y += 5
        }
        
        y += 5
      }
      
      // === Conclusion ===
      checkPageBreak(40)
      
      setFillColor(colors.dark)
      doc.roundedRect(margin, y, maxWidth, 8, 2, 2, 'F')
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      setColor(colors.white)
      doc.text('CONCLUSION', margin + 5, y + 6)
      y += 15
      
      setFillColor({ r: 249, g: 250, b: 251 })
      const conclusionLines = doc.splitTextToSize(report.conclusion, maxWidth - 16)
      const conclusionHeight = conclusionLines.length * 5 + 12
      doc.roundedRect(margin, y, maxWidth, conclusionHeight, 3, 3, 'F')
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      setColor(colors.dark)
      doc.text(conclusionLines, margin + 8, y + 10)
      
      // === Footer on all pages ===
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        
        // Footer line
        doc.setDrawColor(229, 231, 235)
        doc.setLineWidth(0.5)
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
        
        // Footer text
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        setColor(colors.gray)
        doc.text('Generated by Werkday', margin, pageHeight - 6)
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pageHeight - 6)
      }
      
      // Download
      const filename = `werkday-report-${fromDate}${toDate !== fromDate ? `-to-${toDate}` : ''}.pdf`
      doc.save(filename)
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate PDF'
      setError(message)
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
