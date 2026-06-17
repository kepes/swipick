import { useEffect, useRef } from 'react'
import { useSortStore } from '../store/useSortStore'
import { deriveBuckets } from '../domain/buckets'
import { DELETE_DISPLAY } from '../domain/types'
import type { Bucket } from '../domain/types'
import styles from './BasketBar.module.css'

function BucketChip({ bucket }: { bucket: Bucket }) {
  const urlRef = useRef<string | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const items = useSortStore((s) => s.items)

  useEffect(() => {
    if (!bucket.thumbnail) return
    const item = items.find((it) => it.fileName === bucket.thumbnail)
    if (!item) return

    let cancelled = false
    item.handle.getFile().then((file) => {
      if (cancelled) return
      const url = URL.createObjectURL(file)
      urlRef.current = url
      if (imgRef.current) imgRef.current.src = url
    })

    return () => {
      cancelled = true
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [bucket.thumbnail, items])

  const isDelete = bucket.kind === 'delete'
  const label = isDelete ? DELETE_DISPLAY : bucket.key.toUpperCase()

  return (
    <div className={`${styles.chip} ${isDelete ? styles.delete : ''}`}>
      {bucket.thumbnail && (
        <img
          ref={imgRef}
          className={styles.thumb}
          alt={label}
          src={urlRef.current ?? undefined}
        />
      )}
      <span className={styles.label}>{label}</span>
      <span className={styles.count}>{bucket.members.length}</span>
    </div>
  )
}

export function BasketBar() {
  const items = useSortStore((s) => s.items)
  const decisions = useSortStore((s) => s.decisions)

  const bucketsMap = deriveBuckets(items, decisions)
  const buckets = Object.values(bucketsMap).sort((a, b) => {
    if (a.kind === 'delete') return 1
    if (b.kind === 'delete') return -1
    return a.key.localeCompare(b.key)
  })

  if (buckets.length === 0) return null

  return (
    <div className={styles.bar}>
      {buckets.map((b) => (
        <BucketChip key={b.key} bucket={b} />
      ))}
    </div>
  )
}
