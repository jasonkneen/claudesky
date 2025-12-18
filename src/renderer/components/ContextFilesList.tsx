import type { ContextFile } from '@/types/chat';

interface ContextFilesListProps {
  contextFiles: ContextFile[];
}

export default function ContextFilesList({ contextFiles }: ContextFilesListProps) {
  if (!contextFiles || contextFiles.length === 0) {
    return null;
  }

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {contextFiles.map((file) => (
        <div
          key={file.value}
          className="inline-flex items-center rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
        >
          <span className="truncate">{file.label}</span>
        </div>
      ))}
    </div>
  );
}
