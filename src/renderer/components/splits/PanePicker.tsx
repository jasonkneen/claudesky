/**
 * Pane Picker
 *
 * Let user choose what content to load in a pane.
 * Unlike NewTabPicker, this updates the current pane instead of creating new windows.
 */

import { CheckSquare, Columns3, FileText, FolderOpen, Globe } from 'lucide-react';
import { useState } from 'react';

import type { PaneContent } from '../../../shared/types/splits';
import { useSplitContext } from '../../contexts/SplitContext';

interface PanePickerProps {
  paneId: string;
}

type ContentOption = 'todos' | 'kanban' | 'notes' | 'project' | 'browser';

export default function PanePicker({ paneId }: PanePickerProps) {
  const { updatePaneContent } = useSplitContext();
  const [loading, setLoading] = useState(false);

  const handleSelect = async (option: ContentOption) => {
    setLoading(true);

    try {
      if (option === 'project') {
        // Browse for folder
        const result = await window.electron.project.browse();
        if (!result.canceled && result.path) {
          const newContent: PaneContent = {
            type: 'project',
            projectPath: result.path
          };
          updatePaneContent(paneId, newContent);
        }
      } else {
        // Update pane to show selected content type
        const newContent: PaneContent = { type: option };
        updatePaneContent(paneId, newContent);
      }
    } catch (error) {
      console.error('Failed to update pane content:', error);
    } finally {
      setLoading(false);
    }
  };

  const options = [
    {
      id: 'project' as const,
      name: 'Project',
      description: 'Open a project folder',
      icon: FolderOpen,
      color: 'text-amber-500',
      bgHover: 'hover:bg-amber-50 dark:hover:bg-amber-950/20'
    },
    {
      id: 'browser' as const,
      name: 'Browser',
      description: 'Browse the web',
      icon: Globe,
      color: 'text-cyan-500',
      bgHover: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/20'
    },
    {
      id: 'todos' as const,
      name: 'Todos',
      description: 'Track tasks',
      icon: CheckSquare,
      color: 'text-blue-500',
      bgHover: 'hover:bg-blue-50 dark:hover:bg-blue-950/20'
    },
    {
      id: 'kanban' as const,
      name: 'Kanban',
      description: 'Workflow boards',
      icon: Columns3,
      color: 'text-purple-500',
      bgHover: 'hover:bg-purple-50 dark:hover:bg-purple-950/20'
    },
    {
      id: 'notes' as const,
      name: 'Notes',
      description: 'Capture ideas',
      icon: FileText,
      color: 'text-green-500',
      bgHover: 'hover:bg-green-50 dark:hover:bg-green-950/20'
    }
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center bg-white p-8 dark:bg-neutral-900">
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Choose Content
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Select what to display in this pane
          </p>
        </div>

        {/* Options Grid - 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          {options.map((option) => {
            const Icon = option.icon;

            return (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                disabled={loading}
                className={`flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-4 transition-all disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 ${option.bgHover}`}
              >
                <Icon className={`h-6 w-6 ${option.color}`} />
                <div className="text-center">
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {option.name}
                  </span>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
