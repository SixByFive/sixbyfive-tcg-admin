import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Plus, X, Terminal, Wifi, WifiOff, Loader2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import 'xterm/css/xterm.css'

interface SavedConnection {
  id: string
  label: string
  host: string
  port: number
  username: string
  authMethod: 'key' | 'password'
  keyPath?: string
  vaultId?: string
}

type TabStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

interface Tab {
  id: string
  connectionId: string
  label: string
  host: string
  status: TabStatus
  errorMessage?: string
}

const api = (window as any).ssh as {
  listConnections: () => Promise<SavedConnection[]>
  connect:         (args: { connectionId: string; tabId: string }) => Promise<void>
  disconnect:      (args: { tabId: string }) => Promise<void>
  input:           (args: { tabId: string; data: string }) => Promise<void>
  resize:          (args: { tabId: string; cols: number; rows: number }) => Promise<void>
  onData:          (cb: (payload: { tabId: string; data: string }) => void) => () => void
  onStatus:        (cb: (payload: { tabId: string; status: string; message?: string }) => void) => () => void
}

const XTERM_THEME = {
  background:      '#0d1117',
  foreground:      '#e6edf3',
  cursor:          '#58a6ff',
  cursorAccent:    '#0d1117',
  selectionBackground: 'rgba(88,166,255,0.25)',
  black:   '#0d1117', brightBlack:   '#6e7681',
  red:     '#ff7b72', brightRed:     '#ffa198',
  green:   '#3fb950', brightGreen:   '#56d364',
  yellow:  '#d29922', brightYellow:  '#e3b341',
  blue:    '#58a6ff', brightBlue:    '#79c0ff',
  magenta: '#bc8cff', brightMagenta: '#d2a8ff',
  cyan:    '#39c5cf', brightCyan:    '#56d4dd',
  white:   '#b1bac4', brightWhite:   '#f0f6fc',
}

function newTabId() { return `tab-${crypto.randomUUID().slice(0, 8)}` }

