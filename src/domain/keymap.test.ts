import { describe, it, expect } from 'vitest'
import { classifyKey } from './keymap'
import type { KeyEvent } from './types'

function ev(key: string, mods: Partial<Omit<KeyEvent, 'key'>> = {}): KeyEvent {
  return {
    key,
    ctrlKey: mods.ctrlKey ?? false,
    shiftKey: mods.shiftKey ?? false,
    metaKey: mods.metaKey ?? false,
    altKey: mods.altKey ?? false,
  }
}

describe('classifyKey — fenntartott kombók (precedencia)', () => {
  it('Ctrl+Z → undo', () => {
    expect(classifyKey(ev('z', { ctrlKey: true }))).toEqual({ type: 'undo' })
  })
  it('Cmd+Z → undo (metaKey ≡ ctrlKey)', () => {
    expect(classifyKey(ev('z', { metaKey: true }))).toEqual({ type: 'undo' })
  })
  it('Ctrl+Shift+Z → redo', () => {
    expect(classifyKey(ev('z', { ctrlKey: true, shiftKey: true }))).toEqual({ type: 'redo' })
  })
  it('Cmd+Shift+Z → redo', () => {
    expect(classifyKey(ev('z', { metaKey: true, shiftKey: true }))).toEqual({ type: 'redo' })
  })
  it('Ctrl+Y → redo', () => {
    expect(classifyKey(ev('y', { ctrlKey: true }))).toEqual({ type: 'redo' })
  })
  it('Cmd+Y → redo', () => {
    expect(classifyKey(ev('y', { metaKey: true }))).toEqual({ type: 'redo' })
  })
  it('nagy Z is megy undo-ra Ctrl-lal (case-insensitive)', () => {
    expect(classifyKey(ev('Z', { ctrlKey: true }))).toEqual({ type: 'undo' })
  })
})

describe('classifyKey — speciális kulcsok', () => {
  it("Space (' ') → space", () => {
    expect(classifyKey(ev(' '))).toEqual({ type: 'space' })
  })
  it('Escape → esc', () => {
    expect(classifyKey(ev('Escape'))).toEqual({ type: 'esc' })
  })
  it('ArrowRight → keep', () => {
    expect(classifyKey(ev('ArrowRight'))).toEqual({ type: 'keep' })
  })
  it('ArrowLeft → delete', () => {
    expect(classifyKey(ev('ArrowLeft'))).toEqual({ type: 'delete' })
  })
})

describe('classifyKey — betű-kosarak', () => {
  it('a → bucket a', () => {
    expect(classifyKey(ev('a'))).toEqual({ type: 'bucket', bucketKey: 'a' })
  })
  it('A → bucket a (case-insensitive)', () => {
    expect(classifyKey(ev('A'))).toEqual({ type: 'bucket', bucketKey: 'a' })
  })
  it('Shift+A → bucket a (Shift OK)', () => {
    expect(classifyKey(ev('A', { shiftKey: true }))).toEqual({ type: 'bucket', bucketKey: 'a' })
  })
  it('z (Ctrl nélkül) → bucket z', () => {
    expect(classifyKey(ev('z'))).toEqual({ type: 'bucket', bucketKey: 'z' })
  })
  it('y (Ctrl nélkül) → bucket y', () => {
    expect(classifyKey(ev('y'))).toEqual({ type: 'bucket', bucketKey: 'y' })
  })
  it('minden a–z betű kosarat ad', () => {
    for (const c of 'abcdefghijklmnopqrstuvwxyz') {
      expect(classifyKey(ev(c))).toEqual({ type: 'bucket', bucketKey: c })
    }
  })
})

describe('classifyKey — szám-kosarak', () => {
  it('0..9 → bucket', () => {
    for (const c of '0123456789') {
      expect(classifyKey(ev(c))).toEqual({ type: 'bucket', bucketKey: c })
    }
  })
})

describe('classifyKey — modifier + betű → noop (kivéve z/y)', () => {
  it('Ctrl+A → noop', () => {
    expect(classifyKey(ev('a', { ctrlKey: true }))).toEqual({ type: 'noop' })
  })
  it('Cmd+A → noop', () => {
    expect(classifyKey(ev('a', { metaKey: true }))).toEqual({ type: 'noop' })
  })
  it('Alt nélküli modellünkben Ctrl+B → noop', () => {
    expect(classifyKey(ev('b', { ctrlKey: true }))).toEqual({ type: 'noop' })
  })
  it('Alt+a → noop (Alt nem hoz létre kosarat)', () => {
    expect(classifyKey(ev('a', { altKey: true }))).toEqual({ type: 'noop' })
  })
  it('Ctrl+1 → noop (szám is)', () => {
    expect(classifyKey(ev('1', { ctrlKey: true }))).toEqual({ type: 'noop' })
  })
})

describe('classifyKey — noop esetek', () => {
  const noopKeys = ['/', '\\', ':', '*', '?', '<', '>', '|', '.', 'Tab', 'Enter', 'F1', 'ArrowUp']
  for (const k of noopKeys) {
    it(`'${k}' → noop`, () => {
      expect(classifyKey(ev(k))).toEqual({ type: 'noop' })
    })
  }
})
