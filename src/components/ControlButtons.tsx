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
        className={styles.btn}
        disabled={historyCursor === 0}
        onClick={() => useSortStore.getState().undo()}
      >
        ◀ visszavon
      </button>
      <button
        className={styles.btn}
        disabled={historyCursor >= historyLength}
        onClick={() => useSortStore.getState().redo()}
      >
        újra
      </button>
      <button
        className={`${styles.btn} ${styles.primary}`}
        disabled={isSorting}
        onClick={() => runOrganize()}
      >
        Rendezés
      </button>
      <button
        className={`${styles.btn} ${styles.danger}`}
        onClick={() => useSortStore.getState().reset()}
      >
        Újrakezdés
      </button>
    </div>
  )
}
