import type { MediaItem } from './types'

/**
 * Rendezés: lastModified ASC, egyenlőségnél fileName szerinti tie-break
 * (localeCompare). Nem mutálja a bemenetet — másolaton rendez.
 */
export function sortItems(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => {
    if (a.lastModified !== b.lastModified) return a.lastModified - b.lastModified
    return a.fileName.localeCompare(b.fileName)
  })
}
