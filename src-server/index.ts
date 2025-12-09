import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import {
  getConfig,
  saveConfig,
  getGitHubCache,
  addGitHubActivities,
  saveDailySummary,
  getDailySummary,
  getNotes,
  saveNote,
  deleteNote,
  getJiraCache,
  addJiraActivities,
  getJiraDailyData,
  saveJiraDailyData,
  type AppConfig,
  type GitHubActivity,
  type JiraActivity,
  type JiraDailyData,
} from './storage'

const app = new Hono()

// GitHub API helper
const githubFetch = async (endpoint: string, token: string) => {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Werkday-App'
    }
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `GitHub API error: ${response.status}`)
  }
  
  return response.json()
}

// JIRA API helper
const jiraFetch = async (
  endpoint: string,
  domain: string,
  email: string,
  apiToken: string,
  method: string = 'GET',
  body?: any
) => {
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64')
  const response = await fetch(`https://${domain}.atlassian.net/rest/api/3${endpoint}`, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || error.errorMessages?.[0] || `JIRA API error: ${response.status}`)
  }
  
  return response.json()
}

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:5173', 'tauri://localhost'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
const api = new Hono()

// ============== GitHub Routes ==============

// Check GitHub connection status
api.get('/github/status', async (c) => {
  const config = await getConfig()
  // Token must exist and not be the masked placeholder
  const hasValidToken = !!config.github.token && config.github.token !== '***'
  return c.json({
    connected: hasValidToken,
    username: config.github.username,
    avatarUrl: config.github.avatarUrl
  })
})

// Get saved GitHub config (without exposing token)
api.get('/github/config', async (c) => {
  const config = await getConfig()
  // Check if token is valid (exists and not corrupted)
  const hasValidToken = !!config.github.token && config.github.token !== '***'
  return c.json({
    token: hasValidToken ? '***' : null,
    username: config.github.username,
    avatarUrl: config.github.avatarUrl,
    organizations: config.github.organizations,
    repositories: config.github.repositories
  })
})

// Save GitHub config
api.post('/github/config', async (c) => {
  const body = await c.req.json()
  const config = await getConfig()
  
  // Don't save masked token values
  const newToken = (body.token && body.token !== '***') ? body.token : config.github.token
  
  await saveConfig({
    github: {
      ...config.github,
      token: newToken,
      username: body.username ?? config.github.username,
      avatarUrl: body.avatarUrl ?? config.github.avatarUrl,
      organizations: body.organizations ?? config.github.organizations,
      repositories: body.repositories ?? config.github.repositories,
    }
  })
  
  return c.json({ success: true })
})

// Validate GitHub token
api.post('/github/validate', async (c) => {
  const { token } = await c.req.json()
  
  if (!token) {
    return c.json({ valid: false, error: 'Token is required' }, 400)
  }

  try {
    const user = await githubFetch('/user', token)
    
    // Save the token and user info
    const config = await getConfig()
    await saveConfig({
      github: {
        ...config.github,
        token,
        username: user.login,
        avatarUrl: user.avatar_url,
      }
    })
    
    return c.json({
      valid: true,
      username: user.login,
      name: user.name,
      avatar_url: user.avatar_url
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validation failed'
    return c.json({ valid: false, error: message }, 401)
  }
})

// Disconnect GitHub
api.post('/github/disconnect', async (c) => {
  await saveConfig({
    github: {
      token: null,
      username: null,
      avatarUrl: null,
      organizations: [],
      repositories: [],
    }
  })
  return c.json({ success: true })
})

// Get user's organizations
api.get('/github/orgs', async (c) => {
  const config = await getConfig()
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.replace('Bearer ', '') || config.github.token
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  try {
    const orgs = await githubFetch('/user/orgs', token)
    return c.json(orgs.map((org: any) => ({
      id: org.id,
      login: org.login,
      avatar_url: org.avatar_url,
      description: org.description
    })))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch orgs'
    return c.json({ error: message }, 500)
  }
})

// Get repositories for org or user
api.get('/github/repos', async (c) => {
  const config = await getConfig()
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.replace('Bearer ', '') || config.github.token
  const org = c.req.query('org')
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  try {
    let repos
    if (org && org !== config.github.username) {
      repos = await githubFetch(`/orgs/${org}/repos?per_page=100&sort=updated`, token)
    } else {
      repos = await githubFetch('/user/repos?per_page=100&sort=updated&affiliation=owner', token)
    }
    
    return c.json(repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      description: repo.description,
      updated_at: repo.updated_at
    })))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch repos'
    return c.json({ error: message }, 500)
  }
})

