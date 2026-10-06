import type { ChatMessage, DocumentInfo, HealthStatus, Source, UploadResponse } from './types'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data?.detail === 'string') return data.detail
    if (Array.isArray(data?.detail)) {
      return data.detail.map((item: { msg?: string }) => item.msg ?? JSON.stringify(item)).join(', ')
    }
    return 'Something went wrong. Please try again.'
  } catch {
    return response.statusText || 'Request failed'
  }
}

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE}/api/health`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function fetchDocuments(): Promise<DocumentInfo[]> {
  const response = await fetch(`${API_BASE}/api/documents`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const form = new FormData()
  form.append('file', file)

  const response = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function deleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error(await parseError(response))
}

export async function sendChat(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): Promise<{ answer: string; sources: Source[] }> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  })

  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export function createId(prefix = 'msg'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createMessage(
  role: ChatMessage['role'],
  content: string,
  extras: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: createId(role),
    role,
    content,
    ...extras,
  }
}
