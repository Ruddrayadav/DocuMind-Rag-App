import {
  BookOpen,
  FileQuestion,
  FolderOpen,
  KeyRound,
  ListChecks,
  Receipt,
  Upload,
} from 'lucide-react'

const EXAMPLES = [
  {
    icon: Receipt,
    title: 'What is the refund policy?',
    subtitle: 'Policies & billing',
  },
  {
    icon: KeyRound,
    title: 'How does authentication work?',
    subtitle: 'API & security',
  },
  {
    icon: ListChecks,
    title: 'What are the key requirements?',
    subtitle: 'Specs overview',
  },
  {
    icon: FileQuestion,
    title: 'Summarize the employee handbook.',
    subtitle: 'Quick briefing',
  },
] as const

type EmptyStateProps = {
  onSelect: (question: string) => void
  disabled?: boolean
  emptyKnowledgeBase?: boolean
  onUploadClick?: () => void
}

export function EmptyState({
  onSelect,
  disabled,
  emptyKnowledgeBase,
  onUploadClick,
}: EmptyStateProps) {
  if (emptyKnowledgeBase) {
    return (
      <div className="mx-auto flex h-full w-full max-w-xl flex-col items-center justify-center px-6 py-10">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0c0c0e]">
          <FolderOpen className="h-7 w-7 text-slate-500 dark:text-slate-400" aria-hidden />
        </div>
        <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Your knowledge base is empty
        </h2>
        <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Upload PDF or TXT documents to start asking questions.
        </p>
        <button
          type="button"
          onClick={onUploadClick}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:focus-visible:ring-teal-500"
        >
          <Upload className="h-4 w-4" aria-hidden />
          Upload Documents
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center px-6 py-10">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0c0c0e]">
        <BookOpen className="h-7 w-7 text-teal-700 dark:text-teal-500" aria-hidden />
      </div>
      <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Ask anything about your documents
      </h2>
      <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Try asking one of these questions to get started.
      </p>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {EXAMPLES.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.title}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(item.title)}
              className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-[#0c0c0e] dark:hover:border-teal-800 dark:hover:shadow-teal-900/10"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition group-hover:bg-teal-50 group-hover:text-teal-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-teal-900/30 dark:group-hover:text-teal-400">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
