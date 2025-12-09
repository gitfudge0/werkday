import { useState } from 'react'
import { StatCard, MiniBarChart, DonutChart } from '@/components/dashboard/StatCard'
import { CalendarWidget } from '@/components/dashboard/CalendarWidget'
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap'
import { HeroCard } from '@/components/dashboard/HeroCard'
import { GitCommit, GitPullRequest, Ticket, Clock, ChevronDown } from 'lucide-react'

interface DashboardProps {
  serverStatus: 'starting' | 'running' | 'error'
}

export function Dashboard({ serverStatus }: DashboardProps) {
  const [selectedDate, setSelectedDate] = useState<string>('Today')
  const dateOptions = ['Today', 'Yesterday', 'This Week', 'Last 7 Days', 'This Month']

  // Mock data for charts
  const commitData = [4, 8, 6, 12, 9, 15, 8, 10, 14, 7]
  
  const projectSegments = [
    { value: 45, color: '#8b5cf6', label: 'Feature work' },
    { value: 25, color: '#a78bfa', label: 'Bug fixes' },
    { value: 20, color: '#c4b5fd', label: 'Reviews' },
    { value: 10, color: '#7c3aed', label: 'Meetings' },
  ]

  return (
    <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      {/* Greeting with Date Filter */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Hi, Digvijay!
          </h1>
          <p className="text-muted-foreground">
            What do you want to track today?
          </p>
        </div>
        
        {/* Date Filter Dropdown */}
        <div className="relative">
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="appearance-none rounded-lg border border-border bg-card px-4 py-2 pr-10 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {dateOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown 
            size={16} 
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" 
          />
        </div>
      </div>

      {/* Server Status Indicator */}
      <div className="mb-4 flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${
            serverStatus === 'running'
              ? 'bg-emerald-400'
              : serverStatus === 'starting'
              ? 'bg-amber-400 animate-pulse'
              : 'bg-rose-400'
          }`}
        />
        <span className="text-xs text-muted-foreground">
          Backend: {serverStatus}
        </span>
      </div>

      {/* Main Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left Column - Stats */}
        <div className="space-y-4 lg:col-span-2">
          {/* Top row - Stats + Hero */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Commits Card */}
            <StatCard
              title="Commits"
              value="127"
              subtitle="This month"
              icon={<GitCommit size={18} />}
              change={{ value: 38.12, label: 'from previous month' }}
              chart={<MiniBarChart data={commitData} />}
            />

            {/* Hero Card */}
            <HeroCard />
          </div>

          {/* Second row - More stats */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Pull Requests"
              value="24"
              icon={<GitPullRequest size={16} />}
              change={{ value: 17.8, label: 'last week' }}
              variant="compact"
            />

            <StatCard
              title="JIRA Tickets"
              value="18"
              icon={<Ticket size={16} />}
              change={{ value: -5.4, label: 'last week' }}
              variant="compact"
            />

            <StatCard
              title="Focus Time"
              value="4.8h"
              icon={<Clock size={16} />}
              change={{ value: 28.5, label: 'yesterday' }}
              variant="compact"
            />

            <StatCard
              title="Productivity"
              value="92%"
              change={{ value: 12.3, label: 'improvement' }}
              variant="compact"
            />
          </div>

          {/* Activity Heatmap */}
          <ActivityHeatmap />
        </div>

        {/* Right Column - Calendar & Projects */}
        <div className="space-y-4">
          <CalendarWidget />

          {/* Project Distribution */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground">Time Distribution</h3>
            <p className="text-sm text-muted-foreground">This week's breakdown</p>
            
            <div className="mt-4 flex justify-center">
              <DonutChart
                segments={projectSegments}
                centerValue="32h"
                centerLabel="Total"
              />
            </div>

            {/* Legend */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {projectSegments.map((segment, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {segment.label}
                  </span>
                  <span className="ml-auto text-xs font-medium text-foreground">
                    {segment.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
