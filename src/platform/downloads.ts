export type OS = 'mac' | 'win' | 'linux' | 'unknown'

const RELEASES_LATEST = 'https://github.com/kepes/swipick/releases/latest'

const ASSET: Record<Exclude<OS, 'unknown'>, string> = {
  mac: 'Swipick-mac.dmg',
  win: 'Swipick-win.exe',
  linux: 'Swipick-linux.AppImage',
}

interface NavLike {
  userAgentData?: { platform?: string }
  platform?: string
  userAgent?: string
}

/** Best-effort OS detection: userAgentData.platform → platform → userAgent. */
export function detectOS(nav: NavLike = navigator): OS {
  const raw = (nav.userAgentData?.platform || nav.platform || nav.userAgent || '').toLowerCase()
  if (raw.includes('mac')) return 'mac'
  if (raw.includes('win')) return 'win'
  if (raw.includes('linux') || raw.includes('x11')) return 'linux'
  return 'unknown'
}

/** Direct release-asset URL for the OS, or the releases page for `unknown`. */
export function downloadUrl(os: OS): string {
  if (os === 'unknown') return RELEASES_LATEST
  return `${RELEASES_LATEST}/download/${ASSET[os]}`
}

export const ALL_TARGETS: { os: OS; label: string; url: string }[] = [
  { os: 'mac', label: 'macOS (.dmg)', url: downloadUrl('mac') },
  { os: 'win', label: 'Windows (.exe)', url: downloadUrl('win') },
  { os: 'linux', label: 'Linux (.AppImage)', url: downloadUrl('linux') },
]
