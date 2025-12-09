import { homedir } from 'os'
import { join } from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'

// Data directory in user's home folder
const DATA_DIR = join(homedir(), '.werkday')

// Ensure data directory exists
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }
}

// File paths
const FILES = {
  config: join(DATA_DIR, 'config.json'),
  githubCache: join(DATA_DIR, 'github-cache.json'),
  jiraCache: join(DATA_DIR, 'jira-cache.json'),
  summaries: join(DATA_DIR, 'summaries.json'),
  notes: join(DATA_DIR, 'notes.json'),
}

// Generic read/write functions
async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  await ensureDataDir()
  try {
    if (existsSync(filePath)) {
      const content = await readFile(filePath, 'utf-8')
      return JSON.parse(content) as T
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error)
  }
  return defaultValue
}

async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await ensureDataDir()
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// ============== Config Storage ==============

export interface AppConfig {
  github: {
    token: string | null
    username: string | null
    avatarUrl: string | null
    organizations: string[]
    repositories: string[]
  }
  jira: {
    domain: string | null
    email: string | null
    apiToken: string | null
    displayName: string | null
    accountId: string | null
    projects: string[]
  }
  openrouter: {
    apiKey: string | null
    model: string
  }
  preferences: {
    theme: 'dark' | 'light'
    sidebarCollapsed: boolean
  }
}

const DEFAULT_CONFIG: AppConfig = {
  github: {
    token: null,
    username: null,
    avatarUrl: null,
    organizations: [],
    repositories: [],
  },
  jira: {
    domain: null,
    email: null,
    apiToken: null,
    displayName: null,
    accountId: null,
    projects: [],
  },
  openrouter: {
    apiKey: null,
    model: 'anthropic/claude-haiku-4.5',
  },
  preferences: {
    theme: 'dark',
    sidebarCollapsed: false,
  },
}

export async function getConfig(): Promise<AppConfig> {
  const saved = await readJsonFile(FILES.config, DEFAULT_CONFIG)
  // Ensure all expected keys exist (for migration from older config versions)
  return {
    github: { ...DEFAULT_CONFIG.github, ...saved.github },
    jira: { ...DEFAULT_CONFIG.jira, ...saved.jira },
    openrouter: { ...DEFAULT_CONFIG.openrouter, ...saved.openrouter },
    preferences: { ...DEFAULT_CONFIG.preferences, ...saved.preferences },
  }
}

export async function saveConfig(config: Partial<AppConfig>): Promise<AppConfig> {
  const current = await getConfig()
  const updated = {
    ...current,
    ...config,
    github: { ...current.github, ...config.github },
    jira: { ...current.jira, ...config.jira },
    openrouter: { ...current.openrouter, ...config.openrouter },
    preferences: { ...current.preferences, ...config.preferences },
  }
  await writeJsonFile(FILES.config, updated)
  return updated
}

// ============== GitHub Cache Storage ==============

export interface GitHubActivity {
  id: string
  type: 'commit' | 'pr' | 'review' | 'issue'
  title: string
  repo: string
  date: string
  url: string
  status?: 'open' | 'merged' | 'closed'
  additions?: number
  deletions?: number
}

export interface GitHubCache {
  lastSync: string | null
  activities: GitHubActivity[]
}

const DEFAULT_GITHUB_CACHE: GitHubCache = {
  lastSync: null,
  activities: [],
}

export async function getGitHubCache(): Promise<GitHubCache> {
  return readJsonFile(FILES.githubCache, DEFAULT_GITHUB_CACHE)
}

export async function saveGitHubCache(cache: GitHubCache): Promise<void> {
  await writeJsonFile(FILES.githubCache, cache)
}

export async function addGitHubActivities(activities: GitHubActivity[]): Promise<void> {
  const cache = await getGitHubCache()
  
  // Merge activities, avoiding duplicates by ID
  const existingIds = new Set(cache.activities.map(a => a.id))
  const newActivities = activities.filter(a => !existingIds.has(a.id))
  
  cache.activities = [...newActivities, ...cache.activities]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 500) // Keep last 500 activities
  
  cache.lastSync = new Date().toISOString()
  
  await saveGitHubCache(cache)
}

// ============== Summaries Storage ==============

export interface DailySummary {
  date: string
  generatedAt: string
  commits: number
  pullRequests: number
  reviews: number
  aiSummary: string | null
  activities: GitHubActivity[]
}

export interface SummariesStore {
  summaries: Record<string, DailySummary> // keyed by date YYYY-MM-DD
}

const DEFAULT_SUMMARIES: SummariesStore = {
  summaries: {},
}

export async function getSummaries(): Promise<SummariesStore> {
  return readJsonFile(FILES.summaries, DEFAULT_SUMMARIES)
}

export async function saveDailySummary(summary: DailySummary): Promise<void> {
  const store = await getSummaries()
  store.summaries[summary.date] = summary
  await writeJsonFile(FILES.summaries, store)
}

export async function getDailySummary(date: string): Promise<DailySummary | null> {
  const store = await getSummaries()
  return store.summaries[date] || null
}

// ============== Notes Storage ==============

export interface Note {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  tags: string[]
}

export interface NotesStore {
  notes: Note[]
}

const DEFAULT_NOTES: NotesStore = {
  notes: [],
}

export async function getNotes(): Promise<Note[]> {
  const store = await readJsonFile(FILES.notes, DEFAULT_NOTES)
  return store.notes
}

export async function saveNote(note: Note): Promise<void> {
  const store = await readJsonFile(FILES.notes, DEFAULT_NOTES)
  const existingIndex = store.notes.findIndex(n => n.id === note.id)
  
  if (existingIndex >= 0) {
    store.notes[existingIndex] = note
  } else {
    store.notes.unshift(note)
  }
  
  await writeJsonFile(FILES.notes, store)
}

export async function deleteNote(id: string): Promise<void> {
  const store = await readJsonFile(FILES.notes, DEFAULT_NOTES)
  store.notes = store.notes.filter(n => n.id !== id)
  await writeJsonFile(FILES.notes, store)
}

// ============== JIRA Cache Storage ==============

export interface JiraActivity {
  id: string
  type: 'issue' | 'transition' | 'worklog' | 'comment'
  issueKey: string
  issueSummary: string
  project: string
  date: string
  url: string
  author?: string
  details?: {
    fromStatus?: string
    toStatus?: string
    timeSpent?: string
    timeSpentSeconds?: number
    commentBody?: string
    field?: string
    fromValue?: string
    toValue?: string
  }
}

export interface JiraCache {
  lastSync: string | null
  activities: JiraActivity[]
}

const DEFAULT_JIRA_CACHE: JiraCache = {
  lastSync: null,
  activities: [],
}

export async function getJiraCache(): Promise<JiraCache> {
  return readJsonFile(FILES.jiraCache, DEFAULT_JIRA_CACHE)
}

export async function saveJiraCache(cache: JiraCache): Promise<void> {
  await writeJsonFile(FILES.jiraCache, cache)
}

export async function addJiraActivities(activities: JiraActivity[]): Promise<void> {
  const cache = await getJiraCache()
  
  // Merge activities, avoiding duplicates by ID
  const existingIds = new Set(cache.activities.map(a => a.id))
  const newActivities = activities.filter(a => !existingIds.has(a.id))
  
  cache.activities = [...newActivities, ...cache.activities]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 500) // Keep last 500 activities
  
  cache.lastSync = new Date().toISOString()
  
  await saveJiraCache(cache)
}

// Export file paths for debugging
export { DATA_DIR, FILES }
