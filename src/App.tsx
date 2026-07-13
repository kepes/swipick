import { useSortStore } from './store/useSortStore'
import { useKeyboard } from './hooks/useKeyboard'
import { FolderPicker } from './components/FolderPicker'
import { ResultScreen } from './components/ResultScreen'
import { BasketBar } from './components/BasketBar'
import { ProgressBadge } from './components/ProgressBadge'
import { CardStack } from './components/CardStack'
import { ControlButtons } from './components/ControlButtons'
import { ThemeToggle } from './components/ThemeToggle'
import { VersionBadge } from './components/VersionBadge'
import styles from './App.module.css'

function SortingView() {
  const position = useSortStore((s) => s.position)
  const total = useSortStore((s) => s.items.length)
  const currentFileName = useSortStore((s) => s.items[s.position]?.fileName)
  const restoredNotice = useSortStore((s) => s.restoredNotice)
  const isSorting = useSortStore((s) => s.isSorting)
  const progress = useSortStore((s) => s.sortProgress)

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <BasketBar />
      </header>

      <main className={styles.main}>
        <div className={styles.progress}>
          <ProgressBadge position={position} total={total} />
        </div>
        <CardStack />
      </main>

      <footer className={styles.footer}>
        {currentFileName && (
          <div className={styles.fileName}>{currentFileName}</div>
        )}
        <ControlButtons />
      </footer>

      {restoredNotice && <div className={styles.notice}>{restoredNotice}</div>}

      <ThemeToggle />

      {isSorting && (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <div className={styles.spinner} />
            <p className={styles.overlayText}>
              Sorting in progress
              {progress ? ` — ${progress.done} / ${progress.total}` : '…'}
            </p>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{
                  width: progress
                    ? `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%`
                    : '35%',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const screen = useSortStore((s) => s.screen)
  useKeyboard()

  let view
  if (screen === 'picker') view = <FolderPicker />
  else if (screen === 'done') view = <ResultScreen />
  else view = <SortingView />

  return (
    <>
      {view}
      <VersionBadge />
    </>
  )
}
