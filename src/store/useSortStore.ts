import { create } from 'zustand'
import type {
  Decision,
  FileSystemGateway,
  FolderReadError,
  HistoryEntry,
  KeyAction,
  KeyEvent,
  MediaItem,
  MoveResult,
  SortPlan,
  SortProgress,
  SortState,
} from '../domain/types'
import { classifyKey } from '../domain/keymap'
import { applyKey, redo as redoReducer, undo as undoReducer } from '../domain/reducer'
import { readFolder } from '../fs/scan'
import { runSort } from '../fs/organize'
import { clearSession, loadSession, reconcile, saveSession } from './persist'

export type Screen = 'picker' | 'sorting' | 'done'

/** Input to the Sort operation: per bucket, the file handles to move (in queue order). */
export function buildSortPlan(items: MediaItem[], decisions: Record<string, Decision>): SortPlan {
  const plan: SortPlan = new Map()
  for (const item of items) {
    const decision = decisions[item.fileName]
    if (!decision) continue // keep / unclassified → stays in place
    const list = plan.get(decision.bucket) ?? []
    list.push(item.handle)
    plan.set(decision.bucket, list)
  }
  return plan
}

function pickerMessage(err: FolderReadError): string | null {
  switch (err.type) {
    case 'aborted':
      return null // silent — the user cancelled
    case 'permission-denied':
      return 'Write permission is required for the folder — Swipick moves files.'
    case 'empty':
      return 'This folder has no images or videos to display.'
    case 'unsupported-browser':
      return 'This browser is not supported. Use Chrome or Edge (the File System Access API is required).'
  }
}

function isFolderReadError(e: unknown): e is FolderReadError {
  return typeof e === 'object' && e !== null && 'type' in e
}

/**
 * The "saved session for this folder" offer shown on the picker (spec 4.5).
 * It appears AFTER selection, BEFORE entering the Tinder view.
 */
export interface ResumePrompt {
  folderName: string
  dirHandle: FileSystemDirectoryHandle
  items: MediaItem[]
  restoredCount: number
  restored: {
    decisions: Record<string, Decision>
    history: HistoryEntry[]
    historyCursor: number
    position: number
  }
}

interface StoreState extends SortState {
  screen: Screen
  dirHandle: FileSystemDirectoryHandle | null
  pickerError: string | null
  restoredNotice: string | null
  /** If not null: the picker offers to resume the saved session. */
  resumePrompt: ResumePrompt | null
  isSorting: boolean
  sortProgress: SortProgress | null
  sortResult: MoveResult | null
  /** UI signal: increases on every Space press — the CardStack toggles video on this. */
  videoToggleNonce: number

  pickFolder: (gateway: FileSystemGateway) => Promise<void>
  confirmResume: () => void
  discardResume: () => void
  applyKeyEvent: (e: KeyEvent) => KeyAction
  undo: () => void
  redo: () => void
  runOrganize: () => Promise<void>
  reset: () => void
  backToPicker: () => void
  toggleVideo: () => void
}

const emptyDomain: SortState = {
  folderName: '',
  items: [],
  position: 0,
  decisions: {},
  history: [],
  historyCursor: 0,
}

