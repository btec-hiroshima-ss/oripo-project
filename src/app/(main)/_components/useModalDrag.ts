import { useState, useRef } from 'react'

type Offset = { x: number; y: number }

// モーダルをヘッダーでドラッグ移動するための hook。
// onMouseDown をヘッダー要素の onMouseDown に渡すだけで使える。
export function useModalDrag() {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const dragOrigin = useRef<Offset | null>(null)

  function onMouseDown(e: React.MouseEvent) {
    // ボタン類（閉じるボタン等）はドラッグ対象外
    if ((e.target as HTMLElement).closest('button')) return

    e.preventDefault()
    dragOrigin.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }

    function onMouseMove(e: MouseEvent) {
      if (!dragOrigin.current) return
      setOffset({ x: e.clientX - dragOrigin.current.x, y: e.clientY - dragOrigin.current.y })
    }

    function onMouseUp() {
      dragOrigin.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // モーダルの style と、ヘッダーに付ける onMouseDown を返す
  const style = {
    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
  }

  return { style, onMouseDown }
}
