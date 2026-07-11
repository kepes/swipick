// Real file moving + collision handling over the File System Access API.
// Uses the native handle.move() fast path when available; otherwise
// copy (write) → delete fallback, in write→delete order (the source is never lost).

import {
  DELETE_BUCKET,
  TRASH_DIR,
  type BucketKey,
  type SortPlan,
  type MoveResult,
  type MoveFailure,
  type SortProgress,
} from '../domain/types'

/** Splits name into base + ext. A leading dot is NOT a separator. */
function splitExt(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, dot), ext: name.slice(dot) }
}

function isNotFound(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'NotFoundError'
}

/**
 * Returns a free file name in destDir. If name is free → name.
 * If taken → 'base (n).ext' n=1,2,… up to the first free one.
 */
export async function resolveCollisionName(
  destDir: FileSystemDirectoryHandle,
  name: string,
): Promise<string> {
  const free = async (candidate: string): Promise<boolean> => {
    try {
      await destDir.getFileHandle(candidate)
      return false
    } catch (e) {
      if (isNotFound(e)) return true
      throw e
    }
  }

  if (await free(name)) return name
  const { base, ext } = splitExt(name)
  for (let n = 1; ; n++) {
    const candidate = `${base} (${n})${ext}`
    if (await free(candidate)) return candidate
  }
}

/** True if a subfolder with the given name already exists in root. */
async function dirExists(root: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await root.getDirectoryHandle(name)
    return true
  } catch (e) {
    if (isNotFound(e)) return false
    throw e
  }
}

/**
 * Returns a free folder name for a normal bucket. If the folder named bucketKey is free →
 * bucketKey. If taken → 'bucketKey_01', '_02', … (two-digit, up to the first free one).
 */
export async function resolveBucketDirName(
  root: FileSystemDirectoryHandle,
  bucketKey: BucketKey,
): Promise<string> {
  if (!(await dirExists(root, bucketKey))) return bucketKey
  for (let n = 1; ; n++) {
    const candidate = `${bucketKey}_${String(n).padStart(2, '0')}`
    if (!(await dirExists(root, candidate))) return candidate
  }
}

/**
 * The destination folder for a bucket.
 * delete bucket → TRASH_DIR (reuses an existing one, a single collector folder).
 * normal bucket → bucketKey; if it already exists, a fresh _NN numbered sibling
 * (B → B_01 → B_02 …), so each Sort goes into its own folder.
 */
export async function ensureBucketDir(
  root: FileSystemDirectoryHandle,
  bucketKey: BucketKey,
): Promise<FileSystemDirectoryHandle> {
  if (bucketKey === DELETE_BUCKET) {
    return root.getDirectoryHandle(TRASH_DIR, { create: true })
  }
  const dirName = await resolveBucketDirName(root, bucketKey)
  return root.getDirectoryHandle(dirName, { create: true })
}

interface MovableFileHandle extends FileSystemFileHandle {
  move?(destDir: FileSystemDirectoryHandle, newName?: string): Promise<void>
}

/**
 * Moves a single file into destDir, with a collision-resolved name.
 * Native move() if available; otherwise write→delete fallback.
 */
export async function moveFile(
  src: FileSystemFileHandle,
  root: FileSystemDirectoryHandle,
  destDir: FileSystemDirectoryHandle,
  name: string,
): Promise<{ finalName: string }> {
  const finalName = await resolveCollisionName(destDir, name)
  const movable = src as MovableFileHandle

  if (typeof movable.move === 'function') {
    await movable.move(destDir, finalName)
    return { finalName }
  }

  // Fallback: copy → delete. The order guarantees that on error
  // the source is preserved.
  const dest = await destDir.getFileHandle(finalName, { create: true })
  const writable = await dest.createWritable()
  const file = await src.getFile()
  await writable.write(file)
  await writable.close()
  await root.removeEntry(src.name)
  return { finalName }
}

/** Executes the entire SortPlan. One file's failure does not stop the rest. */
export async function runSort(
  root: FileSystemDirectoryHandle,
  plan: SortPlan,
  onProgress?: (p: SortProgress) => void,
): Promise<MoveResult> {
  let total = 0
  for (const handles of plan.values()) total += handles.length

  let moved = 0
  let deleted = 0
  const failed: MoveFailure[] = []

  for (const [key, handles] of plan) {
    const destDir = await ensureBucketDir(root, key)
    for (const h of handles) {
      try {
        await moveFile(h, root, destDir, h.name)
        if (key === DELETE_BUCKET) deleted++
        else moved++
      } catch (e) {
        failed.push({ name: h.name, bucket: key, error: String(e) })
      }
      onProgress?.({ done: moved + deleted + failed.length, total, currentName: h.name })
    }
  }

  return { moved, deleted, failed }
}
