import { useEffect, useRef } from 'react';

export interface PopoverItem {
  id: string;
  label: string;
  icon?: string;
}

interface MentionPopoverProps {
  isOpen: boolean;
  items: PopoverItem[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (item: PopoverItem) => void;
  onClose: () => void;
  trigger: '@' | '/';
}

export default function MentionPopover({
  isOpen,
  items,
  selectedIndex,
  position,
  onSelect,
  onClose,
  trigger
}: MentionPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current && containerRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen || items.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="fixed z-50 max-h-64 w-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent textarea blur
    >
      {items.map((item, index) => (
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
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 dark:text-neutral-400">{trigger}</span>
            <span className="truncate">{item.label}</span>
          </div>
        </div>
      ))}
      <div className="border-t border-neutral-200 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        ↑↓ navigate • Tab/Enter select • Esc close
      </div>
    </div>
  );
}
