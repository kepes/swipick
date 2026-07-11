import { useSortStore } from '../store/useSortStore'
import { realGateway } from '../fs/gateway'
import styles from './FolderPicker.module.css'

export function FolderPicker() {
  const pickerError = useSortStore((s) => s.pickerError)
  const resume = useSortStore((s) => s.resumePrompt)
  const supported = realGateway.isSupported()

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        Swipick<span className={styles.dot}>.</span>
      </h1>
      <p className={styles.subtitle}>Pick a folder and sort your images with the keyboard.</p>

      {resume ? (
        <div className={styles.resume}>
          <p className={styles.resumeText}>
            The folder <strong>{resume.folderName}</strong> has a saved session
            (<strong>{resume.restoredCount}</strong> earlier decisions).
          </p>
          <div className={styles.resumeActions}>
            <button
              className={styles.button}
              onClick={() => useSortStore.getState().confirmResume()}
            >
              Resume
            </button>
            <button
              className={styles.secondary}
              onClick={() => useSortStore.getState().discardResume()}
            >
              Start over
            </button>
          </div>
        </div>
      ) : supported ? (
        <button
          className={styles.button}
          onClick={() => useSortStore.getState().pickFolder(realGateway)}
        >
          Choose folder
        </button>
      ) : (
        <div className={styles.warning}>
          This browser is not supported — use Chrome or Edge.
        </div>
      )}

      {pickerError && <div className={styles.error}>{pickerError}</div>}
    </div>
  )
}
