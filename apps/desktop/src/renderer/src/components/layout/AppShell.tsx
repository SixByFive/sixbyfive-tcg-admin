import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { CommandPalette } from './CommandPalette'
import { CommandPaletteProvider } from '@/context/CommandPaletteContext'

export function AppShell(): JSX.Element {
  return (
    <CommandPaletteProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </div>
        </main>
        <CommandPalette />
      </div>
    </CommandPaletteProvider>
  )
}
