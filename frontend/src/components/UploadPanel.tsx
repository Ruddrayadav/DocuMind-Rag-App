import { useCallback, useRef, useState } from 'react'
import { FileUp, Loader2, Upload } from 'lucide-react'

type UploadPanelProps = {
  onUpload: (file: File, onStage?: (stage: string) => void) => Promise<void>
  busy?: boolean
  compact?: boolean
}

const ACCEPTED = '.pdf,.txt,application/pdf,text/plain'

const STAGES = [
  'Uploading...',
  'Extracting text...',
  'Creating embeddings...',
  'Indexing knowledge base...',
] as const

export function UploadPanel({ onUpload, busy, compact }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file || busy) return

      const lower = file.name.toLowerCase()
      if (!lower.endsWith('.pdf') && !lower.endsWith('.txt')) {
        setError('Unsupported file type. Please upload a PDF or TXT file.')
        return
      }

      if (file.size === 0) {
        setError('Uploaded file is empty.')
        return
      }

      if (file.size > 20 * 1024 * 1024) {
        setError('File exceeds the 20MB limit.')
        return
      }

      setError(null)
      let stageIndex = 0
      setStatus(STAGES[0])

      const advance = () => {
        stageIndex = Math.min(stageIndex + 1, STAGES.length - 1)
        setStatus(STAGES[stageIndex])
      }

      try {
        const timers = [
          window.setTimeout(advance, 400),
          window.setTimeout(advance, 900),
          window.setTimeout(advance, 1400),
        ]

        await onUpload(file, (stage) => setStatus(stage))

        timers.forEach((t) => window.clearTimeout(t))
        setStatus('✓ Ready')
        window.setTimeout(() => setStatus(null), 1600)
      } catch (err) {
        setStatus(null)
        setError(err instanceof Error ? err.message : 'Document processing failed. Please try again.')
      }
    },
    [busy, onUpload],
  )

  return (
    <div className="space-y-2">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void handleFile(event.dataTransfer.files?.[0])
        }}
        className={`rounded-2xl border border-dashed text-center transition ${
          compact ? 'px-3 py-4' : 'px-3 py-5'
        } ${
          dragging
            ? 'border-teal-400 bg-teal-50/70 dark:bg-teal-900/20'
            : 'border-slate-300 bg-slate-50/70 hover:border-teal-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-teal-700 dark:hover:bg-[#0c0c0e]'
        }`}
      >
        <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-4 w-4" aria-hidden />
          )}
        </div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Drop documents here</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">PDF or TXT · Max 20MB</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-teal-200 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 disabled:opacity-50 dark:border-slate-700 dark:bg-[#0c0c0e] dark:text-slate-300 dark:hover:border-teal-700 dark:hover:text-teal-400"
          aria-label="Browse files to upload"
        >
          <FileUp className="h-3.5 w-3.5" aria-hidden />
          Browse Files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            void handleFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>

      {status ? <p className="text-xs font-medium text-teal-700">{status}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
