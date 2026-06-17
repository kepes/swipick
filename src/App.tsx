import { useSortStore } from './store/useSortStore'
import { useKeyboard } from './hooks/useKeyboard'
import { FolderPicker } from './components/FolderPicker'
import { ResultScreen } from './components/ResultScreen'
import { BasketBar } from './components/BasketBar'
import { ProgressBadge } from './components/ProgressBadge'
import { CardStack } from './components/CardStack'
import { ControlButtons } from './components/ControlButtons'
import styles from './App.module.css'

function SortingView() {
  const position = useSortStore((s) => s.position)
  const total = useSortStore((s) => s.items.length)
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
        <ControlButtons />
      </footer>

      {restoredNotice && <div className={styles.notice}>{restoredNotice}</div>}

      {isSorting && (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <div className={styles.spinner} />
            <p>
              Rendezés folyamatban
              {progress ? ` — ${progress.done} / ${progress.total}` : '…'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const screen = useSortStore((s) => s.screen)
  useKeyboard()

  if (screen === 'picker') return <FolderPicker />
  if (screen === 'done') return <ResultScreen />
  return <SortingView />
}
