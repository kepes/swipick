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

/** A Rendezés bemenete: kosaranként a mozgatandó fájl-handle-ök (queue-sorrendben). */
export function buildSortPlan(items: MediaItem[], decisions: Record<string, Decision>): SortPlan {
  const plan: SortPlan = new Map()
  for (const item of items) {
    const decision = decisions[item.fileName]
    if (!decision) continue // keep / besorolatlan → helyben marad
    const list = plan.get(decision.bucket) ?? []
    list.push(item.handle)
    plan.set(decision.bucket, list)
  }
  return plan
}

function pickerMessage(err: FolderReadError): string | null {
  switch (err.type) {
    case 'aborted':
      return null // néma — a user megszakította
    case 'permission-denied':
      return 'Írási engedély szükséges a mappához — a Képrendező fájlokat mozgat.'
    case 'empty':
      return 'Ebben a mappában nincs megjeleníthető kép vagy videó.'
    case 'unsupported-browser':
      return 'Ez a böngésző nem támogatott. Használj Chrome-ot vagy Edge-et (File System Access API kell).'
  }
}

function isFolderReadError(e: unknown): e is FolderReadError {
  return typeof e === 'object' && e !== null && 'type' in e
}

interface StoreState extends SortState {
  screen: Screen
  dirHandle: FileSystemDirectoryHandle | null
  pickerError: string | null
  restoredNotice: string | null
  isSorting: boolean
  sortProgress: SortProgress | null
  sortResult: MoveResult | null

  pickFolder: (gateway: FileSystemGateway) => Promise<void>
  applyKeyEvent: (e: KeyEvent) => KeyAction
  undo: () => void
  redo: () => void
  runOrganize: () => Promise<void>
  reset: () => void
  backToPicker: () => void
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
  /** Domain-state alkalmazása + folder-scoped mentés. */
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
    isSorting: false,
    sortProgress: null,
    sortResult: null,

    async pickFolder(gateway) {
      set({ pickerError: null, restoredNotice: null })
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
      let decisions: Record<string, Decision> = {}
      let history: HistoryEntry[] = []
      let historyCursor = 0
      let position = 0
      let restoredNotice: string | null = null

      const persisted = loadSession(folderName)
      if (persisted) {
        const r = reconcile(persisted, items)
        decisions = r.decisions
        history = r.history
        historyCursor = r.historyCursor
        position = r.position
        const restored = Object.keys(decisions).length
        if (restored > 0) {
          restoredNotice = `Mentett munkamenet visszatöltve: ${restored} korábbi döntés.`
        }
      }

      set({
        screen: 'sorting',
        dirHandle,
        folderName,
        items,
        position,
        decisions,
        history,
        historyCursor,
        pickerError: null,
        restoredNotice,
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
      // space / esc / noop → a hívó (useKeyboard) kezeli, domain nem változik
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
        isSorting: false,
        sortProgress: null,
        sortResult: null,
      })
    },

    backToPicker() {
      // A Rendezés után: nem töröl semmit (a munkamenet siker esetén már törölt), csak visszanavigál.
      set({
        ...emptyDomain,
        screen: 'picker',
        dirHandle: null,
        pickerError: null,
        restoredNotice: null,
        isSorting: false,
        sortProgress: null,
        sortResult: null,
      })
    },
  }
})