export const useSortStore = create<StoreState>((set, get) => {
  /** Apply domain state + folder-scoped save. */
  function commit(next: SortState) {
    set(next)
    if (next.folderName) saveSession(next)
  }

  function domainOf(s: StoreState): SortState {
    return {
      folderName: s.folderName,
      items: s.items,
      position: s.position,
      decisions: s.decisions,
      history: s.history,
      historyCursor: s.historyCursor,
    }
  }

  return {
    ...emptyDomain,
    screen: 'picker',
    dirHandle: null,
    pickerError: null,
    restoredNotice: null,
    resumePrompt: null,
    isSorting: false,
    sortProgress: null,
    sortResult: null,
    videoToggleNonce: 0,

    async pickFolder(gateway) {
      set({ pickerError: null, restoredNotice: null, resumePrompt: null })
      let result
      try {
        result = await readFolder(gateway)
      } catch (e) {
        if (isFolderReadError(e)) {
          set({ pickerError: pickerMessage(e) })
          return
        }
        throw e
      }

      const { folderName, dirHandle, items } = result

      // Folder-scoped saved session? If there's a usable decision, we offer to resume
      // on the PICKER (spec 4.5) — we don't jump automatically into the view.
      const persisted = loadSession(folderName)
      if (persisted) {
        const r = reconcile(persisted, items)
        const restoredCount = Object.keys(r.decisions).length
        if (restoredCount > 0) {
          set({
            resumePrompt: {
              folderName,
              dirHandle,
              items,
              restoredCount,
              restored: {
                decisions: r.decisions,
                history: r.history,
                historyCursor: r.historyCursor,
                position: r.position,
              },
            },
          })
          return
        }
      }

      // No (usable) save → fresh session.
      set({
        screen: 'sorting',
        dirHandle,
        folderName,
        items,
        position: 0,
        decisions: {},
        history: [],
        historyCursor: 0,
        pickerError: null,
        restoredNotice: null,
        sortResult: null,
        sortProgress: null,
      })
    },

    confirmResume() {
      const rp = get().resumePrompt
      if (!rp) return
      set({
        screen: 'sorting',
        dirHandle: rp.dirHandle,
        folderName: rp.folderName,
        items: rp.items,
        position: rp.restored.position,
        decisions: rp.restored.decisions,
        history: rp.restored.history,
        historyCursor: rp.restored.historyCursor,
        resumePrompt: null,
        pickerError: null,
        restoredNotice: `Saved session restored: ${rp.restoredCount} earlier decisions.`,
        sortResult: null,
        sortProgress: null,
      })
    },

    discardResume() {
      const rp = get().resumePrompt
      if (!rp) return
      clearSession(rp.folderName)
      set({
        screen: 'sorting',
        dirHandle: rp.dirHandle,
        folderName: rp.folderName,
        items: rp.items,
        position: 0,
        decisions: {},
        history: [],
        historyCursor: 0,
        resumePrompt: null,
        pickerError: null,
        restoredNotice: null,
        sortResult: null,
        sortProgress: null,
      })
    },

    applyKeyEvent(e) {
      const action = classifyKey(e)
      if (action.type === 'bucket' || action.type === 'delete' || action.type === 'keep') {
        commit(applyKey(domainOf(get()), e))
      } else if (action.type === 'undo') {
        commit(undoReducer(domainOf(get())))
      } else if (action.type === 'redo') {
        commit(redoReducer(domainOf(get())))
      }
      // space / esc / noop → handled by the caller (useKeyboard), domain doesn't change
      return action
    },

    undo() {
      commit(undoReducer(domainOf(get())))
    },

    redo() {
      commit(redoReducer(domainOf(get())))
    },

    async runOrganize() {
      const { dirHandle, items, decisions, folderName } = get()
      if (!dirHandle || get().isSorting) return
      set({ isSorting: true, sortProgress: null })
      const plan = buildSortPlan(items, decisions)
      const result = await runSort(dirHandle, plan, (p) => set({ sortProgress: p }))
      if (result.failed.length === 0 && folderName) clearSession(folderName)
      set({ isSorting: false, sortResult: result, screen: 'done' })
    },

    reset() {
      const { folderName } = get()
      if (folderName) clearSession(folderName)
      set({
        ...emptyDomain,
        screen: 'picker',
        dirHandle: null,
        pickerError: null,
        restoredNotice: null,
        resumePrompt: null,
        isSorting: false,
        sortProgress: null,
        sortResult: null,
      })
    },

    backToPicker() {
      // After the Sort operation: doesn't delete anything (on success the session is already cleared), just navigates back.
      set({
        ...emptyDomain,
        screen: 'picker',
        dirHandle: null,
        pickerError: null,
        restoredNotice: null,
        resumePrompt: null,
        isSorting: false,
        sortProgress: null,
        sortResult: null,
      })
    },

    toggleVideo() {
      set((s) => ({ videoToggleNonce: s.videoToggleNonce + 1 }))
    },
  }
})
