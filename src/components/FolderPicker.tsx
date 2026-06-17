import { useSortStore } from '../store/useSortStore'
import { realGateway } from '../fs/gateway'
import styles from './FolderPicker.module.css'

export function FolderPicker() {
  const pickerError = useSortStore(s => s.pickerError)
  const supported = realGateway.isSupported()

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Képrendező</h1>
      <p className={styles.subtitle}>Válassz egy mappát, és billentyűkkel rendezd a képeket.</p>

      {supported ? (
        <button
          className={styles.button}
          onClick={() => useSortStore.getState().pickFolder(realGateway)}
        >
          Mappa kiválasztása
        </button>
      ) : (
        <div className={styles.warning}>
          Ez a böngésző nem támogatott — használj Chrome-ot vagy Edge-et.
        </div>
      )}

      {pickerError && <div className={styles.error}>{pickerError}</div>}
    </div>
  )
}
