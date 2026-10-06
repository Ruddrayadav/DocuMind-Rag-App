import type { GroupedSource, Source } from '../types'

export function groupSources(sources: Source[]): GroupedSource[] {
  const map = new Map<string, Set<number>>()

  for (const item of sources) {
    if (!map.has(item.source)) {
      map.set(item.source, new Set())
    }
    if (item.page != null) {
      map.get(item.source)!.add(item.page)
    }
  }

  return Array.from(map.entries())
    .map(([source, pages]) => ({
      source,
      pages: Array.from(pages).sort((a, b) => a - b),
      isPdf: source.toLowerCase().endsWith('.pdf'),
    }))
    .sort((a, b) => a.source.localeCompare(b.source))
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatPages(pages: number[]): string {
  if (pages.length === 0) return ''
  if (pages.length === 1) return `Page ${pages[0]}`
  return `Pages ${pages.join(', ')}`
}
