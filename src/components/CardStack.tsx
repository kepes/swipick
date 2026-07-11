import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSortStore } from '../store/useSortStore'
import { useMediaWindow } from '../hooks/useMediaWindow'
import { MediaCard } from './MediaCard'
import { DoneScreen } from './DoneScreen'
import { DELETE_BUCKET, type MediaItem } from '../domain/types'
import styles from './CardStack.module.css'

// Preview of the next two upcoming items in the bottom-left corner (20vh tall).
function NextUpPreview({
  upcoming,
  urlFor,
}: {
  upcoming: MediaItem[]
  urlFor: (fileName: string) => string | undefined
}) {
  if (upcoming.length === 0) return null
  return (
    <div className={styles.nextUp} aria-hidden="true">
      {upcoming.map((item) => {
        const url = urlFor(item.fileName)
        return (
          <div key={item.fileName} className={styles.nextThumb}>
            {item.kind === 'image' ? (
              <img src={url} alt="" />
            ) : (
              <video src={url} muted playsInline preload="metadata" />
            )}
          </div>
        )
      })}
    </div>
  )
}

const cardVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 },
  // Function variant: AnimatePresence's `custom` resolves it on exit with the FRESH
  // direction (label-based exit → the exiting card gets the direction of the latest decision).
  exit: (direction: 'right' | 'left' | 'up') => {
    const map = {
      right: { x: '130%', opacity: 0, rotate: 15 },
      left: { x: '-130%', opacity: 0, rotate: -15 },
      up: { y: '-130%', opacity: 0 },
    }
    return map[direction]
  },
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
  // The next image is on the RIGHT (closer to the card), the one after it on the left.
  const upcoming = items.slice(position + 1, position + 3).reverse()

  return (
    <div className={styles.container}>
      <AnimatePresence mode="wait" custom={exitDirectionRef.current}>
        <motion.div
          key={currentItem.fileName}
          className={styles.cardWrapper}
          custom={exitDirectionRef.current}
          variants={cardVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <MediaCard
            item={currentItem}
            url={urlFor(currentItem.fileName)}
            isTop={true}
            videoToggleNonce={videoToggleNonce}
          />
        </motion.div>
      </AnimatePresence>

      <NextUpPreview upcoming={upcoming} urlFor={urlFor} />
    </div>
  )
}
