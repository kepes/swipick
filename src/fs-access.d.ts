// A File System Access API nem-szabványos / újabb részei, amiket a lib.dom nem mindig fed.
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
    /** Chromium-only natív áthelyezés; ha hiányzik, copy+delete fallback. */
    move?: (dest: FileSystemDirectoryHandle, newName?: string) => Promise<void>
  }
}
