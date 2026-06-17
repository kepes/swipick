import { useSortStore } from '../store/useSortStore'
import styles from './ResultScreen.module.css'

export function ResultScreen() {
  const sortResult = useSortStore(s => s.sortResult)

  if (!sortResult) return null

  const { moved, deleted, failed } = sortResult

  const summaryParts = [`${moved} kép áthelyezve`, `${deleted} törölve`]
  if (failed.length > 0) summaryParts.push(`${failed.length} sikertelen`)

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>✓ Kész!</h1>
      <p className={styles.summary}>{summaryParts.join(', ')}</p>

      {failed.length > 0 && (
        <div className={styles.failedSection}>
          <p className={styles.failedTitle}>Sikertelen fájlok:</p>
          <ul className={styles.failedList}>
            {failed.map(f => (
              <li key={f.name} className={styles.failedItem}>
                <span className={styles.failedName}>{f.name}</span> — {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button className={styles.button} onClick={() => useSortStore.getState().backToPicker()}>
        Vissza a mappaválasztóhoz
      </button>
    </div>
  )
}