// Get comprehensive GitHub activity and cache it
api.get('/github/activity', async (c) => {
  const config = await getConfig()
  const token = config.github.token
  const since = c.req.query('since') || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const useCache = c.req.query('cache') !== 'false'
  
  if (!token || !config.github.username) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  // Check cache first
  if (useCache) {
    const cache = await getGitHubCache()
    if (cache.lastSync) {
      const cacheAge = Date.now() - new Date(cache.lastSync).getTime()
      // Use cache if less than 5 minutes old
      if (cacheAge < 5 * 60 * 1000) {
        const sinceDate = new Date(since)
        const filteredActivities = cache.activities.filter(
          a => new Date(a.date) >= sinceDate
        )
        return c.json({
          commits: filteredActivities.filter(a => a.type === 'commit'),
          pullRequests: filteredActivities.filter(a => a.type === 'pr'),
          reviews: filteredActivities.filter(a => a.type === 'review'),
          fromCache: true,
          lastSync: cache.lastSync
        })
      }
    }
  }

  try {
    const username = config.github.username
    const sinceDate = since.split('T')[0]

    // Fetch all activity types in parallel
    const [commitsResult, prsResult, reviewsResult] = await Promise.all([
      githubFetch(
        `/search/commits?q=author:${username}+committer-date:>=${sinceDate}&sort=committer-date&order=desc&per_page=50`,
        token
      ).catch(() => ({ items: [] })),
      githubFetch(
        `/search/issues?q=author:${username}+is:pr+updated:>=${sinceDate}&sort=updated&order=desc&per_page=50`,
        token
      ).catch(() => ({ items: [] })),
      githubFetch(
        `/search/issues?q=reviewed-by:${username}+is:pr+updated:>=${sinceDate}&sort=updated&order=desc&per_page=50`,
        token
      ).catch(() => ({ items: [] }))
    ])

    const commits = (commitsResult.items || []).map((c: any) => ({
      id: c.sha,
      type: 'commit' as const,
      title: c.commit.message.split('\n')[0],
      repo: c.repository.full_name,
      date: c.commit.committer.date,
      url: c.html_url
    }))

    const pullRequests = (prsResult.items || []).map((pr: any) => ({
      id: `pr-${pr.id}`,
      type: 'pr' as const,
      title: pr.title,
      repo: pr.repository_url.split('/').slice(-2).join('/'),
      date: pr.updated_at,
      url: pr.html_url,
      status: pr.pull_request?.merged_at ? 'merged' : pr.state as 'open' | 'closed'
    }))

    const reviews = (reviewsResult.items || [])
      .filter((r: any) => r.user.login !== username)
      .map((r: any) => ({
        id: `review-${r.id}`,
        type: 'review' as const,
        title: r.title,
        repo: r.repository_url.split('/').slice(-2).join('/'),
        date: r.updated_at,
        url: r.html_url
      }))

    // Cache the activities
    const allActivities: GitHubActivity[] = [...commits, ...pullRequests, ...reviews]
    await addGitHubActivities(allActivities)

    return c.json({
      commits,
      pullRequests,
      reviews,
      fromCache: false,
      lastSync: new Date().toISOString()
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch activity'
    return c.json({ error: message }, 500)
  }
})

// Get cached GitHub activity
api.get('/github/cache', async (c) => {
  const cache = await getGitHubCache()
  return c.json(cache)
})

// ============== JIRA Routes ==============

// Check JIRA connection status
api.get('/jira/status', async (c) => {
  const config = await getConfig()
  const hasValidToken = !!config.jira.apiToken && config.jira.apiToken !== '***'
  return c.json({
    connected: hasValidToken && !!config.jira.domain,
    displayName: config.jira.displayName,
    domain: config.jira.domain,
  })
})

// Get saved JIRA config (without exposing token)
api.get('/jira/config', async (c) => {
  const config = await getConfig()
  const hasValidToken = !!config.jira.apiToken && config.jira.apiToken !== '***'
  return c.json({
    domain: config.jira.domain,
    email: config.jira.email,
    apiToken: hasValidToken ? '***' : null,
    displayName: config.jira.displayName,
    projects: config.jira.projects,
  })
})

// Save JIRA config
api.post('/jira/config', async (c) => {
  const body = await c.req.json()
  const config = await getConfig()
  
  // Don't save masked token values
  const newToken = (body.apiToken && body.apiToken !== '***') ? body.apiToken : config.jira.apiToken
  
  await saveConfig({
    jira: {
      ...config.jira,
      domain: body.domain ?? config.jira.domain,
      email: body.email ?? config.jira.email,
      apiToken: newToken,
      projects: body.projects ?? config.jira.projects,
    }
  })
  
  return c.json({ success: true })
})

// Validate JIRA credentials
api.post('/jira/validate', async (c) => {
  const { domain, email, apiToken } = await c.req.json()
  
  if (!domain || !email || !apiToken) {
    return c.json({ valid: false, error: 'All fields are required' }, 400)
  }

  try {
    const user = await jiraFetch('/myself', domain, email, apiToken)
    
    // Save the credentials and user info
    const config = await getConfig()
    await saveConfig({
      jira: {
        ...config.jira,
        domain,
        email,
        apiToken,
        displayName: user.displayName,
        accountId: user.accountId,
      }
    })
    
    return c.json({
      valid: true,
      displayName: user.displayName,
      accountId: user.accountId,
      emailAddress: user.emailAddress,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validation failed'
    return c.json({ valid: false, error: message }, 401)
  }
})

// Disconnect JIRA
api.post('/jira/disconnect', async (c) => {
  await saveConfig({
    jira: {
      domain: null,
      email: null,
      apiToken: null,
      displayName: null,
      accountId: null,
      projects: [],
    }
  })
  return c.json({ success: true })
})

// Get JIRA projects
api.get('/jira/projects', async (c) => {
  const config = await getConfig()
  
  if (!config.jira.domain || !config.jira.email || !config.jira.apiToken) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  try {
    const response = await jiraFetch(
      '/project/search?maxResults=100&orderBy=name',
      config.jira.domain,
      config.jira.email,
      config.jira.apiToken
    )
    
    return c.json(response.values.map((project: any) => ({
      id: project.id,
      key: project.key,
      name: project.name,
      avatarUrls: project.avatarUrls,
    })))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch projects'
    return c.json({ error: message }, 500)
  }
})

// Helper to extract plain text from Atlassian Document Format (ADF)
function extractTextFromADF(adf: any): string {
  if (!adf || !adf.content) return ''
  
  const extractFromNode = (node: any): string => {
    if (node.type === 'text') {
      return node.text || ''
    }
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extractFromNode).join('')
    }
    return ''
  }
  
  return adf.content.map(extractFromNode).join('\n').trim()
}

// Get JIRA activity for a date range (reads from local cache only)
api.get('/jira/activity', async (c) => {
  const config = await getConfig()
  const fromDate = c.req.query('from') || c.req.query('date') || new Date().toISOString().split('T')[0]
  const toDate = c.req.query('to') || fromDate
  
  if (!config.jira.domain || !config.jira.email || !config.jira.apiToken || !config.jira.accountId) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  // Generate all dates in range
  const dates: string[] = []
  const current = new Date(fromDate)
  const end = new Date(toDate)
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }

  // Read from local cache for all dates
  let allActivities: JiraActivity[] = []
  let latestSyncedAt: string | null = null
  let allSynced = true

  for (const date of dates) {
    const cachedData = await getJiraDailyData(date)
    if (!cachedData) {
      allSynced = false
    } else {
      allActivities = allActivities.concat(cachedData.activities)
      if (!latestSyncedAt || (cachedData.syncedAt && cachedData.syncedAt > latestSyncedAt)) {
        latestSyncedAt = cachedData.syncedAt
      }
    }
  }

  if (!allSynced || allActivities.length === 0) {
    // No data synced for this date range
    return c.json({
      from: fromDate,
      to: toDate,
      synced: false,
      syncedAt: null,
      issues: [],
      transitions: [],
      comments: [],
      worklogs: [],
      summary: {
        issuesWorkedOn: 0,
        transitionsMade: 0,
        commentsMade: 0,
        worklogsAdded: 0,
        totalTimeLogged: null,
      },
    })
  }

  // Dedupe activities by id
  const seenIds = new Set<string>()
  allActivities = allActivities.filter(a => {
    if (seenIds.has(a.id)) return false
    seenIds.add(a.id)
    return true
  })

  // Return cached data
  const issues = allActivities.filter(a => a.type === 'issue')
  const transitions = allActivities.filter(a => a.type === 'transition')
  const comments = allActivities.filter(a => a.type === 'comment')
  const worklogs = allActivities.filter(a => a.type === 'worklog')

  // Calculate totals
  const uniqueIssues = new Set(allActivities.map(a => a.issueKey))
  const totalTimeSeconds = worklogs.reduce((acc, w) => acc + (w.details?.timeSpentSeconds || 0), 0)
  const totalTimeHours = Math.round(totalTimeSeconds / 3600 * 10) / 10

  return c.json({
    from: fromDate,
    to: toDate,
    synced: true,
    syncedAt: latestSyncedAt,
    issues,
    transitions,
    comments,
    worklogs,
    summary: {
      issuesWorkedOn: uniqueIssues.size,
      transitionsMade: transitions.length,
      commentsMade: comments.length,
      worklogsAdded: worklogs.length,
      totalTimeLogged: totalTimeHours > 0 ? `${totalTimeHours}h` : null,
    },
  })
})

// Sync JIRA activity for a date range (fetches from JIRA API and saves to local cache)
api.post('/jira/sync', async (c) => {
  const config = await getConfig()
  const body = await c.req.json().catch(() => ({}))
  const fromDate = body.from || body.date || new Date().toISOString().split('T')[0]
  const toDate = body.to || fromDate
  
  if (!config.jira.domain || !config.jira.email || !config.jira.apiToken || !config.jira.accountId) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  try {
    const domain = config.jira.domain
    const email = config.jira.email
    const apiToken = config.jira.apiToken
    const accountId = config.jira.accountId
    const projects = config.jira.projects

    // Generate all dates in range
    const dates: string[] = []
    const current = new Date(fromDate)
    const end = new Date(toDate)
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }

    console.log('[JIRA Sync] Syncing', dates.length, 'days:', fromDate, 'to', toDate)

    // Sync each day individually
    let allActivities: JiraActivity[] = []
    let latestSyncedAt: string | null = null

    for (const date of dates) {
      // Calculate next day for date range query
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)
      const nextDayStr = nextDay.toISOString().split('T')[0]

      // Build JQL query - get ALL issues updated on the date, then filter by who made changes
      let jql = `updated >= "${date}" AND updated < "${nextDayStr}"`
      if (projects.length > 0) {
        jql += ` AND project IN (${projects.map(p => `"${p}"`).join(', ')})`
      }
      jql += ' ORDER BY updated DESC'

      console.log('[JIRA Sync] JQL Query for', date, ':', jql)

      // Search for issues updated on the specified date
      const searchResult = await jiraFetch(
        `/search/jql`,
        domain,
        email,
        apiToken,
        'POST',
        {
          jql,
          maxResults: 100,
          fields: ['summary', 'status', 'project', 'updated', 'created', 'comment', 'worklog'],
          expand: 'changelog'
        }
      )

      const dayActivities: JiraActivity[] = []
      const baseUrl = `https://${domain}.atlassian.net`
      const issuesWithUserActivity = new Set<string>()

      for (const issue of searchResult.issues || []) {
        let hasActivity = false

        // Check changelog for status changes on the target date (any user)
        if (issue.changelog?.histories) {
          for (const history of issue.changelog.histories) {
            const historyDate = new Date(history.created).toISOString().split('T')[0]
            if (historyDate === date) {
              for (const item of history.items || []) {
                if (item.field === 'status') {
                  hasActivity = true
                  dayActivities.push({
                    id: `transition-${issue.id}-${history.id}`,
                    type: 'transition',
                    issueKey: issue.key,
                    issueSummary: issue.fields.summary,
                    project: issue.fields.project.key,
                    date: history.created,
                    url: `${baseUrl}/browse/${issue.key}`,
                    author: history.author?.displayName,
                    details: {
                      fromStatus: item.fromString,
                      toStatus: item.toString,
                    },
                  })
                }
              }
            }
          }
        }

        // Check comments on the target date (any user)
        if (issue.fields.comment?.comments) {
          for (const comment of issue.fields.comment.comments) {
            const commentDate = new Date(comment.created).toISOString().split('T')[0]
            if (commentDate === date) {
              hasActivity = true
              const commentText = extractTextFromADF(comment.body)
              dayActivities.push({
                id: `comment-${issue.id}-${comment.id}`,
                type: 'comment',
                issueKey: issue.key,
                issueSummary: issue.fields.summary,
                project: issue.fields.project.key,
                date: comment.created,
                url: `${baseUrl}/browse/${issue.key}?focusedCommentId=${comment.id}`,
                author: comment.author?.displayName,
                details: {
                  commentBody: commentText.length > 200 ? commentText.substring(0, 200) + '...' : commentText,
                },
              })
            }
          }
        }

        // Check worklogs on the target date (any user)
        if (issue.fields.worklog?.worklogs) {
          for (const worklog of issue.fields.worklog.worklogs) {
            const worklogDate = new Date(worklog.started).toISOString().split('T')[0]
            if (worklogDate === date) {
              hasActivity = true
              dayActivities.push({
                id: `worklog-${issue.id}-${worklog.id}`,
                type: 'worklog',
                issueKey: issue.key,
                issueSummary: issue.fields.summary,
                project: issue.fields.project.key,
                date: worklog.started,
                url: `${baseUrl}/browse/${issue.key}?focusedWorklogId=${worklog.id}`,
                author: worklog.author?.displayName,
                details: {
                  timeSpent: worklog.timeSpent,
                  timeSpentSeconds: worklog.timeSpentSeconds,
                  commentBody: worklog.comment ? extractTextFromADF(worklog.comment) : undefined,
                },
              })
            }
          }
        }

        // Add the issue itself if there was any activity on it
        if (hasActivity) {
          issuesWithUserActivity.add(issue.key)
          dayActivities.push({
            id: `issue-${issue.id}`,
            type: 'issue',
            issueKey: issue.key,
            issueSummary: issue.fields.summary,
            project: issue.fields.project.key,
            date: issue.fields.updated,
            url: `${baseUrl}/browse/${issue.key}`,
          })
        }
      }

      // Group by type for summary
      const dayIssues = dayActivities.filter(a => a.type === 'issue')
      const dayTransitions = dayActivities.filter(a => a.type === 'transition')
      const dayComments = dayActivities.filter(a => a.type === 'comment')
      const dayWorklogs = dayActivities.filter(a => a.type === 'worklog')

      // Calculate total time logged for this day
      const totalTimeSeconds = dayWorklogs.reduce((acc, w) => acc + (w.details?.timeSpentSeconds || 0), 0)
      const totalTimeHours = Math.round(totalTimeSeconds / 3600 * 10) / 10

      const daySummary = {
        issuesWorkedOn: issuesWithUserActivity.size,
        transitionsMade: dayTransitions.length,
        commentsMade: dayComments.length,
        worklogsAdded: dayWorklogs.length,
        totalTimeLogged: totalTimeHours > 0 ? `${totalTimeHours}h` : null,
      }

      // Save to local date-based cache
      const syncedAt = new Date().toISOString()
      const dailyData: JiraDailyData = {
        date,
        syncedAt,
        activities: dayActivities,
        summary: daySummary,
      }
      await saveJiraDailyData(dailyData)
      latestSyncedAt = syncedAt

      // Accumulate all activities
      allActivities = allActivities.concat(dayActivities)

      console.log('[JIRA Sync] Synced', dayActivities.length, 'activities for', date)
    }

    // Also update the legacy cache for backwards compatibility
    await addJiraActivities(allActivities)

    // Return aggregated results
    const issues = allActivities.filter(a => a.type === 'issue')
    const transitions = allActivities.filter(a => a.type === 'transition')
    const comments = allActivities.filter(a => a.type === 'comment')
    const worklogs = allActivities.filter(a => a.type === 'worklog')

    // Calculate totals
    const uniqueIssues = new Set(allActivities.map(a => a.issueKey))
    const totalTimeSeconds = worklogs.reduce((acc, w) => acc + (w.details?.timeSpentSeconds || 0), 0)
    const totalTimeHours = Math.round(totalTimeSeconds / 3600 * 10) / 10

    return c.json({
      from: fromDate,
      to: toDate,
      synced: true,
      syncedAt: latestSyncedAt,
      issues,
      transitions,
      comments,
      worklogs,
      summary: {
        issuesWorkedOn: uniqueIssues.size,
        transitionsMade: transitions.length,
        commentsMade: comments.length,
        worklogsAdded: worklogs.length,
        totalTimeLogged: totalTimeHours > 0 ? `${totalTimeHours}h` : null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync activity'
    console.error('[JIRA Sync] Error:', message)
    return c.json({ error: message }, 500)
  }
})

// Get cached JIRA activity
api.get('/jira/cache', async (c) => {
  const cache = await getJiraCache()
  return c.json(cache)
})

// ============== Summary Routes ==============

// Get historical activity data for charts (aggregated by day)
api.get('/summary/history', async (c) => {
  const days = parseInt(c.req.query('days') || '7')
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days + 1)

  const history: Array<{
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
  }> = []

  // Get GitHub cache once
  const githubCache = await getGitHubCache()
  const allNotes = await getNotes()

  // Iterate through each day
  const current = new Date(startDate)
  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0]
    
    // GitHub activities for this day
    const dayStart = new Date(dateStr)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dateStr)
    dayEnd.setHours(23, 59, 59, 999)
    
    const dayGithubActivities = githubCache.activities.filter(a => {
      const actDate = new Date(a.date)
      return actDate >= dayStart && actDate <= dayEnd
    })
    const commits = dayGithubActivities.filter(a => a.type === 'commit').length
    const pullRequests = dayGithubActivities.filter(a => a.type === 'pr').length
    const reviews = dayGithubActivities.filter(a => a.type === 'review').length

    // JIRA activities for this day
    const jiraData = await getJiraDailyData(dateStr)
    const jiraActivities = jiraData?.activities || []
    const issues = jiraActivities.filter(a => a.type === 'issue').length
    const transitions = jiraActivities.filter(a => a.type === 'transition').length
    const jiraComments = jiraActivities.filter(a => a.type === 'comment').length
    const worklogs = jiraActivities.filter(a => a.type === 'worklog').length
    const totalTimeSeconds = jiraActivities
      .filter(a => a.type === 'worklog')
      .reduce((acc, w) => acc + (w.details?.timeSpentSeconds || 0), 0)
    const totalTimeHours = Math.round(totalTimeSeconds / 3600 * 10) / 10

    // Notes for this day
    const dayNotes = allNotes.filter(n => {
      const noteDate = new Date(n.updatedAt).toISOString().split('T')[0]
      return noteDate === dateStr
    }).length

    const githubTotal = commits + pullRequests + reviews
    const jiraTotal = issues + transitions + jiraComments + worklogs

    history.push({
      date: dateStr,
      github: githubTotal,
      jira: jiraTotal,
      notes: dayNotes,
      total: githubTotal + jiraTotal + dayNotes,
      details: {
        commits,
        pullRequests,
        reviews,
        issues,
        transitions,
        comments: jiraComments,
        worklogs,
        timeLogged: totalTimeHours > 0 ? `${totalTimeHours}h` : null
      }
    })

    current.setDate(current.getDate() + 1)
  }

  return c.json({
    days,
    from: startDate.toISOString().split('T')[0],
    to: endDate.toISOString().split('T')[0],
    history
  })
})

