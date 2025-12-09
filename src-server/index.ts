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
  type AppConfig,
  type GitHubActivity,
  type JiraActivity,
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

// Get JIRA activity for a date
api.get('/jira/activity', async (c) => {
  const config = await getConfig()
  const date = c.req.query('date') || new Date().toISOString().split('T')[0]
  
  if (!config.jira.domain || !config.jira.email || !config.jira.apiToken || !config.jira.accountId) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  try {
    const domain = config.jira.domain
    const email = config.jira.email
    const apiToken = config.jira.apiToken
    const accountId = config.jira.accountId
    const projects = config.jira.projects

    // Calculate next day for date range query
    const nextDay = new Date(date)
    nextDay.setDate(nextDay.getDate() + 1)
    const nextDayStr = nextDay.toISOString().split('T')[0]

    // Build JQL query
    let jql = `assignee = "${accountId}" AND updated >= "${date}" AND updated < "${nextDayStr}"`
    if (projects.length > 0) {
      jql += ` AND project IN (${projects.map(p => `"${p}"`).join(', ')})`
    }
    jql += ' ORDER BY updated DESC'

    // Search for issues updated on the specified date (using new /search/jql API)
    const searchResult = await jiraFetch(
      `/search/jql`,
      domain,
      email,
      apiToken,
      'POST',
      {
        jql,
        maxResults: 50,
        fields: ['summary', 'status', 'project', 'updated', 'created'],
        expand: 'changelog'
      }
    )

    const activities: JiraActivity[] = []
    const baseUrl = `https://${domain}.atlassian.net`

    for (const issue of searchResult.issues || []) {
      // Add the issue itself as an activity
      activities.push({
        id: `issue-${issue.id}`,
        type: 'issue',
        issueKey: issue.key,
        issueSummary: issue.fields.summary,
        project: issue.fields.project.key,
        date: issue.fields.updated,
        url: `${baseUrl}/browse/${issue.key}`,
      })

      // Check changelog for status transitions on the target date
      if (issue.changelog?.histories) {
        for (const history of issue.changelog.histories) {
          const historyDate = new Date(history.created).toISOString().split('T')[0]
          if (historyDate === date && history.author?.accountId === accountId) {
            for (const item of history.items || []) {
              if (item.field === 'status') {
                activities.push({
                  id: `transition-${issue.id}-${history.id}`,
                  type: 'transition',
                  issueKey: issue.key,
                  issueSummary: issue.fields.summary,
                  project: issue.fields.project.key,
                  date: history.created,
                  url: `${baseUrl}/browse/${issue.key}`,
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
    }

    // Cache the activities
    await addJiraActivities(activities)

    // Group by type for summary
    const issues = activities.filter(a => a.type === 'issue')
    const transitions = activities.filter(a => a.type === 'transition')

    return c.json({
      date,
      issues,
      transitions,
      summary: {
        issuesWorkedOn: new Set(activities.map(a => a.issueKey)).size,
        transitionsMade: transitions.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch activity'
    return c.json({ error: message }, 500)
  }
})

// Get cached JIRA activity
api.get('/jira/cache', async (c) => {
  const cache = await getJiraCache()
  return c.json(cache)
})

// ============== Summary Routes ==============

api.get('/summary/daily', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().split('T')[0]
  
  // Check if we have a cached summary
  const cached = await getDailySummary(date)
  if (cached) {
    return c.json(cached)
  }

  // Otherwise return empty structure
  return c.json({
    date,
    generatedAt: null,
    commits: 0,
    pullRequests: 0,
    reviews: 0,
    aiSummary: null,
    activities: []
  })
})

api.post('/summary/generate', async (c) => {
  const { date } = await c.req.json()
  const targetDate = date || new Date().toISOString().split('T')[0]
  
  const config = await getConfig()
  
  // Fetch GitHub activity for the date
  const cache = await getGitHubCache()
  const dayStart = new Date(targetDate)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(targetDate)
  dayEnd.setHours(23, 59, 59, 999)
  
  const dayActivities = cache.activities.filter(a => {
    const actDate = new Date(a.date)
    return actDate >= dayStart && actDate <= dayEnd
  })

  const commits = dayActivities.filter(a => a.type === 'commit')
  const prs = dayActivities.filter(a => a.type === 'pr')
  const reviews = dayActivities.filter(a => a.type === 'review')

  // Generate AI summary if OpenRouter is configured
  let aiSummary: string | null = null
  
  if (config.openrouter.apiKey && dayActivities.length > 0) {
    try {
      const prompt = `Summarize this developer's workday in 2-3 sentences:
      
Commits (${commits.length}):
${commits.map(c => `- ${c.title} (${c.repo})`).join('\n') || 'None'}

Pull Requests (${prs.length}):
${prs.map(p => `- ${p.title} (${p.repo}) - ${p.status}`).join('\n') || 'None'}

Code Reviews (${reviews.length}):
${reviews.map(r => `- ${r.title} (${r.repo})`).join('\n') || 'None'}

Be concise and focus on the impact of the work done.`

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openrouter.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.openrouter.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
        })
      })

      if (response.ok) {
        const data = await response.json()
        aiSummary = data.choices?.[0]?.message?.content || null
      }
    } catch (error) {
      console.error('Failed to generate AI summary:', error)
    }
  }

  const summary = {
    date: targetDate,
    generatedAt: new Date().toISOString(),
    commits: commits.length,
    pullRequests: prs.length,
    reviews: reviews.length,
    aiSummary,
    activities: dayActivities
  }

  // Save the summary
  await saveDailySummary(summary)

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
