// Valódi fájlmozgatás + ütközéskezelés a File System Access API-n.
// A natív handle.move() gyors-utat használja, ha elérhető; egyébként
// copy (write) → delete fallback, write→delete sorrendben (a forrás sosem vész el).

import {
  DELETE_BUCKET,
  TRASH_DIR,
  type BucketKey,
  type SortPlan,
  type MoveResult,
  type MoveFailure,
  type SortProgress,
} from '../domain/types'

/** A name szétbontása base + ext-re. Vezető pont NEM szeparátor. */
function splitExt(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, dot), ext: name.slice(dot) }
}

function isNotFound(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'NotFoundError'
}

/**
 * Szabad fájlnevet ad a destDir-ben. Ha a name szabad → name.
 * Ha foglalt → 'base (n).ext' n=1,2,… az első szabadig.
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

/** Igaz, ha a root-ban már létezik adott nevű almappa. */
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
 * Szabad mappanevet ad a normal kosárhoz. Ha a bucketKey nevű mappa szabad →
 * bucketKey. Ha foglalt → 'bucketKey_01', '_02', … (kétjegyű, az első szabadig).
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
 * A kosárhoz tartozó célmappa.
 * delete kosár → TRASH_DIR (meglévőt újrahasznál, egyetlen gyűjtőmappa).
 * normal kosár → bucketKey; ha az már létezik, friss _NN sorszámozott testvér
 * (B → B_01 → B_02 …), így minden rendezés külön mappába kerül.
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
 * Egy fájl áthelyezése destDir-be, ütközés-feloldott névvel.
 * Natív move() ha van; egyébként write→delete fallback.
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

  // Fallback: copy → delete. A sorrend garantálja, hogy hiba esetén
  // a forrás megmarad.
  const dest = await destDir.getFileHandle(finalName, { create: true })
  const writable = await dest.createWritable()
  const file = await src.getFile()
  await writable.write(file)
  await writable.close()
  await root.removeEntry(src.name)
  return { finalName }
}

/** A teljes SortPlan végrehajtása. Egy fájl hibája nem állítja le a többit. */
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
