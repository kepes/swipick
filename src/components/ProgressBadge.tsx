import styles from './ProgressBadge.module.css'

interface Props {
  position: number
  total: number
}

export function ProgressBadge({ position, total }: Props) {
  if (position >= total) return null
  return <span className={styles.badge}>{position + 1} / {total}</span>
}
