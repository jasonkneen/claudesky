/**
 * Split Divider
 *
 * Draggable divider for resizing split panes.
 * Supports both horizontal and vertical orientations.
 */

import { useEffect, useRef, useState } from 'react';

import type { SplitDirection } from '../../../shared/types/splits';

interface SplitDividerProps {
  direction: SplitDirection;
  onResize: (newRatio: number) => void;
}

export default function SplitDivider({ direction, onResize }: SplitDividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dividerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  const isVertical = direction === 'vertical';

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    // Find parent container
    const divider = dividerRef.current;
    if (divider && divider.parentElement) {
      containerRef.current = divider.parentElement;
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      if (!containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();

      const newRatio =
        isVertical ?
          (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height;

      // Clamp to 10%-90% to prevent invisible panes
      const clampedRatio = Math.max(0.1, Math.min(0.9, newRatio));

      onResize(clampedRatio);
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      setIsDragging(false);
      containerRef.current = null;
    };

    // Add to window for global capture
    window.addEventListener('mousemove', handleMouseMove, { capture: true });
    window.addEventListener('mouseup', handleMouseUp, { capture: true });
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = isVertical ? 'col-resize' : 'row-resize';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove, { capture: true });
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, isVertical, onResize]);

  return (
    <div
      ref={dividerRef}
      onMouseDown={handleMouseDown}
      className={`
        ${isVertical ? 'w-[8px] h-full cursor-col-resize' : 'h-[8px] w-full cursor-row-resize'}
        ${
          isDragging ?
            'bg-blue-500'
          : 'bg-neutral-300 hover:bg-blue-400 dark:bg-neutral-700 dark:hover:bg-blue-500'
        }
        transition-colors
        flex-shrink-0
      `}
    />
  );
}
