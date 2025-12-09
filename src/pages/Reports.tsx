import { BarChart3 } from 'lucide-react'

export function Reports() {
  return (
    <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground">Analytics and productivity insights</p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised">
          <BarChart3 size={32} className="text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-foreground">Reports Coming Soon</h2>
        <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
          Get detailed analytics on your coding patterns, productivity trends, and contribution metrics.
        </p>
      </div>
    </main>
  )
}