api.get('/summary/daily', async (c) => {
  const fromDate = c.req.query('from') || c.req.query('date') || new Date().toISOString().split('T')[0]
  const toDate = c.req.query('to') || fromDate
  
  // For single date, check cached summary
  if (fromDate === toDate) {
    const cached = await getDailySummary(fromDate)
    if (cached) {
      return c.json(cached)
    }
  }

  // Generate all dates in range
  const dates: string[] = []
  const current = new Date(fromDate)
  const end = new Date(toDate)
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }

  // Aggregate GitHub data
  const githubCache = await getGitHubCache()
  const rangeStart = new Date(fromDate)
  rangeStart.setHours(0, 0, 0, 0)
  const rangeEnd = new Date(toDate)
  rangeEnd.setHours(23, 59, 59, 999)
  
  const githubActivities = githubCache.activities.filter(a => {
    const actDate = new Date(a.date)
    return actDate >= rangeStart && actDate <= rangeEnd
  })

  // Aggregate JIRA data from all dates
  let allJiraActivities: JiraActivity[] = []
  for (const date of dates) {
    const jiraData = await getJiraDailyData(date)
    if (jiraData?.activities) {
      allJiraActivities = allJiraActivities.concat(jiraData.activities)
    }
  }

  // Aggregate Notes data
  const allNotes = await getNotes()
  const rangeNotes = allNotes.filter(n => {
    const noteDate = new Date(n.updatedAt).toISOString().split('T')[0]
    return noteDate >= fromDate && noteDate <= toDate
  })

  // Calculate stats
  const commits = githubActivities.filter(a => a.type === 'commit')
  const prs = githubActivities.filter(a => a.type === 'pr')
  const reviews = githubActivities.filter(a => a.type === 'review')
  const jiraIssues = allJiraActivities.filter(a => a.type === 'issue')
  const jiraTransitions = allJiraActivities.filter(a => a.type === 'transition')
  const jiraComments = allJiraActivities.filter(a => a.type === 'comment')
  const jiraWorklogs = allJiraActivities.filter(a => a.type === 'worklog')
  const totalTimeSeconds = jiraWorklogs.reduce((acc, w) => acc + (w.details?.timeSpentSeconds || 0), 0)
  const totalTimeHours = Math.round(totalTimeSeconds / 3600 * 10) / 10

  return c.json({
    from: fromDate,
    to: toDate,
    date: fromDate, // backwards compatibility
    generatedAt: null,
    github: {
      commits: commits.length,
      pullRequests: prs.length,
      reviews: reviews.length,
      activities: githubActivities
    },
    jira: {
      issuesWorkedOn: jiraIssues.length,
      transitions: jiraTransitions.length,
      comments: jiraComments.length,
      worklogs: jiraWorklogs.length,
      timeLogged: totalTimeHours > 0 ? `${totalTimeHours}h` : null,
      activities: allJiraActivities
    },
    notes: {
      count: rangeNotes.length,
      items: rangeNotes
    },
    aiReport: null
  })
})

