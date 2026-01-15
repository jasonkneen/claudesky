import { CheckSquare, Clock, Columns3, FileText, FolderOpen, Globe, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Project {
  path: string;
  name: string;
  lastOpened?: string;
}

type TabOption = 'todos' | 'kanban' | 'notes' | 'browser';

export default function ProjectPicker() {
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openingProject, setOpeningProject] = useState<string | null>(null);
  const [creatingTab, setCreatingTab] = useState<TabOption | null>(null);

  useEffect(() => {
    // Load recent projects
    window.electron.project
      .listRecent()
      .then((response) => {
        console.log('[ProjectPicker] Loaded recent projects:');
        response.projects.forEach((p, i) => {
          console.log(`  [${i}] ${p.name} - ${p.path}`);
        });
        setRecentProjects(response.projects);
      })
      .catch((error) => {
        console.error('Failed to load recent projects:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleOpenProject = async (projectPath: string) => {
    setOpeningProject(projectPath);
    try {
      await window.electron.project.open(projectPath);
    } catch (error) {
      console.error('Failed to open project:', error);
    } finally {
      setOpeningProject(null);
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const result = await window.electron.project.browse();
      if (!result.canceled && result.path) {
        await handleOpenProject(result.path);
      }
    } catch (error) {
      console.error('Failed to browse for folder:', error);
    }
  };

  const handleCreateTab = async (type: TabOption) => {
    setCreatingTab(type);
    try {
      await window.electron.tab.create(type);
    } catch (error) {
      console.error('Failed to create tab:', error);
    } finally {
      setCreatingTab(null);
    }
  };

  const tabOptions = [
    {
      id: 'todos' as const,
      name: 'Todos',
      description: 'Track tasks',
      icon: CheckSquare,
      color: 'text-blue-500',
      bgHover:
        'hover:border-blue-400 hover:bg-blue-50/50 dark:hover:border-blue-500 dark:hover:bg-blue-950/20'
    },
    {
      id: 'kanban' as const,
      name: 'Kanban',
      description: 'Visual boards',
      icon: Columns3,
      color: 'text-purple-500',
      bgHover:
        'hover:border-purple-400 hover:bg-purple-50/50 dark:hover:border-purple-500 dark:hover:bg-purple-950/20'
    },
    {
      id: 'notes' as const,
      name: 'Notes',
      description: 'Capture ideas',
      icon: FileText,
      color: 'text-green-500',
      bgHover:
        'hover:border-green-400 hover:bg-green-50/50 dark:hover:border-green-500 dark:hover:bg-green-950/20'
    },
    {
      id: 'browser' as const,
      name: 'Browser',
      description: 'Web research',
      icon: Globe,
      color: 'text-cyan-500',
      bgHover:
        'hover:border-cyan-400 hover:bg-cyan-50/50 dark:hover:border-cyan-500 dark:hover:bg-cyan-950/20'
    }
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-6">
        {/* Welcome Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
            Welcome to Claudesky
          </h1>
          <p className="mt-2 text-neutral-500 dark:text-neutral-400">
            Open a project to get started
          </p>
        </div>

        {/* Open Folder Button */}
        <button
          onClick={handleBrowseFolder}
          className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 bg-white/50 px-6 py-5 text-neutral-700 transition-all hover:border-amber-400 hover:bg-amber-50/50 dark:border-neutral-700 dark:bg-neutral-900/30 dark:text-neutral-300 dark:hover:border-amber-500 dark:hover:bg-amber-950/20"
        >
          <FolderOpen className="h-5 w-5 text-amber-500" />
          <span className="font-medium">Open Project Folder</span>
        </button>

        {/* Recent Projects - directly under Open Folder */}
        {isLoading ?
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
          </div>
        : recentProjects.length > 0 ?
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
              <Clock className="h-3.5 w-3.5" />
              <span>Recent Projects</span>
            </div>
            <div className="space-y-1.5">
              {recentProjects.map((project) => (
                <button
                  key={project.path}
                  onClick={() => handleOpenProject(project.path)}
                  disabled={openingProject === project.path}
                  className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600 dark:hover:bg-neutral-700"
                >
                  {openingProject === project.path ?
                    <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-500" />
                  : <FolderOpen className="h-4 w-4 flex-shrink-0 text-amber-500" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {project.name}
                    </p>
                    <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {project.path}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        : null}

        {/* Divider */}
        <div className="flex items-center gap-3 pt-2">
          <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
          <span className="text-xs text-neutral-400 dark:text-neutral-500">or start fresh</span>
          <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
        </div>

        {/* Quick Actions Grid - 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          {tabOptions.map((option) => {
            const Icon = option.icon;
            const isCreating = creatingTab === option.id;

            return (
              <button
                key={option.id}
                onClick={() => handleCreateTab(option.id)}
                disabled={creatingTab !== null}
                className={`flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-4 transition-all disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 ${option.bgHover}`}
              >
                {isCreating ?
                  <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                : <Icon className={`h-6 w-6 ${option.color}`} />}
                <div className="text-center">
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {option.name}
                  </span>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
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
