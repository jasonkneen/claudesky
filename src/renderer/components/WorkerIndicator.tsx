import { Cpu, Eye, Loader2, Square, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { WorkerInfo, WorkerListUpdate, WorkerStreamUpdate } from '../../shared/types/worker';

interface WorkerViewerProps {
  worker: WorkerInfo;
  streamContent: string;
  onClose: () => void;
}

function WorkerViewer({ worker, streamContent, onClose }: WorkerViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamContent]);

  const statusColor = {
    pending: 'text-neutral-500',
    running: 'text-blue-500',
    paused: 'text-yellow-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
    cancelled: 'text-neutral-400'
  }[worker.status];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="max-h-[80vh] w-[600px] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
          <div className="flex items-center gap-3">
            <Cpu className={`h-5 w-5 ${statusColor}`} />
            <div>
              <h3 className="font-medium text-neutral-900 dark:text-neutral-100">{worker.label}</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {worker.status} • Started {formatTime(worker.startedAt)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="max-h-[60vh] overflow-auto bg-neutral-50 p-4 font-mono text-sm dark:bg-neutral-950"
        >
          {streamContent || worker.progress || (
            <span className="text-neutral-400 italic">No output yet...</span>
          )}
          {worker.error && (
            <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              Error: {worker.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function WorkerIndicator() {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [viewingWorker, setViewingWorker] = useState<string | null>(null);
  const [streamContents, setStreamContents] = useState<Record<string, string>>({});
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Subscribe to worker updates
  useEffect(() => {
    const unsubscribeList = window.electron.worker.onListUpdate((data: WorkerListUpdate) => {
      setWorkers(data.workers);
      // Initialize stream content for new workers
      data.workers.forEach((w) => {
        if (w.streamContent && !streamContents[w.id]) {
          setStreamContents((prev) => ({ ...prev, [w.id]: w.streamContent || '' }));
        }
      });
    });

    const unsubscribeStream = window.electron.worker.onStreamUpdate((data: WorkerStreamUpdate) => {
      setStreamContents((prev) => ({
        ...prev,
        [data.workerId]: (prev[data.workerId] || '') + data.delta
      }));
    });

    // Initial fetch
    window.electron.worker.list().then(({ workers }) => {
      setWorkers(workers);
    });

    return () => {
      unsubscribeList();
      unsubscribeStream();
    };
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsPopoverOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKill = useCallback(async (workerId: string) => {
    await window.electron.worker.kill(workerId);
  }, []);

  const handleKillAll = useCallback(async () => {
    await window.electron.worker.killAll();
  }, []);

  const activeWorkers = workers.filter((w) => w.status === 'running' || w.status === 'pending');

  // Don't render anything if no workers
  if (workers.length === 0) {
    return null;
  }

  const viewedWorker = viewingWorker ? workers.find((w) => w.id === viewingWorker) : null;

  return (
    <>
      {/* Floating indicator button */}
      <button
        ref={buttonRef}
        onClick={() => setIsPopoverOpen(!isPopoverOpen)}
        className={`fixed right-4 bottom-20 z-40 flex items-center gap-2 rounded-full px-3 py-2 shadow-lg transition ${
          activeWorkers.length > 0 ?
            'bg-blue-500 text-white hover:bg-blue-600'
          : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600'
        }`}
      >
        {activeWorkers.length > 0 ?
          <Loader2 className="h-4 w-4 animate-spin" />
        : <Cpu className="h-4 w-4" />}
        <span className="text-sm font-medium">
          {activeWorkers.length > 0 ? `${activeWorkers.length} running` : `${workers.length} done`}
        </span>
      </button>

      {/* Popover */}
      {isPopoverOpen && (
        <div
          ref={popoverRef}
          className="fixed right-4 bottom-32 z-50 w-80 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
            <h3 className="font-medium text-neutral-900 dark:text-neutral-100">Background Tasks</h3>
            {activeWorkers.length > 0 && (
              <button
                onClick={handleKillAll}
                className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                Kill All
              </button>
            )}
          </div>

          {/* Worker list */}
          <div className="max-h-64 overflow-y-auto">
            {workers.length === 0 ?
              <div className="px-3 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                No background tasks
              </div>
            : workers.map((worker) => {
                const statusColor = {
                  pending: 'bg-neutral-400',
                  running: 'bg-blue-500',
                  paused: 'bg-yellow-500',
                  completed: 'bg-green-500',
                  failed: 'bg-red-500',
                  cancelled: 'bg-neutral-400'
                }[worker.status];

                return (
                  <div
                    key={worker.id}
                    className="flex items-center gap-3 border-b border-neutral-100 px-3 py-2 last:border-0 dark:border-neutral-800"
                  >
                    <div className={`h-2 w-2 rounded-full ${statusColor}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {worker.label}
                      </p>
                      <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {worker.progress || worker.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewingWorker(worker.id)}
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                        title="View output"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {(worker.status === 'running' || worker.status === 'pending') && (
                        <button
                          onClick={() => handleKill(worker.id)}
                          className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 dark:hover:text-red-400"
                          title="Kill task"
                        >
                          <Square className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {/* Worker viewer modal */}
      {viewedWorker && (
        <WorkerViewer
          worker={viewedWorker}
          streamContent={streamContents[viewedWorker.id] || ''}
          onClose={() => setViewingWorker(null)}
        />
      )}
    </>
  );
}
