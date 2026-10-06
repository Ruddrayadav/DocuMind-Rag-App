import { FileText, FileType2 } from 'lucide-react'
import type { GroupedSource, Source } from '../types'
import { formatPages, groupSources } from '../lib/utils'

type SourceCardsProps = {
  sources: Source[]
}

export function SourceCards({ sources }: SourceCardsProps) {
  const grouped = groupSources(sources)

  if (grouped.length === 0) return null

  return (
    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      <p className="mb-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
        Sources · {grouped.length}
      </p>
      <div className="flex flex-col gap-1.5">
        {grouped.map((item) => (
          <SourceCard key={item.source} item={item} />
        ))}
      </div>
    </div>
  )
}

function SourceCard({ item }: { item: GroupedSource }) {
  const Icon = item.isPdf ? FileType2 : FileText
  const pageLabel = item.isPdf ? formatPages(item.pages) : null

  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 dark:border-slate-700/50 dark:bg-slate-800/50"
      title={pageLabel ? `${item.source} — ${pageLabel}` : item.source}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-300">{item.source}</p>
      {pageLabel ? (
        <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{pageLabel}</span>
      ) : null}
    </div>
  )
}
