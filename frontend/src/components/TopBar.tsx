import { CircleUserRound, Settings2 } from 'lucide-react'
import type { HealthStatus } from '../types'
import { SidebarToggle } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'

type TopBarProps = {
  health: HealthStatus | null
  onOpenSidebar: () => void
}

export function TopBar({ health, onOpenSidebar }: TopBarProps) {
  const healthy = Boolean(health?.ollama && health?.chromadb)

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarToggle onClick={onOpenSidebar} />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-white">DocuMind</h2>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">Your private AI knowledge assistant</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 sm:px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <span
            className={`h-2 w-2 rounded-full ${healthy ? 'bg-emerald-500' : 'bg-amber-400'}`}
            aria-hidden
          />
          <span className="hidden sm:inline">{healthy ? 'Backend online' : 'Backend degraded'}</span>
          <span className="sm:hidden">{healthy ? 'Online' : 'Degraded'}</span>
        </div>
        <ThemeToggle />
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          title="Settings"
          aria-label="Settings"
        >
          <Settings2 className="h-4 w-4" />
        </button>
        <div
          className="hidden h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 sm:flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
          aria-hidden
        >
          <CircleUserRound className="h-5 w-5" />
        </div>
      </div>
    </header>
  )
}
