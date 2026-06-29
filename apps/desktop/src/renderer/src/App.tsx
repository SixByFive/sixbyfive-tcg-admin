import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AlertsProvider } from './context/AlertsContext'
import { AdminKeyProvider } from './context/AdminKeyContext'
import { LoginPage } from './pages/LoginPage'
import { router } from './router'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('App crash:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-background p-8">
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm font-mono text-destructive">
            <strong>App crashed:</strong>
            <pre className="mt-2 whitespace-pre-wrap">{(this.state.error as Error).message}</pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AppContent(): JSX.Element {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!user) return <LoginPage />
  return <RouterProvider router={router} />
}

export default function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AdminKeyProvider>
          <AlertsProvider>
            <AppContent />
          </AlertsProvider>
        </AdminKeyProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
