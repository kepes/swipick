import { useEffect, useRef } from 'react'
import type { MediaItem } from '../domain/types'
import styles from './MediaCard.module.css'

interface Props {
  item: MediaItem
  url: string | undefined
  isTop: boolean
  videoToggleNonce?: number
}

export function MediaCard({ item, url, isTop, videoToggleNonce }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!isTop || !videoRef.current) return
    const video = videoRef.current
    if (video.paused) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [videoToggleNonce]) // eslint-disable-line react-hooks/exhaustive-deps

  if (item.kind === 'image') {
    return (
      <div className={styles.card}>
        <img className={styles.media} src={url} alt={item.fileName} />
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <video
        ref={videoRef}
        className={styles.media}
        src={url}
        muted
        loop
        autoPlay
        playsInline
      />
    </div>
  )
}
