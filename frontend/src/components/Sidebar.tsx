import {
  BrainCircuit,
  FileText,
  FileType2,
  Loader2,
  Menu,
  Plus,
  Settings,
  Trash2,
  X,
} from 'lucide-react'
import type { DocumentInfo, HealthStatus, ProcessingDoc } from '../types'
import { formatBytes } from '../lib/utils'
import { UploadPanel } from './UploadPanel'

type SidebarProps = {
  documents: DocumentInfo[]
  processing: ProcessingDoc[]
  health: HealthStatus | null
  uploading: boolean
  open: boolean
  onClose: () => void
  onNewChat: () => void
  onUpload: (file: File, onStage?: (stage: string) => void) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function Sidebar({
  documents,
  processing,
  health,
  uploading,
  open,
  onClose,
  onNewChat,
  onUpload,
  onDelete,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-30 bg-slate-900/30 transition md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-[288px] shrink-0 flex-col border-r border-slate-200 bg-[#fbfbfc] transition-transform md:static md:translate-x-0 dark:border-slate-800 dark:bg-[#0c0c0e] ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="DocuMind sidebar"
      >
        <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900">
                <BrainCircuit className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">DocuMind</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">AI Document Intelligence</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden dark:text-slate-400 dark:hover:bg-slate-800"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onNewChat}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:focus-visible:ring-teal-500"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Knowledge Base
          </p>

          <UploadPanel onUpload={onUpload} busy={uploading} />

          <div className="mt-5 space-y-2">
            {documents.length === 0 && processing.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center dark:border-slate-700">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Your knowledge base is empty.</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Upload PDF or TXT documents to start asking questions.
                </p>
              </div>
            ) : null}

            {processing.map((doc) => {
              const Icon = doc.file_type === 'pdf' ? FileType2 : FileText
              return (
                <div
                  key={`processing-${doc.id}`}
                  className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-900/20"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium text-slate-800 dark:text-slate-200"
                      title={doc.filename}
                    >
                      {doc.filename}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="uppercase">{doc.file_type}</span>
                      <span>·</span>
                      <span>Processing...</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      {doc.stage}
                    </div>
                  </div>
                </div>
              )
            })}

            {documents.map((doc) => {
              const Icon = doc.file_type === 'pdf' ? FileType2 : FileText
              return (
                <div
                  key={doc.id}
                  className="group flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-800 dark:bg-[#0c0c0e]"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium text-slate-800 dark:text-slate-200"
                      title={doc.filename}
                    >
                      {doc.filename}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="uppercase">{doc.file_type}</span>
                      <span>·</span>
                      <span>{formatBytes(doc.size_bytes)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                      {doc.indexed ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span className="font-medium text-emerald-700">Ready</span>
                        </>
                      ) : (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-amber-600" aria-hidden />
                          <span className="font-medium text-amber-700">
                            {doc.status === 'stale' ? 'Needs re-index' : 'Pending'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    title={`Delete ${doc.filename}`}
                    aria-label={`Delete ${doc.filename}`}
                    onClick={() => void onDelete(doc.id)}
                    className="rounded-lg p-1.5 text-slate-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Settings className="h-3.5 w-3.5" aria-hidden />
            Backend status
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs dark:border-slate-800 dark:bg-[#0c0c0e]">
            <StatusRow
              label={health?.ollama ? 'Ollama connected' : 'Ollama unavailable'}
              ok={health?.ollama ?? false}
            />
            <StatusRow
              label={health?.chromadb ? 'ChromaDB connected' : 'ChromaDB unavailable'}
              ok={health?.chromadb ?? false}
            />
          </div>
        </div>
      </aside>
    </>
  )
}

export function SidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 md:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
      aria-label="Open sidebar"
    >
      <Menu className="h-4 w-4" />
    </button>
  )
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-400'}`} />
      <span className={ok ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}>{label}</span>
    </div>
  )
}
