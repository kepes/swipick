import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { useSortStore } from '../store/useSortStore'
import { deriveBuckets } from '../domain/buckets'
import { DELETE_DISPLAY } from '../domain/types'
import type { Bucket, MediaItem } from '../domain/types'
import styles from './BasketBar.module.css'

// Dock magnification: base 44px thumbnail, growing to 84px under the cursor
// (neighbours land around 60px), with the RANGE controlling how far the swell
// reaches to each side.
const BASE_SIZE = 44
const PEAK_SIZE = 84
const RANGE = 120

function BucketChip({
  bucket,
  mouseX,
}: {
  bucket: Bucket
  mouseX: MotionValue<number>
}) {
  const chipRef = useRef<HTMLDivElement | null>(null)
  // The thumbnail blob-URL lives in state → the src is bound DECLARATIVELY, not
  // via imperative imgRef.current.src. (motion.img ref attachment can be async,
  // so the imperative approach gave a broken image on resume.)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  // The thumbnail element type: a video needs <video>, because an <img> cannot
  // display a video blob-URL (broken preview).
  const [thumbKind, setThumbKind] = useState<MediaItem['kind']>('image')

  const items = useSortStore((s) => s.items)

  // The horizontal distance of the chip's center from the cursor → drives the size.
  const distance = useTransform(mouseX, (x) => {
    const rect = chipRef.current?.getBoundingClientRect()
    if (!rect) return RANGE + 1
    return x - (rect.x + rect.width / 2)
  })
  const sizeTarget = useTransform(
    distance,
    [-RANGE, 0, RANGE],
    [BASE_SIZE, PEAK_SIZE, BASE_SIZE],
  )
  const size = useSpring(sizeTarget, { mass: 0.1, stiffness: 170, damping: 14 })

  useEffect(() => {
    if (!bucket.thumbnail) {
      setThumbUrl(null)
      return
    }
    const item = items.find((it) => it.fileName === bucket.thumbnail)
    if (!item) {
      setThumbUrl(null)
      return
    }

    setThumbKind(item.kind)
    let cancelled = false
    let createdUrl: string | null = null
    item.handle.getFile().then((file) => {
      if (cancelled) return
      createdUrl = URL.createObjectURL(file)
      setThumbUrl(createdUrl)
    })

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [bucket.thumbnail, items])

  const isDelete = bucket.kind === 'delete'
  const label = isDelete ? DELETE_DISPLAY : bucket.key.toUpperCase()

  return (
    <div
      ref={chipRef}
      className={`${styles.chip} ${isDelete ? styles.delete : ''}`}
    >
      {bucket.thumbnail &&
        (thumbKind === 'video' ? (
          <motion.video
            className={styles.thumb}
            src={thumbUrl ?? undefined}
            muted
            playsInline
            preload="metadata"
            style={{ width: size, height: size }}
          />
        ) : (
          <motion.img
            className={styles.thumb}
            alt={label}
            src={thumbUrl ?? undefined}
            style={{ width: size, height: size }}
          />
        ))}
      <span className={styles.keycap}>{label}</span>
      <span className={styles.count}>{bucket.members.length}</span>
    </div>
  )
}

export function BasketBar() {
  const items = useSortStore((s) => s.items)
  const decisions = useSortStore((s) => s.decisions)

  // Shared cursor position: every chip measures its own distance against this.
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY)

  const bucketsMap = deriveBuckets(items, decisions)
  const buckets = Object.values(bucketsMap).sort((a, b) => {
    if (a.kind === 'delete') return 1
    if (b.kind === 'delete') return -1
    return a.key.localeCompare(b.key)
  })

  // Empty state: nudge the user toward the keyboard-first flow.
  if (buckets.length === 0) {
    return (
      <div className={styles.bar}>
        <div className={styles.hint}>Press any letter to create a bucket</div>
      </div>
    )
  }

  const userBuckets = buckets.filter((b) => b.kind !== 'delete')
  const deleteBucket = buckets.find((b) => b.kind === 'delete')

  return (
    <div
      className={styles.bar}
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
    >
      {userBuckets.length > 0 && (
        <div className={styles.panel}>
          {userBuckets.map((b) => (
            <BucketChip key={b.key} bucket={b} mouseX={mouseX} />
          ))}
        </div>
      )}
      {deleteBucket && (
        <div className={`${styles.panel} ${styles.deletePanel}`}>
          <BucketChip bucket={deleteBucket} mouseX={mouseX} />
        </div>
      )}
    </div>
  )
}
