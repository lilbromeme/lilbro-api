import { useEffect } from 'react'

const CODE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
]

export default function useKonami(onUnlock) {
  useEffect(() => {
    let progress = 0
    function onKey(e) {
      const expected = CODE[progress]
      if (e.key === expected) {
        progress++
        if (progress === CODE.length) {
          onUnlock()
          progress = 0
        }
      } else {
        progress = e.key === CODE[0] ? 1 : 0
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onUnlock])
}
