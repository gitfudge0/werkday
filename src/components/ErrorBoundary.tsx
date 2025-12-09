import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10">
              <AlertCircle size={32} className="text-rose-400" />
            </div>
            <h1 className="mb-2 text-xl font-bold text-foreground">Something went wrong</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              The app encountered an unexpected error. Try reloading the page.
            </p>
            {this.state.error && (
              <pre className="mb-4 max-h-32 overflow-auto rounded-lg bg-surface-raised p-3 text-left text-xs text-rose-400">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              <RefreshCw size={16} />
              Reload App
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
