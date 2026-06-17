import { describe, it, expect } from 'vitest'
import { sortItems } from './ordering'
import type { MediaItem } from './types'

function item(fileName: string, lastModified: number): MediaItem {
  return {
    fileName,
    kind: 'image',
    handle: {} as FileSystemFileHandle,
    lastModified,
    size: 0,
  }
}

describe('sortItems', () => {
  it('lastModified ASC szerint rendez', () => {
    const out = sortItems([item('c.jpg', 30), item('a.jpg', 10), item('b.jpg', 20)])
    expect(out.map((i) => i.fileName)).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
  })

  it('egyenlő lastModified-nél fileName szerint tie-break (localeCompare)', () => {
    const out = sortItems([item('banana.jpg', 5), item('apple.jpg', 5), item('cherry.jpg', 5)])
    expect(out.map((i) => i.fileName)).toEqual(['apple.jpg', 'banana.jpg', 'cherry.jpg'])
  })

  it('vegyesen: elsődleges lastModified, másodlagos fileName', () => {
    const out = sortItems([
      item('z.jpg', 20),
      item('b.jpg', 10),
      item('a.jpg', 10),
      item('y.jpg', 20),
    ])
    expect(out.map((i) => i.fileName)).toEqual(['a.jpg', 'b.jpg', 'y.jpg', 'z.jpg'])
  })

  it('nem mutálja a bemenetet (másolaton rendez)', () => {
    const input = [item('c.jpg', 30), item('a.jpg', 10)]
    const snapshot = input.map((i) => i.fileName)
    const out = sortItems(input)
    expect(input.map((i) => i.fileName)).toEqual(snapshot)
    expect(out).not.toBe(input)
  })

  it('üres tömbre üres tömböt ad', () => {
    expect(sortItems([])).toEqual([])
  })

  it('stabil tie-break: azonos lastModified ÉS név esetén az elemek megmaradnak', () => {
    const a = item('same.jpg', 5)
    const b = item('same.jpg', 5)
    const out = sortItems([a, b])
    expect(out).toHaveLength(2)
  })
})
