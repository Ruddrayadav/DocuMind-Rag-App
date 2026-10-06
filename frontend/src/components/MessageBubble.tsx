import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy, Loader2 } from 'lucide-react'
import type { ChatMessage } from '../types'
import { SourceCards } from './SourceCards'

type MessageBubbleProps = {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-4 py-3 text-sm leading-relaxed text-white shadow-sm sm:max-w-[78%] dark:bg-slate-100 dark:text-slate-900">
          {message.content}
        </div>
      </div>
    )
  }

  const isLoading =
    message.status === 'pending' ||
    message.status === 'searching' ||
    message.status === 'analyzing' ||
    message.status === 'generating'

  const loadingLabel =
    message.status === 'searching'
      ? 'Searching documents...'
      : message.status === 'analyzing'
        ? 'Analyzing relevant information...'
        : message.status === 'generating'
          ? 'Generating answer...'
          : 'Thinking...'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex justify-start">
      <div className="group max-w-[90%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3.5 shadow-sm sm:max-w-[82%] dark:border-slate-800 dark:bg-[#0c0c0e]">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-teal-700 dark:text-teal-500" aria-hidden />
            <span>{loadingLabel}</span>
          </div>
        ) : message.status === 'error' ? (
          <p className="text-sm text-red-600 dark:text-red-400">{message.error || message.content}</p>
        ) : (
          <>
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
            {message.sources && message.sources.length > 0 ? (
              <SourceCards sources={message.sources} />
            ) : null}
            <div className="mt-2 flex justify-end opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="Copy answer"
                title="Copy answer"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