api.post('/summary/generate', async (c) => {
  const body = await c.req.json()
  const fromDate = body.from || body.date || new Date().toISOString().split('T')[0]
  const toDate = body.to || fromDate
  
  const config = await getConfig()

  // Generate all dates in range
  const dates: string[] = []
  const current = new Date(fromDate)
  const end = new Date(toDate)
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  const isRange = dates.length > 1
  
  // === Aggregate GitHub Data ===
  const githubCache = await getGitHubCache()
  const rangeStart = new Date(fromDate)
  rangeStart.setHours(0, 0, 0, 0)
  const rangeEnd = new Date(toDate)
  rangeEnd.setHours(23, 59, 59, 999)
  
  const githubActivities = githubCache.activities.filter(a => {
    const actDate = new Date(a.date)
    return actDate >= rangeStart && actDate <= rangeEnd
  })

  const commits = githubActivities.filter(a => a.type === 'commit')
  const prs = githubActivities.filter(a => a.type === 'pr')
  const reviews = githubActivities.filter(a => a.type === 'review')

  // === Aggregate JIRA Data ===
  let allJiraActivities: JiraActivity[] = []
  for (const date of dates) {
    const jiraData = await getJiraDailyData(date)
    if (jiraData?.activities) {
      allJiraActivities = allJiraActivities.concat(jiraData.activities)
    }
  }
  const jiraIssues = allJiraActivities.filter(a => a.type === 'issue')
  const jiraTransitions = allJiraActivities.filter(a => a.type === 'transition')
  const jiraComments = allJiraActivities.filter(a => a.type === 'comment')
  const jiraWorklogs = allJiraActivities.filter(a => a.type === 'worklog')
  const totalTimeSeconds = jiraWorklogs.reduce((acc, w) => acc + (w.details?.timeSpentSeconds || 0), 0)
  const totalTimeHours = Math.round(totalTimeSeconds / 3600 * 10) / 10

  // === Aggregate Notes Data ===
  const allNotes = await getNotes()
  const rangeNotes = allNotes.filter(n => {
    const noteDate = new Date(n.updatedAt).toISOString().split('T')[0]
    return noteDate >= fromDate && noteDate <= toDate
  })

  // === Generate AI Report ===
  let aiReport: string | null = null
  
  const totalActivity = commits.length + prs.length + reviews.length + 
    jiraIssues.length + jiraTransitions.length + jiraComments.length + jiraWorklogs.length +
    rangeNotes.length

  // Structured AI report
  let aiReportStructured: {
    executiveSummary: string
    highlights: string[]
    nextSteps: string[]
  } | null = null

  if (config.openrouter.apiKey && totalActivity > 0) {
    try {
      const prompt = `You are a JSON generator. Based on this developer's work activity, generate a structured summary.

Activity:
- ${commits.length} commits: ${commits.slice(0, 5).map(c => c.title).join(', ') || 'none'}
- ${prs.length} pull requests, ${reviews.length} code reviews
- ${jiraIssues.length} JIRA issues: ${jiraIssues.slice(0, 3).map(i => `${i.issueKey} ${i.issueSummary}`).join(', ') || 'none'}
- ${jiraTransitions.length} status changes${totalTimeHours > 0 ? `, ${totalTimeHours}h logged` : ''}
- ${rangeNotes.length} notes

Respond with ONLY a JSON object, no other text before or after:
{"executiveSummary": "2-3 sentences summarizing accomplishments", "highlights": ["accomplishment 1", "accomplishment 2", "accomplishment 3"], "nextSteps": ["next step 1", "next step 2"]}

Requirements:
- executiveSummary: Brief professional overview of work done
- highlights: ${isRange ? '4-5' : '3-4'} specific accomplishments (NOT metrics like "5 commits")
- nextSteps: 2-3 logical follow-up tasks based on the work done`

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openrouter.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.openrouter.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: isRange ? 500 : 400
        })
      })

      if (response.ok) {
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content
        if (content) {
          try {
            // Clean up any markdown code blocks or extra text
            let cleanJson = content.trim()
            // Remove markdown code blocks
            cleanJson = cleanJson.replace(/```json\n?/g, '').replace(/```\n?/g, '')
            // Try to extract JSON object if there's extra text
            const jsonMatch = cleanJson.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              cleanJson = jsonMatch[0]
            }
            aiReportStructured = JSON.parse(cleanJson)
            console.log('[AI Report] Successfully parsed structured report')
          } catch (e) {
            console.error('[AI Report] Failed to parse JSON response:', e)
            console.error('[AI Report] Raw content:', content.substring(0, 500))
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('[AI Report] API error:', response.status, errorData)
      }
    } catch (error) {
      console.error('Failed to generate AI report:', error)
    }
  }

  const summary = {
    from: fromDate,
    to: toDate,
    date: fromDate, // backwards compatibility
    generatedAt: new Date().toISOString(),
    github: {
      commits: commits.length,
      pullRequests: prs.length,
      reviews: reviews.length,
      activities: githubActivities
    },
    jira: {
      issuesWorkedOn: jiraIssues.length,
      transitions: jiraTransitions.length,
      comments: jiraComments.length,
      worklogs: jiraWorklogs.length,
      timeLogged: totalTimeHours > 0 ? `${totalTimeHours}h` : null,
      activities: allJiraActivities
    },
    notes: {
      count: rangeNotes.length,
      items: rangeNotes
    },
    aiReport,
    aiReportStructured,
    // Legacy fields for backwards compatibility
    commits: commits.length,
    pullRequests: prs.length,
    reviews: reviews.length,
    aiSummary: aiReport,
    activities: githubActivities
  }

  // Save the summary (for single date only)
  if (!isRange) {
    await saveDailySummary(summary)
  }

  return c.json(summary)
})

