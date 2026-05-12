import { useCallback, useRef, useState } from 'react';

export function useLongPress(callback: () => void, ms: number = 500) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isPressing = useRef(false);

  const start = useCallback(() => {
    isPressing.current = true;
    timerRef.current = setTimeout(() => {
      if (isPressing.current) {
        callback();
      }
      timerRef.current = null;
    }, ms);
  }, [callback, ms]);

  const stop = useCallback(() => {
    isPressing.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
    onTouchMove: stop,
  };
}
