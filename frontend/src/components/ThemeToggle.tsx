import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/useTheme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative flex h-9 w-14 items-center rounded-full border border-slate-200 bg-slate-100 p-1 transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
      aria-label="Toggle theme"
    >
      <span
        className={`absolute left-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-300 dark:bg-slate-900 ${
          theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
        }`}
      >
        {theme === 'dark' ? (
          <Moon className="h-4 w-4 text-slate-300" />
        ) : (
          <Sun className="h-4 w-4 text-amber-500" />
        )}
      </span>
    </button>
  )
}
