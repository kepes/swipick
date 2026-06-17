import { describe, it, expect } from 'vitest'
import { deriveBuckets } from './buckets'
import { DELETE_BUCKET } from './types'
import type { MediaItem, Decision } from './types'

function item(fileName: string): MediaItem {
  return {
    fileName,
    kind: 'image',
    handle: {} as FileSystemFileHandle,
    lastModified: 0,
    size: 0,
  }
}

function dec(fileName: string, bucket: string): Decision {
  return { fileName, bucket }
}

describe('deriveBuckets', () => {
  it('üres decisions → üres objektum', () => {
    expect(deriveBuckets([item('a.jpg')], {})).toEqual({})
  })

  it('members sorrend = items (queue) sorrend, thumbnail = members[0]', () => {
    const items = [item('1.jpg'), item('2.jpg'), item('3.jpg')]
    const decisions: Record<string, Decision> = {
      '3.jpg': dec('3.jpg', 'a'),
      '1.jpg': dec('1.jpg', 'a'),
      '2.jpg': dec('2.jpg', 'a'),
    }
    const buckets = deriveBuckets(items, decisions)
    expect(buckets['a'].members).toEqual(['1.jpg', '2.jpg', '3.jpg'])
    expect(buckets['a'].thumbnail).toBe('1.jpg')
    expect(buckets['a'].key).toBe('a')
    expect(buckets['a'].kind).toBe('normal')
  })

  it('delete kosár kind = delete', () => {
    const items = [item('x.jpg')]
    const buckets = deriveBuckets(items, { 'x.jpg': dec('x.jpg', DELETE_BUCKET) })
    expect(buckets[DELETE_BUCKET].kind).toBe('delete')
    expect(buckets[DELETE_BUCKET].thumbnail).toBe('x.jpg')
  })

  it('több kosár külön members listával', () => {
    const items = [item('1.jpg'), item('2.jpg'), item('3.jpg')]
    const buckets = deriveBuckets(items, {
      '1.jpg': dec('1.jpg', 'a'),
      '2.jpg': dec('2.jpg', 'b'),
      '3.jpg': dec('3.jpg', 'a'),
    })
    expect(buckets['a'].members).toEqual(['1.jpg', '3.jpg'])
    expect(buckets['b'].members).toEqual(['2.jpg'])
  })

  it('nem mutálja a bemenetet', () => {
    const items = [item('1.jpg')]
    const decisions = { '1.jpg': dec('1.jpg', 'a') }
    const frozenItems = Object.freeze(items)
    const frozenDec = Object.freeze(decisions)
    expect(() => deriveBuckets(frozenItems as MediaItem[], frozenDec)).not.toThrow()
  })
})
