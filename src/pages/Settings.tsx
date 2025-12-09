import { useState, useEffect } from 'react'
import { 
  Github, 
  Check, 
  Eye, 
  EyeOff,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Building2,
  Folder,
  AlertCircle,
  Loader2,
  Trash2,
  Sparkles,
  ExternalLink
} from 'lucide-react'

interface Organization {
  id: number
  login: string
  avatar_url: string
}

interface Repository {
  id: number
  name: string
  full_name: string
  private: boolean
  description?: string
}

interface GitHubConfig {
  token: string
  username: string
  organizations: string[]
  repositories: string[]
}

// Default model - Claude Haiku 4.5 for fast, cost-effective summaries
const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5'

export function Settings() {
  
  // GitHub State
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  
  // Org & Repo State
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([])
  const [repositories, setRepositories] = useState<Record<string, Repository[]>>({})
  const [selectedRepos, setSelectedRepos] = useState<string[]>([])
  const [expandedOrgs, setExpandedOrgs] = useState<string[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [loadingRepos, setLoadingRepos] = useState<string | null>(null)

  // OpenRouter State
  const [openrouterKey, setOpenrouterKey] = useState('')
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false)
  const [isOpenrouterConnected, setIsOpenrouterConnected] = useState(false)
  const [openrouterError, setOpenrouterError] = useState<string | null>(null)
  const [isSavingOpenrouter, setIsSavingOpenrouter] = useState(false)
  const [openrouterSaved, setOpenrouterSaved] = useState(false)

  // Load saved config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Load GitHub config
        const githubResponse = await fetch('http://localhost:3001/api/github/config')
        if (githubResponse.ok) {
          const config: GitHubConfig = await githubResponse.json()
          if (config.token) {
            setToken(config.token)
            setIsConnected(true)
            setUsername(config.username)
            setSelectedOrgs(config.organizations || [])
            setSelectedRepos(config.repositories || [])
            fetchOrganizations(config.token)
          }
        }

        // Load full config for OpenRouter
        const configResponse = await fetch('http://localhost:3001/api/config')
        if (configResponse.ok) {
          const config = await configResponse.json()
          if (config.openrouter?.apiKey) {
            setOpenrouterKey(config.openrouter.apiKey)
            setIsOpenrouterConnected(true)
          }
        }
      } catch (error) {
        console.error('Failed to load config:', error)
      }
    }
    loadConfig()
  }, [])

  const fetchOrganizations = async (accessToken: string) => {
    setLoadingOrgs(true)
    try {
      const response = await fetch('http://localhost:3001/api/github/orgs', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (response.ok) {
        const orgs = await response.json()
        setOrganizations(orgs)
      }
    } catch (error) {
      console.error('Failed to fetch orgs:', error)
    } finally {
      setLoadingOrgs(false)
    }
  }

  const fetchRepositories = async (org: string) => {
    setLoadingRepos(org)
    try {
      const response = await fetch(`http://localhost:3001/api/github/repos?org=${org}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const repos = await response.json()
        setRepositories(prev => ({ ...prev, [org]: repos }))
      }
    } catch (error) {
      console.error('Failed to fetch repos:', error)
    } finally {
      setLoadingRepos(null)
    }
  }

  const validateToken = async () => {
    if (!token.trim()) {
      setConnectionError('Please enter a token')
      return
    }

    setIsValidating(true)
    setConnectionError(null)

    try {
      const response = await fetch('http://localhost:3001/api/github/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      const data = await response.json()

      if (response.ok && data.valid) {
        setIsConnected(true)
        setUsername(data.username)
        fetchOrganizations(token)
      } else {
        setConnectionError(data.error || 'Invalid token')
        setIsConnected(false)
      }
    } catch (error) {
      setConnectionError('Failed to validate token')
      setIsConnected(false)
    } finally {
      setIsValidating(false)
    }
  }

  const disconnectGitHub = async () => {
    try {
      await fetch('http://localhost:3001/api/github/disconnect', { method: 'POST' })
      setToken('')
      setIsConnected(false)
      setUsername(null)
      setOrganizations([])
      setSelectedOrgs([])
      setRepositories({})
      setSelectedRepos([])
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  const saveGitHubConfig = async () => {
    try {
      await fetch('http://localhost:3001/api/github/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          username,
          organizations: selectedOrgs,
          repositories: selectedRepos
        })
      })
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }

  const toggleOrg = (orgLogin: string) => {
    if (expandedOrgs.includes(orgLogin)) {
      setExpandedOrgs(prev => prev.filter(o => o !== orgLogin))
    } else {
      setExpandedOrgs(prev => [...prev, orgLogin])
      if (!repositories[orgLogin]) {
        fetchRepositories(orgLogin)
      }
    }
  }

  const toggleRepoSelection = (repoFullName: string) => {
    setSelectedRepos(prev => 
      prev.includes(repoFullName) 
        ? prev.filter(r => r !== repoFullName)
        : [...prev, repoFullName]
    )
  }

  // OpenRouter functions
  const saveOpenrouterConfig = async () => {
    if (!openrouterKey.trim()) {
      setOpenrouterError('Please enter an API key')
      return
    }

    setIsSavingOpenrouter(true)
    setOpenrouterError(null)

    try {
      const response = await fetch('http://localhost:3001/api/config/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: openrouterKey,
          model: DEFAULT_MODEL
        })
      })

      if (response.ok) {
        setIsOpenrouterConnected(true)
        setOpenrouterSaved(true)
        setTimeout(() => setOpenrouterSaved(false), 2000)
      } else {
        setOpenrouterError('Failed to save configuration')
      }
    } catch (error) {
      setOpenrouterError('Failed to save configuration')
    } finally {
      setIsSavingOpenrouter(false)
    }
  }

  const disconnectOpenrouter = async () => {
    try {
      await fetch('http://localhost:3001/api/config/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: null })
      })
      setOpenrouterKey('')
      setIsOpenrouterConnected(false)
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your integrations and preferences</p>
      </div>

      <div className="max-w-3xl space-y-10">
        {/* GitHub Section */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-raised">
              <Github size={20} className="text-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">GitHub Integration</h2>
              <p className="text-sm text-muted-foreground">Track commits, PRs, and code reviews</p>
            </div>
          </div>

          <div className="space-y-4">
          {/* Connection Status Card */}
          <div className="rounded-xl border border-border bg-card p-5">
            {isConnected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Check size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Connected as @{username}</p>
                    <p className="text-sm text-muted-foreground">Your GitHub activity is being tracked</p>
                  </div>
                </div>
                <button
                  onClick={disconnectGitHub}
                  className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/20"
                >
                  <Trash2 size={16} />
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-raised">
                  <AlertCircle size={20} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Not Connected</p>
                  <p className="text-sm text-muted-foreground">Add your Personal Access Token below</p>
                </div>
              </div>
            )}

            {/* Token Input - show when not connected */}
            {!isConnected && (
              <div className="mt-5 space-y-4 border-t border-border pt-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Personal Access Token (Fine-grained)
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="github_pat_..."
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 pr-20 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Required permissions: <code className="rounded bg-surface-raised px-1">repo</code> (read), <code className="rounded bg-surface-raised px-1">read:org</code>, <code className="rounded bg-surface-raised px-1">read:user</code>
                  </p>
                </div>

                {connectionError && (
                  <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400">
                    <AlertCircle size={16} />
                    {connectionError}
                  </div>
                )}

                <button
                  onClick={validateToken}
                  disabled={isValidating || !token.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isValidating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Connect GitHub
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Organization & Repository Selection */}
          {isConnected && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground">Select Repositories</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose which repositories to track
                  </p>
                </div>
                <button
                  onClick={() => fetchOrganizations(token)}
                  disabled={loadingOrgs}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised disabled:opacity-50"
                >
                  <RefreshCw size={14} className={loadingOrgs ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {loadingOrgs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-muted-foreground" />
                </div>
              ) : organizations.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <Building2 size={32} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No organizations found. Your personal repositories will appear under your username.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Personal repos */}
                  {username && (
                    <div className="rounded-lg border border-border">
                      <button
                        onClick={() => toggleOrg(username)}
                        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-raised"
                      >
                        {expandedOrgs.includes(username) ? (
                          <ChevronDown size={16} className="text-muted-foreground" />
                        ) : (
                          <ChevronRight size={16} className="text-muted-foreground" />
                        )}
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500">
                          <span className="text-xs font-semibold text-white">{username[0].toUpperCase()}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{username}</p>
                          <p className="text-xs text-muted-foreground">Personal repositories</p>
                        </div>
                      </button>

                      {expandedOrgs.includes(username) && (
                        <div className="border-t border-border p-3">
                          {loadingRepos === username ? (
                            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                              <Loader2 size={14} className="animate-spin" />
                              Loading repositories...
                            </div>
                          ) : repositories[username]?.length === 0 ? (
                            <p className="py-4 text-sm text-muted-foreground">No repositories found</p>
                          ) : (
                            <div className="space-y-1">
                              {repositories[username]?.map((repo) => (
                                <label
                                  key={repo.id}
                                  className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-raised"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedRepos.includes(repo.full_name)}
                                    onChange={() => toggleRepoSelection(repo.full_name)}
                                    className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary/20"
                                  />
                                  <Folder size={14} className="text-muted-foreground" />
                                  <span className="flex-1 text-sm text-foreground">{repo.name}</span>
                                  {repo.private && (
                                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-400">
                                      Private
                                    </span>
                                  )}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Organizations */}
                  {organizations.map((org) => (
                    <div key={org.id} className="rounded-lg border border-border">
                      <button
                        onClick={() => toggleOrg(org.login)}
                        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-raised"
                      >
                        {expandedOrgs.includes(org.login) ? (
                          <ChevronDown size={16} className="text-muted-foreground" />
                        ) : (
                          <ChevronRight size={16} className="text-muted-foreground" />
                        )}
                        <img
                          src={org.avatar_url}
                          alt={org.login}
                          className="h-8 w-8 rounded-full"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{org.login}</p>
                          <p className="text-xs text-muted-foreground">Organization</p>
                        </div>
                      </button>

                      {expandedOrgs.includes(org.login) && (
                        <div className="border-t border-border p-3">
                          {loadingRepos === org.login ? (
                            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                              <Loader2 size={14} className="animate-spin" />
                              Loading repositories...
                            </div>
                          ) : repositories[org.login]?.length === 0 ? (
                            <p className="py-4 text-sm text-muted-foreground">No repositories found</p>
                          ) : (
                            <div className="space-y-1">
                              {repositories[org.login]?.map((repo) => (
                                <label
                                  key={repo.id}
                                  className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-raised"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedRepos.includes(repo.full_name)}
                                    onChange={() => toggleRepoSelection(repo.full_name)}
                                    className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary/20"
                                  />
                                  <Folder size={14} className="text-muted-foreground" />
                                  <span className="flex-1 text-sm text-foreground">{repo.name}</span>
                                  {repo.private && (
                                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-400">
                                      Private
                                    </span>
                                  )}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Selected repos summary */}
              {selectedRepos.length > 0 && (
                <div className="mt-4 rounded-lg bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {selectedRepos.length} repositories selected
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Activity from these repos will be included in your summaries
                      </p>
                    </div>
                    <button
                      onClick={saveGitHubConfig}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                    >
                      <Check size={16} />
                      Save Selection
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* AI Summaries Section */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-raised">
              <Sparkles size={20} className="text-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">AI Summaries</h2>
              <p className="text-sm text-muted-foreground">Configure OpenRouter for AI-powered summaries</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* OpenRouter Connection Card */}
            <div className="rounded-xl border border-border bg-card p-5">
              {isOpenrouterConnected ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                      <Check size={20} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">OpenRouter Connected</p>
                      <p className="text-sm text-muted-foreground">Using Claude Haiku 4.5</p>
                    </div>
                  </div>
                  <button
                    onClick={disconnectOpenrouter}
                    className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/20"
                  >
                    <Trash2 size={16} />
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-raised">
                    <AlertCircle size={20} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Not Connected</p>
                    <p className="text-sm text-muted-foreground">Add your OpenRouter API key below</p>
                  </div>
                </div>
              )}

              {/* API Key Input */}
              <div className="mt-5 space-y-4 border-t border-border pt-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showOpenrouterKey ? 'text' : 'password'}
                      value={openrouterKey}
                      onChange={(e) => setOpenrouterKey(e.target.value)}
                      placeholder="sk-or-..."
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 pr-20 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenrouterKey(!showOpenrouterKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showOpenrouterKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Get your API key from{' '}
                    <a 
                      href="https://openrouter.ai/keys" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      openrouter.ai/keys
                      <ExternalLink size={10} />
                    </a>
                  </p>
                </div>

                {openrouterError && (
                  <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400">
                    <AlertCircle size={16} />
                    {openrouterError}
                  </div>
                )}

                <button
                  onClick={saveOpenrouterConfig}
                  disabled={isSavingOpenrouter || !openrouterKey.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSavingOpenrouter ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : openrouterSaved ? (
                    <>
                      <Check size={16} />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Save Configuration
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Info box */}
            <div className="rounded-lg bg-amber-500/10 p-4 text-sm text-amber-400">
              <p className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>
                  Your activity data is sent to OpenRouter for processing. Review their{' '}
                  <a 
                    href="https://openrouter.ai/privacy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    privacy policy
                  </a>
                  {' '}before enabling.
                </span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
