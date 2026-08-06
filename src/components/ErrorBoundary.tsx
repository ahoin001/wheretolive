import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui/Button'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error boundary', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
          <h1 className="font-display text-3xl font-semibold text-ink">
            Something got stuck
          </h1>
          <p className="text-ink-soft">
            Your saved answers should still be on this device. Try refreshing the
            page. If it keeps happening, export a backup from another browser tab
            if you can, or clear site data for this app.
          </p>
          <p className="rounded-2xl bg-folio p-4 text-sm text-ink-soft">
            {this.state.error.message}
          </p>
          <Button onClick={() => window.location.reload()}>Refresh</Button>
        </div>
      )
    }
    return this.props.children
  }
}
