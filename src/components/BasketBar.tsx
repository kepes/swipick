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

// Dock-nagyítás paraméterei: alap 56px (a korábbi 28px kétszerese), a kurzor
// alatt eddig nő, a hatótáv pedig hány pixelnyire terjed ki két oldalra.
const BASE_SIZE = 56
const PEAK_SIZE = 120
const RANGE = 160

function BucketChip({
  bucket,
  mouseX,
}: {
  bucket: Bucket
  mouseX: MotionValue<number>
}) {
  const chipRef = useRef<HTMLDivElement | null>(null)
  // A thumbnail blob-URL-je state-ben él → a src DEKLARATÍVAN kötődik, nem
  // imperatív imgRef.current.src-vel. (motion.img ref-csatolása aszinkron lehet,
  // ezért az imperatív megoldás resume-kor törött képet adott.)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  // A thumbnail elem típusa: videónál <video> kell, mert egy videó blob-URL-jét
  // egy <img> nem tudja megjeleníteni (törött előnézet).
  const [thumbKind, setThumbKind] = useState<MediaItem['kind']>('image')

  const items = useSortStore((s) => s.items)

  // A chip középpontjának vízszintes távolsága a kurzortól → ebből jön a méret.
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
      <span className={styles.label}>{label}</span>
      <span className={styles.count}>{bucket.members.length}</span>
    </div>
  )
}

export function BasketBar() {
  const items = useSortStore((s) => s.items)
  const decisions = useSortStore((s) => s.decisions)

  // Közös kurzor-pozíció: minden chip ehhez méri a saját távolságát.
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY)

  const bucketsMap = deriveBuckets(items, decisions)
  const buckets = Object.values(bucketsMap).sort((a, b) => {
    if (a.kind === 'delete') return 1
    if (b.kind === 'delete') return -1
    return a.key.localeCompare(b.key)
  })

  if (buckets.length === 0) return null

  return (
    <div
      className={styles.bar}
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
    >
      {buckets.map((b) => (
        <BucketChip key={b.key} bucket={b} mouseX={mouseX} />
      ))}
    </div>
  )
}