// ============== Notes Routes ==============

api.get('/notes', async (c) => {
  const notes = await getNotes()
  return c.json(notes)
})

api.post('/notes', async (c) => {
  const body = await c.req.json()
  const note = {
    id: body.id || crypto.randomUUID(),
    title: body.title || 'Untitled',
    content: body.content || '',
    createdAt: body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: body.tags || []
  }
  await saveNote(note)
  return c.json(note)
})

api.delete('/notes/:id', async (c) => {
  const id = c.req.param('id')
  await deleteNote(id)
  return c.json({ success: true })
})

// ============== Config Routes ==============

api.get('/config', async (c) => {
  const config = await getConfig()
  // Don't expose sensitive tokens, but also check for corrupted values
  const hasValidGithubToken = !!config.github.token && config.github.token !== '***'
  const hasValidOpenrouterKey = !!config.openrouter.apiKey && config.openrouter.apiKey !== '***'
  return c.json({
    ...config,
    github: {
      ...config.github,
      token: hasValidGithubToken ? '***' : null
    },
    openrouter: {
      ...config.openrouter,
      apiKey: hasValidOpenrouterKey ? '***' : null
    }
  })
})

api.post('/config', async (c) => {
  const body = await c.req.json()
  const updated = await saveConfig(body)
  return c.json({ success: true })
})