export function SshTerminalPage(): JSX.Element {
  const [connections, setConnections] = useState<SavedConnection[]>([])
  const [tabs, setTabs]               = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  // xterm instances keyed by tabId
  const xtermRefs  = useRef<Record<string, XTerm>>({})
  const fitRefs    = useRef<Record<string, FitAddon>>({})
  const mountedRef = useRef<Record<string, boolean>>({})

  // Load connections on mount
  useEffect(() => {
    api.listConnections().then(setConnections)
  }, [])

  // Subscribe to IPC events from main process
  useEffect(() => {
    const offData   = api.onData(({ tabId, data }) => {
      xtermRefs.current[tabId]?.write(data)
    })
    const offStatus = api.onStatus(({ tabId, status, message }) => {
      setTabs(prev => prev.map(t =>
        t.id === tabId
          ? { ...t, status: status as TabStatus, errorMessage: message }
          : t
      ))
    })
    return () => { offData(); offStatus() }
  }, [])

  function openTab(conn: SavedConnection) {
    const tabId: string = newTabId()
    const tab: Tab = {
      id: tabId,
      connectionId: conn.id,
      label: conn.label,
      host: conn.host,
      status: 'connecting',
    }
    setTabs(prev => [...prev, tab])
    setActiveTabId(tabId)
    api.connect({ connectionId: conn.id, tabId })
  }

  function closeTab(tabId: string) {
    api.disconnect({ tabId })
    const term = xtermRefs.current[tabId]
    if (term) { term.dispose(); delete xtermRefs.current[tabId] }
    delete fitRefs.current[tabId]
    delete mountedRef.current[tabId]
    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== tabId)
      if (activeTabId === tabId) {
        setActiveTabId(remaining[remaining.length - 1]?.id ?? null)
      }
      return remaining
    })
  }

  const mountTerminal = useCallback((tabId: string, el: HTMLDivElement | null) => {
    if (!el || mountedRef.current[tabId]) return
    mountedRef.current[tabId] = true

    const fit  = new FitAddon()
    const term = new XTerm({
      theme:       XTERM_THEME,
      fontFamily:  '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
      fontSize:    13,
      lineHeight:  1.25,
      cursorBlink: true,
      allowProposedApi: true,
    })
    term.loadAddon(fit)
    term.open(el)
    fit.fit()

    xtermRefs.current[tabId] = term
    fitRefs.current[tabId]   = fit

    term.onData(data => { api.input({ tabId, data }) })

    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
        api.resize({ tabId, cols: term.cols, rows: term.rows })
      } catch { /* ignore */ }
    })
    ro.observe(el)

    // Initial resize after connection
    setTimeout(() => {
      try {
        fit.fit()
        api.resize({ tabId, cols: term.cols, rows: term.rows })
      } catch { /* ignore */ }
    }, 300)
  }, [])

  const activeTab = tabs.find(t => t.id === activeTabId)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — connection picker */}
      <div className="flex w-52 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">Connections</p>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {connections.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">No connections saved. Add one in SSH → Connections.</p>
          ) : (
            connections.map(conn => (
              <button
                key={conn.id}
                onClick={() => openTab(conn)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-accent/40"
              >
                <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{conn.label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{conn.username}@{conn.host}:{conn.port ?? 22}</p>
                </div>
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/30" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel — tabs + terminal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Tab bar */}
        {tabs.length > 0 && (
          <div className="flex items-center border-b border-border bg-card">
            <div className="flex flex-1 items-center gap-0 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={cn(
                    'group flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors',
                    activeTabId === tab.id
                      ? 'border-primary bg-background text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.status === 'connecting' && <Loader2 className="h-3 w-3 animate-spin text-amber-500" />}
                  {tab.status === 'connected'  && <Wifi    className="h-3 w-3 text-green-500" />}
                  {(tab.status === 'disconnected' || tab.status === 'error') && <WifiOff className="h-3 w-3 text-destructive" />}
                  {tab.status === 'idle' && <Terminal className="h-3 w-3" />}
                  <span className="max-w-[120px] truncate">{tab.label}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                    onKeyDown={e => e.key === 'Enter' && closeTab(tab.id)}
                    className="ml-1 rounded p-0.5 text-muted-foreground/40 opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {/* no-op — open a connection from the left panel */}}
              className="shrink-0 p-2.5 text-muted-foreground/40 hover:text-muted-foreground"
              title="Open a connection from the left panel"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Terminal panes — render all, hide inactive (preserves xterm state) */}
        <div className="relative flex-1 overflow-hidden bg-[#0d1117]">
          {tabs.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Terminal className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Select a connection from the left panel to open a terminal.</p>
            </div>
          )}

          {tabs.map(tab => (
            <div
              key={tab.id}
              className={cn('absolute inset-0 flex flex-col', tab.id !== activeTabId && 'invisible')}
            >
              {(tab.status === 'error' || tab.status === 'disconnected') && (
                <div className={cn(
                  'flex items-center gap-2 px-4 py-2 text-xs',
                  tab.status === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                )}>
                  <WifiOff className="h-3.5 w-3.5 shrink-0" />
                  {tab.status === 'error'
                    ? (tab.errorMessage ?? 'Connection failed')
                    : 'Session closed'}
                  <button
                    className="ml-auto underline"
                    onClick={() => {
                      const conn = connections.find(c => c.id === tab.connectionId)
                      if (!conn) return
                      setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, status: 'connecting', errorMessage: undefined } : t))
                      api.connect({ connectionId: conn.id, tabId: tab.id })
                    }}
                  >
                    Reconnect
                  </button>
                </div>
              )}
              {tab.status === 'connecting' && (
                <div className="flex items-center gap-2 bg-amber-500/10 px-4 py-2 text-xs text-amber-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Connecting to {tab.host}…
                </div>
              )}
              <div
                ref={el => { if (tab.id === activeTabId) mountTerminal(tab.id, el) }}
                className="flex-1 overflow-hidden p-1"
                style={{ visibility: tab.status === 'connecting' ? 'hidden' : 'visible' }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
