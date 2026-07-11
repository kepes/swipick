import { useSortStore } from '../store/useSortStore'
import styles from './DoneScreen.module.css'

export function DoneScreen() {
  const runOrganize = useSortStore((s) => s.runOrganize)

  return (
    <div className={styles.container}>
      <p className={styles.message}>You've reviewed everything 🎉</p>
      <button className={styles.organizeBtn} onClick={() => runOrganize()}>
        Sort
      </button>
    </div>
  )
}
