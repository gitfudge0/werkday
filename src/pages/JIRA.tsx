import { Ticket, ExternalLink } from 'lucide-react'

export function JIRA() {
  return (
    <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">JIRA Activity</h1>
        <p className="text-muted-foreground">Track your JIRA tickets and progress</p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised">
          <Ticket size={32} className="text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-foreground">JIRA Integration Coming Soon</h2>
        <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
          Connect your JIRA account to automatically track tickets, story points, and sprint progress.
        </p>
        <a
          href="https://www.atlassian.com/software/jira"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised"
        >
          <ExternalLink size={16} />
          Learn about JIRA API
        </a>
      </div>
    </main>
  )
}
