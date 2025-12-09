import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  GitBranch,
  Ticket,
  StickyNote,
  Settings,
  Zap,
  Sun,
  Moon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  BarChart3,
  LogOut,
} from 'lucide-react'

interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
}

interface Project {
  name: string
  initials: string
  color: string
}

const navigation: NavItem[] = [
  { icon: <LayoutDashboard size={20} />, label: 'Dashboard', href: '/' },
  { icon: <GitBranch size={20} />, label: 'GitHub', href: '/github' },
  { icon: <Ticket size={20} />, label: 'JIRA', href: '/jira' },
  { icon: <StickyNote size={20} />, label: 'Notes', href: '/notes' },
]

const insights: NavItem[] = [
  { icon: <FileText size={20} />, label: 'Summaries', href: '/summaries' },
  { icon: <BarChart3 size={20} />, label: 'Reports', href: '/reports' },
]

const projects: Project[] = [
  { name: 'Work Projects', initials: 'WP', color: 'bg-violet-500' },
  { name: 'Side Projects', initials: 'SP', color: 'bg-pink-500' },
  { name: 'Learning', initials: 'LN', color: 'bg-amber-500' },
]

export function Sidebar() {
  const [isDark, setIsDark] = useState(true)
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    // Check for saved preferences
    const savedTheme = localStorage.getItem('theme')
    const savedCollapsed = localStorage.getItem('sidebar-collapsed')
    
    if (savedTheme) {
      setIsDark(savedTheme === 'dark')
    } else {
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
    
    if (savedCollapsed) {
      setIsCollapsed(savedCollapsed === 'true')
    }
  }, [])

  useEffect(() => {
    // Apply theme to document
    if (isDark) {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const toggleTheme = () => setIsDark(!isDark)
  
  const toggleCollapse = () => {
    const newValue = !isCollapsed
    setIsCollapsed(newValue)
    localStorage.setItem('sidebar-collapsed', String(newValue))
  }

  return (
    <aside 
      className={cn(
        'flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Header with Logo and Collapse Toggle */}
      <div className={cn(
        'flex items-center border-b border-sidebar-border',
        isCollapsed ? 'justify-center px-3 py-4' : 'justify-between px-4 py-4'
      )}>
        {/* Logo */}
        <div className={cn(
          'flex items-center gap-3',
          isCollapsed && 'justify-center'
        )}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg gradient-primary">
            <Zap size={20} className="text-white" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-semibold text-foreground">Werkday</h1>
              <p className="text-xs text-muted-foreground">Work Summarizer</p>
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        {!isCollapsed && (
          <button
            onClick={toggleCollapse}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
            title="Collapse sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <div className="flex justify-center py-2">
          <button
            onClick={toggleCollapse}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
            title="Expand sidebar"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn(
        'flex-1 overflow-y-auto py-4 custom-scrollbar',
        isCollapsed ? 'px-2' : 'px-3'
      )}>
        {/* Main Navigation */}
        <div className="mb-6">
          {!isCollapsed && (
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Menu
            </p>
          )}
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.href}>
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center rounded-lg text-sm font-medium transition-all duration-200',
                      isCollapsed 
                        ? 'justify-center px-2 py-3' 
                        : 'gap-3 px-3 py-2.5',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
                    )
                  }
                  title={isCollapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <span className={cn('flex-shrink-0', isActive && 'text-primary')}>
                        {item.icon}
                      </span>
                      {!isCollapsed && <span>{item.label}</span>}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* Insights Section */}
        <div className="mb-6">
          {!isCollapsed && (
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Insights
            </p>
          )}
          <ul className="space-y-1">
            {insights.map((item) => (
              <li key={item.href}>
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center rounded-lg text-sm font-medium transition-all duration-200',
                      isCollapsed 
                        ? 'justify-center px-2 py-3' 
                        : 'gap-3 px-3 py-2.5',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
                    )
                  }
                  title={isCollapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <span className={cn('flex-shrink-0', isActive && 'text-primary')}>
                        {item.icon}
                      </span>
                      {!isCollapsed && <span>{item.label}</span>}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* Projects Section - Hidden when collapsed */}
        {!isCollapsed && (
          <div className="mb-6">
            <button
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              className="mb-2 flex w-full items-center justify-between px-3"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Projects
              </p>
              <ChevronDown
                size={14}
                className={cn(
                  'text-muted-foreground transition-transform duration-200',
                  projectsExpanded && 'rotate-180'
                )}
              />
            </button>
            {projectsExpanded && (
              <ul className="space-y-1">
                {projects.map((project, idx) => (
                  <li key={idx}>
                    <a
                      href="#"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-surface-raised hover:text-foreground"
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                          project.color
                        )}
                      >
                        {project.initials}
                      </span>
                      <span>{project.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Projects Section - Collapsed view (just icons) */}
        {isCollapsed && (
          <div className="mb-6">
            <ul className="space-y-1">
              {projects.map((project, idx) => (
                <li key={idx}>
                  <a
                    href="#"
                    className="flex items-center justify-center rounded-lg px-2 py-3 transition-all duration-200 hover:bg-surface-raised"
                    title={project.name}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white',
                        project.color
                      )}
                    >
                      {project.initials}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Preferences Section */}
        <div>
          {!isCollapsed && (
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Preferences
            </p>
          )}
          <ul className="space-y-1">
            <li>
              <button
                onClick={toggleTheme}
                className={cn(
                  'flex w-full items-center rounded-lg text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-surface-raised hover:text-foreground',
                  isCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5'
                )}
                title={isCollapsed ? (isDark ? 'Light Mode' : 'Dark Mode') : undefined}
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
                {!isCollapsed && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
              </button>
            </li>
            <li>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn(
                    'flex items-center rounded-lg text-sm font-medium transition-all duration-200',
                    isCollapsed 
                      ? 'justify-center px-2 py-3' 
                      : 'gap-3 px-3 py-2.5',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
                  )
                }
                title={isCollapsed ? 'Settings' : undefined}
              >
                <Settings size={20} />
                {!isCollapsed && <span>Settings</span>}
              </NavLink>
            </li>
          </ul>
        </div>
      </nav>

      {/* Bottom Section - Profile & Logout */}
      <div className={cn(
        'border-t border-sidebar-border',
        isCollapsed ? 'p-2' : 'p-3'
      )}>
        <div className={cn(
          'flex items-center',
          isCollapsed ? 'flex-col gap-2' : 'gap-3'
        )}>
          {/* Profile Avatar */}
          <div 
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 cursor-pointer"
            title={isCollapsed ? 'Digvijay - Developer' : undefined}
          >
            <span className="text-sm font-semibold text-white">D</span>
          </div>

          {/* Name & Role - Hidden when collapsed */}
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-foreground">Digvijay</p>
                <p className="truncate text-xs text-muted-foreground">Developer</p>
              </div>

              {/* Logout */}
              <button
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-surface-raised hover:text-foreground"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </>
          )}

          {/* Logout - Shown below avatar when collapsed */}
          {isCollapsed && (
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-surface-raised hover:text-foreground"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
