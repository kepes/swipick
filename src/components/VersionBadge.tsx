import { VERSION } from '../version'
import styles from './VersionBadge.module.css'

/** Faint, non-interactive version label fixed in the top-left corner. */
export function VersionBadge({ version = VERSION }: { version?: string }) {
  const label = version === 'dev' ? 'dev' : `v${version}`
  return (
    <span className={styles.badge} aria-hidden="true">
      {label}
    </span>
  )
}
