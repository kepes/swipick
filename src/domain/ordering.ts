import type { MediaItem } from './types'

/**
 * Sort: lastModified ASC, with a fileName tie-break on equality
 * (localeCompare). Does not mutate the input — sorts on a copy.
 */
export function sortItems(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => {
    if (a.lastModified !== b.lastModified) return a.lastModified - b.lastModified
    return a.fileName.localeCompare(b.fileName)
  })
}
