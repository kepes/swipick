// Non-standard / newer parts of the File System Access API that lib.dom does not always cover.
export {}

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: {
      mode?: 'read' | 'readwrite'
    }) => Promise<FileSystemDirectoryHandle>
  }

  interface FileSystemHandle {
    queryPermission?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
    requestPermission?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
  }

  interface FileSystemFileHandle {
    /** Chromium-only native move; if missing, copy+delete fallback. */
    move?: (dest: FileSystemDirectoryHandle, newName?: string) => Promise<void>
  }
}
