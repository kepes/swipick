import type {
  FileSystemGateway,
  MediaItem,
  MediaKind,
  ReadFolderResult,
} from '../domain/types'
import { sortItems } from '../domain/ordering'

export const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'heic']
export const VIDEO_EXT = ['mp4', 'webm', 'ogg', 'ogv', 'mov']

/**
 * Az utolsó '.' utáni szegmens lowercase alapján sorol. Vezető pont
 * (.gitignore) NEM kiterjesztés → null; pont nélküli név → null.
 */
export function classifyByExtension(name: string): MediaKind | null {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return null
  const ext = name.slice(dot + 1).toLowerCase()
  if (IMAGE_EXT.includes(ext)) return 'image'
  if (VIDEO_EXT.includes(ext)) return 'video'
  return null
}

export async function readFolder(gateway: FileSystemGateway): Promise<ReadFolderResult> {
  if (!gateway.isSupported()) throw { type: 'unsupported-browser' }

  let dir: FileSystemDirectoryHandle
  try {
    dir = await gateway.pickDirectory()
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw { type: 'aborted' }
    throw e
  }

  const ok = await gateway.ensureWritePermission(dir)
  if (!ok) throw { type: 'permission-denied' }

  const items: MediaItem[] = []
  let skippedCount = 0

  const dirWithValues = dir as unknown as {
    values(): AsyncIterableIterator<FileSystemHandle>
  }
  for await (const entry of dirWithValues.values()) {
    if (entry.kind !== 'file') {
      skippedCount++
      continue
    }
    const kind = classifyByExtension(entry.name)
    if (kind === null) {
      skippedCount++
      continue
    }
    const handle = entry as FileSystemFileHandle
    const file = await handle.getFile()
    items.push({
      fileName: entry.name,
      kind,
      handle,
      lastModified: file.lastModified,
      size: file.size,
    })
  }

  const sorted = sortItems(items)
  if (sorted.length === 0) throw { type: 'empty', folderName: dir.name }

  return { folderName: dir.name, items: sorted, skippedCount }
}
