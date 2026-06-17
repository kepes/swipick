import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSortStore } from '../store/useSortStore'
import { useMediaWindow } from '../hooks/useMediaWindow'
import { MediaCard } from './MediaCard'
import { DoneScreen } from './DoneScreen'
import { DELETE_BUCKET } from '../domain/types'
import styles from './CardStack.module.css'

function exitVariants(direction: 'right' | 'left' | 'up') {
  const map = {
    right: { x: 400, opacity: 0, rotate: 15 },
    left: { x: -400, opacity: 0, rotate: -15 },
    up: { y: -400, opacity: 0 },
  }
  return map[direction]
}

export function CardStack() {
  const items = useSortStore((s) => s.items)
  const position = useSortStore((s) => s.position)
  const history = useSortStore((s) => s.history)
  const historyCursor = useSortStore((s) => s.historyCursor)
  const videoToggleNonce = useSortStore((s) => s.videoToggleNonce)

  const prevPositionRef = useRef(position)
  const exitDirectionRef = useRef<'right' | 'left' | 'up'>('right')

  const isForward = position > prevPositionRef.current
  if (position !== prevPositionRef.current) {
    if (isForward && historyCursor > 0) {
      const lastEntry = history[historyCursor - 1]
      if (lastEntry?.nextBucket === null) {
        exitDirectionRef.current = 'right'
      } else if (lastEntry?.nextBucket === DELETE_BUCKET) {
        exitDirectionRef.current = 'left'
      } else {
        exitDirectionRef.current = 'up'
      }
    }
    prevPositionRef.current = position
  }

  const { urlFor } = useMediaWindow(items, position)

  if (position >= items.length) {
    return (
      <div className={styles.container}>
        <DoneScreen />
      </div>
    )
  }

  const currentItem = items[position]

  return (
    <div className={styles.container}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.fileName}
          className={styles.cardWrapper}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }}
          exit={exitVariants(exitDirectionRef.current)}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <MediaCard
            item={currentItem}
            url={urlFor(currentItem.fileName)}
            isTop={true}
            videoToggleNonce={videoToggleNonce}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
