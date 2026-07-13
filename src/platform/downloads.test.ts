import { describe, it, expect } from 'vitest'
import { detectOS, downloadUrl, ALL_TARGETS } from './downloads'

describe('detectOS', () => {
  it('detects macOS from platform', () => {
    expect(detectOS({ platform: 'MacIntel' })).toBe('mac')
  })
  it('detects Windows from platform', () => {
    expect(detectOS({ platform: 'Win32' })).toBe('win')
  })
  it('detects Linux from platform', () => {
    expect(detectOS({ platform: 'Linux x86_64' })).toBe('linux')
  })
  it('prefers userAgentData.platform over platform', () => {
    expect(detectOS({ userAgentData: { platform: 'Windows' }, platform: 'MacIntel' })).toBe('win')
  })
  it('returns unknown for an unrecognized platform', () => {
    expect(detectOS({ platform: 'SomethingElse' })).toBe('unknown')
  })
})

describe('downloadUrl', () => {
  it('returns the direct macOS asset URL', () => {
    expect(downloadUrl('mac')).toBe(
      'https://github.com/kepes/swipick/releases/latest/download/Swipick-mac.dmg',
    )
  })
  it('returns the direct Windows asset URL', () => {
    expect(downloadUrl('win')).toBe(
      'https://github.com/kepes/swipick/releases/latest/download/Swipick-win.exe',
    )
  })
  it('returns the releases page for unknown', () => {
    expect(downloadUrl('unknown')).toBe('https://github.com/kepes/swipick/releases/latest')
  })
})

describe('ALL_TARGETS', () => {
  it('lists the three platforms in order', () => {
    expect(ALL_TARGETS.map((t) => t.os)).toEqual(['mac', 'win', 'linux'])
  })
})
