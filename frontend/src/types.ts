export type Source = {
  source: string
  page: number | null
  file_type?: string | null
}

export type GroupedSource = {
  source: string
  pages: number[]
  isPdf: boolean
}

export type DocumentInfo = {
  id: string
  filename: string
  file_type: string
  size_bytes: number
  status: string
  indexed: boolean
  doc_hash?: string | null
}

export type HealthStatus = {
  status: string
  ollama: boolean
  chromadb: boolean
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  status?: 'pending' | 'searching' | 'analyzing' | 'generating' | 'done' | 'error'
  error?: string
}

export type UploadResponse = {
  status: string
  filename: string
  chunks: number
  message: string
  document: DocumentInfo
}

export type ProcessingDoc = {
  id: string
  filename: string
  file_type: string
  size_bytes: number
  stage: string
}
