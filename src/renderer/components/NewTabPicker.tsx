import { CheckSquare, Columns3, FileText, FolderOpen, Loader2 } from 'lucide-react';
import { useState } from 'react';

import TitleBar from '@/components/TitleBar';

interface NewTabPickerProps {
  onOpenSettings: () => void;
}

type TabOption = 'todos' | 'kanban' | 'notes' | 'project';

export default function NewTabPicker({ onOpenSettings }: NewTabPickerProps) {
  const [loading, setLoading] = useState<TabOption | null>(null);

  const handleSelect = async (option: TabOption) => {
    setLoading(option);

    try {
      if (option === 'project') {
        // Browse for folder
        const result = await window.electron.project.browse();
        if (!result.canceled && result.path) {
          await window.electron.project.open(result.path);
        }
      } else {
        // Create a new tab of the selected type
        await window.electron.tab.create(option);
      }
    } catch (error) {
      console.error('Failed to create tab:', error);
    } finally {
      setLoading(null);
    }
  };

  const options = [
    {
      id: 'todos' as const,
      name: 'Todos',
      description: 'Track tasks and stay organized',
      icon: CheckSquare,
      color: 'text-blue-500'
    },
    {
      id: 'kanban' as const,
      name: 'Kanban',
      description: 'Visualize workflow with boards',
      icon: Columns3,
      color: 'text-purple-500'
    },
    {
      id: 'notes' as const,
      name: 'Notes',
      description: 'Capture ideas and information',
      icon: FileText,
      color: 'text-green-500'
    },
    {
      id: 'project' as const,
      name: 'Project',
      description: 'Open a project folder',
      icon: FolderOpen,
      color: 'text-amber-500'
    }
  ];

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-neutral-900">
      <TitleBar onOpenSettings={onOpenSettings} />

      <div className="flex flex-1 flex-col items-center justify-center p-8 pt-[48px]">
        <div className="w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">New Tab</h1>
            <p className="mt-2 text-neutral-500 dark:text-neutral-400">
              What would you like to create?
            </p>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-2 gap-4">
            {options.map((option) => {
              const Icon = option.icon;
              const isLoading = loading === option.id;

              return (
                <button
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  disabled={loading !== null}
                  className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-6 text-center transition-all hover:border-neutral-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600"
                >
                  {isLoading ?
                    <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                  : <Icon className={`h-8 w-8 ${option.color}`} />}
                  <div>
                    <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {option.name}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
