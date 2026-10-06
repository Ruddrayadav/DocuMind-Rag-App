import { useEffect, useRef, type FormEvent } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import type { ChatMessage } from '../types'
import { EmptyState } from './EmptyState'
import { MessageBubble } from './MessageBubble'

type ChatAreaProps = {
  messages: ChatMessage[]
  input: string
  setInput: (value: string) => void
  onSend: (message?: string) => void
  busy: boolean
  disabledReason?: string | null
  emptyKnowledgeBase?: boolean
  onUploadClick?: () => void
}

export function ChatArea({
  messages,
  input,
  setInput,
  onSend,
  busy,
  disabledReason,
  emptyKnowledgeBase,
  onUploadClick,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!input.trim() || busy || disabledReason) return
    onSend()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] dark:bg-[linear-gradient(180deg,#09090b_0%,#09090b_100%)]">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        {messages.length === 0 ? (
          <EmptyState
            onSelect={(q) => onSend(q)}
            disabled={busy || Boolean(disabledReason)}
            emptyKnowledgeBase={emptyKnowledgeBase}
            onUploadClick={onUploadClick}
          />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white/90 px-4 py-4 backdrop-blur sm:px-8 dark:border-slate-800 dark:bg-slate-900/80">
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl">
          {disabledReason ? (
            <p className="mb-2 text-xs text-amber-700 dark:text-amber-500" role="status">
              {disabledReason}
            </p>
          ) : null}
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-teal-300 focus-within:ring-2 focus-within:ring-teal-100 dark:border-slate-800 dark:bg-[#0c0c0e] dark:focus-within:border-teal-700 dark:focus-within:ring-teal-900/50">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  if (!busy && !disabledReason && input.trim()) onSend()
                }
              }}
              rows={1}
              placeholder="Ask a question about your documents..."
              disabled={busy || Boolean(emptyKnowledgeBase)}
              aria-label="Chat message"
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-slate-200 dark:placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={busy || !input.trim() || Boolean(disabledReason)}
              className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
              title={busy ? 'Processing' : 'Send message'}
              aria-label={busy ? 'Processing' : 'Send message'}
            >
              {busy ? (
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
              ) : (
                <ArrowUp className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
            Enter to send · Shift+Enter for a new line
          </p>
        </form>
      </div>
    </div>
  )
}
