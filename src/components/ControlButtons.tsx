import { useSortStore } from '../store/useSortStore'
import styles from './ControlButtons.module.css'

export function ControlButtons() {
  const historyCursor = useSortStore((s) => s.historyCursor)
  const historyLength = useSortStore((s) => s.history.length)
  const isSorting = useSortStore((s) => s.isSorting)
  const runOrganize = useSortStore((s) => s.runOrganize)

  return (
    <div className={styles.row}>
      <button
        className={`${styles.btn} ${styles.secondary}`}
        disabled={historyCursor === 0}
        onClick={() => useSortStore.getState().undo()}
      >
        Undo<span className={styles.keycap} aria-hidden="true">↓</span>
      </button>
      <button
        className={`${styles.btn} ${styles.secondary}`}
        disabled={historyCursor >= historyLength}
        onClick={() => useSortStore.getState().redo()}
      >
        Redo<span className={styles.keycap} aria-hidden="true">↑</span>
      </button>
      <button
        className={`${styles.btn} ${styles.primary}`}
        disabled={isSorting}
        onClick={() => runOrganize()}
      >
        Sort
      </button>
      <button
        className={`${styles.btn} ${styles.danger}`}
        onClick={() => useSortStore.getState().reset()}
      >
        Start over
      </button>
    </div>
  )
}
