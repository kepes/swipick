import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaItem } from '../domain/types'
import { MediaCard } from './MediaCard'

function makeItem(kind: 'image' | 'video', name = 'test.jpg'): MediaItem {
  return {
    fileName: name,
    kind,
    handle: {} as FileSystemFileHandle,
    lastModified: 0,
    size: 0,
  }
}

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  HTMLMediaElement.prototype.pause = vi.fn()
})

describe('MediaCard', () => {
  it('renders img with correct src and alt for image item', () => {
    const item = makeItem('image', 'photo.jpg')
    render(<MediaCard item={item} url="blob:fake/photo.jpg" isTop={true} />)
    const img = screen.getByAltText('photo.jpg') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.src).toContain('blob:fake/photo.jpg')
  })

  it('renders video with muted, loop, autoplay for video item', () => {
    const item = makeItem('video', 'clip.mp4')
    render(<MediaCard item={item} url="blob:fake/clip.mp4" isTop={true} />)
    const video = document.querySelector('video') as HTMLVideoElement
    expect(video).toBeTruthy()
    expect(video.muted).toBe(true)
    expect(video.hasAttribute('loop')).toBe(true)
    expect(video.hasAttribute('autoplay')).toBe(true)
  })

  it('shows placeholder when url is undefined', () => {
    const item = makeItem('image', 'photo.jpg')
    render(<MediaCard item={item} url={undefined} isTop={true} />)
    const img = screen.getByAltText('photo.jpg') as HTMLImageElement
    expect(img).toBeTruthy()
  })
})
