import { useEffect } from 'react'
import { useSortStore } from '../store/useSortStore'
import type { KeyEvent } from '../domain/types'

/**
 * Globális billentyűkezelés a Tinder-nézethez. Csak a 'sorting' képernyőn aktív.
 * A domain-döntést a store.applyKeyEvent intézi; itt csak a böngésző-default
 * megakadályozása + a Space (videó toggle) UI-hatás történik.
 */
export function useKeyboard() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (useSortStore.getState().screen !== 'sorting') return

      const ev: KeyEvent = {
        key: e.key,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
      }

      const action = useSortStore.getState().applyKeyEvent(ev)

      switch (action.type) {
        case 'space':
          e.preventDefault() // ne görgessen az oldal
          useSortStore.getState().toggleVideo()
          break
        case 'undo':
        case 'redo':
          e.preventDefault() // ne süljön el a böngésző saját undo-ja
          break
        case 'esc':
          // Az animáció-megszakítást a CardStack/MediaCard kezeli; itt nincs teendő.
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
