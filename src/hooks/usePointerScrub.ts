import { useMemo, useRef, useState } from 'react';

type ScrubOptions = {
  frame: number;
  maximum: number;
  disabled?: boolean;
  onFrame: (frame: number) => void;
  onTap: (clientX: number, clientY: number) => void;
  onFirstScrub: () => void;
};

type Gesture = {
  x: number;
  y: number;
  frame: number;
  pixelsPerFrame: number;
  intent: 'pending' | 'horizontal' | 'vertical';
};

const MOUSE_PIXELS_PER_FRAME = 8;
const TOUCH_PIXELS_PER_FRAME = 7;

export function usePointerScrub({ frame, maximum, disabled, onFrame, onTap, onFirstScrub }: ScrubOptions) {
  const gesture = useRef<Gesture | null>(null);
  const [dragging, setDragging] = useState(false);
  const clamp = (value: number) => Math.max(0, Math.min(maximum, value));

  return useMemo(() => ({
    dragging,
    pointerHandlers: {
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        gesture.current = {
          x: event.clientX,
          y: event.clientY,
          frame,
          pixelsPerFrame: event.pointerType === 'touch' ? TOUCH_PIXELS_PER_FRAME : MOUSE_PIXELS_PER_FRAME,
          intent: 'pending',
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        const active = gesture.current;
        if (!active || disabled) return;
        const dx = event.clientX - active.x;
        const dy = event.clientY - active.y;
        if (active.intent === 'pending' && Math.max(Math.abs(dx), Math.abs(dy)) > 7) {
          active.intent = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'horizontal' : 'vertical';
          if (active.intent === 'horizontal') setDragging(true);
        }
        if (active.intent === 'horizontal') {
          const next = clamp(active.frame - Math.round(dx / active.pixelsPerFrame));
          if (next !== frame) { onFrame(next); onFirstScrub(); }
        }
      },
      onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
        const active = gesture.current;
        gesture.current = null;
        setDragging(false);
        if (!active) return;
        const moved = Math.hypot(event.clientX - active.x, event.clientY - active.y);
        if (moved < 7) onTap(event.clientX, event.clientY);
      },
      onPointerCancel: () => { gesture.current = null; setDragging(false); },
    },
    touchHandlers: typeof window !== 'undefined' && !('PointerEvent' in window) ? {
      onTouchStart: (event: React.TouchEvent<HTMLElement>) => {
        const touch = event.touches[0];
        gesture.current = {
          x: touch.clientX,
          y: touch.clientY,
          frame,
          pixelsPerFrame: TOUCH_PIXELS_PER_FRAME,
          intent: 'pending',
        };
      },
      onTouchMove: (event: React.TouchEvent<HTMLElement>) => {
        const active = gesture.current;
        const touch = event.touches[0];
        if (!active || !touch || disabled) return;
        const dx = touch.clientX - active.x;
        const dy = touch.clientY - active.y;
        if (active.intent === 'pending' && Math.max(Math.abs(dx), Math.abs(dy)) > 7) {
          active.intent = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'horizontal' : 'vertical';
        }
        if (active.intent === 'horizontal') {
          onFrame(clamp(active.frame - Math.round(dx / active.pixelsPerFrame)));
          onFirstScrub();
        }
      },
      onTouchEnd: (event: React.TouchEvent<HTMLElement>) => {
        const active = gesture.current;
        const touch = event.changedTouches[0];
        gesture.current = null;
        if (active && touch && active.intent === 'pending') onTap(touch.clientX, touch.clientY);
      },
    } : {},
  }), [disabled, dragging, frame, maximum, onFirstScrub, onFrame, onTap]);
}