api.post('/config/openrouter', async (c) => {
  const { apiKey, model } = await c.req.json()
  const config = await getConfig()
  
  // Don't save masked apiKey values, but allow explicit null to disconnect
  const newApiKey = apiKey === null ? null : 
                    (apiKey && apiKey !== '***') ? apiKey : config.openrouter.apiKey
  
  await saveConfig({
    openrouter: {
      apiKey: newApiKey,
      model: model ?? config.openrouter.model
    }
  })
  return c.json({ success: true })
})

// ============== Legacy Routes ==============

api.get('/integrations/github/activity', async (c) => {
  const { since } = c.req.query()
  const queryString = since ? `?since=${since}` : ''
  return c.redirect(`/api/github/activity${queryString}`)
})

api.get('/integrations/jira/activity', async (c) => {
  const { date } = c.req.query()
  const queryString = date ? `?date=${date}` : ''
  return c.redirect(`/api/jira/activity${queryString}`)
})

api.post('/entries/manual', async (c) => {
  const body = await c.req.json()
  return c.json({
    id: crypto.randomUUID(),
    ...body,
    createdAt: new Date().toISOString(),
  })
})

app.route('/api', api)

// Start server
const port = parseInt(process.env.PORT || '3001')
console.log(`Werkday server starting on port ${port}`)

export default {
  port,
  fetch: app.fetch,
}
