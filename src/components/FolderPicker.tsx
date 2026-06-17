import { useSortStore } from '../store/useSortStore'
import { realGateway } from '../fs/gateway'
import styles from './FolderPicker.module.css'

export function FolderPicker() {
  const pickerError = useSortStore((s) => s.pickerError)
  const resume = useSortStore((s) => s.resumePrompt)
  const supported = realGateway.isSupported()

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Képrendező</h1>
      <p className={styles.subtitle}>Válassz egy mappát, és billentyűkkel rendezd a képeket.</p>

      {resume ? (
        <div className={styles.resume}>
          <p className={styles.resumeText}>
            A(z) <strong>{resume.folderName}</strong> mappához mentett munkamenet tartozik
            (<strong>{resume.restoredCount}</strong> korábbi döntés).
          </p>
          <div className={styles.resumeActions}>
            <button
              className={styles.button}
              onClick={() => useSortStore.getState().confirmResume()}
            >
              Folytatás
            </button>
            <button
              className={styles.secondary}
              onClick={() => useSortStore.getState().discardResume()}
            >
              Újrakezdés
            </button>
          </div>
        </div>
      ) : supported ? (
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
