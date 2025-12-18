import { Brain, Sparkles, X, Zap } from 'lucide-react';
import { useEffect, useRef } from 'react';

import type { ThinkingMode } from '../../shared/types/ipc';

interface ThinkingModeOption {
  mode: ThinkingMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
}

const thinkingModeOptions: ThinkingModeOption[] = [
  {
    mode: 'off',
    label: 'Off',
    description: 'No extended thinking',
    icon: <X className="h-4 w-4" />,
    colorClass: 'text-neutral-400',
    bgClass: 'bg-neutral-100 dark:bg-neutral-800'
  },
  {
    mode: 'low',
    label: 'Low',
    description: 'Light reasoning (~1K tokens)',
    icon: <Brain className="h-4 w-4" />,
    colorClass: 'text-pink-300',
    bgClass: 'bg-pink-50 dark:bg-pink-950/30'
  },
  {
    mode: 'medium',
    label: 'Medium',
    description: 'Moderate thinking (~4K tokens)',
    icon: <Brain className="h-4 w-4" />,
    colorClass: 'text-pink-400',
    bgClass: 'bg-pink-100 dark:bg-pink-900/30'
  },
  {
    mode: 'high',
    label: 'High',
    description: 'Deep reasoning (~16K tokens)',
    icon: <Brain className="h-4 w-4" />,
    colorClass: 'text-pink-500',
    bgClass: 'bg-pink-200 dark:bg-pink-800/40'
  },
  {
    mode: 'ultra',
    label: 'Ultra',
    description: 'Maximum thinking (~64K tokens)',
    icon: <Sparkles className="h-4 w-4" />,
    colorClass:
      'text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500',
    bgClass:
      'bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 dark:from-pink-900/30 dark:via-purple-900/30 dark:to-blue-900/30'
  }
];

interface ThinkingModePopoverProps {
  isOpen: boolean;
  currentMode: ThinkingMode;
  onSelect: (mode: ThinkingMode) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export default function ThinkingModePopover({
  isOpen,
  currentMode,
  onSelect,
  onClose,
  position
}: ThinkingModePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleArrowNavigation = (e: KeyboardEvent) => {
      if (!menuRef.current) return;

      const buttons = Array.from(
        menuRef.current.querySelectorAll('button[role="menuitem"]')
      ) as HTMLButtonElement[];
      const activeIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = activeIndex < buttons.length - 1 ? activeIndex + 1 : 0;
        buttons[nextIndex]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = activeIndex > 0 ? activeIndex - 1 : buttons.length - 1;
        buttons[prevIndex]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        buttons[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        buttons[buttons.length - 1]?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleArrowNavigation);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleArrowNavigation);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      id="thinking-mode-menu"
      className="fixed z-50 w-64 rounded-xl border border-neutral-200/80 bg-white/95 p-2 shadow-lg backdrop-blur-xl dark:border-neutral-700/70 dark:bg-neutral-900/95"
      style={{
        top: position.top,
        left: position.left
      }}
      role="menu"
      aria-label="Thinking Mode Options"
    >
      <div className="mb-2 flex items-center gap-2 px-2 py-1">
        <Zap className="h-4 w-4 text-pink-500" aria-hidden="true" />
        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Thinking Mode
        </span>
      </div>
      <div className="space-y-1" ref={menuRef}>
        {thinkingModeOptions.map((option) => (
          <button
            key={option.mode}
            role="menuitem"
            aria-label={`${option.label}: ${option.description}`}
            aria-current={currentMode === option.mode ? 'true' : undefined}
            onClick={() => {
              onSelect(option.mode);
              onClose();
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus:ring-2 focus:ring-pink-400 focus:ring-offset-0 focus:outline-none dark:focus:ring-pink-500 ${
              currentMode === option.mode ?
                `${option.bgClass} ring-1 ring-pink-300 dark:ring-pink-700`
              : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${option.bgClass} ${option.colorClass}`}
              aria-hidden="true"
            >
              {option.icon}
            </div>
            <div className="flex-1">
              <div className={`text-sm font-medium ${option.colorClass}`}>
                {option.mode === 'ultra' ?
                  <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                    {option.label}
                  </span>
                : option.label}
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {option.description}
              </div>
            </div>
            {currentMode === option.mode && (
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white"
                aria-hidden="true"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function getThinkingModeColor(mode: ThinkingMode): string {
  switch (mode) {
    case 'off':
      return 'text-neutral-400';
    case 'low':
      return 'text-pink-300';
    case 'medium':
      return 'text-pink-400';
    case 'high':
      return 'text-pink-500';
    case 'ultra':
      return '';
    default:
      return 'text-neutral-400';
  }
}

export function getThinkingModeBackground(mode: ThinkingMode): string {
  switch (mode) {
    case 'off':
      return 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600';
    case 'low':
      return 'bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950/50 dark:to-pink-900/30 border-pink-200 dark:border-pink-800';
    case 'medium':
      return 'bg-gradient-to-br from-pink-100 to-pink-200 dark:from-pink-900/50 dark:to-pink-800/40 border-pink-300 dark:border-pink-700';
    case 'high':
      return 'bg-gradient-to-br from-pink-200 to-pink-300 dark:from-pink-800/60 dark:to-pink-700/50 border-pink-400 dark:border-pink-600';
    case 'ultra':
      return 'bg-gradient-to-br from-pink-300 via-purple-300 to-blue-300 dark:from-pink-700/60 dark:via-purple-700/60 dark:to-blue-700/60 border-purple-400 dark:border-purple-600';
    default:
      return 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600';
  }
}
