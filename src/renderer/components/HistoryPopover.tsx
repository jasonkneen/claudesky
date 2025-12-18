import { ChevronUp } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface HistoryItem {
  id: string;
  text: string;
  timestamp: number;
}

interface HistoryPopoverProps {
  isOpen: boolean;
  items: HistoryItem[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (item: HistoryItem) => void;
  onClose: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export default function HistoryPopover({
  isOpen,
  items,
  selectedIndex,
  position,
  onSelect,
  onClose,
  onLoadMore,
  hasMore
}: HistoryPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current && containerRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      data-history-popover
      className="fixed z-50 max-h-64 w-96 overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent textarea blur
    >
      {items.length === 0 ?
        <div className="px-3 py-8 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No history yet. Send some messages to see them here.
          </p>
        </div>
      : items.map((item, index) => (
          <div
            key={item.id}
            ref={index === selectedIndex ? selectedItemRef : null}
            onClick={() => {
              onSelect(item);
              onClose();
            }}
            className={`cursor-pointer px-3 py-2 text-sm transition ${
              index === selectedIndex ?
                'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
              : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0 text-neutral-500 dark:text-neutral-400">↑</span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs leading-relaxed break-words">{item.text}</p>
              </div>
            </div>
          </div>
        ))
      }
      {items.length > 0 ?
        <>
          {hasMore && (
            <button
              onClick={onLoadMore}
              className="w-full border-t border-neutral-200 px-3 py-2 text-xs text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <div className="flex items-center justify-center gap-1">
                <ChevronUp className="h-3 w-3" />
                Load more
              </div>
            </button>
          )}
          <div className="border-t border-neutral-200 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            ↑↓ navigate • Tab insert • Enter send • Esc close
          </div>
        </>
      : null}
    </div>
  );
}
