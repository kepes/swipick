import { useSortStore } from '../store/useSortStore'
import { realGateway } from '../fs/gateway'
import { detectOS, ALL_TARGETS } from '../platform/downloads'
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
        <div className={styles.fallback}>
          <p className={styles.warning}>
            This browser is not supported. Swipick needs Chrome or Edge on desktop for
            secure local file handling.
          </p>
          <p className={styles.fallbackHint}>
            Open this page in Chrome or Edge, or download the desktop app:
          </p>
          {(() => {
            const os = detectOS()
            const primary = ALL_TARGETS.find((t) => t.os === os)
            const others = ALL_TARGETS.filter((t) => t !== primary)
            const primaryLabel = primary?.label.replace(/\s*\(.*\)$/, '') ?? ''
            return (
              <>
                {primary && (
                  <a className={styles.button} href={primary.url}>
                    Download for {primaryLabel}
                  </a>
                )}
                <div className={styles.downloads}>
                  {others.map((t) => (
                    <a key={t.os} className={styles.downloadLink} href={t.url}>
                      {t.label}
                    </a>
                  ))}
                </div>
              </>
            )
          })()}
        </div>
      )}

      {pickerError && <div className={styles.error}>{pickerError}</div>}
    </div>
  )
}
