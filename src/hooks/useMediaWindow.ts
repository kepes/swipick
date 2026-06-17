import { useEffect, useRef, useState } from 'react'
import type { MediaItem } from '../domain/types'

interface UseMediaWindowResult {
  urlFor(fileName: string): string | undefined
}

export function useMediaWindow(
  items: MediaItem[],
  position: number,
  opts?: { ahead?: number; behind?: number },
): UseMediaWindowResult {
  const ahead = opts?.ahead ?? 5
  const behind = opts?.behind ?? 2

  const cacheRef = useRef<Map<string, string>>(new Map())
  // A cache egy ref (revoke-bookkeeping miatt), de a ref-mutáció nem renderel újra.
  // Ez a tick a URL-ek elkészülte után nő, hogy a kártya újrarendereljen a friss URL-lel.
  const [, setTick] = useState(0)

  useEffect(() => {
    const cache = cacheRef.current
    const start = Math.max(0, position - behind)
    const end = Math.min(items.length - 1, position + ahead)

    // Revoke items outside window
    for (const [fileName, url] of cache.entries()) {
      const idx = items.findIndex((i) => i.fileName === fileName)
      if (idx < start || idx > end) {
        URL.revokeObjectURL(url)
        cache.delete(fileName)
      }
    }

    // Create URLs for items in window
    const windowItems = items.slice(start, end + 1)
    const promises = windowItems.map(async (item) => {
      if (!cache.has(item.fileName)) {
        const file = await item.handle.getFile()
        const url = URL.createObjectURL(file)
        cache.set(item.fileName, url)
        return true
      }
      return false
    })
    Promise.all(promises)
      .then((created) => {
        // Csak akkor renderelünk újra, ha tényleg készült új URL.
        if (created.some(Boolean)) setTick((t) => t + 1)
      })
      .catch(() => {})
  }, [items, position, ahead, behind])

  // Cleanup on unmount
  useEffect(() => {
    const cache = cacheRef.current
    return () => {
      for (const url of cache.values()) {
        URL.revokeObjectURL(url)
      }
      cache.clear()
    }
  }, [])

  return {
    urlFor(fileName: string) {
      return cacheRef.current.get(fileName)
    },
  }
}
