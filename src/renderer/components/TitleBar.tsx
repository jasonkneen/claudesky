import { History, Plus, Settings } from 'lucide-react';

interface TitleBarProps {
  onOpenHistory?: () => void;
  onNewChat?: () => void;
  onOpenSettings?: () => void;
  projectName?: string;
}

export default function TitleBar({ onOpenHistory, onNewChat, onOpenSettings, projectName }: TitleBarProps) {
  // Detect Windows platform
  const isWindows = navigator.platform.toLowerCase().includes('win');

  const hasActions = onOpenHistory || onNewChat;

  return (
    <div className="pointer-events-none fixed top-0 right-0 left-0 z-40 h-12 border-b border-neutral-200/70 bg-white/80 backdrop-blur-md [-webkit-app-region:drag] dark:border-neutral-800 dark:bg-neutral-900/80">
      <div
        className={`pointer-events-auto flex h-full w-full items-center justify-between ${
          isWindows ? 'px-3 sm:px-4' : 'pr-[10px] pl-[10px]'
        }`}
      >
        {hasActions && (
          <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
            {onOpenHistory && (
              <button
                onClick={onOpenHistory}
                className="flex items-center gap-1.5 rounded-full border border-neutral-200/60 bg-white px-[10px] py-[4px] text-[12px] font-medium text-neutral-700 shadow-sm shadow-black/5 transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:shadow-black/20 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                title="Open chat history"
                aria-label="Open chat history"
              >
                <History className="h-[13px] w-[13px]" />
                <span className="hidden sm:inline">Chats</span>
              </button>
            )}

            {onNewChat && (
              <button
                onClick={onNewChat}
                className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-neutral-200/60 bg-white text-neutral-700 shadow-sm shadow-black/5 transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:shadow-black/20 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                title="Start new chat"
                aria-label="Start new chat"
              >
                <Plus className="h-[13px] w-[13px]" />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 flex items-center justify-center">
          {projectName && (
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate max-w-xs">
              {projectName}
            </span>
          )}
        </div>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full border border-neutral-200/60 bg-white text-neutral-700 shadow-sm shadow-black/5 transition-colors [-webkit-app-region:no-drag] hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:shadow-black/20 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings className="h-[13px] w-[13px]" />
          </button>
        )}
      </div>
    </div>
  );
}
