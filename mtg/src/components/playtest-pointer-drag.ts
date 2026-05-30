import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'

export type PlaytestState = {
  library: unknown[]
  hand: unknown[]
  battlefield: unknown[]
  graveyard: unknown[]
  exile: unknown[]
  command: unknown[]
}

export type PlaytestZone =
  | 'library'
  | 'hand'
  | 'battlefield'
  | 'graveyard'
  | 'exile'
  | 'command'

export type DragPayload = {
  zone: PlaytestZone
  index: number
  uid?: string
}

type ActiveDrag = {
  payload: DragPayload
  pointerId: number
  offsetX: number
  offsetY: number
  clientX: number
  clientY: number
}

type PendingPointer = {
  payload: DragPayload
  pointerId: number
  startX: number
  startY: number
  captureEl: HTMLElement
}

const DRAG_THRESHOLD_PX = 5

export function findPlaytestDropZone(clientX: number, clientY: number): PlaytestZone | null {
  const el = document.elementFromPoint(clientX, clientY)
  const zoneEl = el?.closest('[data-playtest-zone]')
  const zone = zoneEl?.getAttribute('data-playtest-zone')
  if (
    zone === 'library' ||
    zone === 'hand' ||
    zone === 'battlefield' ||
    zone === 'graveyard' ||
    zone === 'exile' ||
    zone === 'command'
  ) {
    return zone
  }
  return null
}

export function bfPositionFromClient(
  bfRef: RefObject<HTMLDivElement | null>,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = bfRef.current?.getBoundingClientRect()
  if (!rect) return { x: 40, y: 40 }
  return {
    x: Math.max(0, Math.min(clientX - rect.left - 32, rect.width - 64)),
    y: Math.max(0, Math.min(clientY - rect.top - 44, rect.height - 88)),
  }
}

type UsePlaytestPointerDragOptions = {
  playtest: PlaytestState | null
  bfRef: RefObject<HTMLDivElement | null>
  onMove: (
    from: DragPayload,
    to: PlaytestZone,
    bfPos?: { x: number; y: number },
  ) => void
  onReposition: (index: number, pos: { x: number; y: number }) => void
}

export function usePlaytestPointerDrag({
  playtest,
  bfRef,
  onMove,
  onReposition,
}: UsePlaytestPointerDragOptions) {
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)
  const [dragOverZone, setDragOverZone] = useState<PlaytestZone | null>(null)
  const pendingRef = useRef<PendingPointer | null>(null)
  const activeDragRef = useRef<ActiveDrag | null>(null)

  useEffect(() => {
    activeDragRef.current = activeDrag
  }, [activeDrag])

  useEffect(() => {
    if (!activeDrag) return
    const prevOverflow = document.body.style.overflow
    const prevTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.touchAction = prevTouchAction
    }
  }, [activeDrag])

  const finishDrag = useCallback(
    (drag: ActiveDrag, clientX: number, clientY: number) => {
      const toZone = findPlaytestDropZone(clientX, clientY)
      if (!toZone || !playtest) {
        setDragOverZone(null)
        return
      }

      if (toZone === 'battlefield' && drag.payload.zone === 'battlefield') {
        const pos = bfPositionFromClient(bfRef, clientX, clientY)
        onReposition(drag.payload.index, pos)
      } else {
        const bfPos =
          toZone === 'battlefield' ? bfPositionFromClient(bfRef, clientX, clientY) : undefined
        onMove(drag.payload, toZone, bfPos)
      }
      setDragOverZone(null)
    },
    [playtest, bfRef, onMove, onReposition],
  )

  const cancelPending = useCallback(() => {
    const pending = pendingRef.current
    if (pending) {
      try {
        pending.captureEl.releasePointerCapture(pending.pointerId)
      } catch {
        /* already released */
      }
    }
    pendingRef.current = null
  }, [])

  const onCardPointerDown = useCallback(
    (e: React.PointerEvent, payload: DragPayload) => {
      if (!playtest || e.button !== 0) return
      const captureEl = e.currentTarget as HTMLElement
      captureEl.setPointerCapture(e.pointerId)
      pendingRef.current = {
        payload,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        captureEl,
      }
    },
    [playtest],
  )

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const pending = pendingRef.current
      const active = activeDragRef.current

      if (pending && pending.pointerId === e.pointerId && !active) {
        const dx = e.clientX - pending.startX
        const dy = e.clientY - pending.startY
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return

        e.preventDefault()
        const rect = pending.captureEl.getBoundingClientRect()
        const next: ActiveDrag = {
          payload: pending.payload,
          pointerId: e.pointerId,
          offsetX: pending.startX - rect.left,
          offsetY: pending.startY - rect.top,
          clientX: e.clientX,
          clientY: e.clientY,
        }
        activeDragRef.current = next
        setActiveDrag(next)
        setDragOverZone(findPlaytestDropZone(e.clientX, e.clientY))
        return
      }

      if (active && active.pointerId === e.pointerId) {
        e.preventDefault()
        const next = { ...active, clientX: e.clientX, clientY: e.clientY }
        activeDragRef.current = next
        setActiveDrag(next)
        setDragOverZone(findPlaytestDropZone(e.clientX, e.clientY))
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      const pending = pendingRef.current
      const active = activeDragRef.current

      if (pending && pending.pointerId === e.pointerId && !active) {
        cancelPending()
        return
      }

      if (active && active.pointerId === e.pointerId) {
        e.preventDefault()
        finishDrag(active, e.clientX, e.clientY)
        activeDragRef.current = null
        setActiveDrag(null)
        cancelPending()
      }
    }

    const onPointerCancel = (e: PointerEvent) => {
      if (pendingRef.current?.pointerId === e.pointerId) cancelPending()
      if (activeDragRef.current?.pointerId === e.pointerId) {
        activeDragRef.current = null
        setActiveDrag(null)
        setDragOverZone(null)
        cancelPending()
      }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [cancelPending, finishDrag])

  const cardPointerProps = useCallback(
    (payload: DragPayload, style?: CSSProperties) => ({
      onPointerDown: (e: React.PointerEvent) => onCardPointerDown(e, payload),
      style: { touchAction: 'none', ...style } as const,
    }),
    [onCardPointerDown],
  )

  return {
    activeDrag,
    dragOverZone,
    setDragOverZone,
    cardPointerProps,
    isDragging: activeDrag != null,
  }
}
