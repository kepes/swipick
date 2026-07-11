// In-memory File System Access API fake for tests.
// Models: FileSystemDirectoryHandle (values/getFileHandle/getDirectoryHandle/removeEntry),
// FileSystemFileHandle (getFile/createWritable), and optionally the native move().
// The real FS Access API is browser-only; jsdom does not implement it.

export interface FakeFileSpec {
  name: string
  lastModified?: number
  content?: string
  size?: number
}

let nameCounter = 0
// Deterministic "unique" content without Date/Math.random.
function freshContent(name: string): string {
  nameCounter += 1
  return `${name}#${nameCounter}`
}

export class FakeFileHandle {
  readonly kind = 'file' as const
  constructor(
    public name: string,
    private file: File,
    /** if false, move() is not defined (tests the fallback copy+delete branch) */
    supportsMove = true,
    private parent?: FakeDirectoryHandle,
  ) {
    if (supportsMove) {
      // the native fast path: puts the content into the target dir handle, deletes the original
      ;(this as unknown as { move: FakeFileHandle['_move'] }).move = this._move.bind(this)
    }
  }

  async getFile(): Promise<File> {
    return this.file
  }

  async createWritable(): Promise<FakeWritable> {
    return new FakeWritable((blob) => {
      this.file = blobToFile(this.name, blob, this.file.lastModified)
    })
  }

  setParent(parent: FakeDirectoryHandle) {
    this.parent = parent
  }

  private async _move(destDir: FakeDirectoryHandle, newName?: string): Promise<void> {
    const target = newName ?? this.name
    const oldName = this.name
    const oldParent = this.parent
    this.name = target
    // IMPORTANT: detach from the old parent first, adopt ONLY afterwards — otherwise the
    // new parent set by _adopt would mean the detach condition is never met.
    if (oldParent && oldParent !== destDir) oldParent._detach(oldName)
    destDir._adopt(this)
  }
}

export class FakeWritable {
  private chunks: Blob[] = []
  constructor(private onClose: (blob: Blob) => void) {}
  async write(data: Blob | BufferSource | string): Promise<void> {
    this.chunks.push(data instanceof Blob ? data : new Blob([data as BlobPart]))
  }
  async close(): Promise<void> {
    this.onClose(new Blob(this.chunks))
  }
}

type Entry = FakeFileHandle | FakeDirectoryHandle

export class FakeDirectoryHandle {
  readonly kind = 'directory' as const
  private entries = new Map<string, Entry>()
  private permission: PermissionState = 'granted'

  constructor(
    public name: string,
    private supportsMove = true,
  ) {}

  // ── construction from tests ──
  addFiles(specs: FakeFileSpec[]): this {
    for (const s of specs) {
      const content = s.content ?? freshContent(s.name)
      const file = new File([content], s.name, { lastModified: s.lastModified ?? 0 })
      const h = new FakeFileHandle(s.name, file, this.supportsMove, this)
      this.entries.set(s.name, h)
    }
    return this
  }

  addSubdir(name: string): FakeDirectoryHandle {
    const d = new FakeDirectoryHandle(name, this.supportsMove)
    this.entries.set(name, d)
    return d
  }

  setPermission(p: PermissionState): this {
    this.permission = p
    return this
  }

  // ── FS Access API surface ──
  async *values(): AsyncIterableIterator<Entry> {
    for (const e of this.entries.values()) yield e
  }

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<FakeFileHandle> {
    const existing = this.entries.get(name)
    if (existing) {
      if (existing.kind === 'file') return existing
      throw new DOMException(`${name} is a directory`, 'TypeMismatchError')
    }
    if (!opts?.create) throw new DOMException(`${name} not found`, 'NotFoundError')
    const file = new File([''], name, { lastModified: 0 })
    const h = new FakeFileHandle(name, file, this.supportsMove, this)
    this.entries.set(name, h)
    return h
  }

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FakeDirectoryHandle> {
    const existing = this.entries.get(name)
    if (existing) {
      if (existing.kind === 'directory') return existing
      throw new DOMException(`${name} is a file`, 'TypeMismatchError')
    }
    if (!opts?.create) throw new DOMException(`${name} not found`, 'NotFoundError')
    return this.addSubdir(name)
  }

  async removeEntry(name: string, _opts?: { recursive?: boolean }): Promise<void> {
    if (!this.entries.has(name)) throw new DOMException(`${name} not found`, 'NotFoundError')
    this.entries.delete(name)
  }

  async queryPermission(_opts?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState> {
    return this.permission
  }

  async requestPermission(_opts?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState> {
    return this.permission
  }

  // ── internal, used by move() ──
  _adopt(handle: FakeFileHandle) {
    this.entries.set(handle.name, handle)
    handle.setParent(this)
  }
  _detach(name: string) {
    this.entries.delete(name)
  }

  /** test helper: the current child names. */
  childNames(): string[] {
    return [...this.entries.keys()]
  }
  /** test helper: get a subfolder (or undefined). */
  peekDir(name: string): FakeDirectoryHandle | undefined {
    const e = this.entries.get(name)
    return e?.kind === 'directory' ? e : undefined
  }
}

function blobToFile(name: string, blob: Blob, lastModified: number): File {
  return new File([blob], name, { lastModified })
}

/** Convenience factory: root folder with files. */
export function makeFakeDir(
  name: string,
  files: FakeFileSpec[] = [],
  opts?: { supportsMove?: boolean },
): FakeDirectoryHandle {
  const dir = new FakeDirectoryHandle(name, opts?.supportsMove ?? true)
  dir.addFiles(files)
  return dir
}
