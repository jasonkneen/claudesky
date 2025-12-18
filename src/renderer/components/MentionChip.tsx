import { X } from 'lucide-react';

interface MentionChipProps {
  label: string;
  onRemove: () => void;
}

export default function MentionChip({ label, onRemove }: MentionChipProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600">
      <span className="truncate">{label}</span>
      <button
        onClick={onRemove}
        className="ml-0.5 flex items-center justify-center rounded p-0 text-neutral-500 transition hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
        title="Remove"
        type="button"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
