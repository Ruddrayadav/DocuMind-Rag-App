import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createId,
  createMessage,
  deleteDocument,
  fetchDocuments,
  fetchHealth,
  sendChat,
  uploadDocument,
} from './api'
import { ChatArea } from './components/ChatArea'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import type { ChatMessage, DocumentInfo, HealthStatus, ProcessingDoc } from './types'

export default function App() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [processing, setProcessing] = useState<ProcessingDoc[]>([])
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [docs, status] = await Promise.all([fetchDocuments(), fetchHealth()])
      setDocuments(docs)
      setHealth(status)
      setBootError(null)
    } catch (err) {
      setBootError(
        err instanceof Error
          ? err.message
          : 'Unable to reach the DocuMind API. Is the FastAPI server running?',
      )
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      void fetchHealth()
        .then(setHealth)
        .catch(() => undefined)
    }, 15000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const emptyKnowledgeBase = documents.length === 0 && processing.length === 0

  const disabledReason = useMemo(() => {
    if (bootError) return bootError
    if (emptyKnowledgeBase) return 'Upload at least one PDF or TXT document to start chatting.'
    if (!documents.some((doc) => doc.indexed) && processing.length === 0) {
      return 'Documents are still pending indexing.'
    }
    if (health && !health.ollama) return 'Ollama unavailable. Please make sure Ollama is running.'
    if (health && !health.chromadb) return 'ChromaDB unavailable. Please try again.'
    return null
  }, [bootError, documents, emptyKnowledgeBase, health, processing.length])

  const handleUpload = useCallback(
    async (file: File, onStage?: (stage: string) => void) => {
      const tempId = createId('upload')
      const fileType = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'txt'

      setUploading(true)
      setProcessing((prev) => [
        {
          id: tempId,
          filename: file.name,
          file_type: fileType,
          size_bytes: file.size,
          stage: 'Uploading...',
        },
        ...prev,
      ])

      const updateStage = (stage: string) => {
        onStage?.(stage)
        setProcessing((prev) =>
          prev.map((doc) => (doc.id === tempId ? { ...doc, stage } : doc)),
        )
      }

      try {
        updateStage('Extracting text...')
        const result = await uploadDocument(file)
        updateStage(result.status === 'skipped' ? 'Already indexed' : '✓ Ready')
        await refresh()
      } finally {
        setProcessing((prev) => prev.filter((doc) => doc.id !== tempId))
        setUploading(false)
      }
    },
    [refresh],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteDocument(id)
        await refresh()
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Unable to delete document.')
      }
    },
    [refresh],
  )

  const handleNewChat = useCallback(() => {
    setMessages([])
    setInput('')
  }, [])

  const handleSend = useCallback(
    async (override?: string) => {
      const text = (override ?? input).trim()
      if (!text || busy || disabledReason) return
      if (documents.length === 0) return

      const history = messages
        .filter((m) => m.status === 'done' || m.role === 'user')
        .filter((m) => m.content)
        .map((m) => ({ role: m.role, content: m.content }))

      const userMessage = createMessage('user', text)
      const assistantId = createId('assistant')

      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: 'assistant', content: '', status: 'searching' },
      ])
      setInput('')
      setBusy(true)

      try {
        await new Promise((r) => setTimeout(r, 280))
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, status: 'analyzing' } : msg,
          ),
        )

        await new Promise((r) => setTimeout(r, 280))
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, status: 'generating' } : msg,
          ),
        )

        const result = await sendChat(text, history)

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: result.answer,
                  sources: result.sources,
                  status: 'done',
                }
              : msg,
          ),
        )
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to generate an answer. Please try again.'
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: message,
                  error: message,
                  status: 'error',
                }
              : msg,
          ),
        )
      } finally {
        setBusy(false)
      }
    },
    [busy, disabledReason, documents.length, input, messages],
  )

  return (
    <div className="flex h-full min-h-screen overflow-hidden bg-slate-100 text-slate-900 dark:bg-[#09090b] dark:text-slate-100">
      <Sidebar
        documents={documents}
        processing={processing}
        health={health}
        uploading={uploading}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onUpload={handleUpload}
        onDelete={handleDelete}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar health={health} onOpenSidebar={() => setSidebarOpen(true)} />
        <ChatArea
          messages={messages}
          input={input}
          setInput={setInput}
          onSend={handleSend}
          busy={busy}
          disabledReason={disabledReason}
          emptyKnowledgeBase={emptyKnowledgeBase}
          onUploadClick={() => setSidebarOpen(true)}
        />
      </main>
    </div>
  )
}
