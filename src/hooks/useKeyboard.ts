import { useEffect } from 'react'
import { useSortStore } from '../store/useSortStore'
import type { KeyEvent } from '../domain/types'

/**
 * Global keyboard handling for the Tinder view. Only active on the 'sorting' screen.
 * The domain decision is handled by store.applyKeyEvent; here we only prevent the
 * browser default + the Space (video toggle) UI effect happens.
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
          e.preventDefault() // don't scroll the page
          useSortStore.getState().toggleVideo()
          break
        case 'undo':
        case 'redo':
          e.preventDefault() // don't trigger the browser's own undo
          break
        case 'esc':
          // Animation cancellation is handled by CardStack/MediaCard; nothing to do here.
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
